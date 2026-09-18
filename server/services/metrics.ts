/**
 * Performance metrics and structured logging for crawler and validators.
 */

export interface CrawlMetrics {
  crawlId: string;
  totalTimeMs: number;
  pagesDiscovered: number;
  pagesCrawled: number;
  duplicatesRemoved: number;
  assetsSkipped: number;
  externalUrlsSkipped: number;
  failedRequests: number;
  retryCount: number;
  pagesPerSecond: number;
  avgResponseTimeMs: number;
  playwrightPagesUsed?: number;
  validationTimeMs?: Record<string, number>;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private currentLevel: LogLevel = 'INFO';

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    return levels[level] >= levels[this.currentLevel];
  }

  public debug(msg: string, meta?: any): void {
    if (this.shouldLog('DEBUG')) {
      console.debug(`[DEBUG] ${msg}`, meta !== undefined ? meta : '');
    }
  }

  public info(msg: string, meta?: any): void {
    if (this.shouldLog('INFO')) {
      console.info(`[INFO] ${msg}`, meta !== undefined ? meta : '');
    }
  }

  public warn(msg: string, meta?: any): void {
    if (this.shouldLog('WARN')) {
      console.warn(`[WARN] ${msg}`, meta !== undefined ? meta : '');
    }
  }

  public error(msg: string, error?: any): void {
    if (this.shouldLog('ERROR')) {
      console.error(`[ERROR] ${msg}`, error !== undefined ? error : '');
    }
  }
}

export const logger = new Logger();

class MetricsTracker {
  private metricsStore = new Map<string, CrawlMetrics>();

  public recordCrawl(metrics: CrawlMetrics): void {
    this.metricsStore.set(metrics.crawlId, metrics);
    if (this.metricsStore.size > 50) {
      const oldestKey = this.metricsStore.keys().next().value;
      if (oldestKey) this.metricsStore.delete(oldestKey);
    }
    logger.info(
      `Crawl completed for [${metrics.crawlId}]: ${metrics.pagesCrawled} pages in ${(metrics.totalTimeMs / 1000).toFixed(2)}s (${metrics.pagesPerSecond.toFixed(1)} pages/sec). Duplicates: ${metrics.duplicatesRemoved}, Assets: ${metrics.assetsSkipped}`
    );
  }

  public getMetrics(crawlId: string): CrawlMetrics | undefined {
    return this.metricsStore.get(crawlId);
  }
}

export const metricsTracker = new MetricsTracker();
