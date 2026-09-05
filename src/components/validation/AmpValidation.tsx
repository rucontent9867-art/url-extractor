import React, { useState, useMemo } from 'react';
import { AmpValidationResult, AmpValidationItem } from '../../types';
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Check,
  FileSpreadsheet,
  Eye,
  Sliders,
  Filter,
  CheckSquare,
  HelpCircle,
  Smartphone,
  Info,
} from 'lucide-react';
import {
  downloadAmpValidationCsv,
  copyStringListToClipboard,
  copyTextToClipboard,
} from '../../utils/exportUtils';
import { AmpDetailModal } from './AmpDetailModal';
import { AmpContentDiffModal } from './AmpContentDiffModal';
import { ToolExclusionSettingsModal } from './ToolExclusionSettingsModal';
import { EyeOff } from 'lucide-react';

interface AmpValidationProps {
  result: AmpValidationResult | null;
  isLoading: boolean;
  domain?: string;
  onRunValidation: (options?: { checkGuesses?: boolean; passThreshold?: number; warnThreshold?: number }) => void;
}

type FilterStatus = 'all' | 'passed' | 'warning' | 'error' | 'skipped' | 'ignored';
type FilterDiscovery = 'all' | 'declared' | 'guessed' | 'none';
type FilterContent = 'all' | 'high' | 'medium' | 'low';

