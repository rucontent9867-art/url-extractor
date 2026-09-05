import React, { useState } from 'react';
import { AmpValidationItem, AmpMissingContentBlock } from '../../types';
import {
  X,
  Copy,
  Check,
  FileText,
  AlertTriangle,
  ExternalLink,
  Layers,
  Heading,
  List,
  MousePointer,
  CheckCircle2,
} from 'lucide-react';
import { copyTextToClipboard } from '../../utils/exportUtils';

interface AmpContentDiffModalProps {
  item: AmpValidationItem | null;
  onClose: () => void;
}

export const AmpContentDiffModal: React.FC<AmpContentDiffModalProps> = ({ item, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!item) return null;

  const handleCopy = async (text: string, key: string) => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const handleCopyAllMissing = async () => {
    if (!item.missingContentBlocks || item.missingContentBlocks.length === 0) return;
    const text = item.missingContentBlocks
      .map((b, i) => `[${b.type.toUpperCase()}] ${b.text}`)
      .join('\n\n');
    handleCopy(text, 'all_missing');
  };

  const missingBlocks = item.missingContentBlocks || [];
  const filteredBlocks = missingBlocks.filter((b) => {
    if (filterType !== 'all' && b.type !== filterType) return false;
    if (searchTerm && !b.text.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'heading':
        return <Heading className="h-3.5 w-3.5 text-blue-600" />;
      case 'list_item':
        return <List className="h-3.5 w-3.5 text-purple-600" />;
      case 'cta':
        return <MousePointer className="h-3.5 w-3.5 text-amber-600" />;
      default:
        return <FileText className="h-3.5 w-3.5 text-slate-600" />;
    }
  };

  return (
    <div
      id="amp-content-diff-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Missing Static Content on AMP</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                  {missingBlocks.length} Blocks Missing
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700">
                  {item.contentMatchPercent}% Match
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono truncate max-w-lg mt-0.5">
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
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Comparison summary card */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] font-medium uppercase tracking-wider">
                Normal Page Text
              </span>
              <span className="font-bold text-slate-900 text-sm font-mono">
                {item.normalStaticChars.toLocaleString()} chars
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] font-medium uppercase tracking-wider">
                AMP Page Text
              </span>
              <span className="font-bold text-slate-900 text-sm font-mono">
                {item.ampStaticChars.toLocaleString()} chars
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] font-medium uppercase tracking-wider">
                Content Match Score
              </span>
              <span
                className={`font-bold text-sm font-mono ${
                  item.contentMatchPercent >= 95
                    ? 'text-emerald-600'
                    : item.contentMatchPercent >= 85
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {item.contentMatchPercent}%
              </span>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search missing text..."
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-1 focus:ring-slate-900 w-48 sm:w-56"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Types</option>
                <option value="paragraph">Paragraphs</option>
                <option value="heading">Headings</option>
                <option value="list_item">List Items</option>
                <option value="cta">CTAs / Buttons</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleCopyAllMissing}
              disabled={missingBlocks.length === 0}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {copiedKey === 'all_missing' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied All!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy All Missing Blocks</span>
                </>
              )}
            </button>
          </div>

          {/* Missing Blocks List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>
                Missing Static Blocks ({filteredBlocks.length} of {missingBlocks.length})
              </span>
            </h4>

            {filteredBlocks.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                {missingBlocks.length === 0
                  ? 'No static content blocks are missing from the AMP version. Content is 100% equivalent!'
                  : 'No missing blocks match the current search query or filter.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="p-1 rounded bg-slate-100 flex items-center justify-center">
                          {getBlockIcon(block.type)}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          {block.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {block.charCount} characters
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(block.text, block.id)}
                        className="px-2 py-1 rounded text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        {copiedKey === block.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy Block</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-slate-800 font-sans leading-relaxed bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                      {block.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AMP-only content if any */}
          {item.ampOnlyContentBlocks && item.ampOnlyContentBlocks.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                AMP-Only Static Content ({item.ampOnlyContentBlocks.length})
              </h4>
              <div className="space-y-2">
                {item.ampOnlyContentBlocks.map((text, i) => (
                  <div
                    key={`amp_only_${i}`}
                    className="p-3 rounded-lg border border-blue-100 bg-blue-50/50 text-xs text-slate-800 leading-relaxed"
                  >
                    <span className="text-[10px] font-bold uppercase text-blue-700 block mb-1">
                      Present on AMP only
                    </span>
                    {text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a
              href={item.normalUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center space-x-1"
            >
              <span>Normal Page</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            {item.ampUrl && (
              <a
                href={item.ampUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center space-x-1"
              >
                <span>AMP Page</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

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
  );
};
