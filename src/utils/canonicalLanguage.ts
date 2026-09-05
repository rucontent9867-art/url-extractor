/**
 * Centralized Canonical Language Mapping System
 * 
 * Maps language codes, URL slugs, locale variants, and non-standard aliases
 * to standardized canonical ISO 639-1 language codes and clean display names.
 * 
 * Ensures all validators (Content Language, Language Completeness, Header Navigation,
 * and Crawler URL Detection) compare normalized language identities, preventing false mismatches
 * like "Language (CN)" vs "Chinese".
 */

export interface CanonicalLanguage {
  code: string;
  name: string;
  isKnown: boolean;
  baseCode: string;
  rawSlug?: string;
}

// 1. Primary Canonical Languages Map (ISO 639-1 code -> Standard English Name)
export const CANONICAL_LANGUAGES: Record<string, string> = {
  en: 'English',
  zh: 'Chinese',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  es: 'Spanish',
  ru: 'Russian',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  ar: 'Arabic',
  ja: 'Japanese',
  ko: 'Korean',
  hi: 'Hindi',
  id: 'Indonesian',
  vi: 'Vietnamese',
  th: 'Thai',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
  el: 'Greek',
  cs: 'Czech',
  hu: 'Hungarian',
  ro: 'Romanian',
  uk: 'Ukrainian',
  he: 'Hebrew',
  bg: 'Bulgarian',
  ca: 'Catalan',
  hr: 'Croatian',
  sk: 'Slovak',
  sl: 'Slovenian',
  sr: 'Serbian',
  lt: 'Lithuanian',
  lv: 'Latvian',
  et: 'Estonian',
  fa: 'Persian',
  ms: 'Malay',
  bn: 'Bengali',
  tl: 'Filipino',
  is: 'Icelandic',
  ga: 'Irish',
  af: 'Afrikaans',
  sw: 'Swahili',
};

