export interface CrawlSettings {
  maxPages: number;
  concurrency: number;
  requestTimeout: number; // in seconds
  respectRobotsTxt: boolean;
  followRedirects: boolean;
  includeSubdomains: boolean;
  userAgent?: string;
  confidenceThreshold?: number; // default 90%
  ignoredSlugs?: string[]; // path segments to completely ignore e.g. ['community']
  dynamicSelectors?: string[]; // CSS selectors for dynamic content to ignore in language validation
}

// ---------------- EXCLUSIONS & TOOL-SPECIFIC SETTINGS ----------------

export type ValidationToolId =
  | 'sitemap'
  | 'languageCompleteness'
  | 'contentLanguage'
  | 'headerLanguage'
  | 'amp';

export type ExclusionType = 'slug' | 'exact' | 'pattern';

export interface ExclusionRule {
  id?: string;
  type: ExclusionType;
  value: string; // e.g. "/community/", "https://example.com/special", "/old-blog/*"
  createdAt?: number;
}

export interface DomainToolExclusions {
  ignoredSlugs: string[];
  ignoredExactUrls: string[];
  ignoredPatterns: string[];
  rules?: ExclusionRule[];
}

export interface DomainGlobalExclusions {
  ignoredSlugs: string[];
  ignoredExactUrls: string[];
  ignoredPatterns: string[];
  rules?: ExclusionRule[];
}

export interface DomainSettings {
  domain: string;
  global: DomainGlobalExclusions;
  tools: {
    sitemap: DomainToolExclusions;
    languageCompleteness: DomainToolExclusions;
    contentLanguage: DomainToolExclusions;
    headerLanguage: DomainToolExclusions;
    amp: DomainToolExclusions;
  };
  updatedAt?: number;
}

export interface IgnoreCheckResult {
  ignored: boolean;
  reason?: string;
  ruleType?: 'global' | 'tool';
  ruleCategory?: ExclusionType;
  ruleValue?: string;
}

export interface LanguageInfo {
  code: string;
  name: string;
  displayName: string;
  count: number;
}

export type UrlSource = 'Sitemap' | 'Page Crawl' | 'Sitemap + Crawl';

export type StatusCategory = '2xx' | '3xx' | '4xx' | '5xx' | 'failed' | 'other';

export type CrawlStatusType =
  | 'success'
  | 'http_error'
  | 'timeout'
  | 'connection_failed'
  | 'dns_failed'
  | 'redirect_loop'
  | 'blocked'
  | 'other';

export interface CrawlUrlItem {
  id: string;
  url: string;
  normalizedUrl: string;
  canonicalPath: string;
  language: string;
  langCode: string;
  isEnglish: boolean;
  source: UrlSource;
  status: number; // e.g. 200, 404, 500, 0 for failed
  httpStatus?: number;
  statusCategory?: StatusCategory;
  crawlStatus?: CrawlStatusType;
  discoveredFrom: string[]; // ALL source pages that link to this URL
  contentType?: string;
  title?: string;
  textContent?: string;
  staticText?: string;
  staticCharsAnalyzed?: number;
  dynamicCharsIgnored?: number;
  detectedLanguage?: string;
  languageConfidence?: number;
  validationErrors?: string[];
  isIgnoredSlug?: boolean;
  ignoredForValidation?: boolean;
  staticBlocks?: { type: string; text: string }[];
  discoveredAt: number;
  depth: number;
  error?: string;
  inSitemap?: boolean;
  sitemapSource?: string;
  amphtmlUrl?: string;
}

export type CrawlStatus = 'idle' | 'discovering_sitemaps' | 'crawling' | 'completed' | 'stopped' | 'error';

