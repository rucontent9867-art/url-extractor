import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Shield,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  Globe,
  Clock,
  ArrowRightLeft,
  Share2,
} from 'lucide-react';
import { Tool6Settings, ExternalUrlValidationMode, AssetType } from '../../types';

const DEFAULT_SOCIAL_DOMAINS = [
  'facebook.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'linkedin.com',
  'youtube.com',
  'tiktok.com',
  'reddit.com',
  'pinterest.com',
  'whatsapp.com',
  'telegram.org',
];

interface Tool6SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: string;
  onSettingsSaved?: (newSettings: Tool6Settings) => void;
}

export const Tool6SettingsModal: React.FC<Tool6SettingsModalProps> = ({
  isOpen,
  onClose,
  domain,
  onSettingsSaved,
}) => {
  const [extValidation, setExtValidation] = useState<ExternalUrlValidationMode>('none');
  const [selectedExtDomains, setSelectedExtDomains] = useState<string[]>([]);
  const [newExtDomain, setNewExtDomain] = useState('');

  const [enableSocialExclusions, setEnableSocialExclusions] = useState<boolean>(true);
  const [socialDomains, setSocialDomains] = useState<string[]>([...DEFAULT_SOCIAL_DOMAINS]);
  const [newSocialDomain, setNewSocialDomain] = useState('');

  const [timeoutSec, setTimeoutSec] = useState<number>(12);
  const [maxRedirectsThreshold, setMaxRedirectsThreshold] = useState<number>(2);
  const [ignoredAssetTypes, setIgnoredAssetTypes] = useState<AssetType[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/settings/tool6?domain=${encodeURIComponent(domain || 'default')}`);
        if (res.ok) {
          const data = await res.json();
          if (data.tool6) {
            const t6: Tool6Settings = data.tool6;
            setExtValidation(t6.externalUrlValidation || 'none');
            setSelectedExtDomains(t6.selectedExternalDomains || []);
            setEnableSocialExclusions(
              t6.enableSocialExclusions !== undefined ? t6.enableSocialExclusions : true
            );
            setSocialDomains(
              t6.socialDomains && t6.socialDomains.length > 0
                ? t6.socialDomains
                : [...DEFAULT_SOCIAL_DOMAINS]
            );
            setTimeoutSec(t6.timeoutSec || 12);
            setMaxRedirectsThreshold(t6.maxRedirectsThreshold || 2);
            setIgnoredAssetTypes(t6.ignoredAssetTypes || []);
          }
        }
      } catch (err) {
        console.error('Failed to load tool6 settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [isOpen, domain]);

  if (!isOpen) return null;

  const handleAddExtDomain = () => {
    const d = newExtDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (d && !selectedExtDomains.includes(d)) {
      setSelectedExtDomains([...selectedExtDomains, d]);
      setNewExtDomain('');
    }
  };

  const handleRemoveExtDomain = (dom: string) => {
    setSelectedExtDomains(selectedExtDomains.filter((d) => d !== dom));
  };

  const handleAddSocialDomain = () => {
    const d = newSocialDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (d && !socialDomains.includes(d)) {
      setSocialDomains([...socialDomains, d]);
      setNewSocialDomain('');
    }
  };

  const handleRemoveSocialDomain = (dom: string) => {
    setSocialDomains(socialDomains.filter((d) => d !== dom));
  };

  const handleResetSocialDomains = () => {
    setSocialDomains([...DEFAULT_SOCIAL_DOMAINS]);
  };

  const toggleIgnoredType = (type: AssetType) => {
    if (ignoredAssetTypes.includes(type)) {
      setIgnoredAssetTypes(ignoredAssetTypes.filter((t) => t !== type));
    } else {
      setIgnoredAssetTypes([...ignoredAssetTypes, type]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Tool6Settings = {
        externalUrlValidation: extValidation,
        selectedExternalDomains: selectedExtDomains,
        enableSocialExclusions,
        socialDomains,
        timeoutSec: Number(timeoutSec) || 12,
        maxRedirectsThreshold: Number(maxRedirectsThreshold) || 2,
        ignoredAssetTypes,
      };

      const res = await fetch('/api/settings/tool6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain || 'default',
          tool6: payload,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        if (onSettingsSaved) onSettingsSaved(payload);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 800);
      }
    } catch (err) {
      console.error('Failed to save Tool 6 settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="tool6-settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tool 6 Settings: Links, Assets & HTTP Health
              </h3>
              <p className="text-xs text-slate-500">
                Configured per-domain for <span className="font-semibold text-slate-700">{domain || 'default'}</span>
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
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">Loading settings...</div>
          ) : (
            <>
              {/* 1. External URL Validation */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="font-bold text-slate-800 text-sm">External URL Validation</span>
                </div>
                <p className="text-slate-500">
                  Choose how external links discovered across pages should be validated. External URLs are always discovered and recorded.
                </p>

                <div className="space-y-2 pt-1">
                  <label className="flex items-start space-x-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="externalUrlValidation"
                      value="none"
                      checked={extValidation === 'none'}
                      onChange={() => setExtValidation('none')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">Don't check external URLs (Recommended)</span>
                      <span className="text-slate-500">Records external links but marks them as skipped during HTTP validation.</span>
                    </div>
                  </label>

                  <label className="flex items-start space-x-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="externalUrlValidation"
                      value="all"
                      checked={extValidation === 'all'}
                      onChange={() => setExtValidation('all')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">Check all external URLs</span>
                      <span className="text-slate-500">Sends HTTP health checks to all external links (subject to rate-limits & timeout).</span>
                    </div>
                  </label>

                  <label className="flex items-start space-x-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="externalUrlValidation"
                      value="selected_domains"
                      checked={extValidation === 'selected_domains'}
                      onChange={() => setExtValidation('selected_domains')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">Check only selected external domains</span>
                      <span className="text-slate-500">Only validate external links pointing to the domains specified below.</span>
                    </div>
                  </label>
                </div>

                {extValidation === 'selected_domains' && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                    <span className="font-semibold text-slate-700 block">Selected Domains to Check:</span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="e.g. cdn.partner.com or api.github.com"
                        value={newExtDomain}
                        onChange={(e) => setNewExtDomain(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddExtDomain();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddExtDomain}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedExtDomains.length === 0 ? (
                        <span className="text-slate-400 italic">No external domains added yet.</span>
                      ) : (
                        selectedExtDomains.map((dom) => (
                          <span
                            key={dom}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-700 font-mono text-[11px]"
                          >
                            <span>{dom}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveExtDomain(dom)}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Social URL Exclusions */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Share2 className="h-4 w-4 text-purple-600" />
                    <span className="font-bold text-slate-800 text-sm">Social URL Exclusions</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSocialExclusions}
                      onChange={(e) => setEnableSocialExclusions(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <p className="text-slate-500">
                  Prevents false negatives, bot blocks (403, 999), and rate limits from social media platforms. Social URLs remain discovered and listed as <span className="font-bold text-slate-700">SKIPPED</span>.
                </p>

                {enableSocialExclusions && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Excluded Social Domains:</span>
                      <button
                        type="button"
                        onClick={handleResetSocialDomains}
                        className="text-purple-600 hover:text-purple-700 font-medium flex items-center space-x-1"
                        title="Reset to default social platforms"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset Defaults</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="e.g. threads.net or discord.gg"
                        value={newSocialDomain}
                        onChange={(e) => setNewSocialDomain(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSocialDomain();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddSocialDomain}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {socialDomains.map((dom) => (
                        <span
                          key={dom}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white border border-purple-200 text-purple-900 rounded-lg font-mono text-[11px]"
                        >
                          <span>{dom}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSocialDomain(dom)}
                            className="text-purple-400 hover:text-rose-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. HTTP Request & Redirect Thresholds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                    <Clock className="h-4 w-4 text-slate-600" />
                    <span>Request Timeout</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">Maximum seconds to wait per asset HTTP health check.</p>
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="number"
                      min={3}
                      max={60}
                      value={timeoutSec}
                      onChange={(e) => setTimeoutSec(Math.max(3, parseInt(e.target.value, 10) || 12))}
                      className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <span className="text-slate-600 font-medium">seconds</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                    <ArrowRightLeft className="h-4 w-4 text-slate-600" />
                    <span>Redirect Chain Threshold</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">Number of redirect hops before flagging as a warning chain.</p>
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxRedirectsThreshold}
                      onChange={(e) =>
                        setMaxRedirectsThreshold(Math.max(1, parseInt(e.target.value, 10) || 2))
                      }
                      className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <span className="text-slate-600 font-medium">hops</span>
                  </div>
                </div>
              </div>

              {/* 4. Ignored Resource Types */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-slate-600" />
                  <span className="font-bold text-slate-800 text-sm">Ignore Resource Types</span>
                </div>
                <p className="text-slate-500">
                  Select any resource types you want to skip validating during the audit:
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {(
                    [
                      { type: 'IMAGE', label: 'Images' },
                      { type: 'VIDEO', label: 'Videos' },
                      { type: 'PDF', label: 'PDFs' },
                      { type: 'DOCUMENT', label: 'Documents' },
                      { type: 'INTERNAL_LINK', label: 'Internal Links' },
                    ] as { type: AssetType; label: string }[]
                  ).map((item) => {
                    const isIgnored = ignoredAssetTypes.includes(item.type);
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => toggleIgnoredType(item.type)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                          isIgnored
                            ? 'bg-rose-50 border-rose-300 text-rose-800 line-through'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isIgnored ? `Ignored: ${item.label}` : `Validate: ${item.label}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 ${
              saveSuccess
                ? 'bg-emerald-600'
                : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="h-4 w-4" />
                <span>Saved!</span>
              </>
            ) : isSaving ? (
              <span>Saving...</span>
            ) : (
              <span>Save Domain Settings</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
