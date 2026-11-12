import {
  LinkHealthItem,
  LinkHealthResult,
  LinkSeverity,
  CrawledAnchorLink,
  RedirectHop,
} from '../../src/types';
import { StoredCrawlSession } from '../services/crawlStore';
import { fastFetchHtml, fastHeadOrGetCheck } from '../crawler/httpClient';
import { parseHtmlPage } from '../crawler/pageParser';
import { TRACKING_PARAMS, isPrivateHost } from '../crawler/urlNormalizer';
import { shouldIgnoreUrl } from '../services/domainSettingsStore';

const PROBE_CONCURRENCY = 16;
const PROBE_TIMEOUT_SEC = 6;
const MAX_REDIRECT_HOPS = 8;
const MAX_UNIQUE_PROBES = 3000;
const DIRECT_MAX_PAGES = 50;
const DIRECT_PAGE_CONCURRENCY = 6;
const FALLBACK_MAX_PAGES = 150;
const MAX_CROSS_PAGE_ID_FETCHES = 40;
const DEFAULT_BUDGET_MS = 120_000;
const MAX_BUDGET_MS = 600_000;
const MAX_RESULT_ITEMS = 2000;
const HARD_MAX_RESULT_ITEMS = 20_000;

/** Client-safe validation failure (always maps to HTTP 400) */
export class LinkHealthRequestError extends Error {
  public readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'LinkHealthRequestError';
  }
}

export interface LinkHealthAuditOptions {
  /** Allow loopback / RFC1918 destinations. Only for automated tests and local staging. */
  allowPrivateHosts?: boolean;
  /** Wall-clock budget for network probing (default 120s, clamped to 10 min). */
  budgetMs?: number;
  /** Maximum findings returned over the wire (counters stay complete). */
  maxItems?: number;
}

// ---------------- URL HELPERS ----------------

/**
 * Check if a URL has a double-slash in its pathname (e.g. https://domain.com//visa/)
 */
export function hasDoubleSlashInPath(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return /\/{2,}/.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Check if an internal link carries tracking parameters
 */
export function extractTrackingParams(urlString: string): string[] {
  try {
    const parsed = new URL(urlString);
    const found: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();
      if (
        TRACKING_PARAMS.has(lowerKey) ||
        lowerKey.startsWith('utm_') ||
        lowerKey.includes('session') ||
        lowerKey === 'phpsessid' ||
        lowerKey === 'jsessionid'
      ) {
        found.push(key);
      }
    });
    return found;
  } catch {
    return [];
  }
}

export function stripHash(urlString: string): string {
  const hashIndex = urlString.indexOf('#');
  return hashIndex === -1 ? urlString : urlString.slice(0, hashIndex);
}

function safeHostname(urlString: string): string {
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * True when a URL is http(s) and safe to fetch from the server.
 * Blocks loopback, link-local and RFC1918 hosts unless explicitly allowed (SSRF guard).
 */
export function isAuditableHttpUrl(urlString: string, allowPrivateHosts = false): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (!parsed.hostname) return false;
    return allowPrivateHosts || !isPrivateHost(parsed.hostname);
  } catch {
    return false;
  }
}

/** "#", "javascript:void(0)", empty href and friends are non-navigational placeholders */
export function isPlaceholderHref(rawHref: string): boolean {
  const trimmed = (rawHref || '').trim();
  if (!trimmed) return true;
  if (trimmed === '#') return true;
  return /^javascript\s*:/i.test(trimmed);
}

/** 401/403/429 are frequently bot-protection responses, not genuinely dead pages */
function isLikelyBotBlock(statusCode: number): boolean {
  return statusCode === 401 || statusCode === 403 || statusCode === 429;
}

async function mapWithLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        await fn(item);
      } catch {
        // A single failing URL must never abort the whole audit
      }
    }
  });
  await Promise.all(runners);
}

// ---------------- DESTINATION PROBING ----------------

interface ProbePolicy {
  allowPrivateHosts: boolean;
  deadline: number;
  signal: AbortSignal;
}

export interface DestinationProbe {
  statusCode: number; // -1 => not verified (budget exhausted / blocked / aborted)
  finalUrl: string;
  chain: RedirectHop[];
  hops: number;
  isLoop: boolean;
  error?: string;
}

