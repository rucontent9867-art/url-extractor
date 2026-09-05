import React, { useState } from 'react';
import { CrawlSettings } from '../types';
import { Sliders, Zap, Clock, Network, RotateCcw, Filter, Plus, Trash2, Check, AlertCircle } from 'lucide-react';

interface AdvancedSettingsProps {
  settings: CrawlSettings;
  onChange: (updated: CrawlSettings) => void;
  disabled?: boolean;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  settings,
  onChange,
  disabled = false,
}) => {
  const [newSlugInput, setNewSlugInput] = useState('');
  const [slugError, setSlugError] = useState('');
  const [saveFeedback, setSaveFeedback] = useState('');

  const [newSelectorInput, setNewSelectorInput] = useState('');
  const [selectorError, setSelectorError] = useState('');
  const [selectorFeedback, setSelectorFeedback] = useState('');

  const ignoredSlugs = settings.ignoredSlugs || ['community'];
  const dynamicSelectors = settings.dynamicSelectors || [
    '.cookie-banner',
    '#cookie-banner',
    '#chat-widget',
    '.chat-widget',
    '.price',
    '.timer',
    '.countdown',
    '[data-dynamic]',
  ];

  const handleChange = <K extends keyof CrawlSettings>(key: K, value: CrawlSettings[K]) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const handleAddSlug = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSlugError('');
    const clean = newSlugInput.trim().toLowerCase().replace(/^\/+|\/+$/g, '');

    if (!clean) {
      setSlugError('Please enter a valid slug (e.g. blog or community)');
      return;
    }

    if (ignoredSlugs.includes(clean)) {
      setSlugError(`Slug "${clean}" is already in the ignored list`);
      return;
    }

    const updated = [...ignoredSlugs, clean];
    handleChange('ignoredSlugs', updated);
    setNewSlugInput('');

    // Persist permanently to backend
    try {
      await fetch('/api/settings/ignored-slugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: clean }),
      });
      setSaveFeedback(`Added "${clean}" (permanently saved)`);
      setTimeout(() => setSaveFeedback(''), 3000);
    } catch (err) {
      console.error('Failed to persist slug to backend:', err);
    }
  };

  const handleRemoveSlug = async (slugToRemove: string) => {
    const updated = ignoredSlugs.filter((s) => s !== slugToRemove);
    handleChange('ignoredSlugs', updated);

    // Persist permanently to backend
    try {
      await fetch(`/api/settings/ignored-slugs/${encodeURIComponent(slugToRemove)}`, {
        method: 'DELETE',
      });
      setSaveFeedback(`Removed "${slugToRemove}" (permanently saved)`);
      setTimeout(() => setSaveFeedback(''), 3000);
    } catch (err) {
      console.error('Failed to remove slug from backend:', err);
    }
  };

  const handleAddSelector = async (selectorToAdd?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSelectorError('');
    const raw = selectorToAdd !== undefined ? selectorToAdd : newSelectorInput;
    const clean = raw.trim();

    if (!clean) {
      setSelectorError('Please enter a valid CSS selector (e.g. .cookie-banner)');
      return;
    }

    if (dynamicSelectors.includes(clean)) {
      setSelectorError(`Selector "${clean}" is already in the list`);
      return;
    }

    const updated = [...dynamicSelectors, clean];
    handleChange('dynamicSelectors', updated);
    if (selectorToAdd === undefined) {
      setNewSelectorInput('');
    }

    try {
      await fetch('/api/settings/dynamic-selectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector: clean }),
      });
      setSelectorFeedback(`Added "${clean}" (saved)`);
      setTimeout(() => setSelectorFeedback(''), 3000);
    } catch (err) {
      console.error('Failed to persist dynamic selector:', err);
    }
  };

  const handleRemoveSelector = async (selectorToRemove: string) => {
    const updated = dynamicSelectors.filter((s) => s !== selectorToRemove);
    handleChange('dynamicSelectors', updated);

    try {
      await fetch(`/api/settings/dynamic-selectors/${encodeURIComponent(selectorToRemove)}`, {
        method: 'DELETE',
      });
      setSelectorFeedback(`Removed "${selectorToRemove}" (saved)`);
      setTimeout(() => setSelectorFeedback(''), 3000);
    } catch (err) {
      console.error('Failed to remove selector:', err);
    }
  };

  const handleReset = async () => {
    const defaultSlugs = ['community'];
    const defaultSelectors = [
      '.cookie-banner',
      '#cookie-banner',
      '#chat-widget',
      '.chat-widget',
      '.price',
      '.timer',
      '.countdown',
      '[data-dynamic]',
    ];
    onChange({
      maxPages: 10000,
      concurrency: 15,
      requestTimeout: 15,
      respectRobotsTxt: true,
      followRedirects: true,
      includeSubdomains: false,
      userAgent: 'Mozilla/5.0 (compatible; DomainCrawlerBot/1.0; +https://ai.studio)',
      confidenceThreshold: 90,
      ignoredSlugs: defaultSlugs,
      dynamicSelectors: defaultSelectors,
    });

    try {
      await Promise.all([
        fetch('/api/settings/ignored-slugs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slugs: defaultSlugs }),
        }),
        fetch('/api/settings/dynamic-selectors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectors: defaultSelectors }),
        }),
      ]);
      setSaveFeedback('Reset to defaults');
      setTimeout(() => setSaveFeedback(''), 3000);
    } catch (err) {
      console.error('Failed to reset settings:', err);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <Sliders className="h-4 w-4 text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-900">Advanced Crawler Configuration</h3>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          className="inline-flex items-center text-xs text-slate-500 hover:text-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset Defaults
        </button>
      </div>

      {/* Ignored URL Slugs Section */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center flex-wrap gap-2">
            <Filter className="h-4 w-4 text-rose-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Ignored URL Slugs (For Validations Only)
            </h4>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {ignoredSlugs.length} active
            </span>
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
              Crawled Normally • Excluded From Validations
            </span>
          </div>
          {saveFeedback && (
            <span className="text-xs font-medium text-emerald-600 flex items-center space-x-1">
              <Check className="h-3 w-3" />
              <span>{saveFeedback}</span>
            </span>
          )}
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Path segments that are <strong>crawled normally and included in all URL tables</strong>, but{' '}
          <strong>strictly excluded and ignored from all validation checks</strong> (Sitemap Coverage, Language Completeness missing translations, and Content Language Validation).
          For example, matching <code className="bg-slate-100 px-1 rounded text-slate-800">/community/</code> or{' '}
          <code className="bg-slate-100 px-1 rounded text-slate-800">/fr/community/</code> will be crawled, but will never trigger translation errors or sitemap missing flags.
        </p>

        {/* List of current ignored slugs */}
        <div className="space-y-2">
          {ignoredSlugs.length === 0 ? (
            <div className="text-xs text-slate-400 italic py-1">No ignored slugs configured.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ignoredSlugs.map((slug) => (
                <div
                  key={slug}
                  className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className="text-slate-400 font-mono">/</span>
                    <span className="font-mono font-semibold text-slate-800 truncate">{slug}</span>
                    <span className="text-slate-400 font-mono">/</span>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemoveSlug(slug)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 cursor-pointer ml-2"
                    title={`Remove "${slug}"`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Slug input and button */}
        <form onSubmit={handleAddSlug} className="flex items-center space-x-2 pt-1">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-mono text-xs">
              /
            </span>
            <input
              type="text"
              value={newSlugInput}
              onChange={(e) => {
                setNewSlugInput(e.target.value);
                setSlugError('');
              }}
              disabled={disabled}
              placeholder="e.g. community, blog, news, test, old-pages"
              className="w-full pl-6 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={disabled || !newSlugInput.trim()}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Slug</span>
          </button>
        </form>

        {slugError && (
          <div className="flex items-center space-x-1 text-xs text-rose-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{slugError}</span>
          </div>
        )}
      </div>

      {/* Dynamic Content Selectors Section */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-indigo-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Dynamic Content Selectors (Ignored in Language Analysis)
            </h4>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {dynamicSelectors.length} active
            </span>
          </div>
          {selectorFeedback && (
            <span className="text-xs font-medium text-emerald-600 flex items-center space-x-1">
              <Check className="h-3 w-3" />
              <span>{selectorFeedback}</span>
            </span>
          )}
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Dynamic components like cookie notices, interactive chat widgets, countdown timers, and live prices
          are stripped out prior to running content language validation, preventing false language mismatch flags.
        </p>

        {/* List of current dynamic selectors */}
        <div className="space-y-2">
          {dynamicSelectors.length === 0 ? (
            <div className="text-xs text-slate-400 italic py-1">No dynamic selectors configured.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dynamicSelectors.map((selector) => (
                <div
                  key={selector}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-indigo-50/60 border border-indigo-200 rounded-lg text-xs"
                >
                  <span className="font-mono font-medium text-indigo-900">{selector}</span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemoveSelector(selector)}
                    className="p-0.5 rounded text-indigo-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 cursor-pointer ml-1"
                    title={`Remove selector "${selector}"`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick add suggestions */}
        <div className="flex items-center flex-wrap gap-1.5 pt-1 text-[11px] text-slate-500">
          <span className="font-medium text-slate-600">Quick add:</span>
          {['.cookie-banner', '#chat-widget', '.price', '.timer', '.countdown', '#drift-widget', '.currency-picker']
            .filter((preset) => !dynamicSelectors.includes(preset))
            .slice(0, 4)
            .map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={disabled}
                onClick={() => handleAddSelector(preset)}
                className="px-2 py-0.5 rounded border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 font-mono text-slate-700 transition-colors cursor-pointer"
              >
                + {preset}
              </button>
            ))}
        </div>

        {/* Add selector input */}
        <form onSubmit={(e) => handleAddSelector(undefined, e)} className="flex items-center space-x-2 pt-1">
          <input
            type="text"
            value={newSelectorInput}
            onChange={(e) => {
              setNewSelectorInput(e.target.value);
              setSelectorError('');
            }}
            disabled={disabled}
            placeholder="e.g. .cookie-banner, #chat-widget, .price, .countdown"
            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !newSelectorInput.trim()}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Selector</span>
          </button>
        </form>

        {selectorError && (
          <div className="flex items-center space-x-1 text-xs text-rose-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{selectorError}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {/* Maximum Pages */}
        <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <label className="flex items-center justify-between font-medium text-slate-700">
            <span className="flex items-center space-x-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-600" />
              <span>Max Pages to Crawl</span>
            </span>
            <span className="font-semibold text-slate-900">{settings.maxPages.toLocaleString()}</span>
          </label>
          <input
            type="range"
            min="100"
            max="15000"
            step="100"
            value={settings.maxPages}
            disabled={disabled}
            onChange={(e) => handleChange('maxPages', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 disabled:opacity-50"
          />
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>100</span>
            <span>5,000</span>
            <span>15,000</span>
          </div>
        </div>

        {/* Concurrency */}
        <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <label className="flex items-center justify-between font-medium text-slate-700">
            <span className="flex items-center space-x-1.5">
              <Network className="h-3.5 w-3.5 text-indigo-600" />
              <span>Simultaneous Requests</span>
            </span>
            <span className="font-semibold text-slate-900">{settings.concurrency} workers</span>
          </label>
          <input
            type="range"
            min="1"
            max="30"
            step="1"
            value={settings.concurrency}
            disabled={disabled}
            onChange={(e) => handleChange('concurrency', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 disabled:opacity-50"
          />
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>1 (safe)</span>
            <span>15 (default fast)</span>
            <span>30 (max)</span>
          </div>
        </div>

        {/* Request Timeout */}
        <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <label className="flex items-center justify-between font-medium text-slate-700">
            <span className="flex items-center space-x-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span>Request Timeout</span>
            </span>
            <span className="font-semibold text-slate-900">{settings.requestTimeout} seconds</span>
          </label>
          <input
            type="range"
            min="5"
            max="45"
            step="5"
            value={settings.requestTimeout}
            disabled={disabled}
            onChange={(e) => handleChange('requestTimeout', Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 disabled:opacity-50"
          />
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>5s</span>
            <span>15s (default)</span>
            <span>45s</span>
          </div>
        </div>
      </div>

      {/* Boolean Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <label className="flex items-center space-x-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={settings.respectRobotsTxt}
            disabled={disabled}
            onChange={(e) => handleChange('respectRobotsTxt', e.target.checked)}
            className="h-4 w-4 rounded text-slate-900 focus:ring-slate-800 border-slate-300"
          />
          <div className="text-xs">
            <span className="font-medium text-slate-800 block">Respect robots.txt</span>
            <span className="text-[11px] text-slate-500">Honor Disallow paths</span>
          </div>
        </label>

        <label className="flex items-center space-x-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={settings.followRedirects}
            disabled={disabled}
            onChange={(e) => handleChange('followRedirects', e.target.checked)}
            className="h-4 w-4 rounded text-slate-900 focus:ring-slate-800 border-slate-300"
          />
          <div className="text-xs">
            <span className="font-medium text-slate-800 block">Follow Redirects</span>
            <span className="text-[11px] text-slate-500">Follow 301/302 hops</span>
          </div>
        </label>

        <label className="flex items-center space-x-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={settings.includeSubdomains}
            disabled={disabled}
            onChange={(e) => handleChange('includeSubdomains', e.target.checked)}
            className="h-4 w-4 rounded text-slate-900 focus:ring-slate-800 border-slate-300"
          />
          <div className="text-xs">
            <span className="font-medium text-slate-800 block">Include Subdomains</span>
            <span className="text-[11px] text-slate-500">Allow *.domain.com</span>
          </div>
        </label>
      </div>

      {/* Custom User Agent */}
      <div className="pt-1">
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Custom HTTP User-Agent Header
        </label>
        <input
          type="text"
          value={settings.userAgent || ''}
          disabled={disabled}
          onChange={(e) => handleChange('userAgent', e.target.value)}
          placeholder="Mozilla/5.0 (compatible; DomainCrawlerBot/1.0; +https://ai.studio)"
          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
        />
      </div>
    </div>
  );
};
