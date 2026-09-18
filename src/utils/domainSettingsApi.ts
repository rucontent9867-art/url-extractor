import { DomainSettings, ValidationToolId, DomainToolExclusions } from '../types';
import { fetchJson } from './apiUtils';

export async function fetchDomainSettings(domain: string): Promise<DomainSettings> {
  try {
    const data = await fetchJson<{ settings: DomainSettings }>(
      `/api/settings/domain?domain=${encodeURIComponent(domain)}`
    );
    return data.settings;
  } catch (err) {
    console.error('Failed to fetch domain settings:', err);
    return {
      domain,
      global: { ignoredSlugs: [], ignoredExactUrls: [], ignoredPatterns: [] },
      tools: {
        sitemap: { ignoredSlugs: [], ignoredExactUrls: [], ignoredPatterns: [] },
        languageCompleteness: { ignoredSlugs: [], ignoredExactUrls: [], ignoredPatterns: [] },
        contentLanguage: { ignoredSlugs: [], ignoredExactUrls: [], ignoredPatterns: [] },
        headerLanguage: { ignoredSlugs: [], ignoredExactUrls: [], ignoredPatterns: [] },
        amp: { ignoredSlugs: [], ignoredExactUrls: [], ignoredPatterns: [] },
        asset: { ignoredSlugs: [], ignoredExactUrls: [], ignoredPatterns: [] },
        visual: { ignoredSlugs: [], ignoredExactUrls: [], ignoredPatterns: [] },
        interaction: { ignoredSlugs: [], ignoredExactUrls: [], ignoredPatterns: [] },
      },
      updatedAt: Date.now(),
    };
  }
}

export async function saveDomainSettings(domain: string, settings: Partial<DomainSettings>): Promise<DomainSettings> {
  const data = await fetchJson<{ settings: DomainSettings }>('/api/settings/domain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, settings }),
  });
  return data.settings;
}

export async function addDomainExclusion(
  domain: string,
  tool: ValidationToolId | 'global',
  type: 'slug' | 'exact' | 'pattern',
  value: string
): Promise<DomainSettings> {
  const data = await fetchJson<{ settings: DomainSettings }>('/api/settings/domain/exclusion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, tool, type, value }),
  });
  return data.settings;
}

export async function removeDomainExclusion(
  domain: string,
  tool: ValidationToolId | 'global',
  type: 'slug' | 'exact' | 'pattern',
  value: string
): Promise<DomainSettings> {
  const data = await fetchJson<{ settings: DomainSettings }>('/api/settings/domain/exclusion', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, tool, type, value }),
  });
  return data.settings;
}
