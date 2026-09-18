import {
  CrawlProgressMessage,
  CrawlSettings,
  CrawlStats,
  CrawlStatusType,
  CrawlUrlItem,
  StatusCategory,
} from '../../src/types';
import { normalizeInputUrl, normalizeUrl, hasIgnoredSlug, isAssetUrl } from './urlNormalizer';
import { detectUrlLanguage } from './languageDetector';
import { getCanonicalPath } from './canonicalPath';
import { fetchAndParseRobotsTxt } from './robots';
import { discoverAllSitemapUrls, DiscoveredSitemapUrl } from './sitemap';
import { parseHtmlPage } from './pageParser';
import { fastFetchHtml } from './httpClient';
import { crawlStore, StoredCrawlSession } from '../services/crawlStore';
import { settingsStore } from '../services/settingsStore';
import { metricsTracker, logger } from '../services/metrics';

function getCategoryForStatus(status: number): StatusCategory {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  if (status === 0 || !status) return 'failed';
  return 'other';
}

export class CrawlerSession {
  public crawlId: string;
  public rawInput: string;
  public baseNormalizedUrl: string;
  public origin: string;
  public hostname: string;
  public settings: CrawlSettings;

  public stats: CrawlStats;

  // Final unique webpage URLs
  public discoveredUrls: Map<string, CrawlUrlItem> = new Map();
  public sitemapUrls: Map<string, DiscoveredSitemapUrl> = new Map();

  // Unified single normalized URL Set for: queued URLs, visited URLs, discovered URLs
  public knownUrls: Set<string> = new Set();
  public visitedUrls: Set<string> = new Set();
  public queue: string[] = [];

  // Dedicated Sets to ensure each duplicate, asset, and external URL is counted ONCE only
  private duplicateUrlsSet: Set<string> = new Set();
  private assetUrlsSet: Set<string> = new Set();
  private externalUrlsSet: Set<string> = new Set();
  private ignoredSlugsSet: Set<string> = new Set();

  private isAborted: boolean = false;
  private abortController: AbortController = new AbortController();
  private listeners: Set<(event: CrawlProgressMessage) => void> = new Set();
  private pendingNewItems: CrawlUrlItem[] = [];
  private broadcastThrottleTimer: NodeJS.Timeout | null = null;
  private disallowedPaths: string[] = [];
  private queueResolvers: Array<() => void> = [];

  constructor(crawlId: string, inputDomain: string, settings?: Partial<CrawlSettings>) {
    this.crawlId = crawlId;
    this.rawInput = inputDomain;

    const normalized = normalizeInputUrl(inputDomain);
    if (!normalized) {
      throw new Error(`Invalid URL or domain: "${inputDomain}". Please enter a valid website domain.`);
    }

    this.baseNormalizedUrl = normalized.normalizedUrl;
    this.origin = normalized.origin;
    this.hostname = normalized.hostname;

    // Load persistent ignored slugs and merge with session settings
    const storedSlugs = settingsStore.getIgnoredSlugs();
    const effectiveSlugs = Array.from(
      new Set([
        ...storedSlugs,
        ...(settings?.ignoredSlugs || []),
      ].map((s) => s.trim().toLowerCase().replace(/^\/+|\/+$/g, '')).filter(Boolean))
    );

    this.ignoredSlugsSet = new Set(effectiveSlugs);

    const crawlMode = settings?.crawlMode || (settings?.targetUrls && settings.targetUrls.length > 0 ? 'url_list' : 'domain');
    const targetUrls = (settings?.targetUrls || []).map((u) => u.trim()).filter(Boolean);

    this.settings = {
      maxPages: settings?.maxPages ?? 100000,
      concurrency: Math.max(1, Math.min(50, settings?.concurrency ?? 30)),
      requestTimeout: Math.max(3, Math.min(60, settings?.requestTimeout ?? 12)),
      respectRobotsTxt: settings?.respectRobotsTxt ?? true,
      followRedirects: settings?.followRedirects ?? true,
      includeSubdomains: settings?.includeSubdomains ?? false,
      userAgent:
        settings?.userAgent ||
        'Mozilla/5.0 (compatible; DomainCrawlerBot/2.0; +https://ai.studio; HighPerformance)',
      confidenceThreshold: settings?.confidenceThreshold ?? 90,
      ignoredSlugs: effectiveSlugs,
      crawlMode,
      targetUrls,
    };

    this.stats = {
      crawlId,
      domain: inputDomain,
      normalizedDomain: this.baseNormalizedUrl,
      status: 'idle',
      crawlMode,
      targetUrlsCount: targetUrls.length,
      pagesCrawled: 0,
      uniqueUrlsCount: 0,
      queueRemaining: 0,
      currentUrl: '',
      duplicatesRemoved: 0,
      assetsIgnored: 0,
      externalUrlsIgnored: 0,
      failedRequests: 0,
      languagesDetected: 0,
      languageCounts: {},
    };

    // Save initial session into crawlStore
    this.syncToStore();
  }