function unverified(finalUrl: string, error: string): DestinationProbe {
  return { statusCode: -1, finalUrl, chain: [], hops: 0, isLoop: false, error };
}

/**
 * Single HTTP hop. Uses HEAD (with ranged-GET fallback) so tracing never downloads page bodies.
 */
async function probeHop(
  url: string,
  timeoutSec: number,
  policy: ProbePolicy
): Promise<{ statusCode: number; location?: string }> {
  if (Date.now() > policy.deadline) return { statusCode: -1 };
  if (!isAuditableHttpUrl(url, policy.allowPrivateHosts)) return { statusCode: -1 };

  const head = await fastHeadOrGetCheck(url, {
    timeoutMs: timeoutSec * 1000,
    abortSignal: policy.signal,
  });

  let statusCode = head.statusCode;
  let location = head.headers['location'] || head.headers['Location'];

  // Origins that reject HEAD or bot agents must not be reported as broken links
  if (statusCode === 403 || statusCode === 405 || statusCode === 429) {
    const get = await fastFetchHtml(url, {
      timeoutSeconds: timeoutSec,
      followRedirects: false,
      maxRetries: 0,
      abortSignal: policy.signal,
    });
    if (get.status) {
      statusCode = get.status;
      location = get.headers['location'] || location;
    }
  }

  return { statusCode, location };
}

/**
 * Walks a URL hop by hop, capturing the full redirect chain and detecting cycles.
 */
export async function traceDestination(
  startUrl: string,
  timeoutSec: number = PROBE_TIMEOUT_SEC,
  policy?: Partial<ProbePolicy>
): Promise<DestinationProbe> {
  const effectivePolicy: ProbePolicy = {
    allowPrivateHosts: policy?.allowPrivateHosts ?? false,
    deadline: policy?.deadline ?? Date.now() + DEFAULT_BUDGET_MS,
    signal: policy?.signal ?? new AbortController().signal,
  };

  if (!isAuditableHttpUrl(startUrl, effectivePolicy.allowPrivateHosts)) {
    return unverified(stripHash(startUrl), 'Blocked non-public or unsupported destination');
  }

  const chain: RedirectHop[] = [];
  const visited = new Set<string>();
  let currentUrl = stripHash(startUrl);
  let hops = 0;

  while (hops <= MAX_REDIRECT_HOPS) {
    if (effectivePolicy.signal.aborted || Date.now() > effectivePolicy.deadline) {
      return unverified(currentUrl, 'Audit budget exhausted before verification completed');
    }

    if (visited.has(currentUrl)) {
      return {
        statusCode: chain[chain.length - 1]?.statusCode ?? 310,
        finalUrl: currentUrl,
        chain,
        hops,
        isLoop: true,
      };
    }
    visited.add(currentUrl);

    const hop = await probeHop(currentUrl, timeoutSec, effectivePolicy);
    if (hop.statusCode === -1) {
      return unverified(currentUrl, 'Blocked non-public destination or audit budget exhausted');
    }

    chain.push({ url: currentUrl, statusCode: hop.statusCode });

    if (hop.statusCode >= 300 && hop.statusCode < 400 && hop.location) {
      let nextUrl: string;
      try {
        nextUrl = stripHash(new URL(hop.location, currentUrl).toString());
      } catch {
        break;
      }

      // Never follow a redirect into private address space
      if (!isAuditableHttpUrl(nextUrl, effectivePolicy.allowPrivateHosts)) {
        return unverified(currentUrl, 'Redirect target blocked (private or unsupported address)');
      }

      currentUrl = nextUrl;
      hops++;
      continue;
    }

    if (hop.statusCode === 0) {
      return {
        statusCode: 0,
        finalUrl: currentUrl,
        chain,
        hops,
        isLoop: false,
        error: 'Connection failed or timed out',
      };
    }

    return { statusCode: hop.statusCode, finalUrl: currentUrl, chain, hops, isLoop: false };
  }

  // More than MAX_REDIRECT_HOPS without repeating a URL is effectively a loop
  return {
    statusCode: chain[chain.length - 1]?.statusCode || 0,
    finalUrl: currentUrl,
    chain,
    hops,
    isLoop: true,
  };
}

