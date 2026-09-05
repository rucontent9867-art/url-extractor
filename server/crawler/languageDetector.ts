import { LanguageInfo } from '../../src/types';
import {
  CANONICAL_LANGUAGES,
  LANGUAGE_SLUG_ALIASES,
  extractUrlLanguage,
  getCanonicalLanguage,
  normalizeLanguageCode,
} from '../../src/utils/canonicalLanguage';

export { CANONICAL_LANGUAGES, LANGUAGE_SLUG_ALIASES };

// Re-export KNOWN_LANGUAGES for backward compatibility
export const KNOWN_LANGUAGES: Record<string, string> = CANONICAL_LANGUAGES;

/**
 * Detects language from URL path using canonical normalization.
 * If URL has a language prefix (e.g., /cn/, /zh/, /fr/, /de/, /es/, /ru/, /en-us/, /pt-br/),
 * returns that language with canonical ISO code and clean display name.
 * Otherwise, returns "Default / English".
 */
export function detectUrlLanguage(urlStr: string): {
  code: string;
  name: string;
  displayName: string;
  isDefault: boolean;
  rawSlug?: string;
  canonicalCode?: string;
  isKnown?: boolean;
} {
  const extracted = extractUrlLanguage(urlStr);

  return {
    code: extracted.rawSlug === 'default' ? 'default' : extracted.rawSlug,
    name: extracted.canonicalName,
    displayName: extracted.displayName,
    isDefault: extracted.isDefault,
    rawSlug: extracted.rawSlug,
    canonicalCode: extracted.canonicalCode,
    isKnown: extracted.isKnown,
  };
}

