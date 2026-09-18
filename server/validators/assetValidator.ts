import * as cheerio from 'cheerio';
import axios, { AxiosRequestConfig } from 'axios';
import {
  AssetRecord,
  AssetValidationResult,
  AssetValidationOptions,
  AssetType,
  AssetElementType,
  AssetStatus,
  AssetAltStatus,
  ImageMeaningCategory,
  RedirectChainStep,
  RedirectIssueType,
  CrawlUrlItem,
  Tool6Settings,
  ExternalUrlValidationMode,
} from '../../src/types';
import { StoredCrawlSession } from '../services/crawlStore';
import { normalizeUrl, isSameDomain } from '../crawler/urlNormalizer';
import {
  shouldIgnoreUrl,
  domainSettingsStore,
  DEFAULT_SOCIAL_DOMAINS,
  createDefaultTool6Settings,
} from '../services/domainSettingsStore';
import { globalHttpAgent, globalHttpsAgent, fastHeadOrGetCheck } from '../crawler/httpClient';

const WEAK_ALT_PATTERNS = [
  /^image$/i,
  /^img$/i,
  /^photo$/i,
  /^picture$/i,
  /^pic$/i,
  /^icon$/i,
  /^graphic$/i,
  /^banner$/i,
  /^placeholder$/i,
  /^untitled$/i,
  /^screenshot$/i,
  /^\d+$/,
  /^image\s*\d+$/i,
  /^photo\s*\d+$/i,
  /^dsc_?\d+$/i,
  /^img_?\d+$/i,
  /\.(png|jpe?g|gif|webp|svg|bmp|tiff|avif)$/i,
];

const DOC_EXTENSIONS = new Set([
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'csv',
  'txt',
  'zip',
  'tar',
  'gz',
  'rar',
  '7z',
  'rtf',
  'odt',
  'ods',
  'odp',
]);

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'm4v', 'mkv', 'flv']);

const VIDEO_PROVIDERS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',
  'wistia.com',
  'dailymotion.com',
  'loom.com',
  'streamable.com',
];

interface RawAssetDiscovery {
  rawUrl: string;
  sourcePageUrl: string;
  assetType: AssetType;
  elementType: AssetElementType;
  alt?: string;
  hasAltAttr?: boolean;
  role?: string;
  ariaHidden?: boolean;
  width?: number;
  height?: number;
  specialProtocol?: 'mailto' | 'tel' | 'javascript' | 'fragment' | 'data' | 'blob';
}

interface HttpCheckCacheEntry {
  statusCode: number;
  status: AssetStatus;
  contentType: string;
  finalUrl: string;
  redirectChain: RedirectChainStep[];
  redirectChainLength: number;
  redirectIssue: RedirectIssueType;
  responseTimeMs: number;
  error?: string;
}