/**
 * Deduplicating probe cache shared by every page in an audit run.
 */
class DestinationProbeCache {
  private cache = new Map<string, Promise<DestinationProbe>>();

  constructor(private policy: ProbePolicy) {}

  public get(url: string): Promise<DestinationProbe> {
    const key = stripHash(url);
    const cached = this.cache.get(key);
    if (cached) return cached;

    let promise: Promise<DestinationProbe>;
    if (this.cache.size >= MAX_UNIQUE_PROBES) {
      promise = Promise.resolve(unverified(key, 'Probe budget reached'));
    } else {
      promise = traceDestination(key, PROBE_TIMEOUT_SEC, this.policy);
    }

    this.cache.set(key, promise);
    return promise;
  }

  public async warm(urls: Iterable<string>): Promise<void> {
    await mapWithLimit(Array.from(new Set(urls)), PROBE_CONCURRENCY, async (url) => {
      await this.get(url);
    });
  }
}

// ---------------- SHARED AUDIT CORE ----------------

export interface AuditPage {
  url: string;
  title?: string;
  anchors: CrawledAnchorLink[];
  anchorIds?: string[];
}

interface AuditContext {
  probes: DestinationProbeCache;
  pageIds: Map<string, Set<string>>;
  maxItems: number;
  /** Resolves element ids of a page that was not part of the audited page set */
  fetchAnchorIds?: (url: string) => Promise<Set<string> | null>;
}

interface AuditOutcome {
  totalLinksScanned: number;
  healthyCount: number;
  brokenInternalCount: number;
  brokenExternalCount: number;
  redirectCount: number;
  redirectChainCount: number;
  placeholderCount: number;
  emptyAnchorCount: number;
  brokenAnchorCount: number;
  trackingParamCount: number;
  doubleSlashCount: number;
  unverifiedCount: number;
  itemsTruncated: boolean;
  items: LinkHealthItem[];
}

function domSnippet(anchor: CrawledAnchorLink): string {
  const snippet = `<a href="${anchor.rawHref}">${anchor.text}</a>`;
  return snippet.length > 180 ? `${snippet.slice(0, 180)}...` : snippet;
}

