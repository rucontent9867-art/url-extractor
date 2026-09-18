import {
  ContentLanguageItem,
  ContentLanguageResult,
  ContentLanguageStatus,
  MismatchedTextBlock,
  LanguageDistributionEntry,
} from '../../src/types';
import { StoredCrawlSession } from '../services/crawlStore';
import {
  CANONICAL_LANGUAGES,
  getCanonicalLanguage,
  normalizeLanguageCode,
  extractUrlLanguage,
  detectUnicodeScript,
} from '../../src/utils/canonicalLanguage';
import { hasIgnoredSlug } from '../crawler/urlNormalizer';
import { getEffectiveIgnoredSlugs } from '../services/settingsStore';

import LanguageDetect from 'languagedetect';
const lngDetector = new (LanguageDetect as any)();

// Map from detector language names (lowercase) to standard ISO code & clean English name
const DETECTOR_LANG_MAP: Record<string, { code: string; name: string }> = {
  english: { code: 'en', name: 'English' },
  french: { code: 'fr', name: 'French' },
  german: { code: 'de', name: 'German' },
  italian: { code: 'it', name: 'Italian' },
  spanish: { code: 'es', name: 'Spanish' },
  russian: { code: 'ru', name: 'Russian' },
  portuguese: { code: 'pt', name: 'Portuguese' },
  dutch: { code: 'nl', name: 'Dutch' },
  polish: { code: 'pl', name: 'Polish' },
  turkish: { code: 'tr', name: 'Turkish' },
  arabic: { code: 'ar', name: 'Arabic' },
  chinese: { code: 'zh', name: 'Chinese' },
  japanese: { code: 'ja', name: 'Japanese' },
  korean: { code: 'ko', name: 'Korean' },
  hindi: { code: 'hi', name: 'Hindi' },
  indonesian: { code: 'id', name: 'Indonesian' },
  vietnamese: { code: 'vi', name: 'Vietnamese' },
  thai: { code: 'th', name: 'Thai' },
  swedish: { code: 'sv', name: 'Swedish' },
  norwegian: { code: 'no', name: 'Norwegian' },
  danish: { code: 'da', name: 'Danish' },
  finnish: { code: 'fi', name: 'Finnish' },
  greek: { code: 'el', name: 'Greek' },
  czech: { code: 'cs', name: 'Czech' },
  hungarian: { code: 'hu', name: 'Hungarian' },
  romanian: { code: 'ro', name: 'Romanian' },
  ukrainian: { code: 'uk', name: 'Ukrainian' },
  hebrew: { code: 'he', name: 'Hebrew' },
  bulgarian: { code: 'bg', name: 'Bulgarian' },
  catalan: { code: 'ca', name: 'Catalan' },
  croatian: { code: 'hr', name: 'Croatian' },
  slovak: { code: 'sk', name: 'Slovak' },
  slovenian: { code: 'sl', name: 'Slovenian' },
  serbian: { code: 'sr', name: 'Serbian' },
  lithuanian: { code: 'lt', name: 'Lithuanian' },
  latvian: { code: 'lv', name: 'Latvian' },
  estonian: { code: 'et', name: 'Estonian' },
  persian: { code: 'fa', name: 'Persian' },
  malay: { code: 'ms', name: 'Malay' },
  bengali: { code: 'bn', name: 'Bengali' },
  filipino: { code: 'tl', name: 'Filipino' },
  tagalog: { code: 'tl', name: 'Filipino' },
  icelandic: { code: 'is', name: 'Icelandic' },
  irish: { code: 'ga', name: 'Irish' },
  afrikaans: { code: 'af', name: 'Afrikaans' },
  swahili: { code: 'sw', name: 'Swahili' },
};

/**
 * Detects text language and returns detected canonical name, canonical code, confidence (0-100), and language distribution.
 */
