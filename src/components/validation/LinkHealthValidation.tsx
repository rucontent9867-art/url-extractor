import React, { useState, useMemo, useEffect } from 'react';
import {
  LinkHealthResult,
  LinkHealthItem,
} from '../../types';
import {
  Link2,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Zap,
  Globe,
  Info,
  CornerDownRight,
  Eye,
  X,
  ShieldCheck,
} from 'lucide-react';
import { fetchJson } from '../../utils/apiUtils';
import { copyStringListToClipboard } from '../../utils/exportUtils';

interface LinkHealthValidationProps {
  result: LinkHealthResult | null;
  isLoading: boolean;
  crawlId?: string | null;
  domain?: string;
  onRunValidation: () => void;
}

type FilterCategory =
  | 'all'
  | 'broken'
  | 'redirects'
  | 'placeholders'
  | 'empty_anchors'
  | 'anchors'
  | 'double_slash'
  | 'tracking'
  | 'healthy';

const MAX_DIRECT_URLS = 50;

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-800 border border-rose-200',
  warning: 'bg-amber-100 text-amber-800 border border-amber-200',
  info: 'bg-blue-100 text-blue-800 border border-blue-200',
  healthy: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
};

const ISSUE_LABELS: Record<string, string> = {
  broken_internal: 'Broken Internal',
  broken_external: 'Broken External',
  redirect_chain: 'Redirect Chain',
  redirect_loop: 'Redirect Loop',
  double_slash: 'Double Slash',
  placeholder: 'Placeholder Link',
  broken_anchor: 'Broken Anchor',
  empty_anchor: 'Empty Anchor Text',
  tracking_param: 'Tracking Params',
  healthy: 'Healthy',
};

/** Quotes a CSV cell and neutralises formula injection (=, +, -, @) */
const csvCell = (value: string | number | undefined): string => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
};