async function auditPages(pages: AuditPage[], ctx: AuditContext): Promise<AuditOutcome> {
  const items: LinkHealthItem[] = [];
  let itemsTruncated = false;
  const counters = {
    totalLinksScanned: 0,
    healthyCount: 0,
    brokenInternalCount: 0,
    brokenExternalCount: 0,
    redirectCount: 0,
    redirectChainCount: 0,
    placeholderCount: 0,
    emptyAnchorCount: 0,
    brokenAnchorCount: 0,
    trackingParamCount: 0,
    doubleSlashCount: 0,
    unverifiedCount: 0,
  };

  // 1. Warm the probe queue once for every unique destination across all pages
  const probeTargets = new Set<string>();
  for (const page of pages) {
    const pageBase = stripHash(page.url);
    for (const anchor of page.anchors) {
      if (isPlaceholderHref(anchor.rawHref)) continue;
      const target = stripHash(anchor.resolvedUrl);
      if (!isAuditableHttpUrl(target, true) || target === pageBase) continue;
      probeTargets.add(target);
    }
  }
  await ctx.probes.warm(probeTargets);

  let linkSeq = 0;
  const pushItem = (data: Omit<LinkHealthItem, 'id'>) => {
    if (items.length >= ctx.maxItems) {
      itemsTruncated = true;
      return;
    }
    items.push({ id: `lh-${++linkSeq}`, ...data });
  };

  const resolveAnchorIds = async (
    pageUrl: string,
    pageAnchorIds: string[] | undefined,
    targetPage: string
  ): Promise<Set<string> | null> => {
    if (targetPage === stripHash(pageUrl)) {
      return new Set(pageAnchorIds || ctx.pageIds.get(targetPage) || []);
    }
    const known = ctx.pageIds.get(targetPage);
    if (known) return known;
    if (ctx.fetchAnchorIds) return ctx.fetchAnchorIds(targetPage);
    return null;
  };

  // 2. Evaluate every anchor
  for (const page of pages) {
    const pageBase = stripHash(page.url);
    const pageHost = safeHostname(page.url);

    for (const anchor of page.anchors) {
      counters.totalLinksScanned++;
      const target = stripHash(anchor.resolvedUrl);
      const isInternal = !!pageHost && safeHostname(anchor.resolvedUrl) === pageHost;
      const snippet = domSnippet(anchor);
      let issues = 0;

      // Check 1: Placeholder links (#, javascript:void(0), empty href)
      if (isPlaceholderHref(anchor.rawHref)) {
        counters.placeholderCount++;
        pushItem({
          sourceUrl: page.url,
          sourceTitle: page.title,
          targetUrl: anchor.rawHref || '(empty href)',
          rawHref: anchor.rawHref,
          anchorText: anchor.text,
          anchorType: anchor.anchorType,
          issueType: 'placeholder',
          severity: 'warning',
          isInternal: true,
          domElementSnippet: snippet,
          details:
            'Link uses an empty href, "#" or "javascript:void(0)" placeholder instead of a real URL or semantic <button>',
          recommendation:
            'If this triggers a UI action (modal/tab/drawer), replace <a> with <button type="button">. If it navigates, provide the real destination URL.',
        });
        continue;
      }

      // Check 2: Double-slash paths
      if (hasDoubleSlashInPath(anchor.resolvedUrl) || hasDoubleSlashInPath(anchor.rawHref)) {
        counters.doubleSlashCount++;
        issues++;
        pushItem({
          sourceUrl: page.url,
          sourceTitle: page.title,
          targetUrl: anchor.resolvedUrl,
          rawHref: anchor.rawHref,
          anchorText: anchor.text,
          anchorType: anchor.anchorType,
          issueType: 'double_slash',
          severity: 'warning',
          isInternal,
          domElementSnippet: snippet,
          details: 'URL path contains redundant double slashes (//), which creates duplicate URLs',
          recommendation: 'Fix URL concatenation in the template/CMS so only a single slash separates path segments',
        });
      }

      // Check 3: Tracking / session parameter pollution on internal links
      const tracking = isInternal ? extractTrackingParams(anchor.resolvedUrl) : [];
      if (tracking.length > 0) {
        counters.trackingParamCount++;
        issues++;
        pushItem({
          sourceUrl: page.url,
          sourceTitle: page.title,
          targetUrl: anchor.resolvedUrl,
          rawHref: anchor.rawHref,
          anchorText: anchor.text,
          anchorType: anchor.anchorType,
          issueType: 'tracking_param',
          severity: 'info',
          isInternal,
          domElementSnippet: snippet,
          details: `Internal link carries marketing/session parameters: ${tracking.join(', ')}`,
          recommendation:
            'Strip campaign and session parameters from internal links so link equity and caching are not diluted',
        });
      }

      // Check 4: Empty anchor text (no text, aria-label, title, area/image alt)
      if (anchor.anchorType === 'empty') {
        counters.emptyAnchorCount++;
        issues++;
        pushItem({
          sourceUrl: page.url,
          sourceTitle: page.title,
          targetUrl: anchor.resolvedUrl,
          rawHref: anchor.rawHref,
          anchorText: '(No text, aria-label or alt)',
          anchorType: 'empty',
          issueType: 'empty_anchor',
          severity: 'warning',
          isInternal,
          domElementSnippet: snippet,
          details: 'Anchor has no visible text, no aria-label, no title and no image alt text',
          recommendation:
            'Add descriptive anchor text or an aria-label so both search engines and screen readers can understand the link',
        });
      }

      // Check 5: Broken in-page anchor (#section must exist on the destination document)
      if (anchor.inPageTargetId && isInternal) {
        const anchorName = anchor.inPageTargetId.startsWith('#')
          ? anchor.inPageTargetId.slice(1)
          : anchor.inPageTargetId;

        if (anchorName && anchorName.toLowerCase() !== 'top') {
          const ids = await resolveAnchorIds(page.url, page.anchorIds, target);
          if (ids && !ids.has(anchorName)) {
            counters.brokenAnchorCount++;
            issues++;
            pushItem({
              sourceUrl: page.url,
              sourceTitle: page.title,
              targetUrl: anchor.resolvedUrl,
              rawHref: anchor.rawHref,
              anchorText: anchor.text,
              anchorType: anchor.anchorType,
              issueType: 'broken_anchor',
              severity: 'warning',
              isInternal,
              domElementSnippet: snippet,
              details: `Points to #${anchorName}, but no element with id="${anchorName}" (or a[name]) exists on ${target}`,
              recommendation: `Add id="${anchorName}" to the target section, or update the href to an anchor that exists`,
            });
          }
        }
      }

      // Check 6-8: Destination HTTP status, redirect chains and loops
      if (isAuditableHttpUrl(target, true) && target !== pageBase) {
        const probe = await ctx.probes.get(target);

        if (probe.statusCode === -1) {
          // Unverified links are never reported as broken, but they are surfaced
          counters.unverifiedCount++;
        } else if (probe.isLoop) {
          counters.redirectCount++;
          counters.redirectChainCount++;
          issues++;
          pushItem({
            sourceUrl: page.url,
            sourceTitle: page.title,
            targetUrl: anchor.resolvedUrl,
            rawHref: anchor.rawHref,
            anchorText: anchor.text,
            anchorType: anchor.anchorType,
            issueType: 'redirect_loop',
            severity: 'critical',
            statusCode: probe.chain[0]?.statusCode || 301,
            finalDestinationUrl: probe.finalUrl,
            redirectHops: probe.hops,
            redirectChain: probe.chain,
            isInternal,
            domElementSnippet: snippet,
            details: `Redirect loop detected after ${probe.hops} hop(s) — the chain never reaches a final page`,
            recommendation: 'Fix the redirect rules on the server so the cycle resolves to one canonical destination',
          });
        } else if (probe.hops >= 2) {
          counters.redirectCount++;
          counters.redirectChainCount++;
          issues++;
          pushItem({
            sourceUrl: page.url,
            sourceTitle: page.title,
            targetUrl: anchor.resolvedUrl,
            rawHref: anchor.rawHref,
            anchorText: anchor.text,
            anchorType: anchor.anchorType,
            issueType: 'redirect_chain',
            severity: 'warning',
            statusCode: probe.chain[0]?.statusCode || 301,
            finalDestinationUrl: probe.finalUrl,
            redirectHops: probe.hops,
            redirectChain: probe.chain,
            isInternal,
            domElementSnippet: snippet,
            details: `Redirect chain of ${probe.hops} hops before reaching ${probe.finalUrl}`,
            recommendation: `Link directly to the final destination (${probe.finalUrl}) to remove extra hops`,
          });
        } else if (probe.statusCode >= 400 || probe.statusCode === 0) {
          if (isInternal) {
            counters.brokenInternalCount++;
          } else {
            counters.brokenExternalCount++;
          }
          issues++;

          const severity: LinkSeverity = isInternal && !isLikelyBotBlock(probe.statusCode)
            ? 'critical'
            : 'warning';

          const botBlockNote =
            isLikelyBotBlock(probe.statusCode)
              ? ' (this status is often bot protection — verify in a real browser before treating it as dead)'
              : '';

          pushItem({
            sourceUrl: page.url,
            sourceTitle: page.title,
            targetUrl: anchor.resolvedUrl,
            rawHref: anchor.rawHref,
            anchorText: anchor.text,
            anchorType: anchor.anchorType,
            issueType: isInternal ? 'broken_internal' : 'broken_external',
            severity,
            statusCode: probe.statusCode,
            isInternal,
            domElementSnippet: snippet,
            details:
              probe.statusCode === 0
                ? `Destination could not be reached (${probe.error || 'connection failed'})`
                : `Destination returned HTTP ${probe.statusCode}${probe.statusCode === 404 ? ' Not Found' : ''}${botBlockNote}`,
            recommendation: isInternal
              ? 'Repair the link or add a 301 redirect to a live page'
              : 'Remove or replace the outbound link; contact the third party if the URL should still exist',
          });
        }
      }

      if (issues === 0) {
        counters.healthyCount++;
      }
    }
  }

  return { ...counters, itemsTruncated, items };
}

