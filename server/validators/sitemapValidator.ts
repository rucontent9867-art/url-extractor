import { SitemapValidationItem, SitemapValidationResult } from '../../src/types';
import { StoredCrawlSession } from '../services/crawlStore';
import { detectUrlLanguage } from '../crawler/languageDetector';
import { getCanonicalPath } from '../crawler/canonicalPath';
import { shouldIgnoreUrl } from '../services/domainSettingsStore';

/**
 * Validates Default/English crawled URLs against the website sitemap.
 * STRICTLY ignores alternative-language pages (e.g. /fr/, /de/, /es/) for this check!
 * Evaluates both Global and Sitemap-specific exclusions using shouldIgnoreUrl.
 */
export function validateSitemap(session: StoredCrawlSession): SitemapValidationResult {
  const items: SitemapValidationItem[] = [];
  const missingUrls: string[] = [];
  const sitemapOnlyUrls: string[] = [];
  const ignoredUrls: string[] = [];

  // 1. Gather all English crawler URLs
  const englishCrawlerMap = new Map<
    string,
    { url: string; canonicalPath: string; status: number; ignored: boolean; reason?: string }
  >();

  let totalEnglishDiscovered = 0;
  let pagesChecked = 0;
  let pagesIgnored = 0;

  for (const item of session.items.values()) {
    if (item.isEnglish || item.langCode === 'default' || item.langCode === 'en') {
      totalEnglishDiscovered++;
      const canonicalPath = item.canonicalPath || getCanonicalPath(item.normalizedUrl);
      const ignoreCheck = shouldIgnoreUrl(item, 'sitemap', session);

      if (ignoreCheck.ignored) {
        pagesIgnored++;
        ignoredUrls.push(item.normalizedUrl);
        englishCrawlerMap.set(item.normalizedUrl, {
          url: item.normalizedUrl,
          canonicalPath,
          status: item.status,
          ignored: true,
          reason: ignoreCheck.reason,
        });
      } else {
        pagesChecked++;
        englishCrawlerMap.set(item.normalizedUrl, {
          url: item.normalizedUrl,
          canonicalPath,
          status: item.status,
          ignored: false,
        });
      }
    }
  }

  // 2. Filter sitemap items to Default/English only and exclude sitemap-ignored URLs
  const englishSitemapUrls = new Set<string>();
  for (const sitemapEntry of session.sitemapUrls.values()) {
    const langInfo = detectUrlLanguage(sitemapEntry.url);
    if (langInfo.isDefault || langInfo.code === 'default' || langInfo.code === 'en') {
      const ignoreCheck = shouldIgnoreUrl(sitemapEntry.url, 'sitemap', session);
      if (!ignoreCheck.ignored) {
        englishSitemapUrls.add(sitemapEntry.url);
      }
    }
  }

  let foundInSitemap = 0;

  // Check Crawler English URLs vs Sitemap
  for (const [normUrl, crawlerData] of englishCrawlerMap.entries()) {
    if (crawlerData.ignored) {
      items.push({
        url: normUrl,
        canonicalPath: crawlerData.canonicalPath,
        inCrawl: true,
        inSitemap: englishSitemapUrls.has(normUrl),
        status: 'ignored',
        httpStatus: crawlerData.status,
        ignoreReason: crawlerData.reason,
      });
      continue;
    }

    const inSitemap = englishSitemapUrls.has(normUrl);
    if (inSitemap) {
      foundInSitemap++;
      items.push({
        url: normUrl,
        canonicalPath: crawlerData.canonicalPath,
        inCrawl: true,
        inSitemap: true,
        status: 'correct',
        httpStatus: crawlerData.status,
      });
    } else {
      missingUrls.push(normUrl);
      items.push({
        url: normUrl,
        canonicalPath: crawlerData.canonicalPath,
        inCrawl: true,
        inSitemap: false,
        status: 'missing',
        httpStatus: crawlerData.status,
      });
    }
  }

  // Check Reverse: Sitemap English URLs not discovered by crawler
  for (const sitemapUrl of englishSitemapUrls) {
    if (!englishCrawlerMap.has(sitemapUrl)) {
      sitemapOnlyUrls.push(sitemapUrl);
      items.push({
        url: sitemapUrl,
        canonicalPath: getCanonicalPath(sitemapUrl),
        inCrawl: false,
        inSitemap: true,
        status: 'sitemap_only',
        httpStatus: undefined,
      });
    }
  }

  // Sort items: missing first, then sitemap_only, then ignored, then correct
  items.sort((a, b) => {
    const order: Record<string, number> = { missing: 0, sitemap_only: 1, ignored: 2, correct: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  const coveragePercent =
    pagesChecked > 0 ? Number(((foundInSitemap / pagesChecked) * 100).toFixed(2)) : 100;

  return {
    totalEnglishPages: totalEnglishDiscovered,
    pagesChecked,
    pagesIgnored,
    foundInSitemap,
    missingFromSitemap: missingUrls.length,
    sitemapOnlyCount: sitemapOnlyUrls.length,
    ignoredCount: pagesIgnored,
    coveragePercent,
    items,
    missingUrls,
    sitemapOnlyUrls,
    ignoredUrls,
  };
}
