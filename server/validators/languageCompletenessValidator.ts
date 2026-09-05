import {
  LanguageCompletenessItem,
  LanguageCompletenessResult,
  LanguageCompletenessStatus,
  IgnoredCompletenessItem,
} from '../../src/types';
import { StoredCrawlSession } from '../services/crawlStore';
import { buildLocalizedUrl, getCanonicalPath } from '../crawler/canonicalPath';
import { isAmpUrl } from '../../src/utils/canonicalLanguage';
import { shouldIgnoreUrl } from '../services/domainSettingsStore';

/**
 * Validates language completeness using the page-by-page rule:
 * - English/default language is the reference.
 * - It is NOT mandatory for every English page to have translations.
 * - A page is only required to have full translation coverage IF it has at least
 *   ONE alternative-language version (making it a "multilingual page").
 * - English-only pages are completely valid and produce ZERO errors.
 * - Non-English pages that do not exist in English are classified as "additional" pages.
 * - Exclusions are evaluated using shouldIgnoreUrl('languageCompleteness').
 * - NOTE: AMP pages are mobile presentation formats, NOT localized languages.
 */
export function validateLanguageCompleteness(session: StoredCrawlSession): LanguageCompletenessResult {
  const ignoredItems: IgnoredCompletenessItem[] = [];
  let pagesChecked = 0;
  let pagesIgnored = 0;

  // 1. Partition session items
  const englishCanonicalPaths = new Map<string, string>(); // canonPath -> full English URL
  const languageGroups = new Map<
    string,
    {
      name: string;
      code: string;
      canonicalPaths: Map<string, string>; // canonPath -> full URL
    }
  >();

  for (const item of session.items.values()) {
    // AMP URLs are mobile page formats, not language translations
    if (isAmpUrl(item.normalizedUrl)) {
      continue;
    }

    const ignoreCheck = shouldIgnoreUrl(item, 'languageCompleteness', session);
    if (ignoreCheck.ignored) {
      pagesIgnored++;
      ignoredItems.push({
        url: item.normalizedUrl,
        canonicalPath: item.canonicalPath || getCanonicalPath(item.normalizedUrl),
        language: item.language || item.langCode || 'Unknown',
        reason: ignoreCheck.reason || 'Excluded by rule',
      });
      continue;
    }

    pagesChecked++;
    const canonical = item.canonicalPath || getCanonicalPath(item.normalizedUrl);

    if (item.isEnglish || item.langCode === 'default' || item.langCode === 'en') {
      englishCanonicalPaths.set(canonical, item.normalizedUrl);
    } else {
      const code = item.langCode;
      if (!languageGroups.has(code)) {
        languageGroups.set(code, {
          name: item.language,
          code,
          canonicalPaths: new Map(),
        });
      }
      languageGroups.get(code)!.canonicalPaths.set(canonical, item.normalizedUrl);
    }
  }

  const totalEnglishPages = englishCanonicalPaths.size;

  // 2. Identify Multilingual Pages vs English-Only Pages
  const multilingualPaths: string[] = [];
  const englishOnlyPaths: string[] = [];

  for (const canonPath of englishCanonicalPaths.keys()) {
    let hasTranslation = false;
    for (const group of languageGroups.values()) {
      if (group.canonicalPaths.has(canonPath)) {
        hasTranslation = true;
        break;
      }
    }

    if (hasTranslation) {
      multilingualPaths.push(canonPath);
    } else {
      englishOnlyPaths.push(canonPath);
    }
  }

  const multilingualPagesCount = multilingualPaths.length;
  const englishOnlyCount = englishOnlyPaths.length;

  const results: LanguageCompletenessItem[] = [];
  let totalMissing = 0;
  let totalAdditional = 0;

  // 3. Add Default / English reference entry
  results.push({
    language: 'English (Reference)',
    languageCode: 'default',
    expected: multilingualPagesCount,
    found: multilingualPagesCount,
    missingCount: 0,
    additionalCount: 0,
    status: 'complete',
    missingUrls: [],
    additionalUrls: [],
    matchingUrls: multilingualPaths.map((p) => englishCanonicalPaths.get(p)!),
  });

  // 4. Evaluate each non-English language against the multilingual set
  for (const group of languageGroups.values()) {
    const missingUrls: string[] = [];
    const additionalUrls: string[] = [];
    const matchingUrls: string[] = [];
    const missingDetails: Array<{
      englishUrl: string;
      canonicalPath: string;
      missingLanguage: string;
      missingLanguageCode: string;
      expectedUrl: string;
    }> = [];

    // Check only the pages that are designated as multilingual
    for (const canonPath of multilingualPaths) {
      if (group.canonicalPaths.has(canonPath)) {
        matchingUrls.push(group.canonicalPaths.get(canonPath)!);
      } else {
        const englishUrl = englishCanonicalPaths.get(canonPath) || '';
        const generatedMissingUrl = buildLocalizedUrl(session.origin, group.code, canonPath);
        missingUrls.push(generatedMissingUrl);
        missingDetails.push({
          englishUrl,
          canonicalPath: canonPath,
          missingLanguage: group.name,
          missingLanguageCode: group.code,
          expectedUrl: generatedMissingUrl,
        });
      }
    }

    // Additional pages in this language that do not exist in English at all
    for (const [transCanonPath, transUrl] of group.canonicalPaths.entries()) {
      if (!englishCanonicalPaths.has(transCanonPath)) {
        additionalUrls.push(transUrl);
      }
    }

    let status: LanguageCompletenessStatus = 'complete';
    if (missingUrls.length > 0) {
      status = 'incomplete';
    } else if (additionalUrls.length > 0) {
      status = 'has_additional';
    }

    totalMissing += missingUrls.length;
    totalAdditional += additionalUrls.length;

    results.push({
      language: group.name,
      languageCode: group.code,
      expected: multilingualPagesCount,
      found: matchingUrls.length,
      missingCount: missingUrls.length,
      additionalCount: additionalUrls.length,
      status,
      missingUrls,
      additionalUrls,
      matchingUrls,
      missingDetails,
    });
  }

  // Sort: incomplete first (errors), then has_additional (warnings), then complete
  results.sort((a, b) => {
    if (a.languageCode === 'default') return -1;
    if (b.languageCode === 'default') return 1;
    const order: Record<string, number> = { incomplete: 0, has_additional: 1, complete: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  return {
    englishReferenceCount: totalEnglishPages,
    totalEnglishPages,
    englishOnlyPages: englishOnlyCount,
    multilingualPages: multilingualPagesCount,
    pagesChecked,
    pagesIgnored,
    languages: results,
    totalMissing,
    totalAdditional,
    ignoredItems,
  };
}
