import * as cheerio from 'cheerio';
import axios, { AxiosRequestConfig } from 'axios';
import http from 'http';
import https from 'https';
import {
  AmpDiscoverySource,
  AmpErrorCategory,
  AmpItemStatus,
  AmpMissingContentBlock,
  AmpTechnicalStatus,
  AmpValidationItem,
  AmpValidationResult,
  CrawlUrlItem,
} from '../../src/types';
import { StoredCrawlSession } from '../services/crawlStore';
import {
  getCanonicalLanguage,
  normalizeLanguageCode,
  extractUrlLanguage,
  isAmpUrl,
} from '../../src/utils/canonicalLanguage';
import { getCanonicalPath } from '../crawler/canonicalPath';
import { normalizeUrl, hasIgnoredSlug, isAssetUrl } from '../crawler/urlNormalizer';
import { detectTextContentLanguage } from './contentLanguageValidator';
import { getEffectiveIgnoredSlugs, settingsStore } from '../services/settingsStore';

// Keep-alive HTTP agents for fast lightweight AMP fetching
const ampHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 20 });
const ampHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 20 });

export interface AmpValidationOptions {
  checkGuesses?: boolean;
  passThreshold?: number; // default 95%
  warnThreshold?: number; // default 85%
  maxPages?: number;
  timeoutSec?: number;
}

// Built-in dynamic selectors to remove prior to content comparison
const DYNAMIC_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'path',
  'iframe',
  'canvas',
  'input',
  'textarea',
  'select',
  'option',
  '[aria-hidden="true"]',
  '[hidden]',
  '.hidden',
  '#chat-widget',
  '.chat-widget',
  '#intercom-container',
  '#crisp-chatbox',
  '.cookie-banner',
  '.cookie-consent',
  '.cookie-notice',
  '.cookie-modal',
  '.dynamic-price',
  '.countdown',
  '.timer',
  '.current-date',
  '.current-time',
  '.user-menu',
  '.captcha',
];

/**
 * Normalizes text for robust semantic comparison (collapses whitespace, strips punctuation differences, unescapes entities)
 */
