import React, { useState, useMemo } from 'react';
import {
  ContentLanguageResult,
  ContentLanguageStatus,
  ContentLanguageItem,
  MismatchedTextBlock,
  LanguageDistributionEntry,
} from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Search,
  ExternalLink,
  Languages,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Sliders,
  Filter,
  Eye,
  X,
  Code2,
  FileSearch,
} from 'lucide-react';
import {
  copyStringListToClipboard,
  downloadContentLanguageCsv,
  downloadStringListAsTxt,
} from '../../utils/exportUtils';
import { ToolExclusionSettingsModal } from './ToolExclusionSettingsModal';
import { EyeOff } from 'lucide-react';

interface ContentLanguageValidationProps {
  result: ContentLanguageResult | null;
  isLoading: boolean;
  domain?: string;
  onRunValidation: (threshold?: number) => void;
}

type FilterStatus = 'all' | 'mismatch' | 'mixed_language' | 'low_confidence' | 'correct' | 'ignored';

export const ContentLanguageValidation: React.FC<ContentLanguageValidationProps> = ({
  result,
  isLoading,
  domain = '',
  onRunValidation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [threshold, setThreshold] = useState<number>(result?.confidenceThreshold ?? 90);
  const [copiedMismatches, setCopiedMismatches] = useState(false);
  const [copiedRowUrl, setCopiedRowUrl] = useState<string | null>(null);
  const [inspectItem, setInspectItem] = useState<ContentLanguageItem | null>(null);
  const [isExpandedAll, setIsExpandedAll] = useState(false);
  const [isCopiedMismatched, setIsCopiedMismatched] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleOpenInspect = (item: ContentLanguageItem) => {
    setIsExpandedAll(false);
    setIsCopiedMismatched(false);
    setInspectItem(item);
  };

  const isMismatch = inspectItem?.status === 'mismatch';
  const isMixed = inspectItem?.status === 'mixed_language' || Boolean(inspectItem?.isMixedLanguage);

  const displayMismatchedBlocks: MismatchedTextBlock[] = useMemo(() => {
    if (!inspectItem) return [];
    if (inspectItem.mismatchedBlocks && inspectItem.mismatchedBlocks.length > 0) {
      return inspectItem.mismatchedBlocks;
    }
    const sampleText = inspectItem.sampleText || '';
    if (!sampleText) return [];

    if (!isMismatch && !isMixed) return [];

    // Fallback block analysis from inspectItem.sampleText
    const lines = sampleText.split(/[\r\n]+|(?<=[.!?؟。])\s+/);
    const blocks: MismatchedTextBlock[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const arabicChars = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
      const cyrillicChars = (trimmed.match(/[\u0400-\u04FF]/g) || []).length;
      const cjkChars = (trimmed.match(/[\u4E00-\u9FFF]/g) || []).length;
      const words = trimmed.split(/\s+/).filter(Boolean);

      if (arabicChars >= 8) {
        blocks.push({
          text: trimmed,
          detectedLanguage: 'Arabic',
          detectedCode: 'ar',
          confidence: 98,
          charCount: trimmed.length,
        });
      } else if (cyrillicChars >= 8) {
        blocks.push({
          text: trimmed,
          detectedLanguage: 'Russian',
          detectedCode: 'ru',
          confidence: 98,
          charCount: trimmed.length,
        });
      } else if (cjkChars >= 6) {
        blocks.push({
          text: trimmed,
          detectedLanguage: 'Chinese',
          detectedCode: 'zh',
          confidence: 95,
          charCount: trimmed.length,
        });
      } else if (
        trimmed.length >= 22 &&
        words.length >= 3 &&
        inspectItem.detectedLanguage !== inspectItem.expectedLanguage
      ) {
        blocks.push({
          text: trimmed,
          detectedLanguage: inspectItem.detectedLanguage,
          detectedCode: inspectItem.detectedCode,
          confidence: inspectItem.confidence,
          charCount: trimmed.length,
        });
      }
    }
    return blocks.sort((a, b) => b.charCount - a.charCount);
  }, [inspectItem, isMismatch, isMixed]);

  const displayMismatchedChars = useMemo(() => {
    if (!inspectItem) return 0;
    if (inspectItem.mismatchedChars !== undefined && inspectItem.mismatchedChars > 0) {
      return inspectItem.mismatchedChars;
    }
    return displayMismatchedBlocks.reduce((acc, b) => acc + b.charCount, 0);
  }, [inspectItem, displayMismatchedBlocks]);

  const displayDistribution: LanguageDistributionEntry[] = useMemo(() => {
    if (!inspectItem) return [];
    if (inspectItem.languageDistribution && inspectItem.languageDistribution.length > 0) {
      return inspectItem.languageDistribution;
    }
    const totalChars = inspectItem.staticCharsAnalyzed || inspectItem.sampleText?.length || 1;
    if (displayMismatchedBlocks.length === 0) {
      return [
        {
          language: inspectItem.expectedLanguage,
          code: inspectItem.expectedCode,
          percentage: 100,
          charCount: totalChars,
        },
      ];
    }
    const mismatchedPct = Math.min(100, Math.round((displayMismatchedChars / totalChars) * 100));
    const expectedPct = Math.max(0, 100 - mismatchedPct);
    const dist: LanguageDistributionEntry[] = [];
    if (expectedPct > 0) {
      dist.push({
        language: inspectItem.expectedLanguage,
        code: inspectItem.expectedCode,
        percentage: expectedPct,
        charCount: Math.max(0, totalChars - displayMismatchedChars),
      });
    }
    dist.push({
      language: inspectItem.detectedLanguage,
      code: inspectItem.detectedCode,
      percentage: mismatchedPct,
      charCount: displayMismatchedChars,
    });
    return dist;
  }, [inspectItem, displayMismatchedBlocks, displayMismatchedChars]);

  const hasMismatchedContent = Boolean(isMismatch || isMixed || displayMismatchedBlocks.length > 0);

  const visibleBlocks = useMemo(() => {
    if (isExpandedAll) return displayMismatchedBlocks;
    return displayMismatchedBlocks.slice(0, 5);
  }, [isExpandedAll, displayMismatchedBlocks]);

  const handleCopyMismatchedText = async () => {
    if (displayMismatchedBlocks.length === 0) return;
    const textToCopy = displayMismatchedBlocks.map((b) => b.text).join('\n\n');
    const ok = await copyStringListToClipboard([textToCopy]);
    if (ok) {
      setIsCopiedMismatched(true);
      setTimeout(() => setIsCopiedMismatched(false), 2000);
    }
  };

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
          item.expectedLanguage.toLowerCase().includes(lower) ||
          item.detectedLanguage.toLowerCase().includes(lower) ||
          (item.canonicalPath && item.canonicalPath.toLowerCase().includes(lower))
      );
    }

    return items;
  }, [result, statusFilter, searchTerm]);

  const handleCopyMismatches = async () => {
    if (!result || result.mismatchUrls.length === 0) return;
    const ok = await copyStringListToClipboard(result.mismatchUrls);
    if (ok) {
      setCopiedMismatches(true);
      setTimeout(() => setCopiedMismatches(false), 2000);
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
            <Languages className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Page Content Language Validator
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Extracts meaningful visible static text from each translated HTML page (ignoring dynamic chat
              widgets, countdowns, and cookie banners) and runs n-gram language classification to detect
              untranslated English, wrong language copy, and mixed-language pages.
            </p>
          </div>

          <div className="flex items-center justify-center space-x-3 text-xs text-slate-600 pt-2">
            <span>Confidence Threshold:</span>
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
            >
              <option value={95}>95% (Strict)</option>
              <option value={90}>90% (Recommended)</option>
              <option value={80}>80% (Moderate)</option>
              <option value={70}>70% (Permissive)</option>
            </select>
          </div>

          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              type="button"
              onClick={() => onRunValidation(threshold)}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center space-x-2 transition-all shadow-xs cursor-pointer"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
              <span>{isLoading ? 'Analyzing Static Page Text...' : 'Run Content Language Validation'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 inline-flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Sliders className="h-4 w-4 text-slate-500" />
              <span>Language Exclusions</span>
            </button>
          </div>
        </div>

        <ToolExclusionSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          toolId="contentLanguage"
          toolName="Page Content Language"
          domain={domain}
          onSettingsUpdated={() => onRunValidation(threshold)}
        />
      </div>
    );
  }

  const mixedCount =
    result.mixedLanguageCount ??
    result.items.filter((i) => i.status === 'mixed_language').length;

  const ignoredCount = result.ignoredCount ?? (result.ignoredUrls?.length || 0);

  return (
    <div className="space-y-5">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Pages Checked
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-900">
            {result.pagesChecked}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Static HTML analyzed</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Matching</span>
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-emerald-600">
            {result.correctCount}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600/70">≥90% expected</div>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-2xs ${
            mixedCount > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200'
          }`}
        >
          <div
            className={`text-[11px] font-medium uppercase tracking-wider flex items-center space-x-1 ${
              mixedCount > 0 ? 'text-amber-700' : 'text-slate-500'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>Mixed</span>
          </div>
          <div
            className={`mt-1 text-2xl font-bold font-mono ${
              mixedCount > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {mixedCount}
          </div>
          <div className="mt-1 text-[11px] text-amber-600/80">70% – 89% confidence</div>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-2xs ${
            result.mismatchCount > 0
              ? 'bg-rose-50/60 border-rose-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div
            className={`text-[11px] font-medium uppercase tracking-wider flex items-center space-x-1 ${
              result.mismatchCount > 0 ? 'text-rose-700' : 'text-slate-500'
            }`}
          >
            <XCircle className="h-3 w-3" />
            <span>Mismatches</span>
          </div>
          <div
            className={`mt-1 text-2xl font-bold font-mono ${
              result.mismatchCount > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {result.mismatchCount}
          </div>
          <div className="mt-1 text-[11px] text-rose-600/80">Wrong language copy</div>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-2xs ${
            result.lowConfidenceCount > 0
              ? 'bg-slate-100/60 border-slate-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center space-x-1">
            <FileSearch className="h-3 w-3" />
            <span>Short / Low Text</span>
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-700">
            {result.lowConfidenceCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Insufficient text</div>
        </div>

        <div
          onClick={() => setStatusFilter('ignored')}
          className={`p-4 rounded-xl border shadow-2xs cursor-pointer transition-all ${
            ignoredCount > 0
              ? 'bg-slate-50/80 border-slate-300 hover:bg-slate-100'
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
            placeholder="Search URL, expected or detected language..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
            }`}
          >
            All ({result.items.length})
          </button>
          <button
            onClick={() => setStatusFilter('mismatch')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'mismatch'
                ? 'bg-rose-600 text-white font-semibold'
                : 'hover:text-slate-900 text-rose-700'
            }`}
          >
            Mismatches ({result.mismatchCount})
          </button>
          <button
            onClick={() => setStatusFilter('mixed_language')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'mixed_language'
                ? 'bg-amber-600 text-white font-semibold'
                : 'hover:text-slate-900 text-amber-700'
            }`}
          >
            Mixed ({mixedCount})
          </button>
          <button
            onClick={() => setStatusFilter('low_confidence')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'low_confidence'
                ? 'bg-slate-700 text-white font-semibold'
                : 'hover:text-slate-900 text-slate-700'
            }`}
          >
            Short ({result.lowConfidenceCount})
          </button>
          <button
            onClick={() => setStatusFilter('correct')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'correct'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'hover:text-slate-900 text-emerald-700'
            }`}
          >
            Correct ({result.correctCount})
          </button>
          {ignoredCount > 0 && (
            <button
              onClick={() => setStatusFilter('ignored')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'ignored'
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'hover:text-slate-900 text-slate-600'
              }`}
            >
              Ignored ({ignoredCount})
            </button>
          )}
        </div>

        {/* Threshold setting & Actions */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Sliders className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px]">Threshold:</span>
            <select
              value={threshold}
              onChange={(e) => {
                const newT = Number(e.target.value);
                setThreshold(newT);
                onRunValidation(newT);
              }}
              className="bg-transparent font-semibold text-slate-800 text-xs focus:outline-none cursor-pointer"
            >
              <option value={95}>95%</option>
              <option value={90}>90%</option>
              <option value={80}>80%</option>
              <option value={70}>70%</option>
            </select>
          </div>

          {result.mismatchCount > 0 && (
            <>
              <button
                type="button"
                onClick={handleCopyMismatches}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                {copiedMismatches ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedMismatches ? 'Copied!' : `Copy Mismatches (${result.mismatchCount})`}</span>
              </button>
              <button
                type="button"
                onClick={() => downloadStringListAsTxt(result.mismatchUrls, 'language-mismatch-urls.txt')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>Download Mismatches</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => downloadContentLanguageCsv(result.items, 'content-language-report.csv')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>CSV Report</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Configure Language Exclusions"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-600" />
            <span>Language Exclusions</span>
          </button>

          <button
            type="button"
            onClick={() => onRunValidation(threshold)}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            title="Re-run Content Language Validation"
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
                <th scope="col" className="py-3 px-3 w-28">Expected</th>
                <th scope="col" className="py-3 px-3 w-28">Detected</th>
                <th scope="col" className="py-3 px-3 w-24 text-center">Confidence</th>
                <th scope="col" className="py-3 px-3 w-32">Chars Analyzed</th>
                <th scope="col" className="py-3 px-4">Static Sample</th>
                <th scope="col" className="py-3 px-3 w-36">Status</th>
                <th scope="col" className="py-3 px-3 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    No pages match current filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const isCopied = copiedRowUrl === item.url;
                  const staticChars = item.staticCharsAnalyzed ?? item.sampleText?.length ?? 0;
                  const dynamicChars = item.dynamicCharsIgnored ?? 0;

                  return (
                    <tr
                      key={item.url}
                      className={`hover:bg-slate-50 transition-colors ${
                        item.status === 'mismatch'
                          ? 'bg-rose-50/30'
                          : item.status === 'mixed_language'
                          ? 'bg-amber-50/20'
                          : item.status === 'low_confidence'
                          ? 'bg-slate-50/40'
                          : item.status === 'ignored'
                          ? 'bg-slate-50/60 opacity-80'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs max-w-xs truncate">
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
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col items-start">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800">
                            {item.expectedLanguage}
                          </span>
                          {item.expectedSlug && item.expectedSlug !== 'default' && (
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 pl-0.5">
                              /{item.expectedSlug}/
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            item.status === 'mismatch'
                              ? 'bg-rose-100 text-rose-800'
                              : item.status === 'mixed_language'
                              ? 'bg-amber-100 text-amber-800'
                              : item.status === 'low_confidence'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.detectedLanguage}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium">
                        <span
                          className={
                            item.confidence >= 90
                              ? 'text-emerald-600 font-bold'
                              : item.confidence >= 70
                              ? 'text-amber-600 font-bold'
                              : 'text-rose-600 font-bold'
                          }
                        >
                          {item.confidence}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        <div>{staticChars.toLocaleString()} static</div>
                        {dynamicChars > 0 && (
                          <div className="text-[10px] text-indigo-600">
                            {dynamicChars.toLocaleString()} ignored
                          </div>
                        )}
                      </td>
                      <td
                        className="py-2.5 px-4 max-w-xs text-slate-500 truncate text-[11px] italic cursor-pointer hover:text-slate-800"
                        title="Click to inspect extracted text sample"
                        onClick={() => handleOpenInspect(item)}
                      >
                        {item.sampleText ? `"${item.sampleText}"` : <span className="text-slate-300">No readable text</span>}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.status === 'correct' ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>Correct</span>
                          </span>
                        ) : item.status === 'mismatch' ? (
                          <span className="inline-flex items-center space-x-1 text-rose-700 font-bold">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Mismatch</span>
                          </span>
                        ) : item.status === 'mixed_language' ? (
                          <span className="inline-flex items-center space-x-1 text-amber-700 font-semibold">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>Mixed Language</span>
                          </span>
                        ) : item.status === 'ignored' ? (
                          <span className="inline-flex items-center space-x-1 text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            <EyeOff className="h-3 w-3 shrink-0 text-slate-500" />
                            <span>Ignored</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-slate-500 font-medium">
                            <FileSearch className="h-3.5 w-3.5 shrink-0" />
                            <span>Short Sample</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenInspect(item)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer"
                            title="Inspect Text & Dynamic Filtering"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyRow(item.url)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            title="Copy URL"
                          >
                            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
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

      {/* INSPECT TEXT MODAL */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl sm:max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Static Content Language Inspection
                </span>
                <div className="font-mono text-xs text-slate-900 break-all font-semibold select-all mt-0.5">
                  {inspectItem.url}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Core Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Expected</div>
                  <div className="font-bold text-slate-800 mt-0.5">{inspectItem.expectedLanguage}</div>
                  {inspectItem.expectedSlug && inspectItem.expectedSlug !== 'default' && (
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">/{inspectItem.expectedSlug}/</div>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Detected</div>
                  <div
                    className={`font-bold mt-0.5 ${
                      isMismatch ? 'text-rose-700' : isMixed ? 'text-amber-700' : 'text-slate-800'
                    }`}
                  >
                    {inspectItem.detectedLanguage}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Confidence</div>
                  <div className="font-bold font-mono text-slate-800 mt-0.5">{inspectItem.confidence}%</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Status</div>
                  <div
                    className={`font-bold mt-0.5 capitalize ${
                      inspectItem.status === 'correct'
                        ? 'text-emerald-700'
                        : inspectItem.status === 'mismatch'
                        ? 'text-rose-700'
                        : inspectItem.status === 'mixed_language'
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {inspectItem.status.replace('_', ' ')}
                  </div>
                </div>
              </div>

              {/* Conditional Language Status: Correct page banner or Mismatched Content Section */}
              {!hasMismatchedContent ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-800 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>✓ Language matches expected language</span>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-amber-200/90 bg-amber-50/40 space-y-3.5">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="font-bold text-slate-900 text-xs">
                        {isMixed && !isMismatch ? '⚠ Mixed Language Content' : '⚠ Mismatched Content'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 text-[11px] text-slate-600 font-medium">
                      <span>
                        Expected: <strong className="text-slate-800">{inspectItem.expectedLanguage}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Detected:{' '}
                        <strong className={isMismatch ? 'text-rose-700 font-bold' : 'text-amber-700 font-bold'}>
                          {inspectItem.detectedLanguage}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Confidence: <strong className="text-slate-800">{inspectItem.confidence}%</strong>
                      </span>
                    </div>
                  </div>

                  {/* Language Distribution */}
                  {displayDistribution.length > 0 && (
                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Language Distribution
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          {displayDistribution.map((entry, idx) => (
                            <div
                              key={entry.code || idx}
                              style={{ width: `${entry.percentage}%` }}
                              className={`${
                                entry.language.toLowerCase() === inspectItem.expectedLanguage.toLowerCase()
                                  ? 'bg-emerald-500'
                                  : 'bg-rose-500'
                              } transition-all duration-300`}
                              title={`${entry.language}: ${entry.percentage}% (${entry.charCount.toLocaleString()} chars)`}
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {displayDistribution.map((entry, idx) => (
                            <div key={entry.code || idx} className="flex items-center space-x-1.5 font-medium">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  entry.language.toLowerCase() === inspectItem.expectedLanguage.toLowerCase()
                                    ? 'bg-emerald-500'
                                    : 'bg-rose-500'
                                }`}
                              />
                              <span className="text-slate-700">{entry.language}:</span>
                              <span className="font-bold font-mono text-slate-900">{entry.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mismatched Static Content Blocks */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-800">
                        Mismatched Static Content:
                      </div>
                      {displayMismatchedBlocks.length > 0 && (
                        <span className="text-[11px] text-slate-500">
                          Detected language: <strong className="text-slate-700">{inspectItem.detectedLanguage}</strong>
                        </span>
                      )}
                    </div>

                    {displayMismatchedBlocks.length === 0 ? (
                      <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 italic">
                        No individual static block exceeded the evidence threshold. Page was classified as {inspectItem.detectedLanguage} based on overall static text.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {visibleBlocks.map((block, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1.5 transition-all"
                          >
                            <div
                              dir="auto"
                              className="text-xs text-slate-900 font-medium leading-relaxed select-text"
                            >
                              "{block.text}"
                            </div>
                            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                              <span className="inline-flex items-center space-x-1 font-semibold text-rose-700">
                                <span>Detected:</span>
                                <span className="bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-rose-800">
                                  {block.detectedLanguage}
                                </span>
                              </span>
                              <span className="text-slate-400 font-mono text-[10px]">
                                {block.charCount} chars • {block.confidence}% conf
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Count & Action buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-xs text-slate-600 font-medium">
                            Showing {visibleBlocks.length} of {displayMismatchedBlocks.length} mismatched text blocks
                          </span>

                          <div className="flex items-center space-x-2">
                            {displayMismatchedBlocks.length > 5 && (
                              <button
                                type="button"
                                onClick={() => setIsExpandedAll((prev) => !prev)}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                              >
                                {isExpandedAll ? 'Show Less' : 'View All'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleCopyMismatchedText}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 inline-flex items-center space-x-1 cursor-pointer shadow-2xs"
                            >
                              {isCopiedMismatched ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              <span>{isCopiedMismatched ? 'Copied!' : 'Copy Mismatched Text'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Character Summary Statistics */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="font-semibold text-indigo-900">Static Text Analyzed:</span>{' '}
                  <span className="font-mono font-bold text-indigo-950">
                    {(inspectItem.staticCharsAnalyzed ?? inspectItem.sampleText?.length ?? 0).toLocaleString()} chars
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Dynamic Text Ignored:</span>{' '}
                  <span className="font-mono text-slate-600">
                    {(inspectItem.dynamicCharsIgnored ?? 0).toLocaleString()} chars
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-rose-700">Mismatched Text:</span>{' '}
                  <span className="font-mono font-bold text-rose-800">
                    {(displayMismatchedChars || 0).toLocaleString()} chars
                  </span>
                </div>
              </div>

              {/* Extracted Static Content Sample */}
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Extracted Static Content Sample:</span>
                  <button
                    type="button"
                    onClick={() => copyStringListToClipboard([inspectItem.sampleText])}
                    className="text-indigo-600 hover:text-indigo-800 text-[11px] font-medium inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy Text</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto select-text">
                  {inspectItem.sampleText || 'No text extracted from this page.'}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <a
                href={inspectItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline inline-flex items-center space-x-1"
              >
                <span>Open page in new tab</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
