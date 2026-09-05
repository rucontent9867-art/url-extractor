import React, { useState } from 'react';
import { LanguageCompletenessResult, LanguageCompletenessItem } from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Info,
  Sliders,
  EyeOff,
} from 'lucide-react';
import {
  copyStringListToClipboard,
  downloadCompletenessCsv,
  downloadStringListAsTxt,
  downloadMissingTranslationsCsv,
} from '../../utils/exportUtils';
import { ToolExclusionSettingsModal } from './ToolExclusionSettingsModal';

interface LanguageCompletenessProps {
  result: LanguageCompletenessResult | null;
  isLoading: boolean;
  domain?: string;
  onRunValidation: () => void;
}

export const LanguageCompleteness: React.FC<LanguageCompletenessProps> = ({
  result,
  isLoading,
  domain = '',
  onRunValidation,
}) => {
  const [expandedLangCode, setExpandedLangCode] = useState<string | null>(null);
  const [copiedLangCode, setCopiedLangCode] = useState<string | null>(null);
  const [copiedRowUrl, setCopiedRowUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showIgnoredSection, setShowIgnoredSection] = useState(false);

  const toggleExpand = (code: string) => {
    setExpandedLangCode((prev) => (prev === code ? null : code));
  };

  const handleCopyMissing = async (lang: LanguageCompletenessItem) => {
    if (lang.missingUrls.length === 0) return;
    const ok = await copyStringListToClipboard(lang.missingUrls);
    if (ok) {
      setCopiedLangCode(lang.languageCode);
      setTimeout(() => setCopiedLangCode(null), 2000);
    }
  };

  const handleCopySingle = async (url: string) => {
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
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Language Page Completeness Validator
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Evaluates translation coverage page-by-page. Only pages with at least one alternative-language version
              are treated as multilingual and checked for full translation consistency. Excluded URLs are skipped.
            </p>
          </div>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              type="button"
              onClick={onRunValidation}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center space-x-2 transition-all shadow-xs cursor-pointer"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              <span>{isLoading ? 'Analyzing Completeness...' : 'Run Completeness Validation'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 inline-flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Sliders className="h-4 w-4 text-slate-500" />
              <span>Completeness Exclusions</span>
            </button>
          </div>
        </div>

        <ToolExclusionSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          toolId="languageCompleteness"
          toolName="Language Completeness"
          domain={domain}
          onSettingsUpdated={onRunValidation}
        />
      </div>
    );
  }

  const totalEnglish = result.totalEnglishPages ?? result.englishReferenceCount;
  const englishOnly = result.englishOnlyPages ?? 0;
  const multilingual = result.multilingualPages ?? result.englishReferenceCount;
  const ignoredCount = result.pagesIgnored ?? result.ignoredItems?.length ?? 0;
  const pagesChecked = result.pagesChecked ?? (totalEnglish - ignoredCount);

  return (
    <div className="space-y-5">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Total English
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-900">
            {totalEnglish}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">All crawled English</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            English-only
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-900">
            {englishOnly}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Valid single-language</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-100 bg-indigo-50/20 shadow-2xs">
          <div className="text-[11px] font-medium text-indigo-700 uppercase tracking-wider">
            Multilingual
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-indigo-900">
            {multilingual}
          </div>
          <div className="mt-1 text-[11px] text-indigo-600">Expected across languages</div>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-2xs ${
            result.totalMissing > 0
              ? 'bg-rose-50/60 border-rose-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div
            className={`text-[11px] font-medium uppercase tracking-wider flex items-center space-x-1 ${
              result.totalMissing > 0 ? 'text-rose-700' : 'text-slate-500'
            }`}
          >
            <XCircle className="h-3 w-3" />
            <span>Missing Translations</span>
          </div>
          <div
            className={`mt-1 text-2xl font-bold font-mono ${
              result.totalMissing > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {result.totalMissing}
          </div>
          <div className="mt-1 text-[11px] text-rose-600/80">Across all languages</div>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-2xs ${
            result.totalAdditional > 0
              ? 'bg-amber-50/60 border-amber-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div
            className={`text-[11px] font-medium uppercase tracking-wider flex items-center space-x-1 ${
              result.totalAdditional > 0 ? 'text-amber-700' : 'text-slate-500'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>Additional Pages</span>
          </div>
          <div
            className={`mt-1 text-2xl font-bold font-mono ${
              result.totalAdditional > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {result.totalAdditional}
          </div>
          <div className="mt-1 text-[11px] text-amber-600/80">Exist only in translations</div>
        </div>

        <div
          onClick={() => setShowIgnoredSection(!showIgnoredSection)}
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

      {/* Helper notice */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-2 text-xs text-slate-600">
        <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Page-by-page translation logic: </span>
          It is not required for every English page to have translations. Only pages with at least one alternative-language version
          are considered multilingual ({multilingual} pages). Those {multilingual} pages are verified across all discovered languages.
          The {englishOnly} English-only pages are excluded from missing translation errors.
        </div>
      </div>

      {/* Ignored URLs Section (if expanded or present) */}
      {showIgnoredSection && result.ignoredItems && result.ignoredItems.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-800 flex items-center space-x-2">
              <EyeOff className="h-4 w-4 text-slate-500" />
              <span>Excluded URLs from Language Completeness ({result.ignoredItems.length})</span>
            </div>
            <button
              type="button"
              onClick={() => setShowIgnoredSection(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Hide
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {result.ignoredItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white border border-slate-200 text-xs font-mono"
              >
                <div className="truncate mr-2">
                  <span className="text-slate-800">{item.url}</span>
                  <span className="text-[10px] text-slate-500 font-sans ml-2">
                    ({item.reason})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopySingle(item.url)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="text-xs text-slate-600">
          Click on any language row to expand and inspect exact missing or additional URLs.
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => downloadCompletenessCsv(result.languages, 'language-completeness-report.csv')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Download Report (CSV)</span>
          </button>

          {/* Completeness Exclusions Settings */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Configure Language Completeness Exclusions"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-600" />
            <span>Completeness Exclusions</span>
          </button>

          <button
            type="button"
            onClick={onRunValidation}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            title="Re-run Language Completeness"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Language Completeness Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th scope="col" className="py-3 px-4 w-10"></th>
                <th scope="col" className="py-3 px-4">Language</th>
                <th scope="col" className="py-3 px-3 w-32 text-center">Expected Multilingual</th>
                <th scope="col" className="py-3 px-3 w-28 text-center">Found</th>
                <th scope="col" className="py-3 px-3 w-28 text-center">Missing</th>
                <th scope="col" className="py-3 px-3 w-28 text-center">Additional</th>
                <th scope="col" className="py-3 px-4 w-44">Status</th>
                <th scope="col" className="py-3 px-4 w-44 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.languages.map((lang) => {
                const isExpanded = expandedLangCode === lang.languageCode;
                const isCopied = copiedLangCode === lang.languageCode;
                const isReference = lang.languageCode === 'default';

                return (
                  <React.Fragment key={lang.languageCode}>
                    <tr
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        lang.status === 'incomplete'
                          ? 'bg-rose-50/20'
                          : lang.status === 'has_additional'
                          ? 'bg-amber-50/15'
                          : isReference
                          ? 'bg-slate-50/40'
                          : ''
                      }`}
                      onClick={() => toggleExpand(lang.languageCode)}
                    >
                      <td className="py-3 px-4 text-slate-400">
                        {lang.missingUrls.length > 0 || lang.additionalUrls.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-600" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )
                        ) : null}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center space-x-2">
                          <span>{lang.language}</span>
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {lang.languageCode}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-600">
                        {lang.expected}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-600">
                        {lang.found}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        <span
                          className={
                            lang.missingCount > 0
                              ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded'
                              : 'text-slate-400'
                          }
                        >
                          {lang.missingCount}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        <span
                          className={
                            lang.additionalCount > 0
                              ? 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded'
                              : 'text-slate-400'
                          }
                        >
                          {lang.additionalCount}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {lang.status === 'complete' ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>Complete</span>
                          </span>
                        ) : lang.status === 'incomplete' ? (
                          <span className="inline-flex items-center space-x-1 text-rose-700 font-bold">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Missing ({lang.missingCount})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-amber-700 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>Additional ({lang.additionalCount})</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-2">
                          {lang.missingUrls.length > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCopyMissing(lang)}
                                className="px-2.5 py-1 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 inline-flex items-center space-x-1 transition-colors cursor-pointer"
                                title="Copy missing URLs"
                              >
                                {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                <span>{isCopied ? 'Copied' : 'Copy Missing'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  downloadStringListAsTxt(
                                    lang.missingUrls,
                                    `missing-${lang.languageCode}-urls.txt`
                                  )
                                }
                                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                                title="Download missing URLs (TXT)"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Details Drawer */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="p-0 bg-slate-50/70 border-b border-slate-200">
                          <div className="p-4 space-y-4">
                            {/* Missing URLs list */}
                            {lang.missingUrls.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                                  <div className="flex items-center space-x-1.5">
                                    <XCircle className="h-4 w-4 text-rose-600" />
                                    <span>Missing Translations in {lang.language} ({lang.missingUrls.length})</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        downloadMissingTranslationsCsv(
                                          lang.missingDetails || [],
                                          `missing-details-${lang.languageCode}.csv`
                                        )
                                      }
                                      className="text-[11px] font-medium text-rose-700 hover:text-rose-900 inline-flex items-center space-x-1 cursor-pointer"
                                    >
                                      <FileSpreadsheet className="h-3 w-3" />
                                      <span>CSV Export</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => copyStringListToClipboard(lang.missingUrls)}
                                      className="text-[11px] font-medium text-rose-700 hover:text-rose-900 inline-flex items-center space-x-1 cursor-pointer"
                                    >
                                      <Copy className="h-3 w-3" />
                                      <span>Copy All</span>
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                  {lang.missingUrls.map((url, idx) => {
                                    const detail = lang.missingDetails?.[idx];
                                    return (
                                      <div
                                        key={url}
                                        className="flex items-center justify-between py-1.5 px-2.5 rounded bg-rose-50/50 hover:bg-rose-50 font-mono text-[11px] text-rose-900 border border-rose-100/60"
                                      >
                                        <div className="truncate mr-2 flex flex-col">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-rose-800">Expected:</span>
                                            <span className="truncate">{url}</span>
                                          </div>
                                          {detail?.englishUrl && (
                                            <div className="text-[10px] text-slate-500 font-sans mt-0.5 flex items-center gap-1">
                                              <span>Reference English URL:</span>
                                              <a
                                                href={detail.englishUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-slate-600 hover:underline font-mono truncate"
                                              >
                                                {detail.englishUrl}
                                              </a>
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleCopySingle(url)}
                                          className="p-1 rounded text-rose-500 hover:text-rose-800 cursor-pointer shrink-0"
                                          title="Copy URL"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Additional URLs list */}
                            {lang.additionalUrls.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                                  <div className="flex items-center space-x-1.5">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <span>Additional Pages in {lang.language} ({lang.additionalUrls.length})</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyStringListToClipboard(lang.additionalUrls)}
                                    className="text-[11px] font-medium text-amber-700 hover:text-amber-900 inline-flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Copy className="h-3 w-3" />
                                    <span>Copy All</span>
                                  </button>
                                </div>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {lang.additionalUrls.map((url) => (
                                    <div
                                      key={url}
                                      className="flex items-center justify-between py-1 px-2 rounded bg-amber-50/50 hover:bg-amber-50 font-mono text-[11px] text-amber-900"
                                    >
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate mr-2 hover:underline inline-flex items-center gap-1"
                                      >
                                        <span>{url}</span>
                                        <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => handleCopySingle(url)}
                                        className="p-0.5 rounded text-amber-500 hover:text-amber-800 cursor-pointer"
                                        title="Copy URL"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ToolExclusionSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        toolId="languageCompleteness"
        toolName="Language Completeness"
        domain={domain}
        onSettingsUpdated={onRunValidation}
      />
    </div>
  );
};