export interface CrawlStats {
  crawlId: string;
  domain: string;
  normalizedDomain: string;
  status: CrawlStatus;
  pagesCrawled: number;
  uniqueUrlsCount: number;
  queueRemaining: number;
  currentUrl: string;
  duplicatesRemoved: number;
  assetsIgnored: number;
  externalUrlsIgnored: number;
  failedRequests: number;
  languagesDetected: number;
  languageCounts: Record<string, LanguageInfo>;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
}

export interface CrawlProgressMessage {
  type:
    | 'init'
    | 'sitemap_started'
    | 'sitemap_found'
    | 'sitemap_done'
    | 'url_discovered'
    | 'page_crawled'
    | 'page_failed'
    | 'progress'
    | 'completed'
    | 'stopped'
    | 'error';
  stats: CrawlStats;
  newItems?: CrawlUrlItem[];
  message?: string;
}

// ---------------- VALIDATION TYPES ----------------

export type SitemapItemStatus = 'correct' | 'missing' | 'sitemap_only' | 'ignored';

export interface SitemapValidationItem {
  url: string;
  canonicalPath: string;
  inCrawl: boolean;
  inSitemap: boolean;
  status: SitemapItemStatus;
  httpStatus?: number;
  discoveredFrom?: string[];
  ignoreReason?: string;
}

export interface SitemapValidationResult {
  totalEnglishPages: number;
  pagesChecked?: number;
  pagesIgnored?: number;
  foundInSitemap: number;
  missingFromSitemap: number;
  sitemapOnlyCount: number;
  ignoredCount?: number;
  coveragePercent: number;
  items: SitemapValidationItem[];
  missingUrls: string[];
  sitemapOnlyUrls: string[];
  ignoredUrls?: string[];
}

export type LanguageCompletenessStatus = 'complete' | 'incomplete' | 'has_additional';

export interface MissingTranslationDetail {
  englishUrl: string;
  canonicalPath: string;
  missingLanguage: string;
  missingLanguageCode: string;
  expectedUrl: string;
}

export interface LanguageCompletenessItem {
  language: string;
  languageCode: string;
  expected: number;
  found: number;
  missingCount: number;
  additionalCount: number;
  status: LanguageCompletenessStatus;
  missingUrls: string[];
  additionalUrls: string[];
  matchingUrls: string[];
  missingDetails?: MissingTranslationDetail[];
}

export interface IgnoredCompletenessItem {
  url: string;
  canonicalPath: string;
  language: string;
  reason: string;
}

export interface LanguageCompletenessResult {
  englishReferenceCount: number;
  totalEnglishPages: number;
  englishOnlyPages: number;
  multilingualPages: number;
  pagesChecked?: number;
  pagesIgnored?: number;
  languages: LanguageCompletenessItem[];
  totalMissing: number;
  totalAdditional: number;
  ignoredItems?: IgnoredCompletenessItem[];
}

export type ContentLanguageStatus = 'correct' | 'mismatch' | 'low_confidence' | 'mixed_language' | 'ignored';

export interface MismatchedTextBlock {
  text: string;
  detectedLanguage: string;
  detectedCode?: string;
  confidence: number;
  charCount: number;
}

export interface LanguageDistributionEntry {
  language: string;
  code: string;
  percentage: number;
  charCount: number;
}

export interface ContentLanguageItem {
  url: string;
  canonicalPath: string;
  expectedLanguage: string;
  expectedCode: string;
  expectedSlug?: string;
  detectedLanguage: string;
  detectedCode: string;
  confidence: number;
  status: ContentLanguageStatus;
  sampleText: string;
  isLowConfidence: boolean;
  staticCharsAnalyzed?: number;
  dynamicCharsIgnored?: number;
  isMixedLanguage?: boolean;
  mismatchedBlocks?: MismatchedTextBlock[];
  mismatchedChars?: number;
  languageDistribution?: LanguageDistributionEntry[];
  ignoreReason?: string;
}