  public syncToStore(): void {
    const sessionRecord: StoredCrawlSession = {
      crawlId: this.crawlId,
      domain: this.rawInput,
      normalizedDomain: this.baseNormalizedUrl,
      origin: this.origin,
      hostname: this.hostname,
      settings: { ...this.settings, ignoredSlugs: Array.from(this.ignoredSlugsSet) },
      stats: { ...this.stats },
      items: this.discoveredUrls,
      sitemapUrls: this.sitemapUrls,
      createdAt: Date.now(),
    };
    crawlStore.setSession(sessionRecord);
  }

  public subscribe(listener: (event: CrawlProgressMessage) => void): () => void {
    this.listeners.add(listener);
    listener({
      type: 'init',
      stats: { ...this.stats },
      newItems: Array.from(this.discoveredUrls.values()),
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcast(
    type: CrawlProgressMessage['type'],
    message?: string,
    forceItemFlush: boolean = false
  ) {
    this.stats.uniqueUrlsCount = this.discoveredUrls.size;
    this.stats.queueRemaining = this.queue.length;
    this.stats.pagesCrawled = this.visitedUrls.size;
    this.stats.duplicatesRemoved = this.duplicateUrlsSet.size;
    this.stats.assetsIgnored = this.assetUrlsSet.size;
    this.stats.externalUrlsIgnored = this.externalUrlsSet.size;

    let itemsToSend: CrawlUrlItem[] | undefined = undefined;
    if (this.pendingNewItems.length > 0 || forceItemFlush) {
      itemsToSend = [...this.pendingNewItems];
      this.pendingNewItems = [];
    }

    const payload: CrawlProgressMessage = {
      type,
      stats: { ...this.stats },
      newItems: itemsToSend,
      message,
    };

    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('Error in crawl listener:', err);
      }
    }

    this.syncToStore();
  }

  private scheduleThrottledBroadcast(type: CrawlProgressMessage['type'] = 'progress') {
    if (this.broadcastThrottleTimer) return;
    this.broadcastThrottleTimer = setTimeout(() => {
      this.broadcastThrottleTimer = null;
      this.broadcast(type);
    }, 150);
  }

  private notifyWorkers(): void {
    while (this.queueResolvers.length > 0) {
      const resolve = this.queueResolvers.shift();
      if (resolve) {
        try {
          resolve();
        } catch {
          // ignore
        }
      }
    }
  }

  private waitForWork(timeoutMs: number = 350): Promise<void> {
    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | null = null;
      const onWake = () => {
        if (timer) clearTimeout(timer);
        resolve();
      };

      timer = setTimeout(() => {
        const idx = this.queueResolvers.indexOf(onWake);
        if (idx !== -1) this.queueResolvers.splice(idx, 1);
        resolve();
      }, timeoutMs);

      this.queueResolvers.push(onWake);
    });
  }

  /**
   * Evaluates a candidate URL.
   * Enforces:
   * 1. Normalization
   * 2. Ignored Slugs check
   * 3. External check
   * 4. Asset check
   * 5. Robots.txt check
   * 6. Single unified knownUrls Set check:
   *    - If yes -> increment duplicate counter only once and discard
   *    - If no -> add to knownUrls, discoveredUrls, and crawl queue
   */
  public processCandidateUrl(
    rawUrl: string,
    parentUrl: string,
    source: CrawlUrlItem['source'],
    depth: number = 0,
    extra?: {
      title?: string;
      textContent?: string;
      contentType?: string;
      inSitemap?: boolean;
      sitemapSource?: string;
    }
  ): boolean {
    if (!rawUrl || this.isAborted) return false;

    // 1. Normalize URL
    const normalized = normalizeUrl(rawUrl, parentUrl, {
      includeSubdomains: this.settings.includeSubdomains,
      ignoredSlugs: this.ignoredSlugsSet,
    });

    if (!normalized) return false;

    // 2. Check External Domains
    if (normalized.isExternal) {
      if (!this.externalUrlsSet.has(normalized.normalizedUrl)) {
        this.externalUrlsSet.add(normalized.normalizedUrl);
        this.stats.externalUrlsIgnored = this.externalUrlsSet.size;
      }
      return false;
    }

    // 4. Check Assets
    if (normalized.isAsset || isAssetUrl(normalized.normalizedUrl)) {
      if (!this.assetUrlsSet.has(normalized.normalizedUrl)) {
        this.assetUrlsSet.add(normalized.normalizedUrl);
        this.stats.assetsIgnored = this.assetUrlsSet.size;
      }
      return false;
    }

    const validUrl = normalized.normalizedUrl;

    // 5. Check Robots.txt
    if (this.isRobotsDisallowed(validUrl)) {
      return false;
    }

    // 6. Check if already discovered / queued / visited in the single unified Set
    if (this.knownUrls.has(validUrl)) {
      // Increment duplicate counter ONLY ONCE for this URL
      if (!this.duplicateUrlsSet.has(validUrl)) {
        this.duplicateUrlsSet.add(validUrl);
        this.stats.duplicatesRemoved = this.duplicateUrlsSet.size;
      }

      // Record parentUrl into discoveredFrom if parent is valid and not self
      const existing = this.discoveredUrls.get(validUrl);
      if (existing) {
        if (parentUrl && parentUrl !== validUrl && !parentUrl.endsWith('.xml')) {
          if (!existing.discoveredFrom) existing.discoveredFrom = [];
          if (!existing.discoveredFrom.includes(parentUrl)) {
            existing.discoveredFrom.push(parentUrl);
          }
        }
        if (existing.source !== source && existing.source !== 'Sitemap + Crawl') {
          existing.source = 'Sitemap + Crawl';
        }
        if (extra?.inSitemap) existing.inSitemap = true;
        if (extra?.sitemapSource && !existing.sitemapSource) existing.sitemapSource = extra.sitemapSource;
      }

      return false;
    }

    // New unique URL discovered!
    this.knownUrls.add(validUrl);

    // Add to discovered unique valid webpage items
    this.addDiscoveredUrl(validUrl, source, 200, depth, extra, parentUrl);

    // Add to queue if under maximum boundary
    if (this.queue.length + this.visitedUrls.size < this.settings.maxPages * 2) {
      this.queue.push(validUrl);
      this.stats.queueRemaining = this.queue.length;
      // Instant zero-delay wake-up for all active worker promises
      this.notifyWorkers();
    }

    return true;
  }

  private addDiscoveredUrl(
    url: string,
    source: CrawlUrlItem['source'],
    status: number = 200,
    depth: number = 0,
    extra?: {
      title?: string;
      textContent?: string;
      contentType?: string;
      inSitemap?: boolean;
      sitemapSource?: string;
    },
    parentUrl?: string
  ): CrawlUrlItem {
    const langInfo = detectUrlLanguage(url);
    const canonical = getCanonicalPath(url);

    const discoveredFrom: string[] = [];
    if (parentUrl && parentUrl !== url && !parentUrl.endsWith('.xml')) {
      discoveredFrom.push(parentUrl);
    }

    const item: CrawlUrlItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      url,
      normalizedUrl: url,
      canonicalPath: canonical,
      language: langInfo.name,
      langCode: langInfo.code,
      isEnglish: langInfo.isDefault || langInfo.code === 'default' || langInfo.code === 'en',
      source,
      status,
      httpStatus: status,
      statusCategory: getCategoryForStatus(status),
      crawlStatus: 'success',
      discoveredFrom,
      title: extra?.title,
      textContent: extra?.textContent,
      contentType: extra?.contentType,
      discoveredAt: Date.now(),
      depth,
      inSitemap: extra?.inSitemap ?? (source === 'Sitemap' || source === 'Sitemap + Crawl'),
      sitemapSource: extra?.sitemapSource,
      isIgnoredSlug: hasIgnoredSlug(url, this.ignoredSlugsSet),
      ignoredForValidation: hasIgnoredSlug(url, this.ignoredSlugsSet),
    };

    this.discoveredUrls.set(url, item);
    this.pendingNewItems.push(item);

    // Update language counts
    if (!this.stats.languageCounts[langInfo.code]) {
      this.stats.languageCounts[langInfo.code] = {
        code: langInfo.code,
        name: langInfo.name,
        displayName: langInfo.displayName,
        count: 0,
      };
    }
    this.stats.languageCounts[langInfo.code].count++;
    this.stats.languagesDetected = Object.keys(this.stats.languageCounts).length;
    this.stats.uniqueUrlsCount = this.discoveredUrls.size;

    return item;
  }

  private isRobotsDisallowed(urlStr: string): boolean {
    if (!this.settings.respectRobotsTxt || this.disallowedPaths.length === 0) return false;
    try {
      const parsed = new URL(urlStr);
      const path = parsed.pathname;
      return this.disallowedPaths.some((dis) => dis && path.startsWith(dis));
    } catch {
      return false;
    }
  }

  public async start(): Promise<void> {
    if (this.stats.status === 'crawling' || this.stats.status === 'discovering_sitemaps') {
      return;
    }

    this.isAborted = false;
    this.abortController = new AbortController();

    // Fast-path: Direct URL List Mode
    if (this.settings.crawlMode === 'url_list' && this.settings.targetUrls && this.settings.targetUrls.length > 0) {
      this.stats.status = 'crawling';
      this.stats.startedAt = Date.now();
      this.broadcast(
        'init',
        `Direct URL List mode: Processing ${this.settings.targetUrls.length} target URLs with parallel high-speed engine...`
      );

      for (const rawUrl of this.settings.targetUrls) {
        if (!rawUrl || !rawUrl.trim()) continue;
        const norm = normalizeUrl(rawUrl.trim(), this.origin, {
          includeSubdomains: true,
          ignoredSlugs: this.ignoredSlugsSet,
        });
        const urlToUse = norm ? norm.normalizedUrl : rawUrl.trim();
        this.processCandidateUrl(urlToUse, urlToUse, 'Page Crawl', 0);
      }

      await this.runCrawlPool();

      if (this.isAborted) {
        this.finishCrawl('stopped');
      } else {
        this.finishCrawl('completed', `Direct validation complete: ${this.discoveredUrls.size} URLs analyzed.`);
      }
      return;
    }

    this.stats.status = 'discovering_sitemaps';
    this.stats.startedAt = Date.now();
    this.broadcast('init', 'Starting robots.txt and sitemap discovery...');

    try {
      // 1. Fetch robots.txt
      const robotsData = await fetchAndParseRobotsTxt(
        this.origin,
        this.settings.userAgent || '',
        this.settings.requestTimeout,
        this.abortController.signal
      );
      this.disallowedPaths = robotsData.disallowedPaths;

      // 2. Discover and parse all sitemaps
      const sitemapCandidates = [
        ...robotsData.sitemaps,
        new URL('/sitemap.xml', this.origin).toString(),
        new URL('/sitemap_index.xml', this.origin).toString(),
        new URL('/sitemap-index.xml', this.origin).toString(),
        new URL('/sitemap/sitemap.xml', this.origin).toString(),
      ];

      const sitemapResult = await discoverAllSitemapUrls(
        this.origin,
        this.baseNormalizedUrl,
        sitemapCandidates,
        {
          userAgent: this.settings.userAgent || '',
          timeoutSeconds: this.settings.requestTimeout,
          includeSubdomains: this.settings.includeSubdomains,
          ignoredSlugs: this.ignoredSlugsSet,
          abortSignal: this.abortController.signal,
          onProgress: (msg) => this.broadcast('sitemap_started', msg),
        }
      );

      for (const smUrl of sitemapResult.urls) {
        this.sitemapUrls.set(smUrl.url, smUrl);
        this.processCandidateUrl(smUrl.url, this.origin, 'Sitemap', 1, {
          inSitemap: true,
          sitemapSource: smUrl.sourceSitemap,
        });
      }

      this.broadcast(
        'sitemap_done',
        `Sitemaps checked (${sitemapResult.sitemapsFound.length} found). Discovered ${this.discoveredUrls.size} URLs.`
      );

      if (this.isAborted) {
        this.finishCrawl('stopped');
        return;
      }

      // Ensure root URL is added to the unified queue
      this.processCandidateUrl(this.baseNormalizedUrl, this.baseNormalizedUrl, 'Page Crawl', 0);

      // 3. Concurrent Queue-Based Page Crawling
      this.stats.status = 'crawling';
      this.broadcast('progress', 'Starting high-speed concurrent page crawling...');

      await this.runCrawlPool();

      if (this.isAborted) {
        this.finishCrawl('stopped');
      } else {
        this.finishCrawl('completed');
      }
    } catch (error: any) {
      console.error('Crawler error:', error);
      this.stats.status = 'error';
      this.stats.errorMessage = error?.message || 'An unexpected error occurred during crawling.';
      this.finishCrawl('error', this.stats.errorMessage);
    }
  }

  public stop(): void {
    if (this.isAborted) return;
    this.isAborted = true;
    this.abortController.abort();
    this.stats.status = 'stopped';
    this.finishCrawl('stopped', 'Crawl stopped by user.');
  }

  private finishCrawl(status: CrawlStats['status'], message?: string): void {
    this.stats.status = status;
    const now = Date.now();
    this.stats.completedAt = now;
    this.stats.queueRemaining = 0;
    this.stats.currentUrl = '';
    this.stats.pagesCrawled = this.visitedUrls.size;
    this.stats.uniqueUrlsCount = this.discoveredUrls.size;
    this.stats.duplicatesRemoved = this.duplicateUrlsSet.size;
    this.stats.assetsIgnored = this.assetUrlsSet.size;
    this.stats.externalUrlsIgnored = this.externalUrlsSet.size;

    const startedAt = this.stats.startedAt || now;
    const durationMs = Math.max(1, now - startedAt);
    const pagesPerSecond = Number(((this.stats.pagesCrawled / (durationMs / 1000))).toFixed(2));
    this.stats.durationMs = durationMs;
    this.stats.pagesPerSecond = pagesPerSecond;

    // Record metrics
    metricsTracker.recordCrawl({
      crawlId: this.crawlId,
      totalTimeMs: durationMs,
      pagesDiscovered: this.discoveredUrls.size,
      pagesCrawled: this.stats.pagesCrawled,
      duplicatesRemoved: this.stats.duplicatesRemoved,
      assetsSkipped: this.stats.assetsIgnored,
      externalUrlsSkipped: this.stats.externalUrlsIgnored,
      failedRequests: this.stats.failedRequests,
      retryCount: 0,
      pagesPerSecond,
      avgResponseTimeMs: 0,
    });

    if (this.broadcastThrottleTimer) {
      clearTimeout(this.broadcastThrottleTimer);
      this.broadcastThrottleTimer = null;
    }
    this.syncToStore();
    this.broadcast(
      status === 'completed' ? 'completed' : status === 'stopped' ? 'stopped' : 'error',
      message,
      true
    );
  }

  /**
   * Runs concurrent worker promises drawing from the crawl queue.
   * Uses reactive zero-delay resolution so workers immediately pick up newly discovered links.
   */
  private async runCrawlPool(): Promise<void> {
    let inFlightCount = 0;

    const worker = async (): Promise<void> => {
      while (!this.isAborted && this.stats.pagesCrawled < this.settings.maxPages) {
        if (this.queue.length === 0) {
          if (inFlightCount > 0) {
            // Wait reactively for another active worker to enqueue newly discovered links
            await this.waitForWork(400);
            if (this.queue.length > 0) continue;
          }
          break;
        }

        const nextUrl = this.queue.shift()!;
        this.stats.queueRemaining = this.queue.length;

        // Skip if already visited or disallowed
        if (this.visitedUrls.has(nextUrl)) continue;
        if (this.isRobotsDisallowed(nextUrl)) continue;

        this.visitedUrls.add(nextUrl);
        this.stats.pagesCrawled = this.visitedUrls.size;
        this.stats.currentUrl = nextUrl;
        this.scheduleThrottledBroadcast('page_crawled');

        inFlightCount++;
        try {
          await this.crawlSinglePage(nextUrl);
        } finally {
          inFlightCount--;
          this.notifyWorkers();
        }
      }
    };

    const targetConcurrency = this.settings.concurrency;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < targetConcurrency; i++) {
      promises.push(worker());
    }

    await Promise.all(promises);
    this.notifyWorkers();
  }

  /**
   * Fast HTTP request + Cheerio parsing with connection keep-alive.
   */
  private async crawlSinglePage(targetUrl: string): Promise<void> {
    // Quick extension pre-check before executing network request
    if (isAssetUrl(targetUrl)) {
      if (!this.assetUrlsSet.has(targetUrl)) {
        this.assetUrlsSet.add(targetUrl);
        this.stats.assetsIgnored = this.assetUrlsSet.size;
      }
      if (this.discoveredUrls.has(targetUrl)) {
        this.discoveredUrls.delete(targetUrl);
        this.stats.uniqueUrlsCount = this.discoveredUrls.size;
      }
      return;
    }

    try {
      const dynamicSelectors = this.settings.dynamicSelectors || settingsStore.getDynamicSelectors();
      const fetchResult = await fastFetchHtml(targetUrl, {
        userAgent: this.settings.userAgent,
        timeoutSeconds: this.settings.requestTimeout,
        followRedirects: this.settings.followRedirects,
        abortSignal: this.abortController.signal,
        maxRetries: 1,
      });

      const statusCode = fetchResult.status;
      let currentItem = this.discoveredUrls.get(targetUrl);
      if (currentItem) {
        currentItem.status = statusCode;
        currentItem.httpStatus = statusCode;
        currentItem.statusCategory = getCategoryForStatus(statusCode);
        currentItem.crawlStatus = statusCode >= 400 || statusCode === 0 ? 'http_error' : 'success';
        currentItem.responseTimeMs = fetchResult.responseTimeMs;
        currentItem.contentType = fetchResult.contentType;
      }

      // Handle redirect
      if (fetchResult.finalUrl && fetchResult.finalUrl !== targetUrl) {
        const normFinal = normalizeUrl(fetchResult.finalUrl, this.origin, {
          includeSubdomains: this.settings.includeSubdomains,
          ignoredSlugs: this.ignoredSlugsSet,
        });
        if (normFinal && !normFinal.isAsset && !normFinal.isExternal) {
          this.knownUrls.add(normFinal.normalizedUrl);
          this.visitedUrls.add(normFinal.normalizedUrl);
        }
      }

      if (statusCode >= 400 || !fetchResult.ok) {
        this.stats.failedRequests++;
        if (currentItem) {
          currentItem.status = statusCode || 0;
          currentItem.httpStatus = statusCode || 0;
          currentItem.statusCategory = statusCode >= 500 ? '5xx' : statusCode >= 400 ? '4xx' : 'failed';
          currentItem.crawlStatus = statusCode >= 400 ? 'http_error' : 'connection_failed';
          currentItem.error = fetchResult.error || `HTTP ${statusCode}${statusCode === 404 ? ' Not Found' : ' Error'}`;
        }
        this.scheduleThrottledBroadcast('page_failed');
        return;
      }

      // Check non-HTML Content-Type
      if (!fetchResult.isHtml && fetchResult.contentType) {
        if (!this.assetUrlsSet.has(targetUrl)) {
          this.assetUrlsSet.add(targetUrl);
          this.stats.assetsIgnored = this.assetUrlsSet.size;
        }
        if (this.discoveredUrls.has(targetUrl)) {
          this.discoveredUrls.delete(targetUrl);
          this.stats.uniqueUrlsCount = this.discoveredUrls.size;
        }
        return;
      }

      const html = fetchResult.body;
      if (!html || typeof html !== 'string') return;

      // Single-pass parse of metadata, static content, and hreflangs
      const parsed = parseHtmlPage(html, {
        baseUrl: targetUrl,
        dynamicSelectors,
      });

      if (currentItem) {
        currentItem.title = parsed.title;
        currentItem.textContent = parsed.staticText;
        currentItem.staticText = parsed.staticText;
        currentItem.staticCharsAnalyzed = parsed.staticCharsAnalyzed;
        currentItem.dynamicCharsIgnored = parsed.dynamicCharsIgnored;
        currentItem.staticBlocks = parsed.staticBlocks;
        currentItem.amphtmlUrl = parsed.amphtmlUrl;
        currentItem.canonicalUrl = parsed.canonicalUrl;
        currentItem.hreflangMap = parsed.hreflangMap;
      }

      // Process asset links discovered on the page
      if (parsed.assetLinks && parsed.assetLinks.length > 0) {
        for (const assetHref of parsed.assetLinks) {
          const normAsset = normalizeUrl(assetHref, targetUrl, {
            includeSubdomains: this.settings.includeSubdomains,
            ignoredSlugs: this.ignoredSlugsSet,
          });
          if (normAsset && (normAsset.isAsset || isAssetUrl(normAsset.normalizedUrl))) {
            if (!this.assetUrlsSet.has(normAsset.normalizedUrl)) {
              this.assetUrlsSet.add(normAsset.normalizedUrl);
              this.stats.assetsIgnored = this.assetUrlsSet.size;
            }
          }
        }
      }

      // Process all HTML hyperlinks, alternates, and canonical (skip deep child crawling in url_list mode)
      if (this.settings.crawlMode !== 'url_list') {
        const allExtractedHrefs = [
          ...parsed.links,
          ...parsed.alternateLinks,
          ...(parsed.canonicalUrl ? [parsed.canonicalUrl] : []),
        ];

        const childDepth = (currentItem?.depth || 0) + 1;
        for (const rawHref of allExtractedHrefs) {
          if (this.isAborted) break;
          this.processCandidateUrl(rawHref, targetUrl, 'Page Crawl', childDepth);
        }
      }
    } catch (err: any) {
      if (this.isAborted) return;
      this.stats.failedRequests++;

      const item = this.discoveredUrls.get(targetUrl);
      if (item) {
        const status = err.response?.status || 0;
        item.status = status;
        item.httpStatus = status;
        item.error = err.message || 'Request failed';

        const code = err.code || '';
        const msg = (err.message || '').toLowerCase();
        let crawlStatus: CrawlStatusType = 'other';
        if (code === 'ECONNABORTED' || msg.includes('timeout')) {
          crawlStatus = 'timeout';
        } else if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
          crawlStatus = 'dns_failed';
        } else if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
          crawlStatus = 'connection_failed';
        } else if (msg.includes('redirect')) {
          crawlStatus = 'redirect_loop';
        } else if (status === 403 || status === 401) {
          crawlStatus = 'blocked';
        } else if (status >= 400) {
          crawlStatus = 'http_error';
        }

        item.crawlStatus = crawlStatus;
        item.statusCategory = status > 0 ? getCategoryForStatus(status) : 'failed';
      }

      this.scheduleThrottledBroadcast('page_failed');
    }
  }
}

class CrawlerManager {
  private sessions: Map<string, CrawlerSession> = new Map();

  public createSession(domain: string, settings?: Partial<CrawlSettings>): CrawlerSession {
    const crawlId = `crawl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session = new CrawlerSession(crawlId, domain, settings);
    this.sessions.set(crawlId, session);

    if (this.sessions.size > 20) {
      const oldestKey = this.sessions.keys().next().value;
      if (oldestKey) this.sessions.delete(oldestKey);
    }

    return session;
  }

  public getSession(crawlId: string): CrawlerSession | undefined {
    return this.sessions.get(crawlId);
  }
}

export const crawlerManager = new CrawlerManager();
