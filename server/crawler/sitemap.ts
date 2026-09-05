import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { normalizeUrl } from './urlNormalizer';

export interface DiscoveredSitemapUrl {
  url: string;
  sourceSitemap: string;
}

export async function discoverAllSitemapUrls(
  originUrl: string,
  baseNormalizedUrl: string,
  candidateSitemaps: string[],
  options: {
    userAgent: string;
    timeoutSeconds: number;
    includeSubdomains?: boolean;
    ignoredSlugs?: string[] | Set<string>;
    abortSignal?: AbortSignal;
    onProgress?: (message: string) => void;
  }
): Promise<{ urls: DiscoveredSitemapUrl[]; sitemapsFound: string[] }> {
  const sitemapQueue = [...candidateSitemaps];
  const processedSitemaps = new Set<string>();
  const successfulSitemaps = new Set<string>();
  const discoveredUrlMap = new Map<string, DiscoveredSitemapUrl>();

  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
  });

  while (sitemapQueue.length > 0 && processedSitemaps.size < 60) {
    if (options.abortSignal?.aborted) break;

    const currentSitemap = sitemapQueue.shift()!;
    if (processedSitemaps.has(currentSitemap)) continue;
    processedSitemaps.add(currentSitemap);

    options.onProgress?.(`Inspecting sitemap: ${currentSitemap}`);

    try {
      const response = await axios.get(currentSitemap, {
        timeout: options.timeoutSeconds * 1000,
        signal: options.abortSignal,
        headers: {
          'User-Agent': options.userAgent,
          Accept: 'application/xml, text/xml, */*',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const xmlData = response.data;
      if (!xmlData || typeof xmlData !== 'string') continue;

      let parsedXml: any;
      try {
        parsedXml = xmlParser.parse(xmlData);
      } catch {
        continue;
      }

      successfulSitemaps.add(currentSitemap);

      // Check if Sitemap Index (<sitemapindex><sitemap><loc>...</loc></sitemap></sitemapindex>)
      if (parsedXml.sitemapindex && parsedXml.sitemapindex.sitemap) {
        const sitemaps = Array.isArray(parsedXml.sitemapindex.sitemap)
          ? parsedXml.sitemapindex.sitemap
          : [parsedXml.sitemapindex.sitemap];

        for (const sm of sitemaps) {
          const loc = sm?.loc;
          if (loc && typeof loc === 'string') {
            const trimLoc = loc.trim();
            if (!processedSitemaps.has(trimLoc) && sitemapQueue.length < 60) {
              sitemapQueue.push(trimLoc);
            }
          }
        }
      }

      // Check if standard UrlSet (<urlset><url><loc>...</loc></url></urlset>)
      if (parsedXml.urlset && parsedXml.urlset.url) {
        const urls = Array.isArray(parsedXml.urlset.url) ? parsedXml.urlset.url : [parsedXml.urlset.url];

        for (const u of urls) {
          // 1. Primary location tag <loc>
          const candidateHrefs: string[] = [];
          if (u?.loc && typeof u.loc === 'string') {
            candidateHrefs.push(u.loc);
          }

          // 2. Multilingual alternate links <xhtml:link rel="alternate" hreflang="..." href="...">
          const alternateLinks = u?.['xhtml:link'] || u?.link;
          if (alternateLinks) {
            const linkList = Array.isArray(alternateLinks) ? alternateLinks : [alternateLinks];
            for (const link of linkList) {
              const href = link?.['@_href'] || link?.href;
              if (href && typeof href === 'string') {
                candidateHrefs.push(href);
              }
            }
          }

          for (const rawHref of candidateHrefs) {
            const norm = normalizeUrl(rawHref, baseNormalizedUrl, {
              includeSubdomains: options.includeSubdomains,
              ignoredSlugs: options.ignoredSlugs,
            });

            if (norm && !norm.isExternal && !norm.isAsset) {
              if (!discoveredUrlMap.has(norm.normalizedUrl)) {
                discoveredUrlMap.set(norm.normalizedUrl, {
                  url: norm.normalizedUrl,
                  sourceSitemap: currentSitemap,
                });
              }
            }
          }
        }
      }
    } catch {
      // Individual sitemap failure is normal (404 etc.)
    }
  }

  return {
    urls: Array.from(discoveredUrlMap.values()),
    sitemapsFound: Array.from(successfulSitemaps),
  };
}