export class AssetValidator {
  /**
   * Validates all assets, media, PDFs, documents, links, and redirect health across a crawl session.
   */
  public async validate(
    session: StoredCrawlSession,
    options: AssetValidationOptions = {}
  ): Promise<AssetValidationResult> {
    const domainKey = session.normalizedDomain || session.domain || 'default';
    const domainSettings = domainSettingsStore.getTool6Settings(domainKey) || createDefaultTool6Settings();

    // Merge settings from domain store and user options
    const externalUrlValidation: ExternalUrlValidationMode =
      options.externalUrlValidation || domainSettings.externalUrlValidation || 'none';

    const selectedExternalDomains = (
      options.selectedExternalDomains || domainSettings.selectedExternalDomains || []
    ).map((d) => d.trim().toLowerCase()).filter(Boolean);

    const enableSocialExclusions =
      options.enableSocialExclusions !== undefined
        ? options.enableSocialExclusions
        : domainSettings.enableSocialExclusions !== undefined
        ? domainSettings.enableSocialExclusions
        : true;

    const socialDomainsList = (
      options.socialDomains ||
      domainSettings.socialDomains ||
      DEFAULT_SOCIAL_DOMAINS
    ).map((d) => d.trim().toLowerCase()).filter(Boolean);

    const ignoredAssetTypes = new Set<AssetType>(
      options.ignoredAssetTypes || domainSettings.ignoredAssetTypes || []
    );

    const maxConcurrency = Math.min(options.concurrency || 30, 50);
    const maxAssetsLimit = options.maxAssets || 10000;
    const timeoutSec = options.timeoutSec || domainSettings.timeoutSec || 12;
    const timeoutMs = timeoutSec * 1000;
    const maxRedirectsThreshold =
      options.maxRedirectsThreshold !== undefined
        ? options.maxRedirectsThreshold
        : domainSettings.maxRedirectsThreshold !== undefined
        ? domainSettings.maxRedirectsThreshold
        : 2;

    const ignoredUrls: string[] = [];
    const candidatePages: CrawlUrlItem[] = [];
    let pagesIgnored = 0;

    // 1. Separate ignored pages vs valid pages
    for (const item of session.items.values()) {
      const ignoreCheck = shouldIgnoreUrl(item, 'asset', session);
      if (ignoreCheck.ignored) {
        pagesIgnored++;
        ignoredUrls.push(item.normalizedUrl);
      } else {
        candidatePages.push(item);
      }
    }

    if (candidatePages.length === 0) {
      return this.createEmptyResult(pagesIgnored, ignoredUrls);
    }

    // 2. Discover all raw asset references across pages
    const rawDiscoveries: RawAssetDiscovery[] = [];

    for (const page of candidatePages) {
      const html = (page as any).htmlBody || page.textContent || '';
      if (!html || typeof html !== 'string') continue;

      this.extractAssetsFromHtml(html, page.normalizedUrl, rawDiscoveries);
    }

    // 3. Central asset deduplication map: normalizedUrl -> aggregated discovery
    const assetMap = new Map<
      string,
      {
        url: string;
        normalizedUrl: string;
        sourcePages: Set<string>;
        primarySourcePage: string;
        assetType: AssetType;
        elementType: AssetElementType;
        alt?: string;
        hasAltAttr?: boolean;
        role?: string;
        ariaHidden?: boolean;
        width?: number;
        height?: number;
        specialProtocol?: string;
      }
    >();

    for (const disc of rawDiscoveries) {
      // Handle special protocols (mailto, tel, javascript, fragment, data, blob)
      if (disc.specialProtocol) {
        const key = `${disc.specialProtocol}:${disc.rawUrl}`;
        if (!assetMap.has(key)) {
          assetMap.set(key, {
            url: disc.rawUrl,
            normalizedUrl: key,
            sourcePages: new Set([disc.sourcePageUrl]),
            primarySourcePage: disc.sourcePageUrl,
            assetType: disc.assetType,
            elementType: disc.elementType,
            alt: disc.alt,
            hasAltAttr: disc.hasAltAttr,
            role: disc.role,
            ariaHidden: disc.ariaHidden,
            width: disc.width,
            height: disc.height,
            specialProtocol: disc.specialProtocol,
          });
        } else {
          assetMap.get(key)!.sourcePages.add(disc.sourcePageUrl);
        }
        continue;
      }

      const norm = normalizeUrl(disc.rawUrl, disc.sourcePageUrl, {
        includeSubdomains: true,
      });

      if (!norm.normalizedUrl) continue;

      const normKey = norm.normalizedUrl;

      // Classify internal vs external if general link
      let resolvedType = disc.assetType;
      if (resolvedType === 'INTERNAL_LINK' && norm.isExternal) {
        resolvedType = 'EXTERNAL_LINK';
      }

      if (!assetMap.has(normKey)) {
        assetMap.set(normKey, {
          url: norm.normalizedUrl,
          normalizedUrl: normKey,
          sourcePages: new Set([disc.sourcePageUrl]),
          primarySourcePage: disc.sourcePageUrl,
          assetType: resolvedType,
          elementType: disc.elementType,
          alt: disc.alt,
          hasAltAttr: disc.hasAltAttr,
          role: disc.role,
          ariaHidden: disc.ariaHidden,
          width: disc.width,
          height: disc.height,
        });
      } else {
        const existing = assetMap.get(normKey)!;
        existing.sourcePages.add(disc.sourcePageUrl);
        if (!existing.alt && disc.alt) {
          existing.alt = disc.alt;
          existing.hasAltAttr = disc.hasAltAttr;
        }
      }

      if (assetMap.size >= maxAssetsLimit) break;
    }

    // 4. Decide which items to check over HTTP vs skip
    const checkCache = new Map<string, HttpCheckCacheEntry>();
    const assetList = Array.from(assetMap.values());
    const urlsToHttpCheck: string[] = [];

    // Helper to test if a hostname is a social domain
    const isSocialDomain = (hostname: string): boolean => {
      const cleanHost = hostname.toLowerCase();
      return socialDomainsList.some(
        (sd) => cleanHost === sd || cleanHost.endsWith(`.${sd}`)
      );
    };

    // Helper to test if a hostname matches selected external domains
    const isSelectedExternalDomain = (hostname: string): boolean => {
      const cleanHost = hostname.toLowerCase();
      return selectedExternalDomains.some(
        (ed) => cleanHost === ed || cleanHost.endsWith(`.${ed}`)
      );
    };

    const itemSkipDecisions = new Map<
      string,
      { skipped: boolean; skipReason?: string }
    >();

    for (const item of assetList) {
      // Check 1: Special Protocol
      if (item.specialProtocol) {
        itemSkipDecisions.set(item.normalizedUrl, {
          skipped: true,
          skipReason: `${item.specialProtocol}: protocol link`,
        });
        continue;
      }

      // Check 2: Ignored Asset Types (from settings)
      if (ignoredAssetTypes.has(item.assetType)) {
        itemSkipDecisions.set(item.normalizedUrl, {
          skipped: true,
          skipReason: `Resource type (${item.assetType}) ignored in settings`,
        });
        continue;
      }

      // Check 3: Check options flags for specific types
      if (item.assetType === 'IMAGE' && options.checkImages === false) {
        itemSkipDecisions.set(item.normalizedUrl, { skipped: true, skipReason: 'Image checks disabled' });
        continue;
      }
      if (item.assetType === 'VIDEO' && options.checkVideos === false) {
        itemSkipDecisions.set(item.normalizedUrl, { skipped: true, skipReason: 'Video checks disabled' });
        continue;
      }
      if (item.assetType === 'PDF' && options.checkPdfs === false) {
        itemSkipDecisions.set(item.normalizedUrl, { skipped: true, skipReason: 'PDF checks disabled' });
        continue;
      }
      if (item.assetType === 'DOCUMENT' && options.checkDocuments === false) {
        itemSkipDecisions.set(item.normalizedUrl, { skipped: true, skipReason: 'Document checks disabled' });
        continue;
      }
      if (item.assetType === 'INTERNAL_LINK' && options.checkInternalLinks === false) {
        itemSkipDecisions.set(item.normalizedUrl, { skipped: true, skipReason: 'Internal link checks disabled' });
        continue;
      }

      let host = '';
      let isExternalUrl = false;
      try {
        const u = new URL(item.url);
        host = u.hostname.toLowerCase();
        isExternalUrl = !isSameDomain(item.url, session.normalizedDomain || session.domain);
      } catch {
        // malformed URL
      }

      // Check 4: Social URL Exclusions (applies to external domains matching social list)
      if (enableSocialExclusions && host && isSocialDomain(host)) {
        itemSkipDecisions.set(item.normalizedUrl, {
          skipped: true,
          skipReason: `Excluded social domain (${host})`,
        });
        continue;
      }

      // Check 5: External URL Validation Setting (none / all / selected_domains)
      if (isExternalUrl || item.assetType === 'EXTERNAL_LINK') {
        if (externalUrlValidation === 'none') {
          itemSkipDecisions.set(item.normalizedUrl, {
            skipped: true,
            skipReason: 'External URL validation disabled in settings',
          });
          continue;
        } else if (externalUrlValidation === 'selected_domains') {
          if (!isSelectedExternalDomain(host)) {
            itemSkipDecisions.set(item.normalizedUrl, {
              skipped: true,
              skipReason: `External domain (${host}) not in selected validation list`,
            });
            continue;
          }
        }
      }

      // URL should be validated via HTTP request
      itemSkipDecisions.set(item.normalizedUrl, { skipped: false });
      if (!urlsToHttpCheck.includes(item.url)) {
        urlsToHttpCheck.push(item.url);
      }
    }

    // 5. Execute HTTP verification in batches with connection pooling
    for (let i = 0; i < urlsToHttpCheck.length; i += maxConcurrency) {
      const chunk = urlsToHttpCheck.slice(i, i + maxConcurrency);
      await Promise.all(
        chunk.map(async (url) => {
          if (checkCache.has(url)) return;
          const result = await this.verifyHttpHealth(url, timeoutMs, maxRedirectsThreshold);
          checkCache.set(url, result);
        })
      );
    }

    // 6. Build final Asset Records and aggregate metrics
    const records: AssetRecord[] = [];
    let brokenAssets = 0;
    let errors404 = 0;
    let errors4xx = 0;
    let errors5xx = 0;
    let failedRequests = 0;
    let totalRedirects = 0;
    let redirectChains = 0;
    let missingAltCount = 0;
    let emptyAltCount = 0;
    let weakAltCount = 0;
    let skippedCount = 0;
    let warningCount = 0;
    let passedCount = 0;
    let errorCount = 0;
    let totalImages = 0;
    let totalVideos = 0;
    let totalPdfs = 0;
    let totalDocuments = 0;
    let totalInternalLinks = 0;
    let totalExternalLinks = 0;

    let counter = 0;
    for (const item of assetList) {
      counter++;
      const skipInfo = itemSkipDecisions.get(item.normalizedUrl) || { skipped: false };
      const sourcePagesList = Array.from(item.sourcePages);

      // Type counters
      if (item.assetType === 'IMAGE') totalImages++;
      else if (item.assetType === 'VIDEO') totalVideos++;
      else if (item.assetType === 'PDF') totalPdfs++;
      else if (item.assetType === 'DOCUMENT') totalDocuments++;
      else if (item.assetType === 'INTERNAL_LINK') totalInternalLinks++;
      else if (item.assetType === 'EXTERNAL_LINK') totalExternalLinks++;

      // Alt attribute analysis for images
      let altStatus: AssetAltStatus | undefined;
      let altCategory: ImageMeaningCategory | undefined;
      let altReviewNote: string | undefined;

      if (item.assetType === 'IMAGE') {
        const altResult = this.analyzeAltAttribute(item);
        altStatus = altResult.altStatus;
        altCategory = altResult.altCategory;
        altReviewNote = altResult.altReviewNote;

        if (altStatus === 'ALT_MISSING') missingAltCount++;
        else if (altStatus === 'ALT_EMPTY') emptyAltCount++;
        else if (altStatus === 'WEAK_ALT_TEXT') weakAltCount++;
      }

      // If skipped
      if (skipInfo.skipped) {
        skippedCount++;
        records.push({
          id: `asset-${counter}-${Date.now()}`,
          url: item.url,
          normalizedUrl: item.normalizedUrl,
          sourcePages: sourcePagesList,
          foundOnPages: sourcePagesList,
          primarySourcePage: item.primarySourcePage,
          assetType: item.assetType,
          elementType: item.elementType,
          statusCode: undefined,
          status: 'skipped',
          statusLabel: 'SKIPPED',
          skipReason: skipInfo.skipReason,
          error: skipInfo.skipReason,
          alt: item.alt,
          hasAlt: item.hasAltAttr,
          altStatus,
          altCategory,
          altReviewNote,
          width: item.width,
          height: item.height,
          priority: 'LOW',
          details: `Skipped: ${skipInfo.skipReason}`,
        });
        continue;
      }

      // Process HTTP verified response
      const httpData = checkCache.get(item.url) || {
        statusCode: 0,
        status: 'error' as AssetStatus,
        contentType: '',
        finalUrl: item.url,
        redirectChain: [],
        redirectChainLength: 0,
        redirectIssue: 'NONE' as RedirectIssueType,
        responseTimeMs: 0,
        error: 'Not checked',
      };

      let finalStatus: AssetStatus = 'passed';
      let statusLabel = 'PASS';
      let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      let errorDesc = httpData.error;

      if (httpData.statusCode === 404) {
        finalStatus = 'error';
        statusLabel = '404 Not Found';
        priority = 'HIGH';
        brokenAssets++;
        errors404++;
        errors4xx++;
        errorCount++;
      } else if (httpData.statusCode >= 500) {
        finalStatus = 'error';
        statusLabel = `HTTP ${httpData.statusCode} Server Error`;
        priority = 'CRITICAL';
        brokenAssets++;
        errors5xx++;
        errorCount++;
      } else if (httpData.statusCode >= 400) {
        finalStatus = 'error';
        statusLabel = `HTTP ${httpData.statusCode} Client Error`;
        priority = 'HIGH';
        brokenAssets++;
        errors4xx++;
        errorCount++;
      } else if (httpData.statusCode === 0) {
        finalStatus = 'error';
        statusLabel = 'Failed / Timeout';
        priority = 'HIGH';
        brokenAssets++;
        failedRequests++;
        errorCount++;
      } else if (httpData.redirectIssue === 'REDIRECT_LOOP') {
        finalStatus = 'error';
        statusLabel = 'Redirect Loop';
        priority = 'CRITICAL';
        errorCount++;
      } else if (httpData.redirectIssue === 'REDIRECT_TO_404') {
        finalStatus = 'error';
        statusLabel = 'Redirects to 404';
        priority = 'HIGH';
        brokenAssets++;
        errors404++;
        errors4xx++;
        errorCount++;
      } else if (httpData.redirectIssue === 'REDIRECT_CHAIN') {
        finalStatus = 'warning';
        statusLabel = `Redirect Chain (${httpData.redirectChainLength} hops)`;
        priority = 'MEDIUM';
        redirectChains++;
        warningCount++;
      } else if (altStatus === 'ALT_MISSING' && altCategory === 'INFORMATIVE') {
        finalStatus = 'warning';
        statusLabel = 'Missing Alt Attribute';
        priority = 'MEDIUM';
        warningCount++;
      } else if (altStatus === 'WEAK_ALT_TEXT') {
        finalStatus = 'needs_review';
        statusLabel = 'Weak Alt Text';
        priority = 'LOW';
        warningCount++;
      } else {
        finalStatus = 'passed';
        statusLabel = 'PASS';
        priority = 'LOW';
        passedCount++;
      }

      if (httpData.redirectChainLength > 0) {
        totalRedirects++;
      }

      records.push({
        id: `asset-${counter}-${Date.now()}`,
        url: item.url,
        normalizedUrl: item.normalizedUrl,
        sourcePages: sourcePagesList,
        foundOnPages: sourcePagesList,
        primarySourcePage: item.primarySourcePage,
        assetType: item.assetType,
        elementType: item.elementType,
        statusCode: httpData.statusCode,
        status: finalStatus,
        statusLabel,
        contentType: httpData.contentType,
        finalUrl: httpData.finalUrl !== item.url ? httpData.finalUrl : undefined,
        redirectChain: httpData.redirectChain,
        redirectChainLength: httpData.redirectChainLength,
        redirectIssue: httpData.redirectIssue,
        responseTimeMs: httpData.responseTimeMs,
        error: errorDesc,
        alt: item.alt,
        hasAlt: item.hasAltAttr,
        altStatus,
        altCategory,
        altReviewNote,
        width: item.width,
        height: item.height,
        priority,
        details:
          sourcePagesList.length > 1
            ? `Referenced on ${sourcePagesList.length} pages`
            : undefined,
      });
    }

    const overallStatus =
      errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'passed';

    return {
      pagesChecked: candidatePages.length,
      pagesIgnored,
      totalAssets: records.length,
      totalResources: records.length,
      totalInternalLinks,
      totalExternalLinks,
      totalImages,
      totalVideos,
      totalPdfs,
      totalDocuments,
      brokenAssets,
      errors404,
      errors4xx,
      errors5xx,
      failedRequests,
      totalRedirects,
      redirectChains,
      missingAltCount,
      emptyAltCount,
      weakAltCount,
      skippedCount,
      warningCount,
      passedCount,
      errorCount,
      overallStatus,
      assets: records,
      items: records,
      timestamp: Date.now(),
      ignoredUrls,
    };
  }

