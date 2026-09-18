import React, { useState } from 'react';
import { InteractionValidationItem } from '../../types';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  ExternalLink,
  MousePointerClick,
  Terminal,
  WifiOff,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { copyTextToClipboard } from '../../utils/exportUtils';

interface InteractionDetailModalProps {
  item: InteractionValidationItem | null;
  onClose: () => void;
}

export const InteractionDetailModal: React.FC<InteractionDetailModalProps> = ({ item, onClose }) => {
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
  const isSkipped = item.status === 'skipped';

  return (
    <div
      id="interaction-detail-modal"
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
              ) : isWarning ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Interaction & Event Inspection</h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                    isPassed
                      ? 'bg-emerald-100 text-emerald-800'
                      : isError
                      ? 'bg-rose-100 text-rose-800'
                      : isWarning
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.statusLabel || item.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 capitalize">{item.elementType} Event Diagnostics</p>
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
          {/* Target Element & Page */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Element Selector
              </span>
              <span className="font-mono text-xs text-slate-800 break-all select-all block">
                {item.elementSelector}
              </span>
              {item.elementText && (
                <span className="text-xs text-slate-500 italic mt-1 block">
                  Label: "{item.elementText}"
                </span>
              )}
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Page URL
              </span>
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-xs text-slate-800 break-all select-all">{item.pageUrl}</span>
                <a
                  href={item.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-slate-400 hover:text-emerald-600 rounded"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Action Results */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Behavioral Observation
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[10px] block">ACTION</span>
                <span className="font-semibold text-slate-800">{item.action}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[10px] block">DOM UPDATED</span>
                <span className={`font-bold ${item.domChanged ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {item.domChanged ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[10px] block">VISIBILITY</span>
                <span className={`font-bold ${item.visibilityChanged ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {item.visibilityChanged ? 'CHANGED' : 'SAME'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[10px] block">CONSOLE ERRORS</span>
                <span
                  className={`font-bold ${
                    item.consoleErrors && item.consoleErrors.length > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {item.consoleErrors?.length || 0}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-xs block mb-0.5">Result Summary:</span>
              <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                {item.resultSummary}
              </p>
            </div>
          </div>

          {/* Console Errors */}
          {item.consoleErrors && item.consoleErrors.length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center space-x-1.5 text-rose-800 font-semibold text-xs">
                <Terminal className="h-4 w-4" />
                <span>Captured Console Errors ({item.consoleErrors.length})</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {item.consoleErrors.map((err, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-lg border border-rose-200 font-mono text-[11px] text-rose-900">
                    <div className="flex items-center justify-between text-[10px] text-rose-500 font-bold mb-1">
                      <span>[{err.phase}] {err.type.toUpperCase()}</span>
                      <span>{new Date(err.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="break-all">{err.message}</p>
                    {err.stack && (
                      <pre className="mt-1 text-[10px] text-slate-500 overflow-x-auto max-h-24">{err.stack}</pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Network Errors */}
          {item.networkErrors && item.networkErrors.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center space-x-1.5 text-amber-800 font-semibold text-xs">
                <WifiOff className="h-4 w-4" />
                <span>Failed Network Requests ({item.networkErrors.length})</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {item.networkErrors.map((net, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-lg border border-amber-200 font-mono text-[11px] text-amber-900">
                    <span className="font-bold text-amber-700">{net.method} </span>
                    <span className="break-all">{net.url} </span>
                    <span className="text-rose-600 font-bold">[{net.errorText || net.status}]</span>
                  </div>
                ))}
              </div>
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
