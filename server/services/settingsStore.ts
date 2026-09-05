import fs from 'fs';
import path from 'path';

export interface AppCrawlerSettings {
  ignoredSlugs: string[];
  dynamicSelectors: string[];
}

const DEFAULT_SETTINGS: AppCrawlerSettings = {
  ignoredSlugs: ['community'],
  dynamicSelectors: [
    '#chat-widget',
    '.cookie-banner',
    '.cookie-consent',
    '.dynamic-price',
    '.countdown',
    '.current-date',
    '.user-menu',
  ],
};

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'crawler-settings.json');

class SettingsStore {
  private currentSettings: AppCrawlerSettings = { ...DEFAULT_SETTINGS };

  constructor() {
    this.load();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('Failed to create data directory:', err);
      }
    }
  }

  private load(): void {
    try {
      this.ensureDataDir();
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        let slugs: string[] = DEFAULT_SETTINGS.ignoredSlugs;
        if (Array.isArray(parsed?.ignoredSlugs)) {
          slugs = Array.from(
            new Set<string>(
              parsed.ignoredSlugs
                .map((s: any) => String(s).trim().toLowerCase().replace(/^\/+|\/+$/g, ''))
                .filter((s: string) => Boolean(s))
            )
          );
        }

        let selectors: string[] = DEFAULT_SETTINGS.dynamicSelectors;
        if (Array.isArray(parsed?.dynamicSelectors)) {
          selectors = Array.from(
            new Set<string>(
              parsed.dynamicSelectors
                .map((s: any) => String(s).trim())
                .filter((s: string) => Boolean(s))
            )
          );
        }

        this.currentSettings = {
          ignoredSlugs: slugs.length > 0 ? slugs : ['community'],
          dynamicSelectors: selectors.length > 0 ? selectors : DEFAULT_SETTINGS.dynamicSelectors,
        };
        return;
      }
      // If file doesn't exist, create it with defaults
      this.save(DEFAULT_SETTINGS);
    } catch (err) {
      console.error('Error loading crawler settings:', err);
      this.currentSettings = { ...DEFAULT_SETTINGS };
    }
  }

  public save(settings: Partial<AppCrawlerSettings>): void {
    try {
      this.ensureDataDir();
      const updatedSlugs = settings.ignoredSlugs
        ? Array.from(
            new Set<string>(
              settings.ignoredSlugs
                .map((s) => s.trim().toLowerCase().replace(/^\/+|\/+$/g, ''))
                .filter(Boolean)
            )
          )
        : this.currentSettings.ignoredSlugs;

      const updatedSelectors = settings.dynamicSelectors
        ? Array.from(
            new Set<string>(
              settings.dynamicSelectors
                .map((s) => s.trim())
                .filter(Boolean)
            )
          )
        : this.currentSettings.dynamicSelectors;

      this.currentSettings = {
        ignoredSlugs: updatedSlugs,
        dynamicSelectors: updatedSelectors,
      };

      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.currentSettings, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save crawler settings:', err);
    }
  }

  // --- Ignored Slugs ---
  public getIgnoredSlugs(): string[] {
    return [...this.currentSettings.ignoredSlugs];
  }

  public addIgnoredSlug(rawSlug: string): string[] {
    const clean = rawSlug.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    if (!clean) return this.getIgnoredSlugs();

    const current = new Set(this.currentSettings.ignoredSlugs);
    current.add(clean);
    this.save({ ignoredSlugs: Array.from(current) });
    return this.getIgnoredSlugs();
  }

  public removeIgnoredSlug(rawSlug: string): string[] {
    const clean = rawSlug.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    const current = new Set(this.currentSettings.ignoredSlugs);
    current.delete(clean);
    this.save({ ignoredSlugs: Array.from(current) });
    return this.getIgnoredSlugs();
  }

  public setIgnoredSlugs(slugs: string[]): string[] {
    this.save({ ignoredSlugs: slugs });
    return this.getIgnoredSlugs();
  }

  // --- Dynamic Content Selectors ---
  public getDynamicSelectors(): string[] {
    return [...this.currentSettings.dynamicSelectors];
  }

  public addDynamicSelector(rawSelector: string): string[] {
    const clean = rawSelector.trim();
    if (!clean) return this.getDynamicSelectors();

    const current = new Set(this.currentSettings.dynamicSelectors);
    current.add(clean);
    this.save({ dynamicSelectors: Array.from(current) });
    return this.getDynamicSelectors();
  }

  public removeDynamicSelector(rawSelector: string): string[] {
    const clean = rawSelector.trim();
    const current = new Set(this.currentSettings.dynamicSelectors);
    current.delete(clean);
    this.save({ dynamicSelectors: Array.from(current) });
    return this.getDynamicSelectors();
  }

  public setDynamicSelectors(selectors: string[]): string[] {
    this.save({ dynamicSelectors: selectors });
    return this.getDynamicSelectors();
  }
}

export const settingsStore = new SettingsStore();

/**
 * Combines ignored slugs from session settings with stored ignored slugs.
 * Ensures case-insensitivity, trims leading/trailing slashes, and deduplicates.
 */
export function getEffectiveIgnoredSlugs(session?: { settings?: { ignoredSlugs?: string[] } }): string[] {
  const sessionSlugs = session?.settings?.ignoredSlugs || [];
  const storedSlugs = settingsStore.getIgnoredSlugs() || [];
  return Array.from(
    new Set(
      [...sessionSlugs, ...storedSlugs]
        .map((s) => s.trim().toLowerCase().replace(/^\/+|\/+$/g, ''))
        .filter(Boolean)
    )
  );
}
