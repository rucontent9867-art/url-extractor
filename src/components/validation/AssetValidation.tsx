import React, { useState, useMemo } from 'react';
import { AssetValidationResult, AssetRecord, AssetType } from '../../types';
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  FileSpreadsheet,
  Eye,
  Sliders,
  Image as ImageIcon,
  FileCode,
  Film,
  FileText,
  Clock,
  ArrowRight,
  ShieldAlert,
  Share2,
  Layers,
  Link,
  Ban,
  Check,
} from 'lucide-react';
import {
  downloadAssetValidationCsv,
  copyStringListToClipboard,
  copyTextToClipboard,
} from '../../utils/exportUtils';
import { AssetDetailModal } from './AssetDetailModal';
import { Tool6SettingsModal } from './Tool6SettingsModal';

interface AssetValidationProps {
  result: AssetValidationResult | null;
  isLoading: boolean;
  domain?: string;
  onRunValidation: (options?: any) => void;
}

type MainTab =
  | 'all'
  | 'broken'
  | 'redirects'
  | 'images'
  | 'media_docs'
  | 'external'
  | 'skipped';

export const AssetValidation: React.FC<AssetValidationProps> = ({
  result,
  isLoading,
  domain = '',
  onRunValidation,
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'warning' | 'error' | 'skipped'>('all');
  const [copiedUrls, setCopiedUrls] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<AssetRecord | null>(null);

  const handleCopy = async (text: string, key: string) => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const assetsList = useMemo(() => {
    return result?.assets || result?.items || [];
  }, [result]);

  // Tab Filtering logic
  const tabFilteredItems = useMemo(() => {
    if (assetsList.length === 0) return [];

    return assetsList.filter((item) => {
      // Tab filters
      if (activeTab === 'broken') {
        const isBroken =
          item.status === 'error' ||
          (item.statusCode !== undefined && item.statusCode >= 400) ||
          item.statusCode === 0 ||
          item.redirectIssue === 'REDIRECT_LOOP' ||
          item.redirectIssue === 'REDIRECT_TO_404';
        if (!isBroken) return false;
      } else if (activeTab === 'redirects') {
        const isRedirect =
          (item.redirectChain && item.redirectChain.length > 0) ||
          (item.statusCode !== undefined && item.statusCode >= 300 && item.statusCode < 400) ||
          (item.redirectIssue && item.redirectIssue !== 'NONE');
        if (!isRedirect) return false;
      } else if (activeTab === 'images') {
        if (item.assetType !== 'IMAGE') return false;
      } else if (activeTab === 'media_docs') {
        if (item.assetType !== 'VIDEO' && item.assetType !== 'PDF' && item.assetType !== 'DOCUMENT') {
          return false;
        }
      } else if (activeTab === 'external') {
        if (item.assetType !== 'EXTERNAL_LINK') return false;
      } else if (activeTab === 'skipped') {
        if (item.status !== 'skipped') return false;
      }

      // Secondary Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchAsset = item.url.toLowerCase().includes(term);
        const matchPage = item.primarySourcePage?.toLowerCase().includes(term);
        const matchFoundOn = item.foundOnPages?.some((p) => p.toLowerCase().includes(term));
        const matchAlt = item.alt?.toLowerCase().includes(term);
        const matchErr = item.error?.toLowerCase().includes(term);
        const matchSkip = item.skipReason?.toLowerCase().includes(term);
        if (!matchAsset && !matchPage && !matchFoundOn && !matchAlt && !matchErr && !matchSkip) {
          return false;
        }
      }

      return true;
    });
  }, [assetsList, activeTab, statusFilter, searchTerm]);

  const handleCopyAllUrls = async () => {
    if (tabFilteredItems.length === 0) return;
    const urls = tabFilteredItems.map(
      (i) => `${i.url} [${i.statusLabel || i.status}] (HTTP ${i.statusCode !== undefined ? i.statusCode : 'N/A'})`
    );
    const success = await copyStringListToClipboard(urls);
    if (success) {
      setCopiedUrls(true);
      setTimeout(() => setCopiedUrls(false), 2000);
    }
  };

  const handleExportCsv = () => {
    if (tabFilteredItems.length === 0) return;
    downloadAssetValidationCsv(tabFilteredItems);
  };

  const renderTypeIcon = (type: AssetType) => {
    switch (type) {
      case 'IMAGE':
        return <ImageIcon className="h-3.5 w-3.5 text-blue-500" />;
      case 'VIDEO':
        return <Film className="h-3.5 w-3.5 text-purple-500" />;
      case 'PDF':
      case 'DOCUMENT':
        return <FileText className="h-3.5 w-3.5 text-rose-500" />;
      case 'INTERNAL_LINK':
        return <Link className="h-3.5 w-3.5 text-emerald-500" />;
      case 'EXTERNAL_LINK':
        return <ExternalLink className="h-3.5 w-3.5 text-indigo-500" />;
      default:
        return <FileCode className="h-3.5 w-3.5 text-slate-500" />;
    }
  };

  // Calculations for tab badge counts
  const brokenCount = useMemo(() => {
    return assetsList.filter(
      (i) =>
        i.status === 'error' ||
        (i.statusCode !== undefined && i.statusCode >= 400) ||
        i.statusCode === 0
    ).length;
  }, [assetsList]);

  const redirectsCount = useMemo(() => {
    return assetsList.filter(
      (i) =>
        (i.redirectChain && i.redirectChain.length > 0) ||
        (i.statusCode !== undefined && i.statusCode >= 300 && i.statusCode < 400) ||
        (i.redirectIssue && i.redirectIssue !== 'NONE')
    ).length;
  }, [assetsList]);

  const imagesCount = useMemo(() => {
    return assetsList.filter((i) => i.assetType === 'IMAGE').length;
  }, [assetsList]);

  const mediaDocsCount = useMemo(() => {
    return assetsList.filter(
      (i) => i.assetType === 'VIDEO' || i.assetType === 'PDF' || i.assetType === 'DOCUMENT'
    ).length;
  }, [assetsList]);

  const externalCount = useMemo(() => {
    return assetsList.filter((i) => i.assetType === 'EXTERNAL_LINK').length;
  }, [assetsList]);

  const skippedCount = useMemo(() => {
    return assetsList.filter((i) => i.status === 'skipped').length;
  }, [assetsList]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900">Links, Assets & HTTP Health</h2>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-extrabold uppercase tracking-wider">
                  Tool 6
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Fast HTTP health checks, redirect chain verification, social URL exclusions, and asset accessibility auditing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center space-x-1.5"
            title="Tool 6 Domain Settings"
          >
            <Sliders className="h-4 w-4" />
            <span>Settings</span>
          </button>

          <button
            onClick={() => onRunValidation()}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Checking Health...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Run Validation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 13 Summary Metric Cards */}
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Card 1: Total Resources */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Resources
            </span>
            <span className="text-lg font-bold text-slate-900 mt-0.5 block">
              {(result.totalResources || result.totalAssets || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{result.pagesChecked} pages</span>
          </div>

          {/* Card 2: Internal Links */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block">
              Internal Links
            </span>
            <span className="text-lg font-bold text-emerald-700 mt-0.5 block">
              {(result.totalInternalLinks || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">On domain</span>
          </div>

          {/* Card 3: External Links */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider block">
              External Links
            </span>
            <span className="text-lg font-bold text-indigo-700 mt-0.5 block">
              {(result.totalExternalLinks || externalCount).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Discovered</span>
          </div>

          {/* Card 4: Images */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider block">
              Images
            </span>
            <span className="text-lg font-bold text-blue-700 mt-0.5 block">
              {(result.totalImages || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">src & srcset</span>
          </div>

          {/* Card 5: Videos */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider block">
              Videos
            </span>
            <span className="text-lg font-bold text-purple-700 mt-0.5 block">
              {(result.totalVideos || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Tags & iframes</span>
          </div>

          {/* Card 6: PDFs / Docs */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider block">
              PDFs / Docs
            </span>
            <span className="text-lg font-bold text-rose-700 mt-0.5 block">
              {((result.totalPdfs || 0) + (result.totalDocuments || 0)).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Files & downloads</span>
          </div>

          {/* Card 7: Redirects */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider block">
              Redirects (3xx)
            </span>
            <span className="text-lg font-bold text-amber-700 mt-0.5 block">
              {(result.totalRedirects || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Hop count</span>
          </div>

          {/* Card 8: Redirect Chains */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider block">
              Redirect Chains
            </span>
            <span className="text-lg font-bold text-amber-800 mt-0.5 block">
              {(result.redirectChains || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Multi-hop hops</span>
          </div>

          {/* Card 9: 404 Not Found */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider block">
              404 Not Found
            </span>
            <span className="text-lg font-bold text-rose-600 mt-0.5 block">
              {(result.errors404 || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Missing URLs</span>
          </div>

          {/* Card 10: Other 4xx Errors */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider block">
              Other 4xx Errors
            </span>
            <span className="text-lg font-bold text-rose-700 mt-0.5 block">
              {Math.max(0, (result.errors4xx || 0) - (result.errors404 || 0)).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">401/403/etc</span>
          </div>

          {/* Card 11: 5xx Server Errors */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider block">
              5xx Server Errors
            </span>
            <span className="text-lg font-bold text-red-700 mt-0.5 block">
              {(result.errors5xx || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Server faults</span>
          </div>

          {/* Card 12: Missing Alt Text */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider block">
              Missing Alt Text
            </span>
            <span className="text-lg font-bold text-amber-600 mt-0.5 block">
              {(result.missingAltCount || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">A11y image gaps</span>
          </div>

          {/* Card 13: Skipped (Social / Disabled) */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider block">
              Skipped / Excluded
            </span>
            <span className="text-lg font-bold text-purple-700 mt-0.5 block">
              {(result.skippedCount || skippedCount).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Social & disabled</span>
          </div>
        </div>
      )}

      {/* Tabs and Data Table */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Main Navigation Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-4 pt-2 gap-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-2 border-b-2 rounded-t-lg transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === 'all'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>All Resources</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                {assetsList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('broken')}
              className={`px-3 py-2 border-b-2 rounded-t-lg transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === 'broken'
                  ? 'border-rose-600 text-rose-600 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Broken Links / Errors</span>
              {brokenCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px]">
                  {brokenCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('redirects')}
              className={`px-3 py-2 border-b-2 rounded-t-lg transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === 'redirects'
                  ? 'border-amber-600 text-amber-600 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Redirects (3xx)</span>
              {redirectsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-700 text-[10px]">
                  {redirectsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('images')}
              className={`px-3 py-2 border-b-2 rounded-t-lg transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === 'images'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Images & Alt Text</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                {imagesCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('media_docs')}
              className={`px-3 py-2 border-b-2 rounded-t-lg transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === 'media_docs'
                  ? 'border-purple-600 text-purple-600 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Videos & Documents</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                {mediaDocsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('external')}
              className={`px-3 py-2 border-b-2 rounded-t-lg transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === 'external'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>External URLs</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                {externalCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('skipped')}
              className={`px-3 py-2 border-b-2 rounded-t-lg transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                activeTab === 'skipped'
                  ? 'border-purple-600 text-purple-600 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Skipped / Excluded</span>
              {skippedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 text-[10px]">
                  {skippedCount}
                </span>
              )}
            </button>
          </div>

          {/* Search & Actions Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 bg-white">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search URLs, pages, alt text, errors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-1 bg-slate-50 p-1 border border-slate-200 rounded-xl text-xs">
                {(['all', 'passed', 'warning', 'error', 'skipped'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-colors ${
                      statusFilter === status
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
              <button
                onClick={handleCopyAllUrls}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center space-x-1.5"
              >
                {copiedUrls ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedUrls ? 'Copied List!' : 'Copy URLs'}</span>
              </button>
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center space-x-1.5"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Resource URL</th>
                  <th className="py-3 px-4">Found On Page</th>
                  <th className="py-3 px-4">HTTP Status</th>
                  <th className="py-3 px-4">Details / Alt / Chain</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tabFilteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      No resources found matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  tabFilteredItems.map((item) => {
                    const pagesCount = (item.foundOnPages || item.sourcePages || []).length;
                    const primaryPage = item.primarySourcePage || (item.foundOnPages || item.sourcePages || [])[0] || '';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              item.status === 'passed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'error'
                                ? 'bg-rose-100 text-rose-800'
                                : item.status === 'warning'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {item.status === 'passed' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : item.status === 'error' ? (
                              <XCircle className="h-3.5 w-3.5 text-rose-600" />
                            ) : item.status === 'warning' ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <Share2 className="h-3.5 w-3.5 text-purple-600" />
                            )}
                            <span>{item.statusLabel || item.status.toUpperCase()}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1.5 font-medium text-slate-700 capitalize">
                            {renderTypeIcon(item.assetType)}
                            <span>{item.assetType.toLowerCase().replace('_', ' ')}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-xs font-mono text-[11px] text-slate-800 truncate" title={item.url}>
                          {item.url}
                        </td>

                        <td className="py-3 px-4 max-w-xs font-mono text-[11px] text-slate-600">
                          <div className="flex items-center space-x-1">
                            <span className="truncate" title={primaryPage}>
                              {primaryPage || 'N/A'}
                            </span>
                            {pagesCount > 1 && (
                              <span
                                className="shrink-0 px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold cursor-pointer"
                                onClick={() => setSelectedDetailItem(item)}
                                title={`Found on ${pagesCount} pages`}
                              >
                                +{pagesCount - 1} more
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`font-mono text-xs font-bold ${
                              item.status === 'skipped'
                                ? 'text-purple-700'
                                : item.statusCode && item.statusCode < 400
                                ? 'text-emerald-700'
                                : 'text-rose-600'
                            }`}
                          >
                            {item.status === 'skipped'
                              ? 'SKIPPED'
                              : item.statusCode !== undefined
                              ? item.statusCode
                              : 'Failed'}
                          </span>
                        </td>

                        <td className="py-3 px-4 max-w-xs truncate text-slate-600 text-[11px]">
                          {item.skipReason ? (
                            <span className="text-purple-700 font-medium">{item.skipReason}</span>
                          ) : item.redirectChain && item.redirectChain.length > 0 ? (
                            <span className="text-amber-700 font-mono font-medium">
                              Redirect ({item.redirectChainLength || item.redirectChain.length} hops) &rarr; {item.finalUrl || ''}
                            </span>
                          ) : item.error ? (
                            <span className="text-rose-700 font-medium">{item.error}</span>
                          ) : item.alt !== undefined ? (
                            <span className="italic">
                              {item.alt ? `alt: "${item.alt}"` : 'alt: "" (empty)'}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => setSelectedDetailItem(item)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Inspect Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleCopy(item.url, item.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Copy URL"
                            >
                              {copiedKey === item.id ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
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
      )}

      {/* Modals */}
      <AssetDetailModal
        item={selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
      />

      <Tool6SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        domain={domain}
        onSettingsSaved={() => {
          // Can re-run validation if user desires
        }}
      />
    </div>
  );
};
