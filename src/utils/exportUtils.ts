import {
  ContentLanguageItem,
  CrawlUrlItem,
  LanguageCompletenessItem,
  SitemapValidationItem,
  AmpValidationItem,
} from '../types';

/**
 * Trigger browser file download
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Universal clipboard copy
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * Copies a list of CrawlUrlItems to clipboard (one URL per line)
 */
export async function copyUrlsToClipboard(items: CrawlUrlItem[]): Promise<boolean> {
  if (!items || items.length === 0) return false;
  const text = items.map((i) => i.url).join('\n');
  return copyTextToClipboard(text);
}

/**
 * Copies raw string array to clipboard (one URL per line)
 */
export async function copyStringListToClipboard(urls: string[]): Promise<boolean> {
  if (!urls || urls.length === 0) return false;
  return copyTextToClipboard(urls.join('\n'));
}

/**
 * Downloads a list of URLs as plain TXT (one per line)
 */
export function downloadUrlsAsTxt(items: CrawlUrlItem[], filename: string = 'crawled-urls.txt'): void {
  const content = items.map((i) => i.url).join('\n');
  triggerFileDownload(content, filename, 'text/plain;charset=utf-8');
}

/**
 * Downloads string list as plain TXT
 */
export function downloadStringListAsTxt(urls: string[], filename: string = 'urls.txt'): void {
  triggerFileDownload(urls.join('\n'), filename, 'text/plain;charset=utf-8');
}

/**
 * Downloads a list of URLs as CSV
 */
