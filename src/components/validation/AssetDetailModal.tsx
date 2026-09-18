import React, { useState } from 'react';
import { AssetRecord } from '../../types';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  FileCode,
  Film,
  FileText,
  ArrowRight,
  Clock,
  ShieldAlert,
  Layers,
  ChevronDown,
  ChevronUp,
  Share2,
} from 'lucide-react';
import { copyTextToClipboard } from '../../utils/exportUtils';

interface AssetDetailModalProps {
  item: AssetRecord | null;
  onClose: () => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ item, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAllPages, setShowAllPages] = useState(false);

  if (!item) return null;

  const handleCopy = async (text: string, key: string) => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const isPassed = item.status === 'passed';
  const isError = item.status === 'error';
  const isWarning = item.status === 'warning';
  const isSkipped = item.status === 'skipped';

  const renderTypeIcon = () => {
    switch (item.assetType) {
      case 'IMAGE':
        return <ImageIcon className="h-5 w-5 text-blue-500" />;
      case 'VIDEO':
        return <Film className="h-5 w-5 text-purple-500" />;
      case 'PDF':
      case 'DOCUMENT':
        return <FileText className="h-5 w-5 text-rose-500" />;
      case 'INTERNAL_LINK':
      case 'EXTERNAL_LINK':
        return <ExternalLink className="h-5 w-5 text-emerald-500" />;
      default:
        return <FileCode className="h-5 w-5 text-slate-500" />;
    }
  };

  const assetUrl = item.url;
  const sourcePages = item.foundOnPages || item.sourcePages || (item.primarySourcePage ? [item.primarySourcePage] : []);
  const primaryPage = item.primarySourcePage || sourcePages[0] || '';
  const httpStatus = item.statusCode;
  const errorDetails = item.error;
  const loadTimeMs = item.responseTimeMs;

  return (
    <div
      id="asset-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-xl flex items-center justify-center ${
                isPassed
                  ? 'bg-emerald-100 text-emerald-700'
                  : isError
                  ? 'bg-rose-100 text-rose-700'
                  : isWarning
                  ? 'bg-amber-100 text-amber-700'
                  : isSkipped
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {isPassed ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : isError ? (
                <XCircle className="h-5 w-5" />
              ) : isWarning ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <Share2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Resource Inspection</h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                    isPassed
                      ? 'bg-emerald-100 text-emerald-800'
                      : isError
                      ? 'bg-rose-100 text-rose-800'
                      : isWarning
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {item.statusLabel || item.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 capitalize">
                {item.assetType.toLowerCase().replace('_', ' ')} Detail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Target Resource URL */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Resource URL
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-800 break-all select-all">{assetUrl}</span>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => handleCopy(assetUrl, 'asset')}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                  title="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </button>
                {assetUrl.startsWith('http') && (
                  <a
                    href={assetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Skipped Reason Banner */}
          {isSkipped && (
            <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 flex items-start space-x-2.5">
              <Share2 className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Validation Skipped</span>
                <p className="text-purple-700 mt-0.5">
                  {item.skipReason || item.error || 'Skipped per validation configuration'}
                </p>
              </div>
            </div>
          )}

          {/* Found On Pages (Source Page Relationships) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Layers className="h-4 w-4 text-slate-500" />
                <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                  Source Page Relationships ({sourcePages.length})
                </span>
              </div>
              {sourcePages.length > 1 && (
                <button
                  onClick={() => setShowAllPages(!showAllPages)}
                  className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center space-x-1"
                >
                  <span>{showAllPages ? 'Show Primary Only' : `Show All ${sourcePages.length} Pages`}</span>
                  {showAllPages ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>

            {sourcePages.length <= 1 || !showAllPages ? (
              <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="font-mono text-xs text-slate-800 break-all select-all">
                  {primaryPage || 'N/A'}
                </span>
                {primaryPage && (
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => handleCopy(primaryPage, 'page')}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                      title="Copy URL"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={primaryPage}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-blue-600 rounded"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {sourcePages.map((pg, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-slate-200 font-mono text-[11px]"
                  >
                    <span className="text-slate-800 truncate" title={pg}>
                      {idx + 1}. {pg}
                    </span>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => handleCopy(pg, `src-${idx}`)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                        title="Copy URL"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <a
                        href={pg}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-slate-400 hover:text-blue-600 rounded"
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">HTTP Status</span>
              <span
                className={`text-sm font-bold ${
                  isSkipped
                    ? 'text-purple-700'
                    : httpStatus && httpStatus < 400
                    ? 'text-emerald-700'
                    : 'text-rose-600'
                }`}
              >
                {isSkipped ? 'SKIPPED' : httpStatus !== undefined ? httpStatus : 'Failed / No response'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Resource Type</span>
              <div className="flex items-center space-x-1.5 text-slate-800 text-sm font-bold capitalize mt-0.5">
                {renderTypeIcon()}
                <span>{item.assetType.toLowerCase().replace('_', ' ')}</span>
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Response Latency</span>
              <div className="flex items-center space-x-1.5 text-slate-800 text-sm font-bold mt-0.5">
                <Clock className="h-4 w-4 text-slate-400" />
                <span>{loadTimeMs ? `${loadTimeMs} ms` : isSkipped ? 'Skipped' : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Alt Text Analysis (For Images) */}
          {item.assetType === 'IMAGE' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Image Accessibility & Alt Text
              </span>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-slate-500">Alt Attribute Content:</span>
                  <p className="text-xs font-medium text-slate-800 italic mt-0.5">
                    {item.alt ? `"${item.alt}"` : item.hasAlt ? '"" (Empty alt attribute)' : '<No alt attribute found>'}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    item.altStatus === 'ALT_PRESENT'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.altStatus === 'ALT_MISSING'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.altStatus || 'UNKNOWN'}
                </span>
              </div>
              {item.altReviewNote && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-center space-x-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.altReviewNote}</span>
                </div>
              )}
            </div>
          )}

          {/* Redirect Chain Details (For 3xx and Redirect Chains) */}
          {((item.redirectChain && item.redirectChain.length > 0) || item.finalUrl) && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                  <ArrowRight className="h-4 w-4" />
                  <span>Redirect Chain ({item.redirectChainLength || item.redirectChain?.length || 1} Hops)</span>
                </div>
                <span className="text-amber-800 font-semibold px-2 py-0.5 bg-white rounded border border-amber-200">
                  {item.redirectIssue || 'REDIRECT'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="bg-white p-2 rounded-lg border border-amber-200 font-mono text-[11px]">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Original URL</span>
                  <span className="text-slate-800 break-all">{item.url}</span>
                </div>

                {item.finalUrl && item.finalUrl !== item.url && (
                  <div className="bg-white p-2 rounded-lg border border-amber-200 font-mono text-[11px]">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Final Destination URL</span>
                    <span className="text-emerald-800 font-semibold break-all">{item.finalUrl}</span>
                  </div>
                )}
              </div>

              {item.redirectChain && item.redirectChain.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-[11px] font-semibold text-amber-800 block">Hop History:</span>
                  <ul className="text-xs font-mono space-y-1 text-slate-700">
                    {item.redirectChain.map((step, idx) => (
                      <li key={idx} className="bg-white/80 p-1.5 rounded border border-amber-100 flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px]">
                          {step.status}
                        </span>
                        <span className="truncate flex-1" title={step.url}>{step.url}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Error Details */}
          {errorDetails && !isSkipped && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
              <div className="flex items-center space-x-1.5 text-rose-800 font-semibold text-xs">
                <ShieldAlert className="h-4 w-4" />
                <span>Error Information</span>
              </div>
              <p className="text-xs text-rose-700 font-mono break-all">{errorDetails}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
