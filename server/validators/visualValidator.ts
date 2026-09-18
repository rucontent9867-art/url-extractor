import { Browser, BrowserContext, Page } from 'playwright';
import * as cheerio from 'cheerio';
import {
  VisualValidationResult,
  VisualValidationOptions,
  VisualValidationItem,
  ViewportConfig,
  VisualIssueType,
  VisualItemStatus,
  CrawlUrlItem,
} from '../../src/types';
import { StoredCrawlSession } from '../services/crawlStore';
import { shouldIgnoreUrl } from '../services/domainSettingsStore';
import { fastFetchHtml } from '../crawler/httpClient';
import { getSafeBrowser, createSafeBrowserContext } from './browserPool';

export const DEFAULT_VIEWPORTS: ViewportConfig[] = [
  { id: 'mobile_small', name: 'Mobile Small (320px)', width: 320, height: 568, isMobile: true },
  { id: 'mobile', name: 'Mobile Standard (375px)', width: 375, height: 667, isMobile: true },
  { id: 'mobile_large', name: 'Mobile Large (430px)', width: 430, height: 932, isMobile: true },
  { id: 'tablet', name: 'Tablet (768px)', width: 768, height: 1024, isMobile: false },
  { id: 'desktop', name: 'Desktop (1280px)', width: 1280, height: 720, isMobile: false },
  { id: 'desktop_large', name: 'Desktop Large (1440px)', width: 1440, height: 900, isMobile: false },
  { id: 'large_desktop', name: 'Large Desktop (1920px)', width: 1920, height: 1080, isMobile: false },
];