export function normalizeSemanticText(text: string): string {
  if (!text) return '';
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts clean core title without site branding suffix (e.g. "Requirements | Brand" -> "Requirements")
 */
export function extractCoreTitle(rawTitle: string): string {
  const norm = normalizeSemanticText(rawTitle);
  if (!norm) return '';
  const parts = norm.split(/\s+[-–—|•:]\s+/);
  return parts[0]?.trim().toLowerCase() || norm.toLowerCase();
}

/**
 * Compares two titles accounting for harmless brand suffixes
 */
export function compareTitles(normalTitle: string, ampTitle: string): boolean {
  const nNorm = normalizeSemanticText(normalTitle).toLowerCase();
  const aNorm = normalizeSemanticText(ampTitle).toLowerCase();
  if (nNorm === aNorm) return true;

  const nCore = extractCoreTitle(normalTitle);
  const aCore = extractCoreTitle(ampTitle);
  if (nCore && aCore && (nCore === aCore || nNorm.includes(aCore) || aNorm.includes(nCore))) {
    return true;
  }
  return false;
}

/**
 * Discovers the AMP URL for a normal page:
 * 1. Declared in <link rel="amphtml" href="..."> (Primary)
 * 2. Guessed common patterns (Optional/Secondary)
 */
export function discoverAmpUrl(
  normalUrl: string,
  normalHtml?: string,
  declaredAmpUrl?: string,
  probeGuesses: boolean = false
): { ampUrl?: string; discoverySource: AmpDiscoverySource; rawAmphtml?: string } {
  // 1. Check declared AMP in crawled metadata or HTML
  let rawHref = declaredAmpUrl;
  if (!rawHref && normalHtml) {
    const $ = cheerio.load(normalHtml);
    rawHref = $('link[rel="amphtml"][href]').attr('href')?.trim();
  }

  if (rawHref) {
    try {
      const resolved = new URL(rawHref, normalUrl).toString();
      return {
        ampUrl: resolved,
        discoverySource: 'declared',
        rawAmphtml: rawHref,
      };
    } catch {
      return {
        ampUrl: rawHref,
        discoverySource: 'declared',
        rawAmphtml: rawHref,
      };
    }
  }

  // 2. Guessed discovery if explicitly requested
  if (probeGuesses) {
    try {
      const parsed = new URL(normalUrl);
      let path = parsed.pathname;
      if (!path.endsWith('/')) path += '/';
      const guessed = new URL(`${path}amp/`, parsed.origin).toString();
      return {
        ampUrl: guessed,
        discoverySource: 'guessed',
      };
    } catch {
      // ignore
    }
  }

  return {
    ampUrl: undefined,
    discoverySource: 'none',
  };
}

/**
 * Performs fast HTTP fetch of an AMP URL with keep-alive and redirect handling
 */
export async function fetchAmpPage(
  ampUrl: string,
  userAgent?: string,
  timeoutSec: number = 8
): Promise<{
  status: number;
  ok: boolean;
  html: string;
  finalUrl: string;
  error?: string;
  durationMs: number;
}> {
  const startTime = Date.now();
  try {
    const config: AxiosRequestConfig = {
      httpAgent: ampHttpAgent,
      httpsAgent: ampHttpsAgent,
      timeout: timeoutSec * 1000,
      headers: {
        'User-Agent':
          userAgent ||
          'Mozilla/5.0 (compatible; AmpWebsiteValidator/1.0; +https://validator.local)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
      },
      maxRedirects: 5,
      validateStatus: () => true,
      responseType: 'text',
    };

    const response = await axios.get(ampUrl, config);
    const finalUrl = (response.request?.res?.responseUrl as string) || ampUrl;
    const html = typeof response.data === 'string' ? response.data : '';
    const status = response.status;
    const ok = status >= 200 && status < 300;

    return {
      status,
      ok,
      html,
      finalUrl,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    const status = err.response?.status || 0;
    return {
      status,
      ok: false,
      html: '',
      finalUrl: ampUrl,
      error: err.message || 'Request failed',
      durationMs: Date.now() - startTime,
    };
  }
}

export interface AmpParsedContent {
  title: string;
  h1: string;
  h1List: string[];
  canonicalUrl?: string;
  staticText: string;
  staticBlocks: { type: 'heading' | 'paragraph' | 'list_item' | 'cta' | 'other'; text: string }[];
  importantLinks: string[];
  isAmpHtmlDeclared: boolean;
  hasAmpJsRuntime: boolean;
  hasAmpBoilerplate: boolean;
  hasAmpCustomStyle: boolean;
  disallowedScripts: string[];
}

/**
 * Parses and extracts structured static content and technical AMP indicators from AMP HTML.
 * Strictly ignores header/footer navigation, dynamic widgets, ads, tracking, scripts, and styles.
 */
export function parseAmpHtml(
  html: string,
  ampUrl: string,
  customDynamicSelectors?: string[]
): AmpParsedContent {
  const $ = cheerio.load(html);

  // Technical checks
  const htmlEl = $('html');
  const isAmpHtmlDeclared =
    htmlEl.attr('⚡') !== undefined ||
    htmlEl.attr('amp') !== undefined ||
    htmlEl.attr('⚡4email') !== undefined ||
    htmlEl.attr('amp4email') !== undefined ||
    /⚡|amp/.test(html.slice(0, 500));

  let hasAmpJsRuntime = false;
  const disallowedScripts: string[] = [];

  $('script').each((_, el) => {
    const src = $(el).attr('src') || '';
    const type = $(el).attr('type') || '';
    if (src.includes('cdn.ampproject.org/v0.js') || src.includes('cdn.ampproject.org/v0/')) {
      hasAmpJsRuntime = true;
    } else if (src.includes('cdn.ampproject.org')) {
      // standard AMP extension scripts e.g. amp-img, amp-carousel, etc.
    } else if (type === 'application/ld+json' || type === 'application/json') {
      // Structured data is allowed
    } else {
      disallowedScripts.push(src || $(el).text().slice(0, 40));
    }
  });

  const hasAmpBoilerplate =
    $('style[amp-boilerplate]').length > 0 ||
    $('style[amp4email-boilerplate]').length > 0 ||
    html.includes('amp-boilerplate');

  const hasAmpCustomStyle = $('style[amp-custom]').length > 0;

  // Canonical tag on AMP page
  const canonicalUrl = $('link[rel="canonical"][href]').attr('href')?.trim();

  // Title
  const title = $('title').text().replace(/\s+/g, ' ').trim() || '';

  // H1 headings
  const h1List: string[] = [];
  $('h1').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t) h1List.push(t);
  });
  const h1 = h1List[0] || '';

  // Extract important content CTA links before stripping
  const importantLinks: string[] = [];
  $('main a[href], article a[href], .content a[href], .amp-content a[href], .entry-content a[href]').each(
    (_, el) => {
      const href = $(el).attr('href')?.trim();
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (href && text && !href.startsWith('#') && !href.startsWith('javascript:')) {
        importantLinks.push(`${text} -> ${href}`);
      }
    }
  );

  // Strip dynamic and tracking selectors
  const selectorsToStrip = [
    ...DYNAMIC_SELECTORS,
    ...(customDynamicSelectors || []),
    // Ignore header and footer navigation on AMP to focus purely on main article content
    'header nav',
    '.header-nav',
    '.main-nav',
    'footer',
    '.footer',
    'amp-sidebar',
    'amp-analytics',
    'amp-pixel',
    'amp-ad',
    'amp-auto-ads',
  ];

  for (const sel of selectorsToStrip) {
    try {
      $(sel).remove();
    } catch {
      // ignore
    }
  }

  // Extract meaningful static text blocks from main content
  const staticBlocks: {
    type: 'heading' | 'paragraph' | 'list_item' | 'cta' | 'other';
    text: string;
  }[] = [];

  // Headings
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const t = normalizeSemanticText($(el).text());
    if (t.length >= 3 && !t.startsWith('{') && !t.includes('function(')) {
      staticBlocks.push({ type: 'heading', text: t });
    }
  });

  // Paragraphs
  $('p, blockquote, .paragraph').each((_, el) => {
    const t = normalizeSemanticText($(el).text());
    if (t.length >= 4 && !t.startsWith('{') && !t.includes('function(')) {
      staticBlocks.push({ type: 'paragraph', text: t });
    }
  });

  // List items
  $('li').each((_, el) => {
    const t = normalizeSemanticText($(el).text());
    if (t.length >= 4 && !t.startsWith('{')) {
      staticBlocks.push({ type: 'list_item', text: t });
    }
  });

  // CTAs and Buttons
  $('a.btn, a.button, a.cta, button, .cta-text').each((_, el) => {
    const t = normalizeSemanticText($(el).text());
    if (t.length >= 2 && t.length <= 120) {
      staticBlocks.push({ type: 'cta', text: t });
    }
  });

  // If few blocks found, fallback to container text
  if (staticBlocks.length <= 1) {
    const mainBody = $('main, article, .content, .entry-content, body')
      .first()
      .text();
    const cleanMain = normalizeSemanticText(mainBody);
    if (cleanMain) {
      staticBlocks.push({ type: 'other', text: cleanMain });
    }
  }

  const staticText = staticBlocks.map((b) => b.text).join(' ');

  return {
    title,
    h1,
    h1List,
    canonicalUrl,
    staticText,
    staticBlocks,
    importantLinks,
    isAmpHtmlDeclared,
    hasAmpJsRuntime,
    hasAmpBoilerplate,
    hasAmpCustomStyle,
    disallowedScripts,
  };
}

