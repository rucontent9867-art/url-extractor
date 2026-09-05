import { chromium, Browser, Page, BrowserContext } from 'playwright';
import {
  HeaderValidationResult,
  PageHeaderValidationItem,
  HeaderValidationTableRow,
  HeaderItemStatus,
  LanguageSwitchDetail,
  CrawlUrlItem,
} from '../../src/types';
import { StoredCrawlSession } from '../services/crawlStore';
import {
  CANONICAL_LANGUAGES,
  LANGUAGE_SLUG_ALIASES,
  getCanonicalLanguage,
  normalizeLanguageCode,
} from '../../src/utils/canonicalLanguage';
import { normalizeUrl, isAssetUrl, isHttpProtocol, hasIgnoredSlug } from '../crawler/urlNormalizer';
import { getEffectiveIgnoredSlugs } from '../services/settingsStore';

/**
 * Match text or code to known canonical language
 */
export function identifyLanguage(textOrCode: string): { code: string; name: string } | null {
  if (!textOrCode) return null;
  const clean = textOrCode.trim().toLowerCase();
  const canonical = getCanonicalLanguage(clean);
  if (canonical.isKnown) {
    return { code: canonical.code, name: canonical.name };
  }
  return null;
}

interface RawHeaderExtraction {
  detected: boolean;
  confidence: number;
  rawUrls: string[];
  selectorTag?: string;
  hasLogo: boolean;
  isSticky: boolean;
}

interface RawLanguageSelectorExtraction {
  detected: boolean;
  confidence: number;
  type: 'select' | 'custom_dropdown' | 'direct_links' | 'none';
  options: {
    text: string;
    code?: string;
    name: string;
    href?: string;
    selector?: string;
    value?: string;
  }[];
}

/**
 * Options for running Header & Language Navigation validation
 */
export interface HeaderValidationOptions {
  maxPages?: number | 'all';
  specificUrls?: string[];
  timeoutMs?: number;
}

import { shouldIgnoreUrl } from '../services/domainSettingsStore';