// 2. Comprehensive Alias & Slug Map (URL slug / locale / alias -> canonical ISO code)
export const LANGUAGE_SLUG_ALIASES: Record<string, string> = {
  // --- Chinese ---
  cn: 'zh',
  zh: 'zh',
  'zh-cn': 'zh',
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  'zh-tw': 'zh',
  'zh-hk': 'zh',
  'zh-sg': 'zh',
  'zh-mo': 'zh',
  zho: 'zh',
  chi: 'zh',
  chinese: 'zh',
  mandarin: 'zh',
  tw: 'zh',
  hk: 'zh',
  '中文': 'zh',
  '汉语': 'zh',
  '漢語': 'zh',

  // --- English ---
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  'en-au': 'en',
  'en-ca': 'en',
  'en-nz': 'en',
  'en-ie': 'en',
  'en-za': 'en',
  'en-in': 'en',
  'en-sg': 'en',
  eng: 'en',
  english: 'en',
  us: 'en',
  gb: 'en',
  uk: 'uk', // Note: 'uk' is ISO for Ukrainian, but 'en-gb' is English

  // --- French ---
  fr: 'fr',
  'fr-fr': 'fr',
  'fr-ca': 'fr',
  'fr-be': 'fr',
  'fr-ch': 'fr',
  'fr-lu': 'fr',
  'fr-mc': 'fr',
  fra: 'fr',
  fre: 'fr',
  french: 'fr',
  francais: 'fr',
  'français': 'fr',

  // --- German ---
  de: 'de',
  'de-de': 'de',
  'de-at': 'de',
  'de-ch': 'de',
  'de-lu': 'de',
  'de-li': 'de',
  deu: 'de',
  ger: 'de',
  german: 'de',
  deutsch: 'de',

  // --- Spanish ---
  es: 'es',
  'es-es': 'es',
  'es-mx': 'es',
  'es-ar': 'es',
  'es-co': 'es',
  'es-cl': 'es',
  'es-pe': 'es',
  'es-us': 'es',
  'es-ve': 'es',
  'es-ec': 'es',
  'es-gt': 'es',
  'es-cu': 'es',
  'es-bo': 'es',
  'es-do': 'es',
  'es-hn': 'es',
  'es-py': 'es',
  'es-sv': 'es',
  'es-ni': 'es',
  'es-cr': 'es',
  'es-pr': 'es',
  'es-pa': 'es',
  'es-uy': 'es',
  spa: 'es',
  spanish: 'es',
  espanol: 'es',
  'español': 'es',

  // --- Italian ---
  it: 'it',
  'it-it': 'it',
  'it-ch': 'it',
  'it-sm': 'it',
  ita: 'it',
  italian: 'it',
  italiano: 'it',

  // --- Portuguese ---
  pt: 'pt',
  'pt-pt': 'pt',
  'pt-br': 'pt',
  'pt-ao': 'pt',
  'pt-mz': 'pt',
  br: 'pt',
  por: 'pt',
  portuguese: 'pt',
  portugues: 'pt',
  'português': 'pt',

  // --- Russian ---
  ru: 'ru',
  'ru-ru': 'ru',
  'ru-by': 'ru',
  'ru-kz': 'ru',
  'ru-ua': 'ru',
  rus: 'ru',
  russian: 'ru',
  'русский': 'ru',

  // --- Japanese ---
  ja: 'ja',
  jp: 'ja',
  'ja-jp': 'ja',
  'jp-jp': 'ja',
  jpn: 'ja',
  japanese: 'ja',
  '日本語': 'ja',

  // --- Korean ---
  ko: 'ko',
  kr: 'ko',
  'ko-kr': 'ko',
  'kr-kr': 'ko',
  kor: 'ko',
  korean: 'ko',
  '한국어': 'ko',

  // --- Arabic ---
  ar: 'ar',
  'ar-sa': 'ar',
  'ar-ae': 'ar',
  'ar-eg': 'ar',
  'ar-qa': 'ar',
  'ar-kw': 'ar',
  'ar-bh': 'ar',
  'ar-om': 'ar',
  'ar-jo': 'ar',
  'ar-lb': 'ar',
  'ar-iq': 'ar',
  'ar-ma': 'ar',
  'ar-dz': 'ar',
  'ar-tn': 'ar',
  ara: 'ar',
  arabic: 'ar',
  'العربية': 'ar',
  'عربي': 'ar',

  // --- Greek ---
  el: 'el',
  gr: 'el',
  'el-gr': 'el',
  'el-cy': 'el',
  ell: 'el',
  gre: 'el',
  greek: 'el',
  'ελληνικά': 'el',

  // --- Czech ---
  cs: 'cs',
  cz: 'cs',
  'cs-cz': 'cs',
  'cz-cz': 'cs',
  ces: 'cs',
  cze: 'cs',
  czech: 'cs',
  'čeština': 'cs',
  cestina: 'cs',

  // --- Ukrainian ---
  ua: 'uk',
  'uk-ua': 'uk',
  'ua-ua': 'uk',
  ukr: 'uk',
  ukrainian: 'uk',
  'українська': 'uk',

  // --- Danish ---
  da: 'da',
  dk: 'da',
  'da-dk': 'da',
  'dk-dk': 'da',
  dan: 'da',
  danish: 'da',
  dansk: 'da',

  // --- Swedish ---
  sv: 'sv',
  se: 'sv',
  'sv-se': 'sv',
  'se-se': 'sv',
  swe: 'sv',
  swedish: 'sv',
  svenska: 'sv',

  // --- Dutch ---
  nl: 'nl',
  'nl-nl': 'nl',
  'nl-be': 'nl',
  nld: 'nl',
  dut: 'nl',
  dutch: 'nl',
  nederlands: 'nl',

  // --- Polish ---
  pl: 'pl',
  'pl-pl': 'pl',
  pol: 'pl',
  polish: 'pl',
  polski: 'pl',

  // --- Turkish ---
  tr: 'tr',
  'tr-tr': 'tr',
  tur: 'tr',
  turkish: 'tr',
  'türkçe': 'tr',
  turkce: 'tr',

  // --- Vietnamese ---
  vi: 'vi',
  vn: 'vi',
  'vi-vn': 'vi',
  'vn-vn': 'vi',
  vie: 'vi',
  vietnamese: 'vi',
  'tiếng việt': 'vi',
  'tieng viet': 'vi',

  // --- Indonesian ---
  id: 'id',
  'id-id': 'id',
  ind: 'id',
  indonesian: 'id',
  'bahasa indonesia': 'id',

  // --- Thai ---
  th: 'th',
  'th-th': 'th',
  tha: 'th',
  thai: 'th',
  'ไทย': 'th',

  // --- Hindi ---
  hi: 'hi',
  'hi-in': 'hi',
  hin: 'hi',
  hindi: 'hi',
  'हिन्दी': 'hi',
  'हिंदी': 'hi',

  // --- Romanian ---
  ro: 'ro',
  'ro-ro': 'ro',
  'ro-md': 'ro',
  ron: 'ro',
  rum: 'ro',
  romanian: 'ro',
  'română': 'ro',
  romana: 'ro',

  // --- Hungarian ---
  hu: 'hu',
  'hu-hu': 'hu',
  hun: 'hu',
  hungarian: 'hu',
  magyar: 'hu',

  // --- Norwegian ---
  no: 'no',
  nb: 'no',
  nn: 'no',
  'no-no': 'no',
  'nb-no': 'no',
  'nn-no': 'no',
  nor: 'no',
  norwegian: 'no',
  norsk: 'no',

  // --- Finnish ---
  fi: 'fi',
  'fi-fi': 'fi',
  fin: 'fi',
  finnish: 'fi',
  suomi: 'fi',

  // --- Hebrew ---
  he: 'he',
  iw: 'he',
  'he-il': 'he',
  'iw-il': 'he',
  heb: 'he',
  hebrew: 'he',
  'עבריت': 'he',
  'עברית': 'he',

  // --- Bulgarian ---
  bg: 'bg',
  'bg-bg': 'bg',
  bul: 'bg',
  bulgarian: 'bg',
  'български': 'bg',

  // --- Catalan ---
  ca: 'ca',
  'ca-es': 'ca',
  cat: 'ca',
  catalan: 'ca',
  'català': 'ca',
  catala: 'ca',

  // --- Croatian ---
  hr: 'hr',
  'hr-hr': 'hr',
  hrv: 'hr',
  croatian: 'hr',
  hrvatski: 'hr',

  // --- Slovak ---
  sk: 'sk',
  'sk-sk': 'sk',
  slk: 'sk',
  slo: 'sk',
  slovak: 'sk',
  'slovenčina': 'sk',
  slovencina: 'sk',

  // --- Slovenian ---
  sl: 'sl',
  'sl-si': 'sl',
  slv: 'sl',
  slovenian: 'sl',
  'slovenščina': 'sl',
  slovenscina: 'sl',

  // --- Serbian ---
  sr: 'sr',
  'sr-rs': 'sr',
  'sr-ba': 'sr',
  'sr-me': 'sr',
  srp: 'sr',
  serbian: 'sr',
  'српски': 'sr',
  srpski: 'sr',

  // --- Lithuanian ---
  lt: 'lt',
  'lt-lt': 'lt',
  lit: 'lt',
  lithuanian: 'lt',
  'lietuvių': 'lt',
  lietuviu: 'lt',

  // --- Latvian ---
  lv: 'lv',
  'lv-lv': 'lv',
  lav: 'lv',
  latvian: 'lv',
  'latviešu': 'lv',
  latviesu: 'lv',

  // --- Estonian ---
  et: 'et',
  'et-ee': 'et',
  est: 'et',
  estonian: 'et',
  eesti: 'et',

  // --- Persian ---
  fa: 'fa',
  'fa-ir': 'fa',
  'fa-af': 'fa',
  fas: 'fa',
  per: 'fa',
  persian: 'fa',
  farsi: 'fa',
  'فارسی': 'fa',

  // --- Malay ---
  ms: 'ms',
  'ms-my': 'ms',
  'ms-sg': 'ms',
  'ms-bn': 'ms',
  msa: 'ms',
  may: 'ms',
  malay: 'ms',
  'bahasa melayu': 'ms',

  // --- Bengali ---
  bn: 'bn',
  'bn-bd': 'bn',
  'bn-in': 'bn',
  ben: 'bn',
  bengali: 'bn',
  'বাংলা': 'bn',

  // --- Filipino / Tagalog ---
  tl: 'tl',
  fil: 'tl',
  'tl-ph': 'tl',
  'fil-ph': 'tl',
  filipino: 'tl',
  tagalog: 'tl',

  // --- Icelandic ---
  is: 'is',
  'is-is': 'is',
  isl: 'is',
  ice: 'is',
  icelandic: 'is',
  'íslenska': 'is',
  islenska: 'is',

  // --- Irish ---
  ga: 'ga',
  'ga-ie': 'ga',
  gle: 'ga',
  irish: 'ga',
  gaeilge: 'ga',

  // --- Afrikaans ---
  af: 'af',
  'af-za': 'af',
  afr: 'af',
  afrikaans: 'af',

  // --- Swahili ---
  sw: 'sw',
  'sw-ke': 'sw',
  'sw-tz': 'sw',
  'sw-ug': 'sw',
  swa: 'sw',
  swahili: 'sw',
  kiswahili: 'sw',
};

