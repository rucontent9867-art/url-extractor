import * as cheerio from 'cheerio';
import { normalizeHreflangCode, detectUnicodeScript } from '../../src/utils/canonicalLanguage';

export interface StaticContentBlock {
  type: 'heading' | 'paragraph' | 'list_item' | 'cta' | 'navigation' | 'footer' | 'meta' | 'other';
  text: string;
}

export interface ParsedPageRecord {
  title: string;
  metaDescription: string;
  h1: string;
  h1List: string[];
  canonicalUrl?: string;
  amphtmlUrl?: string;
  hreflangMap: Record<string, string>; // normalizedLangCode -> absoluteHref
  links: string[];
  alternateLinks: string[];
  assetLinks: string[];
  staticText: string;
  staticCharsAnalyzed: number;
  dynamicCharsIgnored: number;
  staticBlocks: StaticContentBlock[];
  headerLinks: string[];
  hasLanguageSelector: boolean;
  languageSelectorOptions: Array<{ text: string; code?: string; href?: string }>;
}

export interface ParsePageOptions {
  baseUrl: string;
  dynamicSelectors?: string[];
}

const DEFAULT_DYNAMIC_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'path',
  'iframe',
  'object',
  'embed',
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
  '#drift-widget',
  '.cookie-banner',
  '.cookie-consent',
  '.cookie-notice',
  '.cookie-modal',
  '.cookie-law',
  '#cookie-law-info-bar',
  '.dynamic-price',
  '.price-exchange',
  '.countdown',
  '.timer',
  '.current-date',
  '.current-time',
  '.user-menu',
  '.user-status',
  '.login-state',
  '.captcha',
  '.g-recaptcha',
  '.h-captcha',
  '.cf-turnstile',
];

/**
 * High-speed single-pass HTML parser.
 * Extracts title, headings, canonicals, hreflang mappings, clean static text,
 * dynamic-stripped content, header links, and language selectors.
 */