export function detectTextContentLanguage(text: string): {
  code: string;
  name: string;
  confidence: number;
  scores: { code: string; name: string; score: number }[];
} {
  const clean = (text || '').trim();
  if (clean.length < 20) {
    return { code: 'unknown', name: 'Insufficient Text', confidence: 0, scores: [] };
  }

  // 1. Deterministic Unicode Script Analysis
  const scriptAnalysis = detectUnicodeScript(clean);
  const totalChars = scriptAnalysis.charCount || clean.length;

  if (scriptAnalysis.primaryScript === 'Cyrillic' && scriptAnalysis.scriptDistribution.Cyrillic / totalChars > 0.25) {
    if (/[іїє]/i.test(clean)) {
      return { code: 'uk', name: 'Ukrainian', confidence: 98, scores: [{ code: 'uk', name: 'Ukrainian', score: 98 }] };
    }
    return { code: 'ru', name: 'Russian', confidence: 98, scores: [{ code: 'ru', name: 'Russian', score: 98 }] };
  }

  if (scriptAnalysis.primaryScript === 'Arabic' && scriptAnalysis.scriptDistribution.Arabic / totalChars > 0.25) {
    if (/[گچپژ]/i.test(clean)) {
      return { code: 'fa', name: 'Persian', confidence: 98, scores: [{ code: 'fa', name: 'Persian', score: 98 }] };
    }
    return { code: 'ar', name: 'Arabic', confidence: 98, scores: [{ code: 'ar', name: 'Arabic', score: 98 }] };
  }

  if (scriptAnalysis.primaryScript === 'Hangul' && scriptAnalysis.scriptDistribution.Hangul / totalChars > 0.2) {
    return { code: 'ko', name: 'Korean', confidence: 99, scores: [{ code: 'ko', name: 'Korean', score: 99 }] };
  }

  if (scriptAnalysis.primaryScript === 'JapaneseKana' || (scriptAnalysis.scriptDistribution.JapaneseKana && scriptAnalysis.scriptDistribution.JapaneseKana > 4)) {
    return { code: 'ja', name: 'Japanese', confidence: 99, scores: [{ code: 'ja', name: 'Japanese', score: 99 }] };
  }

  if (scriptAnalysis.primaryScript === 'Han' && scriptAnalysis.scriptDistribution.Han / totalChars > 0.2) {
    return { code: 'zh', name: 'Chinese', confidence: 98, scores: [{ code: 'zh', name: 'Chinese', score: 98 }] };
  }

  if (scriptAnalysis.primaryScript === 'Greek' && scriptAnalysis.scriptDistribution.Greek / totalChars > 0.2) {
    return { code: 'el', name: 'Greek', confidence: 99, scores: [{ code: 'el', name: 'Greek', score: 99 }] };
  }

  if (scriptAnalysis.primaryScript === 'Hebrew' && scriptAnalysis.scriptDistribution.Hebrew / totalChars > 0.2) {
    return { code: 'he', name: 'Hebrew', confidence: 99, scores: [{ code: 'he', name: 'Hebrew', score: 99 }] };
  }

  if (scriptAnalysis.primaryScript === 'Thai' && scriptAnalysis.scriptDistribution.Thai / totalChars > 0.2) {
    return { code: 'th', name: 'Thai', confidence: 99, scores: [{ code: 'th', name: 'Thai', score: 99 }] };
  }

  if (scriptAnalysis.primaryScript === 'Devanagari' && scriptAnalysis.scriptDistribution.Devanagari / totalChars > 0.2) {
    return { code: 'hi', name: 'Hindi', confidence: 98, scores: [{ code: 'hi', name: 'Hindi', score: 98 }] };
  }

  if (scriptAnalysis.primaryScript === 'Bengali' && scriptAnalysis.scriptDistribution.Bengali / totalChars > 0.2) {
    return { code: 'bn', name: 'Bengali', confidence: 98, scores: [{ code: 'bn', name: 'Bengali', score: 98 }] };
  }

  // Use n-gram language detector for Latin and other scripts
  try {
    const rawScores: [string, number][] = lngDetector.detect(clean, 5);

    if (!rawScores || rawScores.length === 0) {
      return { code: 'unknown', name: 'Undetermined', confidence: 0, scores: [] };
    }

    const [topLang, topScore] = rawScores[0];
    const secondScore = rawScores[1] ? rawScores[1][1] : 0;

    const mapped = DETECTOR_LANG_MAP[topLang.toLowerCase()];
    const rawCode = mapped ? mapped.code : topLang.slice(0, 2).toLowerCase();
    const canonical = getCanonicalLanguage(rawCode);
    const code = canonical.code;
    const name = canonical.name;

    // Calculate normalized confidence percentage (0 - 100)
    let confidence: number;
    if (secondScore > 0) {
      const margin = (topScore - secondScore) / topScore;
      confidence = Math.min(99, Math.max(45, Math.round(topScore * 130 + margin * 35)));
    } else {
      confidence = Math.min(99, Math.round(topScore * 160));
    }

    // Penalize short text
    if (clean.length < 60) {
      confidence = Math.min(confidence, 65);
    } else if (clean.length < 120) {
      confidence = Math.min(confidence, 82);
    }

    const scores = rawScores.map(([l, sc]) => {
      const m = DETECTOR_LANG_MAP[l.toLowerCase()];
      const scCode = m ? m.code : l.slice(0, 2).toLowerCase();
      const scCanon = getCanonicalLanguage(scCode);
      return {
        code: scCanon.code,
        name: scCanon.name,
        score: Math.round(sc * 100),
      };
    });

    return {
      code,
      name,
      confidence,
      scores,
    };
  } catch {
    return { code: 'unknown', name: 'Undetermined', confidence: 0, scores: [] };
  }
}

