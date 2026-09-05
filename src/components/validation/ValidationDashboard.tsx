import React, { useState, useEffect } from 'react';
import {
  CrawlStats,
  ValidationSummary,
  SitemapValidationResult,
  LanguageCompletenessResult,
  ContentLanguageResult,
  HeaderValidationResult,
  AmpValidationResult,
} from '../../types';
import { ValidationSummaryCard } from './ValidationSummaryCard';
import { SitemapValidation } from './SitemapValidation';
import { LanguageCompleteness } from './LanguageCompleteness';
import { ContentLanguageValidation } from './ContentLanguageValidation';
import { HeaderLanguageValidation } from './HeaderLanguageValidation';
import { AmpValidation } from './AmpValidation';
import { ShieldCheck, Layers, Languages, Smartphone, Zap, AlertCircle, X } from 'lucide-react';
import { fetchJson } from '../../utils/apiUtils';

interface ValidationDashboardProps {
  crawlId: string | null;
  crawlStats: CrawlStats | null;
  onValidationComplete?: () => void;
}

export const ValidationDashboard: React.FC<ValidationDashboardProps> = ({
  crawlId,
  crawlStats,
  onValidationComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'sitemap' | 'completeness' | 'content' | 'header' | 'amp'>('sitemap');
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isSitemapLoading, setIsSitemapLoading] = useState(false);
  const [isCompletenessLoading, setIsCompletenessLoading] = useState(false);
  const [isContentLangLoading, setIsContentLangLoading] = useState(false);
  const [isHeaderLoading, setIsHeaderLoading] = useState(false);
  const [isAmpLoading, setIsAmpLoading] = useState(false);
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

  if (!crawlId || !crawlStats || crawlStats.status === 'idle') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="max-w-md mx-auto space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Active Crawl Dataset</h3>
          <p className="text-xs text-slate-500">
            Please crawl a website first in Stage 1. Once crawled, all validation tools (Sitemap Coverage,
            Language Completeness, Text Language Verification, and Header & Language Navigation) will instantly analyze the discovered
            dataset.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Validation Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto pb-px">
          {/* Tab 1: English URLs vs. Sitemap */}
          <button
            type="button"
            onClick={() => setActiveTab('sitemap')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'sitemap'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>1. English URLs vs. Sitemap</span>
            {summary?.sitemap && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  summary.sitemap.missingFromSitemap === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.sitemap.missingFromSitemap === 0 ? 'Pass' : `${summary.sitemap.missingFromSitemap} Missing`}
              </span>
            )}
          </button>

          {/* Tab 2: Language Page Completeness */}
          <button
            type="button"
            onClick={() => setActiveTab('completeness')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'completeness'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>2. Language Page Completeness</span>
            {summary?.completeness && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  summary.completeness.totalMissing === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.completeness.totalMissing === 0 ? 'Pass' : `${summary.completeness.totalMissing} Missing`}
              </span>
            )}
          </button>

          {/* Tab 3: Page Content Language */}
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'content'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Languages className="h-4 w-4" />
            <span>3. Page Content Language</span>
            {summary?.contentLanguage && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  summary.contentLanguage.mismatchCount === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.contentLanguage.mismatchCount === 0
                  ? 'Pass'
                  : `${summary.contentLanguage.mismatchCount} Errors`}
              </span>
            )}
          </button>

          {/* Tab 4: Header & Language Navigation */}
          <button
            type="button"
            onClick={() => setActiveTab('header')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'header'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>4. Header & Language Navigation</span>
            {summary?.headerNavigation && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  summary.headerNavigation.headerMismatchCount === 0 &&
                  summary.headerNavigation.totalLanguageErrors === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.headerNavigation.headerMismatchCount === 0 &&
                summary.headerNavigation.totalLanguageErrors === 0
                  ? 'Pass'
                  : `${summary.headerNavigation.headerMismatchCount + summary.headerNavigation.totalLanguageErrors} Errors`}
              </span>
            )}
          </button>

          {/* Tab 5: AMP Validation */}
          <button
            type="button"
            onClick={() => setActiveTab('amp')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'amp'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>5. AMP Validation</span>
            {summary?.ampValidation && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
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
                  : `${summary.ampValidation.errorCount} Errors`}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Panels */}
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
    </div>
  );
};

