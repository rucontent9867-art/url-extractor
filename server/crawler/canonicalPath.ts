import { RESERVED_PATH_PREFIXES } from '../../src/utils/canonicalLanguage';

/**
 * Computes canonical path from a URL.
 * Strips origin, leading language prefix (e.g. /cn/, /zh/, /fr/, /de/, /es/, /ru/, /en-us/, /pt-br/, /zh-hans/),
 * and AMP format indicators (e.g. /amp/, .amp.html).
 * Standardizes to / or /pathname (without trailing slash unless root /).
 */
export function getCanonicalPath(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    let pathname = parsed.pathname;

    // Normalize multiple slashes
    pathname = pathname.replace(/\/+/g, '/');

    // Strip leading /amp/ or /amphtml/ if present before or after language prefix
    if (pathname.startsWith('/amp/')) {
      pathname = pathname.substring(4) || '/';
    } else if (pathname.startsWith('/amphtml/')) {
      pathname = pathname.substring(8) || '/';
    }

    // Match leading language prefix:
    // e.g. /cn/, /zh/, /fr/, /de/, /es/, /en-us/, /pt-br/, /zh-cn/, /zh-hans/, etc.
    const match = pathname.match(/^\/([a-z]{2,3}(?:-[a-z]{2,4})?)(\/.*|$)/i);

    if (match) {
      const rawSlug = match[1].toLowerCase();
      const primary = rawSlug.split('-')[0];
      if (!RESERVED_PATH_PREFIXES.has(primary)) {
        const rest = match[2];
        if (!rest || rest === '' || rest === '/') {
          pathname = '/';
        } else {
          pathname = rest;
        }
      }
    }

    // Also strip intermediate /amp/ or trailing /amp or .amp.html from pathname
    if (pathname.startsWith('/amp/')) {
      pathname = pathname.substring(4) || '/';
    } else if (pathname.endsWith('/amp')) {
      pathname = pathname.substring(0, pathname.length - 4) || '/';
    } else if (pathname.includes('/amp/')) {
      pathname = pathname.replace('/amp/', '/');
    }

    if (pathname.endsWith('.amp.html')) {
      pathname = pathname.replace(/\.amp\.html$/i, '') || '/';
    } else if (pathname.endsWith('.amp')) {
      pathname = pathname.replace(/\.amp$/i, '') || '/';
    }

    // Normalize trailing slash: root remains '/', otherwise trim trailing slash
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    return pathname || '/';
  } catch {
    return '/';
  }
}


/**
 * Builds expected translated URL given a canonical path and language code.
 * e.g., baseOrigin = "https://kenya-eta.info", langCode = "fr", canonicalPath = "/faq"
 * returns "https://kenya-eta.info/fr/faq"
 * If canonicalPath = "/", returns "https://kenya-eta.info/fr/"
 */
export function buildLocalizedUrl(baseOrigin: string, langCode: string, canonicalPath: string): string {
  const origin = baseOrigin.replace(/\/+$/, '');
  const cleanCode = langCode.toLowerCase().replace(/^\/+|\/+$/g, '');

  if (canonicalPath === '/' || !canonicalPath) {
    return `${origin}/${cleanCode}/`;
  }

  const cleanPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  return `${origin}/${cleanCode}${cleanPath}`;
}
