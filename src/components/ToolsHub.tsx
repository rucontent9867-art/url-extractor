import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Image,
  Layers,
  Link2,
  RotateCcw,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { MainNavTab } from './Header';
import type { ValidationToolId } from '../types';
import { ToolExclusionSettingsModal } from './validation/ToolExclusionSettingsModal';

interface ToolsHubProps {
  onStartAudit: (url: string) => void;
  onSelectNavTab: (tab: MainNavTab) => void;
  onOpenValidationTool?: (toolId: string) => void;
  onLoadDemoData: () => void;
  onResetSession: () => void;
  hasActiveData: boolean;
  activeDomain?: string;
  totalUrlsCount?: number;
  isBusy?: boolean;
  errorMessage?: string;
}

/**
 * Start screen: one input, one button, one obvious next step.
 * Everything technical lives behind "Results" and "Crawl".
 */
export const ToolsHub: React.FC<ToolsHubProps> = ({
  onStartAudit,
  onSelectNavTab,
  onOpenValidationTool,
  onLoadDemoData,
  onResetSession,
  hasActiveData,
  activeDomain,
  totalUrlsCount = 0,
  isBusy = false,
  errorMessage,
}) => {
  const [auditUrl, setAuditUrl] = useState('');
  const [isExclusionModalOpen, setIsExclusionModalOpen] = useState(false);
  const [selectedExclusionTool, setSelectedExclusionTool] = useState<ValidationToolId>('linkHealth');

  const groups = [
    {
      id: 'links',
      title: 'Links & sitemaps',
      blurb: 'Broken links, redirect loops, empty anchors and pages missing from your sitemap.',
      icon: Link2,
      tool: 'linkhealth',
      checks: 6,
    },
    {
      id: 'content',
      title: 'Content & languages',
      blurb: 'Missing translations, wrong language tags and language switchers that lead nowhere.',
      icon: Layers,
      tool: 'completeness',
      checks: 3,
    },
    {
      id: 'frontend',
      title: 'Frontend quality',
      blurb: 'Layouts breaking on phones, JavaScript errors, dead buttons and AMP mismatches.',
      icon: Eye,
      tool: 'visual',
      checks: 3,
    },
    {
      id: 'assets',
      title: 'Images & assets',
      blurb: 'Broken images, oversized files and insecure (mixed-content) resources.',
      icon: Image,
      tool: 'asset',
      checks: 1,
    },
  ];

  const submitAudit = () => {
    const value = auditUrl.trim();
    if (!value) return;
    onStartAudit(value);
  };

  return (
    <div className="space-y-6">
      {/* One action: audit a site */}
      <section className="rounded-3xl bg-slate-900 text-white p-6 sm:p-10 shadow-xl relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl space-y-5">
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-semibold">
            <Sparkles className="h-3 w-3" />
            <span>Website audit in one step</span>
          </span>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Find everything broken on a website.
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Paste a website address. We crawl it, run 13 checks and show you exactly what to fix —
              starting with the most damaging problems.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={auditUrl}
                onChange={(e) => setAuditUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitAudit();
                }}
                placeholder="yourwebsite.com"
                aria-label="Website address to audit"
                className="w-full pl-10 pr-3 py-3 rounded-xl bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <button
              type="button"
              onClick={submitAudit}
              disabled={isBusy || !auditUrl.trim()}
              className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-sm flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              {isBusy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              <span>{isBusy ? 'Auditing…' : 'Run audit'}</span>
            </button>
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">
              {errorMessage}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-400">
            <button
              type="button"
              onClick={onLoadDemoData}
              className="inline-flex items-center space-x-1.5 text-emerald-300 hover:text-emerald-200 font-semibold cursor-pointer"
            >
              <Zap className="h-3 w-3" />
              <span>See a finished example instead</span>
            </button>
            <span className="hidden sm:inline text-slate-600">•</span>
            <button
              type="button"
              onClick={() => onSelectNavTab('crawler')}
              className="inline-flex items-center space-x-1.5 hover:text-slate-200 cursor-pointer"
            >
              <Sliders className="h-3 w-3" />
              <span>Audit a list of specific pages</span>
            </button>
          </div>

          {hasActiveData && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              <span className="px-2 py-1 rounded-lg bg-white/10 text-slate-200">
                Last run: {activeDomain || 'website'} · {totalUrlsCount.toLocaleString()} pages
              </span>
              <button
                type="button"
                onClick={() => onSelectNavTab('validation')}
                className="px-2.5 py-1 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-100 cursor-pointer"
              >
                View results
              </button>
              <button
                type="button"
                onClick={onResetSession}
                className="px-2.5 py-1 rounded-lg bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </section>

      {/* How it works — three short steps */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { step: '1', title: 'Enter a website', text: 'Just the address — no setup or account needed.' },
          { step: '2', title: 'We crawl and check', text: 'Every page, link, image and language version we can find.' },
          { step: '3', title: 'Fix what is flagged', text: 'A prioritised list with the exact page and suggested fix.' },
        ].map((item) => (
          <div key={item.step} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start space-x-3">
            <span className="h-7 w-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {item.step}
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{item.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* What gets checked — four plain-language groups */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">What we check</h2>
            <p className="text-xs text-slate-500">13 checks, grouped so you only see the results that matter.</p>
          </div>
          <button
            type="button"
            onClick={() => onSelectNavTab('validation')}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center space-x-1 cursor-pointer"
          >
            <span>Open results</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map((group) => {
            const IconComponent = group.icon;
            return (
              <div
                key={group.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start justify-between gap-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start space-x-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0">
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">
                      {group.title}
                      <span className="ml-1.5 text-[10px] font-mono font-semibold text-slate-400">
                        {group.checks} {group.checks === 1 ? 'check' : 'checks'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{group.blurb}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenValidationTool?.(group.tool)}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Open
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Advanced, folded away */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4">
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="inline-flex items-center space-x-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
              <span>Advanced: crawl limits and exclusion rules</span>
            </span>
            <span className="text-slate-400 group-open:rotate-90 transition-transform">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </summary>
          <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectNavTab('crawler')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Crawl settings
            </button>
            <button
              type="button"
              onClick={() => setIsExclusionModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Exclusion rules
            </button>
            <label className="inline-flex items-center space-x-1.5 text-xs text-slate-500">
              <span>for</span>
              <select
                value={selectedExclusionTool}
                onChange={(e) => setSelectedExclusionTool(e.target.value as ValidationToolId)}
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white cursor-pointer"
                aria-label="Which check the exclusion rules apply to"
              >
                <option value="linkHealth">Links</option>
                <option value="sitemap">Sitemap</option>
                <option value="completeness">Translations</option>
                <option value="content">Content language</option>
                <option value="header">Navigation</option>
                <option value="amp">AMP</option>
                <option value="asset">Images &amp; assets</option>
                <option value="visual">Layouts</option>
                <option value="interaction">Interactions</option>
              </select>
            </label>
          </div>
        </details>
      </section>

      <ToolExclusionSettingsModal
        isOpen={isExclusionModalOpen}
        onClose={() => setIsExclusionModalOpen(false)}
        toolId={selectedExclusionTool}
        toolName="Audit check"
        domain={activeDomain || 'default'}
      />
    </div>
  );
};
