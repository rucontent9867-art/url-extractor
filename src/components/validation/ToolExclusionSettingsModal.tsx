import React, { useState, useEffect } from 'react';
import {
  ValidationToolId,
  DomainSettings,
  DomainToolExclusions,
  DomainGlobalExclusions,
  ExclusionType,
} from '../../types';
import {
  fetchDomainSettings,
  addDomainExclusion,
  removeDomainExclusion,
} from '../../utils/domainSettingsApi';
import {
  Settings,
  X,
  Plus,
  Trash2,
  Globe,
  Sliders,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

interface ToolExclusionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolId: ValidationToolId;
  toolName: string;
  domain: string;
  onSettingsUpdated?: () => void;
}

type TabType = 'tool' | 'global';

export const ToolExclusionSettingsModal: React.FC<ToolExclusionSettingsModalProps> = ({
  isOpen,
  onClose,
  toolId,
  toolName,
  domain,
  onSettingsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('tool');
  const [settings, setSettings] = useState<DomainSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingType, setAddingType] = useState<ExclusionType>('slug');
  const [inputValue, setInputValue] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadSettings = async () => {
    if (!domain) return;
    setLoading(true);
    try {
      const data = await fetchDomainSettings(domain);
      setSettings(data);
    } catch (err: any) {
      console.error('Failed to load domain settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && domain) {
      loadSettings();
      setInputValue('');
      setActionError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, domain]);

  if (!isOpen) return null;

  const currentToolExclusions: DomainToolExclusions = settings?.tools?.[toolId] || {
    ignoredSlugs: [],
    ignoredExactUrls: [],
    ignoredPatterns: [],
  };

  const globalExclusions: DomainGlobalExclusions = settings?.global || {
    ignoredSlugs: [],
    ignoredExactUrls: [],
    ignoredPatterns: [],
  };

  const activeExclusions = activeTab === 'tool' ? currentToolExclusions : globalExclusions;
  const targetScope = activeTab === 'tool' ? toolId : 'global';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !domain) return;

    setActionError(null);
    try {
      const updated = await addDomainExclusion(domain, targetScope, addingType, inputValue.trim());
      setSettings(updated);
      setInputValue('');
      setSuccessMessage(`Added ${addingType} exclusion`);
      setTimeout(() => setSuccessMessage(null), 2500);
      onSettingsUpdated?.();
    } catch (err: any) {
      setActionError(err.message || 'Failed to add exclusion');
    }
  };

  const handleRemove = async (type: ExclusionType, value: string) => {
    if (!domain) return;
    setActionError(null);
    try {
      const updated = await removeDomainExclusion(domain, targetScope, type, value);
      setSettings(updated);
      setSuccessMessage(`Removed exclusion`);
      setTimeout(() => setSuccessMessage(null), 2500);
      onSettingsUpdated?.();
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove exclusion');
    }
  };

  const totalToolRules =
    (currentToolExclusions.ignoredSlugs?.length || 0) +
    (currentToolExclusions.ignoredExactUrls?.length || 0) +
    (currentToolExclusions.ignoredPatterns?.length || 0);

  const totalGlobalRules =
    (globalExclusions.ignoredSlugs?.length || 0) +
    (globalExclusions.ignoredExactUrls?.length || 0) +
    (globalExclusions.ignoredPatterns?.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span>URL Exclusion Settings</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-mono font-medium">
                  {domain || 'Default Domain'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Configure ignored URLs independently per validation tool or domain-wide.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-100 bg-white flex space-x-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('tool');
              setActionError(null);
            }}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'tool'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>{toolName} Exclusions</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'tool'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalToolRules}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('global');
              setActionError(null);
            }}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'global'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Global Exclusions (All Tools)</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'global'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalGlobalRules}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {/* Informational Banner */}
          <div
            className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start space-x-2.5 ${
              activeTab === 'tool'
                ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}
          >
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              {activeTab === 'tool' ? (
                <span>
                  <strong>Tool-Specific Scope:</strong> URLs matching rules here will be ignored{' '}
                  <strong>ONLY by {toolName}</strong>. Other validators (Content Language, Sitemap,
                  Header, AMP) will continue to check them normally.
                </span>
              ) : (
                <span>
                  <strong>Global Scope:</strong> URLs matching rules here will be excluded from{' '}
                  <strong>ALL validation tools</strong> for domain <code>{domain}</code>.
                </span>
              )}
            </div>
          </div>

          {/* Add Rule Form */}
          <form onSubmit={handleAdd} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <span>Add Exclusion to {activeTab === 'tool' ? toolName : 'Global List'}</span>
              </label>
              <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setAddingType('slug')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    addingType === 'slug'
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  URL Slug
                </button>
                <button
                  type="button"
                  onClick={() => setAddingType('exact')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    addingType === 'exact'
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Exact URL
                </button>
                <button
                  type="button"
                  onClick={() => setAddingType('pattern')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    addingType === 'pattern'
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Wildcard Pattern
                </button>
              </div>
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  addingType === 'slug'
                    ? 'e.g. /community/ or blog or privacy'
                    : addingType === 'exact'
                    ? 'e.g. https://example.com/special-page/'
                    : 'e.g. */account/* or *?preview=*'
                }
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || loading}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center space-x-1.5 transition-all shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Exclusion</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center space-x-1">
              <HelpCircle className="h-3 w-3 shrink-0" />
              <span>
                {addingType === 'slug' && 'Matches any URL containing this path segment (e.g., /community/ matches /en/community/ or /community/about).'}
                {addingType === 'exact' && 'Matches this exact normalized full URL only.'}
                {addingType === 'pattern' && 'Matches URLs using wildcard patterns (* matches anything, e.g. */test/*).'}
              </span>
            </div>
          </form>

          {/* Feedback banners */}
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{actionError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Active Rules List */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Configured {activeTab === 'tool' ? `${toolName}` : 'Global'} Exclusions
            </h3>

            {/* Slugs List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>URL Slugs ({activeExclusions.ignoredSlugs?.length || 0})</span>
              </div>
              {!activeExclusions.ignoredSlugs || activeExclusions.ignoredSlugs.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-1 px-2 border border-dashed border-slate-200 rounded-lg">
                  No URL slugs excluded
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeExclusions.ignoredSlugs.map((slug) => (
                    <div
                      key={slug}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-mono text-slate-800 group"
                    >
                      <span className="text-slate-500 text-[10px]">slug:</span>
                      <span className="font-semibold">{slug}</span>
                      <button
                        type="button"
                        onClick={() => handleRemove('slug', slug)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-0.5"
                        title="Remove slug"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exact URLs List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Exact URLs ({activeExclusions.ignoredExactUrls?.length || 0})</span>
              </div>
              {!activeExclusions.ignoredExactUrls || activeExclusions.ignoredExactUrls.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-1 px-2 border border-dashed border-slate-200 rounded-lg">
                  No exact URLs excluded
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activeExclusions.ignoredExactUrls.map((url) => (
                    <div
                      key={url}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800"
                    >
                      <span className="truncate max-w-[480px]">{url}</span>
                      <button
                        type="button"
                        onClick={() => handleRemove('exact', url)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Remove exact URL"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Wildcard Patterns List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Wildcard Patterns ({activeExclusions.ignoredPatterns?.length || 0})</span>
              </div>
              {!activeExclusions.ignoredPatterns || activeExclusions.ignoredPatterns.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-1 px-2 border border-dashed border-slate-200 rounded-lg">
                  No wildcard patterns excluded
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeExclusions.ignoredPatterns.map((pattern) => (
                    <div
                      key={pattern}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-purple-50 border border-purple-200 text-xs font-mono text-purple-900"
                    >
                      <span className="text-purple-500 text-[10px]">pattern:</span>
                      <span className="font-semibold">{pattern}</span>
                      <button
                        type="button"
                        onClick={() => handleRemove('pattern', pattern)}
                        className="text-purple-400 hover:text-rose-600 transition-colors p-0.5"
                        title="Remove pattern"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <div className="text-slate-500 flex items-center space-x-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Changes auto-save to domain profile immediately.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-all shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
