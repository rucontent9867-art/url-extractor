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
  crawlMode?: 'domain' | 'url_list';
  targetUrls?: string[];
}

// ---------------- EXCLUSIONS & TOOL-SPECIFIC SETTINGS ----------------

export type ValidationToolId =
  | 'sitemap'
  | 'languageCompleteness'
  | 'contentLanguage'
  | 'headerLanguage'
  | 'amp'
  | 'asset'
  | 'visual'
  | 'interaction';

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
    asset: DomainToolExclusions;
    visual: DomainToolExclusions;
    interaction: DomainToolExclusions;
  };
  tool6?: Tool6Settings;
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
  canonicalUrl?: string;
  hreflangMap?: Record<string, string>;
  responseTimeMs?: number;
}

export type CrawlStatus = 'idle' | 'discovering_sitemaps' | 'crawling' | 'completed' | 'stopped' | 'error';

export interface CrawlStats {
  crawlId: string;
  domain: string;
  normalizedDomain: string;
  status: CrawlStatus;
  crawlMode?: 'domain' | 'url_list';
  targetUrlsCount?: number;
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
  durationMs?: number;
  pagesPerSecond?: number;
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
  assetValidation?: AssetValidationResult;
  visualValidation?: VisualValidationResult;
  interactionValidation?: InteractionValidationResult;
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

// ========================================================
// TOOL 6: LINKS, ASSETS & HTTP HEALTH VALIDATION TYPES
// ========================================================

export type AssetType =
  | 'IMAGE'
  | 'VIDEO'
  | 'PDF'
  | 'DOCUMENT'
  | 'INTERNAL_LINK'
  | 'EXTERNAL_LINK'
  | 'OTHER';

export type AssetElementType =
  | 'img'
  | 'picture'
  | 'source'
  | 'video'
  | 'a_pdf'
  | 'embed_pdf'
  | 'object_pdf'
  | 'iframe_video'
  | 'doc_link'
  | 'internal_link'
  | 'external_link'
  | 'css_background'
  | 'other';

export type AssetStatus = 'passed' | 'warning' | 'error' | 'skipped' | 'ignored' | 'needs_review';

export type AssetAltStatus =
  | 'ALT_PRESENT'
  | 'ALT_EMPTY'
  | 'ALT_MISSING'
  | 'ALT_NEEDS_REVIEW'
  | 'WEAK_ALT_TEXT'
  | 'NOT_APPLICABLE';

export type ImageMeaningCategory = 'DECORATIVE' | 'INFORMATIVE' | 'UNKNOWN';

export interface RedirectChainStep {
  url: string;
  status: number;
}

export type RedirectIssueType =
  | 'REDIRECT_OK'
  | 'REDIRECT_CHAIN'
  | 'REDIRECT_LOOP'
  | 'REDIRECT_TO_404'
  | 'REDIRECT_EXTERNAL'
  | 'REDIRECT_HTTP_TO_HTTPS'
  | 'NONE';

export interface AssetRecord {
  id: string;
  url: string;
  normalizedUrl: string;
  sourcePages: string[];
  foundOnPages?: string[];
  primarySourcePage: string;
  assetType: AssetType;
  elementType: AssetElementType;
  statusCode?: number;
  status: AssetStatus;
  statusLabel: string;
  contentType?: string;
  finalUrl?: string;
  redirectChain?: RedirectChainStep[];
  redirectChainLength?: number;
  redirectIssue?: RedirectIssueType;
  responseTimeMs?: number;
  error?: string;
  skipReason?: string;
  alt?: string;
  hasAlt?: boolean;
  altStatus?: AssetAltStatus;
  altCategory?: ImageMeaningCategory;
  altReviewNote?: string;
  width?: number;
  height?: number;
  visible?: boolean;
  details?: string;
  ignoreReason?: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export type AssetValidationItem = AssetRecord;
export type ValidationItemStatus = 'passed' | 'warning' | 'error' | 'skipped' | 'ignored' | 'needs_review';

export type ExternalUrlValidationMode = 'none' | 'all' | 'selected_domains';

export interface Tool6Settings {
  externalUrlValidation: ExternalUrlValidationMode;
  selectedExternalDomains: string[];
  enableSocialExclusions: boolean;
  socialDomains: string[];
  timeoutSec: number;
  maxRedirectsThreshold: number;
  ignoredAssetTypes: AssetType[];
}

export interface AssetValidationResult {
  pagesChecked: number;
  pagesIgnored?: number;
  totalAssets: number;
  totalResources: number;
  totalInternalLinks: number;
  totalExternalLinks: number;
  totalImages: number;
  totalVideos: number;
  totalPdfs: number;
  totalDocuments: number;
  brokenAssets: number;
  errors404: number;
  errors4xx: number;
  errors5xx: number;
  failedRequests: number;
  totalRedirects: number;
  redirectChains: number;
  missingAltCount: number;
  emptyAltCount: number;
  weakAltCount: number;
  skippedCount: number;
  warningCount: number;
  passedCount: number;
  errorCount: number;
  overallStatus: 'passed' | 'warning' | 'error' | 'skipped';
  assets: AssetRecord[];
  items?: AssetRecord[];
  timestamp: number;
  ignoredUrls?: string[];
}

export interface AssetValidationOptions {
  externalUrlValidation?: ExternalUrlValidationMode;
  selectedExternalDomains?: string[];
  enableSocialExclusions?: boolean;
  socialDomains?: string[];
  customSocialDomains?: string[];
  checkExternalLinks?: boolean;
  checkImages?: boolean;
  checkVideos?: boolean;
  checkPdfs?: boolean;
  checkDocuments?: boolean;
  checkInternalLinks?: boolean;
  ignoredAssetTypes?: AssetType[];
  maxRedirectsThreshold?: number;
  concurrency?: number;
  timeoutSec?: number;
  maxAssets?: number;
}

// ========================================================
// TOOL 7: VISUAL, RESPONSIVE & VIEWPORT VALIDATION TYPES
// ========================================================

export type ViewportPresetId =
  | 'mobile_small'
  | 'mobile'
  | 'mobile_large'
  | 'tablet'
  | 'desktop'
  | 'desktop_large'
  | 'large_desktop'
  | 'custom';

export interface ViewportConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  isMobile?: boolean;
}

export type VisualIssueType =
  | 'HORIZONTAL_SCROLL'
  | 'TEXT_CROPPED'
  | 'TEXT_OVERFLOW'
  | 'TEXT_TRUNCATED'
  | 'IMAGE_CROPPED'
  | 'VIDEO_CROPPED'
  | 'PDF_CROPPED'
  | 'OUTSIDE_VIEWPORT'
  | 'OVERFLOW'
  | 'ZERO_SIZE'
  | 'PARTIALLY_VISIBLE'
  | 'FIXED_ELEMENT_OVERLAP'
  | 'HIDDEN_CONTENT'
  | 'CONSENT_BANNER_ISSUE'
  | 'NEEDS_REVIEW';

export interface VisualBoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type VisualItemStatus = 'passed' | 'warning' | 'error' | 'skipped' | 'ignored' | 'needs_review';

export interface VisualValidationItem {
  id: string;
  pageUrl: string;
  canonicalPath: string;
  viewport: ViewportConfig;
  issueType: VisualIssueType;
  elementSelector?: string;
  elementTag?: string;
  textSample?: string;
  boundingBox?: VisualBoundingBox;
  cssReason?: string;
  screenshotBase64?: string;
  status: VisualItemStatus;
  statusLabel: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  details?: string;
  ignoreReason?: string;
}

export interface VisualValidationResult {
  pagesChecked: number;
  pagesIgnored?: number;
  viewportsTested: ViewportConfig[];
  horizontalScrollIssues: number;
  textIssues: number;
  imageIssues: number;
  videoIssues: number;
  pdfIssues: number;
  hiddenContentIssues: number;
  consentIssues: number;
  fixedElementIssues: number;
  totalErrors: number;
  totalWarnings: number;
  totalPassed: number;
  overallStatus: 'passed' | 'warning' | 'error' | 'skipped';
  items: VisualValidationItem[];
  timestamp: number;
  ignoredUrls?: string[];
}

export interface VisualValidationOptions {
  maxPages?: number;
  specificUrls?: string[];
  viewports?: ViewportConfig[];
  captureScreenshots?: boolean;
  horizontalScrollThresholdPx?: number;
  ignoreSelectors?: string[];
}

// ========================================================
// TOOL 8: INTERACTION & CONSOLE VALIDATION TYPES
// ========================================================

export type InteractionElementType =
  | 'button'
  | 'link'
  | 'dropdown'
  | 'accordion'
  | 'tab'
  | 'modal_trigger'
  | 'form_control'
  | 'navigation'
  | 'language_selector'
  | 'other';

export type InteractionResultType =
  | 'ACTION_SUCCESS_DOM'
  | 'ACTION_SUCCESS_NAV'
  | 'ACTION_SUCCESS_MODAL'
  | 'ACTION_SUCCESS_DROPDOWN'
  | 'ACTION_SUCCESS_TAB'
  | 'ACTION_SUCCESS_ACCORDION'
  | 'BUTTON_NO_ACTION'
  | 'NAVIGATION_ERROR'
  | 'JS_EXCEPTION'
  | 'CONSOLE_ERROR'
  | 'NETWORK_ERROR'
  | 'SKIPPED_DISABLED'
  | 'SKIPPED_DESTRUCTIVE'
  | 'NEEDS_REVIEW';

export type ConsoleErrorPhase = 'PAGE_LOAD' | 'AFTER_ACTION';

export interface CapturedConsoleError {
  id: string;
  pageUrl: string;
  type: 'error' | 'warn' | 'pageerror';
  message: string;
  source?: string;
  stack?: string;
  timestamp: number;
  phase: ConsoleErrorPhase;
  elementSelector?: string;
  actionName?: string;
}

export interface GroupedConsoleError {
  id: string;
  type: 'error' | 'warn' | 'pageerror';
  normalizedMessage: string;
  occurrences: number;
  pages: string[];
  firstSeenPhase: ConsoleErrorPhase;
  stackSample?: string;
}

export interface CapturedNetworkError {
  url: string;
  method: string;
  status: number;
  errorText?: string;
  phase: ConsoleErrorPhase;
  elementSelector?: string;
}

export type InteractionItemStatus = 'passed' | 'warning' | 'error' | 'skipped' | 'ignored' | 'needs_review';

export interface InteractionValidationItem {
  id: string;
  pageUrl: string;
  canonicalPath: string;
  elementSelector: string;
  elementType: InteractionElementType;
  elementText: string;
  action: string;
  result: InteractionResultType;
  resultSummary: string;
  urlBefore: string;
  urlAfter?: string;
  domChanged: boolean;
  visibilityChanged: boolean;
  networkActivity: boolean;
  consoleErrors: CapturedConsoleError[];
  networkErrors: CapturedNetworkError[];
  status: InteractionItemStatus;
  statusLabel: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  screenshotBase64?: string;
  details?: string;
  ignoreReason?: string;
}

export interface InteractionValidationResult {
  pagesChecked: number;
  pagesIgnored?: number;
  interactiveElementsFound: number;
  elementsTested: number;
  passedCount: number;
  warningCount: number;
  errorCount: number;
  noActionCount: number;
  consoleErrorCount: number;
  networkErrorCount: number;
  skippedCount: number;
  needsReviewCount: number;
  overallStatus: 'passed' | 'warning' | 'error' | 'skipped';
  items: InteractionValidationItem[];
  groupedConsoleErrors: GroupedConsoleError[];
  timestamp: number;
  ignoredUrls?: string[];
}

export interface InteractionValidationOptions {
  maxPages?: number;
  maxElementsPerPage?: number;
  observationTimeoutMs?: number;
  safeMode?: boolean;
  specificUrls?: string[];
  excludedSelectors?: string[];
}



