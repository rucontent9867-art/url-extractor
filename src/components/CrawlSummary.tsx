import React from 'react';
import { CrawlStats, LanguageInfo } from '../types';
import { CheckCircle, AlertCircle, RefreshCw, Trash2, Download, Copy, ExternalLink, Clock, Layers, ShieldCheck } from 'lucide-react';
import { formatDuration } from '../utils/formatUtils';

interface CrawlSummaryProps {
  stats: CrawlStats;
  onRecrawl: () => void;
  onClear: () => void;
  onCopyAll: () => void;
  onDownloadCsv: () => void;
  onStartValidation?: () => void;
  copied: boolean;
}

export const CrawlSummary: React.FC<CrawlSummaryProps> = ({
  stats,
  onRecrawl,
  onClear,
  onCopyAll,
  onDownloadCsv,
  onStartValidation,
  copied,
}) => {
  const isCompleted = stats.status === 'completed';
  const isStopped = stats.status === 'stopped';
  const isError = stats.status === 'error';

  const durationMs = stats.completedAt && stats.startedAt ? stats.completedAt - stats.startedAt : 0;
  const rawLangs = stats.languageCounts ? (Object.values(stats.languageCounts) as LanguageInfo[]) : [];
  const languagesList: LanguageInfo[] = rawLangs.sort((a, b) => b.count - a.count);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Banner Header */}
      <div
        className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isCompleted
            ? 'bg-emerald-50 border-b border-emerald-100 text-emerald-900'
            : isStopped
            ? 'bg-amber-50 border-b border-amber-100 text-amber-900'
            : 'bg-rose-50 border-b border-rose-100 text-rose-900'
        }`}
      >
        <div className="flex items-center space-x-3">
          {isCompleted ? (
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CheckCircle className="h-5 w-5" />
            </div>
          ) : isStopped ? (
            <div className="h-9 w-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Clock className="h-5 w-5" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <AlertCircle className="h-5 w-5" />
            </div>
          )}

          <div>
            <h3 className="font-bold text-base">
              {isCompleted ? 'Crawl Completed Successfully' : isStopped ? 'Crawl Stopped by User' : 'Crawl Completed with Errors'}
            </h3>
            <p className="text-xs opacity-80">
              Domain:{' '}
              <a
                href={stats.normalizedDomain}
                target="_blank"
                rel="noreferrer"
                className="underline font-mono inline-flex items-center gap-1 hover:opacity-100"
              >
                {stats.normalizedDomain}
                <ExternalLink className="h-3 w-3" />
              </a>
              {durationMs > 0 && <span className="ml-2 font-sans font-medium">• Elapsed: {formatDuration(durationMs)}</span>}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {onStartValidation && (
            <button
              type="button"
              onClick={onStartValidation}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Run Website Validation</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCopyAll}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center space-x-1.5 shadow-2xs"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>{copied ? 'Copied All!' : 'Copy All URLs'}</span>
          </button>

          <button
            type="button"
            onClick={onDownloadCsv}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center space-x-1.5 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </button>

          <button
            type="button"
            onClick={onRecrawl}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center space-x-1.5 shadow-2xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Recrawl Website</span>
          </button>

          <button
            type="button"
            onClick={onClear}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Clear Results"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Numerical Metrics Summary */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase block">Pages Crawled</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
              {stats.pagesCrawled.toLocaleString()}
            </span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase block">Unique URLs</span>
            <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
              {stats.uniqueUrlsCount.toLocaleString()}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase block">Duplicates Removed</span>
            <span className="text-xl font-bold font-mono text-slate-800 mt-1 block">
              {stats.duplicatesRemoved.toLocaleString()}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase block">Assets Ignored</span>
            <span className="text-xl font-bold font-mono text-slate-800 mt-1 block">
              {stats.assetsIgnored.toLocaleString()}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase block">External Ignored</span>
            <span className="text-xl font-bold font-mono text-slate-800 mt-1 block">
              {stats.externalUrlsIgnored.toLocaleString()}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase block">Failed Requests</span>
            <span
              className={`text-xl font-bold font-mono mt-1 block ${
                stats.failedRequests > 0 ? 'text-rose-600' : 'text-slate-800'
              }`}
            >
              {stats.failedRequests.toLocaleString()}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase block">Languages</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
              {stats.languagesDetected}
            </span>
          </div>
        </div>

        {/* Language Breakdown Section */}
        {languagesList.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span>Languages Discovered on Domain ({stats.languagesDetected}):</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {languagesList.map((lang) => (
                <div
                  key={lang.code}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                >
                  <span className="font-medium text-slate-700 truncate mr-2" title={lang.name}>
                    {lang.name}
                  </span>
                  <span className="font-bold font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-900 shrink-0">
                    {lang.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