export interface BlockAnalysisResult {
  mismatchedBlocks: MismatchedTextBlock[];
  mismatchedChars: number;
  languageDistribution: LanguageDistributionEntry[];
}

/**
 * Extracts meaningful static text blocks/sentences from static visible text or DOM blocks.
 * Strictly adheres to the rule: Do NOT treat individual foreign words as a language mismatch.
 * Analyzes meaningful text blocks/sentences/paragraphs with sufficient language evidence.
 */
export function analyzeStaticContentBlocks(
  staticText: string,
  expectedCode: string,
  expectedLanguage: string,
  staticBlocks?: { text: string }[],
  totalStaticChars?: number
): BlockAnalysisResult {
  const totalChars = totalStaticChars && totalStaticChars > 0 ? totalStaticChars : (staticText.length || 1);
  const rawList: string[] = [];

  const canonicalExpectedCode = normalizeLanguageCode(expectedCode);

  if (staticBlocks && staticBlocks.length > 0) {
    for (const b of staticBlocks) {
      if (!b.text) continue;
      const trimmed = b.text.trim();
      if (!trimmed) continue;
      // If block is long with multiple sentences, break down by sentence punctuation
      if (trimmed.length > 250) {
        const sentences = trimmed.split(/(?<=[.!?؟。])\s+/);
        for (const s of sentences) {
          if (s.trim()) rawList.push(s.trim());
        }
      } else {
        rawList.push(trimmed);
      }
    }
  } else {
    // Fallback: split staticText by newlines and sentence delimiters
    const lines = staticText.split(/[\r\n]+/);
    for (const line of lines) {
      const parts = line.split(/(?<=[.!?؟。])\s+/);
      for (const p of parts) {
        if (p.trim()) rawList.push(p.trim());
      }
    }
  }

  // Deduplicate candidate blocks
  const candidateBlocks = Array.from(new Set(rawList));
  const mismatchedBlocks: MismatchedTextBlock[] = [];
  const langCharMap: Record<string, { name: string; code: string; chars: number }> = {};

  for (const block of candidateBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/\s+/).filter(Boolean);

    // Non-Latin script detection
    const arabicChars = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
    const cyrillicChars = (trimmed.match(/[\u0400-\u04FF]/g) || []).length;
    const cjkChars = (trimmed.match(/[\u4E00-\u9FFF]/g) || []).length;
    const hangulChars = (trimmed.match(/[\uAC00-\uD7AF]/g) || []).length;
    const greekChars = (trimmed.match(/[\u0370-\u03FF]/g) || []).length;
    const hebrewChars = (trimmed.match(/[\u0590-\u05FF]/g) || []).length;

    const isDistinctiveScript =
      arabicChars >= 8 ||
      cyrillicChars >= 8 ||
      cjkChars >= 6 ||
      hangulChars >= 6 ||
      greekChars >= 8 ||
      hebrewChars >= 8;

    // Rule: Do NOT treat individual foreign words ("Egypt", "Cairo", "British Embassy", "eVisa") as a mismatch!
    // Minimum evidence requirement:
    // Either distinctive non-Latin script with >= 6-8 chars,
    // OR Latin script with at least 22 characters AND at least 3 words.
    if (!isDistinctiveScript && (trimmed.length < 22 || words.length < 3)) {
      continue;
    }

    const detected = detectTextContentLanguage(trimmed);
    if (detected.code === 'unknown' || detected.confidence === 0) continue;

    const detectedCanonicalCode = normalizeLanguageCode(detected.code);
    const isMatch = detectedCanonicalCode === canonicalExpectedCode;

    if (!isMatch) {
      // For Latin languages, require confident detection (>= 60%) and at least 4 words
      if (!isDistinctiveScript && (detected.confidence < 60 || words.length < 4)) {
        continue;
      }

      mismatchedBlocks.push({
        text: trimmed,
        detectedLanguage: detected.name,
        detectedCode: detectedCanonicalCode,
        confidence: detected.confidence,
        charCount: trimmed.length,
      });

      if (!langCharMap[detectedCanonicalCode]) {
        langCharMap[detectedCanonicalCode] = { name: detected.name, code: detectedCanonicalCode, chars: 0 };
      }
      langCharMap[detectedCanonicalCode].chars += trimmed.length;
    }
  }

  // Sort mismatched blocks: largest/most significant blocks first
  mismatchedBlocks.sort((a, b) => b.charCount - a.charCount);

  // Calculate mismatched chars from actual extracted text
  const mismatchedChars = Math.min(
    totalChars,
    mismatchedBlocks.reduce((sum, b) => sum + b.charCount, 0)
  );
  const expectedChars = Math.max(0, totalChars - mismatchedChars);

  // Calculate language distribution percentages
  const distribution: LanguageDistributionEntry[] = [];
  const expectedPct = Math.min(100, Math.max(0, Math.round((expectedChars / totalChars) * 100)));

  distribution.push({
    language: expectedLanguage,
    code: canonicalExpectedCode,
    percentage: expectedPct,
    charCount: expectedChars,
  });

  for (const val of Object.values(langCharMap)) {
    const pct = Math.min(100, Math.max(1, Math.round((val.chars / totalChars) * 100)));
    distribution.push({
      language: val.name,
      code: val.code,
      percentage: pct,
      charCount: val.chars,
    });
  }

  // Normalize percentages so they sum to 100%
  const totalPct = distribution.reduce((sum, d) => sum + d.percentage, 0);
  if (totalPct > 0 && totalPct !== 100) {
    distribution[0].percentage = Math.max(0, distribution[0].percentage + (100 - totalPct));
  }

  // Sort distribution: highest percentage first
  distribution.sort((a, b) => b.percentage - a.percentage);

  return {
    mismatchedBlocks,
    mismatchedChars,
    languageDistribution: distribution,
  };
}

