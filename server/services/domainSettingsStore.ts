import fs from 'fs';
import path from 'path';
import {
  ValidationToolId,
  ExclusionType,
  ExclusionRule,
  DomainToolExclusions,
  DomainGlobalExclusions,
  DomainSettings,
  IgnoreCheckResult,
  Tool6Settings,
  ExternalUrlValidationMode,
  AssetType,
} from '../../src/types';
import { hasIgnoredSlug } from '../crawler/urlNormalizer';
import { settingsStore } from './settingsStore';

const DATA_DIR = path.join(process.cwd(), 'data');
const DOMAIN_SETTINGS_FILE = path.join(DATA_DIR, 'domain-settings.json');

export const DEFAULT_SOCIAL_DOMAINS: string[] = [
  'facebook.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'linkedin.com',
  'youtube.com',
  'tiktok.com',
  'reddit.com',
  'pinterest.com',
  'whatsapp.com',
  'telegram.org',
];

export function createDefaultTool6Settings(): Tool6Settings {
  return {
    externalUrlValidation: 'none',
    selectedExternalDomains: [],
    enableSocialExclusions: true,
    socialDomains: [...DEFAULT_SOCIAL_DOMAINS],
    timeoutSec: 12,
    maxRedirectsThreshold: 2,
    ignoredAssetTypes: [],
  };
}

const VALID_TOOLS: ValidationToolId[] = [
  'sitemap',
  'languageCompleteness',
  'contentLanguage',
  'headerLanguage',
  'amp',
  'asset',
  'visual',
  'interaction',
];

/**
 * Normalizes a raw domain or URL into a clean hostname key (e.g. "kenya-eta.info")
 */
export function normalizeDomainKey(input: string): string {
  if (!input) return 'default';
  let cleaned = input.trim().toLowerCase();
  if (cleaned.includes('://')) {
    try {
      cleaned = new URL(cleaned).hostname;
    } catch {
      cleaned = cleaned.replace(/^https?:\/\//, '').split('/')[0];
    }
  } else {
    cleaned = cleaned.split('/')[0];
  }
  // Strip port and www prefix
  cleaned = cleaned.split(':')[0].replace(/^www\./, '');
  return cleaned || 'default';
}

/**
 * Normalizes a slug input:
 * e.g. "community", "/community", "/community/" -> slugKey: "community", formatted: "/community/"
 */
export function normalizeSlug(raw: string): { slugKey: string; formatted: string } {
  const clean = raw.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!clean) {
    return { slugKey: '', formatted: '' };
  }
  return {
    slugKey: clean,
    formatted: `/${clean}/`,
  };
}

/**
 * Normalizes an exact URL:
 * e.g. "https://example.com/page/" -> "https://example.com/page"
 */
export function normalizeExactUrl(raw: string, baseDomain?: string): string {
  let cleaned = raw.trim();
  if (!cleaned) return '';

  if (cleaned.startsWith('/') && baseDomain) {
    const protocol = baseDomain.startsWith('http') ? '' : 'https://';
    cleaned = `${protocol}${baseDomain}${cleaned}`;
  }

  try {
    const parsed = new URL(cleaned);
    parsed.hash = '';
    // Canonicalize trailing slash if not root
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return cleaned.replace(/\/+$/, '');
  }
}

/**
 * Normalizes wildcard pattern input:
 * e.g. "/community/*", "* /old-blog/*"
 */
export function normalizePattern(raw: string): string {
  let cleaned = raw.trim();
  if (!cleaned) return '';
  return cleaned.replace(/\/+/g, '/');
}

/**
 * Helper to test wildcard patterns (supports * and ?)
 */
