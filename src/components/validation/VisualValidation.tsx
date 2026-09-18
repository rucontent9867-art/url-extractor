import React, { useState, useMemo } from 'react';
import {
  VisualValidationResult,
  VisualValidationItem,
  ViewportConfig,
  VisualIssueType,
} from '../../types';
import {
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  FileSpreadsheet,
  Sliders,
  Smartphone,
  Monitor,
  Tablet,
  Maximize2,
  Camera,
  Layers,
} from 'lucide-react';
import {
  downloadVisualValidationCsv,
  copyStringListToClipboard,
  copyTextToClipboard,
} from '../../utils/exportUtils';
import { VisualDetailModal } from './VisualDetailModal';
import { ToolExclusionSettingsModal } from './ToolExclusionSettingsModal';

interface VisualValidationProps {
  result: VisualValidationResult | null;
  isLoading: boolean;
  domain?: string;
  onRunValidation: (options?: any) => void;
}

type FilterStatus = 'all' | 'passed' | 'warning' | 'error';
type FilterViewport = 'all' | 'mobile_small' | 'mobile' | 'tablet' | 'desktop' | 'large_desktop';

export const VisualValidation: React.FC<VisualValidationProps> = ({
  result,
  isLoading,
  domain = '',
  onRunValidation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [viewportFilter, setViewportFilter] = useState<FilterViewport>('all');
  const [copiedUrls, setCopiedUrls] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<VisualValidationItem | null>(null);

  const handleCopy = async (text: string, key: string) => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const handleCopyAllUrls = async () => {
    if (!result?.items) return;
    const urls = filteredItems.map(
      (i) => `${i.pageUrl} [${i.viewport.name}] -> ${i.issueType} [${i.statusLabel}]`
    );
    const success = await copyStringListToClipboard(urls);
    if (success) {
      setCopiedUrls(true);
      setTimeout(() => setCopiedUrls(false), 2000);
    }
  };

  const handleExportCsv = () => {
    if (!result?.items) return;
    downloadVisualValidationCsv(filteredItems);
  };

  const filteredItems = useMemo(() => {
    if (!result?.items) return [];

    return result.items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (viewportFilter !== 'all' && item.viewport.id !== viewportFilter) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchPage = item.pageUrl.toLowerCase().includes(term);
        const matchSelector = item.elementSelector?.toLowerCase().includes(term);
        const matchType = item.issueType.toLowerCase().includes(term);
        const matchDetails = item.details?.toLowerCase().includes(term);
        if (!matchPage && !matchSelector && !matchType && !matchDetails) return false;
      }

      return true;
    });
  }, [result, statusFilter, viewportFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Eye className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Visual & Viewport Validation</h2>
              <p className="text-xs text-slate-500">
                Playwright multi-viewport responsive testing, horizontal overflow detection, text/media cropping checks, and visual evidence capture.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center space-x-1.5"
            title="Tool Exclusions & Rules"
          >
            <Sliders className="h-4 w-4" />
            <span>Rules</span>
          </button>

          <button
            onClick={() => onRunValidation()}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Testing Viewports...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Run Viewport Audit</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metrics Summary */}
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Pages Checked
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {result.pagesChecked.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {result.viewportsTested.length} viewports / page
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
              Clean Layouts
            </span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block">
              {result.totalPassed.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">No layout breaks</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">
              Horizontal Scrolls
            </span>
            <span className="text-xl font-bold text-rose-600 mt-1 block">
              {result.horizontalScrollIssues.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Viewport overflow</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">
              Text Cropping
            </span>
            <span className="text-xl font-bold text-amber-600 mt-1 block">
              {result.textIssues.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Clipped typography</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider block">
              Media Cropping
            </span>
            <span className="text-xl font-bold text-purple-600 mt-1 block">
              {(result.videoIssues + result.pdfIssues + result.imageIssues).toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Video / Image / Embed</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Pages Ignored
            </span>
            <span className="text-xl font-bold text-slate-600 mt-1 block">
              {result.pagesIgnored || 0}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Exclusion rules</span>
          </div>
        </div>
      )}

      {/* Filter Toolbar & Data Table */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search pages, selectors, issues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-1 bg-white p-1 border border-slate-200 rounded-xl text-xs">
                {(['all', 'passed', 'warning', 'error'] as FilterStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-colors ${
                      statusFilter === status
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Viewport Filter */}
              <div className="flex items-center space-x-1 bg-white p-1 border border-slate-200 rounded-xl text-xs">
                {(['all', 'mobile_small', 'mobile', 'tablet', 'desktop'] as FilterViewport[]).map((vp) => (
                  <button
                    key={vp}
                    onClick={() => setViewportFilter(vp)}
                    className={`px-2 py-1 rounded-lg font-semibold capitalize transition-colors ${
                      viewportFilter === vp
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {vp.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
              <button
                onClick={handleCopyAllUrls}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center space-x-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copiedUrls ? 'Copied!' : 'Copy URLs'}</span>
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
                  <th className="py-3 px-4">Viewport</th>
                  <th className="py-3 px-4">Page URL</th>
                  <th className="py-3 px-4">Issue Type</th>
                  <th className="py-3 px-4">Target Element</th>
                  <th className="py-3 px-4">Details / Reason</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      No viewport issues found matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.status === 'passed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'error'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status === 'passed' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : item.status === 'error' ? (
                            <XCircle className="h-3.5 w-3.5 text-rose-600" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          )}
                          <span>{item.statusLabel || item.status.toUpperCase()}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 font-medium text-slate-800">
                          {item.viewport.isMobile ? (
                            <Smartphone className="h-3.5 w-3.5 text-purple-500" />
                          ) : (
                            <Monitor className="h-3.5 w-3.5 text-blue-500" />
                          )}
                          <span>{item.viewport.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs font-mono text-[11px] text-slate-800 truncate" title={item.pageUrl}>
                        {item.pageUrl}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{item.issueType}</span>
                      </td>

                      <td className="py-3 px-4 max-w-xs font-mono text-[11px] text-slate-600 truncate" title={item.elementSelector}>
                        {item.elementSelector || 'N/A'}
                      </td>

                      <td className="py-3 px-4 max-w-xs truncate text-slate-600 text-[11px]">
                        {item.cssReason || item.details}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => setSelectedDetailItem(item)}
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Inspect Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCopy(item.pageUrl, item.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Copy URL"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <VisualDetailModal
        item={selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
      />

      <ToolExclusionSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        toolId="visual"
        toolName="Visual & Viewport Validation"
        domain={domain}
      />
    </div>
  );
};
