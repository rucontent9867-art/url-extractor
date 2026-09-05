import { CrawlSettings, CrawlStats, CrawlUrlItem, ValidationSummary } from '../../src/types';
import { DiscoveredSitemapUrl } from '../crawler/sitemap';

export interface StoredCrawlSession {
  crawlId: string;
  domain: string;
  normalizedDomain: string;
  origin: string;
  hostname: string;
  settings: CrawlSettings;
  stats: CrawlStats;
  items: Map<string, CrawlUrlItem>;
  sitemapUrls: Map<string, DiscoveredSitemapUrl>;
  validation?: ValidationSummary;
  createdAt: number;
}

class CrawlStore {
  private sessions = new Map<string, StoredCrawlSession>();

  public setSession(session: StoredCrawlSession): void {
    this.sessions.set(session.crawlId, session);

    // Housekeeping: limit to 20 recent sessions
    if (this.sessions.size > 20) {
      const oldestKey = this.sessions.keys().next().value;
      if (oldestKey) this.sessions.delete(oldestKey);
    }
  }

  public getSession(crawlId: string): StoredCrawlSession | undefined {
    return this.sessions.get(crawlId);
  }

  public getAllSessions(): StoredCrawlSession[] {
    return Array.from(this.sessions.values());
  }

  public setValidation(crawlId: string, validation: ValidationSummary): void {
    const session = this.sessions.get(crawlId);
    if (session) {
      session.validation = validation;
    }
  }

  public getValidation(crawlId: string): ValidationSummary | undefined {
    return this.sessions.get(crawlId)?.validation;
  }

  public deleteSession(crawlId: string): boolean {
    return this.sessions.delete(crawlId);
  }
}

export const crawlStore = new CrawlStore();
