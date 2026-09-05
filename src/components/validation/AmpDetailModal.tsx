import React, { useState } from 'react';
import { AmpValidationItem } from '../../types';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Copy,
  Check,
  ExternalLink,
  Zap,
  Globe,
  Link as LinkIcon,
  Languages,
  Layers,
  Heading,
  FileText,
  Code2,
  CheckSquare,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { copyTextToClipboard } from '../../utils/exportUtils';

interface AmpDetailModalProps {
  item: AmpValidationItem | null;
  onClose: () => void;
  onOpenDiffModal?: (item: AmpValidationItem) => void;
}

export const AmpDetailModal: React.FC<AmpDetailModalProps> = ({
  item,
  onClose,
  onOpenDiffModal,
}) => {
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
      id="amp-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Modal Header */}
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
                <Zap className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">AMP Validation Inspection</h3>
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
                  {item.statusLabel}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                  {item.expectedLanguage} ({item.expectedLanguageCode.toUpperCase()})
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono truncate max-w-md mt-0.5">
                {item.normalUrl}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Reason banner if error / warning */}
          {item.reason && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start space-x-2.5 ${
                isError
                  ? 'bg-rose-50 border border-rose-200 text-rose-900'
                  : 'bg-amber-50 border border-amber-200 text-amber-900'
              }`}
            >
              {isError ? (
                <XCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-bold block">Evaluation Note:</span>
                <p className="leading-relaxed">{item.reason}</p>
              </div>
            </div>
          )}

          {/* Section 1: URL Parity & Discovery */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Globe className="h-3.5 w-3.5 text-slate-500" />
              <span>URL & AMP Discovery</span>
            </h4>

            <div className="space-y-2.5">
              {/* Normal URL */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div className="min-w-0 pr-3">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Normal Web URL
                  </span>
                  <p className="text-xs font-mono font-medium text-slate-900 truncate">
                    {item.normalUrl}
                  </p>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(item.normalUrl, 'normal_url')}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                    title="Copy URL"
                  >
                    {copiedKey === 'normal_url' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <a
                    href={item.normalUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* AMP URL */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div className="min-w-0 pr-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      AMP URL ({item.discoverySource.toUpperCase()})
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        item.discoverySource === 'declared'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.discoverySource === 'guessed'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.discoverySource === 'declared'
                        ? 'Declared rel="amphtml"'
                        : item.discoverySource === 'guessed'
                        ? 'Guessed Pattern'
                        : 'None Found'}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-medium text-slate-900 truncate mt-0.5">
                    {item.ampUrl || 'No AMP URL declared'}
                  </p>
                </div>
                {item.ampUrl && (
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(item.ampUrl!, 'amp_url')}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                      title="Copy AMP URL"
                    >
                      {copiedKey === 'amp_url' ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <a
                      href={item.ampUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                      title="Open AMP in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Core Audits Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <CheckSquare className="h-3.5 w-3.5 text-slate-500" />
              <span>Relationship & Parity Audits</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Audit 1: HTTP Availability */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">1. AMP Availability</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.isAvailable
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.discoverySource === 'none'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.isAvailable
                      ? `HTTP ${item.httpStatus || 200} OK`
                      : item.discoverySource === 'none'
                      ? 'N/A'
                      : `HTTP ${item.httpStatus || 'Failed'}`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {item.isAvailable
                    ? 'AMP page responds with valid HTTP 200 and loads successfully.'
                    : item.discoverySource === 'none'
                    ? 'No AMP version declared.'
                    : 'AMP endpoint returned error status or timed out.'}
                </p>
              </div>

              {/* Audit 2: Canonical Parity */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">2. Canonical Backlink</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.canonicalMatches
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.canonicalStatus === 'not_applicable'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.canonicalMatches
                      ? 'Canonical Match'
                      : item.canonicalStatus === 'missing'
                      ? 'Canonical Missing'
                      : item.canonicalStatus === 'not_applicable'
                      ? 'N/A'
                      : 'Canonical Mismatch'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono truncate">
                  {item.ampCanonicalUrl || 'No canonical tag on AMP page'}
                </p>
              </div>

              {/* Audit 3: Language Parity */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">3. Language Verification</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.languageMatches
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.discoverySource === 'none'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.languageMatches ? 'Language Pass' : 'Language Mismatch'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Expected:{' '}
                  <span className="font-semibold text-slate-800">{item.expectedLanguage}</span> |
                  Detected:{' '}
                  <span className="font-semibold text-slate-800">
                    {item.detectedAmpLanguage || 'N/A'}
                  </span>
                </p>
              </div>

              {/* Audit 4: Static Content Coverage */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">4. Static Content Match</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      item.contentMatchPercent >= 95
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.contentMatchPercent >= 85
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.contentMatchPercent}% Match
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Normal: {item.normalStaticChars}c | AMP: {item.ampStaticChars}c
                  </span>
                  {item.missingContentBlocks && item.missingContentBlocks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenDiffModal?.(item)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                    >
                      View {item.missingContentBlocks.length} Missing Blocks
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Title & Headings Parity */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Heading className="h-3.5 w-3.5 text-slate-500" />
              <span>Title & Heading Parity</span>
            </h4>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Page Title
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      item.titleMatches
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.titleMatches ? 'Title Match' : 'Different Title'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">
                      Normal Title:
                    </span>
                    <span className="font-medium text-slate-800">{item.normalTitle || 'None'}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">
                      AMP Title:
                    </span>
                    <span className="font-medium text-slate-800">{item.ampTitle || 'None'}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Primary H1 Heading
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      item.h1Matches
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.h1Matches ? 'H1 Match' : 'H1 Mismatch'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">
                      Normal H1:
                    </span>
                    <span className="font-medium text-slate-800">{item.normalH1 || 'None'}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">
                      AMP H1:
                    </span>
                    <span className="font-medium text-slate-800">{item.ampH1 || 'None'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Technical AMP Validity */}
          {item.discoverySource !== 'none' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                <Code2 className="h-3.5 w-3.5 text-slate-500" />
                <span>Technical AMP Markup</span>
              </h4>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">AMP Format Compliance</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.technicalStatus === 'valid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.technicalStatus === 'needs_review'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.technicalStatus.toUpperCase()}
                  </span>
                </div>

                {item.technicalIssues && item.technicalIssues.length > 0 ? (
                  <ul className="space-y-1 pt-1 border-t border-slate-100 text-xs text-rose-700">
                    {item.technicalIssues.map((issue, idx) => (
                      <li key={`tech_${idx}`} className="flex items-start space-x-1.5">
                        <span className="text-rose-500 shrink-0">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-emerald-700 pt-1 border-t border-slate-100">
                    All required AMP HTML attributes, JS runtimes, and boilerplate styles are properly configured.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {item.missingContentBlocks && item.missingContentBlocks.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenDiffModal?.(item)}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>View Missing Content ({item.missingContentBlocks.length})</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 hover:bg-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