// ---------------- RESULT ASSEMBLY ----------------

function calculateHealthScore(outcome: AuditOutcome): number {
  const weightedIssues =
    outcome.brokenInternalCount * 3 +
    outcome.brokenExternalCount * 1.5 +
    outcome.brokenAnchorCount * 1.5 +
    outcome.redirectChainCount * 0.75 +
    outcome.placeholderCount * 0.5 +
    outcome.emptyAnchorCount * 0.5 +
    outcome.doubleSlashCount * 0.25 +
    outcome.trackingParamCount * 0.25;

  const ratio = weightedIssues / Math.max(1, outcome.totalLinksScanned);
  return Math.round(Math.max(0, Math.min(100, 100 - ratio * 100)));
}

function determineOverallStatus(outcome: AuditOutcome): LinkHealthResult['overallStatus'] {
  if (outcome.brokenInternalCount > 0) return 'error';
  if (
    outcome.brokenExternalCount > 0 ||
    outcome.redirectChainCount > 0 ||
    outcome.placeholderCount > 0 ||
    outcome.emptyAnchorCount > 0 ||
    outcome.brokenAnchorCount > 0 ||
    outcome.doubleSlashCount > 0
  ) {
    return 'warning';
  }
  return 'passed';
}

function buildResult(
  outcome: AuditOutcome,
  pagesScanned: number,
  auditMode: LinkHealthResult['auditMode'],
  startedAt: number
): LinkHealthResult {
  return {
    totalLinksScanned: outcome.totalLinksScanned,
    pagesScanned,
    brokenInternalCount: outcome.brokenInternalCount,
    brokenExternalCount: outcome.brokenExternalCount,
    redirectCount: outcome.redirectCount,
    redirectChainCount: outcome.redirectChainCount,
    placeholderCount: outcome.placeholderCount,
    emptyAnchorCount: outcome.emptyAnchorCount,
    brokenAnchorCount: outcome.brokenAnchorCount,
    trackingParamCount: outcome.trackingParamCount,
    doubleSlashCount: outcome.doubleSlashCount,
    healthyCount: outcome.healthyCount,
    unverifiedCount: outcome.unverifiedCount,
    itemsTruncated: outcome.itemsTruncated,
    healthScore: calculateHealthScore(outcome),
    overallStatus: determineOverallStatus(outcome),
    items: outcome.items,
    durationMs: Date.now() - startedAt,
    timestamp: Date.now(),
    auditMode,
  };
}