// Reserved non-language path segments that should NOT be treated as language slugs
// NOTE: 'amp' and 'amphtml' are accelerated mobile page delivery formats, NOT localized languages.
export const RESERVED_PATH_PREFIXES = new Set([
  'api', 'app', 'cdn', 'img', 'css', 'js', 'cgi', 'bin', 'src', 'lib',
  'assets', 'media', 'static', 'admin', 'auth', 'login', 'docs', 'dist',
  'fonts', 'images', 'icons', 'uploads', 'files', 'public', 'vendor',
  'amp', 'amphtml', 'amp-story', 'amp-stories', 'accelerated-mobile-pages',
]);

/**
 * Checks whether a URL represents an AMP (Accelerated Mobile Page) alternate format.
 * NOTE: AMP is a mobile rendering format paired with canonical web pages, NOT a language.
 */
export function isAmpUrl(urlStr: string): boolean {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    // Check path segments: /amp/, /amp, /amphtml/, .amp.html, .amp/
    if (
      pathname === '/amp' ||
      pathname === '/amp/' ||
      pathname.startsWith('/amp/') ||
      pathname.includes('/amp/') ||
      pathname.endsWith('/amp') ||
      pathname.endsWith('.amp') ||
      pathname.includes('.amp.') ||
      pathname.includes('.amp.html') ||
      pathname.startsWith('/amphtml/') ||
      pathname.includes('/amphtml/')
    ) {
      return true;
    }

    // Check query parameters: ?amp=1, ?amp=true, ?amp, ?output=amp
    const searchParams = parsed.searchParams;
    if (
      searchParams.has('amp') ||
      searchParams.get('output') === 'amp' ||
      searchParams.get('format') === 'amp' ||
      search.includes('amp=1') ||
      search.includes('amp=true')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Normalizes any language slug, ISO code, locale variant, or alias into a canonical 2-letter ISO code.
 * Example:
 * normalizeLanguageCode('cn') -> 'zh'
 * normalizeLanguageCode('zh-hans') -> 'zh'
 * normalizeLanguageCode('en-us') -> 'en'
 * normalizeLanguageCode('fr') -> 'fr'
 * normalizeLanguageCode('default') -> 'en'
 */
export function normalizeLanguageCode(input: string | null | undefined): string {
  if (!input) return 'en';
  const clean = input.trim().toLowerCase();
  if (clean === 'default' || clean === '' || clean === 'amp' || clean === 'amphtml') return 'en';

  if (LANGUAGE_SLUG_ALIASES[clean]) {
    return LANGUAGE_SLUG_ALIASES[clean];
  }

  // Check base code before hyphen (e.g., 'es-419' -> 'es')
  if (clean.includes('-')) {
    const base = clean.split('-')[0];
    if (LANGUAGE_SLUG_ALIASES[base]) {
      return LANGUAGE_SLUG_ALIASES[base];
    }
    if (CANONICAL_LANGUAGES[base]) {
      return base;
    }
  }

  // Check if directly in canonical languages
  if (CANONICAL_LANGUAGES[clean]) {
    return clean;
  }

  return clean;
}

/**
 * Retrieves the full canonical language profile for a given slug, code, or name.
 */
export function getCanonicalLanguage(slugOrCodeOrName: string | null | undefined): CanonicalLanguage {
  if (
    !slugOrCodeOrName ||
    slugOrCodeOrName === 'default' ||
    slugOrCodeOrName === '' ||
    slugOrCodeOrName.toLowerCase() === 'amp' ||
    slugOrCodeOrName.toLowerCase() === 'amphtml'
  ) {
    return {
      code: 'en',
      name: 'English',
      isKnown: true,
      baseCode: 'en',
      rawSlug: 'default',
    };
  }

  const clean = slugOrCodeOrName.trim().toLowerCase();

  // 1. Direct alias match
  if (LANGUAGE_SLUG_ALIASES[clean]) {
    const canonicalCode = LANGUAGE_SLUG_ALIASES[clean];
    const canonicalName = CANONICAL_LANGUAGES[canonicalCode] || canonicalCode.toUpperCase();
    return {
      code: canonicalCode,
      name: canonicalName,
      isKnown: true,
      baseCode: canonicalCode,
      rawSlug: clean,
    };
  }

  // 2. Base code match (e.g. 'zh-cn' -> 'zh')
  if (clean.includes('-')) {
    const base = clean.split('-')[0];
    if (LANGUAGE_SLUG_ALIASES[base]) {
      const canonicalCode = LANGUAGE_SLUG_ALIASES[base];
      const canonicalName = CANONICAL_LANGUAGES[canonicalCode] || canonicalCode.toUpperCase();
      return {
        code: canonicalCode,
        name: canonicalName,
        isKnown: true,
        baseCode: canonicalCode,
        rawSlug: clean,
      };
    }
    if (CANONICAL_LANGUAGES[base]) {
      return {
        code: base,
        name: CANONICAL_LANGUAGES[base],
        isKnown: true,
        baseCode: base,
        rawSlug: clean,
      };
    }
  }

  // 3. Known canonical language direct key
  if (CANONICAL_LANGUAGES[clean]) {
    return {
      code: clean,
      name: CANONICAL_LANGUAGES[clean],
      isKnown: true,
      baseCode: clean,
      rawSlug: clean,
    };
  }

  // 4. Case-insensitive reverse match on language name (e.g. "Chinese" -> "zh")
  for (const [code, name] of Object.entries(CANONICAL_LANGUAGES)) {
    if (name.toLowerCase() === clean) {
      return {
        code,
        name,
        isKnown: true,
        baseCode: code,
        rawSlug: clean,
      };
    }
  }

  // 5. Unknown slug
  const upper = clean.toUpperCase();
  return {
    code: clean,
    name: `Unknown (${upper})`,
    isKnown: false,
    baseCode: clean,
    rawSlug: clean,
  };
}

/**
 * Extracts and canonicalizes the language slug from a full URL path.
 * Supports /cn/, /zh/, /fr-fr/, /pt-br/, /en/, etc.
 * NOTE: AMP prefixes (e.g. /amp/) are recognized as delivery formats and ignored
 * during language resolution, ensuring AMP pages correctly identify their true language.
 */
export function extractUrlLanguage(urlStr: string): {
  rawSlug: string;
  canonicalCode: string;
  canonicalName: string;
  isDefault: boolean;
  isKnown: boolean;
  displayName: string;
} {
  try {
    const parsed = new URL(urlStr);
    let pathname = parsed.pathname.toLowerCase();

    // Strip leading /amp/ or /amphtml/ if present before checking for language slug
    if (pathname.startsWith('/amp/')) {
      pathname = pathname.substring(4);
    } else if (pathname.startsWith('/amphtml/')) {
      pathname = pathname.substring(8);
    }

    // Match leading locale segment: e.g. /cn/, /zh-cn/, /zh-hans/, /fr/, /en-us/
    const match = pathname.match(/^\/([a-z]{2,3}(?:-[a-z]{2,4})?)(?:\/|$)/);

    if (match) {
      const rawSlug = match[1];

      // Exclude reserved technical path prefixes (e.g. /api/, /app/, /cdn/, /amp/)
      const primary = rawSlug.split('-')[0];
      if (!RESERVED_PATH_PREFIXES.has(primary)) {
        const canonical = getCanonicalLanguage(rawSlug);
        const isEnglish = canonical.code === 'en' && (rawSlug === 'en' || rawSlug === 'default');

        let displayName = canonical.name;
        if (rawSlug !== canonical.code && canonical.isKnown) {
          displayName = `${canonical.name} (${rawSlug.toUpperCase()})`;
        } else if (!canonical.isKnown) {
          displayName = `${rawSlug.toUpperCase()} (Unknown)`;
        }

        return {
          rawSlug,
          canonicalCode: canonical.code,
          canonicalName: canonical.name,
          isDefault: isEnglish,
          isKnown: canonical.isKnown,
          displayName,
        };
      }
    }

    // Default English for root or un-prefixed URLs
    return {
      rawSlug: 'default',
      canonicalCode: 'en',
      canonicalName: 'English',
      isDefault: true,
      isKnown: true,
      displayName: 'Default / English',
    };
  } catch {
    return {
      rawSlug: 'default',
      canonicalCode: 'en',
      canonicalName: 'English',
      isDefault: true,
      isKnown: true,
      displayName: 'Default / English',
    };
  }
}