/**
 * Extracts structured static blocks from a normal page HTML or crawl item
 */
export function parseNormalPageContent(
  html: string | undefined,
  item: CrawlUrlItem,
  customDynamicSelectors?: string[]
): {
  title: string;
  h1: string;
  staticText: string;
  staticBlocks: { type: 'heading' | 'paragraph' | 'list_item' | 'cta' | 'other'; text: string }[];
} {
  if (html) {
    const $ = cheerio.load(html);

    // Title
    const title = $('title').text().replace(/\s+/g, ' ').trim() || item.title || '';

    // H1
    const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim() || '';

    // Strip dynamic elements & header/footer
    const selectorsToStrip = [
      ...DYNAMIC_SELECTORS,
      ...(customDynamicSelectors || []),
      'header nav',
      '.header-nav',
      '.main-nav',
      'footer',
      '.footer',
    ];

    for (const sel of selectorsToStrip) {
      try {
        $(sel).remove();
      } catch {
        // ignore
      }
    }

    const staticBlocks: {
      type: 'heading' | 'paragraph' | 'list_item' | 'cta' | 'other';
      text: string;
    }[] = [];

    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const t = normalizeSemanticText($(el).text());
      if (t.length >= 3 && !t.startsWith('{')) {
        staticBlocks.push({ type: 'heading', text: t });
      }
    });

    $('p, blockquote, .paragraph').each((_, el) => {
      const t = normalizeSemanticText($(el).text());
      if (t.length >= 4 && !t.startsWith('{')) {
        staticBlocks.push({ type: 'paragraph', text: t });
      }
    });

    $('li').each((_, el) => {
      const t = normalizeSemanticText($(el).text());
      if (t.length >= 4 && !t.startsWith('{')) {
        staticBlocks.push({ type: 'list_item', text: t });
      }
    });

    $('a.btn, a.button, a.cta, button, .cta-text').each((_, el) => {
      const t = normalizeSemanticText($(el).text());
      if (t.length >= 2 && t.length <= 120) {
        staticBlocks.push({ type: 'cta', text: t });
      }
    });

    if (staticBlocks.length <= 1) {
      const mainText = normalizeSemanticText(
        $('main, article, .content, .entry-content, body').first().text()
      );
      if (mainText) {
        staticBlocks.push({ type: 'other', text: mainText });
      }
    }

    const staticText = staticBlocks.map((b) => b.text).join(' ');

    return { title, h1, staticText, staticBlocks };
  }

  // Fallback to crawl item's static blocks
  const title = item.title || '';
  const staticBlocks: {
    type: 'heading' | 'paragraph' | 'list_item' | 'cta' | 'other';
    text: string;
  }[] = [];

  let h1 = '';
  if (item.staticBlocks && item.staticBlocks.length > 0) {
    for (const b of item.staticBlocks) {
      if (b.type === 'heading' && !h1) {
        h1 = b.text;
      }
      staticBlocks.push({
        type: b.type === 'heading' ? 'heading' : 'paragraph',
        text: normalizeSemanticText(b.text),
      });
    }
  }

  const staticText = item.staticText || staticBlocks.map((b) => b.text).join(' ') || '';

  return { title, h1, staticText, staticBlocks };
}

