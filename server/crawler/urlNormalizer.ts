// Known asset file extensions to strictly exclude
export const ASSET_EXTENSIONS = new Set([
  // Images
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'ico', 'bmp', 'tiff', 'tif', 'avif', 'eps', 'raw',
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp',
  // Media - Video & Audio
  'mp4', 'webm', 'mov', 'avi', 'mp3', 'wav', 'ogg', 'm4a', 'flv', 'wmv', 'mkv', 'aac', 'flac', 'wma', 'm4v',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg', 'pkg', 'deb', 'rpm',
  // Fonts
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // Scripts, Styles, Feeds & Data
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'rss', 'atom', 'map', 'wasm', 'env', 'yml', 'yaml', 'sql'
]);

// Tracking / marketing query parameters to remove
export const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'msclkid',
  'yclid',
  'dclid',
  'twclid',
  'zanpid',
  'mc_eid',
  'mc_cid',
  '_ga',
  '_gl',
  '_hsenc',
  '_hsmi',
  'ref',
  'ref_src',
  'source',
  'tracking_id',
]);

/**
 * Checks whether a candidate IP is a private/local IP to prevent SSRF
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  // Check private IP ranges 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
    return true;
  }
  return false;
}

/**
 * Normalizes user entered root domain or URL.
 * e.g., "kenya-eta.info" -> "https://kenya-eta.info/"
 * "http://example.com/sub" -> "http://example.com/sub"
 */
export function normalizeInputUrl(input: string): { normalizedUrl: string; origin: string; hostname: string } | null {
  let cleaned = input.trim();
  if (!cleaned) return null;

  // Add protocol if missing
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }

  try {
    const parsed = new URL(cleaned);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (isPrivateHost(hostname)) {
      return null;
    }

    // Ensure trailing slash for root URL
    if (parsed.pathname === '') {
      parsed.pathname = '/';
    }

    parsed.hostname = hostname;
    parsed.hash = '';

    return {
      normalizedUrl: parsed.toString(),
      origin: parsed.origin,
      hostname,
    };
  } catch {
    return null;
  }
}

/**
 * Strips www. prefix from hostname for equivalent domain comparison
 */
export function stripWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

/**
 * Checks if a candidate hostname matches the base domain.
 * Supports intelligent www / non-www equivalence and optional subdomains.
 */
export function isSameDomain(candidateHost: string, baseHost: string, includeSubdomains: boolean = false): boolean {
  const cleanCand = candidateHost.toLowerCase();
  const cleanBase = baseHost.toLowerCase();

  const stripCand = stripWww(cleanCand);
  const stripBase = stripWww(cleanBase);

  // Exact match (including www vs non-www equivalence)
  if (stripCand === stripBase) {
    return true;
  }

  // If subdomains are allowed, candidate must end with .baseHost
  if (includeSubdomains) {
    return stripCand.endsWith('.' + stripBase);
  }

  return false;
}

/**
 * Checks whether an extension is an unwanted asset/document/media file.
 */
export function isAssetUrl(pathname: string): boolean {
  const cleanPath = pathname.split('?')[0].split('#')[0];
  const lastDot = cleanPath.lastIndexOf('.');
  if (lastDot === -1) return false;

  const ext = cleanPath.substring(lastDot + 1).toLowerCase();
  return ASSET_EXTENSIONS.has(ext);
}

/**
 * Validates whether a URL protocol is valid HTTP/HTTPS and not ignored protocols.
 */
export function isHttpProtocol(urlStr: string): boolean {
  const lower = urlStr.trim().toLowerCase();
  if (
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('#') ||
    lower.startsWith('sms:') ||
    lower.startsWith('whatsapp:') ||
    lower.startsWith('callto:')
  ) {
    return false;
  }
  return true;
}

/**
 * Checks whether any path segment of a URL or path matches any of the configured ignored slugs.
 * Uses strict path-segment matching (e.g. /community/ and /de/community/ match 'community',
 * but /community-guide does NOT match 'community').
 */