export const AmpValidation: React.FC<AmpValidationProps> = ({
  result,
  isLoading,
  domain = '',
  onRunValidation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [discoveryFilter, setDiscoveryFilter] = useState<FilterDiscovery>('all');
  const [contentFilter, setContentFilter] = useState<FilterContent>('all');
  const [checkGuesses, setCheckGuesses] = useState(false);
  const [copiedUrls, setCopiedUrls] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [selectedDetailItem, setSelectedDetailItem] = useState<AmpValidationItem | null>(null);
  const [selectedDiffItem, setSelectedDiffItem] = useState<AmpValidationItem | null>(null);

  const handleCopy = async (text: string, key: string) => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const handleCopyAllUrls = async () => {
    if (!result?.items) return;
    const urls = filteredItems.map((i) => `${i.normalUrl} -> ${i.ampUrl || 'None'} [${i.statusLabel}]`);
    const success = await copyStringListToClipboard(urls);
    if (success) {
      setCopiedUrls(true);
      setTimeout(() => setCopiedUrls(false), 2000);
    }
  };

  const handleExportCsv = () => {
    if (!result?.items) return;
    downloadAmpValidationCsv(filteredItems);
  };

  // Filter items
  const filteredItems = useMemo(() => {
    if (!result?.items) return [];

    return result.items.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      // Discovery filter
      if (discoveryFilter !== 'all' && item.discoverySource !== discoveryFilter) return false;

      // Content match filter
      if (contentFilter === 'high' && item.contentMatchPercent < 95) return false;
      if (contentFilter === 'medium' && (item.contentMatchPercent < 85 || item.contentMatchPercent >= 95)) return false;
      if (contentFilter === 'low' && item.contentMatchPercent >= 85) return false;

      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchUrl = item.normalUrl.toLowerCase().includes(q);
        const matchAmp = item.ampUrl ? item.ampUrl.toLowerCase().includes(q) : false;
        const matchTitle = (item.normalTitle || '').toLowerCase().includes(q) || (item.ampTitle || '').toLowerCase().includes(q);
        const matchLang = item.expectedLanguage.toLowerCase().includes(q);
        if (!matchUrl && !matchAmp && !matchTitle && !matchLang) return false;
      }

      return true;
    });
  }, [result, statusFilter, discoveryFilter, contentFilter, searchTerm]);

  if (!result) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto text-amber-600">
          <Zap className="h-6 w-6" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h3 className="text-base font-bold text-slate-900">AMP Validation Not Run</h3>
          <p className="text-xs text-slate-500">
            Audit whether normal web pages declare valid Accelerated Mobile Pages (`rel="amphtml"`), verify reciprocal canonical relationships, test static content parity, and inspect AMP technical compliance.
          </p>
        </div>

        {/* Informational Callout */}
        <div className="max-w-xl mx-auto p-3 bg-slate-50 rounded-xl border border-slate-200 text-left flex items-start space-x-2.5 text-[11px] text-slate-600">
          <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-800">Format vs. Language distinction: </span>
            AMP (Accelerated Mobile Pages) is an alternate mobile-optimized page delivery format for paired URLs, <span className="font-semibold">not a localization or language translation</span>. Language completeness and multilingual translations are audited separately under tabs 2 and 3.
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={checkGuesses}
              onChange={(e) => setCheckGuesses(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span>Also test common AMP URLs (e.g. /amp/) if rel=&quot;amphtml&quot; is missing</span>
          </label>

          <button
            type="button"
            onClick={() => onRunValidation({ checkGuesses })}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            <span>{isLoading ? 'Running AMP Audit...' : 'Run AMP Validation'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-500" />
            <span>AMP Exclusions</span>
          </button>
        </div>

        <ToolExclusionSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          toolId="amp"
          toolName="AMP Format Parity"
          domain={domain}
          onSettingsUpdated={() => onRunValidation({ checkGuesses })}
        />
      </div>
    );
  }

  const ignoredCount = result.ignoredCount ?? (result.ignoredUrls?.length || 0);

  return (
    <div className="space-y-6">
      {/* Informational Header Note */}
      <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/70 flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center space-x-2">
          <Smartphone className="h-4 w-4 text-amber-700 shrink-0" />
          <span>
            <strong className="font-semibold">AMP Format Parity:</strong> AMP (Accelerated Mobile Pages) is an alternate mobile-optimized paired presentation of canonical pages, not a language translation. This audit checks reciprocal linking (<code className="font-mono text-[11px] bg-amber-100/70 px-1 py-0.5 rounded">amphtml</code> ↔ <code className="font-mono text-[11px] bg-amber-100/70 px-1 py-0.5 rounded">canonical</code>), content fidelity, and HTML validity.
          </span>
        </div>
      </div>

      {/* Top Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Checked */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Pages Checked
          </span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            {result.totalPagesChecked}
          </span>
        </div>

        {/* AMP Found */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            AMP Available
          </span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            {result.totalAmpFound}
          </span>
        </div>

        {/* Passed */}
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
          <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block">
            Passed (100% Valid)
          </span>
          <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
            {result.passedCount}
          </span>
        </div>

        {/* Warnings */}
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
          <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider block">
            Warnings
          </span>
          <span className="text-xl font-bold font-mono text-amber-700 mt-1 block">
            {result.warningCount}
          </span>
        </div>

        {/* Errors */}
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40">
          <span className="text-[10px] font-semibold text-rose-800 uppercase tracking-wider block">
            Errors
          </span>
          <span className="text-xl font-bold font-mono text-rose-700 mt-1 block">
            {result.errorCount}
          </span>
        </div>

        {/* Skipped */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Skipped (No AMP)
          </span>
          <span className="text-xl font-bold font-mono text-slate-600 mt-1 block">
            {result.skippedCount}
          </span>
        </div>

        {/* Ignored */}
        <div
          onClick={() => setIsSettingsOpen(true)}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
          title="Click to configure AMP exclusions"
        >
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block flex items-center space-x-1">
            <EyeOff className="h-3 w-3 text-slate-400" />
            <span>Ignored</span>
          </span>
          <span className="text-xl font-bold font-mono text-slate-700 mt-1 block">
            {ignoredCount}
          </span>
        </div>
      </div>

      {/* Control / Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by URL or title..."
                className="pl-8.5 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-1 focus:ring-slate-900 w-48 sm:w-60"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Statuses ({result.items.length})</option>
              <option value="passed">Passed ({result.passedCount})</option>
              <option value="warning">Warnings ({result.warningCount})</option>
              <option value="error">Errors ({result.errorCount})</option>
              <option value="skipped">Skipped ({result.skippedCount})</option>
              {ignoredCount > 0 && <option value="ignored">Ignored ({ignoredCount})</option>}
            </select>

            {/* Discovery Filter */}
            <select
              value={discoveryFilter}
              onChange={(e) => setDiscoveryFilter(e.target.value as FilterDiscovery)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Discovery Sources</option>
              <option value="declared">Declared (rel=&quot;amphtml&quot;)</option>
              <option value="guessed">Guessed (/amp/)</option>
              <option value="none">Not Found</option>
            </select>

            {/* Content Match Filter */}
            <select
              value={contentFilter}
              onChange={(e) => setContentFilter(e.target.value as FilterContent)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Content Scores</option>
              <option value="high">High Match (≥95%)</option>
              <option value="medium">Partial Match (85-94%)</option>
              <option value="low">Low Match (&lt;85%)</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredItems.length === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleCopyAllUrls}
              disabled={filteredItems.length === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {copiedUrls ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy URLs</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Configure AMP Exclusions"
            >
              <Sliders className="h-3.5 w-3.5 text-slate-500" />
              <span>AMP Exclusions</span>
            </button>

            <button
              type="button"
              onClick={() => onRunValidation({ checkGuesses })}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Auditing...' : 'Re-run Audit'}</span>
            </button>
          </div>
        </div>

        {/* Secondary options row */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checkGuesses}
              onChange={(e) => setCheckGuesses(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span>Include pattern guessing (`/amp/`, `?amp=1`) if page does not declare `rel=&quot;amphtml&quot;`</span>
          </label>

          <span>
            Showing <strong className="text-slate-800">{filteredItems.length}</strong> of{' '}
            <strong className="text-slate-800">{result.items.length}</strong> pages
          </span>
        </div>
      </div>

      {/* Main Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-3.5 w-12 text-center">#</th>
                <th className="py-3 px-3.5 min-w-[220px]">Normal Page</th>
                <th className="py-3 px-3.5 min-w-[200px]">AMP Discovery & URL</th>
                <th className="py-3 px-3.5 w-20 text-center">HTTP</th>
                <th className="py-3 px-3.5 min-w-[140px]">Canonical</th>
                <th className="py-3 px-3.5 w-28 text-center">Content</th>
                <th className="py-3 px-3.5 w-20 text-center">Lang</th>
                <th className="py-3 px-3.5 w-20 text-center">H1</th>
                <th className="py-3 px-3.5 w-28 text-center">Status</th>
                <th className="py-3 px-3.5 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 italic">
                    No AMP validation results match the active filters or search terms.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const isPassed = item.status === 'passed';
                  const isError = item.status === 'error';
                  const isWarning = item.status === 'warning';
                  const isSkipped = item.status === 'skipped';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* # */}
                      <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      {/* Normal Page */}
                      <td className="py-3 px-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-slate-900 truncate max-w-xs" title={item.normalUrl}>
                              {item.canonicalPath}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 shrink-0">
                              {item.expectedLanguageCode.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1 text-[11px] text-slate-400 font-mono">
                            <span className="truncate max-w-[200px]">{item.normalUrl}</span>
                            <a
                              href={item.normalUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-slate-400 hover:text-slate-700 shrink-0"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* AMP URL & Discovery */}
                      <td className="py-3 px-3.5">
                        {item.ampUrl ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  item.discoverySource === 'declared'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {item.discoverySource === 'declared' ? 'rel="amphtml"' : 'Guessed'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1 text-[11px] text-slate-600 font-mono">
                              <span className="truncate max-w-[180px]" title={item.ampUrl}>
                                {item.ampUrl}
                              </span>
                              <a
                                href={item.ampUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-slate-400 hover:text-slate-700 shrink-0"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            No AMP version declared
                          </span>
                        )}
                      </td>

                      {/* HTTP Status */}
                      <td className="py-3 px-3.5 text-center">
                        {item.discoverySource === 'none' ? (
                          <span className="text-slate-400 font-mono text-[11px]">-</span>
                        ) : (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              item.isAvailable
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.httpStatus || (item.isAvailable ? '200' : 'Err')}
                          </span>
                        )}
                      </td>

                      {/* Canonical */}
                      <td className="py-3 px-3.5">
                        {item.discoverySource === 'none' ? (
                          <span className="text-slate-400 text-[11px]">-</span>
                        ) : item.canonicalMatches ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 text-[11px] font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>Reciprocal</span>
                          </span>
                        ) : item.canonicalStatus === 'missing' ? (
                          <span className="inline-flex items-center space-x-1 text-rose-700 text-[11px] font-semibold">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Missing Tag</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-rose-700 text-[11px] font-semibold">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Mismatch</span>
                          </span>
                        )}
                      </td>

                      {/* Content Match */}
                      <td className="py-3 px-3.5 text-center">
                        {item.discoverySource === 'none' ? (
                          <span className="text-slate-400 font-mono text-[11px]">-</span>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                                item.contentMatchPercent >= 95
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.contentMatchPercent >= 85
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.contentMatchPercent}%
                            </span>
                            {item.missingContentBlocks && item.missingContentBlocks.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedDiffItem(item)}
                                className="text-[10px] text-amber-700 hover:text-amber-900 font-semibold underline mt-0.5 cursor-pointer"
                              >
                                {item.missingContentBlocks.length} missing
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Language Match */}
                      <td className="py-3 px-3.5 text-center">
                        {item.discoverySource === 'none' ? (
                          <span className="text-slate-400 font-mono text-[11px]">-</span>
                        ) : item.languageMatches ? (
                          <span className="text-emerald-700 font-bold text-[11px]">Pass</span>
                        ) : (
                          <span className="text-rose-700 font-bold text-[11px]">Fail</span>
                        )}
                      </td>

                      {/* H1 Match */}
                      <td className="py-3 px-3.5 text-center">
                        {item.discoverySource === 'none' ? (
                          <span className="text-slate-400 font-mono text-[11px]">-</span>
                        ) : item.h1Matches ? (
                          <span className="text-emerald-700 font-bold text-[11px]">Match</span>
                        ) : (
                          <span className="text-amber-700 font-bold text-[11px]">Diff</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPassed
                              ? 'bg-emerald-100 text-emerald-800'
                              : isError
                              ? 'bg-rose-100 text-rose-800'
                              : isWarning
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.statusLabel}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {item.missingContentBlocks && item.missingContentBlocks.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedDiffItem(item)}
                              className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100/70 transition-colors cursor-pointer"
                              title="View Missing Content"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedDetailItem(item)}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            Inspect
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedDetailItem && (
        <AmpDetailModal
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
          onOpenDiffModal={(item) => {
            setSelectedDetailItem(null);
            setSelectedDiffItem(item);
          }}
        />
      )}

      {/* Content Diff Modal */}
      {selectedDiffItem && (
        <AmpContentDiffModal
          item={selectedDiffItem}
          onClose={() => setSelectedDiffItem(null)}
        />
      )}

      {/* Tool Exclusion Settings Modal */}
      <ToolExclusionSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        toolId="amp"
        toolName="AMP Format Parity"
        domain={domain}
        onSettingsUpdated={() => onRunValidation({ checkGuesses })}
      />
    </div>
  );
};
