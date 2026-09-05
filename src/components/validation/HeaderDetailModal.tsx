import React, { useState } from 'react';
import { HeaderValidationTableRow } from '../../types';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Smartphone,
  Monitor,
  Copy,
  Check,
  ExternalLink,
  Languages,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { copyTextToClipboard } from '../../utils/exportUtils';

interface HeaderDetailModalProps {
  row: HeaderValidationTableRow | null;
  onClose: () => void;
}

export const HeaderDetailModal: React.FC<HeaderDetailModalProps> = ({ row, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!row) return null;

  const handleCopy = async (text: string, key: string) => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const isPassed = row.status === 'passed';
  const isError = row.status === 'error';
  const isWarning = row.status === 'warning';
  const isNeedsReview = row.status === 'needs_review';
  const isSkipped = row.status === 'skipped';

  return (
    <div
      id="header-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-xl flex items-center justify-center ${
                isPassed
                  ? 'bg-emerald-100 text-emerald-700'
                  : isError
                  ? 'bg-rose-100 text-rose-700'
                  : isWarning || isNeedsReview
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {isPassed ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : isError ? (
                <XCircle className="h-5 w-5" />
              ) : isNeedsReview ? (
                <HelpCircle className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">
                  {row.validation} Validation Details
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                    isPassed
                      ? 'bg-emerald-100 text-emerald-800'
                      : isError
                      ? 'bg-rose-100 text-rose-800'
                      : isNeedsReview
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {row.statusLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono truncate max-w-md">{row.page}</p>
            </div>
          </div>

          <button
            id="modal-close-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Top Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 rounded-xl p-3.5 border border-slate-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Device</span>
              <div className="flex items-center space-x-1.5 mt-0.5 font-semibold text-slate-800">
                {row.device === 'Desktop' ? (
                  <Monitor className="h-3.5 w-3.5 text-slate-600" />
                ) : (
                  <Smartphone className="h-3.5 w-3.5 text-slate-600" />
                )}
                <span>{row.device}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Validation</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{row.validation}</span>
            </div>

            {row.language && (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Language</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{row.language}</span>
              </div>
            )}

            {row.confidence !== undefined && (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Confidence</span>
                <span className="font-semibold text-slate-800 mt-0.5 block font-mono">
                  {row.confidence}%
                </span>
              </div>
            )}
          </div>

          {/* Reason / Diagnostic Message */}
          {row.reason && (
            <div
              className={`p-3.5 rounded-xl border ${
                isError
                  ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                  : isNeedsReview
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              }`}
            >
              <span className="font-bold block mb-1">Diagnostic Reason:</span>
              <p className="leading-relaxed">{row.reason}</p>
            </div>
          )}

          {/* Validation Type 1: Header URLs Comparison */}
          {row.validationType === 'header_urls' && (
            <div className="space-y-4">
              {/* Missing URLs on Mobile (High alert) */}
              {row.missingOnMobile && row.missingOnMobile.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-900 flex items-center space-x-1.5">
                      <XCircle className="h-4 w-4 text-rose-600" />
                      <span>Missing on Mobile ({row.missingOnMobile.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(row.missingOnMobile!.join('\n'), 'missing-mobile')}
                      className="px-2 py-1 rounded bg-white hover:bg-rose-100 text-rose-700 text-[10px] font-semibold border border-rose-200 flex items-center space-x-1"
                    >
                      {copiedKey === 'missing-mobile' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'missing-mobile' ? 'Copied' : 'Copy Missing'}</span>
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {row.missingOnMobile.map((url, i) => (
                      <li
                        key={i}
                        className="font-mono text-[11px] bg-white px-2.5 py-1 rounded border border-rose-100 text-rose-800"
                      >
                        {url}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing URLs on Desktop (if any) */}
              {row.missingOnDesktop && row.missingOnDesktop.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <span className="font-bold text-amber-900 flex items-center space-x-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Missing on Desktop ({row.missingOnDesktop.length})</span>
                  </span>
                  <ul className="space-y-1">
                    {row.missingOnDesktop.map((url, i) => (
                      <li
                        key={i}
                        className="font-mono text-[11px] bg-white px-2.5 py-1 rounded border border-amber-100 text-amber-800"
                      >
                        {url}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Desktop vs Mobile URLs Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-800 flex items-center space-x-1">
                      <Monitor className="h-3.5 w-3.5 text-slate-500" />
                      <span>Desktop Header URLs ({row.desktopUrls?.length || 0})</span>
                    </span>
                    {row.desktopUrls && row.desktopUrls.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCopy(row.desktopUrls!.join('\n'), 'desktop-urls')}
                        className="text-slate-400 hover:text-slate-700 p-1"
                        title="Copy desktop URLs"
                      >
                        {copiedKey === 'desktop-urls' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {row.desktopUrls && row.desktopUrls.length > 0 ? (
                      row.desktopUrls.map((u, i) => (
                        <div key={i} className="font-mono text-[11px] text-slate-600 py-0.5 px-1 truncate">
                          {u}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 italic text-[11px]">No header URLs detected</p>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-800 flex items-center space-x-1">
                      <Smartphone className="h-3.5 w-3.5 text-slate-500" />
                      <span>Mobile Header URLs ({row.mobileUrls?.length || 0})</span>
                    </span>
                    {row.mobileUrls && row.mobileUrls.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCopy(row.mobileUrls!.join('\n'), 'mobile-urls')}
                        className="text-slate-400 hover:text-slate-700 p-1"
                        title="Copy mobile URLs"
                      >
                        {copiedKey === 'mobile-urls' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {row.mobileUrls && row.mobileUrls.length > 0 ? (
                      row.mobileUrls.map((u, i) => (
                        <div
                          key={i}
                          className={`font-mono text-[11px] py-0.5 px-1 truncate ${
                            row.desktopUrls?.includes(u) ? 'text-slate-600' : 'text-amber-700 font-semibold'
                          }`}
                        >
                          {u}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 italic text-[11px]">No mobile URLs detected</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Type 2: Language Switch */}
          {row.validationType === 'language_switch' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Language Switch Verification</span>
                  <span className="text-[11px] font-semibold text-slate-600">
                    Target Language: <strong className="text-slate-900">{row.language}</strong>
                  </span>
                </div>

                <div className="space-y-2 font-mono text-[11px]">
                  <div className="p-2.5 rounded bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">
                        Expected URL
                      </span>
                      <span className="text-slate-800 font-semibold">{row.expected}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(row.expected, 'exp-url')}
                      className="text-slate-400 hover:text-slate-700 p-1"
                      title="Copy expected URL"
                    >
                      {copiedKey === 'exp-url' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>

                  <div
                    className={`p-2.5 rounded border flex items-center justify-between ${
                      isError
                        ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">
                        Actual Landed URL
                      </span>
                      <span className="font-semibold">{row.actual}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(row.actual, 'act-url')}
                      className="text-slate-400 hover:text-slate-700 p-1"
                      title="Copy actual URL"
                    >
                      {copiedKey === 'act-url' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 pt-1">
                  <span>Translated page exists in crawl: </span>
                  <strong className={row.translatedExists ? 'text-emerald-700' : 'text-slate-700'}>
                    {row.translatedExists ? 'YES (Dedicated translated page exists)' : 'NO (English fallback allowed)'}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <a
            href={row.page}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1 font-semibold"
          >
            <span>Open Page in New Tab</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
