import React, { useState, useMemo } from 'react';
import {
  HeaderValidationResult,
  HeaderValidationTableRow,
  HeaderItemStatus,
  HeaderValidationType,
} from '../../types';
import {
  Smartphone,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Play,
  RefreshCw,
  Search,
  Download,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Languages,
  Eye,
  ArrowRight,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import { HeaderDetailModal } from './HeaderDetailModal';
import { downloadHeaderValidationCsv, copyTextToClipboard } from '../../utils/exportUtils';
import { ToolExclusionSettingsModal } from './ToolExclusionSettingsModal';
import { EyeOff } from 'lucide-react';

interface HeaderLanguageValidationProps {
  result: HeaderValidationResult | null;
  isLoading: boolean;
  domain?: string;
  onRunValidation: (maxPages?: number | 'all') => void;
}

export const HeaderLanguageValidation: React.FC<HeaderLanguageValidationProps> = ({
  result,
  isLoading,
  domain = '',
  onRunValidation,
}) => {
  const [selectedMaxPages, setSelectedMaxPages] = useState<number | 'all'>(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [validationTypeFilter, setValidationTypeFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRowForModal, setSelectedRowForModal] = useState<HeaderValidationTableRow | null>(null);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Available languages from result
  const availableLanguages = useMemo(() => {
    if (!result) return [];
    const langs = new Set<string>();
    for (const r of result.tableRows) {
      if (r.language && r.language !== 'Single Language (English)') {
        langs.add(r.language);
      }
    }
    return Array.from(langs);
  }, [result]);

  // Filtered table rows
  const filteredRows = useMemo(() => {
    if (!result) return [];
    let rows = result.tableRows;

    // Filter by validation type
    if (validationTypeFilter !== 'all') {
      rows = rows.filter((r) => {
        if (validationTypeFilter === 'header_urls') return r.validationType === 'header_urls';
        if (validationTypeFilter === 'language_switch') return r.validationType === 'language_switch';
        if (validationTypeFilter === 'header_detection') return r.validationType === 'header_detection';
        if (validationTypeFilter === 'language_selector') return r.validationType === 'language_selector_detection';
        return true;
      });
    }

    // Filter by device
    if (deviceFilter !== 'all') {
      rows = rows.filter((r) => r.device.toLowerCase() === deviceFilter.toLowerCase());
    }

    // Filter by language
    if (languageFilter !== 'all') {
      rows = rows.filter((r) => r.language?.toLowerCase() === languageFilter.toLowerCase());
    }

    // Filter by status
    if (statusFilter !== 'all') {
      rows = rows.filter((r) => {
        if (statusFilter === 'passed') return r.status === 'passed';
        if (statusFilter === 'error') return r.status === 'error';
        if (statusFilter === 'needs_review') return r.status === 'needs_review';
        if (statusFilter === 'skipped') return r.status === 'skipped';
        if (statusFilter === 'warning') return r.status === 'warning';
        return true;
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.page.toLowerCase().includes(lower) ||
          (r.reason && r.reason.toLowerCase().includes(lower)) ||
          r.expected.toLowerCase().includes(lower) ||
          r.actual.toLowerCase().includes(lower) ||
          (r.language && r.language.toLowerCase().includes(lower))
      );
    }

    return rows;
  }, [result, validationTypeFilter, deviceFilter, languageFilter, statusFilter, searchTerm]);

  const handleExportCsv = () => {
    if (!filteredRows || filteredRows.length === 0) return;
    downloadHeaderValidationCsv(filteredRows);
  };

  const handleCopySummary = async () => {
    if (!filteredRows || filteredRows.length === 0) return;
    const text = filteredRows
      .map(
        (r) =>
          `[${r.statusLabel}] ${r.device} | ${r.validation} | Page: ${r.page} | Expected: ${r.expected} | Actual: ${r.actual}${
            r.reason ? ` | Notes: ${r.reason}` : ''
          }`
      )
      .join('\n');

    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Playwright Headless Browser Auditing
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">Header & Language Navigation</h3>
            <p className="text-xs text-slate-500 max-w-2xl">
              Verifies Desktop vs. Mobile header link parity, mobile hamburger navigation, and tests active language selector switches to confirm canonical page preservation and English fallbacks.
            </p>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-auto shrink-0">
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
              <span className="text-[11px] font-semibold text-slate-500">Pages:</span>
              <select
                id="header-max-pages-select"
                value={selectedMaxPages}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMaxPages(val === 'all' ? 'all' : parseInt(val, 10));
                }}
                disabled={isLoading}
                aria-label="Pages to validate"
                className="bg-transparent font-bold text-slate-900 border-none outline-hidden cursor-pointer"
              >
                <option value={10}>10 pages (Fast)</option>
                <option value={25}>25 pages</option>
                <option value={50}>50 pages</option>
                <option value={100}>100 pages</option>
                <option value="all">All crawled pages</option>
              </select>
            </div>

            <button
              id="run-header-validation-btn"
              type="button"
              onClick={() => onRunValidation(selectedMaxPages)}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-2xs flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              <span>{isLoading ? 'Auditing Headers...' : 'Run Validation'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              title="Configure Navigation URL Exclusions"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span>Navigation Exclusions</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Summary Metric Cards */}
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Card 1: Pages Checked */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pages Checked</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold font-mono text-slate-900">{result.pagesChecked}</span>
              <span className="text-[10px] text-slate-500">tested</span>
            </div>
          </div>

          {/* Card 2: Header Matches */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Header Matches</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold font-mono text-emerald-600">
                {result.headerMatchingCount}
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold">100% Parity</span>
            </div>
          </div>

          {/* Card 3: Header Errors */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Header Errors</span>
            <div className="flex items-baseline space-x-1.5">
              <span
                className={`text-xl font-bold font-mono ${
                  result.headerMismatchCount === 0 ? 'text-slate-900' : 'text-rose-600'
                }`}
              >
                {result.headerMismatchCount}
              </span>
              <span
                className={`text-[10px] font-semibold ${
                  result.headerMismatchCount === 0 ? 'text-slate-400' : 'text-rose-600'
                }`}
              >
                Mismatches
              </span>
            </div>
          </div>

          {/* Card 4: Language Switch Pass */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Lang Switch Pass</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold font-mono text-emerald-600">
                {result.totalLanguagePass}
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold">Passed</span>
            </div>
          </div>

          {/* Card 5: Language Switch Errors */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Lang Switch Errors</span>
            <div className="flex items-baseline space-x-1.5">
              <span
                className={`text-xl font-bold font-mono ${
                  result.totalLanguageErrors === 0 ? 'text-slate-900' : 'text-rose-600'
                }`}
              >
                {result.totalLanguageErrors}
              </span>
              <span
                className={`text-[10px] font-semibold ${
                  result.totalLanguageErrors === 0 ? 'text-slate-400' : 'text-rose-600'
                }`}
              >
                Failures
              </span>
            </div>
          </div>

          {/* Card 6: Needs Review */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Needs Review</span>
            <div className="flex items-baseline space-x-1.5">
              <span
                className={`text-xl font-bold font-mono ${
                  result.totalNeedsReview === 0 ? 'text-slate-900' : 'text-amber-600'
                }`}
              >
                {result.totalNeedsReview}
              </span>
              <span
                className={`text-[10px] font-semibold ${
                  result.totalNeedsReview === 0 ? 'text-slate-400' : 'text-amber-600'
                }`}
              >
                Low Confidence
              </span>
            </div>
          </div>

          {/* Card 7: Ignored Pages */}
          <div
            onClick={() => setIsSettingsOpen(true)}
            className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-1 cursor-pointer hover:bg-slate-50 transition-colors"
            title="Click to manage Navigation URL Exclusions"
          >
            <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center space-x-1">
              <EyeOff className="h-3 w-3 text-slate-400" />
              <span>Ignored</span>
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold font-mono text-slate-700">
                {result.ignoredCount ?? (result.ignoredUrls?.length || 0)}
              </span>
              <span className="text-[10px] text-slate-400">excluded</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Sub-Panels: Header URLs & Language Selector Overview */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sub-Panel 1: Header URL Validation */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Header URL Validation</h4>
                  <p className="text-[11px] text-slate-500">Desktop vs Mobile URL Parity</p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  result.headerStatus === 'passed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : result.headerStatus === 'needs_review'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {result.headerStatus === 'passed'
                  ? 'PARITY VERIFIED'
                  : result.headerStatus === 'needs_review'
                  ? 'NEEDS REVIEW'
                  : 'MISMATCH DETECTED'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Matches</span>
                <span className="text-base font-bold font-mono text-emerald-700">
                  {result.headerMatchingCount}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Mismatches</span>
                <span
                  className={`text-base font-bold font-mono ${
                    result.headerMismatchCount > 0 ? 'text-rose-700' : 'text-slate-800'
                  }`}
                >
                  {result.headerMismatchCount}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Review</span>
                <span
                  className={`text-base font-bold font-mono ${
                    result.headerNeedsReviewCount > 0 ? 'text-amber-700' : 'text-slate-800'
                  }`}
                >
                  {result.headerNeedsReviewCount}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-Panel 2: Language Selector Validation */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <Languages className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Language Selector Validation</h4>
                  <p className="text-[11px] text-slate-500">
                    {result.isSingleLanguage
                      ? 'Single Language Site'
                      : `Languages: ${result.languagesAvailable.join(', ')}`}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  result.isSingleLanguage
                    ? 'bg-slate-100 text-slate-700'
                    : result.totalLanguageErrors === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {result.isSingleLanguage
                  ? 'SKIPPED (Single Lang)'
                  : result.totalLanguageErrors === 0
                  ? 'SWITCHES VERIFIED'
                  : `${result.totalLanguageErrors} ERRORS`}
              </span>
            </div>

            {result.isSingleLanguage ? (
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-600 font-medium">
                  Website only contains English pages. Language selector validation is safely skipped.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-slate-700 font-bold">
                    <span className="flex items-center space-x-1">
                      <Monitor className="h-3 w-3 text-slate-500" />
                      <span>Desktop</span>
                    </span>
                    <span className="text-emerald-700">{result.languageNavigation.desktop.passed} Pass</span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex justify-between">
                    <span>Errors: {result.languageNavigation.desktop.errors}</span>
                    <span>Review: {result.languageNavigation.desktop.needsReview}</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-slate-700 font-bold">
                    <span className="flex items-center space-x-1">
                      <Smartphone className="h-3 w-3 text-slate-500" />
                      <span>Mobile</span>
                    </span>
                    <span className="text-emerald-700">{result.languageNavigation.mobile.passed} Pass</span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex justify-between">
                    <span>Errors: {result.languageNavigation.mobile.errors}</span>
                    <span>Review: {result.languageNavigation.mobile.needsReview}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Table Controls & Filters */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="header-validation-search"
                type="text"
                placeholder="Filter by page URL, destination, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-400 focus:bg-white transition-all"
              />
            </div>

            {/* Export & Copy Actions */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                id="export-header-csv-btn"
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              <button
                id="copy-header-results-btn"
                type="button"
                onClick={handleCopySummary}
                className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                {copiedCsv ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                <span>{copiedCsv ? 'Copied!' : 'Copy Summary'}</span>
              </button>
            </div>
          </div>

          {/* Filter Dropdowns Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
            {/* Filter 1: Validation Type */}
            <div>
              <label htmlFor="header-filter-type" className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Validation Type
              </label>
              <select
                id="header-filter-type"
                value={validationTypeFilter}
                onChange={(e) => setValidationTypeFilter(e.target.value)}
                aria-label="Filter by Validation Type"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium cursor-pointer"
              >
                <option value="all">All Validation Types</option>
                <option value="header_urls">Header URL Parity</option>
                <option value="language_switch">Language Switch</option>
                <option value="language_selector">Language Selector</option>
              </select>
            </div>

            {/* Filter 2: Device */}
            <div>
              <label htmlFor="header-filter-device" className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Device
              </label>
              <select
                id="header-filter-device"
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                aria-label="Filter by Device"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium cursor-pointer"
              >
                <option value="all">All Devices</option>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>

            {/* Filter 3: Language */}
            <div>
              <label htmlFor="header-filter-language" className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Language
              </label>
              <select
                id="header-filter-language"
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                aria-label="Filter by Language"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium cursor-pointer"
              >
                <option value="all">All Languages</option>
                {availableLanguages.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 4: Status */}
            <div>
              <label htmlFor="header-filter-status" className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Status
              </label>
              <select
                id="header-filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by Status"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="passed">Passed</option>
                <option value="error">Error</option>
                <option value="needs_review">Needs Review</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 5. Results Table */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              Navigation Validation Records ({filteredRows.length})
            </span>
            <span className="text-[11px] text-slate-400">
              Showing {filteredRows.length} of {result.tableRows.length} total checks
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                  <th className="py-3 px-4">PAGE</th>
                  <th className="py-3 px-3">DEVICE</th>
                  <th className="py-3 px-3">VALIDATION</th>
                  <th className="py-3 px-3">LANGUAGE</th>
                  <th className="py-3 px-3">EXPECTED</th>
                  <th className="py-3 px-3">ACTUAL</th>
                  <th className="py-3 px-3">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                      No validation records match your active filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isPass = row.status === 'passed';
                    const isErr = row.status === 'error';
                    const isReview = row.status === 'needs_review';
                    const isSkip = row.status === 'skipped';

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedRowForModal(row)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* 1. Page URL */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-900 max-w-xs truncate">
                          <span title={row.page}>{row.page}</span>
                        </td>

                        {/* 2. Device */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center space-x-1 text-slate-700 font-medium">
                            {row.device === 'Desktop' ? (
                              <Monitor className="h-3.5 w-3.5 text-slate-500" />
                            ) : (
                              <Smartphone className="h-3.5 w-3.5 text-slate-500" />
                            )}
                            <span>{row.device}</span>
                          </span>
                        </td>

                        {/* 3. Validation Type */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{row.validation}</span>
                        </td>

                        {/* 4. Language */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {row.language ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                              {row.language}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* 5. Expected */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600 max-w-[180px] truncate">
                          <span title={row.expected}>{row.expected}</span>
                        </td>

                        {/* 6. Actual */}
                        <td className="py-3 px-3 font-mono text-[11px] max-w-[180px] truncate">
                          <span
                            title={row.actual}
                            className={isErr ? 'text-rose-700 font-semibold' : 'text-slate-600'}
                          >
                            {row.actual}
                          </span>
                        </td>

                        {/* 7. Status Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              isPass
                                ? 'bg-emerald-100 text-emerald-800'
                                : isErr
                                ? 'bg-rose-100 text-rose-800'
                                : isReview
                                ? 'bg-amber-100 text-amber-800'
                                : isSkip
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {row.statusLabel}
                          </span>
                        </td>

                        {/* 8. Inspect Action */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRowForModal(row);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white group-hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 text-[11px] font-semibold transition-colors inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Inspect</span>
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
      )}

      {/* 6. Detail Modal */}
      <HeaderDetailModal
        row={selectedRowForModal}
        onClose={() => setSelectedRowForModal(null)}
      />

      {/* 7. Tool Exclusion Settings Modal */}
      <ToolExclusionSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        toolId="header"
        toolName="Header & Language Navigation"
        domain={domain}
        onSettingsUpdated={() => onRunValidation(selectedMaxPages)}
      />
    </div>
  );
};
