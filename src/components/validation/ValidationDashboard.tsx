import React, { useState, useEffect } from 'react';
import {
  CrawlStats,
  ValidationSummary,
  SitemapValidationResult,
  LanguageCompletenessResult,
  ContentLanguageResult,
  HeaderValidationResult,
  AmpValidationResult,
  AssetValidationResult,
  VisualValidationResult,
  InteractionValidationResult,
  LinkHealthResult,
} from '../../types';
import { ValidationSummaryCard } from './ValidationSummaryCard';
import { SitemapValidation } from './SitemapValidation';
import { LanguageCompleteness } from './LanguageCompleteness';
import { ContentLanguageValidation } from './ContentLanguageValidation';
import { HeaderLanguageValidation } from './HeaderLanguageValidation';
import { AmpValidation } from './AmpValidation';
import { AssetValidation } from './AssetValidation';
import { VisualValidation } from './VisualValidation';
import { InteractionValidation } from './InteractionValidation';
import { LinkHealthValidation } from './LinkHealthValidation';
import {
  ShieldCheck,
  Layers,
  Languages,
  Smartphone,
  Zap,
  FileCheck2,
  Eye,
  MousePointerClick,
  Link2,
  AlertCircle,
  X,
  Sparkles,
  Compass,
} from 'lucide-react';
import { fetchJson } from '../../utils/apiUtils';

interface ValidationDashboardProps {
  crawlId: string | null;
  crawlStats: CrawlStats | null;
  onValidationComplete?: () => void;
  onLoadDemoData?: () => void;
  onSelectNavTab?: (tab: any) => void;
  initialTab?: string;
}