function resolveBudgetMs(options: LinkHealthAuditOptions): number {
  const requested = options.budgetMs ?? DEFAULT_BUDGET_MS;
  return Math.max(5_000, Math.min(requested, MAX_BUDGET_MS));
}

function resolveMaxItems(options: LinkHealthAuditOptions): number {
  const requested = options.maxItems ?? MAX_RESULT_ITEMS;
  return Math.max(1, Math.min(requested, HARD_MAX_RESULT_ITEMS));
}

function logAudit(result: LinkHealthResult, label: string): void {
  console.log(
    `[link-health] ${label} mode=${result.auditMode} pages=${result.pagesScanned} links=${result.totalLinksScanned} ` +
      `broken=${result.brokenInternalCount + result.brokenExternalCount} chains=${result.redirectChainCount} ` +
      `placeholders=${result.placeholderCount} anchors=${result.brokenAnchorCount} empty=${result.emptyAnchorCount} ` +
      `unverified=${result.unverifiedCount ?? 0} score=${result.healthScore} duration=${result.durationMs}ms`
  );
}

// ---------------- WHOLE WEBSITE (CRAWL SESSION) MODE ----------------

/**
 * Last-resort fallback for sessions without a retained link inventory:
 * re-downloads a bounded slice of crawled HTML pages and extracts anchors.
 */