export function testWildcardPattern(urlOrPath: string, pattern: string): boolean {
  if (!pattern || !urlOrPath) return false;
  const cleanPattern = pattern.trim();
  if (!cleanPattern) return false;

  // Build regex from glob pattern
  const escaped = cleanPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  try {
    const regex = new RegExp(`^${escaped}$`, 'i');
    if (regex.test(urlOrPath)) return true;

    // Also test against URL pathname and relative path
    if (urlOrPath.includes('://')) {
      try {
        const u = new URL(urlOrPath);
        if (regex.test(u.pathname)) return true;
        if (regex.test(u.pathname + u.search)) return true;
        // Test with trailing slash variants
        const withSlash = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
        const withoutSlash = u.pathname.length > 1 && u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname;
        if (regex.test(withSlash) || regex.test(withoutSlash)) return true;
      } catch {
        // ignore url parse error
      }
    } else {
      const withSlash = urlOrPath.endsWith('/') ? urlOrPath : `${urlOrPath}/`;
      const withoutSlash = urlOrPath.length > 1 && urlOrPath.endsWith('/') ? urlOrPath.slice(0, -1) : urlOrPath;
      if (regex.test(withSlash) || regex.test(withoutSlash)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function createEmptyToolExclusions(): DomainToolExclusions {
  return {
    ignoredSlugs: [],
    ignoredExactUrls: [],
    ignoredPatterns: [],
    rules: [],
  };
}

function createDefaultDomainSettings(domain: string, initialGlobalSlugs?: string[]): DomainSettings {
  const globalSlugs = initialGlobalSlugs && initialGlobalSlugs.length > 0
    ? Array.from(new Set(initialGlobalSlugs.map((s) => normalizeSlug(s).slugKey).filter(Boolean)))
    : ['community'];

  const globalRules: ExclusionRule[] = globalSlugs.map((slug) => ({
    type: 'slug',
    value: normalizeSlug(slug).formatted,
    createdAt: Date.now(),
  }));

  return {
    domain,
    global: {
      ignoredSlugs: globalSlugs,
      ignoredExactUrls: [],
      ignoredPatterns: [],
      rules: globalRules,
    },
    tools: {
      sitemap: createEmptyToolExclusions(),
      languageCompleteness: createEmptyToolExclusions(),
      contentLanguage: createEmptyToolExclusions(),
      headerLanguage: createEmptyToolExclusions(),
      amp: createEmptyToolExclusions(),
      asset: createEmptyToolExclusions(),
      visual: createEmptyToolExclusions(),
      interaction: createEmptyToolExclusions(),
    },
    tool6: createDefaultTool6Settings(),
    updatedAt: Date.now(),
  };
}

class DomainSettingsStore {
  private domainMap: Map<string, DomainSettings> = new Map();

  constructor() {
    this.load();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('Failed to create data directory for domain settings:', err);
      }
    }
  }

  private load(): void {
    try {
      this.ensureDataDir();
      if (fs.existsSync(DOMAIN_SETTINGS_FILE)) {
        const raw = fs.readFileSync(DOMAIN_SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [key, val] of Object.entries(parsed)) {
            const domainKey = normalizeDomainKey(key);
            this.domainMap.set(domainKey, this.sanitizeDomainSettings(domainKey, val as any));
          }
        }
      }

      // If store is empty, initialize default domain with settings from settingsStore
      if (this.domainMap.size === 0) {
        const defaultSlugs = settingsStore.getIgnoredSlugs();
        const defaultSettings = createDefaultDomainSettings('default', defaultSlugs);
        this.domainMap.set('default', defaultSettings);
        this.persist();
      }
    } catch (err) {
      console.error('Error loading domain settings:', err);
    }
  }

  private persist(): void {
    try {
      this.ensureDataDir();
      const obj: Record<string, DomainSettings> = {};
      for (const [key, val] of this.domainMap.entries()) {
        obj[key] = val;
      }
      fs.writeFileSync(DOMAIN_SETTINGS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist domain settings:', err);
    }
  }

  private sanitizeDomainSettings(domain: string, data: any): DomainSettings {
    const def = createDefaultDomainSettings(domain);

    const globalSlugs: string[] = Array.isArray(data?.global?.ignoredSlugs)
      ? Array.from(new Set(data.global.ignoredSlugs.map((s: any) => normalizeSlug(String(s)).slugKey).filter(Boolean)))
      : def.global.ignoredSlugs;

    const globalExact: string[] = Array.isArray(data?.global?.ignoredExactUrls)
      ? Array.from(new Set(data.global.ignoredExactUrls.map((u: any) => normalizeExactUrl(String(u))).filter(Boolean)))
      : [];

    const globalPatterns: string[] = Array.isArray(data?.global?.ignoredPatterns)
      ? Array.from(new Set(data.global.ignoredPatterns.map((p: any) => normalizePattern(String(p))).filter(Boolean)))
      : [];

    const globalRules: ExclusionRule[] = Array.isArray(data?.global?.rules)
      ? data.global.rules
      : globalSlugs.map((s) => ({ type: 'slug', value: normalizeSlug(s).formatted, createdAt: Date.now() }));

    const toolsData: Record<ValidationToolId, DomainToolExclusions> = {
      sitemap: createEmptyToolExclusions(),
      languageCompleteness: createEmptyToolExclusions(),
      contentLanguage: createEmptyToolExclusions(),
      headerLanguage: createEmptyToolExclusions(),
      amp: createEmptyToolExclusions(),
      asset: createEmptyToolExclusions(),
      visual: createEmptyToolExclusions(),
      interaction: createEmptyToolExclusions(),
    };

    for (const tool of VALID_TOOLS) {
      const t = data?.tools?.[tool];
      if (t) {
        const slugs: string[] = Array.isArray(t.ignoredSlugs)
          ? Array.from(new Set(t.ignoredSlugs.map((s: any) => normalizeSlug(String(s)).slugKey).filter(Boolean)))
          : [];
        const exacts: string[] = Array.isArray(t.ignoredExactUrls)
          ? Array.from(new Set(t.ignoredExactUrls.map((u: any) => normalizeExactUrl(String(u))).filter(Boolean)))
          : [];
        const patterns: string[] = Array.isArray(t.ignoredPatterns)
          ? Array.from(new Set(t.ignoredPatterns.map((p: any) => normalizePattern(String(p))).filter(Boolean)))
          : [];
        const rules: ExclusionRule[] = Array.isArray(t.rules) ? t.rules : [];
        toolsData[tool] = { ignoredSlugs: slugs, ignoredExactUrls: exacts, ignoredPatterns: patterns, rules };
      }
    }

    const tool6Data = data?.tool6;
    const tool6: Tool6Settings = {
      externalUrlValidation:
        tool6Data?.externalUrlValidation === 'all' || tool6Data?.externalUrlValidation === 'selected_domains'
          ? tool6Data.externalUrlValidation
          : 'none',
      selectedExternalDomains: Array.isArray(tool6Data?.selectedExternalDomains)
        ? Array.from(new Set(tool6Data.selectedExternalDomains.map((d: any) => String(d).trim().toLowerCase()).filter(Boolean)))
        : [],
      enableSocialExclusions: tool6Data?.enableSocialExclusions !== undefined ? Boolean(tool6Data.enableSocialExclusions) : true,
      socialDomains: Array.isArray(tool6Data?.socialDomains) && tool6Data.socialDomains.length > 0
        ? Array.from(new Set(tool6Data.socialDomains.map((d: any) => String(d).trim().toLowerCase()).filter(Boolean)))
        : [...DEFAULT_SOCIAL_DOMAINS],
      timeoutSec: typeof tool6Data?.timeoutSec === 'number' && tool6Data.timeoutSec > 0 ? tool6Data.timeoutSec : 12,
      maxRedirectsThreshold: typeof tool6Data?.maxRedirectsThreshold === 'number' && tool6Data.maxRedirectsThreshold >= 0 ? tool6Data.maxRedirectsThreshold : 2,
      ignoredAssetTypes: Array.isArray(tool6Data?.ignoredAssetTypes) ? tool6Data.ignoredAssetTypes : [],
    };

    return {
      domain,
      global: {
        ignoredSlugs: globalSlugs,
        ignoredExactUrls: globalExact,
        ignoredPatterns: globalPatterns,
        rules: globalRules,
      },
      tools: toolsData,
      tool6,
      updatedAt: data?.updatedAt || Date.now(),
    };
  }

  /**
   * Retrieves domain settings for a domain. If not found, initializes from default and global store.
   */
  public getDomainSettings(domainInput: string): DomainSettings {
    const domainKey = normalizeDomainKey(domainInput);
    let settings = this.domainMap.get(domainKey);

    if (!settings) {
      // Check fallback to 'default' or global settings store
      const defaultSlugs = settingsStore.getIgnoredSlugs();
      settings = createDefaultDomainSettings(domainKey, defaultSlugs);
      this.domainMap.set(domainKey, settings);
      this.persist();
    }

    return JSON.parse(JSON.stringify(settings));
  }

  /**
   * Get Tool 6 specific settings for a domain
   */
  public getTool6Settings(domainInput: string): Tool6Settings {
    const settings = this.getDomainSettings(domainInput);
    return settings.tool6 || createDefaultTool6Settings();
  }

  /**
   * Save Tool 6 specific settings for a domain
   */
  public saveTool6Settings(domainInput: string, tool6Update: Partial<Tool6Settings>): Tool6Settings {
    const domainKey = normalizeDomainKey(domainInput);
    const existing = this.getDomainSettings(domainKey);
    const currentTool6 = existing.tool6 || createDefaultTool6Settings();

    const mergedTool6: Tool6Settings = {
      ...currentTool6,
      ...tool6Update,
    };

    existing.tool6 = mergedTool6;
    this.saveDomainSettings(domainKey, existing);
    return mergedTool6;
  }

  /**
   * Saves or replaces full domain settings.
   */
  public saveDomainSettings(domainInput: string, newSettings: Partial<DomainSettings>): DomainSettings {
    const domainKey = normalizeDomainKey(domainInput);
    const existing = this.getDomainSettings(domainKey);

    const merged: DomainSettings = {
      ...existing,
      ...newSettings,
      domain: domainKey,
      updatedAt: Date.now(),
    };

    const sanitized = this.sanitizeDomainSettings(domainKey, merged);
    this.domainMap.set(domainKey, sanitized);
    this.persist();

    // If saving 'default' or current global slugs, sync with legacy settingsStore for crawler compatibility
    if (domainKey === 'default' || sanitized.global.ignoredSlugs.length > 0) {
      settingsStore.setIgnoredSlugs(sanitized.global.ignoredSlugs);
    }

    return JSON.parse(JSON.stringify(sanitized));
  }

  /**
   * Adds an exclusion rule (slug, exact URL, or pattern) to global or a specific tool.
   */
  public addExclusion(
    domainInput: string,
    target: ValidationToolId | 'global',
    type: ExclusionType,
    rawValue: string
  ): DomainSettings {
    const domainKey = normalizeDomainKey(domainInput);
    const settings = this.getDomainSettings(domainKey);

    let normValue = '';
    let slugKey = '';

    if (type === 'slug') {
      const slugRes = normalizeSlug(rawValue);
      if (!slugRes.slugKey) return settings;
      slugKey = slugRes.slugKey;
      normValue = slugRes.formatted;
    } else if (type === 'exact') {
      normValue = normalizeExactUrl(rawValue, domainKey);
      if (!normValue) return settings;
    } else if (type === 'pattern') {
      normValue = normalizePattern(rawValue);
      if (!normValue) return settings;
    }

    const newRule: ExclusionRule = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      value: normValue,
      createdAt: Date.now(),
    };

    if (target === 'global') {
      const g = settings.global;
      if (type === 'slug') {
        const slugSet = new Set(g.ignoredSlugs);
        slugSet.add(slugKey);
        g.ignoredSlugs = Array.from(slugSet);
      } else if (type === 'exact') {
        const exactSet = new Set(g.ignoredExactUrls);
        exactSet.add(normValue);
        g.ignoredExactUrls = Array.from(exactSet);
      } else if (type === 'pattern') {
        const patSet = new Set(g.ignoredPatterns);
        patSet.add(normValue);
        g.ignoredPatterns = Array.from(patSet);
      }
      const existingRules = g.rules || [];
      if (!existingRules.some((r) => r.type === type && r.value.toLowerCase() === normValue.toLowerCase())) {
        g.rules = [...existingRules, newRule];
      }
    } else if (VALID_TOOLS.includes(target as ValidationToolId)) {
      const t = settings.tools[target as ValidationToolId];
      if (type === 'slug') {
        const slugSet = new Set(t.ignoredSlugs);
        slugSet.add(slugKey);
        t.ignoredSlugs = Array.from(slugSet);
      } else if (type === 'exact') {
        const exactSet = new Set(t.ignoredExactUrls);
        exactSet.add(normValue);
        t.ignoredExactUrls = Array.from(exactSet);
      } else if (type === 'pattern') {
        const patSet = new Set(t.ignoredPatterns);
        patSet.add(normValue);
        t.ignoredPatterns = Array.from(patSet);
      }
      const existingRules = t.rules || [];
      if (!existingRules.some((r) => r.type === type && r.value.toLowerCase() === normValue.toLowerCase())) {
        t.rules = [...existingRules, newRule];
      }
    }

    return this.saveDomainSettings(domainKey, settings);
  }

  /**
   * Removes an exclusion rule from global or a specific tool.
   */
  public removeExclusion(
    domainInput: string,
    target: ValidationToolId | 'global',
    type: ExclusionType,
    rawValue: string
  ): DomainSettings {
    const domainKey = normalizeDomainKey(domainInput);
    const settings = this.getDomainSettings(domainKey);

    let matchValue = rawValue.trim().toLowerCase();
    let slugKey = '';
    if (type === 'slug') {
      const slugRes = normalizeSlug(rawValue);
      slugKey = slugRes.slugKey;
      matchValue = slugRes.formatted.toLowerCase();
    }

    if (target === 'global') {
      const g = settings.global;
      if (type === 'slug') {
        g.ignoredSlugs = g.ignoredSlugs.filter((s) => s.toLowerCase() !== slugKey);
      } else if (type === 'exact') {
        g.ignoredExactUrls = g.ignoredExactUrls.filter((u) => u.toLowerCase() !== matchValue && u.toLowerCase() !== rawValue.toLowerCase());
      } else if (type === 'pattern') {
        g.ignoredPatterns = g.ignoredPatterns.filter((p) => p.toLowerCase() !== matchValue && p.toLowerCase() !== rawValue.toLowerCase());
      }
      if (g.rules) {
        g.rules = g.rules.filter((r) => {
          if (r.type !== type) return true;
          if (type === 'slug') {
            return normalizeSlug(r.value).slugKey !== slugKey;
          }
          return r.value.toLowerCase() !== matchValue && r.value.toLowerCase() !== rawValue.toLowerCase();
        });
      }
    } else if (VALID_TOOLS.includes(target as ValidationToolId)) {
      const t = settings.tools[target as ValidationToolId];
      if (type === 'slug') {
        t.ignoredSlugs = t.ignoredSlugs.filter((s) => s.toLowerCase() !== slugKey);
      } else if (type === 'exact') {
        t.ignoredExactUrls = t.ignoredExactUrls.filter((u) => u.toLowerCase() !== matchValue && u.toLowerCase() !== rawValue.toLowerCase());
      } else if (type === 'pattern') {
        t.ignoredPatterns = t.ignoredPatterns.filter((p) => p.toLowerCase() !== matchValue && p.toLowerCase() !== rawValue.toLowerCase());
      }
      if (t.rules) {
        t.rules = t.rules.filter((r) => {
          if (r.type !== type) return true;
          if (type === 'slug') {
            return normalizeSlug(r.value).slugKey !== slugKey;
          }
          return r.value.toLowerCase() !== matchValue && r.value.toLowerCase() !== rawValue.toLowerCase();
        });
      }
    }

    return this.saveDomainSettings(domainKey, settings);
  }
}

export const domainSettingsStore = new DomainSettingsStore();

/**
 * Checks whether any path segment or canonical path of a URL contains the slug or subpath.
 * Supports multi-segment slugs e.g. "visa/old" and single segment slugs e.g. "community".
 * Handles language prefixed URLs (e.g. /fr/community/, /de/community/sub).
 */
export function checkUrlMatchesSlug(urlOrPath: string, slugInput: string): boolean {
  if (!urlOrPath || !slugInput) return false;
  const cleanSlug = slugInput.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!cleanSlug) return false;

  let pathname = urlOrPath;
  if (urlOrPath.includes('://')) {
    try {
      pathname = new URL(urlOrPath).pathname;
    } catch {
      pathname = urlOrPath;
    }
  }

  // Strip query and hash
  const cleanPath = pathname.split('?')[0].split('#')[0].toLowerCase();

  // Multi-segment slug match e.g. "visa/old"
  if (cleanSlug.includes('/')) {
    if (cleanPath.includes(`/${cleanSlug}/`) || cleanPath.endsWith(`/${cleanSlug}`)) {
      return true;
    }
  }

  // Single-segment slug match using segment comparison
  const segments = cleanPath
    .split('/')
    .map((s) => {
      try {
        return decodeURIComponent(s).trim().toLowerCase();
      } catch {
        return s.trim().toLowerCase();
      }
    })
    .filter(Boolean);

  return segments.includes(cleanSlug);
}

