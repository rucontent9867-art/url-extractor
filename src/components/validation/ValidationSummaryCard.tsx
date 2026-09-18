import React from 'react';
import { ValidationSummary } from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Layers,
  Languages,
  Smartphone,
  Zap,
  FileCheck2,
  Eye,
  MousePointerClick,
  ArrowRight,
} from 'lucide-react';

interface ValidationSummaryCardProps {
  summary: ValidationSummary | null;
  isRunningAll: boolean;
  onRunAll: () => void;
  onSelectTab: (tab: 'sitemap' | 'completeness' | 'content' | 'header' | 'amp' | 'asset' | 'visual' | 'interaction') => void;
}

export const ValidationSummaryCard: React.FC<ValidationSummaryCardProps> = ({
  summary,
  isRunningAll,
  onRunAll,
  onSelectTab,
}) => {
  if (!summary || summary.overallStatus === 'not_run') {
    return (
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                SEO & Localization Audit Hub
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">Website Validation Suite</h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Execute comprehensive automated audits on your crawled dataset: Sitemap Coverage, Language Completeness, Text Content, Navigation, AMP Parity, Asset & Link Health, Viewport Layouts, and Interactive Controls.
            </p>
          </div>

          <button
            type="button"
            onClick={onRunAll}
            disabled={isRunningAll}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-sm flex items-center justify-center space-x-2 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {isRunningAll ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            <span>{isRunningAll ? 'Running All Audits...' : 'Run All 8 Validation Checks'}</span>
          </button>
        </div>
      </div>
    );
  }

  const isPassed = summary.overallStatus === 'passed';
  const isWarning = summary.overallStatus === 'warning';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
      {/* Top row: Overall Status & Run All Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div
            className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isPassed
                ? 'bg-emerald-100 text-emerald-700'
                : isWarning
                ? 'bg-amber-100 text-amber-700'
                : 'bg-rose-100 text-rose-700'
            }`}
          >
            {isPassed ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : isWarning ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <XCircle className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900">Validation Health Status</h2>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  isPassed
                    ? 'bg-emerald-100 text-emerald-800'
                    : isWarning
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isPassed ? 'All Checks Passed' : isWarning ? 'Warnings Detected' : 'Action Required'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Audit generated at {new Date(summary.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRunAll}
          disabled={isRunningAll}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRunningAll ? 'animate-spin' : ''}`} />
          <span>{isRunningAll ? 'Running Checks...' : 'Re-run All Checks'}</span>
        </button>
      </div>

      {/* 8 Tool Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Tool 1: Sitemap */}
        <div
          onClick={() => onSelectTab('sitemap')}
          className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 hover:bg-white group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-700" />
              <span className="text-[11px] font-bold text-slate-900">1. Sitemap</span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>

          {summary.sitemap ? (
            <div className="mt-2.5 space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-slate-900">
                  {summary.sitemap.coveragePercent}%
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    summary.sitemap.missingFromSitemap === 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {summary.sitemap.missingFromSitemap === 0
                    ? 'Full'
                    : `${summary.sitemap.missingFromSitemap} Miss`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {summary.sitemap.foundInSitemap}/{summary.sitemap.totalEnglishPages} English pages
              </p>
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] text-slate-400 italic">Not evaluated</p>
          )}
        </div>

        {/* Tool 2: Completeness */}
        <div
          onClick={() => onSelectTab('completeness')}
          className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 hover:bg-white group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-700" />
              <span className="text-[11px] font-bold text-slate-900">2. Completeness</span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>

          {summary.completeness ? (
            <div className="mt-2.5 space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-slate-900">
                  {summary.completeness.languages.length}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    summary.completeness.totalMissing === 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {summary.completeness.totalMissing === 0
                    ? '100%'
                    : `${summary.completeness.totalMissing} Miss`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                Across {summary.completeness.languages.length} languages
              </p>
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] text-slate-400 italic">Not evaluated</p>
          )}
        </div>

        {/* Tool 3: Content Language */}
        <div
          onClick={() => onSelectTab('content')}
          className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 hover:bg-white group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Languages className="h-3.5 w-3.5 text-slate-700" />
              <span className="text-[11px] font-bold text-slate-900">3. Content Lang</span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>

          {summary.contentLanguage ? (
            <div className="mt-2.5 space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-slate-900">
                  {summary.contentLanguage.pagesChecked}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    summary.contentLanguage.mismatchCount === 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {summary.contentLanguage.mismatchCount === 0
                    ? '0 Mismatch'
                    : `${summary.contentLanguage.mismatchCount} Err`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {summary.contentLanguage.correctCount} passed ({summary.contentLanguage.confidenceThreshold}%)
              </p>
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] text-slate-400 italic">Not evaluated</p>
          )}
        </div>

        {/* Tool 4: Header & Language Navigation */}
        <div
          onClick={() => onSelectTab('header')}
          className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 hover:bg-white group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Smartphone className="h-3.5 w-3.5 text-slate-700" />
              <span className="text-[11px] font-bold text-slate-900">4. Navigation</span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>

          {summary.headerNavigation ? (
            <div className="mt-2.5 space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-slate-900">
                  {summary.headerNavigation.pagesChecked}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    summary.headerNavigation.headerMismatchCount === 0 &&
                    summary.headerNavigation.totalLanguageErrors === 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}
                >
                  {summary.headerNavigation.headerMismatchCount === 0 &&
                  summary.headerNavigation.totalLanguageErrors === 0
                    ? 'Pass'
                    : `${summary.headerNavigation.headerMismatchCount + summary.headerNavigation.totalLanguageErrors} Err`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {summary.headerNavigation.headerMatchingCount} match, {summary.headerNavigation.totalLanguagePass} switches
              </p>
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] text-slate-400 italic">Not evaluated</p>
          )}
        </div>

        {/* Tool 5: AMP Validation */}
        <div
          onClick={() => onSelectTab('amp')}
          className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 hover:bg-white group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Zap className="h-3.5 w-3.5 text-slate-700" />
              <span className="text-[11px] font-bold text-slate-900">5. AMP Validation</span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>

          {summary.ampValidation ? (
            <div className="mt-2.5 space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-slate-900">
                  {summary.ampValidation.totalAmpFound > 0 ? summary.ampValidation.totalAmpFound : summary.ampValidation.totalPagesChecked}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    summary.ampValidation.errorCount === 0
                      ? summary.ampValidation.warningCount === 0
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                      : 'text-rose-600'
                  }`}
                >
                  {summary.ampValidation.errorCount === 0
                    ? summary.ampValidation.warningCount === 0
                      ? summary.ampValidation.totalAmpFound > 0 ? '100% Valid' : 'No AMP'
                      : `${summary.ampValidation.warningCount} Warn`
                    : `${summary.ampValidation.errorCount} Err`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {summary.ampValidation.passedCount} passed, {summary.ampValidation.skippedCount} skipped
              </p>
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] text-slate-400 italic">Not evaluated</p>
          )}
        </div>

        {/* Tool 6: Links, Assets & HTTP Health */}
        <div
          onClick={() => onSelectTab('asset')}
          className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 hover:bg-white group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[11px] font-bold text-slate-900">6. Links, Assets & Health</span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>

          {summary.assetValidation ? (
            <div className="mt-2.5 space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-slate-900">
                  {summary.assetValidation.totalAssetsScanned}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    summary.assetValidation.brokenCount === 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {summary.assetValidation.brokenCount === 0
                    ? '0 Broken'
                    : `${summary.assetValidation.brokenCount} Broken`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {summary.assetValidation.passedCount} healthy, {summary.assetValidation.missingAltCount} alt gaps
              </p>
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] text-slate-400 italic">Not evaluated</p>
          )}
        </div>

        {/* Tool 7: Visual & Viewport */}
        <div
          onClick={() => onSelectTab('visual')}
          className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 hover:bg-white group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Eye className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-[11px] font-bold text-slate-900">7. Visual / Viewport</span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>

          {summary.visualValidation ? (
            <div className="mt-2.5 space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-slate-900">
                  {summary.visualValidation.pagesChecked}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    summary.visualValidation.totalErrors === 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {summary.visualValidation.totalErrors === 0
                    ? 'Layouts OK'
                    : `${summary.visualValidation.totalErrors} Breaks`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {summary.visualValidation.horizontalScrollIssues} scroll, {summary.visualValidation.textIssues} text clip
              </p>
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] text-slate-400 italic">Not evaluated</p>
          )}
        </div>

        {/* Tool 8: Interaction & Console */}
        <div
          onClick={() => onSelectTab('interaction')}
          className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 hover:bg-white group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <MousePointerClick className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[11px] font-bold text-slate-900">8. Interaction</span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>

          {summary.interactionValidation ? (
            <div className="mt-2.5 space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-slate-900">
                  {summary.interactionValidation.elementsTested}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    summary.interactionValidation.errorCount === 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {summary.interactionValidation.errorCount === 0
                    ? '0 JS Err'
                    : `${summary.interactionValidation.consoleErrorCount} JS Err`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {summary.interactionValidation.passedCount} active, {summary.interactionValidation.noActionCount} dead buttons
              </p>
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] text-slate-400 italic">Not evaluated</p>
          )}
        </div>
      </div>
    </div>
  );
};



