import React, { useState } from 'react';
import { VisualValidationItem } from '../../types';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  ExternalLink,
  Smartphone,
  Monitor,
  Tablet,
  Maximize2,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { copyTextToClipboard } from '../../utils/exportUtils';

interface VisualDetailModalProps {
  item: VisualValidationItem | null;
  onClose: () => void;
}

export const VisualDetailModal: React.FC<VisualDetailModalProps> = ({ item, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  return (
    <div
      id="visual-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
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
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {isPassed ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : isError ? (
                <XCircle className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Visual & Viewport Inspection</h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                    isPassed
                      ? 'bg-emerald-100 text-emerald-800'
                      : isError
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.statusLabel || item.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {item.viewport.name} ({item.viewport.width}x{item.viewport.height}px)
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
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Page URL */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Page Tested
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-800 break-all select-all">{item.pageUrl}</span>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => handleCopy(item.pageUrl, 'page')}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                  title="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <a
                  href={item.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-purple-600 rounded"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Screenshot (if available) */}
          {item.screenshotBase64 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Viewport Visual Snapshot
              </span>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[280px]">
                <img
                  src={item.screenshotBase64}
                  alt="Viewport Snapshot"
                  className="max-h-[280px] w-auto object-contain"
                />
              </div>
            </div>
          )}

          {/* Details & Reason */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Issue Diagnostics
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Issue Type:</span>
                <span className="font-bold text-slate-800">{item.issueType}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Element Selector:</span>
                <span className="font-mono text-slate-800">{item.elementSelector || 'N/A'}</span>
              </div>
              {item.elementTag && (
                <div>
                  <span className="text-slate-400 block">Element Tag:</span>
                  <span className="font-mono text-slate-800 uppercase">{item.elementTag}</span>
                </div>
              )}
              {item.textSample && (
                <div>
                  <span className="text-slate-400 block">Text Sample:</span>
                  <span className="italic text-slate-800">"{item.textSample}"</span>
                </div>
              )}
            </div>

            {item.boundingBox && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-400 text-xs block mb-1">Bounding Box Geometry:</span>
                <div className="grid grid-cols-4 gap-2 text-center font-mono text-[11px]">
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-400 text-[9px] block">LEFT</span>
                    {item.boundingBox.left}px
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-400 text-[9px] block">TOP</span>
                    {item.boundingBox.top}px
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-400 text-[9px] block">WIDTH</span>
                    {item.boundingBox.width}px
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-400 text-[9px] block">HEIGHT</span>
                    {item.boundingBox.height}px
                  </div>
                </div>
              </div>
            )}

            {item.cssReason && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-400 text-xs block mb-0.5">CSS / Layout Cause:</span>
                <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                  {item.cssReason}
                </p>
              </div>
            )}

            {item.details && (
              <div>
                <span className="text-slate-400 text-xs block mb-0.5">Recommendations:</span>
                <p className="text-xs text-slate-700">{item.details}</p>
              </div>
            )}
          </div>
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