export function parseHtmlPage(html: string, options: ParsePageOptions): ParsedPageRecord {
  const $ = cheerio.load(html, { xml: false });
  const baseUrl = options.baseUrl;

  // 1. Meta & Titles
  const title = $('title').text().replace(/\s+/g, ' ').trim() || '';
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    '';

  // 2. Canonical & AMP
  const rawCanonical = $('link[rel="canonical"][href]').attr('href')?.trim();
  const rawAmphtml = $('link[rel="amphtml"][href]').attr('href')?.trim();

  let canonicalUrl: string | undefined = undefined;
  if (rawCanonical) {
    try {
      canonicalUrl = new URL(rawCanonical, baseUrl).toString();
    } catch {
      canonicalUrl = rawCanonical;
    }
  }

  let amphtmlUrl: string | undefined = undefined;
  if (rawAmphtml) {
    try {
      amphtmlUrl = new URL(rawAmphtml, baseUrl).toString();
    } catch {
      amphtmlUrl = rawAmphtml;
    }
  }

  // 3. Hreflang Alternates
  const hreflangMap: Record<string, string> = {};
  const alternateLinks: string[] = [];

  $('link[rel="alternate"][href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    const hreflang = $(el).attr('hreflang')?.trim();
    if (href) {
      try {
        const absHref = new URL(href, baseUrl).toString();
        alternateLinks.push(absHref);
        if (hreflang) {
          const norm = normalizeHreflangCode(hreflang);
          hreflangMap[norm.code] = absHref;
        }
      } catch {
        alternateLinks.push(href);
      }
    }
  });

  // 4. Headings
  const h1List: string[] = [];
  $('h1').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t && t.length >= 2) {
      h1List.push(t);
    }
  });
  const h1 = h1List[0] || '';

  // 5. Header Links Discovery (Cheerio-first)
  const headerLinks: string[] = [];
  const headerContainers = $(
    'header, nav, [role="banner"], [role="navigation"], .header, #header, .navbar, #navbar, .nav-menu, .main-navigation'
  );

  headerContainers.find('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      try {
        headerLinks.push(new URL(href, baseUrl).toString());
      } catch {
        // ignore
      }
    }
  });

  // 6. Language Selector Fast Detection (Cheerio-first)
  let hasLanguageSelector = false;
  const languageSelectorOptions: Array<{ text: string; code?: string; href?: string }> = [];

  // Check <select> with language clues
  $('select').each((_, el) => {
    const nameOrId = ($(el).attr('name') || '' + $(el).attr('id') || '' + $(el).attr('class') || '').toLowerCase();
    if (
      nameOrId.includes('lang') ||
      nameOrId.includes('locale') ||
      nameOrId.includes('country') ||
      $(el).find('option').length >= 2
    ) {
      $(el).find('option').each((_, opt) => {
        const optText = $(opt).text().trim();
        const optVal = $(opt).attr('value')?.trim();
        if (optText) {
          hasLanguageSelector = true;
          languageSelectorOptions.push({ text: optText, code: optVal });
        }
      });
    }
  });

  // Check language switcher links in header / nav
  headerContainers.find('a[href]').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href') || '';
    if (
      text === 'english' ||
      text === 'en' ||
      text === 'espanol' ||
      text === 'español' ||
      text === 'es' ||
      text === 'francais' ||
      text === 'français' ||
      text === 'fr' ||
      text === 'deutsch' ||
      text === 'de' ||
      text === 'italiano' ||
      text === 'it' ||
      text === 'chinese' ||
      text === '中文' ||
      text === 'cn' ||
      text === 'zh' ||
      text === 'japanese' ||
      text === '日本語' ||
      text === 'ja'
    ) {
      hasLanguageSelector = true;
      try {
        languageSelectorOptions.push({ text: $(el).text().trim(), href: new URL(href, baseUrl).toString() });
      } catch {
        // ignore
      }
    }
  });

  // 7. Extract all hyperlinks, frames, and asset links comprehensively
  const linksSet = new Set<string>();
  $('a[href], area[href], [data-href], [data-url], iframe[src], form[action]').each((_, el) => {
    const href =
      $(el).attr('href') ||
      $(el).attr('data-href') ||
      $(el).attr('data-url') ||
      $(el).attr('src') ||
      $(el).attr('action');
    if (href) {
      const trimmed = href.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('javascript:')) {
        linksSet.add(trimmed);
      }
    }
  });
  const links: string[] = Array.from(linksSet);

  const assetLinksSet = new Set<string>();
  $(
    'img[src], img[data-src], source[src], source[srcset], video[src], audio[src], link[rel="icon"][href], link[rel="shortcut icon"][href], link[rel="stylesheet"][href], script[src]'
  ).each((_, el) => {
    const src =
      $(el).attr('src') ||
      $(el).attr('data-src') ||
      $(el).attr('href') ||
      $(el).attr('srcset');
    if (src) {
      const trimmed = src.trim();
      if (trimmed) assetLinksSet.add(trimmed);
    }
  });
  const assetLinks: string[] = Array.from(assetLinksSet);

  // 8. Measure and strip dynamic / boilerplate elements for clean content analysis
  let dynamicCharsIgnored = 0;
  const allDynamicSelectors = [
    ...DEFAULT_DYNAMIC_SELECTORS,
    ...(options.dynamicSelectors || []),
  ];

  for (const selector of allDynamicSelectors) {
    if (!selector) continue;
    try {
      $(selector).each((_, el) => {
        const text = $(el).text()?.trim() || '';
        if (text) dynamicCharsIgnored += text.length;
        $(el).remove();
      });
    } catch {
      // ignore selector syntax errors
    }
  }

  // Also remove elements with inline display:none
  $('[style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"]').each(
    (_, el) => {
      const text = $(el).text()?.trim() || '';
      if (text) dynamicCharsIgnored += text.length;
      $(el).remove();
    }
  );

  // 9. Extract static content blocks
  const staticBlocks: StaticContentBlock[] = [];

  if (title) {
    staticBlocks.push({ type: 'meta', text: title });
  }
  if (metaDescription) {
    staticBlocks.push({ type: 'meta', text: metaDescription });
  }

  // Headings
  $('h1, h2, h3, h4').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length >= 3 && !t.startsWith('{') && !t.includes('function(')) {
      staticBlocks.push({ type: 'heading', text: t });
    }
  });

  // Paragraphs & list items
  $('p, li').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length >= 4 && !t.startsWith('{') && !t.includes('function(')) {
      staticBlocks.push({ type: 'paragraph', text: t });
    }
  });

  // CTAs & buttons
  $('button, .btn, .cta, .button').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length >= 2 && t.length <= 80) {
      staticBlocks.push({ type: 'cta', text: t });
    }
  });

  // Main body fallback if sparse
  const staticTextPieces = staticBlocks.map((b) => b.text);
  if (staticTextPieces.length <= 1) {
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    if (bodyText) {
      staticTextPieces.push(bodyText);
    }
  }

  const staticText = staticTextPieces.join(' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
  const staticCharsAnalyzed = staticText.length;

  return {
    title,
    metaDescription,
    h1,
    h1List,
    canonicalUrl,
    amphtmlUrl,
    hreflangMap,
    links,
    alternateLinks,
    assetLinks,
    staticText,
    staticCharsAnalyzed,
    dynamicCharsIgnored,
    staticBlocks,
    headerLinks,
    hasLanguageSelector,
    languageSelectorOptions,
  };
}
