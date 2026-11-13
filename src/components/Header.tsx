import React from 'react';
import { Globe, Compass, ShieldCheck, ListOrdered, LayoutGrid, Sparkles } from 'lucide-react';

export type MainNavTab = 'tools_hub' | 'crawler' | 'urls' | 'validation';

interface HeaderProps {
  serverHealthy: boolean | null;
  activeTab: MainNavTab;
  onSelectTab: (tab: MainNavTab) => void;
  totalUrls: number;
  languagesCount: number;
  validationStatus?: 'passed' | 'warning' | 'error' | 'not_run';
  isDemoMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  serverHealthy,
  activeTab,
  onSelectTab,
  totalUrls,
  languagesCount,
  validationStatus,
  isDemoMode,
}) => {
  const tabs: Array<{
    id: MainNavTab;
    label: string;
    hint: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    {
      id: 'tools_hub',
      label: 'Start',
      hint: 'Audit a website',
      icon: <LayoutGrid className="h-3.5 w-3.5 text-emerald-600" />,
    },
    {
      id: 'validation',
      label: 'Results',
      hint: 'What needs fixing',
      icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />,
      badge:
        validationStatus && validationStatus !== 'not_run'
          ? validationStatus === 'passed'
            ? 'Pass'
            : validationStatus === 'warning'
            ? 'Warning'
            : 'Issues'
          : undefined,
    },
    {
      id: 'urls',
      label: 'Pages',
      hint: totalUrls > 0 ? `${totalUrls} pages found` : 'Pages found by the crawl',
      icon: <ListOrdered className="h-3.5 w-3.5" />,
      badge: totalUrls > 0 ? String(totalUrls) : undefined,
    },
    {
      id: 'crawler',
      label: 'Crawl',
      hint: 'Crawl options and a specific URL list',
      icon: <Compass className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Brand row */}
        <div className="py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs ring-1 ring-slate-800">
              <Globe className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">Website Audit</h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  13 checks
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                Crawl any site · find broken links · catch missing translations · spot layout bugs
                {languagesCount > 0 ? ` · ${languagesCount} language${languagesCount === 1 ? '' : 's'} detected` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            {isDemoMode && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                <Sparkles className="h-3 w-3 text-emerald-600" />
                <span>Sample data</span>
              </span>
            )}
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
                {serverHealthy === true ? 'Ready' : serverHealthy === false ? 'Server offline' : 'Connecting…'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation: four plain steps, not twelve tools */}
        <nav className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-1 -mb-px" aria-label="Main">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                title={tab.hint}
                aria-current={isActive ? 'page' : undefined}
                className={`py-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      tab.id === 'validation'
                        ? tab.badge === 'Pass'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tab.badge === 'Warning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
