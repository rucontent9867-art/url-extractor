import React from 'react';
import { Globe, Compass, ShieldCheck, ListOrdered, Layers, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export type MainNavTab = 'crawler' | 'urls' | 'languages' | 'validation';

interface HeaderProps {
  serverHealthy: boolean | null;
  activeTab: MainNavTab;
  onSelectTab: (tab: MainNavTab) => void;
  totalUrls: number;
  languagesCount: number;
  validationStatus?: 'passed' | 'warning' | 'error' | 'not_run';
}

export const Header: React.FC<HeaderProps> = ({
  serverHealthy,
  activeTab,
  onSelectTab,
  totalUrls,
  languagesCount,
  validationStatus,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top brand row */}
        <div className="py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs ring-1 ring-slate-800">
              <Globe className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  Website URL Crawler & SEO/Localization Validator
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Production Suite
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                Recursive BFS crawler • Sitemap discovery • Canonical path matching • Content language validator
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              <span
                className={`h-2 w-2 rounded-full ${
                  serverHealthy === true
                    ? 'bg-emerald-500 animate-pulse'
                    : serverHealthy === false
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
                }`}
              />
              <span className="font-medium text-[11px]">
                {serverHealthy === true
                  ? 'Engine Ready'
                  : serverHealthy === false
                  ? 'Server Offline'
                  : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 sm:space-x-2 border-t border-slate-100 pt-1 -mb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => onSelectTab('crawler')}
            className={`py-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'crawler'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Crawler</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('urls')}
            className={`py-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'urls'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <ListOrdered className="h-3.5 w-3.5" />
            <span>URLs</span>
            {totalUrls > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-700">
                {totalUrls}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('languages')}
            className={`py-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'languages'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Languages</span>
            {languagesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-700">
                {languagesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('validation')}
            className={`py-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'validation'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Validation</span>
            {validationStatus && validationStatus !== 'not_run' && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  validationStatus === 'passed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : validationStatus === 'warning'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {validationStatus === 'passed' ? 'Pass' : validationStatus === 'warning' ? 'Warning' : 'Issues'}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