  private extractAssetsFromHtml(
    html: string,
    sourcePageUrl: string,
    out: RawAssetDiscovery[]
  ): void {
    try {
      const $ = cheerio.load(html);

      // 1. IMAGES (<img src>, <img srcset>, <picture><source srcset>)
      $('img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
        const alt = $(el).attr('alt');
        const hasAltAttr = alt !== undefined;
        const role = $(el).attr('role');
        const ariaHidden = $(el).attr('aria-hidden') === 'true';
        const width = parseInt($(el).attr('width') || '0', 10) || undefined;
        const height = parseInt($(el).attr('height') || '0', 10) || undefined;

        if (src) {
          if (src.startsWith('data:')) {
            out.push({
              rawUrl: src.slice(0, 40) + '...',
              sourcePageUrl,
              assetType: 'IMAGE',
              elementType: 'img',
              alt: alt || undefined,
              hasAltAttr,
              specialProtocol: 'data',
            });
          } else if (src.startsWith('blob:')) {
            out.push({
              rawUrl: src,
              sourcePageUrl,
              assetType: 'IMAGE',
              elementType: 'img',
              alt: alt || undefined,
              hasAltAttr,
              specialProtocol: 'blob',
            });
          } else {
            out.push({
              rawUrl: src,
              sourcePageUrl,
              assetType: 'IMAGE',
              elementType: 'img',
              alt: alt || undefined,
              hasAltAttr,
              role,
              ariaHidden,
              width,
              height,
            });
          }
        }

        // Check srcset
        const srcset = $(el).attr('srcset');
        if (srcset) {
          const parts = srcset.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
          for (const s of parts) {
            if (s && !s.startsWith('data:') && s !== src) {
              out.push({
                rawUrl: s,
                sourcePageUrl,
                assetType: 'IMAGE',
                elementType: 'source',
                alt: alt || undefined,
                hasAltAttr,
              });
            }
          }
        }
      });

      // Picture sources
      $('picture source').each((_, el) => {
        const srcset = $(el).attr('srcset') || $(el).attr('src');
        if (srcset) {
          const parts = srcset.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
          for (const s of parts) {
            if (s && !s.startsWith('data:')) {
              out.push({
                rawUrl: s,
                sourcePageUrl,
                assetType: 'IMAGE',
                elementType: 'source',
              });
            }
          }
        }
      });

      // 2. VIDEOS (<video src>, <video><source src>, <iframe src>)
      $('video').each((_, el) => {
        const src = $(el).attr('src');
        if (src && !src.startsWith('data:')) {
          out.push({
            rawUrl: src,
            sourcePageUrl,
            assetType: 'VIDEO',
            elementType: 'video',
          });
        }
      });

      $('video source').each((_, el) => {
        const src = $(el).attr('src');
        if (src && !src.startsWith('data:')) {
          out.push({
            rawUrl: src,
            sourcePageUrl,
            assetType: 'VIDEO',
            elementType: 'source',
          });
        }
      });

      // Video iframes
      $('iframe').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
          const isVideoIframe = VIDEO_PROVIDERS.some((prov) => src.includes(prov));
          if (isVideoIframe) {
            out.push({
              rawUrl: src,
              sourcePageUrl,
              assetType: 'VIDEO',
              elementType: 'iframe_video',
            });
          }
        }
      });

      // 3. ANCHOR LINKS (PDFs, Documents, Internal / External Links, Special protocols)
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        const trimmedHref = href.trim();
        if (!trimmedHref) return;

        // Check special protocols
        if (trimmedHref.startsWith('#')) {
          out.push({
            rawUrl: trimmedHref,
            sourcePageUrl,
            assetType: 'INTERNAL_LINK',
            elementType: 'internal_link',
            specialProtocol: 'fragment',
          });
          return;
        }
        if (trimmedHref.toLowerCase().startsWith('javascript:')) {
          out.push({
            rawUrl: trimmedHref,
            sourcePageUrl,
            assetType: 'INTERNAL_LINK',
            elementType: 'internal_link',
            specialProtocol: 'javascript',
          });
          return;
        }
        if (trimmedHref.toLowerCase().startsWith('mailto:')) {
          out.push({
            rawUrl: trimmedHref,
            sourcePageUrl,
            assetType: 'EXTERNAL_LINK',
            elementType: 'external_link',
            specialProtocol: 'mailto',
          });
          return;
        }
        if (trimmedHref.toLowerCase().startsWith('tel:')) {
          out.push({
            rawUrl: trimmedHref,
            sourcePageUrl,
            assetType: 'EXTERNAL_LINK',
            elementType: 'external_link',
            specialProtocol: 'tel',
          });
          return;
        }

        const lowerHref = trimmedHref.toLowerCase().split('?')[0].split('#')[0];
        const ext = lowerHref.split('.').pop() || '';

        if (ext === 'pdf') {
          out.push({
            rawUrl: trimmedHref,
            sourcePageUrl,
            assetType: 'PDF',
            elementType: 'a_pdf',
          });
        } else if (DOC_EXTENSIONS.has(ext)) {
          out.push({
            rawUrl: trimmedHref,
            sourcePageUrl,
            assetType: 'DOCUMENT',
            elementType: 'doc_link',
          });
        } else if (VIDEO_EXTENSIONS.has(ext)) {
          out.push({
            rawUrl: trimmedHref,
            sourcePageUrl,
            assetType: 'VIDEO',
            elementType: 'video',
          });
        } else {
          // General hyperlink
          const isExternal = trimmedHref.startsWith('http://') || trimmedHref.startsWith('https://');
          out.push({
            rawUrl: trimmedHref,
            sourcePageUrl,
            assetType: isExternal ? 'EXTERNAL_LINK' : 'INTERNAL_LINK',
            elementType: isExternal ? 'external_link' : 'internal_link',
          });
        }
      });

      // 4. EMBEDS & OBJECTS (PDFs)
      $('embed[src], object[data]').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data');
        if (src && src.toLowerCase().includes('.pdf')) {
          out.push({
            rawUrl: src,
            sourcePageUrl,
            assetType: 'PDF',
            elementType: 'embed_pdf',
          });
        }
      });

      // 5. CSS BACKGROUND IMAGES in inline styles
      $('[style*="background"]').each((_, el) => {
        const style = $(el).attr('style') || '';
        const match = style.match(/url\(['"]?([^'")]+)['"]?\)/i);
        if (match && match[1] && !match[1].startsWith('data:')) {
          out.push({
            rawUrl: match[1],
            sourcePageUrl,
            assetType: 'IMAGE',
            elementType: 'css_background',
          });
        }
      });
    } catch {
      // ignore parse errors on malformed HTML
    }
  }

  private analyzeAltAttribute(item: {
    alt?: string;
    hasAltAttr?: boolean;
    role?: string;
    ariaHidden?: boolean;
    width?: number;
    height?: number;
  }): {
    altStatus: AssetAltStatus;
    altCategory: ImageMeaningCategory;
    altReviewNote?: string;
  } {
    const isDecorativeHint =
      item.role === 'presentation' ||
      item.role === 'none' ||
      item.ariaHidden === true ||
      (item.width !== undefined && item.width <= 16 && item.height !== undefined && item.height <= 16);

    if (!item.hasAltAttr) {
      return {
        altStatus: 'ALT_MISSING',
        altCategory: isDecorativeHint ? 'DECORATIVE' : 'INFORMATIVE',
        altReviewNote: isDecorativeHint
          ? 'Missing alt attribute, but image appears decorative based on ARIA/size'
          : 'Missing alt attribute on informative image',
      };
    }

    if (item.alt === '') {
      return {
        altStatus: 'ALT_EMPTY',
        altCategory: 'DECORATIVE',
        altReviewNote: 'Empty alt="" — valid for decorative images',
      };
    }

    const cleanAlt = (item.alt || '').trim();
    if (cleanAlt.length === 0) {
      return {
        altStatus: 'ALT_EMPTY',
        altCategory: 'DECORATIVE',
        altReviewNote: 'Whitespace-only alt attribute',
      };
    }

    // Check weak alt text patterns
    const isWeak = WEAK_ALT_PATTERNS.some((pattern) => pattern.test(cleanAlt));
    if (isWeak) {
      return {
        altStatus: 'WEAK_ALT_TEXT',
        altCategory: 'UNKNOWN',
        altReviewNote: `Alt text "${cleanAlt}" is generic or matches a filename. Consider providing descriptive context.`,
      };
    }

    return {
      altStatus: 'ALT_PRESENT',
      altCategory: 'INFORMATIVE',
    };
  }

  private async verifyHttpHealth(
    targetUrl: string,
    timeoutMs: number,
    maxRedirectsThreshold: number
  ): Promise<HttpCheckCacheEntry> {
    const startTime = Date.now();
    const redirectChain: RedirectChainStep[] = [];
    const visitedUrls = new Set<string>();

    let currentUrl = targetUrl;
    let statusCode = 0;
    let contentType = '';
    let finalUrl = targetUrl;
    let errorDesc: string | undefined;

    try {
      // Manual redirect follow to capture the complete redirect chain
      let hops = 0;
      const maxHops = 8;

      while (hops < maxHops) {
        if (visitedUrls.has(currentUrl)) {
          // Redirect loop detected!
          return {
            statusCode: 310,
            status: 'error',
            contentType,
            finalUrl: currentUrl,
            redirectChain,
            redirectChainLength: redirectChain.length,
            redirectIssue: 'REDIRECT_LOOP',
            responseTimeMs: Date.now() - startTime,
            error: `Redirect loop detected at ${currentUrl}`,
          };
        }

        visitedUrls.add(currentUrl);

        const checkRes = await fastHeadOrGetCheck(currentUrl, {
          timeoutMs,
          userAgent: 'Mozilla/5.0 (compatible; DomainCrawlerAssetBot/2.0; +https://ai.studio)',
        });

        statusCode = checkRes.statusCode;
        contentType = checkRes.contentType;
        finalUrl = currentUrl;

        const locationHeader = checkRes.headers['location'];

        // Check if redirect
        if (statusCode >= 300 && statusCode < 400 && locationHeader) {
          let nextUrl = locationHeader;
          try {
            nextUrl = new URL(locationHeader, currentUrl).toString();
          } catch {
            nextUrl = locationHeader;
          }

          redirectChain.push({ url: currentUrl, status: statusCode });
          currentUrl = nextUrl;
          hops++;
        } else {
          break;
        }
      }

      const responseTimeMs = Date.now() - startTime;
      const chainLen = redirectChain.length;

      let redirectIssue: RedirectIssueType = 'NONE';
      if (chainLen > 0) {
        if (statusCode === 404) {
          redirectIssue = 'REDIRECT_TO_404';
        } else if (chainLen >= maxRedirectsThreshold) {
          redirectIssue = 'REDIRECT_CHAIN';
        } else if (targetUrl.startsWith('http://') && finalUrl.startsWith('https://')) {
          redirectIssue = 'REDIRECT_HTTP_TO_HTTPS';
        } else {
          redirectIssue = 'REDIRECT_OK';
        }
      }

      let status: AssetStatus = 'passed';
      if (statusCode >= 400 || statusCode === 0) {
        status = 'error';
        errorDesc = `HTTP ${statusCode}`;
      } else if (redirectIssue === 'REDIRECT_CHAIN') {
        status = 'warning';
      }

      return {
        statusCode,
        status,
        contentType,
        finalUrl,
        redirectChain,
        redirectChainLength: chainLen,
        redirectIssue,
        responseTimeMs,
        error: errorDesc,
      };
    } catch (err: any) {
      return {
        statusCode: 0,
        status: 'error',
        contentType: '',
        finalUrl: currentUrl,
        redirectChain,
        redirectChainLength: redirectChain.length,
        redirectIssue: 'NONE',
        responseTimeMs: Date.now() - startTime,
        error: err.message || 'Connection or network failure',
      };
    }
  }

  private createEmptyResult(
    pagesIgnored: number,
    ignoredUrls: string[]
  ): AssetValidationResult {
    return {
      pagesChecked: 0,
      pagesIgnored,
      totalAssets: 0,
      totalResources: 0,
      totalInternalLinks: 0,
      totalExternalLinks: 0,
      totalImages: 0,
      totalVideos: 0,
      totalPdfs: 0,
      totalDocuments: 0,
      brokenAssets: 0,
      errors404: 0,
      errors4xx: 0,
      errors5xx: 0,
      failedRequests: 0,
      totalRedirects: 0,
      redirectChains: 0,
      missingAltCount: 0,
      emptyAltCount: 0,
      weakAltCount: 0,
      skippedCount: 0,
      warningCount: 0,
      passedCount: 0,
      errorCount: 0,
      overallStatus: 'passed',
      assets: [],
      items: [],
      timestamp: Date.now(),
      ignoredUrls,
    };
  }
}

export const assetValidator = new AssetValidator();