async function collectPagesByFetching(
  session: StoredCrawlSession,
  policy: ProbePolicy
): Promise<AuditPage[]> {
  const candidates = Array.from(session.items.values())
    .filter(
      (item) =>
        item.status >= 200 &&
        item.status < 300 &&
        (!item.contentType || item.contentType.includes('html')) &&
        isAuditableHttpUrl(item.url, policy.allowPrivateHosts) &&
        !shouldIgnoreUrl(item, 'linkHealth', session).ignored
    )
    .slice(0, FALLBACK_MAX_PAGES);

  const pages: AuditPage[] = [];

  await mapWithLimit(candidates, 8, async (item) => {
    const res = await fastFetchHtml(item.url, {
      timeoutSeconds: 8,
      followRedirects: true,
      maxRetries: 0,
      abortSignal: policy.signal,
    });
    if (!res.ok || !res.isHtml) return;

    const parsed = parseHtmlPage(res.body, { baseUrl: res.finalUrl || item.url });
    pages.push({
      url: item.url,
      title: parsed.title || item.title,
      anchors: parsed.anchors,
      anchorIds: parsed.anchorIds,
    });
  });

  return pages;
}

/**
 * Audit Link & URL Health for a full Crawl Session (Whole Website Mode).
 * Anchors come from the crawl-time inventory, so no HTML is downloaded twice.
 */