export const LinkHealthValidation: React.FC<LinkHealthValidationProps> = ({
  result,
  isLoading,
  crawlId,
  domain,
  onRunValidation,
}) => {
  const [activeMode, setActiveMode] = useState<'session' | 'direct'>(
    crawlId ? 'session' : 'direct'
  );
  const [directUrlInput, setDirectUrlInput] = useState(
    'https://togo-evisa.com/\nhttps://togo-evisa.com/tourist-evisa/'
  );
  const [isDirectLoading, setIsDirectLoading] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [directResult, setDirectResult] = useState<LinkHealthResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [inspectModalItem, setInspectModalItem] = useState<LinkHealthItem | null>(null);

  // When a crawl/demo dataset becomes available, show its session audit by default
  // (never overrides a direct audit the user already ran).
  useEffect(() => {
    if (crawlId && !directResult) {
      setActiveMode('session');
    }
  }, [crawlId, directResult]);

  // Close the inspector with Escape (keyboard accessibility)
  useEffect(() => {
    if (!inspectModalItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInspectModalItem(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectModalItem]);

  const currentResult = activeMode === 'direct' ? directResult : result;

  const directUrls = useMemo(
    () =>
      Array.from(
        new Set(
          directUrlInput
            .split(/[\r\n,]+/)
            .map((u) => u.trim())
            .filter((u) => u.startsWith('http://') || u.startsWith('https://'))
        )
      ),
    [directUrlInput]
  );

  const handleRunDirectAudit = async () => {
    if (directUrls.length === 0) {
      setDirectError('Paste at least one URL starting with http:// or https://.');
      return;
    }

    setDirectError(null);
    setIsDirectLoading(true);
    setActiveFilter('all');
    setSearchTerm('');

    try {
      const data = await fetchJson<{ success: boolean; linkHealth: LinkHealthResult }>(
        '/api/validation/link-health/direct',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: directUrls.slice(0, MAX_DIRECT_URLS) }),
        }
      );
      if (data?.linkHealth) {
        setDirectResult(data.linkHealth);
      } else {
        setDirectError('The audit returned no results. Please try again.');
      }
    } catch (err: any) {
      setDirectError(err?.message || 'Failed to run the instant link audit.');
    } finally {
      setIsDirectLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!currentResult || activeFilter === 'healthy') return [];
    let items = currentResult.items;

    if (activeFilter === 'broken') {
      items = items.filter((i) => i.issueType === 'broken_internal' || i.issueType === 'broken_external');
    } else if (activeFilter === 'redirects') {
      items = items.filter((i) => i.issueType === 'redirect_chain' || i.issueType === 'redirect_loop');
    } else if (activeFilter === 'placeholders') {
      items = items.filter((i) => i.issueType === 'placeholder');
    } else if (activeFilter === 'empty_anchors') {
      items = items.filter((i) => i.issueType === 'empty_anchor');
    } else if (activeFilter === 'anchors') {
      items = items.filter((i) => i.issueType === 'broken_anchor');
    } else if (activeFilter === 'double_slash') {
      items = items.filter((i) => i.issueType === 'double_slash');
    } else if (activeFilter === 'tracking') {
      items = items.filter((i) => i.issueType === 'tracking_param');
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        (i) =>
          i.targetUrl.toLowerCase().includes(q) ||
          i.sourceUrl.toLowerCase().includes(q) ||
          i.anchorText.toLowerCase().includes(q) ||
          i.recommendation.toLowerCase().includes(q) ||
          (i.details || '').toLowerCase().includes(q)
      );
    }

    return items;
  }, [currentResult, activeFilter, searchTerm]);

  const handleCopyUrl = async (url: string) => {
    const ok = await copyStringListToClipboard([url]);
    if (ok) {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 1800);
    }
  };

  const handleExportCsv = () => {
    if (!currentResult || filteredItems.length === 0) return;

    const headers = [
      'Severity',
      'Issue Type',
      'HTTP Status',
      'Source Page',
      'Anchor Text',
      'Anchor Type',
      'Target URL',
      'Final Destination',
      'Redirect Hops',
      'Scope',
      'Details',
      'Recommendation',
    ];

    const rows = filteredItems.map((i) =>
      [
        csvCell(i.severity),
        csvCell(ISSUE_LABELS[i.issueType] || i.issueType),
        csvCell(i.statusCode ?? ''),
        csvCell(i.sourceUrl),
        csvCell(i.anchorText),
        csvCell(i.anchorType),
        csvCell(i.targetUrl),
        csvCell(i.finalDestinationUrl ?? ''),
        csvCell(i.redirectHops ?? ''),
        csvCell(i.isInternal ? 'Internal' : 'External'),
        csvCell(i.details ?? ''),
        csvCell(i.recommendation),
      ].join(',')
    );

    const csvContent = [headers.map(csvCell).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `link-health-${activeMode === 'direct' ? 'url-audit' : 'site-crawl'}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJiraReport = async () => {
    if (!currentResult || filteredItems.length === 0) return;

    const lines = filteredItems.map(
      (i) =>
        `* [${i.severity.toUpperCase()}] ${(ISSUE_LABELS[i.issueType] || i.issueType).toUpperCase()} on ${i.sourceUrl}\n` +
        `  Target: ${i.targetUrl}${i.statusCode ? ` (HTTP ${i.statusCode})` : ''}\n` +
        `  Anchor: "${i.anchorText}"\n` +
        `  Fix: ${i.recommendation}`
    );
    const ok = await copyStringListToClipboard([lines.join('\n\n')]);
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const isBusy = isLoading || isDirectLoading;

  return (
    <div className="space-y-6">
      {/* Top Controller: Mode Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">Tool 9: Link & URL Health Engine</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Dual Mode
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Broken links (4xx/5xx), 2+ hop redirect chains, redirect loops, double slashes, placeholder
              hrefs, broken in-page anchors, empty anchor text and tracking parameter pollution.
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveMode('session')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeMode === 'session'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-blue-600" />
            <span>Full Website Crawl</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('direct')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeMode === 'direct'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Instant URL List</span>
          </button>
        </div>
      </div>

      {/* Direct Ad-hoc URL Input Panel */}
      {activeMode === 'direct' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
              <span>Paste URLs to Audit (single page or up to {MAX_DIRECT_URLS})</span>
              <span className="text-[10px] font-normal text-slate-400">One URL per line</span>
            </label>
            <button
              type="button"
              onClick={() => setDirectUrlInput('https://togo-evisa.com/\nhttps://togo-evisa.com/tourist-evisa/')}
              className="text-[11px] font-medium text-emerald-700 hover:underline cursor-pointer"
            >
              Load Example URLs
            </button>
          </div>

          <textarea
            rows={4}
            value={directUrlInput}
            onChange={(e) => setDirectUrlInput(e.target.value)}
            placeholder="https://example.com/page-1&#10;https://example.com/page-2"
            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
          />

          {directError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center space-x-2">
              <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
              <span>{directError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-400">
              {directUrls.length > 0
                ? `${directUrls.length} URL${directUrls.length === 1 ? '' : 's'} queued${
                    directUrls.length > MAX_DIRECT_URLS ? ` — only the first ${MAX_DIRECT_URLS} will be audited` : ''
                  }.`
                : 'Fetches only these pages, extracts every anchor, then verifies destinations in parallel.'}
            </span>
            <button
              type="button"
              onClick={handleRunDirectAudit}
              disabled={isDirectLoading || directUrls.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isDirectLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              <span>{isDirectLoading ? 'Auditing Links...' : 'Audit These Pages Now'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Session mode entry point */}
      {activeMode === 'session' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs">
            <span className="font-bold text-slate-900 block">
              {crawlId ? `Deep scan targets: ${domain || 'active crawl session'}` : 'No crawl session loaded'}
            </span>
            <span className="text-slate-500">
              {crawlId
                ? 'Every anchor retained from the crawl is re-verified: destinations, redirect chains, anchors and placeholders.'
                : 'Run a crawl first to deep-scan the whole site, or switch to Instant URL List mode.'}
            </span>
          </div>
          <button
            type="button"
            onClick={onRunValidation}
            disabled={isLoading || !crawlId}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {isLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Globe className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span>{isLoading ? 'Auditing Site Links...' : 'Run Full Website Link Audit'}</span>
          </button>
        </div>
      )}

      {/* Loading state */}
      {isBusy && !currentResult && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex items-center space-x-3">
          <RefreshCw className="h-4 w-4 animate-spin text-slate-700" />
          <div className="text-xs">
            <span className="font-semibold text-slate-900 block">Auditing links...</span>
            <span className="text-slate-500">
              Tracing redirects hop by hop and verifying every destination in parallel.
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards Strip */}
      {currentResult && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Links Audited</span>
            <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">
              {currentResult.totalLinksScanned.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 block truncate">
              {currentResult.pagesScanned} pages scanned
              {currentResult.durationMs ? ` · ${(currentResult.durationMs / 1000).toFixed(1)}s` : ''}
            </span>
          </div>

          <div
            className={`p-4 rounded-2xl border shadow-2xs ${
              currentResult.brokenInternalCount + currentResult.brokenExternalCount > 0
                ? 'bg-rose-50/80 border-rose-200'
                : 'bg-white border-slate-200'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block ${
                currentResult.brokenInternalCount + currentResult.brokenExternalCount > 0
                  ? 'text-rose-700'
                  : 'text-slate-400'
              }`}
            >
              Broken Links
            </span>
            <span
              className={`text-xl font-extrabold mt-0.5 block ${
                currentResult.brokenInternalCount + currentResult.brokenExternalCount > 0
                  ? 'text-rose-900'
                  : 'text-slate-900'
              }`}
            >
              {currentResult.brokenInternalCount + currentResult.brokenExternalCount}
            </span>
            <span
              className={`text-[11px] block truncate ${
                currentResult.brokenInternalCount + currentResult.brokenExternalCount > 0
                  ? 'text-rose-700'
                  : 'text-slate-400'
              }`}
            >
              {currentResult.brokenInternalCount} internal / {currentResult.brokenExternalCount} external
            </span>
          </div>

          <div
            className={`p-4 rounded-2xl border shadow-2xs ${
              currentResult.redirectChainCount > 0 ? 'bg-amber-50/80 border-amber-200' : 'bg-white border-slate-200'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block ${
                currentResult.redirectChainCount > 0 ? 'text-amber-800' : 'text-slate-400'
              }`}
            >
              Redirect Chains
            </span>
            <span
              className={`text-xl font-extrabold mt-0.5 block ${
                currentResult.redirectChainCount > 0 ? 'text-amber-950' : 'text-slate-900'
              }`}
            >
              {currentResult.redirectChainCount}
            </span>
            <span
              className={`text-[11px] block truncate ${
                currentResult.redirectChainCount > 0 ? 'text-amber-800' : 'text-slate-400'
              }`}
            >
              2+ hops or loops
            </span>
          </div>

          <div
            className={`p-4 rounded-2xl border shadow-2xs ${
              currentResult.placeholderCount > 0 ? 'bg-amber-50/80 border-amber-200' : 'bg-white border-slate-200'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block ${
                currentResult.placeholderCount > 0 ? 'text-amber-800' : 'text-slate-400'
              }`}
            >
              Placeholders (#)
            </span>
            <span
              className={`text-xl font-extrabold mt-0.5 block ${
                currentResult.placeholderCount > 0 ? 'text-amber-950' : 'text-slate-900'
              }`}
            >
              {currentResult.placeholderCount}
            </span>
            <span
              className={`text-[11px] block truncate ${
                currentResult.placeholderCount > 0 ? 'text-amber-800' : 'text-slate-400'
              }`}
            >
              Dummy / JS links
            </span>
          </div>

          <div
            className={`p-4 rounded-2xl border shadow-2xs ${
              currentResult.emptyAnchorCount + currentResult.brokenAnchorCount > 0
                ? 'bg-amber-50/80 border-amber-200'
                : 'bg-white border-slate-200'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block ${
                currentResult.emptyAnchorCount + currentResult.brokenAnchorCount > 0
                  ? 'text-amber-800'
                  : 'text-slate-400'
              }`}
            >
              Anchor Issues
            </span>
            <span
              className={`text-xl font-extrabold mt-0.5 block ${
                currentResult.emptyAnchorCount + currentResult.brokenAnchorCount > 0
                  ? 'text-amber-950'
                  : 'text-slate-900'
              }`}
            >
              {currentResult.emptyAnchorCount + currentResult.brokenAnchorCount}
            </span>
            <span
              className={`text-[11px] block truncate ${
                currentResult.emptyAnchorCount + currentResult.brokenAnchorCount > 0
                  ? 'text-amber-800'
                  : 'text-slate-400'
              }`}
            >
              {currentResult.emptyAnchorCount} empty / {currentResult.brokenAnchorCount} broken
            </span>
          </div>

          <div
            className={`p-4 rounded-2xl border shadow-2xs ${
              currentResult.healthScore >= 90
                ? 'bg-emerald-50/80 border-emerald-200'
                : currentResult.healthScore >= 70
                ? 'bg-amber-50/80 border-amber-200'
                : 'bg-rose-50/80 border-rose-200'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block ${
                currentResult.healthScore >= 90
                  ? 'text-emerald-800'
                  : currentResult.healthScore >= 70
                  ? 'text-amber-800'
                  : 'text-rose-800'
              }`}
            >
              Health Score
            </span>
            <span
              className={`text-xl font-extrabold mt-0.5 block ${
                currentResult.healthScore >= 90
                  ? 'text-emerald-950'
                  : currentResult.healthScore >= 70
                  ? 'text-amber-950'
                  : 'text-rose-950'
              }`}
            >
              {currentResult.healthScore}%
            </span>
            <span
              className={`text-[11px] block truncate ${
                currentResult.healthScore >= 90
                  ? 'text-emerald-800'
                  : currentResult.healthScore >= 70
                  ? 'text-amber-800'
                  : 'text-rose-800'
              }`}
            >
              {currentResult.healthyCount} healthy links
            </span>
          </div>
        </div>
      )}

      {/* Partial / unverified audit notice */}
      {currentResult &&
        (currentResult.itemsTruncated || (currentResult.unverifiedCount ?? 0) > 0) && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start space-x-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {currentResult.itemsTruncated && (
                <p>
                  The findings list is capped at {currentResult.items.length} rows to keep responses fast. The
                  counters above are complete — use the filters to narrow the list.
                </p>
              )}
              {(currentResult.unverifiedCount ?? 0) > 0 && (
                <p>
                  {currentResult.unverifiedCount} link destination(s) could not be verified within the audit
                  budget and are deliberately not counted as broken. Re-run to retry them.
                </p>
              )}
            </div>
          </div>
        )}

      {/* Main Content Area */}
      {currentResult ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
          {/* Filter Bar & Export Actions */}
          <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: `All (${currentResult.items.length})` },
                {
                  id: 'broken',
                  label: `Broken (${currentResult.brokenInternalCount + currentResult.brokenExternalCount})`,
                },
                { id: 'redirects', label: `Redirects (${currentResult.redirectChainCount})` },
                { id: 'placeholders', label: `Placeholders (${currentResult.placeholderCount})` },
                { id: 'empty_anchors', label: `Empty Anchors (${currentResult.emptyAnchorCount})` },
                { id: 'anchors', label: `Broken Anchors (${currentResult.brokenAnchorCount})` },
                { id: 'double_slash', label: `Double Slash (${currentResult.doubleSlashCount})` },
                { id: 'tracking', label: `Tracking (${currentResult.trackingParamCount})` },
                { id: 'healthy', label: `Healthy (${currentResult.healthyCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id as FilterCategory)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <div className="relative w-44 sm:w-56">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by URL, anchor, fix..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredItems.length === 0}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                title="Download CSV report"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>

              <button
                type="button"
                onClick={handleCopyJiraReport}
                disabled={filteredItems.length === 0}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                title="Copy Jira-ready bug summary"
              >
                {copiedAll ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{copiedAll ? 'Copied' : 'Jira'}</span>
              </button>
            </div>
          </div>

          {activeFilter === 'healthy' ? (
            <div className="p-10 text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {currentResult.healthyCount.toLocaleString()} links passed every check
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Healthy links returned 2xx (directly, without a redirect chain), contain real anchor text, and
                point to destinations that exist. Only issues are listed in the table.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-4">Severity & Issue</th>
                    <th className="py-2.5 px-4">Source Page</th>
                    <th className="py-2.5 px-4">Anchor Text & Type</th>
                    <th className="py-2.5 px-4">Destination Target</th>
                    <th className="py-2.5 px-4">Recommendation</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors align-top">
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.info
                              }`}
                            >
                              {item.severity === 'critical' ? (
                                <AlertOctagon className="h-3 w-3 shrink-0" />
                              ) : item.severity === 'warning' ? (
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                              ) : (
                                <Info className="h-3 w-3 shrink-0" />
                              )}
                              <span>{ISSUE_LABELS[item.issueType] || item.issueType}</span>
                            </span>
                            <span className="block font-mono text-[11px] text-slate-600">
                              {item.statusCode
                                ? `HTTP ${item.statusCode === 0 ? 'Failed' : item.statusCode}`
                                : item.isInternal
                                ? 'Internal link'
                                : 'External link'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 truncate block">
                              {item.sourceTitle || 'Source Page'}
                            </span>
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-emerald-700 hover:underline flex items-center space-x-1"
                              title={item.sourceUrl}
                            >
                              <span className="truncate">{item.sourceUrl}</span>
                              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                            </a>
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <div className="space-y-1">
                            <span className="font-medium text-slate-900 block truncate" title={item.anchorText}>
                              "{item.anchorText}"
                            </span>
                            <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {item.anchorType.toUpperCase()}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-sm">
                          <div className="space-y-1">
                            <span
                              className="font-mono text-[11px] text-slate-800 block truncate"
                              title={item.targetUrl}
                            >
                              {item.targetUrl}
                            </span>
                            {item.finalDestinationUrl && item.finalDestinationUrl !== item.targetUrl && (
                              <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                                <CornerDownRight className="h-2.5 w-2.5 text-amber-600 shrink-0" />
                                <span className="truncate">Final: {item.finalDestinationUrl}</span>
                              </span>
                            )}
                            {item.details && (
                              <span className="text-[11px] text-slate-500 line-clamp-2 block">{item.details}</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <span className="text-xs text-slate-600 block line-clamp-2 leading-relaxed">
                            {item.recommendation}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => setInspectModalItem(item)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Inspect full link details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(item.targetUrl)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Copy target URL"
                            >
                              {copiedUrl === item.targetUrl ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-10 text-center">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                        <span className="text-slate-600 text-xs">
                          No findings match this filter. Link health looks clean.
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        !isBusy && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
            <div className="max-w-md mx-auto space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
                <Link2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">No link audit yet</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {activeMode === 'direct'
                    ? 'Paste one or more page URLs above and run the instant audit — every anchor is extracted and verified in seconds.'
                    : 'Run the full website link audit on your crawled session to map every source page to its destinations.'}
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {/* Inspect Item Modal */}
      {inspectModalItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-health-inspector-title"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Finding Details
                </span>
                <h3 id="link-health-inspector-title" className="text-base font-bold text-slate-900">
                  {ISSUE_LABELS[inspectModalItem.issueType] || inspectModalItem.issueType}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectModalItem(null)}
                aria-label="Close inspector"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-700 block mb-0.5">Source Page:</span>
                <span className="font-mono text-slate-800 bg-slate-50 p-2 rounded-lg block break-all">
                  {inspectModalItem.sourceUrl}
                </span>
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-0.5">Destination URL:</span>
                <span className="font-mono text-slate-800 bg-slate-50 p-2 rounded-lg block break-all">
                  {inspectModalItem.targetUrl}
                </span>
              </div>

              {inspectModalItem.domElementSnippet && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">DOM Element Snippet:</span>
                  <pre className="font-mono text-[11px] bg-slate-900 text-emerald-300 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {inspectModalItem.domElementSnippet}
                  </pre>
                </div>
              )}

              {inspectModalItem.redirectChain && inspectModalItem.redirectChain.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">
                    Redirect Hops ({inspectModalItem.redirectHops} hops):
                  </span>
                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg font-mono text-[11px]">
                    {inspectModalItem.redirectChain.map((hop, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px] shrink-0">
                          {hop.statusCode}
                        </span>
                        <span className="break-all">{hop.url}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="font-semibold text-slate-700 block mb-0.5">Remediation Recommendation:</span>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 leading-relaxed">
                  {inspectModalItem.recommendation}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectModalItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