export const ValidationDashboard: React.FC<ValidationDashboardProps> = ({
  crawlId,
  crawlStats,
  onValidationComplete,
  onLoadDemoData,
  onSelectNavTab,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'linkhealth'
    | 'sitemap'
    | 'completeness'
    | 'content'
    | 'header'
    | 'amp'
    | 'asset'
    | 'visual'
    | 'interaction'
  >((initialTab as any) || 'sitemap');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isSitemapLoading, setIsSitemapLoading] = useState(false);
  const [isCompletenessLoading, setIsCompletenessLoading] = useState(false);
  const [isContentLangLoading, setIsContentLangLoading] = useState(false);
  const [isHeaderLoading, setIsHeaderLoading] = useState(false);
  const [isAmpLoading, setIsAmpLoading] = useState(false);
  const [isAssetLoading, setIsAssetLoading] = useState(false);
  const [isVisualLoading, setIsVisualLoading] = useState(false);
  const [isInteractionLoading, setIsInteractionLoading] = useState(false);
  const [isLinkHealthLoading, setIsLinkHealthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch initial validation results if session exists
  useEffect(() => {
    if (!crawlId) return;

    fetchJson<{ validation?: ValidationSummary }>(`/api/validation/${crawlId}`)
      .then((data) => {
        if (data?.validation) {
          setSummary(data.validation);
        }
      })
      .catch(() => {
        // Validation may not have been executed yet
      });
  }, [crawlId]);

  const handleRunAll = async () => {
    if (!crawlId) return;
    setIsRunningAll(true);
    setErrorMessage(null);

    try {
      const data = await fetchJson<{ summary: ValidationSummary }>(`/api/validation/all/${crawlId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      setSummary(data.summary);
      onValidationComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error running validation checks');
    } finally {
      setIsRunningAll(false);
    }
  };

  const handleRunLinkHealth = async () => {
    if (!crawlId) return;
    setIsLinkHealthLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchJson<{ linkHealth: LinkHealthResult }>(
        `/api/validation/link-health/${crawlId}`,
        { method: 'POST' }
      );

      setSummary((prev) => ({
        crawlId,
        timestamp: Date.now(),
        overallStatus: prev?.overallStatus || 'passed',
        ...prev,
        linkHealth: data.linkHealth,
      }));
      onValidationComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error auditing link & URL health');
    } finally {
      setIsLinkHealthLoading(false);
    }
  };

  const handleRunSitemap = async () => {
    if (!crawlId) return;
    setIsSitemapLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchJson<{ sitemap: SitemapValidationResult }>(`/api/validation/sitemap/${crawlId}`, {
        method: 'POST',
      });

      setSummary((prev) => ({
        crawlId,
        timestamp: Date.now(),
        overallStatus: prev?.overallStatus || 'passed',
        ...prev,
        sitemap: data.sitemap,
      }));
      onValidationComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error validating sitemap');
    } finally {
      setIsSitemapLoading(false);
    }
  };

  const handleRunCompleteness = async () => {
    if (!crawlId) return;
    setIsCompletenessLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchJson<{ completeness: LanguageCompletenessResult }>(`/api/validation/completeness/${crawlId}`, {
        method: 'POST',
      });

      setSummary((prev) => ({
        crawlId,
        timestamp: Date.now(),
        overallStatus: prev?.overallStatus || 'passed',
        ...prev,
        completeness: data.completeness,
      }));
      onValidationComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error validating language completeness');
    } finally {
      setIsCompletenessLoading(false);
    }
  };

  const handleRunContentLanguage = async (threshold?: number) => {
    if (!crawlId) return;
    setIsContentLangLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchJson<{ contentLanguage: ContentLanguageResult }>(`/api/validation/content-language/${crawlId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold }),
      });

      setSummary((prev) => ({
        crawlId,
        timestamp: Date.now(),
        overallStatus: prev?.overallStatus || 'passed',
        ...prev,
        contentLanguage: data.contentLanguage,
      }));
      onValidationComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error validating content language');
    } finally {
      setIsContentLangLoading(false);
    }
  };

  const handleRunHeader = async (maxPages?: number | 'all') => {
    if (!crawlId) return;
    setIsHeaderLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchJson<{ headerNavigation: HeaderValidationResult }>(`/api/validation/header/${crawlId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPages }),
      });

      setSummary((prev) => ({
        crawlId,
        timestamp: Date.now(),
        overallStatus: prev?.overallStatus || 'passed',
        ...prev,
        headerNavigation: data.headerNavigation,
      }));
      onValidationComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error validating header & language navigation');
    } finally {
      setIsHeaderLoading(false);
    }
  };

  const handleRunAmp = async (options?: { checkGuesses?: boolean; passThreshold?: number; warnThreshold?: number }) => {
    if (!crawlId) return;
    setIsAmpLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchJson<{ ampValidation: AmpValidationResult }>(`/api/validation/amp/${crawlId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });

      setSummary((prev) => ({
        crawlId,
        timestamp: Date.now(),
        overallStatus: prev?.overallStatus || 'passed',
        ...prev,
        ampValidation: data.ampValidation,
      }));
      onValidationComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error validating AMP');
    } finally {
      setIsAmpLoading(false);
    }
  };

  const handleRunAsset = async (options?: any) => {
    if (!crawlId) return;
    setIsAssetLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchJson<{ assetValidation: AssetValidationResult }>(`/api/validation/asset/${crawlId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });

      setSummary((prev) => ({
        crawlId,
        timestamp: Date.now(),
        overallStatus: prev?.overallStatus || 'passed',
        ...prev,
        assetValidation: data.assetValidation,
      }));
      onValidationComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error validating assets & links');
    } finally {
      setIsAssetLoading(false);
    }
  };

  const handleRunVisual = async (options?: any) => {
    if (!crawlId) return;
    setIsVisualLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchJson<{ visualValidation: VisualValidationResult }>(`/api/validation/visual/${crawlId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });

      setSummary((prev) => ({
        crawlId,
        timestamp: Date.now(),
        overallStatus: prev?.overallStatus || 'passed',
        ...prev,
        visualValidation: data.visualValidation,
      }));
      onValidationComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing visual & viewport validation');
    } finally {
      setIsVisualLoading(false);
    }
  };

  const handleRunInteraction = async (options?: any) => {
    if (!crawlId) return;
    setIsInteractionLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchJson<{ interactionValidation: InteractionValidationResult }>(
        `/api/validation/interaction/${crawlId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options || {}),
        }
      );

      setSummary((prev) => ({
        crawlId,
        timestamp: Date.now(),
        overallStatus: prev?.overallStatus || 'passed',
        ...prev,
        interactionValidation: data.interactionValidation,
      }));
      onValidationComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing interaction & console validation');
    } finally {
      setIsInteractionLoading(false);
    }
  };

  const isPreCrawl = !crawlId || !crawlStats || crawlStats.status === 'idle';

  return (
    <div className="space-y-6">
      {/* Pre-Crawl Welcome Banner */}
      {isPreCrawl && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/80 p-5 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-bold text-white">Pre-Crawl Validation Explorer</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  All 9 Tools Accessible
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                You can explore each validation tool below, configure exclusion rules, or load demo data to view live matrices, AMP diffs, and responsive reports immediately.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {onLoadDemoData && (
              <button
                type="button"
                onClick={onLoadDemoData}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5 fill-slate-950" />
                <span>Load Sample Data</span>
              </button>
            )}
            {onSelectNavTab && (
              <button
                type="button"
                onClick={() => onSelectNavTab('crawler')}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Compass className="h-3.5 w-3.5" />
                <span>Launch Crawler</span>
              </button>
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="p-1 text-rose-500 hover:text-rose-700 rounded-md hover:bg-rose-100 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Level Health Summary Card */}
      <ValidationSummaryCard
        summary={summary}
        isRunningAll={isRunningAll}
        onRunAll={handleRunAll}
        onSelectTab={setActiveTab}
      />

      {/* Validation Navigation Tabs - All displayed on screen without horizontal scroll */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 w-full shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-1.5 w-full">
          {/* Tab 1: English URLs vs. Sitemap */}
          <button
            type="button"
            onClick={() => setActiveTab('sitemap')}
            className={`w-full py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center text-center gap-1.5 min-w-0 border cursor-pointer ${
              activeTab === 'sitemap'
                ? 'bg-white text-slate-900 border-slate-200 shadow-xs ring-1 ring-slate-900/5'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-1.5 justify-center w-full min-w-0">
              <ShieldCheck className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'sitemap' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span className="truncate text-[11px] sm:text-xs">1. Sitemap</span>
            </div>
            {summary?.sitemap ? (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
                  summary.sitemap.missingFromSitemap === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.sitemap.missingFromSitemap === 0 ? 'Pass' : `${summary.sitemap.missingFromSitemap} Miss`}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal leading-none">—</span>
            )}
            <span
              className={`h-0.5 w-6 rounded-full transition-all ${
                activeTab === 'sitemap' ? 'bg-slate-900' : 'bg-transparent'
              }`}
            />
          </button>

          {/* Tab 2: Language Page Completeness */}
          <button
            type="button"
            onClick={() => setActiveTab('completeness')}
            className={`w-full py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center text-center gap-1.5 min-w-0 border cursor-pointer ${
              activeTab === 'completeness'
                ? 'bg-white text-slate-900 border-slate-200 shadow-xs ring-1 ring-slate-900/5'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-1.5 justify-center w-full min-w-0">
              <Layers className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'completeness' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span className="truncate text-[11px] sm:text-xs">2. Completeness</span>
            </div>
            {summary?.completeness ? (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
                  summary.completeness.totalMissing === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.completeness.totalMissing === 0 ? 'Pass' : `${summary.completeness.totalMissing} Miss`}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal leading-none">—</span>
            )}
            <span
              className={`h-0.5 w-6 rounded-full transition-all ${
                activeTab === 'completeness' ? 'bg-slate-900' : 'bg-transparent'
              }`}
            />
          </button>

          {/* Tab 3: Page Content Language */}
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`w-full py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center text-center gap-1.5 min-w-0 border cursor-pointer ${
              activeTab === 'content'
                ? 'bg-white text-slate-900 border-slate-200 shadow-xs ring-1 ring-slate-900/5'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-1.5 justify-center w-full min-w-0">
              <Languages className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'content' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span className="truncate text-[11px] sm:text-xs">3. Content Lang</span>
            </div>
            {summary?.contentLanguage ? (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
                  summary.contentLanguage.mismatchCount === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.contentLanguage.mismatchCount === 0
                  ? 'Pass'
                  : `${summary.contentLanguage.mismatchCount} Err`}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal leading-none">—</span>
            )}
            <span
              className={`h-0.5 w-6 rounded-full transition-all ${
                activeTab === 'content' ? 'bg-slate-900' : 'bg-transparent'
              }`}
            />
          </button>

          {/* Tab 4: Header & Language Navigation */}
          <button
            type="button"
            onClick={() => setActiveTab('header')}
            className={`w-full py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center text-center gap-1.5 min-w-0 border cursor-pointer ${
              activeTab === 'header'
                ? 'bg-white text-slate-900 border-slate-200 shadow-xs ring-1 ring-slate-900/5'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-1.5 justify-center w-full min-w-0">
              <Smartphone className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'header' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span className="truncate text-[11px] sm:text-xs">4. Navigation</span>
            </div>
            {summary?.headerNavigation ? (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
                  summary.headerNavigation.headerMismatchCount === 0 &&
                  summary.headerNavigation.totalLanguageErrors === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.headerNavigation.headerMismatchCount === 0 &&
                summary.headerNavigation.totalLanguageErrors === 0
                  ? 'Pass'
                  : `${summary.headerNavigation.headerMismatchCount + summary.headerNavigation.totalLanguageErrors} Err`}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal leading-none">—</span>
            )}
            <span
              className={`h-0.5 w-6 rounded-full transition-all ${
                activeTab === 'header' ? 'bg-slate-900' : 'bg-transparent'
              }`}
            />
          </button>

          {/* Tab 5: AMP Validation */}
          <button
            type="button"
            onClick={() => setActiveTab('amp')}
            className={`w-full py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center text-center gap-1.5 min-w-0 border cursor-pointer ${
              activeTab === 'amp'
                ? 'bg-white text-slate-900 border-slate-200 shadow-xs ring-1 ring-slate-900/5'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-1.5 justify-center w-full min-w-0">
              <Zap className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'amp' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span className="truncate text-[11px] sm:text-xs">5. AMP</span>
            </div>
            {summary?.ampValidation ? (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
                  summary.ampValidation.errorCount === 0
                    ? summary.ampValidation.warningCount === 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.ampValidation.errorCount === 0
                  ? summary.ampValidation.warningCount === 0
                    ? summary.ampValidation.totalAmpFound > 0 ? 'Pass' : '0 AMP'
                    : `${summary.ampValidation.warningCount} Warn`
                  : `${summary.ampValidation.errorCount} Err`}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal leading-none">—</span>
            )}
            <span
              className={`h-0.5 w-6 rounded-full transition-all ${
                activeTab === 'amp' ? 'bg-slate-900' : 'bg-transparent'
              }`}
            />
          </button>

          {/* Tab 6: Links, Assets & HTTP Health */}
          <button
            type="button"
            onClick={() => setActiveTab('asset')}
            className={`w-full py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center text-center gap-1.5 min-w-0 border cursor-pointer ${
              activeTab === 'asset'
                ? 'bg-white text-slate-900 border-slate-200 shadow-xs ring-1 ring-slate-900/5'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-1.5 justify-center w-full min-w-0">
              <FileCheck2 className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'asset' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span className="truncate text-[11px] sm:text-xs">6. Assets & Health</span>
            </div>
            {summary?.assetValidation ? (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
                  (summary.assetValidation.brokenAssets ?? (summary.assetValidation as any).brokenCount ?? 0) === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {(summary.assetValidation.brokenAssets ?? (summary.assetValidation as any).brokenCount ?? 0) === 0
                  ? 'Pass'
                  : `${summary.assetValidation.brokenAssets ?? (summary.assetValidation as any).brokenCount ?? 0} Broken`}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal leading-none">—</span>
            )}
            <span
              className={`h-0.5 w-6 rounded-full transition-all ${
                activeTab === 'asset' ? 'bg-slate-900' : 'bg-transparent'
              }`}
            />
          </button>

          {/* Tab 7: Visual & Viewport */}
          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            className={`w-full py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center text-center gap-1.5 min-w-0 border cursor-pointer ${
              activeTab === 'visual'
                ? 'bg-white text-slate-900 border-slate-200 shadow-xs ring-1 ring-slate-900/5'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-1.5 justify-center w-full min-w-0">
              <Eye className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'visual' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span className="truncate text-[11px] sm:text-xs">7. Viewport</span>
            </div>
            {summary?.visualValidation ? (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
                  summary.visualValidation.totalErrors === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.visualValidation.totalErrors === 0
                  ? 'Pass'
                  : `${summary.visualValidation.totalErrors} Breaks`}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal leading-none">—</span>
            )}
            <span
              className={`h-0.5 w-6 rounded-full transition-all ${
                activeTab === 'visual' ? 'bg-slate-900' : 'bg-transparent'
              }`}
            />
          </button>

          {/* Tab 8: Interaction & Console */}
          <button
            type="button"
            onClick={() => setActiveTab('interaction')}
            className={`w-full py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center text-center gap-1.5 min-w-0 border cursor-pointer ${
              activeTab === 'interaction'
                ? 'bg-white text-slate-900 border-slate-200 shadow-xs ring-1 ring-slate-900/5'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-1.5 justify-center w-full min-w-0">
              <MousePointerClick className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'interaction' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span className="truncate text-[11px] sm:text-xs">8. Interaction</span>
            </div>
            {summary?.interactionValidation ? (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
                  summary.interactionValidation.errorCount === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.interactionValidation.errorCount === 0
                  ? 'Pass'
                  : `${summary.interactionValidation.consoleErrorCount ?? summary.interactionValidation.errorCount} JS Err`}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal leading-none">—</span>
            )}
            <span
              className={`h-0.5 w-6 rounded-full transition-all ${
                activeTab === 'interaction' ? 'bg-slate-900' : 'bg-transparent'
              }`}
            />
          </button>

          {/* Tab 9: Link & URL Health */}
          <button
            type="button"
            onClick={() => setActiveTab('linkhealth')}
            className={`w-full py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center text-center gap-1.5 min-w-0 border cursor-pointer ${
              activeTab === 'linkhealth'
                ? 'bg-white text-slate-900 border-slate-200 shadow-xs ring-1 ring-slate-900/5'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-1.5 justify-center w-full min-w-0">
              <Link2 className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'linkhealth' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span className="truncate text-[11px] sm:text-xs">9. Link Health</span>
            </div>
            {summary?.linkHealth ? (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
                  summary.linkHealth.overallStatus === 'passed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : summary.linkHealth.overallStatus === 'warning'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.linkHealth.overallStatus === 'passed'
                  ? 'Pass'
                  : summary.linkHealth.brokenInternalCount + summary.linkHealth.brokenExternalCount > 0
                  ? `${summary.linkHealth.brokenInternalCount + summary.linkHealth.brokenExternalCount} Broken`
                  : `${summary.linkHealth.items.length} Issue`}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal leading-none">—</span>
            )}
            <span
              className={`h-0.5 w-6 rounded-full transition-all ${
                activeTab === 'linkhealth' ? 'bg-slate-900' : 'bg-transparent'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'linkhealth' && (
        <LinkHealthValidation
          result={summary?.linkHealth || null}
          isLoading={isLinkHealthLoading || isRunningAll}
          crawlId={crawlId}
          domain={crawlStats?.domain || ''}
          onRunValidation={handleRunLinkHealth}
        />
      )}

      {activeTab === 'sitemap' && (
        <SitemapValidation
          result={summary?.sitemap || null}
          isLoading={isSitemapLoading || isRunningAll}
          domain={crawlStats?.domain || ''}
          onRunValidation={handleRunSitemap}
        />
      )}

      {activeTab === 'completeness' && (
        <LanguageCompleteness
          result={summary?.completeness || null}
          isLoading={isCompletenessLoading || isRunningAll}
          domain={crawlStats?.domain || ''}
          onRunValidation={handleRunCompleteness}
        />
      )}

      {activeTab === 'content' && (
        <ContentLanguageValidation
          result={summary?.contentLanguage || null}
          isLoading={isContentLangLoading || isRunningAll}
          domain={crawlStats?.domain || ''}
          onRunValidation={handleRunContentLanguage}
        />
      )}

      {activeTab === 'header' && (
        <HeaderLanguageValidation
          result={summary?.headerNavigation || null}
          isLoading={isHeaderLoading || isRunningAll}
          domain={crawlStats?.domain || ''}
          onRunValidation={handleRunHeader}
        />
      )}

      {activeTab === 'amp' && (
        <AmpValidation
          result={summary?.ampValidation || null}
          isLoading={isAmpLoading || isRunningAll}
          domain={crawlStats?.domain || ''}
          onRunValidation={handleRunAmp}
        />
      )}

      {activeTab === 'asset' && (
        <AssetValidation
          result={summary?.assetValidation || null}
          isLoading={isAssetLoading || isRunningAll}
          domain={crawlStats?.domain || ''}
          onRunValidation={handleRunAsset}
        />
      )}

      {activeTab === 'visual' && (
        <VisualValidation
          result={summary?.visualValidation || null}
          isLoading={isVisualLoading || isRunningAll}
          domain={crawlStats?.domain || ''}
          onRunValidation={handleRunVisual}
        />
      )}

      {activeTab === 'interaction' && (
        <InteractionValidation
          result={summary?.interactionValidation || null}
          isLoading={isInteractionLoading || isRunningAll}
          domain={crawlStats?.domain || ''}
          onRunValidation={handleRunInteraction}
        />
      )}
    </div>
  );
};


