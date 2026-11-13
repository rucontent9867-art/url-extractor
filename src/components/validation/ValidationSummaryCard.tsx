import React from 'react';
import { ValidationSummary } from '../../types';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RefreshCw,
  Image,
  Layers,
  Link2,
  Eye,
} from 'lucide-react';

type AuditTab =
  | 'linkhealth'
  | 'sitemap'
  | 'completeness'
  | 'content'
  | 'header'
  | 'amp'
  | 'asset'
  | 'visual'
  | 'interaction';

interface ValidationSummaryCardProps {
  summary: ValidationSummary | null;
  isRunningAll: boolean;
  onRunAll: () => void;
  onSelectTab: (tab: AuditTab) => void;
}

/**
 * Plain-language overview: is the site healthy, and which area do I open next?
 * Detailed numbers live inside each area, not here.
 */
export const ValidationSummaryCard: React.FC<ValidationSummaryCardProps> = ({
  summary,
  isRunningAll,
  onRunAll,
  onSelectTab,
}) => {
  if (!summary || summary.overallStatus === 'not_run') {
    return (
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <h2 className="text-lg font-bold tracking-tight">Ready to check this site</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            This runs every check on the pages we crawled and then tells you only what is broken.
          </p>
        </div>
        <button
          type="button"
          onClick={onRunAll}
          disabled={isRunningAll}
          className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all flex items-center justify-center space-x-2 shrink-0 disabled:opacity-50 cursor-pointer"
        >
          {isRunningAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
          <span>{isRunningAll ? 'Running checks…' : 'Run all checks'}</span>
        </button>
      </div>
    );
  }

  const lh = summary.linkHealth;
  const linkIssues = lh
    ? lh.brokenInternalCount +
      lh.brokenExternalCount +
      lh.redirectChainCount +
      lh.placeholderCount +
      lh.emptyAnchorCount +
      lh.brokenAnchorCount +
      lh.doubleSlashCount +
      lh.trackingParamCount
    : undefined;

  const groups: Array<{
    id: string;
    label: string;
    target: AuditTab;
    count: number | undefined;
    detail: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'links',
      label: 'Links & sitemaps',
      target: 'linkhealth',
      count:
        linkIssues === undefined && !summary.sitemap
          ? undefined
          : (linkIssues ?? 0) + (summary.sitemap?.missingFromSitemap ?? 0),
      detail: lh ? `${lh.totalLinksScanned.toLocaleString()} links checked` : 'Not checked yet',
      icon: <Link2 className="h-4 w-4" />,
    },
    {
      id: 'content',
      label: 'Content & languages',
      target: 'completeness',
      count:
        !summary.completeness && !summary.contentLanguage && !summary.headerNavigation
          ? undefined
          : (summary.completeness?.totalMissing ?? 0) +
            (summary.contentLanguage?.mismatchCount ?? 0) +
            (summary.headerNavigation?.headerMismatchCount ?? 0),
      detail: `${summary.completeness?.languages?.length ?? 0} languages compared`,
      icon: <Layers className="h-4 w-4" />,
    },
    {
      id: 'frontend',
      label: 'Frontend quality',
      target: 'visual',
      count:
        !summary.visualValidation && !summary.interactionValidation && !summary.ampValidation
          ? undefined
          : (summary.visualValidation?.totalErrors ?? 0) +
            (summary.interactionValidation?.errorCount ?? 0) +
            (summary.ampValidation?.errorCount ?? 0),
      detail: 'Layouts, buttons, AMP',
      icon: <Eye className="h-4 w-4" />,
    },
    {
      id: 'assets',
      label: 'Images & assets',
      target: 'asset',
      count: summary.assetValidation
        ? summary.assetValidation.brokenAssets ?? summary.assetValidation.brokenCount ?? 0
        : undefined,
      detail: summary.assetValidation
        ? `${summary.assetValidation.totalAssets.toLocaleString()} assets checked`
        : 'Not checked yet',
      icon: <Image className="h-4 w-4" />,
    },
  ];

  const totalIssues = groups.reduce((sum, group) => sum + (group.count ?? 0), 0);
  const isPassed = summary.overallStatus === 'passed';
  const isWarning = summary.overallStatus === 'warning';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div
            className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isPassed ? 'bg-emerald-100 text-emerald-700' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {isPassed ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : isWarning ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isPassed ? 'Everything looks good' : isWarning ? 'A few things need attention' : 'Broken things found'}
            </h2>
            <p className="text-xs text-slate-500">
              {totalIssues > 0
                ? `${totalIssues.toLocaleString()} issue${totalIssues === 1 ? '' : 's'} across ${groups.filter((g) => (g.count ?? 0) > 0).length} area${groups.filter((g) => (g.count ?? 0) > 0).length === 1 ? '' : 's'} · checked ${new Date(summary.timestamp).toLocaleTimeString()}`
                : `No issues found · checked ${new Date(summary.timestamp).toLocaleTimeString()}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRunAll}
          disabled={isRunningAll}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 shrink-0 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRunningAll ? 'animate-spin' : ''}`} />
          <span>{isRunningAll ? 'Re-running…' : 'Re-run checks'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {groups.map((group) => {
          const count = group.count;
          const hasIssues = (count ?? 0) > 0;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectTab(group.target)}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <span
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    count === undefined
                      ? 'bg-slate-100 text-slate-400'
                      : hasIssues
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {group.icon}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate">{group.label}</span>
                  <span className="text-[11px] text-slate-500 block truncate">{group.detail}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    count === undefined
                      ? 'bg-slate-100 text-slate-500'
                      : hasIssues
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {count === undefined ? 'Not run' : hasIssues ? `${count} to fix` : 'All good'}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
