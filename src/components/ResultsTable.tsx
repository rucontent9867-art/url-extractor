import React, { useState, useMemo } from 'react';
import { CrawlUrlItem } from '../types';
import {
  Search,
  Copy,
  Check,
  ExternalLink,
  ArrowUpDown,
  Download,
  Filter,
  FileText,
  FileSpreadsheet,
  FileCode,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  Link2,
  X,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  copyUrlsToClipboard,
  downloadUrlsAsCsv,
  downloadUrlsAsJson,
  downloadUrlsAsTxt,
  copyStringListToClipboard,
} from '../utils/exportUtils';

interface ResultsTableProps {
  items: CrawlUrlItem[];
  selectedLanguageName: string;
  onClearResults?: () => void;
}

type SortField = 'index' | 'url' | 'language' | 'source' | 'status' | 'foundOn';
type SortOrder = 'asc' | 'desc';

type FilterType =
  | 'all'
  | '200'
  | '3xx'
  | '404'
  | '4xx'
  | '5xx'
  | 'failed'
  | 'sitemap_missing'
  | 'lang_mismatch'
  | 'lang_warning'
  | 'val_ignored'
  | 'has_error';

type SourceFilter = 'all' | 'Sitemap' | 'Page Crawl' | 'Sitemap + Crawl';