export interface ContentLanguageResult {
  pagesChecked: number;
  pagesIgnored?: number;
  correctCount: number;
  mismatchCount: number;
  lowConfidenceCount: number;
  mixedLanguageCount?: number;
  ignoredCount?: number;
  confidenceThreshold: number;
  items: ContentLanguageItem[];
  mismatchUrls: string[];
  ignoredUrls?: string[];
}

export interface ValidationSummary {
  crawlId: string;
  timestamp: number;
  sitemap?: SitemapValidationResult;
  completeness?: LanguageCompletenessResult;
  contentLanguage?: ContentLanguageResult;
  headerNavigation?: HeaderValidationResult;
  ampValidation?: AmpValidationResult;
  overallStatus: 'passed' | 'warning' | 'error' | 'not_run';
}

// ---------------- HEADER & LANGUAGE NAVIGATION TYPES ----------------

export type HeaderValidationType =
  | 'header_urls'
  | 'language_switch'
  | 'header_detection'
  | 'language_selector_detection';

export type HeaderItemStatus = 'passed' | 'warning' | 'error' | 'needs_review' | 'skipped' | 'ignored';

export interface HeaderUrlDetail {
  desktopUrls: string[];
  mobileUrls: string[];
  missingOnMobile: string[];
  missingOnDesktop: string[];
  desktopConfidence: number;
  mobileConfidence: number;
  desktopDetected: boolean;
  mobileDetected: boolean;
}

export interface LanguageSwitchDetail {
  language: string;
  languageCode: string;
  translatedPageExists: boolean;
  expectedUrl: string;
  expectedBehavior: 'translated_page' | 'english_fallback';
  actualUrl: string;
  status: HeaderItemStatus;
  statusLabel: string;
  reason?: string;
}

export interface HeaderValidationTableRow {
  id: string;
  page: string;
  canonicalPath?: string;
  device: 'Desktop' | 'Mobile';
  validation: 'Header URLs' | 'Language Switch' | 'Header Detection' | 'Language Selector';
  validationType: HeaderValidationType;
  language?: string;
  languageCode?: string;
  expected: string;
  actual: string;
  status: HeaderItemStatus;
  statusLabel: string;
  reason?: string;
  missingOnMobile?: string[];
  missingOnDesktop?: string[];
  desktopUrls?: string[];
  mobileUrls?: string[];
  confidence?: number;
  translatedExists?: boolean;
  details?: string;
  ignoreReason?: string;
}

export interface PageHeaderValidationItem {
  url: string;
  canonicalPath: string;
  desktopHeaderDetected: boolean;
  desktopHeaderConfidence: number;
  desktopHeaderUrls: string[];
  mobileHeaderDetected: boolean;
  mobileHeaderConfidence: number;
  mobileMenuOpened: boolean;
  mobileHeaderUrls: string[];
  missingOnMobile: string[];
  missingOnDesktop: string[];
  headerStatus: HeaderItemStatus;
  headerReason?: string;
  desktopSelectorDetected: boolean;
  desktopSelectorConfidence: number;
  mobileSelectorDetected: boolean;
  mobileSelectorConfidence: number;
  detectedLanguages: string[];
  desktopLanguageSwitches: LanguageSwitchDetail[];
  mobileLanguageSwitches: LanguageSwitchDetail[];
  ignoreReason?: string;
}

export interface HeaderValidationResult {
  pagesChecked: number;
  pagesIgnored?: number;
  desktopHeaderDetectedCount: number;
  mobileHeaderDetectedCount: number;
  headerMatchingCount: number;
  headerMismatchCount: number;
  headerNeedsReviewCount: number;
  ignoredCount?: number;
  headerStatus: 'passed' | 'warning' | 'error' | 'needs_review';
  languageNavigation: {
    desktop: { passed: number; errors: number; skipped: number; needsReview: number };
    mobile: { passed: number; errors: number; skipped: number; needsReview: number };
  };
  totalLanguagePass: number;
  totalLanguageErrors: number;
  totalLanguageSkipped: number;
  totalNeedsReview: number;
  overallStatus: 'passed' | 'warning' | 'error' | 'needs_review' | 'skipped';
  pageResults: PageHeaderValidationItem[];
  tableRows: HeaderValidationTableRow[];
  languagesAvailable: string[];
  isSingleLanguage: boolean;
  ignoredUrls?: string[];
}