export function hasIgnoredSlug(
  urlOrPath: string,
  ignoredSlugs?: string[] | Set<string>
): boolean {
  if (!urlOrPath || !ignoredSlugs) return false;

  const slugsSet: Set<string> =
    ignoredSlugs instanceof Set
      ? ignoredSlugs
      : new Set(
          ignoredSlugs
            .map((s) => s.trim().toLowerCase().replace(/^\/+|\/+$/g, ''))
            .filter(Boolean)
        );

  if (slugsSet.size === 0) return false;

  let pathname = urlOrPath;
  if (urlOrPath.includes('://')) {
    try {
      pathname = new URL(urlOrPath).pathname;
    } catch {
      pathname = urlOrPath;
    }
  }

  // Strip query params and hashes
  const cleanPath = pathname.split('?')[0].split('#')[0];
  const segments = cleanPath
    .split('/')
    .map((seg) => {
      try {
        return decodeURIComponent(seg).trim().toLowerCase();
      } catch {
        return seg.trim().toLowerCase();
      }
    })
    .filter(Boolean);

  for (const seg of segments) {
    if (slugsSet.has(seg)) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes any link discovered on a page or sitemap.
 * Resolves relative URLs, removes fragments, strips marketing query params,
 * canonicalizes trailing slashes, checks ignored slugs, and verifies domain matching.
 * Returns null if the URL is invalid, an asset, external, or non-webpage.
 */
export function normalizeUrl(
  rawUrl: string,
  baseOriginUrl: string,
  options: {
    includeSubdomains?: boolean;
    allowDifferentScheme?: boolean;
    ignoredSlugs?: string[] | Set<string>;
  } = {}
): {
  normalizedUrl: string;
  isExternal: boolean;
  isAsset: boolean;
  isIgnoredSlug?: boolean;
  rejectedReason?: string;
} | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed || !isHttpProtocol(trimmed)) {
    return null;
  }

  try {
    // Resolve relative or absolute URL against base origin
    const parsed = new URL(trimmed, baseOriginUrl);

    // Only allow HTTP and HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    const baseParsed = new URL(baseOriginUrl);

    // Check same domain
    const sameDomain = isSameDomain(parsed.hostname, baseParsed.hostname, options.includeSubdomains);
    if (!sameDomain) {
      return {
        normalizedUrl: parsed.toString(),
        isExternal: true,
        isAsset: false,
        isIgnoredSlug: false,
        rejectedReason: 'external_domain',
      };
    }

    // Standardize www vs non-www to match the base host format
    const baseWww = baseParsed.hostname.toLowerCase().startsWith('www.');
    const candWww = parsed.hostname.toLowerCase().startsWith('www.');
    if (stripWww(parsed.hostname) === stripWww(baseParsed.hostname)) {
      if (baseWww && !candWww) {
        parsed.hostname = 'www.' + parsed.hostname;
      } else if (!baseWww && candWww) {
        parsed.hostname = parsed.hostname.replace(/^www\./, '');
      }
    }

    // Check if asset
    if (isAssetUrl(parsed.pathname)) {
      return {
        normalizedUrl: parsed.toString(),
        isExternal: false,
        isAsset: true,
        isIgnoredSlug: false,
        rejectedReason: 'asset_file',
      };
    }

    // Remove fragment (#section, #top, etc.)
    parsed.hash = '';

    // Remove tracking / analytics query params while keeping legitimate ones
    const searchParams = new URLSearchParams(parsed.search);
    const keysToRemove: string[] = [];
    for (const key of searchParams.keys()) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      searchParams.delete(key);
    }
    parsed.search = searchParams.toString();

    // Canonicalize trailing slash
    // If root path '/', leave as '/'
    // If has query or sub-path, normalize by removing duplicate slashes
    let pathname = parsed.pathname.replace(/\/+/g, '/');
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;

    // Check ignored slugs (flagged for validation exclusion, but allowed for crawl)
    const isIgnored = Boolean(options.ignoredSlugs && hasIgnoredSlug(parsed.pathname, options.ignoredSlugs));

    return {
      normalizedUrl: parsed.toString(),
      isExternal: false,
      isAsset: false,
      isIgnoredSlug: isIgnored,
    };
  } catch {
    return null;
  }
}
