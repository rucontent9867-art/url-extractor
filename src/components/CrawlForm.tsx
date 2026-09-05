import React, { useState } from 'react';
import { Play, Square, Settings2, Globe, Sparkles, AlertCircle, Filter } from 'lucide-react';
import { CrawlSettings, CrawlStatus } from '../types';
import { AdvancedSettings } from './AdvancedSettings';

interface CrawlFormProps {
  urlInput: string;
  setUrlInput: (val: string) => void;
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
  status,
  settings,
  setSettings,
  onStartCrawl,
  onStopCrawl,
  errorMessage,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isCrawling = status === 'crawling' || status === 'discovering_sitemaps';

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
    { label: 'example.com', url: 'https://example.com/' },
    { label: 'httpbin.org', url: 'https://httpbin.org/' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="url-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
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
                placeholder="Enter domain (e.g. kenya-eta.info or https://example.com/)"
                disabled={isCrawling}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm sm:text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all disabled:opacity-75 disabled:cursor-not-allowed font-mono"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`px-3.5 py-3 rounded-xl border transition-all flex items-center space-x-1.5 cursor-pointer ${
                  showAdvanced
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                title="Crawler settings & custom slug exclusions"
              >
                <Settings2 className="h-4 w-4 shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap">Settings & Slugs</span>
                {settings.ignoredSlugs && settings.ignoredSlugs.length > 0 && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    showAdvanced ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {settings.ignoredSlugs.length}
                  </span>
                )}
              </button>

              {isCrawling ? (
                <button
                  type="button"
                  onClick={onStopCrawl}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <Square className="h-4 w-4 fill-white" />
                  <span>Stop Crawl</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>Start Crawl</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick presets and sample inputs */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
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
            <span>Validation-Ignored Slugs: {settings.ignoredSlugs?.map(s => `/${s}/`).join(', ') || 'None'}</span>
          </button>
          <span className="text-xs text-slate-400 ml-auto hidden sm:inline">
            Supports both <code className="text-slate-600">domain.com</code> and <code className="text-slate-600">https://...</code>
          </span>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Crawling issue encountered:</p>
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