// ---------------- AMP VALIDATION TYPES ----------------

export type AmpDiscoverySource = 'declared' | 'guessed' | 'none';

export type AmpItemStatus = 'passed' | 'warning' | 'error' | 'skipped' | 'ignored';

export type AmpTechnicalStatus = 'valid' | 'invalid' | 'needs_review' | 'not_applicable';

export type AmpCanonicalStatus = 'match' | 'mismatch' | 'missing' | 'not_applicable';

export type AmpErrorCategory =
  | 'AMP_NOT_FOUND'
  | 'AMP_HTTP_ERROR'
  | 'AMP_TIMEOUT'
  | 'AMP_REDIRECT_ERROR'
  | 'AMPHTML_MISSING'
  | 'AMPHTML_WRONG_URL'
  | 'AMP_CANONICAL_MISSING'
  | 'AMP_CANONICAL_MISMATCH'
  | 'AMP_LANGUAGE_MISMATCH'
  | 'AMP_TITLE_MISMATCH'
  | 'AMP_H1_MISMATCH'
  | 'AMP_CONTENT_WARNING'
  | 'AMP_CONTENT_MISMATCH'
  | 'AMP_IMPORTANT_CONTENT_MISSING'
  | 'AMP_TECHNICAL_INVALID'
  | 'AMP_DETECTION_UNCERTAIN';

export interface AmpMissingContentBlock {
  id: string;
  text: string;
  type: 'heading' | 'paragraph' | 'list_item' | 'cta' | 'other';
  charCount: number;
  normalIndex: number;
}

export interface AmpValidationItem {
  id: string;
  normalUrl: string;
  canonicalPath: string;
  language: string;
  langCode: string;
  expectedLanguage: string;
  expectedLanguageCode: string;
  ampUrl?: string;
  discoverySource: AmpDiscoverySource;
  discoveryDetails?: string;
  httpStatus?: number;
  isAvailable: boolean;
  ampCanonicalUrl?: string;
  canonicalMatches: boolean;
  canonicalStatus: AmpCanonicalStatus;
  normalTitle?: string;
  ampTitle?: string;
  titleMatches: boolean;
  normalH1?: string;
  ampH1?: string;
  h1Matches: boolean;
  normalStaticChars: number;
  ampStaticChars: number;
  contentMatchPercent: number;
  detectedAmpLanguage?: string;
  detectedAmpLanguageCode?: string;
  languageMatches: boolean;
  technicalStatus: AmpTechnicalStatus;
  technicalIssues: string[];
  status: AmpItemStatus;
  statusLabel: string;
  errorCategories: AmpErrorCategory[];
  missingContentBlocks: AmpMissingContentBlock[];
  ampOnlyContentBlocks: string[];
  missingLinks?: string[];
  reason?: string;
  details?: string;
  ignoreReason?: string;
}

export interface AmpValidationResult {
  pagesChecked: number;
  pagesIgnored?: number;
  totalAmpFound?: number;
  ampFoundCount: number;
  ampNotImplementedCount: number;
  passedCount: number;
  warningCount: number;
  errorCount: number;
  skippedCount: number;
  ignoredCount?: number;
  contentWarningsCount: number;
  languageErrorsCount: number;
  canonicalErrorsCount: number;
  technicalErrorsCount: number;
  overallStatus: 'passed' | 'warning' | 'error' | 'skipped';
  passPercentageThreshold: number;
  warningPercentageThreshold: number;
  items: AmpValidationItem[];
  timestamp: number;
  ignoredUrls?: string[];
}