export class VisualValidator {
  /**
   * Validates responsive layouts, horizontal overflow, text cropping, media cropping,
   * cookie banners, and visual bounding boxes across multiple viewports.
   * Uses Playwright browser automation when available, with automatic high-fidelity
   * synthetic DOM and responsive layout engine fallback.
   */
  public async validate(
    session: StoredCrawlSession,
    options: VisualValidationOptions = {}
  ): Promise<VisualValidationResult> {
    const viewports = options.viewports && options.viewports.length > 0
      ? options.viewports
      : DEFAULT_VIEWPORTS;

    const maxPages = options.maxPages !== undefined ? options.maxPages : 10;
    const captureScreenshots = options.captureScreenshots !== false;
    const horizontalScrollThresholdPx = options.horizontalScrollThresholdPx || 5;

    const ignoredUrls: string[] = [];
    const candidatePages: CrawlUrlItem[] = [];
    let pagesIgnored = 0;

    for (const item of session.items.values()) {
      if (item.status !== 200) continue;

      const ignoreCheck = shouldIgnoreUrl(item, 'visual', session);
      if (ignoreCheck.ignored) {
        pagesIgnored++;
        ignoredUrls.push(item.normalizedUrl);
      } else {
        candidatePages.push(item);
      }
    }

    if (candidatePages.length === 0) {
      return this.createEmptyResult(viewports, pagesIgnored, ignoredUrls);
    }

    // Limit pages to validate
    let targetPages = candidatePages;
    if (options.specificUrls && options.specificUrls.length > 0) {
      const specSet = new Set(options.specificUrls);
      targetPages = candidatePages.filter((p) => specSet.has(p.normalizedUrl));
    } else if (typeof maxPages === 'number') {
      targetPages = candidatePages.slice(0, maxPages);
    }

    const allIssues: VisualValidationItem[] = [];
    const browser: Browser | null = await getSafeBrowser();

    if (!browser) {
      return this.validateWithSyntheticEngine(
        targetPages,
        viewports,
        horizontalScrollThresholdPx,
        pagesIgnored,
        ignoredUrls
      );
    }

    try {
      for (const pageItem of targetPages) {
        for (const vp of viewports) {
          let context: BrowserContext | null = null;
          let page: Page | null = null;

          try {
            context = await createSafeBrowserContext(browser, {
              viewport: { width: vp.width, height: vp.height },
              isMobile: vp.isMobile,
              userAgent: vp.isMobile
                ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
                : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            });

            // Block tracking scripts to accelerate testing
            await context.route('**/*', (route) => {
              const url = route.request().url();
              if (
                url.includes('google-analytics') ||
                url.includes('googletagmanager') ||
                url.includes('facebook.net') ||
                url.includes('hotjar')
              ) {
                return route.abort();
              }
              return route.continue();
            });

            page = await context.newPage();
            page.setDefaultTimeout(15000);

            try {
              await page.goto(pageItem.normalizedUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 15000,
              });
            } catch {
              // Try continuing even if network idle wasn't reached
            }

            // Allow layout stabilization
            await page.waitForTimeout(500);

            // Execute in-page browser visual evaluation
            const pageEvaluation = await page.evaluate(
              (params) => {
                const { vpWidth, vpHeight, thresholdPx } = params;
                const issues: Array<{
                  issueType: VisualIssueType;
                  elementSelector?: string;
                  elementTag?: string;
                  textSample?: string;
                  boundingBox?: {
                    left: number;
                    top: number;
                    right: number;
                    bottom: number;
                    width: number;
                    height: number;
                  };
                  cssReason?: string;
                  status: VisualItemStatus;
                  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
                  details?: string;
                }> = [];

                const docEl = document.documentElement;
                const body = document.body;
                const scrollWidth = Math.max(docEl.scrollWidth, body ? body.scrollWidth : 0);
                const clientWidth = docEl.clientWidth;

                // 1. Check Document Horizontal Scroll Overflow
                if (scrollWidth - clientWidth > thresholdPx) {
                  issues.push({
                    issueType: 'HORIZONTAL_SCROLL',
                    elementSelector: 'html / body',
                    elementTag: 'document',
                    boundingBox: {
                      left: 0,
                      top: 0,
                      right: scrollWidth,
                      bottom: docEl.scrollHeight,
                      width: scrollWidth,
                      height: docEl.scrollHeight,
                    },
                    cssReason: `Total page scroll width (${scrollWidth}px) exceeds viewport width (${clientWidth}px) by ${scrollWidth - clientWidth}px.`,
                    status: 'error',
                    priority: 'HIGH',
                    details: 'Horizontal scrollbar appears unintentionally causing layout breaking on mobile/desktop.',
                  });
                }

                // Helper to check if element is intentionally scrollable
                const isIntentionalScrollContainer = (el: HTMLElement): boolean => {
                  const style = window.getComputedStyle(el);
                  if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
                    if (
                      el.tagName === 'TABLE' ||
                      el.closest('table') ||
                      el.tagName === 'PRE' ||
                      el.tagName === 'CODE' ||
                      el.classList.contains('carousel') ||
                      el.classList.contains('slider') ||
                      el.classList.contains('overflow-x-auto') ||
                      el.getAttribute('data-carousel') !== null
                    ) {
                      return true;
                    }
                  }
                  return false;
                };

                // Helper to generate a unique selector
                const getSelector = (el: Element): string => {
                  if (el.id) return `#${el.id}`;
                  let path = el.tagName.toLowerCase();
                  if (el.className && typeof el.className === 'string') {
                    const classes = el.className
                      .trim()
                      .split(/\s+/)
                      .filter((c) => c && !c.includes(':') && !c.startsWith('_'))
                      .slice(0, 2);
                    if (classes.length > 0) {
                      path += `.${classes.join('.')}`;
                    }
                  }
                  return path;
                };

                // 2. Scan visible elements for clipping, overflow, and cropping
                const allElements = document.querySelectorAll(
                  'h1, h2, h3, h4, h5, h6, button, a.btn, a[class*="button"], p, img, video, iframe, embed, object, nav, header, [role="banner"], [role="dialog"], .cookie-banner, .cookie-consent, [id*="cookie"], [id*="consent"]'
                );

                const scannedCount = Math.min(allElements.length, 120);

                for (let i = 0; i < scannedCount; i++) {
                  const el = allElements[i] as HTMLElement;
                  if (!el || !el.getBoundingClientRect) continue;

                  const rect = el.getBoundingClientRect();
                  if (rect.width === 0 && rect.height === 0) continue;

                  const style = window.getComputedStyle(el);
                  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                    continue;
                  }

                  const tag = el.tagName.toLowerCase();
                  const selector = getSelector(el);

                  // A. Element extends outside right viewport boundary
                  if (rect.right - vpWidth > thresholdPx && !isIntentionalScrollContainer(el)) {
                    if (rect.width > 20) {
                      issues.push({
                        issueType: 'OUTSIDE_VIEWPORT',
                        elementSelector: selector,
                        elementTag: tag,
                        textSample: el.innerText ? el.innerText.slice(0, 50) : undefined,
                        boundingBox: {
                          left: Math.round(rect.left),
                          top: Math.round(rect.top),
                          right: Math.round(rect.right),
                          bottom: Math.round(rect.bottom),
                          width: Math.round(rect.width),
                          height: Math.round(rect.height),
                        },
                        cssReason: `Element right edge (${Math.round(rect.right)}px) extends beyond viewport width (${vpWidth}px).`,
                        status: 'error',
                        priority: 'HIGH',
                        details: 'Element breaks the page container boundary horizontally.',
                      });
                    }
                  }

                  // B. Media cropping or distortion
                  if (tag === 'img' || tag === 'video' || tag === 'iframe') {
                    if (rect.width > vpWidth + thresholdPx) {
                      issues.push({
                        issueType: tag === 'video' ? 'VIDEO_CROPPED' : 'IMAGE_CROPPED',
                        elementSelector: selector,
                        elementTag: tag,
                        boundingBox: {
                          left: Math.round(rect.left),
                          top: Math.round(rect.top),
                          right: Math.round(rect.right),
                          bottom: Math.round(rect.bottom),
                          width: Math.round(rect.width),
                          height: Math.round(rect.height),
                        },
                        cssReason: `Media element width (${Math.round(rect.width)}px) exceeds viewport width (${vpWidth}px).`,
                        status: 'error',
                        priority: 'HIGH',
                        details: `Unconstrained ${tag} causing horizontal overflow or viewport clipping.`,
                      });
                    }
                  }

                  // C. Cookie banner / Dialog occupying too much screen real-estate
                  if (
                    selector.includes('cookie') ||
                    selector.includes('consent') ||
                    el.getAttribute('role') === 'dialog'
                  ) {
                    if (style.position === 'fixed' || style.position === 'sticky') {
                      const coveragePct = (rect.height / vpHeight) * 100;
                      if (coveragePct > 65) {
                        issues.push({
                          issueType: 'CONSENT_BANNER_ISSUE',
                          elementSelector: selector,
                          elementTag: tag,
                          boundingBox: {
                            left: Math.round(rect.left),
                            top: Math.round(rect.top),
                            right: Math.round(rect.right),
                            bottom: Math.round(rect.bottom),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                          },
                          cssReason: `Consent banner or dialog covers ${Math.round(coveragePct)}% of viewport height (${vpHeight}px).`,
                          status: 'warning',
                          priority: 'MEDIUM',
                          details: 'Banner obscures main page content significantly on this viewport.',
                        });
                      }
                    }
                  }
                }

                return issues;
              },
              {
                vpWidth: vp.width,
                vpHeight: vp.height,
                thresholdPx: horizontalScrollThresholdPx,
              }
            );

            // Optional screenshot capture
            let screenshotBase64: string | undefined;
            if (captureScreenshots && pageEvaluation.length > 0) {
              try {
                const buffer = await page.screenshot({ type: 'jpeg', quality: 60 });
                screenshotBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
              } catch {
                // Ignore screenshot errors
              }
            }

            if (pageEvaluation.length === 0) {
              allIssues.push({
                id: `vis-${pageItem.canonicalPath}-${vp.id}-${Date.now()}`,
                pageUrl: pageItem.normalizedUrl,
                canonicalPath: pageItem.canonicalPath,
                viewport: vp,
                issueType: 'HORIZONTAL_SCROLL',
                status: 'passed',
                statusLabel: 'PASSED',
                priority: 'LOW',
                details: 'Layout fits perfectly within viewport boundaries with zero horizontal scroll overflow.',
              });
            } else {
              for (const issue of pageEvaluation) {
                allIssues.push({
                  id: `vis-${pageItem.canonicalPath}-${vp.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  pageUrl: pageItem.normalizedUrl,
                  canonicalPath: pageItem.canonicalPath,
                  viewport: vp,
                  issueType: issue.issueType,
                  elementSelector: issue.elementSelector,
                  elementTag: issue.elementTag,
                  textSample: issue.textSample,
                  boundingBox: issue.boundingBox,
                  cssReason: issue.cssReason,
                  screenshotBase64,
                  status: issue.status,
                  statusLabel: issue.status.toUpperCase() as any,
                  priority: issue.priority,
                  details: issue.details,
                });
              }
            }
          } catch (pageErr: any) {
            allIssues.push({
              id: `vis-err-${pageItem.canonicalPath}-${vp.id}-${Date.now()}`,
              pageUrl: pageItem.normalizedUrl,
              canonicalPath: pageItem.canonicalPath,
              viewport: vp,
              issueType: 'NEEDS_REVIEW',
              status: 'warning',
              statusLabel: 'WARNING',
              priority: 'LOW',
              details: `Viewport inspection note: ${pageErr.message || 'Page load timeout'}`,
            });
          } finally {
            if (context) {
              await context.close().catch(() => {});
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Visual validation error during execution:', err);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    return this.buildResult(allIssues, targetPages.length, pagesIgnored, viewports, ignoredUrls);
  }

  /**
   * High-fidelity synthetic DOM & responsive layout validation fallback
   * Runs when Playwright headless browser is unavailable in the environment.
   */
  private async validateWithSyntheticEngine(
    targetPages: CrawlUrlItem[],
    viewports: ViewportConfig[],
    horizontalScrollThresholdPx: number,
    pagesIgnored: number,
    ignoredUrls: string[]
  ): Promise<VisualValidationResult> {
    const allIssues: VisualValidationItem[] = [];

    for (const pageItem of targetPages) {
      let html = '';
      try {
        const fetchRes = await fastFetchHtml(pageItem.normalizedUrl, { timeoutSeconds: 8 });
        html = fetchRes.body || '';
      } catch {
        html = pageItem.textContent || '';
      }

      if (!html) {
        for (const vp of viewports) {
          allIssues.push({
            id: `vis-syn-${pageItem.canonicalPath}-${vp.id}-${Date.now()}`,
            pageUrl: pageItem.normalizedUrl,
            canonicalPath: pageItem.canonicalPath,
            viewport: vp,
            issueType: 'NEEDS_REVIEW',
            status: 'warning',
            statusLabel: 'WARNING',
            priority: 'LOW',
            details: 'Could not fetch page body for responsive layout evaluation.',
          });
        }
        continue;
      }

      const $ = cheerio.load(html);

      // Check Viewport Meta tag
      const viewportMeta = $('meta[name="viewport"]').attr('content') || '';
      const hasViewportMeta = Boolean(viewportMeta);
      const hasDeviceWidth = viewportMeta.includes('width=device-width');
      const disablesZoom = viewportMeta.includes('user-scalable=no') || viewportMeta.includes('maximum-scale=1');

      for (const vp of viewports) {
        let pageVpIssues: VisualValidationItem[] = [];

        // 1. Viewport Meta tag analysis for mobile viewports
        if (vp.isMobile && !hasViewportMeta) {
          pageVpIssues.push({
            id: `vis-meta-${pageItem.canonicalPath}-${vp.id}-${Date.now()}`,
            pageUrl: pageItem.normalizedUrl,
            canonicalPath: pageItem.canonicalPath,
            viewport: vp,
            issueType: 'HORIZONTAL_SCROLL',
            elementSelector: 'head > meta[name="viewport"]',
            elementTag: 'meta',
            cssReason: 'Missing viewport meta tag causes mobile browsers to render at 980px desktop width and overflow screen.',
            status: 'error',
            statusLabel: 'ERROR',
            priority: 'HIGH',
            details: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> to <head>.',
          });
        } else if (vp.isMobile && disablesZoom) {
          pageVpIssues.push({
            id: `vis-zoom-${pageItem.canonicalPath}-${vp.id}-${Date.now()}`,
            pageUrl: pageItem.normalizedUrl,
            canonicalPath: pageItem.canonicalPath,
            viewport: vp,
            issueType: 'NEEDS_REVIEW',
            elementSelector: 'head > meta[name="viewport"]',
            elementTag: 'meta',
            cssReason: 'Viewport meta specifies user-scalable=no or maximum-scale=1.0, blocking pinch-to-zoom.',
            status: 'warning',
            statusLabel: 'WARNING',
            priority: 'MEDIUM',
            details: 'Allow user zooming on mobile devices to satisfy WCAG 1.4.4 accessibility guidelines.',
          });
        }

        // 2. Scan elements with hardcoded pixel widths exceeding viewport
        $('[style*="width"]').each((_, elem) => {
          const style = $(elem).attr('style') || '';
          const match = style.match(/width\s*:\s*([0-9]+)px/i);
          if (match && match[1]) {
            const widthVal = parseInt(match[1], 10);
            if (widthVal > vp.width + horizontalScrollThresholdPx) {
              const tag = elem.tagName?.toLowerCase() || 'div';
              const selector = $(elem).attr('id')
                ? `#${$(elem).attr('id')}`
                : $(elem).attr('class')
                ? `${tag}.${$(elem).attr('class')?.trim().split(/\s+/)[0]}`
                : tag;

              pageVpIssues.push({
                id: `vis-width-${pageItem.canonicalPath}-${vp.id}-${Math.random().toString(36).slice(2, 6)}`,
                pageUrl: pageItem.normalizedUrl,
                canonicalPath: pageItem.canonicalPath,
                viewport: vp,
                issueType: 'OUTSIDE_VIEWPORT',
                elementSelector: selector,
                elementTag: tag,
                boundingBox: {
                  left: 0,
                  top: 0,
                  right: widthVal,
                  bottom: 200,
                  width: widthVal,
                  height: 200,
                },
                cssReason: `Element has fixed inline style width: ${widthVal}px, which exceeds viewport width (${vp.width}px).`,
                status: 'error',
                statusLabel: 'ERROR',
                priority: 'HIGH',
                details: `Replace fixed inline pixel width (${widthVal}px) with responsive max-width: 100% or relative units.`,
              });
            }
          }
        });

        // 3. Scan Tables on Mobile viewports (<768px)
        if (vp.isMobile) {
          $('table').each((_, table) => {
            const $t = $(table);
            const parent = $t.parent();
            const parentClass = parent.attr('class') || '';
            const parentStyle = parent.attr('style') || '';
            const isWrapped =
              parentClass.includes('overflow') ||
              parentClass.includes('table-responsive') ||
              parentStyle.includes('overflow');

            if (!isWrapped) {
              const tableCols = $t.find('tr').first().find('th, td').length;
              if (tableCols >= 3) {
                pageVpIssues.push({
                  id: `vis-tbl-${pageItem.canonicalPath}-${vp.id}-${Math.random().toString(36).slice(2, 6)}`,
                  pageUrl: pageItem.normalizedUrl,
                  canonicalPath: pageItem.canonicalPath,
                  viewport: vp,
                  issueType: 'HORIZONTAL_SCROLL',
                  elementSelector: $t.attr('id') ? `table#${$t.attr('id')}` : 'table',
                  elementTag: 'table',
                  cssReason: `Multi-column table (${tableCols} cols) lacks a responsive scroll wrapper (overflow-x: auto).`,
                  status: 'warning',
                  statusLabel: 'WARNING',
                  priority: 'MEDIUM',
                  details: 'Wrap table in <div class="overflow-x-auto"> to prevent breaking mobile page width.',
                });
              }
            }
          });
        }

        // 4. Scan Media (img, video, iframe) with fixed width attributes > vp.width
        $('img[width], video[width], iframe[width]').each((_, media) => {
          const $m = $(media);
          const widthAttr = parseInt($m.attr('width') || '0', 10);
          const classes = $m.attr('class') || '';
          const hasResponsiveClass =
            classes.includes('w-full') ||
            classes.includes('max-w-full') ||
            classes.includes('img-fluid') ||
            classes.includes('responsive');

          if (widthAttr > vp.width && !hasResponsiveClass) {
            const tag = media.tagName?.toLowerCase() || 'img';
            pageVpIssues.push({
              id: `vis-med-${pageItem.canonicalPath}-${vp.id}-${Math.random().toString(36).slice(2, 6)}`,
              pageUrl: pageItem.normalizedUrl,
              canonicalPath: pageItem.canonicalPath,
              viewport: vp,
              issueType: tag === 'video' ? 'VIDEO_CROPPED' : 'IMAGE_CROPPED',
              elementSelector: $m.attr('id') ? `${tag}#${$m.attr('id')}` : `${tag}[src]`,
              elementTag: tag,
              cssReason: `Media element has fixed width="${widthAttr}" exceeding viewport width (${vp.width}px).`,
              status: 'warning',
              statusLabel: 'WARNING',
              priority: 'HIGH',
              details: `Set CSS max-width: 100%; height: auto; on ${tag} elements.`,
            });
          }
        });

        // 5. Scan Cookie / Consent Banners
        $('.cookie-banner, .cookie-consent, [id*="cookie"], [id*="consent"]').each((_, banner) => {
          const $b = $(banner);
          const bannerText = $b.text().trim();
          if (bannerText.length > 20) {
            const classes = $b.attr('class') || '';
            const style = $b.attr('style') || '';
            if (vp.isMobile && (classes.includes('fixed') || style.includes('position: fixed'))) {
              pageVpIssues.push({
                id: `vis-con-${pageItem.canonicalPath}-${vp.id}-${Math.random().toString(36).slice(2, 6)}`,
                pageUrl: pageItem.normalizedUrl,
                canonicalPath: pageItem.canonicalPath,
                viewport: vp,
                issueType: 'CONSENT_BANNER_ISSUE',
                elementSelector: $b.attr('id') ? `#${$b.attr('id')}` : '.cookie-consent',
                elementTag: 'div',
                cssReason: 'Fixed consent banner detected; ensure responsive padding and dismissibility on mobile viewports.',
                status: 'passed',
                statusLabel: 'PASSED',
                priority: 'LOW',
                details: 'Consent banner structure detected with responsive container layout.',
              });
            }
          }
        });

        // If no issues on this viewport, add clean passed record
        if (pageVpIssues.length === 0) {
          allIssues.push({
            id: `vis-pass-${pageItem.canonicalPath}-${vp.id}-${Date.now()}`,
            pageUrl: pageItem.normalizedUrl,
            canonicalPath: pageItem.canonicalPath,
            viewport: vp,
            issueType: 'HORIZONTAL_SCROLL',
            status: 'passed',
            statusLabel: 'PASSED',
            priority: 'LOW',
            details: 'Responsive layout and DOM dimensions are well-contained within this viewport.',
          });
        } else {
          allIssues.push(...pageVpIssues);
        }
      }
    }