export async function validateLinkHealthForSession(
  session: StoredCrawlSession,
  options: LinkHealthAuditOptions = {}
): Promise<LinkHealthResult> {
  const startedAt = Date.now();
  const budgetMs = resolveBudgetMs(options);
  const maxItems = resolveMaxItems(options);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  const policy: ProbePolicy = {
    allowPrivateHosts: Boolean(options.allowPrivateHosts),
    deadline: startedAt + budgetMs,
    signal: controller.signal,
  };

  try {
    const inventory = session.anchorInventory;
    const idIndex = session.anchorIdIndex || new Map<string, string[]>();

    let pages: AuditPage[] = [];

    if (inventory && inventory.size > 0) {
      for (const [pageUrl, anchors] of inventory.entries()) {
        // Respect per-tool / global exclusion rules configured for this domain
        if (shouldIgnoreUrl(pageUrl, 'linkHealth', session).ignored) continue;
        pages.push({
          url: pageUrl,
          title: session.items.get(pageUrl)?.title,
          anchors,
          anchorIds: idIndex.get(pageUrl) || [],
        });
      }
    } else {
      pages = await collectPagesByFetching(session, policy);
    }

    const pageIds = new Map<string, Set<string>>();
    for (const [pageUrl, ids] of idIndex.entries()) {
      pageIds.set(stripHash(pageUrl), new Set(ids));
    }
    for (const page of pages) {
      const key = stripHash(page.url);
      if (!pageIds.has(key)) pageIds.set(key, new Set(page.anchorIds || []));
    }

    const outcome = await auditPages(pages, {
      probes: new DestinationProbeCache(policy),
      pageIds,
      maxItems,
    });

    const result = buildResult(outcome, pages.length, 'crawl_session', startedAt);
    logAudit(result, 'session');
    return result;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------- INSTANT URL LIST / SINGLE PAGE MODE ----------------

/**
 * Audit Link & URL Health directly for a list of URLs (Ad-hoc / Instant Mode).
 * Fetches only the supplied pages in parallel, then verifies every discovered
 * destination through one shared, deduplicated probe queue.
 */
export async function validateLinkHealthForUrls(
  targetUrls: string[],
  options: LinkHealthAuditOptions = {}
): Promise<LinkHealthResult> {
  const startedAt = Date.now();
  const allowPrivateHosts = Boolean(options.allowPrivateHosts);
  const maxItems = resolveMaxItems(options);
  const budgetMs = resolveBudgetMs(options);

  const submitted = (Array.isArray(targetUrls) ? targetUrls : [])
    .map((u) => String(u ?? '').trim())
    .filter(Boolean);

  if (submitted.length === 0) {
    throw new LinkHealthRequestError('Please provide at least one URL to audit.');
  }
  if (submitted.length > DIRECT_MAX_PAGES) {
    throw new LinkHealthRequestError(`A maximum of ${DIRECT_MAX_PAGES} URLs can be audited per run.`);
  }

  const rejected = submitted.filter((u) => !isAuditableHttpUrl(u, allowPrivateHosts));
  if (rejected.length > 0) {
    throw new LinkHealthRequestError(
      allowPrivateHosts
        ? 'Only http:// and https:// URLs can be audited.'
        : 'Only public http:// and https:// URLs can be audited (localhost and private network addresses are blocked).'
    );
  }

  const cleanUrls = Array.from(new Set(submitted)).slice(0, DIRECT_MAX_PAGES);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  const policy: ProbePolicy = {
    allowPrivateHosts,
    deadline: startedAt + budgetMs,
    signal: controller.signal,
  };

  try {
    const pages: AuditPage[] = [];
    const failedTargets: Array<{ url: string; status: number }> = [];

    await mapWithLimit(cleanUrls, DIRECT_PAGE_CONCURRENCY, async (pageUrl) => {
      if (shouldIgnoreUrl(pageUrl, 'linkHealth', safeHostname(pageUrl)).ignored) return;

      const res = await fastFetchHtml(pageUrl, {
        timeoutSeconds: 10,
        followRedirects: true,
        maxRetries: 1,
        abortSignal: controller.signal,
      });

      if (!res.ok || !res.isHtml) {
        failedTargets.push({ url: pageUrl, status: res.status });
        return;
      }

      const parsed = parseHtmlPage(res.body, { baseUrl: res.finalUrl || pageUrl });
      pages.push({
        url: pageUrl,
        title: parsed.title || pageUrl,
        anchors: parsed.anchors,
        anchorIds: parsed.anchorIds,
      });
    });

    const pageIds = new Map<string, Set<string>>();
    for (const page of pages) {
      pageIds.set(stripHash(page.url), new Set(page.anchorIds || []));
    }

    // Cross-page anchor targets that were not in the submitted list are fetched once, capped
    const idFetchCache = new Map<string, Promise<Set<string> | null>>();
    let idFetchCount = 0;

    const fetchAnchorIds = async (url: string): Promise<Set<string> | null> => {
      const key = stripHash(url);
      const known = pageIds.get(key);
      if (known) return known;

      const cached = idFetchCache.get(key);
      if (cached) return cached;

      if (idFetchCount >= MAX_CROSS_PAGE_ID_FETCHES) return null;
      if (!isAuditableHttpUrl(key, allowPrivateHosts)) return null;
      idFetchCount++;

      const promise = (async () => {
        const res = await fastFetchHtml(key, {
          timeoutSeconds: 8,
          followRedirects: true,
          maxRetries: 0,
          abortSignal: controller.signal,
        });
        if (!res.ok || !res.isHtml) return null;
        const parsed = parseHtmlPage(res.body, { baseUrl: res.finalUrl || key });
        const ids = new Set(parsed.anchorIds);
        pageIds.set(key, ids);
        return ids;
      })();

      idFetchCache.set(key, promise);
      return promise;
    };

    const outcome = await auditPages(pages, {
      probes: new DestinationProbeCache(policy),
      pageIds,
      maxItems,
      fetchAnchorIds,
    });

    // Report submitted URLs that could not be loaded at all
    for (const failure of failedTargets) {
      outcome.brokenInternalCount++;
      if (outcome.items.length >= maxItems) {
        outcome.itemsTruncated = true;
        continue;
      }
      outcome.items.push({
        id: `lh-root-${outcome.items.length + 1}`,
        sourceUrl: failure.url,
        sourceTitle: 'Submitted target page',
        targetUrl: failure.url,
        rawHref: failure.url,
        anchorText: 'Target Page',
        anchorType: 'text',
        issueType: 'broken_internal',
        severity: 'critical',
        statusCode: failure.status,
        isInternal: true,
        details:
          failure.status === 0
            ? 'Submitted page could not be reached (connection failed or timeout)'
            : `Submitted page returned HTTP ${failure.status}`,
        recommendation: 'Ensure the submitted URL is publicly reachable and returns HTTP 200 with HTML content',
      });
    }

    const result = buildResult(outcome, pages.length, 'direct_urls', startedAt);
    logAudit(result, 'direct');
    return result;
  } finally {
    clearTimeout(timer);
  }
}