import { shouldIgnoreUrl } from '../services/domainSettingsStore';

/**
 * Validates content language using static visible text only.
 * Normalizes all language URL slugs/codes to canonical identities prior to comparison.
 * 
 * Compares canonicalExpectedLanguageCode === canonicalDetectedLanguageCode:
 * - >= 90% expected language: Correct
 * - 70 - 89%: Warning / Low confidence / Mixed
 * - < 70%: Language mismatch
 * - Unknown slug: Low Confidence (Needs Review) - avoids false positive errors
 * - Excluded URLs: Marked as 'ignored' with exact ignore reason
 */
export function validateContentLanguage(
  session: StoredCrawlSession,
  customThreshold?: number
): ContentLanguageResult {
  const threshold = customThreshold ?? session.settings.confidenceThreshold ?? 90;

  const items: ContentLanguageItem[] = [];
  const mismatchUrls: string[] = [];
  const ignoredUrls: string[] = [];

  let pagesChecked = 0;
  let pagesIgnored = 0;
  let correctCount = 0;
  let mismatchCount = 0;
  let lowConfidenceCount = 0;
  let mixedLanguageCount = 0;

  for (const item of session.items.values()) {
    // Check global & tool-specific exclusions
    const ignoreCheck = shouldIgnoreUrl(item, 'contentLanguage', session);
    if (ignoreCheck.ignored) {
      pagesIgnored++;
      ignoredUrls.push(item.normalizedUrl);

      const urlLang = extractUrlLanguage(item.normalizedUrl);
      const rawSlugToLookup = (urlLang.rawSlug !== 'default' && urlLang.rawSlug) ? urlLang.rawSlug : item.langCode;
      const expCanonical = getCanonicalLanguage(rawSlugToLookup);

      items.push({
        url: item.normalizedUrl,
        canonicalPath: item.canonicalPath,
        expectedLanguage: expCanonical.name || 'Default',
        expectedCode: expCanonical.code || 'default',
        expectedSlug: expCanonical.rawSlug || urlLang.rawSlug || item.langCode,
        detectedLanguage: 'Ignored',
        detectedCode: 'ignored',
        confidence: 0,
        status: 'ignored',
        sampleText: (item.staticText || item.textContent || '').slice(0, 200),
        isLowConfidence: false,
        staticCharsAnalyzed: 0,
        dynamicCharsIgnored: 0,
        isMixedLanguage: false,
        ignoreReason: ignoreCheck.reason || 'Excluded by rule',
      });
      continue;
    }

    // Only check successful HTML pages
    if (item.status >= 400) continue;

    pagesChecked++;

    // 1. Resolve canonical expected language from URL slug / item metadata
    const urlLang = extractUrlLanguage(item.normalizedUrl);
    const rawSlugToLookup = (urlLang.rawSlug !== 'default' && urlLang.rawSlug) ? urlLang.rawSlug : item.langCode;
    const expCanonical = getCanonicalLanguage(rawSlugToLookup);

    const expectedCode = expCanonical.code; // e.g. "zh"
    const expectedLanguage = expCanonical.name; // e.g. "Chinese"
    const expectedSlug = expCanonical.rawSlug || urlLang.rawSlug || item.langCode; // e.g. "cn"

    // 2. Prefer staticText, fallback to textContent
    const sampleText = item.staticText || item.textContent || item.title || '';
    const staticCharsAnalyzed = item.staticCharsAnalyzed ?? sampleText.length;
    const dynamicCharsIgnored = item.dynamicCharsIgnored ?? 0;

    const detected = detectTextContentLanguage(sampleText);
    const detectedCanonicalCode = normalizeLanguageCode(detected.code);

    // 3. Extract meaningful static blocks and calculate distribution
    const blockAnalysis = analyzeStaticContentBlocks(
      sampleText,
      expectedCode,
      expectedLanguage,
      item.staticBlocks,
      staticCharsAnalyzed
    );

    let status: ContentLanguageStatus = 'correct';
    let isMixedLanguage = false;

    // 4. Validate canonical expected code against canonical detected code
    if (!expCanonical.isKnown) {
      // Unknown slug (e.g. /xx/): Flag as low_confidence (Needs Review) instead of false mismatch
      status = 'low_confidence';
      lowConfidenceCount++;
    } else {
      const isExactMatch = detectedCanonicalCode === expectedCode;

      if (isExactMatch) {
        if (blockAnalysis.mismatchedBlocks.length > 0 && blockAnalysis.mismatchedChars > 150) {
          // Significant mismatched text present on page
          status = 'mixed_language';
          isMixedLanguage = true;
          mixedLanguageCount++;
        } else if (detected.confidence >= 90) {
          status = 'correct';
          correctCount++;
        } else if (detected.confidence >= 70) {
          status = 'mixed_language';
          isMixedLanguage = true;
          mixedLanguageCount++;
        } else {
          status = 'low_confidence';
          lowConfidenceCount++;
        }
      } else {
        // Detected language is different from expected
        // Check if expected language is present in secondary detected scores
        const expectedScoreObj = detected.scores.find(
          (s) => normalizeLanguageCode(s.code) === expectedCode
        );

        if (expectedScoreObj && expectedScoreObj.score >= 35) {
          // Mixed language: both expected and another language present
          status = 'mixed_language';
          isMixedLanguage = true;
          mixedLanguageCount++;
        } else if (detected.confidence >= 70) {
          status = 'mismatch';
          mismatchCount++;
          mismatchUrls.push(item.normalizedUrl);
        } else {
          status = 'low_confidence';
          lowConfidenceCount++;
        }
      }
    }

    const validationItem: ContentLanguageItem = {
      url: item.normalizedUrl,
      canonicalPath: item.canonicalPath,
      expectedLanguage,
      expectedCode,
      expectedSlug,
      detectedLanguage: detected.name,
      detectedCode: detectedCanonicalCode,
      confidence: detected.confidence,
      status,
      sampleText: sampleText.slice(0, 2500),
      isLowConfidence: status === 'low_confidence' || status === 'mixed_language',
      staticCharsAnalyzed,
      dynamicCharsIgnored,
      isMixedLanguage,
      mismatchedBlocks: blockAnalysis.mismatchedBlocks,
      mismatchedChars: blockAnalysis.mismatchedChars,
      languageDistribution: blockAnalysis.languageDistribution,
    };

    items.push(validationItem);
  }

  // Sort items: mismatch first, then mixed_language, then low_confidence, then ignored, then correct
  items.sort((a, b) => {
    const order: Record<string, number> = {
      mismatch: 0,
      mixed_language: 1,
      low_confidence: 2,
      ignored: 3,
      correct: 4,
    };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  });

  return {
    pagesChecked,
    pagesIgnored,
    correctCount,
    mismatchCount,
    lowConfidenceCount,
    mixedLanguageCount,
    ignoredCount: pagesIgnored,
    confidenceThreshold: threshold,
    items,
    mismatchUrls,
    ignoredUrls,
  };
}

