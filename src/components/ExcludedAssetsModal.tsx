import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  ExternalLink,
  Copy,
  Check,
  Download,
  Image as ImageIcon,
  FileCode,
  FileText,
  Film,
  Type,
  FolderArchive,
  Layers,
  ShieldCheck,
  Globe,
  Loader2,
  Server,
} from 'lucide-react';
import { ExcludedAssetItem, ExcludedAssetCategory } from '../types';
import { fetchJson } from '../utils/apiUtils';
import { copyTextToClipboard } from '../utils/exportUtils';

interface ExcludedAssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  crawlId: string | null;
  domain?: string;
  totalExcludedCount?: number;
  onAuditInTool6?: () => void;
}

export const ExcludedAssetsModal: React.FC<ExcludedAssetsModalProps> = ({
  isOpen,
  onClose,
  crawlId,
  domain = '',
  totalExcludedCount = 0,
  onAuditInTool6,
}) => {
  const [items, setItems] = useState<ExcludedAssetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [hostFilter, setHostFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  // Fetch excluded assets when modal opens
  useEffect(() => {
    if (!isOpen || !crawlId) return;

    setIsLoading(true);
    setError(null);

    fetchJson<{ items?: ExcludedAssetItem[]; total?: number }>(
      `/api/crawl/excluded-assets/${crawlId}`
    )
      .then((data) => {
        if (Array.isArray(data.items)) {
          setItems(data.items);
        } else {
          setItems([]);
        }
      })
      .catch((err: any) => {
        setError(err.message || 'Failed to load excluded assets');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, crawlId]);

  // Handle single URL copy
  const handleCopy = async (text: string, key: string) => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: items.length,
      IMAGE: 0,
      SCRIPT: 0,
      STYLESHEET: 0,
      DOCUMENT: 0,
      VIDEO: 0,
      FONT: 0,
      OTHER: 0,
    };
    for (const item of items) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [items]);

  // Host counts
  const hostCounts = useMemo(() => {
    let internal = 0;
    let external = 0;
    for (const item of items) {
      if (item.isExternal) external++;
      else internal++;
    }
    return { internal, external };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }
      // Host filter
      if (hostFilter === 'internal' && item.isExternal) return false;
      if (hostFilter === 'external' && !item.isExternal) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchUrl = item.url.toLowerCase().includes(query);
        const matchExt = item.extension.toLowerCase().includes(query);
        const matchSource = item.sourcePages.some((p) => p.toLowerCase().includes(query));
        if (!matchUrl && !matchExt && !matchSource) return false;
      }

      return true;
    });
  }, [items, categoryFilter, hostFilter, searchTerm]);

  // Copy all filtered URLs
  const handleCopyAllFiltered = async () => {
    const urls = filteredItems.map((i) => i.url).join('\n');
    const success = await copyTextToClipboard(urls);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (filteredItems.length === 0) return;
    const header = ['URL', 'Category', 'Extension', 'Is_External', 'Discovered_On_Pages'];
    const rows = filteredItems.map((i) => [
      `"${i.url.replace(/"/g, '""')}"`,
      i.category,
      i.extension,
      i.isExternal ? 'EXTERNAL_CDN' : 'INTERNAL_ORIGIN',
      `"${i.sourcePages.join(' | ').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `excluded-assets-${domain || 'site'}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const getCategoryIcon = (category: ExcludedAssetCategory) => {
    switch (category) {
      case 'IMAGE':
        return <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />;
      case 'SCRIPT':
        return <FileCode className="h-3.5 w-3.5 text-amber-600" />;
      case 'STYLESHEET':
        return <FileCode className="h-3.5 w-3.5 text-blue-600" />;
      case 'DOCUMENT':
        return <FileText className="h-3.5 w-3.5 text-rose-600" />;
      case 'VIDEO':
        return <Film className="h-3.5 w-3.5 text-purple-600" />;
      case 'FONT':
        return <Type className="h-3.5 w-3.5 text-indigo-600" />;
      default:
        return <FolderArchive className="h-3.5 w-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-800 border border-slate-300">
                Resource Separation Engine
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {items.length || totalExcludedCount} Assets Excluded from Page Crawl
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Discovered Website Assets & Dependencies</span>
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl">
              These static resources (images, scripts, styles, PDFs, and fonts) were referenced on crawled HTML pages. They are intentionally separated from the page crawl queue so they can be audited for HTTP 404s, CDN routing, and accessibility.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Top Metric Cards */}
        <div className="p-4 sm:p-6 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Assets</span>
            <span className="text-lg font-bold font-mono text-slate-900">{items.length || totalExcludedCount}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Images & Icons</span>
            <span className="text-lg font-bold font-mono text-emerald-700">{categoryCounts.IMAGE || 0}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200">
            <span className="text-[10px] uppercase font-bold text-blue-700 block">Styles & Scripts</span>
            <span className="text-lg font-bold font-mono text-blue-700">
              {(categoryCounts.SCRIPT || 0) + (categoryCounts.STYLESHEET || 0)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200">
            <span className="text-[10px] uppercase font-bold text-rose-700 block">PDFs & Docs</span>
            <span className="text-lg font-bold font-mono text-rose-700">{categoryCounts.DOCUMENT || 0}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200">
            <span className="text-[10px] uppercase font-bold text-indigo-700 block">Fonts & Media</span>
            <span className="text-lg font-bold font-mono text-indigo-700">
              {(categoryCounts.FONT || 0) + (categoryCounts.VIDEO || 0)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200">
            <span className="text-[10px] uppercase font-bold text-purple-700 block">External / CDN</span>
            <span className="text-lg font-bold font-mono text-purple-700">{hostCounts.external}</span>
          </div>
        </div>

        {/* Action Callout Bar */}
        <div className="px-4 sm:px-6 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Ready to test these assets?</strong> Check all {items.length || totalExcludedCount} resources for 404 broken links, CDN speed, and alt text.
            </span>
          </div>
          {onAuditInTool6 && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAuditInTool6();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Audit in Tool 6 (Links & Assets)</span>
            </button>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                categoryFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({categoryCounts.ALL})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('IMAGE')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                categoryFilter === 'IMAGE'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Images ({categoryCounts.IMAGE || 0})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('SCRIPT')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                categoryFilter === 'SCRIPT'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Scripts ({categoryCounts.SCRIPT || 0})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('STYLESHEET')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                categoryFilter === 'STYLESHEET'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CSS ({categoryCounts.STYLESHEET || 0})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('DOCUMENT')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                categoryFilter === 'DOCUMENT'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PDFs ({categoryCounts.DOCUMENT || 0})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('FONT')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                categoryFilter === 'FONT'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Fonts ({categoryCounts.FONT || 0})
            </button>
          </div>

          {/* Right actions: search, host filter, and exports */}
          <div className="flex items-center flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search asset URL or extension..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <select
              value={hostFilter}
              onChange={(e) => setHostFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none"
            >
              <option value="all">All Hosts</option>
              <option value="internal">Internal Only ({hostCounts.internal})</option>
              <option value="external">External / CDN ({hostCounts.external})</option>
            </select>

            <button
              type="button"
              onClick={handleCopyAllFiltered}
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
              title="Copy filtered URLs"
            >
              {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedAll ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
              <p className="text-xs">Loading discovered assets and dependency breakdown...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-rose-600 space-y-2">
              <p className="text-xs">{error}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <FolderArchive className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold">No assets found matching the selected filter</p>
              <p className="text-[11px] text-slate-400">Try changing the search query or category tabs above.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-4">Asset Resource URL</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Type / Host</th>
                  <th className="py-2.5 px-3">Ext</th>
                  <th className="py-2.5 px-3">Found On</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-800 max-w-md">
                      <div className="flex items-center space-x-2">
                        {getCategoryIcon(item.category)}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:text-emerald-700 hover:underline"
                          title={`Open in new tab: ${item.url}`}
                        >
                          {item.url}
                        </a>
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {item.category}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      {item.isExternal ? (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          <Globe className="h-3 w-3" />
                          <span>External CDN</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Server className="h-3 w-3" />
                          <span>Internal Origin</span>
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 uppercase">
                      {item.extension || '—'}
                    </td>

                    <td className="py-2.5 px-3 text-slate-600">
                      {item.sourcePages && item.sourcePages.length > 0 ? (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSourceId(expandedSourceId === item.id ? null : item.id)
                            }
                            className="text-[11px] text-blue-600 hover:text-blue-800 underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{item.sourcePages.length} {item.sourcePages.length === 1 ? 'page' : 'pages'}</span>
                          </button>

                          {expandedSourceId === item.id && (
                            <div className="absolute left-0 top-full mt-1 w-72 p-2 bg-white rounded-lg shadow-xl border border-slate-200 z-20 space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block pb-1 border-b border-slate-100">
                                Referenced On:
                              </span>
                              <div className="max-h-32 overflow-y-auto space-y-1">
                                {item.sourcePages.map((src, idx) => (
                                  <a
                                    key={idx}
                                    href={src}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block font-mono text-[10px] text-slate-700 truncate hover:text-blue-600 hover:underline"
                                  >
                                    {src}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Discovered in crawl</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.url, item.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                          title="Copy Asset URL"
                        >
                          {copiedKey === item.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 transition-colors"
                          title="Open Asset in New Tab"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Showing {filteredItems.length} of {items.length || totalExcludedCount} discovered assets
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors self-end sm:self-auto cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
