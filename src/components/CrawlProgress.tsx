import React from 'react';
import { CrawlStats } from '../types';
import { Loader2, Globe, FileText, CheckCircle2, AlertTriangle, Layers, Filter, ShieldAlert, Ban } from 'lucide-react';

interface CrawlProgressProps {
  stats: CrawlStats;
  liveMessage?: string;
  onStop: () => void;
}

export const CrawlProgress: React.FC<CrawlProgressProps> = ({ stats, liveMessage, onStop }) => {
  const isSitemapping = stats.status === 'discovering_sitemaps';
  const isCrawling = stats.status === 'crawling';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
      {/* Top Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm text-slate-900">
                {isSitemapping ? 'Discovering Sitemaps & Robots.txt...' : 'Recursively Crawling Website...'}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">
                Live Active
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono truncate max-w-md">
              {stats.normalizedDomain}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {liveMessage && (
            <span className="text-xs text-slate-500 italic max-w-xs truncate hidden md:inline">
              {liveMessage}
            </span>
          )}
          <button
            type="button"
            onClick={onStop}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            Stop Crawl
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Pages Crawled */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Pages Crawled</span>
            <FileText className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
            {stats.pagesCrawled.toLocaleString()}
          </div>
        </div>

        {/* Unique URLs Found */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Unique URLs</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 font-mono">
            {stats.uniqueUrlsCount.toLocaleString()}
          </div>
        </div>

        {/* Queue Remaining */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Queue Remaining</span>
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-700 font-mono">
            {stats.queueRemaining.toLocaleString()}
          </div>
        </div>

        {/* Languages Detected */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Languages</span>
            <Globe className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
            {stats.languagesDetected}
          </div>
        </div>
      </div>

      {/* Secondary Clean Filter Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
          <span className="flex items-center space-x-1">
            <Filter className="h-3 w-3 text-slate-400" />
            <span>Duplicates Removed</span>
          </span>
          <span className="font-semibold text-slate-800 font-mono">{stats.duplicatesRemoved}</span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
          <span className="flex items-center space-x-1">
            <Ban className="h-3 w-3 text-slate-400" />
            <span>Assets Excluded</span>
          </span>
          <span className="font-semibold text-slate-800 font-mono">{stats.assetsIgnored}</span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
          <span className="flex items-center space-x-1">
            <Globe className="h-3 w-3 text-slate-400" />
            <span>External Skipped</span>
          </span>
          <span className="font-semibold text-slate-800 font-mono">{stats.externalUrlsIgnored}</span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
          <span className="flex items-center space-x-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <span>Failed / Errors</span>
          </span>
          <span className={`font-semibold font-mono ${stats.failedRequests > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {stats.failedRequests}
          </span>
        </div>
      </div>

      {/* Current URL being visited */}
      {stats.currentUrl && (
        <div className="pt-1">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Currently crawling:</span>
          </div>
          <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs truncate select-all shadow-inner border border-slate-800">
            {stats.currentUrl}
          </div>
        </div>
      )}
    </div>
  );
};
