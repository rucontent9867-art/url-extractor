import React, { useState } from 'react';
import {
  Play,
  Square,
  Settings2,
  Globe,
  Sparkles,
  AlertCircle,
  Filter,
  ListPlus,
  Zap,
  Clipboard,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { CrawlSettings, CrawlStatus } from '../types';
import { AdvancedSettings } from './AdvancedSettings';

interface CrawlFormProps {
  urlInput: string;
  setUrlInput: (val: string) => void;
  urlListInput: string;
  setUrlListInput: (val: string) => void;
  crawlMode: 'domain' | 'url_list';
  setCrawlMode: (mode: 'domain' | 'url_list') => void;
  status: CrawlStatus;
  settings: CrawlSettings;
  setSettings: (settings: CrawlSettings) => void;
  onStartCrawl: () => void;
  onStopCrawl: () => void;
  errorMessage?: string;
}

export const CrawlForm: React.FC<CrawlFormProps> = ({
  urlInput,
  setUrlInput,
  urlListInput,
  setUrlListInput,
  crawlMode,
  setCrawlMode,
  status,
  settings,
  setSettings,
  onStartCrawl,
  onStopCrawl,
  errorMessage,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isCrawling = status === 'crawling' || status === 'discovering_sitemaps';

  const parsedUrlCount = React.useMemo(() => {
    if (!urlListInput.trim()) return 0;
    return urlListInput
      .split(/[\r\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && (u.startsWith('http://') || u.startsWith('https://') || u.includes('.'))).length;
  }, [urlListInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCrawling) {
      onStopCrawl();
    } else {
      onStartCrawl();
    }
  };

  const sampleDomains = [
    { label: 'kenya-eta.info', url: 'https://kenya-eta.info/' },
    { label: 'togo-evisa.com', url: 'https://togo-evisa.com/' },
    { label: 'example.com', url: 'https://example.com/' },
  ];

  const handleLoadTogoExample = () => {
    setCrawlMode('url_list');
    setUrlListInput(
      'https://togo-evisa.com/tourist-evisa/\nhttps://togo-evisa.com/business-visa/'
    );
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlListInput((prev) => (prev ? `${prev}\n${text.trim()}` : text.trim()));
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
      {/* Mode Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            disabled={isCrawling}
            onClick={() => setCrawlMode('url_list')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
              crawlMode === 'url_list'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Target URL List (Fast Validation)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200">
              Instant
            </span>
          </button>

          <button
            type="button"
            disabled={isCrawling}
            onClick={() => setCrawlMode('domain')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
              crawlMode === 'domain'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-emerald-600" />
            <span>Full Website Crawl (Domain Mode)</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
              showAdvanced
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="Configure crawler settings, concurrency, and custom slug exclusions"
          >
            <Settings2 className="h-3.5 w-3.5 shrink-0" />
            <span>Settings & Rules</span>
            {settings.ignoredSlugs && settings.ignoredSlugs.length > 0 && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  showAdvanced ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {settings.ignoredSlugs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* MODE 1: TARGET URL LIST */}
        {crawlMode === 'url_list' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="url-list-input"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Provide Specific Website URLs to Validate
              </label>
              <div className="flex items-center space-x-2 text-xs">
                {parsedUrlCount > 0 && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[11px] font-medium">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>{parsedUrlCount} {parsedUrlCount === 1 ? 'URL' : 'URLs'} detected</span>
                  </span>
                )}
                <button
                  type="button"
                  disabled={isCrawling}
                  onClick={handlePasteClipboard}
                  className="text-slate-500 hover:text-slate-800 flex items-center space-x-1 hover:underline cursor-pointer"
                >
                  <Clipboard className="h-3 w-3" />
                  <span>Paste</span>
                </button>
                {urlListInput && (
                  <button
                    type="button"
                    disabled={isCrawling}
                    onClick={() => setUrlListInput('')}
                    className="text-rose-500 hover:text-rose-700 flex items-center space-x-1 hover:underline cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            <textarea
              id="url-list-input"
              rows={4}
              value={urlListInput}
              onChange={(e) => setUrlListInput(e.target.value)}
              placeholder={`Enter URLs one per line, e.g.:\nhttps://togo-evisa.com/tourist-evisa/\nhttps://togo-evisa.com/business-visa/`}
              disabled={isCrawling}
              className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all disabled:opacity-75 disabled:cursor-not-allowed leading-relaxed"
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Quick example:</span>
                <button
                  type="button"
                  disabled={isCrawling}
                  onClick={handleLoadTogoExample}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 text-amber-600" />
                  <span>Togo eVisa (Tourist + Business)</span>
                </button>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                {isCrawling ? (
                  <button
                    type="button"
                    onClick={onStopCrawl}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                  >
                    <Square className="h-4 w-4 fill-white" />
                    <span>Stop Validation</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={parsedUrlCount === 0}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    <Zap className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span>Check & Validate URLs (Ultra-Fast)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* MODE 2: DOMAIN CRAWL */
          <div>
            <label
              htmlFor="url-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2"
            >
              Target Website Domain or URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Globe className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="url-input"
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Enter domain (e.g. togo-evisa.com or https://kenya-eta.info/)"
                  disabled={isCrawling}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm sm:text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all disabled:opacity-75 disabled:cursor-not-allowed font-mono"
                />
              </div>

              <div className="flex items-center space-x-2">
                {isCrawling ? (
                  <button
                    type="button"
                    onClick={onStopCrawl}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                  >
                    <Square className="h-4 w-4 fill-white" />
                    <span>Stop Crawl</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!urlInput.trim()}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-white" />
                    <span>Start Crawl</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick presets and sample inputs */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-slate-500 font-medium">Try example:</span>
              {sampleDomains.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  disabled={isCrawling}
                  onClick={() => setUrlInput(sample.url)}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50"
                >
                  {sample.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                title="Configure URL slugs that will be ignored during validation checks"
              >
                <Filter className="h-3 w-3 text-rose-600" />
                <span>
                  Ignored Slugs: {settings.ignoredSlugs?.map((s) => `/${s}/`).join(', ') || 'None'}
                </span>
              </button>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Crawling / validation issue encountered:</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}
      </form>

      {/* Collapsible Advanced Settings Panel */}
      {showAdvanced && (
        <div className="pt-2 animate-fadeIn">
          <AdvancedSettings
            settings={settings}
            onChange={setSettings}
            disabled={isCrawling}
          />
        </div>
      )}
    </div>
  );
};