export const ResultsTable: React.FC<ResultsTableProps> = ({ items, selectedLanguageName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('index');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Copy feedbacks
  const [copyAllFeedback, setCopyAllFeedback] = useState(false);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [copiedModalSourceUrl, setCopiedModalSourceUrl] = useState<string | null>(null);
  const [copiedModalAllFeedback, setCopiedModalAllFeedback] = useState(false);

  // Download menu toggle
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // "Found on page" modal state
  const [inspectItem, setInspectItem] = useState<CrawlUrlItem | null>(null);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    let result = items;

    // Search filter
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.url.toLowerCase().includes(lower) ||
          (item.title && item.title.toLowerCase().includes(lower)) ||
          (item.canonicalPath && item.canonicalPath.toLowerCase().includes(lower))
      );
    }

    // Granular Status & Validation Filter
    if (filterType === '200') {
      result = result.filter((item) => item.status >= 200 && item.status < 300);
    } else if (filterType === '3xx') {
      result = result.filter((item) => item.status >= 300 && item.status < 400);
    } else if (filterType === '404') {
      result = result.filter((item) => item.status === 404);
    } else if (filterType === '4xx') {
      result = result.filter((item) => item.status >= 400 && item.status < 500);
    } else if (filterType === '5xx') {
      result = result.filter((item) => item.status >= 500);
    } else if (filterType === 'failed') {
      result = result.filter(
        (item) =>
          item.status >= 400 ||
          item.status === 0 ||
          (item.crawlStatus && item.crawlStatus !== 'success')
      );
    } else if (filterType === 'sitemap_missing') {
      result = result.filter(
        (item) =>
          !item.ignoredForValidation &&
          !item.isIgnoredSlug &&
          (item.validationErrors?.some((e) => e.toLowerCase().includes('sitemap')) ||
            (!item.inSitemap && item.isEnglish))
      );
    } else if (filterType === 'lang_mismatch') {
      result = result.filter(
        (item) =>
          !item.ignoredForValidation &&
          !item.isIgnoredSlug &&
          item.validationErrors?.some((e) => e.toLowerCase().includes('mismatch'))
      );
    } else if (filterType === 'lang_warning') {
      result = result.filter(
        (item) =>
          !item.ignoredForValidation &&
          !item.isIgnoredSlug &&
          item.validationErrors?.some(
            (e) => e.toLowerCase().includes('warning') || e.toLowerCase().includes('mixed')
          )
      );
    } else if (filterType === 'val_ignored') {
      result = result.filter((item) => item.ignoredForValidation || item.isIgnoredSlug);
    } else if (filterType === 'has_error') {
      result = result.filter(
        (item) =>
          item.status >= 400 ||
          item.status === 0 ||
          (!item.ignoredForValidation &&
            !item.isIgnoredSlug &&
            item.validationErrors &&
            item.validationErrors.length > 0)
      );
    }

    // Source filter
    if (sourceFilter !== 'all') {
      result = result.filter((item) => item.source === sourceFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comp = 0;
      if (sortField === 'url') {
        comp = a.url.localeCompare(b.url);
      } else if (sortField === 'language') {
        comp = a.language.localeCompare(b.language);
      } else if (sortField === 'source') {
        comp = a.source.localeCompare(b.source);
      } else if (sortField === 'status') {
        comp = a.status - b.status;
      } else if (sortField === 'foundOn') {
        comp = (a.discoveredFrom?.length || 0) - (b.discoveredFrom?.length || 0);
      }
      return sortOrder === 'asc' ? comp : -comp;
    });

    return result;
  }, [items, searchTerm, filterType, sourceFilter, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentSafePage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (currentSafePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentSafePage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleCopyAll = async () => {
    const success = await copyUrlsToClipboard(filteredItems);
    if (success) {
      setCopyAllFeedback(true);
      setTimeout(() => setCopyAllFeedback(false), 2500);
    }
  };

  const handleCopySingle = async (item: CrawlUrlItem) => {
    const success = await copyUrlsToClipboard([item]);
    if (success) {
      setCopiedUrlId(item.id);
      setTimeout(() => setCopiedUrlId(null), 2000);
    }
  };

  const handleCopyModalSource = async (url: string) => {
    const ok = await copyStringListToClipboard([url]);
    if (ok) {
      setCopiedModalSourceUrl(url);
      setTimeout(() => setCopiedModalSourceUrl(null), 1800);
    }
  };

  const handleCopyModalAllSources = async () => {
    if (!inspectItem?.discoveredFrom || inspectItem.discoveredFrom.length === 0) return;
    const ok = await copyStringListToClipboard(inspectItem.discoveredFrom);
    if (ok) {
      setCopiedModalAllFeedback(true);
      setTimeout(() => setCopiedModalAllFeedback(false), 2000);
    }
  };

  const getStatusBadge = (item: CrawlUrlItem) => {
    const status = item.status;
    const error = item.error;

    if (status >= 200 && status < 300) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          {status} OK
        </span>
      );
    }
    if (status >= 300 && status < 400) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">
          {status} Redirect
        </span>
      );
    }
    if (status === 404) {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300"
          title="HTTP 404 Not Found - Click 'Found On Page' to see which pages link to this broken URL"
        >
          404 Not Found
        </span>
      );
    }
    if (status >= 400 && status < 500) {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-amber-50 text-amber-800 border border-amber-300"
          title={error || 'Client error'}
        >
          {status} Client Error
        </span>
      );
    }
    if (status >= 500) {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200"
          title={error || 'Server error'}
        >
          {status} Server Error
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200"
        title={error || 'Failed request'}
      >
        Failed
      </span>
    );
  };

  const getSourceBadge = (source: CrawlUrlItem['source']) => {
    switch (source) {
      case 'Sitemap':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
            Sitemap
          </span>
        );
      case 'Page Crawl':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
            Page Crawl
          </span>
        );
      case 'Sitemap + Crawl':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            Sitemap + Crawl
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
      {/* Control Bar: Search & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search URLs, path, title..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status & Validation Filter Dropdown */}
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value as FilterType);
              setCurrentPage(1);
            }}
            className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">Filter: All URLs</option>
            <option value="200">Status: 200 OK</option>
            <option value="3xx">Status: 3xx Redirects</option>
            <option value="404">Status: 404 Not Found</option>
            <option value="4xx">Status: 4xx Client Errors</option>
            <option value="5xx">Status: 5xx Server Errors</option>
            <option value="failed">Status: Failed Requests</option>
            <option value="sitemap_missing">Errors: Missing from Sitemap</option>
            <option value="lang_mismatch">Errors: Language Mismatch</option>
            <option value="lang_warning">Warnings: Language Warning / Mixed</option>
            <option value="val_ignored">Excluded: Validation Ignored Slugs</option>
            <option value="has_error">All With Any Error / Warning</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as SourceFilter);
              setCurrentPage(1);
            }}
            className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">Source: All</option>
            <option value="Sitemap">Source: Sitemap only</option>
            <option value="Page Crawl">Source: Page Crawl only</option>
            <option value="Sitemap + Crawl">Source: Both</option>
          </select>

          {/* Copy Filtered Button */}
          <button
            type="button"
            onClick={handleCopyAll}
            disabled={filteredItems.length === 0}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-2xs ${
              copyAllFeedback
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40'
            }`}
          >
            {copyAllFeedback ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copyAllFeedback ? 'Copied Filtered URLs!' : `Copy Filtered (${filteredItems.length})`}</span>
          </button>

          {/* Download Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={filteredItems.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center space-x-1.5 transition-colors shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download URLs</span>
            </button>

            {showDownloadMenu && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-20">
                <button
                  onClick={() => {
                    downloadUrlsAsTxt(filteredItems);
                    setShowDownloadMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                >
                  <FileText className="h-4 w-4 text-slate-500" />
                  <div>
                    <span className="font-medium block">Download as TXT</span>
                    <span className="text-[10px] text-slate-400">One URL per line</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    downloadUrlsAsCsv(filteredItems);
                    setShowDownloadMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <div>
                    <span className="font-medium block">Download as CSV</span>
                    <span className="text-[10px] text-slate-400">Includes discoveredFrom</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    downloadUrlsAsJson(filteredItems);
                    setShowDownloadMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                >
                  <FileCode className="h-4 w-4 text-blue-600" />
                  <div>
                    <span className="font-medium block">Download as JSON</span>
                    <span className="text-[10px] text-slate-400">Structured data array</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter status description bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          Showing <span className="font-semibold text-slate-800">{filteredItems.length.toLocaleString()}</span> of{' '}
          <span className="font-semibold text-slate-800">{items.length.toLocaleString()}</span> URLs
          {selectedLanguageName !== 'All' && (
            <span>
              {' '}
              in <span className="font-semibold text-emerald-700">{selectedLanguageName}</span>
            </span>
          )}
          {searchTerm && (
            <span>
              {' '}
              matching &ldquo;<span className="font-medium text-slate-800">{searchTerm}</span>&rdquo;
            </span>
          )}
          {filterType !== 'all' && (
            <span className="ml-1 text-slate-600">
              (Filter: <span className="font-semibold text-slate-800">{filterType}</span>)
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="py-3 px-3 w-12 text-center">
                #
              </th>
              <th
                scope="col"
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('url')}
              >
                <div className="flex items-center space-x-1">
                  <span>URL</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th scope="col" className="py-3 px-3 w-32">
                Canonical Path
              </th>
              <th
                scope="col"
                className="py-3 px-3 w-28 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('language')}
              >
                <div className="flex items-center space-x-1">
                  <span>Language</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                scope="col"
                className="py-3 px-3 w-28 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              {/* FOUND ON PAGE COLUMN */}
              <th
                scope="col"
                className="py-3 px-3 w-36 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('foundOn')}
              >
                <div className="flex items-center space-x-1">
                  <span>Found On Page</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                scope="col"
                className="py-3 px-3 w-24 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('source')}
              >
                <div className="flex items-center space-x-1">
                  <span>Source</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th scope="col" className="py-3 px-3 w-20 text-center">
                In Sitemap
              </th>
              <th scope="col" className="py-3 px-3 w-16 text-center">
                Copy
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Search className="h-8 w-8 text-slate-300 stroke-1" />
                    <p className="text-sm font-medium text-slate-500">No matching URLs found</p>
                    <p className="text-xs text-slate-400">
                      Try altering your search keywords or switching status and validation filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedItems.map((item, idx) => {
                const globalIndex = (currentSafePage - 1) * pageSize + idx + 1;
                const isCopied = copiedUrlId === item.id;
                const sourceCount = item.discoveredFrom?.length || 0;
                const is404 = item.status === 404;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors group ${
                      is404 ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {globalIndex}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs max-w-sm truncate">
                      <div className="flex flex-col">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-800 hover:text-emerald-600 hover:underline inline-flex items-center gap-1.5 transition-colors"
                          title={item.url}
                        >
                          <span className="truncate">{item.url}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-slate-400 shrink-0 transition-opacity" />
                        </a>
                        {item.title && (
                          <span className="text-[11px] font-sans text-slate-400 truncate max-w-xs mt-0.5">
                            {item.title}
                          </span>
                        )}
                        {(item.ignoredForValidation || item.isIgnoredSlug) && (
                          <div className="flex items-center gap-1 mt-1 font-sans">
                            <span
                              className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200"
                              title="Crawled normally, but strictly excluded and ignored from all validation checks"
                            >
                              Validation Ignored
                            </span>
                          </div>
                        )}
                        {item.validationErrors && item.validationErrors.length > 0 && !(item.ignoredForValidation || item.isIgnoredSlug) && (
                          <div className="flex flex-wrap gap-1 mt-1 font-sans">
                            {item.validationErrors.map((err, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-rose-100 text-rose-800"
                              >
                                {err}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-xs text-slate-600">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                        {item.canonicalPath || '/'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {item.language}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getStatusBadge(item)}
                    </td>

                    {/* FOUND ON PAGE CELL */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {sourceCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setInspectItem(item)}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                            is404
                              ? 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300 font-semibold'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                          }`}
                          title="Click to view all pages that linked to this URL"
                        >
                          <Link2 className="h-3 w-3 shrink-0" />
                          <span>
                            {sourceCount} {sourceCount === 1 ? 'page' : 'pages'}
                          </span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          {item.source === 'Sitemap' ? 'Sitemap seed' : 'Seed URL'}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">{getSourceBadge(item.source)}</td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {item.inSitemap ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                          No
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleCopySingle(item)}
                        className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all ${
                          isCopied
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                        title={isCopied ? 'Copied!' : 'Copy URL'}
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
          <div>
            Page <span className="font-semibold text-slate-800">{currentSafePage}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalPages}</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentSafePage - 1))}
              disabled={currentSafePage <= 1}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            {/* Quick page buttons */}
            <div className="hidden sm:flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && currentSafePage > 3) {
                  p = currentSafePage - 2 + i;
                  if (p > totalPages) p = totalPages - (4 - i);
                }
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-mono font-medium cursor-pointer ${
                      currentSafePage === p
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, currentSafePage + 1))}
              disabled={currentSafePage >= totalPages}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* FOUND ON PAGE MODAL */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Discovered From Sources
                  </span>
                  {inspectItem.status === 404 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      Broken 404 Link
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs text-slate-900 break-all font-semibold select-all">
                  {inspectItem.url}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {inspectItem.status === 404 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2.5">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">404 Broken Link Alert:</span>
                    This target URL returned HTTP 404 Not Found. To fix this broken link, inspect and
                    update the referring source pages listed below.
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  Found on <strong className="text-slate-900">{inspectItem.discoveredFrom?.length || 0}</strong>{' '}
                  referring page{(inspectItem.discoveredFrom?.length || 0) === 1 ? '' : 's'}:
                </span>
                {(inspectItem.discoveredFrom?.length || 0) > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyModalAllSources}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedModalAllFeedback ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedModalAllFeedback ? 'Copied All Sources!' : 'Copy All Sources'}</span>
                  </button>
                )}
              </div>

              {!inspectItem.discoveredFrom || inspectItem.discoveredFrom.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  Discovered directly from root seed or XML Sitemap without an HTML referring page.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {inspectItem.discoveredFrom.map((srcUrl, i) => {
                    const isSrcCopied = copiedModalSourceUrl === srcUrl;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 transition-colors font-mono text-xs"
                      >
                        <a
                          href={srcUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate mr-3 text-slate-800 hover:text-indigo-600 hover:underline inline-flex items-center space-x-1.5"
                          title={srcUrl}
                        >
                          <span className="truncate">{srcUrl}</span>
                          <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyModalSource(srcUrl)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer shrink-0 transition-colors"
                          title="Copy source URL"
                        >
                          {isSrcCopied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer transition-colors"
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
