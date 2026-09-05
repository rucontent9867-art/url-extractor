import React, { useState, useMemo } from 'react';
import { SitemapValidationResult, SitemapValidationItem } from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Search,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Settings,
  EyeOff,
  Sliders,
} from 'lucide-react';
import {
  copyStringListToClipboard,
  downloadSitemapValidationCsv,
  downloadStringListAsTxt,
} from '../../utils/exportUtils';
import { ToolExclusionSettingsModal } from './ToolExclusionSettingsModal';

interface SitemapValidationProps {
  result: SitemapValidationResult | null;
  isLoading: boolean;
  domain?: string;
  onRunValidation: () => void;
}

type FilterStatus = 'all' | 'missing' | 'sitemap_only' | 'correct' | 'ignored';

export const SitemapValidation: React.FC<SitemapValidationProps> = ({
  result,
  isLoading,
  domain = '',
  onRunValidation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [copiedMissing, setCopiedMissing] = useState(false);
  const [copiedRowUrl, setCopiedRowUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const filteredItems = useMemo(() => {
    if (!result) return [];
    let items = result.items;

    if (statusFilter !== 'all') {
      items = items.filter((item) => item.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      items = items.filter(
        (item) =>
          item.url.toLowerCase().includes(lower) ||
          item.canonicalPath.toLowerCase().includes(lower) ||
          (item.ignoreReason && item.ignoreReason.toLowerCase().includes(lower))
      );
    }

    return items;
  }, [result, statusFilter, searchTerm]);

  const handleCopyMissing = async () => {
    if (!result || result.missingUrls.length === 0) return;
    const ok = await copyStringListToClipboard(result.missingUrls);
    if (ok) {
      setCopiedMissing(true);
      setTimeout(() => setCopiedMissing(false), 2000);
    }
  };

  const handleCopyRow = async (url: string) => {
    const ok = await copyStringListToClipboard([url]);
    if (ok) {
      setCopiedRowUrl(url);
      setTimeout(() => setCopiedRowUrl(null), 1800);
    }
  };

  if (!result) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Sitemap Coverage Validator (English URLs vs. Sitemap)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Verifies that all discovered English/default-language webpage URLs are present in the XML
              sitemap, while strictly ignoring alternative-language paths (/fr/, /de/, etc.) and configured exclusions.
            </p>
          </div>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              type="button"
              onClick={onRunValidation}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center space-x-2 transition-all shadow-xs"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              <span>{isLoading ? 'Analyzing Sitemap...' : 'Run Sitemap Validation'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 inline-flex items-center space-x-1.5 transition-all"
            >
              <Settings className="h-4 w-4 text-slate-500" />
              <span>Sitemap Exclusions</span>
            </button>
          </div>
        </div>

        <ToolExclusionSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          toolId="sitemap"
          toolName="Sitemap Validator"
          domain={domain}
          onSettingsUpdated={onRunValidation}
        />
      </div>
    );
  }

  const ignoredCount = result.ignoredCount ?? result.pagesIgnored ?? (result.ignoredUrls?.length || 0);
  const pagesChecked = result.pagesChecked ?? (result.totalEnglishPages - ignoredCount);

  return (
    <div className="space-y-5">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {/* Coverage Card */}
        <div className="col-span-2 sm:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Coverage</div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span
              className={`text-2xl font-bold font-mono ${
                result.coveragePercent === 100
                  ? 'text-emerald-600'
                  : result.coveragePercent >= 90
                  ? 'text-amber-600'
                  : 'text-rose-600'
              }`}
            >
              {result.coveragePercent}%
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {result.foundInSitemap} of {pagesChecked} checked
          </div>
        </div>

        {/* Total English Pages */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">English Pages</div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-900">
            {result.totalEnglishPages}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Discovered total</div>
        </div>

        {/* Pages Checked */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">Checked</div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-800">
            {pagesChecked}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Validated URLs</div>
        </div>

        {/* Present in Sitemap */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>In Sitemap</span>
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-emerald-600">
            {result.foundInSitemap}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600/70">Matched perfectly</div>
        </div>

        {/* Missing from Sitemap */}
        <div
          className={`p-4 rounded-xl border shadow-2xs ${
            result.missingFromSitemap > 0
              ? 'bg-rose-50/60 border-rose-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div
            className={`text-[11px] font-medium uppercase tracking-wider flex items-center space-x-1 ${
              result.missingFromSitemap > 0 ? 'text-rose-700' : 'text-slate-500'
            }`}
          >
            <XCircle className="h-3 w-3" />
            <span>Missing</span>
          </div>
          <div
            className={`mt-1 text-2xl font-bold font-mono ${
              result.missingFromSitemap > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {result.missingFromSitemap}
          </div>
          <div className="mt-1 text-[11px] text-rose-600/80">Needs addition</div>
        </div>

        {/* Ignored Pages */}
        <div
          onClick={() => setStatusFilter('ignored')}
          className={`p-4 rounded-xl border shadow-2xs cursor-pointer transition-all ${
            ignoredCount > 0
              ? 'bg-slate-50/80 border-slate-300 hover:bg-slate-100/80'
              : 'bg-white border-slate-200'
          }`}
          title="Click to view ignored URLs"
        >
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center space-x-1">
            <EyeOff className="h-3 w-3 text-slate-400" />
            <span>Ignored</span>
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-700">
            {ignoredCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Excluded by rules</div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search URL, path, or ignore reason..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
            }`}
          >
            All ({result.items.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('missing')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              statusFilter === 'missing'
                ? 'bg-rose-600 text-white font-semibold'
                : 'hover:text-slate-900 text-rose-700'
            }`}
          >
            Missing ({result.missingFromSitemap})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('sitemap_only')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              statusFilter === 'sitemap_only'
                ? 'bg-amber-600 text-white font-semibold'
                : 'hover:text-slate-900 text-amber-700'
            }`}
          >
            Sitemap-Only ({result.sitemapOnlyCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('correct')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              statusFilter === 'correct'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'hover:text-slate-900 text-emerald-700'
            }`}
          >
            Present ({result.foundInSitemap})
          </button>
          {ignoredCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('ignored')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'ignored'
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'hover:text-slate-900 text-slate-600'
              }`}
            >
              Ignored ({ignoredCount})
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {result.missingFromSitemap > 0 && (
            <>
              <button
                type="button"
                onClick={handleCopyMissing}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 flex items-center space-x-1.5 transition-colors shadow-2xs"
              >
                {copiedMissing ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedMissing ? 'Copied!' : `Copy Missing (${result.missingFromSitemap})`}</span>
              </button>
              <button
                type="button"
                onClick={() => downloadStringListAsTxt(result.missingUrls, 'missing-sitemap-urls.txt')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors shadow-2xs"
              >
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>Download Missing (TXT)</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => downloadSitemapValidationCsv(result.items, 'sitemap-coverage-report.csv')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>CSV Report</span>
          </button>

          {/* Exclusions Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 flex items-center space-x-1.5 transition-colors"
            title="Configure Sitemap Exclusions"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-600" />
            <span>Sitemap Exclusions</span>
          </button>

          <button
            type="button"
            onClick={onRunValidation}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            title="Re-run Sitemap Validation"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th scope="col" className="py-3 px-3 w-12 text-center">#</th>
                <th scope="col" className="py-3 px-4">URL</th>
                <th scope="col" className="py-3 px-3 w-36">Canonical Path</th>
                <th scope="col" className="py-3 px-3 w-24 text-center">In Crawl</th>
                <th scope="col" className="py-3 px-3 w-24 text-center">In Sitemap</th>
                <th scope="col" className="py-3 px-3 w-36">Result</th>
                <th scope="col" className="py-3 px-3 w-20 text-center">HTTP</th>
                <th scope="col" className="py-3 px-3 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No URLs match current filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const isCopied = copiedRowUrl === item.url;
                  return (
                    <tr
                      key={item.url}
                      className={`hover:bg-slate-50 transition-colors ${
                        item.status === 'missing'
                          ? 'bg-rose-50/30'
                          : item.status === 'sitemap_only'
                          ? 'bg-amber-50/20'
                          : item.status === 'ignored'
                          ? 'bg-slate-50/60 opacity-80'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs max-w-md truncate">
                        <div className="flex flex-col">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-800 hover:text-emerald-600 hover:underline inline-flex items-center gap-1.5"
                            title={item.url}
                          >
                            <span className="truncate">{item.url}</span>
                            <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" />
                          </a>
                          {item.ignoreReason && (
                            <span className="text-[10px] text-slate-500 font-sans mt-0.5">
                              Excluded: {item.ignoreReason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-600">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {item.canonicalPath}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.inCrawl ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                            No
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.inSitemap ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                            No
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {item.status === 'correct' ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>Present</span>
                          </span>
                        ) : item.status === 'missing' ? (
                          <span className="inline-flex items-center space-x-1 text-rose-700 font-semibold">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Missing</span>
                          </span>
                        ) : item.status === 'ignored' ? (
                          <span className="inline-flex items-center space-x-1 text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            <EyeOff className="h-3 w-3 shrink-0 text-slate-500" />
                            <span>Ignored</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-amber-700 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>Sitemap Only</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                        {item.httpStatus || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleCopyRow(item.url)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="Copy URL"
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ToolExclusionSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        toolId="sitemap"
        toolName="Sitemap Validator"
        domain={domain}
        onSettingsUpdated={onRunValidation}
      />
    </div>
  );
};