/**
 * Compares static content between Normal Page and AMP Page
 */
export function compareStaticContent(
  normalBlocks: { type: string; text: string }[],
  ampBlocks: { type: string; text: string }[],
  normalStaticText: string,
  ampStaticText: string,
  passThreshold: number = 95,
  warnThreshold: number = 85
): {
  normalChars: number;
  ampChars: number;
  matchPercent: number;
  missingBlocks: AmpMissingContentBlock[];
  ampOnlyBlocks: string[];
} {
  const normNormText = normalizeSemanticText(normalStaticText).toLowerCase();
  const normAmpText = normalizeSemanticText(ampStaticText).toLowerCase();

  const normalChars = normNormText.length || 1;
  const ampChars = normAmpText.length || 0;

  if (normalChars < 60 && ampChars >= 20) {
    return {
      normalChars,
      ampChars,
      matchPercent: 100,
      missingBlocks: [],
      ampOnlyBlocks: [],
    };
  }

  let matchedChars = 0;
  const missingBlocks: AmpMissingContentBlock[] = [];

  normalBlocks.forEach((block, idx) => {
    const bText = normalizeSemanticText(block.text);
    if (!bText || bText.length < 4) return;

    const bNorm = bText.toLowerCase();

    // Check if block text exists in AMP
    let isPresent = false;
    if (normAmpText.includes(bNorm)) {
      isPresent = true;
    } else {
      // Check word token matching for fuzzy match
      const words = bNorm.split(/\s+/).filter((w) => w.length > 2);
      if (words.length >= 3) {
        let matchingWords = 0;
        for (const w of words) {
          if (normAmpText.includes(w)) matchingWords++;
        }
        if (matchingWords / words.length >= 0.75) {
          isPresent = true;
        }
      }
    }

    if (isPresent) {
      matchedChars += bText.length;
    } else {
      // Only report meaningful text blocks missing
      if (bText.length >= 15) {
        missingBlocks.push({
          id: `missing_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          text: bText,
          type: (block.type as any) || 'paragraph',
          charCount: bText.length,
          normalIndex: idx,
        });
      }
    }
  });

  // Calculate percentage
  let matchPercent = 0;
  if (normalBlocks.length > 0 && normalChars > 0) {
    matchPercent = Math.min(100, Math.round((matchedChars / normalChars) * 100));
  } else if (ampChars > 0) {
    matchPercent = 100;
  }

  // Detect AMP-only meaningful blocks
  const ampOnlyBlocks: string[] = [];
  ampBlocks.forEach((ab) => {
    const aText = normalizeSemanticText(ab.text);
    if (aText.length >= 35) {
      const aNorm = aText.toLowerCase();
      if (!normNormText.includes(aNorm)) {
        const words = aNorm.split(/\s+/).filter((w) => w.length > 2);
        let foundWords = 0;
        for (const w of words) {
          if (normNormText.includes(w)) foundWords++;
        }
        if (words.length > 0 && foundWords / words.length < 0.4) {
          ampOnlyBlocks.push(aText);
        }
      }
    }
  });

  return {
    normalChars,
    ampChars,
    matchPercent,
    missingBlocks,
    ampOnlyBlocks,
  };
}

/**
 * Validates canonical relationship between AMP and Normal page.
 * Returns match status, normalized canonical URL, and error reasoning.
 */
export function validateAmpCanonicalRelation(
  ampCanonicalHref: string | undefined,
  normalUrl: string,
  normalCanonicalPath: string,
  origin: string
): {
  canonicalStatus: 'match' | 'mismatch' | 'missing' | 'not_applicable';
  canonicalMatches: boolean;
  ampCanonicalUrl?: string;
  reason?: string;
} {
  if (!ampCanonicalHref) {
    return {
      canonicalStatus: 'missing',
      canonicalMatches: false,
      reason: 'AMP page is missing <link rel="canonical"> tag',
    };
  }

  try {
    const resolvedCanonical = new URL(ampCanonicalHref, origin).toString();
    const normCanonical = normalizeUrl(resolvedCanonical, origin);
    const resolvedNormUrl = normCanonical ? normCanonical.normalizedUrl : resolvedCanonical;

    const ampCanonPath = getCanonicalPath(resolvedNormUrl);
    const normalCanonPath = normalCanonicalPath || getCanonicalPath(normalUrl);

    const isPathMatch = ampCanonPath === normalCanonPath;
    const isUrlMatch = resolvedNormUrl === normalUrl;

    // Check language identity
    const ampCanonLang = extractUrlLanguage(resolvedNormUrl);
    const normalLang = extractUrlLanguage(normalUrl);
    const isLangMatch = ampCanonLang.canonicalCode === normalLang.canonicalCode;

    if ((isPathMatch || isUrlMatch) && isLangMatch) {
      return {
        canonicalStatus: 'match',
        canonicalMatches: true,
        ampCanonicalUrl: resolvedNormUrl,
      };
    }

    let reason = 'Canonical URL points to a different page';
    if (!isLangMatch) {
      reason = `Canonical points to different language (${ampCanonLang.canonicalName} instead of ${normalLang.canonicalName})`;
    } else if (!isPathMatch) {
      reason = `Canonical path mismatch: '${ampCanonPath}' vs expected '${normalCanonPath}'`;
    }

    return {
      canonicalStatus: 'mismatch',
      canonicalMatches: false,
      ampCanonicalUrl: resolvedNormUrl,
      reason,
    };
  } catch {
    return {
      canonicalStatus: 'mismatch',
      canonicalMatches: false,
      ampCanonicalUrl: ampCanonicalHref,
      reason: `Malformed canonical URL: '${ampCanonicalHref}'`,
    };
  }
}

/**
 * Validates technical AMP compliance
 */
export function validateTechnicalAmp(parsed: AmpParsedContent): {
  technicalStatus: AmpTechnicalStatus;
  technicalIssues: string[];
} {
  const issues: string[] = [];

  if (!parsed.isAmpHtmlDeclared) {
    issues.push('Missing AMP HTML declaration (⚡ or amp attribute on <html> tag)');
  }
  if (!parsed.hasAmpJsRuntime) {
    issues.push('Missing required AMP JS library script (https://cdn.ampproject.org/v0.js)');
  }
  if (!parsed.hasAmpBoilerplate) {
    issues.push('Missing required AMP boilerplate CSS (<style amp-boilerplate>)');
  }
  if (!parsed.canonicalUrl) {
    issues.push('Missing <link rel="canonical"> tag on AMP page');
  }
  if (parsed.disallowedScripts.length > 0) {
    issues.push(
      `Contains ${parsed.disallowedScripts.length} unauthorized custom <script> tags (not allowed in AMP)`
    );
  }

  let technicalStatus: AmpTechnicalStatus = 'valid';
  if (issues.length >= 2 || !parsed.isAmpHtmlDeclared || !parsed.hasAmpJsRuntime) {
    technicalStatus = 'invalid';
  } else if (issues.length > 0) {
    technicalStatus = 'needs_review';
  }

  return {
    technicalStatus,
    technicalIssues: issues,
  };
}

import { shouldIgnoreUrl } from '../services/domainSettingsStore';

/**
 * Main AMP Validation Engine:
 * Evaluates all crawled pages in the session for AMP support, canonical parity, content match, language, and technical validity.
 */
export async function validateAmp(
  session: StoredCrawlSession,
  options: AmpValidationOptions = {}
): Promise<AmpValidationResult> {
  const {
    checkGuesses = false,
    passThreshold = 95,
    warnThreshold = 85,
    maxPages,
    timeoutSec = 8,
  } = options;

  const ignoredUrls: string[] = [];
  const ignoredItems: AmpValidationItem[] = [];
  let pagesIgnored = 0;

  // Filter valid HTML canonical pages from crawl dataset (exclude assets, HTTP errors, and AMP format URLs)
  const candidateItems: CrawlUrlItem[] = [];

  for (const item of session.items.values()) {
    if (isAssetUrl(item.normalizedUrl)) continue;
    if (item.status >= 400) continue;
    // Exclude AMP pages from being tested as base pages (AMP pages are tested as paired mobile targets of canonical pages)
    if (isAmpUrl(item.normalizedUrl)) continue;

    const ignoreCheck = shouldIgnoreUrl(item, 'amp', session);
    if (ignoreCheck.ignored) {
      pagesIgnored++;
      ignoredUrls.push(item.normalizedUrl);

      const expCanonical = getCanonicalLanguage(item.langCode || 'en');
      ignoredItems.push({
        id: `ignored_${item.id || Math.random().toString(36).substring(2, 9)}`,
        normalUrl: item.normalizedUrl,
        canonicalPath: item.canonicalPath || getCanonicalPath(item.normalizedUrl),
        language: item.language,
        langCode: item.langCode,
        expectedLanguage: expCanonical.name,
        expectedLanguageCode: expCanonical.code,
        discoverySource: 'none',
        discoveryDetails: 'Excluded by rule',
        isAvailable: false,
        canonicalMatches: true,
        canonicalStatus: 'not_applicable',
        normalTitle: item.title,
        titleMatches: true,
        normalH1: item.staticBlocks?.find((b) => b.type === 'heading')?.text,
        h1Matches: true,
        normalStaticChars: 0,
        ampStaticChars: 0,
        contentMatchPercent: 100,
        languageMatches: true,
        technicalStatus: 'not_applicable',
        technicalIssues: [],
        status: 'ignored',
        statusLabel: 'Excluded by rule',
        errorCategories: [],
        missingContentBlocks: [],
        ampOnlyContentBlocks: [],
        ignoreReason: ignoreCheck.reason || 'Excluded by rule',
        reason: ignoreCheck.reason || 'Excluded by rule',
      });
      continue;
    }

    candidateItems.push(item);
  }

  const pagesToProcess =
    typeof maxPages === 'number' && maxPages > 0
      ? candidateItems.slice(0, maxPages)
      : candidateItems;

  const items: AmpValidationItem[] = [];

  let ampFoundCount = 0;
  let ampNotImplementedCount = 0;
  let passedCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  let contentWarningsCount = 0;
  let languageErrorsCount = 0;
  let canonicalErrorsCount = 0;
  let technicalErrorsCount = 0;

  // Process pages in concurrent batches for high speed
  const concurrency = 8;
  for (let i = 0; i < pagesToProcess.length; i += concurrency) {
    const batch = pagesToProcess.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (item): Promise<AmpValidationItem> => {
        const id = `amp_${item.id || Math.random().toString(36).substring(2, 9)}`;
        const normalUrl = item.normalizedUrl;
        const canonicalPath = item.canonicalPath || getCanonicalPath(normalUrl);

        // Language identification
        const expCanonical = getCanonicalLanguage(item.langCode || 'en');
        const expectedLanguage = expCanonical.name;
        const expectedLanguageCode = expCanonical.code;

        // 1. Discover AMP URL
        const discovery = discoverAmpUrl(
          normalUrl,
          item.textContent ? undefined : undefined,
          item.amphtmlUrl,
          checkGuesses
        );

        // Case A: No AMP found -> SKIPPED (AMP not implemented)
        if (discovery.discoverySource === 'none' || !discovery.ampUrl) {
          return {
            id,
            normalUrl,
            canonicalPath,
            language: item.language,
            langCode: item.langCode,
            expectedLanguage,
            expectedLanguageCode,
            discoverySource: 'none',
            discoveryDetails: 'No <link rel="amphtml"> declared on normal page',
            isAvailable: false,
            canonicalMatches: true,
            canonicalStatus: 'not_applicable',
            normalTitle: item.title,
            titleMatches: true,
            normalH1: item.staticBlocks?.find((b) => b.type === 'heading')?.text,
            h1Matches: true,
            normalStaticChars: item.staticCharsAnalyzed || item.staticText?.length || 0,
            ampStaticChars: 0,
            contentMatchPercent: 100,
            languageMatches: true,
            technicalStatus: 'not_applicable',
            technicalIssues: [],
            status: 'skipped',
            statusLabel: 'Skipped — AMP not implemented',
            errorCategories: [],
            missingContentBlocks: [],
            ampOnlyContentBlocks: [],
          };
        }

        const ampUrl = discovery.ampUrl;
        const discoverySource = discovery.discoverySource;
        const errorCategories: AmpErrorCategory[] = [];

        // 2. Fetch AMP page
        const ampFetch = await fetchAmpPage(ampUrl, undefined, timeoutSec);

        // Case B: AMP URL returned HTTP error or timeout
        if (!ampFetch.ok) {
          if (ampFetch.status === 404) {
            errorCategories.push('AMP_HTTP_ERROR');
          } else if (ampFetch.status >= 500) {
            errorCategories.push('AMP_HTTP_ERROR');
          } else if (ampFetch.error?.includes('timeout')) {
            errorCategories.push('AMP_TIMEOUT');
          } else {
            errorCategories.push('AMP_HTTP_ERROR');
          }

          return {
            id,
            normalUrl,
            canonicalPath,
            language: item.language,
            langCode: item.langCode,
            expectedLanguage,
            expectedLanguageCode,
            ampUrl,
            discoverySource,
            discoveryDetails:
              discoverySource === 'declared'
                ? `Declared via <link rel="amphtml" href="${discovery.rawAmphtml || ampUrl}">`
                : 'Guessed URL pattern',
            httpStatus: ampFetch.status,
            isAvailable: false,
            canonicalMatches: false,
            canonicalStatus: 'missing',
            normalTitle: item.title,
            titleMatches: false,
            h1Matches: false,
            normalStaticChars: item.staticCharsAnalyzed || item.staticText?.length || 0,
            ampStaticChars: 0,
            contentMatchPercent: 0,
            languageMatches: false,
            technicalStatus: 'invalid',
            technicalIssues: [`AMP HTTP Error: ${ampFetch.status || ampFetch.error}`],
            status: 'error',
            statusLabel: `HTTP ${ampFetch.status || 'Failed'} Error`,
            errorCategories,
            missingContentBlocks: [],
            ampOnlyContentBlocks: [],
            reason: `Declared AMP URL returned HTTP ${ampFetch.status || 'Error'}: ${ampFetch.error || 'Unavailable'}`,
          };
        }

        // 3. Parse AMP content & normal content
        const parsedAmp = parseAmpHtml(ampFetch.html, ampUrl, DYNAMIC_SELECTORS);
        const parsedNormal = parseNormalPageContent(undefined, item, DYNAMIC_SELECTORS);

        // 4. Validate Canonical Relationship (AMP -> Canonical)
        const canonValidation = validateAmpCanonicalRelation(
          parsedAmp.canonicalUrl,
          normalUrl,
          canonicalPath,
          session.origin
        );

        if (!canonValidation.canonicalMatches) {
          if (canonValidation.canonicalStatus === 'missing') {
            errorCategories.push('AMP_CANONICAL_MISSING');
          } else {
            errorCategories.push('AMP_CANONICAL_MISMATCH');
          }
        }

        // 5. Validate Language
        const ampLangDetect = detectTextContentLanguage(parsedAmp.staticText || parsedAmp.title);
        const ampCanonLang = getCanonicalLanguage(ampLangDetect.code);
        const detectedAmpLanguage = ampCanonLang.name;
        const detectedAmpLanguageCode = ampCanonLang.code;

        const languageMatches =
          ampCanonLang.isKnown &&
          normalizeLanguageCode(detectedAmpLanguageCode) === normalizeLanguageCode(expectedLanguageCode);

        if (!languageMatches && ampLangDetect.confidence >= 70 && ampCanonLang.isKnown) {
          errorCategories.push('AMP_LANGUAGE_MISMATCH');
        }

        // 6. Title and H1 Comparison
        const titleMatches = compareTitles(parsedNormal.title, parsedAmp.title);
        if (!titleMatches && parsedNormal.title && parsedAmp.title) {
          errorCategories.push('AMP_TITLE_MISMATCH');
        }

        const normH1 = normalizeSemanticText(parsedNormal.h1).toLowerCase();
        const ampH1 = normalizeSemanticText(parsedAmp.h1).toLowerCase();
        const h1Matches = !normH1 || !ampH1 || normH1 === ampH1 || normH1.includes(ampH1) || ampH1.includes(normH1);
        if (!h1Matches) {
          errorCategories.push('AMP_H1_MISMATCH');
        }

        // 7. Static Content Comparison
        const contentComp = compareStaticContent(
          parsedNormal.staticBlocks,
          parsedAmp.staticBlocks,
          parsedNormal.staticText,
          parsedAmp.staticText,
          passThreshold,
          warnThreshold
        );

        if (contentComp.matchPercent < warnThreshold) {
          errorCategories.push('AMP_CONTENT_MISMATCH');
        } else if (contentComp.matchPercent < passThreshold) {
          errorCategories.push('AMP_CONTENT_WARNING');
        }

        // 8. Technical AMP Validation
        const technical = validateTechnicalAmp(parsedAmp);
        if (technical.technicalStatus === 'invalid') {
          errorCategories.push('AMP_TECHNICAL_INVALID');
        }

        if (discoverySource === 'guessed') {
          errorCategories.push('AMP_DETECTION_UNCERTAIN');
        }

        // 9. Classify Status
        let status: AmpItemStatus = 'passed';
        let statusLabel = 'Pass';
        let reason: string | undefined;

        if (!canonValidation.canonicalMatches) {
          status = 'error';
          statusLabel = canonValidation.canonicalStatus === 'missing' ? 'Canonical Missing' : 'Canonical Mismatch';
          reason = canonValidation.reason;
        } else if (!languageMatches && ampLangDetect.confidence >= 70 && ampCanonLang.isKnown) {
          status = 'error';
          statusLabel = 'Language Mismatch';
          reason = `AMP content detected as ${detectedAmpLanguage} instead of ${expectedLanguage}`;
        } else if (!h1Matches) {
          status = 'error';
          statusLabel = 'H1 Mismatch';
          reason = `H1 heading mismatch: Normal '${parsedNormal.h1}' vs AMP '${parsedAmp.h1}'`;
        } else if (contentComp.matchPercent < warnThreshold) {
          status = 'error';
          statusLabel = `Content Mismatch (${contentComp.matchPercent}%)`;
          reason = `Significant content missing from AMP page (${contentComp.missingBlocks.length} text blocks missing)`;
        } else if (contentComp.matchPercent < passThreshold) {
          status = 'warning';
          statusLabel = `Content Warning (${contentComp.matchPercent}%)`;
          reason = `Minor content differences (${contentComp.missingBlocks.length} missing text blocks)`;
        } else if (technical.technicalStatus === 'invalid') {
          status = 'warning';
          statusLabel = 'Technical Issue';
          reason = technical.technicalIssues[0];
        } else if (discoverySource === 'guessed') {
          status = 'warning';
          statusLabel = 'Guessed AMP (Needs Review)';
          reason = 'AMP URL was guessed from pattern, not declared via rel="amphtml"';
        }

        return {
          id,
          normalUrl,
          canonicalPath,
          language: item.language,
          langCode: item.langCode,
          expectedLanguage,
          expectedLanguageCode,
          ampUrl,
          discoverySource,
          discoveryDetails:
            discoverySource === 'declared'
              ? `Declared via <link rel="amphtml" href="${discovery.rawAmphtml || ampUrl}">`
              : 'Guessed URL pattern (/amp/)',
          httpStatus: ampFetch.status,
          isAvailable: ampFetch.ok,
          ampCanonicalUrl: canonValidation.ampCanonicalUrl,
          canonicalMatches: canonValidation.canonicalMatches,
          canonicalStatus: canonValidation.canonicalStatus,
          normalTitle: parsedNormal.title,
          ampTitle: parsedAmp.title,
          titleMatches,
          normalH1: parsedNormal.h1,
          ampH1: parsedAmp.h1,
          h1Matches,
          normalStaticChars: contentComp.normalChars,
          ampStaticChars: contentComp.ampChars,
          contentMatchPercent: contentComp.matchPercent,
          detectedAmpLanguage,
          detectedAmpLanguageCode,
          languageMatches,
          technicalStatus: technical.technicalStatus,
          technicalIssues: technical.technicalIssues,
          status,
          statusLabel,
          errorCategories,
          missingContentBlocks: contentComp.missingBlocks,
          ampOnlyContentBlocks: contentComp.ampOnlyBlocks,
          missingLinks: parsedAmp.importantLinks,
          reason,
        };
      })
    );

    items.push(...batchResults);
  }

  // Calculate summary metrics
  for (const item of items) {
    if (item.status === 'skipped') {
      skippedCount++;
      ampNotImplementedCount++;
    } else {
      ampFoundCount++;
      if (item.status === 'passed') {
        passedCount++;
      } else if (item.status === 'warning') {
        warningCount++;
      } else if (item.status === 'error') {
        errorCount++;
      }

      if (item.contentMatchPercent < passThreshold && item.contentMatchPercent >= warnThreshold) {
        contentWarningsCount++;
      }
      if (!item.languageMatches && item.detectedAmpLanguage) {
        languageErrorsCount++;
      }
      if (!item.canonicalMatches) {
        canonicalErrorsCount++;
      }
      if (item.technicalStatus === 'invalid') {
        technicalErrorsCount++;
      }
    }
  }

  // Combine processed items and ignored items
  const allResultItems = [...items, ...ignoredItems];

  // Sort: error first, then warning, then skipped, then ignored, then passed
  allResultItems.sort((a, b) => {
    const order: Record<string, number> = {
      error: 0,
      warning: 1,
      skipped: 2,
      ignored: 3,
      passed: 4,
    };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  });

  return {
    pagesChecked: items.length,
    pagesIgnored,
    ampFoundCount,
    ampNotImplementedCount,
    passedCount,
    warningCount,
    errorCount,
    skippedCount,
    ignoredCount: pagesIgnored,
    contentWarningsCount,
    languageErrorsCount,
    canonicalErrorsCount,
    technicalErrorsCount,
    overallStatus: errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'passed',
    passPercentageThreshold: passThreshold,
    warningPercentageThreshold: warnThreshold,
    items: allResultItems,
    ignoredUrls,
    timestamp: Date.now(),
  };
}
