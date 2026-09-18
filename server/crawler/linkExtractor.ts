import * as cheerio from 'cheerio';

export interface StaticContentBlock {
  type: 'heading' | 'paragraph' | 'navigation' | 'footer' | 'meta';
  text: string;
}

export interface ExtractedPageData {
  links: string[];
  alternateLinks: string[];
  assetLinks: string[];
  canonicalUrl?: string;
  amphtmlUrl?: string;
  title: string;
  metaDescription: string;
  textContent: string; // compatibility
  staticText: string;
  staticCharsAnalyzed: number;
  dynamicCharsIgnored: number;
  staticBlocks: StaticContentBlock[];
}

export interface ExtractOptions {
  dynamicSelectors?: string[];
}

// Built-in selectors for common dynamic, tracking, or user-state elements
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
 * Extracts links, metadata, and static visible text content from HTML.
 * Strictly excludes dynamic content, chat widgets, countdowns, form values, and user-configured selectors.
 */
export function extractPageData(html: string, options?: ExtractOptions): ExtractedPageData {
  const $ = cheerio.load(html);

  // 1. Extract title
  const title = $('title').text().trim() || '';

  // 2. Extract meta description
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    '';

  // 3. Extract all hyperlinks
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      links.push(href.trim());
    }
  });

  // 4. Extract hreflang alternates
  const alternateLinks: string[] = [];
  $('link[rel="alternate"][href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      alternateLinks.push(href.trim());
    }
  });

  // 5. Extract assets (images, stylesheets, icons, scripts, media)
  const assetLinks: string[] = [];
  $(
    'img[src], source[src], video[src], audio[src], link[rel="icon"][href], link[rel="shortcut icon"][href]'
  ).each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('href');
    if (src) {
      assetLinks.push(src.trim());
    }
  });

  // 6. Canonical & AMP tags
  const canonicalUrl = $('link[rel="canonical"][href]').attr('href')?.trim();
  const amphtmlUrl = $('link[rel="amphtml"][href]').attr('href')?.trim();

  // 7. Measure and strip dynamic content
  let dynamicCharsIgnored = 0;

  // Combine built-in dynamic selectors and user-configured custom selectors
  const allDynamicSelectors = [
    ...DEFAULT_DYNAMIC_SELECTORS,
    ...(options?.dynamicSelectors || []),
  ];

  for (const selector of allDynamicSelectors) {
    if (!selector || !selector.trim()) continue;
    try {
      $(selector).each((_, el) => {
        const text = $(el).text()?.trim() || '';
        if (text) {
          dynamicCharsIgnored += text.length;
        }
        $(el).remove();
      });
    } catch {
      // Ignore invalid custom CSS selector syntax gracefully
    }
  }

  // Also remove elements with inline display:none or visibility:hidden styles
  $('[style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"]').each(
    (_, el) => {
      const text = $(el).text()?.trim() || '';
      if (text) {
        dynamicCharsIgnored += text.length;
      }
      $(el).remove();
    }
  );

  // 8. Extract meaningful static text blocks (prioritizing main content over navigation/footer boilerplate)
  const staticBlocks: StaticContentBlock[] = [];

  // Meta block
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
  $('p, li, article, main, section').each((_, el) => {
    // Exclude if inside nav or footer or aside to prevent boilerplate skewing language detection
    if ($(el).parents('nav, footer, aside, .footer, .header, .nav').length === 0) {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length >= 4 && !t.startsWith('{') && !t.includes('function(')) {
        staticBlocks.push({ type: 'paragraph', text: t });
      }
    }
  });

  // Static buttons & labels
  $('button, label').each((_, el) => {
    if ($(el).parents('nav, footer, aside, .footer, .header').length === 0) {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length >= 2 && t.length <= 80) {
        staticBlocks.push({ type: 'paragraph', text: t });
      }
    }
  });

  // Collect text pieces
  const staticTextPieces = staticBlocks.map((b) => b.text);

  // If no structured blocks were found, fallback to remaining body text (excluding nav/footer)
  if (staticTextPieces.length <= 1) {
    const bodyClone = $('body').clone();
    bodyClone.find('nav, footer, aside, header, .footer, .header, .nav').remove();
    const bodyText = bodyClone.text().replace(/\s+/g, ' ').trim();
    if (bodyText) {
      staticTextPieces.push(bodyText);
    }
  }

  const staticText = staticTextPieces.join(' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
  const staticCharsAnalyzed = staticText.length;

  return {
    links,
    alternateLinks,
    assetLinks,
    canonicalUrl,
    amphtmlUrl,
    title,
    metaDescription,
    textContent: staticText,
    staticText,
    staticCharsAnalyzed,
    dynamicCharsIgnored,
    staticBlocks,
  };
}