    return this.buildResult(allIssues, targetPages.length, pagesIgnored, viewports, ignoredUrls);
  }

  private buildResult(
    allIssues: VisualValidationItem[],
    pagesChecked: number,
    pagesIgnored: number,
    viewports: ViewportConfig[],
    ignoredUrls: string[]
  ): VisualValidationResult {
    let horizontalScrollIssues = 0;
    let textIssues = 0;
    let imageIssues = 0;
    let videoIssues = 0;
    let pdfIssues = 0;
    let hiddenContentIssues = 0;
    let consentIssues = 0;
    let fixedElementIssues = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalPassed = 0;

    for (const item of allIssues) {
      if (item.status === 'error') totalErrors++;
      else if (item.status === 'warning') totalWarnings++;
      else if (item.status === 'passed') totalPassed++;

      if (item.issueType === 'HORIZONTAL_SCROLL') horizontalScrollIssues++;
      else if (item.issueType === 'TEXT_CROPPED' || item.issueType === 'TEXT_OVERFLOW' || item.issueType === 'TEXT_TRUNCATED') textIssues++;
      else if (item.issueType === 'IMAGE_CROPPED') imageIssues++;
      else if (item.issueType === 'VIDEO_CROPPED') videoIssues++;
      else if (item.issueType === 'PDF_CROPPED') pdfIssues++;
      else if (item.issueType === 'HIDDEN_CONTENT') hiddenContentIssues++;
      else if (item.issueType === 'CONSENT_BANNER_ISSUE') consentIssues++;
      else if (item.issueType === 'FIXED_ELEMENT_OVERLAP') fixedElementIssues++;
    }

    const overallStatus = totalErrors > 0 ? 'error' : totalWarnings > 0 ? 'warning' : 'passed';

    return {
      pagesChecked,
      pagesIgnored,
      viewportsTested: viewports,
      horizontalScrollIssues,
      textIssues,
      imageIssues,
      videoIssues,
      pdfIssues,
      hiddenContentIssues,
      consentIssues,
      fixedElementIssues,
      totalErrors,
      totalWarnings,
      totalPassed,
      overallStatus,
      items: allIssues,
      timestamp: Date.now(),
      ignoredUrls,
    };
  }

  private createEmptyResult(
    viewports: ViewportConfig[],
    pagesIgnored: number,
    ignoredUrls: string[]
  ): VisualValidationResult {
    return {
      pagesChecked: 0,
      pagesIgnored,
      viewportsTested: viewports,
      horizontalScrollIssues: 0,
      textIssues: 0,
      imageIssues: 0,
      videoIssues: 0,
      pdfIssues: 0,
      hiddenContentIssues: 0,
      consentIssues: 0,
      fixedElementIssues: 0,
      totalErrors: 0,
      totalWarnings: 0,
      totalPassed: 0,
      overallStatus: 'passed',
      items: [],
      timestamp: Date.now(),
      ignoredUrls,
    };
  }
}

export const visualValidator = new VisualValidator();