/**
 * Central function to evaluate whether a URL/page should be ignored by a specific validation tool
 * based on Global and Tool-Specific exclusions.
 *
 * @param urlOrItem The URL string or object with normalizedUrl / pathname
 * @param tool The validation tool identifier
 * @param domainOrSession The domain hostname, origin, or StoredCrawlSession object
 */
export function shouldIgnoreUrl(
  urlOrItem: string | { normalizedUrl?: string; url?: string; pathname?: string; canonicalPath?: string },
  tool: ValidationToolId,
  domainOrSession?: string | { normalizedDomain?: string; domain?: string; hostname?: string; settings?: any }
): IgnoreCheckResult {
  const urlStr = typeof urlOrItem === 'string'
    ? urlOrItem
    : urlOrItem?.normalizedUrl || urlOrItem?.url || urlOrItem?.pathname || '';

  if (!urlStr) {
    return { ignored: false };
  }

  // Resolve domain key
  let domainKey = 'default';
  if (typeof domainOrSession === 'string' && domainOrSession.trim()) {
    domainKey = normalizeDomainKey(domainOrSession);
  } else if (typeof domainOrSession === 'object' && domainOrSession) {
    const d = domainOrSession.normalizedDomain || domainOrSession.domain || domainOrSession.hostname || '';
    if (d) {
      domainKey = normalizeDomainKey(d);
    }
  }

  if (domainKey === 'default' && urlStr.includes('://')) {
    domainKey = normalizeDomainKey(urlStr);
  }

  const settings = domainSettingsStore.getDomainSettings(domainKey);
  const canonicalPath = typeof urlOrItem === 'object' ? urlOrItem.canonicalPath : undefined;

  // 1. CHECK GLOBAL EXCLUSIONS
  const global = settings.global;

  // A. Global Exact URLs
  if (global.ignoredExactUrls && global.ignoredExactUrls.length > 0) {
    const normCurrent = normalizeExactUrl(urlStr, domainKey);
    for (const exact of global.ignoredExactUrls) {
      if (normCurrent.toLowerCase() === exact.toLowerCase() || urlStr.toLowerCase() === exact.toLowerCase()) {
        return {
          ignored: true,
          reason: `Global exclusion: ${exact}`,
          ruleType: 'global',
          ruleCategory: 'exact',
          ruleValue: exact,
        };
      }
    }
  }

  // B. Global Wildcard Patterns
  if (global.ignoredPatterns && global.ignoredPatterns.length > 0) {
    for (const pattern of global.ignoredPatterns) {
      if (testWildcardPattern(urlStr, pattern)) {
        return {
          ignored: true,
          reason: `Global exclusion (Pattern): ${pattern}`,
          ruleType: 'global',
          ruleCategory: 'pattern',
          ruleValue: pattern,
        };
      }
    }
  }

  // C. Global Slugs
  if (global.ignoredSlugs && global.ignoredSlugs.length > 0) {
    for (const slug of global.ignoredSlugs) {
      if (checkUrlMatchesSlug(urlStr, slug) || (canonicalPath && checkUrlMatchesSlug(canonicalPath, slug))) {
        return {
          ignored: true,
          reason: `Global exclusion: /${slug}/`,
          ruleType: 'global',
          ruleCategory: 'slug',
          ruleValue: `/${slug}/`,
        };
      }
    }
  }

  // 2. CHECK TOOL-SPECIFIC EXCLUSIONS
  const toolSettings = settings.tools[tool];
  if (toolSettings) {
    // A. Tool Exact URLs
    if (toolSettings.ignoredExactUrls && toolSettings.ignoredExactUrls.length > 0) {
      const normCurrent = normalizeExactUrl(urlStr, domainKey);
      for (const exact of toolSettings.ignoredExactUrls) {
        if (normCurrent.toLowerCase() === exact.toLowerCase() || urlStr.toLowerCase() === exact.toLowerCase()) {
          return {
            ignored: true,
            reason: `Tool-specific exclusion: ${exact}`,
            ruleType: 'tool',
            ruleCategory: 'exact',
            ruleValue: exact,
          };
        }
      }
    }

    // B. Tool Wildcard Patterns
    if (toolSettings.ignoredPatterns && toolSettings.ignoredPatterns.length > 0) {
      for (const pattern of toolSettings.ignoredPatterns) {
        if (testWildcardPattern(urlStr, pattern)) {
          return {
            ignored: true,
            reason: `Tool-specific exclusion (Pattern): ${pattern}`,
            ruleType: 'tool',
            ruleCategory: 'pattern',
            ruleValue: pattern,
          };
        }
      }
    }

    // C. Tool Slugs
    if (toolSettings.ignoredSlugs && toolSettings.ignoredSlugs.length > 0) {
      for (const slug of toolSettings.ignoredSlugs) {
        if (checkUrlMatchesSlug(urlStr, slug) || (canonicalPath && checkUrlMatchesSlug(canonicalPath, slug))) {
          return {
            ignored: true,
            reason: `Tool-specific exclusion: /${slug}/`,
            ruleType: 'tool',
            ruleCategory: 'slug',
            ruleValue: `/${slug}/`,
          };
        }
      }
    }
  }

  return { ignored: false };
}