export class HeaderValidator {
  /**
   * Main entry point to validate header & language navigation on a crawl session using Playwright
   */
  public async validate(
    session: StoredCrawlSession,
    options: HeaderValidationOptions = {}
  ): Promise<HeaderValidationResult> {
    const baseOrigin = session.normalizedDomain;
    const ignoredUrls: string[] = [];
    const ignoredRows: HeaderValidationTableRow[] = [];

    // Collect candidate pages from crawl session evaluating shouldIgnoreUrl
    const allSessionItems: CrawlUrlItem[] = [];
    let pagesIgnored = 0;

    for (const item of session.items.values()) {
      if (item.status !== 200) continue;

      const ignoreCheck = shouldIgnoreUrl(item, 'headerLanguage', session);
      if (ignoreCheck.ignored) {
        pagesIgnored++;
        ignoredUrls.push(item.normalizedUrl);
        ignoredRows.push({
          id: `ignored-${item.normalizedUrl}-${Date.now()}`,
          page: item.normalizedUrl,
          canonicalPath: item.canonicalPath,
          device: 'Desktop',
          validation: 'Header URLs',
          validationType: 'header_urls',
          expected: 'Excluded by rule',
          actual: 'Ignored',
          status: 'ignored',
          statusLabel: 'IGNORED',
          reason: ignoreCheck.reason || 'Excluded by rule',
          ignoreReason: ignoreCheck.reason || 'Excluded by rule',
        });
      } else {
        allSessionItems.push(item);
      }
    }

    if (allSessionItems.length === 0) {
      const empty = this.createEmptyResult();
      empty.pagesIgnored = pagesIgnored;
      empty.ignoredCount = pagesIgnored;
      empty.ignoredUrls = ignoredUrls;
      empty.tableRows = ignoredRows;
      return empty;
    }

    // Determine target URLs to validate
    let targetItems = allSessionItems;
    if (options.specificUrls && options.specificUrls.length > 0) {
      const urlSet = new Set(options.specificUrls);
      targetItems = allSessionItems.filter((i) => urlSet.has(i.normalizedUrl) || urlSet.has(i.url));
    } else if (typeof options.maxPages === 'number' && options.maxPages > 0) {
      // Prioritize English/default pages, then unique canonical paths
      const englishItems = allSessionItems.filter((i) => i.isEnglish);
      const otherItems = allSessionItems.filter((i) => !i.isEnglish);
      const combined = [...englishItems, ...otherItems];
      targetItems = combined.slice(0, options.maxPages);
    }

    // Check if the site is single-language
    const totalLanguagesInCrawl = Object.keys(session.stats.languageCounts || {}).length;
    const isSingleLanguage = totalLanguagesInCrawl <= 1;

    let browser: Browser | null = null;
    const pageResults: PageHeaderValidationItem[] = [];
    const tableRows: HeaderValidationTableRow[] = [...ignoredRows];

    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
        ],
      });

      // Process target pages
      for (const item of targetItems) {
        const pageUrl = item.normalizedUrl || item.url;
        const pageValidation = await this.validateSinglePage(
          browser,
          pageUrl,
          item.canonicalPath,
          baseOrigin,
          session,
          [],
          isSingleLanguage
        );

        pageResults.push(pageValidation.pageItem);
        tableRows.push(...pageValidation.rows);
      }
    } catch (err: any) {
      console.error('Playwright header validation failure:', err);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    const summary = this.summarizeResults(pageResults, tableRows, session, isSingleLanguage);
    summary.pagesIgnored = pagesIgnored;
    summary.ignoredCount = pagesIgnored;
    summary.ignoredUrls = ignoredUrls;
    return summary;
  }

  /**
   * Validate a single page on both Desktop and Mobile viewports
   */
  private async validateSinglePage(
    browser: Browser,
    pageUrl: string,
    canonicalPath: string,
    baseOrigin: string,
    session: StoredCrawlSession,
    ignoredSlugs: string[],
    isSingleLanguage: boolean
  ): Promise<{ pageItem: PageHeaderValidationItem; rows: HeaderValidationTableRow[] }> {
    const rows: HeaderValidationTableRow[] = [];

    let desktopHeaderUrls: string[] = [];
    let desktopHeaderConfidence = 0;
    let desktopHeaderDetected = false;

    let mobileHeaderUrls: string[] = [];
    let mobileHeaderConfidence = 0;
    let mobileHeaderDetected = false;
    let mobileMenuOpened = false;

    let desktopSelectorDetected = false;
    let desktopSelectorConfidence = 0;
    let mobileSelectorDetected = false;
    let mobileSelectorConfidence = 0;

    const detectedLanguagesSet = new Set<string>();
    const desktopSwitches: LanguageSwitchDetail[] = [];
    const mobileSwitches: LanguageSwitchDetail[] = [];

    // 1. DESKTOP VALIDATION (Viewport: 1280 x 800)
    let desktopContext: BrowserContext | null = null;
    try {
      desktopContext = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });

      // Route filter to speed up execution by aborting media/tracking requests
      await desktopContext.route('**/*', (route) => {
        const req = route.request();
        const type = req.resourceType();
        const url = req.url();
        if (
          ['image', 'media', 'font'].includes(type) ||
          url.includes('google-analytics') ||
          url.includes('googletagmanager') ||
          url.includes('facebook') ||
          url.includes('hotjar')
        ) {
          return route.abort();
        }
        return route.continue();
      });

      const desktopPage = await desktopContext.newPage();
      desktopPage.setDefaultTimeout(10000);

      await desktopPage.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await desktopPage.waitForTimeout(300);

      // A. Extract Desktop Header
      const desktopHeaderData = await this.extractHeaderFromPage(desktopPage);
      desktopHeaderConfidence = desktopHeaderData.confidence;
      desktopHeaderDetected = desktopHeaderData.detected;

      // Filter and normalize links
      desktopHeaderUrls = this.normalizeExtractedUrls(
        desktopHeaderData.rawUrls,
        baseOrigin,
        ignoredSlugs
      );

      // B. Extract Desktop Language Selector & Options
      const desktopLangData = await this.extractLanguageSelectorFromPage(desktopPage);
      desktopSelectorConfidence = desktopLangData.confidence;
      desktopSelectorDetected = desktopLangData.detected;

      for (const opt of desktopLangData.options) {
        detectedLanguagesSet.add(opt.name);
      }

      // C. Test Desktop Language Switches (if multilingual and options found)
      if (!isSingleLanguage && desktopLangData.options.length > 1) {
        for (const opt of desktopLangData.options) {
          const switchResult = await this.testLanguageSwitchOnPage(
            desktopPage,
            pageUrl,
            canonicalPath,
            opt,
            session,
            baseOrigin
          );
          desktopSwitches.push(switchResult);

          rows.push({
            id: `desktop-lang-${pageUrl}-${opt.code || opt.name}-${Math.random().toString(36).substring(2, 7)}`,
            page: pageUrl,
            canonicalPath,
            device: 'Desktop',
            validation: 'Language Switch',
            validationType: 'language_switch',
            language: opt.name,
            languageCode: opt.code,
            expected: switchResult.expectedUrl,
            actual: switchResult.actualUrl,
            status: switchResult.status,
            statusLabel: switchResult.statusLabel,
            reason: switchResult.reason,
            translatedExists: switchResult.translatedPageExists,
          });

          // Always return to original page between tests
          await desktopPage.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
          await desktopPage.waitForTimeout(200);
        }
      }
    } catch (err) {
      console.warn(`Desktop validation error on ${pageUrl}:`, err);
    } finally {
      if (desktopContext) {
        await desktopContext.close().catch(() => {});
      }
    }

    // 2. MOBILE VALIDATION (Viewport: 390 x 844 - iPhone / Android mobile emulation)
    let mobileContext: BrowserContext | null = null;
    try {
      mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
      });

      await mobileContext.route('**/*', (route) => {
        const req = route.request();
        const type = req.resourceType();
        const url = req.url();
        if (
          ['image', 'media', 'font'].includes(type) ||
          url.includes('google-analytics') ||
          url.includes('googletagmanager')
        ) {
          return route.abort();
        }
        return route.continue();
      });

      const mobilePage = await mobileContext.newPage();
      mobilePage.setDefaultTimeout(10000);

      await mobilePage.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await mobilePage.waitForTimeout(300);

      // A. Try opening mobile menu if present
      mobileMenuOpened = await this.tryOpenMobileMenu(mobilePage);

      // B. Extract Mobile Header
      const mobileHeaderData = await this.extractHeaderFromPage(mobilePage, true);
      mobileHeaderConfidence = mobileHeaderData.confidence;
      mobileHeaderDetected = mobileHeaderData.detected;

      mobileHeaderUrls = this.normalizeExtractedUrls(
        mobileHeaderData.rawUrls,
        baseOrigin,
        ignoredSlugs
      );

      // C. Extract Mobile Language Selector & Options
      const mobileLangData = await this.extractLanguageSelectorFromPage(mobilePage);
      mobileSelectorConfidence = mobileLangData.confidence;
      mobileSelectorDetected = mobileLangData.detected;

      for (const opt of mobileLangData.options) {
        detectedLanguagesSet.add(opt.name);
      }

      // D. Test Mobile Language Switches
      if (!isSingleLanguage && mobileLangData.options.length > 1) {
        for (const opt of mobileLangData.options) {
          // If menu was closed during page return, reopen it
          await this.tryOpenMobileMenu(mobilePage);

          const switchResult = await this.testLanguageSwitchOnPage(
            mobilePage,
            pageUrl,
            canonicalPath,
            opt,
            session,
            baseOrigin
          );
          mobileSwitches.push(switchResult);

          rows.push({
            id: `mobile-lang-${pageUrl}-${opt.code || opt.name}-${Math.random().toString(36).substring(2, 7)}`,
            page: pageUrl,
            canonicalPath,
            device: 'Mobile',
            validation: 'Language Switch',
            validationType: 'language_switch',
            language: opt.name,
            languageCode: opt.code,
            expected: switchResult.expectedUrl,
            actual: switchResult.actualUrl,
            status: switchResult.status,
            statusLabel: switchResult.statusLabel,
            reason: switchResult.reason,
            translatedExists: switchResult.translatedPageExists,
          });

          // Return to original page
          await mobilePage.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
          await mobilePage.waitForTimeout(200);
        }
      }
    } catch (err) {
      console.warn(`Mobile validation error on ${pageUrl}:`, err);
    } finally {
      if (mobileContext) {
        await mobileContext.close().catch(() => {});
      }
    }

    // 3. COMPARE DESKTOP VS MOBILE HEADER URLS
    const desktopSet = new Set(desktopHeaderUrls);
    const mobileSet = new Set(mobileHeaderUrls);

    const missingOnMobile = desktopHeaderUrls.filter((u) => !mobileSet.has(u));
    const missingOnDesktop = mobileHeaderUrls.filter((u) => !desktopSet.has(u));

    let headerStatus: HeaderItemStatus = 'passed';
    let headerReason: string | undefined;

    if (desktopHeaderConfidence < 40 || mobileHeaderConfidence < 40) {
      headerStatus = 'needs_review';
      headerReason = `Header detection confidence is low (Desktop: ${desktopHeaderConfidence}%, Mobile: ${mobileHeaderConfidence}%). Needs manual review.`;
    } else if (missingOnMobile.length > 0 || missingOnDesktop.length > 0) {
      headerStatus = 'error';
      const parts: string[] = [];
      if (missingOnMobile.length > 0) {
        parts.push(`Missing on Mobile: ${missingOnMobile.join(', ')}`);
      }
      if (missingOnDesktop.length > 0) {
        parts.push(`Missing on Desktop: ${missingOnDesktop.join(', ')}`);
      }
      headerReason = parts.join(' | ');
    } else {
      headerStatus = 'passed';
      headerReason = `Matching ${desktopHeaderUrls.length} logical navigation URLs between Desktop and Mobile`;
    }

    // Add Header URLs Comparison Table Row
    rows.unshift({
      id: `header-urls-${pageUrl}-${Math.random().toString(36).substring(2, 7)}`,
      page: pageUrl,
      canonicalPath,
      device: 'Mobile',
      validation: 'Header URLs',
      validationType: 'header_urls',
      expected: `${desktopHeaderUrls.length} Desktop URLs`,
      actual: `${mobileHeaderUrls.length} Mobile URLs${missingOnMobile.length > 0 ? ` (Missing ${missingOnMobile.length})` : ''}`,
      status: headerStatus,
      statusLabel: headerStatus === 'passed' ? 'PASS' : headerStatus === 'needs_review' ? 'Needs Review' : 'ERROR',
      reason: headerReason,
      missingOnMobile,
      missingOnDesktop,
      desktopUrls: desktopHeaderUrls,
      mobileUrls: mobileHeaderUrls,
      confidence: Math.round((desktopHeaderConfidence + mobileHeaderConfidence) / 2),
    });

    // If single language, add a SKIPPED entry for language selector
    if (isSingleLanguage) {
      rows.push({
        id: `lang-skip-${pageUrl}`,
        page: pageUrl,
        canonicalPath,
        device: 'Desktop',
        validation: 'Language Selector',
        validationType: 'language_selector_detection',
        language: 'Single Language (English)',
        expected: 'Not Applicable',
        actual: 'Languages Detected: 1',
        status: 'skipped',
        statusLabel: 'SKIPPED',
        reason: 'Single-language website; language selector validation is skipped.',
      });
    }

    const pageItem: PageHeaderValidationItem = {
      url: pageUrl,
      canonicalPath,
      desktopHeaderDetected,
      desktopHeaderConfidence,
      desktopHeaderUrls,
      mobileHeaderDetected,
      mobileHeaderConfidence,
      mobileMenuOpened,
      mobileHeaderUrls,
      missingOnMobile,
      missingOnDesktop,
      headerStatus,
      headerReason,
      desktopSelectorDetected,
      desktopSelectorConfidence,
      mobileSelectorDetected,
      mobileSelectorConfidence,
      detectedLanguages: Array.from(detectedLanguagesSet),
      desktopLanguageSwitches: desktopSwitches,
      mobileLanguageSwitches: mobileSwitches,
    };

    return { pageItem, rows };
  }

  /**
   * Evaluates and extracts header container and navigation URLs from a page
   */
  private async extractHeaderFromPage(page: Page, isMobile = false): Promise<RawHeaderExtraction> {
    try {
      const evaluation = await page.evaluate((mobileFlag) => {
        // Collect candidate elements
        const candidateSelectors = [
          'header',
          '[role="banner"]',
          'nav',
          '[role="navigation"]',
          '#header',
          '#navbar',
          '.header',
          '.site-header',
          '.main-header',
          '.navbar',
          '.top-nav',
          '.navigation',
        ];

        const candidateNodes = Array.from(
          document.querySelectorAll(candidateSelectors.join(','))
        );

        // Also check elements near top of the document if no standard elements found
        if (candidateNodes.length === 0) {
          const bodyChildren = Array.from(document.body.children);
          for (const child of bodyChildren.slice(0, 4)) {
            const rect = child.getBoundingClientRect();
            if (rect.top <= 120 && rect.height >= 30 && child.querySelectorAll('a').length >= 2) {
              candidateNodes.push(child);
            }
          }
        }

        let bestCandidate: Element | null = null;
        let bestScore = 0;

        for (const el of candidateNodes) {
          let score = 0;
          const tagName = el.tagName.toUpperCase();
          const role = (el.getAttribute('role') || '').toLowerCase();
          const className = (el.className || '').toString().toLowerCase();
          const id = (el.id || '').toLowerCase();
          const rect = el.getBoundingClientRect();

          // 1. Tag & Role score
          if (tagName === 'HEADER' || role === 'banner') score += 35;
          if (tagName === 'NAV' || role === 'navigation') score += 25;
          if (id.includes('header') || className.includes('header')) score += 20;
          if (id.includes('navbar') || className.includes('navbar') || className.includes('nav')) score += 15;

          // 2. Position score (near top of viewport)
          if (rect.top >= 0 && rect.top <= 80) score += 20;
          else if (rect.top <= 160) score += 10;

          // 3. Link count & density
          const links = Array.from(el.querySelectorAll('a'));
          if (links.length >= 2) score += 15;
          if (links.length >= 4) score += 10;

          // 4. Logo / Home link present
          const hasHomeOrLogo = links.some((a) => {
            const href = a.getAttribute('href') || '';
            const text = (a.textContent || '').toLowerCase();
            const hasImg = a.querySelector('img, svg');
            return href === '/' || href === '' || hasImg || text.includes('home') || text.includes('logo');
          });
          if (hasHomeOrLogo) score += 10;

          // 5. Sticky / Fixed styling
          try {
            const style = window.getComputedStyle(el);
            if (style.position === 'sticky' || style.position === 'fixed') {
              score += 10;
            }
          } catch {}

          // 6. Menu button or language selector inside
          if (el.querySelector('button, select, [aria-label*="menu" i], [aria-label*="lang" i]')) {
            score += 10;
          }

          if (score > bestScore) {
            bestScore = score;
            bestCandidate = el;
          }
        }

        // If mobile and menu was opened in drawer / offcanvas, check drawer container
        if (mobileFlag) {
          const mobileDrawers = Array.from(
            document.querySelectorAll(
              '[class*="mobile-menu"], [class*="drawer"], [class*="offcanvas"], [class*="nav-open"], [aria-expanded="true"]'
            )
          );
          for (const drawer of mobileDrawers) {
            const links = Array.from(drawer.querySelectorAll('a'));
            if (links.length >= 2) {
              bestCandidate = drawer;
              bestScore = Math.max(bestScore, 85);
              break;
            }
          }
        }

        if (!bestCandidate) {
          return {
            detected: false,
            confidence: 20,
            rawUrls: [],
            hasLogo: false,
            isSticky: false,
          };
        }

        // Extract all unique raw link hrefs within chosen candidate
        const rawUrls: string[] = [];
        const linkEls = Array.from(bestCandidate.querySelectorAll('a'));

        for (const a of linkEls) {
          const href = a.getAttribute('href');
          if (href) {
            rawUrls.push(href);
          }
        }

        const normalizedConfidence = Math.min(99, Math.max(25, bestScore));

        return {
          detected: normalizedConfidence >= 40,
          confidence: normalizedConfidence,
          rawUrls,
          selectorTag: bestCandidate.tagName.toLowerCase(),
          hasLogo: bestScore >= 40,
          isSticky: false,
        };
      }, isMobile);

      return evaluation;
    } catch (err) {
      return {
        detected: false,
        confidence: 0,
        rawUrls: [],
        hasLogo: false,
        isSticky: false,
      };
    }
  }

  /**
   * Attempts to detect and open mobile hamburger / menu button
   */
  private async tryOpenMobileMenu(page: Page): Promise<boolean> {
    try {
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], a, div'));
        for (const btn of buttons) {
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          const title = (btn.getAttribute('title') || '').toLowerCase();
          const text = (btn.textContent || '').trim().toLowerCase();
          const className = (btn.className || '').toString().toLowerCase();
          const id = (btn.id || '').toLowerCase();

          const isMenuBtn =
            ariaLabel.includes('menu') ||
            ariaLabel.includes('navigation') ||
            ariaLabel.includes('nav') ||
            title.includes('menu') ||
            text === 'menu' ||
            text === 'open menu' ||
            text === 'navigation' ||
            text.includes('☰') ||
            className.includes('hamburger') ||
            className.includes('menu-btn') ||
            className.includes('nav-toggle') ||
            className.includes('navbar-toggler') ||
            id.includes('hamburger') ||
            id.includes('menu-btn');

          if (isMenuBtn) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top <= 200) {
              (btn as HTMLElement).click();
              return true;
            }
          }
        }
        return false;
      });

      if (clicked) {
        await page.waitForTimeout(400);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Detects language selector widget (dropdown, select, or direct links) and options
   */
  private async extractLanguageSelectorFromPage(page: Page): Promise<RawLanguageSelectorExtraction> {
    try {
      const evaluation = await page.evaluate(() => {
        const optionsList: {
          text: string;
          code?: string;
          name: string;
          href?: string;
          selector?: string;
          value?: string;
        }[] = [];

        // 1. Check for standard HTML <select> element
        const selectEls = Array.from(document.querySelectorAll('select'));
        for (const sel of selectEls) {
          const name = (sel.getAttribute('name') || '').toLowerCase();
          const id = (sel.id || '').toLowerCase();
          const aria = (sel.getAttribute('aria-label') || '').toLowerCase();
          const isLangSelect =
            name.includes('lang') ||
            id.includes('lang') ||
            aria.includes('lang') ||
            aria.includes('language');

          const optEls = Array.from(sel.querySelectorAll('option'));
          const hasLangOpts = optEls.some((opt) => {
            const val = (opt.value || '').toLowerCase();
            const txt = (opt.textContent || '').toLowerCase();
            return (
              ['en', 'fr', 'de', 'es', 'it', 'ru', 'pt', 'ar', 'zh', 'ja'].includes(val) ||
              ['english', 'french', 'français', 'german', 'deutsch', 'spanish', 'español'].includes(txt)
            );
          });

          if (isLangSelect || hasLangOpts) {
            for (const opt of optEls) {
              const txt = (opt.textContent || '').trim();
              const val = (opt.value || '').trim();
              if (txt || val) {
                optionsList.push({
                  text: txt,
                  value: val,
                  name: txt || val,
                });
              }
            }

            return {
              detected: true,
              confidence: 95,
              type: 'select' as const,
              options: optionsList,
            };
          }
        }

        // 2. Check for Custom Dropdown or direct language switcher links
        const switcherCandidates = Array.from(
          document.querySelectorAll(
            '[aria-label*="language" i], [aria-label*="lang" i], [data-lang], [data-language], .language-selector, .lang-switcher, .dropdown-language'
          )
        );

        // Also look for links with hreflang
        const hreflangLinks = Array.from(document.querySelectorAll('a[hreflang]'));
        if (hreflangLinks.length >= 2) {
          for (const a of hreflangLinks) {
            const langCode = a.getAttribute('hreflang') || '';
            const txt = (a.textContent || '').trim() || langCode;
            const href = a.getAttribute('href') || '';
            optionsList.push({
              text: txt,
              code: langCode,
              name: txt,
              href,
            });
          }

          return {
            detected: true,
            confidence: 90,
            type: 'direct_links' as const,
            options: optionsList,
          };
        }

        // 3. Scan for dropdown triggers / language buttons with text like "English", "Français", "EN", "FR"
        const buttonsAndLinks = Array.from(
          document.querySelectorAll('button, a, div[role="button"], span.dropdown')
        );

        for (const btn of buttonsAndLinks) {
          const txt = (btn.textContent || '').trim().toLowerCase();
          const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
          const isLangTrigger =
            aria.includes('language') ||
            aria.includes('select language') ||
            txt === 'english' ||
            txt === 'français' ||
            txt === 'deutsch' ||
            txt === 'español' ||
            txt === 'en' ||
            txt === 'fr' ||
            txt === 'de';

          if (isLangTrigger) {
            // Find sibling or nested list / dropdown
            const parent = btn.parentElement;
            if (parent) {
              const dropdownItems = Array.from(parent.querySelectorAll('a, button, li'));
              for (const item of dropdownItems) {
                const itemTxt = (item.textContent || '').trim();
                const itemHref = item.getAttribute('href') || '';
                if (itemTxt && itemTxt.length <= 30) {
                  optionsList.push({
                    text: itemTxt,
                    name: itemTxt,
                    href: itemHref,
                  });
                }
              }

              if (optionsList.length >= 2) {
                return {
                  detected: true,
                  confidence: 85,
                  type: 'custom_dropdown' as const,
                  options: optionsList,
                };
              }
            }
          }
        }

        return {
          detected: false,
          confidence: 0,
          type: 'none' as const,
          options: [],
        };
      });

      // Normalize identified options with language codes & standard names
      const refinedOptions: RawLanguageSelectorExtraction['options'] = [];
      const seenCodes = new Set<string>();

      for (const rawOpt of evaluation.options) {
        const identified =
          identifyLanguage(rawOpt.code || '') ||
          identifyLanguage(rawOpt.text || '') ||
          identifyLanguage(rawOpt.value || '') ||
          identifyLanguage(rawOpt.href || '');

        if (identified) {
          if (!seenCodes.has(identified.code)) {
            seenCodes.add(identified.code);
            refinedOptions.push({
              text: rawOpt.text,
              name: identified.name,
              code: identified.code,
              href: rawOpt.href,
              value: rawOpt.value,
              selector: rawOpt.selector,
            });
          }
        }
      }

      return {
        detected: refinedOptions.length >= 1,
        confidence: evaluation.confidence || (refinedOptions.length > 0 ? 80 : 0),
        type: evaluation.type,
        options: refinedOptions,
      };
    } catch {
      return {
        detected: false,
        confidence: 0,
        type: 'none',
        options: [],
      };
    }
  }

  /**
   * Tests switching to a specific language on the open page
   */
  private async testLanguageSwitchOnPage(
    page: Page,
    currentUrl: string,
    canonicalPath: string,
    targetLanguage: { name: string; code?: string; text: string; value?: string; href?: string },
    session: StoredCrawlSession,
    baseOrigin: string
  ): Promise<LanguageSwitchDetail> {
    const langCode = targetLanguage.code || 'en';
    const langName = targetLanguage.name || 'Unknown';

    // 1. Determine Expected URL from Crawl Session dataset
    // Check if a translated page exists for this canonical path and language code
    let translatedPageExists = false;
    let expectedUrl = currentUrl;
    let expectedBehavior: 'translated_page' | 'english_fallback' = 'translated_page';

    const matchingTranslatedItem = Array.from(session.items.values()).find(
      (item) =>
        item.status === 200 &&
        item.canonicalPath === canonicalPath &&
        (item.langCode === langCode || item.language.toLowerCase() === langName.toLowerCase())
    );

    if (matchingTranslatedItem) {
      translatedPageExists = true;
      expectedUrl = matchingTranslatedItem.normalizedUrl;
      expectedBehavior = 'translated_page';
    } else {
      // If translated page does NOT exist, English fallback is expected behavior
      translatedPageExists = false;
      expectedBehavior = 'english_fallback';
      // Find English canonical URL or use current URL
      const englishItem = Array.from(session.items.values()).find(
        (item) => item.isEnglish && item.canonicalPath === canonicalPath
      );
      expectedUrl = englishItem ? englishItem.normalizedUrl : currentUrl;
    }

    // 2. Perform Language Selection in Browser
    let actualUrl = currentUrl;
    try {
      if (targetLanguage.href) {
        // Direct link navigation
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 4000 }).catch(() => {}),
          page.click(`a[href="${targetLanguage.href}"]`).catch(() => {}),
        ]);
      } else if (targetLanguage.value) {
        // Select option
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 4000 }).catch(() => {}),
          page.selectOption('select', targetLanguage.value).catch(() => {}),
        ]);
      } else {
        // Click text match for language option
        await page.evaluate((targetText) => {
          const els = Array.from(document.querySelectorAll('a, button, li, option'));
          for (const el of els) {
            if ((el.textContent || '').trim().toLowerCase() === targetText.toLowerCase()) {
              (el as HTMLElement).click();
              break;
            }
          }
        }, targetLanguage.text);

        await page.waitForTimeout(600);
      }

      actualUrl = page.url();
    } catch {
      actualUrl = page.url();
    }

    // 3. Evaluate Destination and Status
    const normActual = this.normalizeUrlSimple(actualUrl);
    const normExpected = this.normalizeUrlSimple(expectedUrl);
    const normCurrent = this.normalizeUrlSimple(currentUrl);

    let status: HeaderItemStatus = 'passed';
    let statusLabel = 'PASS';
    let reason: string | undefined;

    if (translatedPageExists) {
      if (normActual === normExpected || actualUrl.includes(`/${langCode}/`)) {
        status = 'passed';
        statusLabel = 'PASS';
        reason = `Successfully navigated to translated page: ${expectedUrl}`;
      } else if (normActual === normCurrent || normActual.endsWith(canonicalPath)) {
        // ERROR: Landed on English page when French translation exists
        status = 'error';
        statusLabel = 'ERROR';
        reason = `${langName} translation exists (${expectedUrl}) but language selector landed on English page (${actualUrl}).`;
      } else {
        // Check if landed on different language or wrong page
        const detectedActualLang = identifyLanguage(actualUrl);
        if (detectedActualLang && detectedActualLang.code !== langCode) {
          status = 'error';
          statusLabel = 'ERROR';
          reason = `Expected ${langName} page (${expectedUrl}) but selector landed on ${detectedActualLang.name} (${actualUrl}).`;
        } else {
          status = 'error';
          statusLabel = 'ERROR';
          reason = `Wrong ${langName} page; canonical path was not preserved. Expected: ${expectedUrl}, Actual: ${actualUrl}.`;
        }
      }
    } else {
      // Translated page does NOT exist; check English fallback
      if (normActual === normExpected || normActual === normCurrent) {
        status = 'passed';
        statusLabel = 'PASS — English fallback';
        reason = `${langName} translation does not exist. Correctly fell back to English page: ${actualUrl}.`;
      } else {
        status = 'warning';
        statusLabel = 'WARNING';
        reason = `${langName} translation does not exist, but selector navigated away to ${actualUrl}.`;
      }
    }

    return {
      language: langName,
      languageCode: langCode,
      translatedPageExists,
      expectedUrl,
      expectedBehavior,
      actualUrl,
      status,
      statusLabel,
      reason,
    };
  }

  /**
   * Filter and normalize an array of raw extracted href URLs
   */
  private normalizeExtractedUrls(
    rawUrls: string[],
    baseOrigin: string,
    ignoredSlugs: string[]
  ): string[] {
    const validUrls = new Set<string>();

    for (const raw of rawUrls) {
      if (!raw || typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (!isHttpProtocol(trimmed)) continue;
      if (isAssetUrl(trimmed)) continue;

      const normResult = normalizeUrl(trimmed, baseOrigin, { ignoredSlugs });
      if (normResult && !normResult.isExternal && !normResult.isAsset && !normResult.isIgnoredSlug) {
        // Extract logical pathname / normalized URL
        try {
          const parsed = new URL(normResult.normalizedUrl);
          const path = parsed.pathname === '' ? '/' : parsed.pathname;
          validUrls.add(path);
        } catch {
          validUrls.add(normResult.normalizedUrl);
        }
      }
    }

    return Array.from(validUrls).sort();
  }

  /**
   * Simple URL path normalizer for string comparisons
   */
  private normalizeUrlSimple(urlStr: string): string {
    try {
      const parsed = new URL(urlStr);
      let path = parsed.pathname.toLowerCase();
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      return path;
    } catch {
      return urlStr.trim().toLowerCase();
    }
  }

  /**
   * Summarize overall validation statistics
   */
  private summarizeResults(
    pageResults: PageHeaderValidationItem[],
    tableRows: HeaderValidationTableRow[],
    session: StoredCrawlSession,
    isSingleLanguage: boolean
  ): HeaderValidationResult {
    let desktopHeaderDetectedCount = 0;
    let mobileHeaderDetectedCount = 0;
    let headerMatchingCount = 0;
    let headerMismatchCount = 0;
    let headerNeedsReviewCount = 0;

    let desktopLangPass = 0;
    let desktopLangErrors = 0;
    let desktopLangSkipped = 0;
    let desktopLangNeedsReview = 0;

    let mobileLangPass = 0;
    let mobileLangErrors = 0;
    let mobileLangSkipped = 0;
    let mobileLangNeedsReview = 0;

    for (const p of pageResults) {
      if (p.desktopHeaderDetected) desktopHeaderDetectedCount++;
      if (p.mobileHeaderDetected) mobileHeaderDetectedCount++;

      if (p.headerStatus === 'passed') headerMatchingCount++;
      else if (p.headerStatus === 'error') headerMismatchCount++;
      else if (p.headerStatus === 'needs_review') headerNeedsReviewCount++;

      for (const sw of p.desktopLanguageSwitches) {
        if (sw.status === 'passed') desktopLangPass++;
        else if (sw.status === 'error') desktopLangErrors++;
        else if (sw.status === 'skipped') desktopLangSkipped++;
        else if (sw.status === 'needs_review') desktopLangNeedsReview++;
      }

      for (const sw of p.mobileLanguageSwitches) {
        if (sw.status === 'passed') mobileLangPass++;
        else if (sw.status === 'error') mobileLangErrors++;
        else if (sw.status === 'skipped') mobileLangSkipped++;
        else if (sw.status === 'needs_review') mobileLangNeedsReview++;
      }
    }

    if (isSingleLanguage) {
      desktopLangSkipped += pageResults.length;
      mobileLangSkipped += pageResults.length;
    }

    const totalLangPass = desktopLangPass + mobileLangPass;
    const totalLangErrors = desktopLangErrors + mobileLangErrors;
    const totalLangSkipped = desktopLangSkipped + mobileLangSkipped;
    const totalNeedsReview = headerNeedsReviewCount + desktopLangNeedsReview + mobileLangNeedsReview;

    let overallStatus: HeaderValidationResult['overallStatus'] = 'passed';
    if (headerMismatchCount > 0 || totalLangErrors > 0) {
      overallStatus = 'error';
    } else if (headerNeedsReviewCount > 0 || totalNeedsReview > 0) {
      overallStatus = 'warning';
    } else if (isSingleLanguage && pageResults.length > 0 && headerMismatchCount === 0) {
      overallStatus = 'passed';
    }

    let headerOverallStatus: HeaderValidationResult['headerStatus'] = 'passed';
    if (headerMismatchCount > 0) headerOverallStatus = 'error';
    else if (headerNeedsReviewCount > 0) headerOverallStatus = 'needs_review';

    const languagesAvailable = Object.values(session.stats.languageCounts || {}).map((l) => l.name);

    return {
      pagesChecked: pageResults.length,
      desktopHeaderDetectedCount,
      mobileHeaderDetectedCount,
      headerMatchingCount,
      headerMismatchCount,
      headerNeedsReviewCount,
      headerStatus: headerOverallStatus,
      languageNavigation: {
        desktop: {
          passed: desktopLangPass,
          errors: desktopLangErrors,
          skipped: desktopLangSkipped,
          needsReview: desktopLangNeedsReview,
        },
        mobile: {
          passed: mobileLangPass,
          errors: mobileLangErrors,
          skipped: mobileLangSkipped,
          needsReview: mobileLangNeedsReview,
        },
      },
      totalLanguagePass: totalLangPass,
      totalLanguageErrors: totalLangErrors,
      totalLanguageSkipped: totalLangSkipped,
      totalNeedsReview,
      overallStatus,
      pageResults,
      tableRows,
      languagesAvailable,
      isSingleLanguage,
    };
  }

  private createEmptyResult(): HeaderValidationResult {
    return {
      pagesChecked: 0,
      desktopHeaderDetectedCount: 0,
      mobileHeaderDetectedCount: 0,
      headerMatchingCount: 0,
      headerMismatchCount: 0,
      headerNeedsReviewCount: 0,
      headerStatus: 'passed',
      languageNavigation: {
        desktop: { passed: 0, errors: 0, skipped: 0, needsReview: 0 },
        mobile: { passed: 0, errors: 0, skipped: 0, needsReview: 0 },
      },
      totalLanguagePass: 0,
      totalLanguageErrors: 0,
      totalLanguageSkipped: 0,
      totalNeedsReview: 0,
      overallStatus: 'skipped',
      pageResults: [],
      tableRows: [],
      languagesAvailable: [],
      isSingleLanguage: true,
    };
  }
}

export const headerValidator = new HeaderValidator();