export function downloadUrlsAsCsv(items: CrawlUrlItem[], filename: string = 'crawled-urls.csv'): void {
  const headers = ['URL', 'Canonical Path', 'Language', 'Language Code', 'Source', 'Status', 'In Sitemap', 'Found On Pages Count', 'Found On Pages'];
  const rows = items.map((item) => {
    const cleanUrl = `"${item.url.replace(/"/g, '""')}"`;
    const cleanCanon = `"${(item.canonicalPath || '').replace(/"/g, '""')}"`;
    const cleanLang = `"${item.language.replace(/"/g, '""')}"`;
    const cleanCode = `"${item.langCode.replace(/"/g, '""')}"`;
    const cleanSource = `"${item.source.replace(/"/g, '""')}"`;
    const status = item.status;
    const inSitemap = item.inSitemap ? 'Yes' : 'No';
    const foundOnCount = item.discoveredFrom?.length || 0;
    const foundOnPages = `"${(item.discoveredFrom || []).join('; ').replace(/"/g, '""')}"`;
    return [cleanUrl, cleanCanon, cleanLang, cleanCode, cleanSource, status, inSitemap, foundOnCount, foundOnPages].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8');
}

/**
 * Downloads Missing Translations detailed report as CSV
 */
export function downloadMissingTranslationsCsv(
  details: {
    englishUrl: string;
    canonicalPath: string;
    missingLanguage: string;
    expectedUrl: string;
  }[],
  filename: string = 'missing-translations.csv'
): void {
  const headers = ['English Reference URL', 'Canonical Path', 'Missing Language', 'Expected Translated URL'];
  const rows = details.map((d) => {
    const eng = `"${d.englishUrl.replace(/"/g, '""')}"`;
    const canon = `"${d.canonicalPath.replace(/"/g, '""')}"`;
    const lang = `"${d.missingLanguage.replace(/"/g, '""')}"`;
    const exp = `"${d.expectedUrl.replace(/"/g, '""')}"`;
    return [eng, canon, lang, exp].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8');
}

/**
 * Downloads a list of URLs as JSON
 */
export function downloadUrlsAsJson(items: CrawlUrlItem[], filename: string = 'crawled-urls.json'): void {
  downloadDataAsJson(items, filename);
}

/**
 * Downloads arbitrary object as JSON
 */
export function downloadDataAsJson(data: any, filename: string = 'data.json'): void {
  const content = JSON.stringify(data, null, 2);
  triggerFileDownload(content, filename, 'application/json;charset=utf-8');
}

/**
 * Downloads Sitemap validation results as CSV
 */
export function downloadSitemapValidationCsv(
  items: SitemapValidationItem[],
  filename: string = 'sitemap-coverage.csv'
): void {
  const headers = ['URL', 'Canonical Path', 'In Crawl', 'In Sitemap', 'Result', 'HTTP Status'];
  const rows = items.map((item) => {
    const cleanUrl = `"${item.url.replace(/"/g, '""')}"`;
    const cleanCanon = `"${item.canonicalPath.replace(/"/g, '""')}"`;
    const inCrawl = item.inCrawl ? 'Yes' : 'No';
    const inSitemap = item.inSitemap ? 'Yes' : 'No';
    const result = item.status === 'correct' ? 'Present' : item.status === 'missing' ? 'Missing from Sitemap' : 'Sitemap Only';
    const status = item.httpStatus ? item.httpStatus.toString() : '-';
    return [cleanUrl, cleanCanon, inCrawl, inSitemap, `"${result}"`, status].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8');
}

/**
 * Downloads Language Completeness report as CSV
 */
export function downloadCompletenessCsv(
  items: LanguageCompletenessItem[],
  filename: string = 'language-completeness.csv'
): void {
  const headers = ['Language', 'Code', 'Expected', 'Found', 'Missing', 'Additional', 'Status'];
  const rows = items.map((item) => {
    const cleanLang = `"${item.language.replace(/"/g, '""')}"`;
    const code = `"${item.languageCode}"`;
    const status =
      item.status === 'complete'
        ? 'Complete'
        : item.status === 'incomplete'
        ? 'Incomplete'
        : 'Has Additional Pages';
    return [cleanLang, code, item.expected, item.found, item.missingCount, item.additionalCount, `"${status}"`].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8');
}

/**
 * Downloads Content Language Validation report as CSV
 */
export function downloadContentLanguageCsv(
  items: ContentLanguageItem[],
  filename: string = 'content-language-validation.csv'
): void {
  const headers = ['URL', 'Canonical Path', 'Expected Language', 'Detected Language', 'Confidence (%)', 'Status'];
  const rows = items.map((item) => {
    const cleanUrl = `"${item.url.replace(/"/g, '""')}"`;
    const cleanCanon = `"${item.canonicalPath.replace(/"/g, '""')}"`;
    const exp = `"${item.expectedLanguage.replace(/"/g, '""')}"`;
    const det = `"${item.detectedLanguage.replace(/"/g, '""')}"`;
    const conf = item.confidence;
    const status =
      item.status === 'correct'
        ? 'Correct'
        : item.status === 'mismatch'
        ? 'Mismatch'
        : 'Low Confidence';
    return [cleanUrl, cleanCanon, exp, det, conf, `"${status}"`].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8');
}

/**
 * Downloads Header & Language Navigation Validation report as CSV
 */
export function downloadHeaderValidationCsv(
  rowsData: Array<{
    page: string;
    device: string;
    validation: string;
    language?: string;
    expected: string;
    actual: string;
    statusLabel: string;
    reason?: string;
  }>,
  filename: string = 'header-language-navigation-validation.csv'
): void {
  const headers = ['Page', 'Device', 'Validation Type', 'Language', 'Expected', 'Actual', 'Status', 'Reason/Notes'];
  const rows = rowsData.map((item) => {
    const page = `"${(item.page || '').replace(/"/g, '""')}"`;
    const device = `"${(item.device || '').replace(/"/g, '""')}"`;
    const val = `"${(item.validation || '').replace(/"/g, '""')}"`;
    const lang = `"${(item.language || '-').replace(/"/g, '""')}"`;
    const exp = `"${(item.expected || '').replace(/"/g, '""')}"`;
    const act = `"${(item.actual || '').replace(/"/g, '""')}"`;
    const status = `"${(item.statusLabel || '').replace(/"/g, '""')}"`;
    const reason = `"${(item.reason || '').replace(/"/g, '""')}"`;
    return [page, device, val, lang, exp, act, status, reason].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8');
}

/**
 * Downloads AMP Validation report as CSV
 */
export function downloadAmpValidationCsv(
  items: AmpValidationItem[],
  filename: string = 'amp-validation-report.csv'
): void {
  const headers = [
    'Normal URL',
    'Canonical Path',
    'Expected Language',
    'AMP URL',
    'Discovery Source',
    'HTTP Status',
    'Canonical Tag in AMP',
    'Canonical Matches',
    'Content Match (%)',
    'Missing Content Blocks Count',
    'Detected AMP Language',
    'Language Matches',
    'H1 Matches',
    'Technical AMP Status',
    'Status',
    'Reason/Issues',
  ];

  const rows = items.map((item) => {
    const normalUrl = `"${(item.normalUrl || '').replace(/"/g, '""')}"`;
    const canonicalPath = `"${(item.canonicalPath || '').replace(/"/g, '""')}"`;
    const expLang = `"${(item.expectedLanguage || '').replace(/"/g, '""')}"`;
    const ampUrl = `"${(item.ampUrl || 'None').replace(/"/g, '""')}"`;
    const disc = `"${item.discoverySource}"`;
    const http = item.httpStatus || (item.discoverySource === 'none' ? 'N/A' : 'Failed');
    const canonTag = `"${(item.ampCanonicalUrl || 'Missing/NA').replace(/"/g, '""')}"`;
    const canonMatch = item.canonicalMatches ? 'Yes' : 'No';
    const matchPct = item.contentMatchPercent;
    const missingCount = item.missingContentBlocks?.length || 0;
    const detLang = `"${(item.detectedAmpLanguage || 'N/A').replace(/"/g, '""')}"`;
    const langMatch = item.languageMatches ? 'Yes' : 'No';
    const h1Match = item.h1Matches ? 'Yes' : 'No';
    const tech = `"${item.technicalStatus}"`;
    const status = `"${item.statusLabel || item.status}"`;
    const reason = `"${(item.reason || item.technicalIssues?.join('; ') || '').replace(/"/g, '""')}"`;

    return [
      normalUrl,
      canonicalPath,
      expLang,
      ampUrl,
      disc,
      http,
      canonTag,
      canonMatch,
      matchPct,
      missingCount,
      detLang,
      langMatch,
      h1Match,
      tech,
      status,
      reason,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8');
}

