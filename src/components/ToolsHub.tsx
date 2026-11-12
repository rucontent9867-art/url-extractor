import React, { useState } from 'react';
import {
  ShieldCheck,
  FileSearch,
  Globe2,
  Layers,
  FileCheck2,
  Smartphone,
  Eye,
  MousePointerClick,
  Compass,
  Sliders,
  Settings2,
  Zap,
  Sparkles,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ListOrdered,
  FileCode,
  Link2,
  Search,
} from 'lucide-react';
import { MainNavTab } from './Header';
import { ValidationToolId } from '../types';
import { ToolExclusionSettingsModal } from './validation/ToolExclusionSettingsModal';
import { Tool6SettingsModal } from './validation/Tool6SettingsModal';

interface ToolsHubProps {
  onSelectNavTab: (tab: MainNavTab) => void;
  onOpenValidationTool?: (toolId: string) => void;
  onLoadDemoData: () => void;
  onResetSession: () => void;
  hasActiveData: boolean;
  activeDomain?: string;
  totalUrlsCount?: number;
}

type ToolCategory = 'all' | 'seo' | 'localization' | 'qa' | 'assets' | 'crawler';

export const ToolsHub: React.FC<ToolsHubProps> = ({
  onSelectNavTab,
  onOpenValidationTool,
  onLoadDemoData,
  onResetSession,
  hasActiveData,
  activeDomain,
  totalUrlsCount = 0,
}) => {
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [isExclusionModalOpen, setIsExclusionModalOpen] = useState(false);
  const [selectedExclusionTool, setSelectedExclusionTool] = useState<ValidationToolId>('sitemap');
  const [isTool6ModalOpen, setIsTool6ModalOpen] = useState(false);

  const tools = [
    {
      id: 'tool-sitemap',
      toolId: 'sitemap',
      number: 'Tool 1',
      title: 'Sitemap Coverage Validator',
      subtitle: 'English/Canonical URLs vs. XML Sitemaps',
      category: 'seo',
      categoryLabel: 'SEO & Indexing',
      icon: ShieldCheck,
      color: 'emerald',
      description:
        'Audits whether all crawled internal English and canonical URLs exist within the site’s XML sitemaps (sitemap.xml). Detects orphan pages, missing indexed links, and sitemap-only URLs while ignoring localized prefixes.',
      metrics: ['Sitemap Coverage %', 'Missing URL Extraction', 'Sitemap-only URLs', 'Canonical Path Sync'],
      tabTarget: 'validation',
      validationTab: 'sitemap',
      supportsExclusionModal: true,
    },
    {
      id: 'tool-completeness',
      toolId: 'completeness',
      number: 'Tool 2',
      title: 'Language Completeness Matrix',
      subtitle: 'Cross-Locale Missing Translation Matrix',
      category: 'localization',
      categoryLabel: 'Localization',
      icon: Layers,
      color: 'blue',
      description:
        'Builds a multi-language comparison matrix across all discovered locales (e.g. /fr/, /de/, /es/, /it/). Flags missing localized translations for every canonical slug with 1-click clipboard export for translation teams.',
      metrics: ['Missing Translations by Locale', 'Translation Parity %', 'Extra Unmapped Pages', 'Missing Slug Export'],
      tabTarget: 'validation',
      validationTab: 'completeness',
      supportsExclusionModal: true,
    },
    {
      id: 'tool-content-lang',
      toolId: 'content',
      number: 'Tool 3',
      title: 'Content Language & Drift Detector',
      subtitle: 'Statistical Body Text Language Verification',
      category: 'localization',
      categoryLabel: 'Localization',
      icon: Globe2,
      color: 'indigo',
      description:
        'Extracts page body content, ignores dynamic widgets/chatbars, and executes statistical n-gram language detection. Flags translation drift where English text remains unlocalized on non-English URLs.',
      metrics: ['Text Confidence Score', 'Language Mismatch Alerts', 'Static DOM Filtering', 'Custom Confidence Threshold'],
      tabTarget: 'validation',
      validationTab: 'content',
      supportsExclusionModal: true,
    },
    {
      id: 'tool-header-nav',
      toolId: 'header',
      number: 'Tool 4',
      title: 'Header & Language Navigation Auditor',
      subtitle: 'Automated Navigation & Locale Switcher Audit',
      category: 'qa',
      categoryLabel: 'Frontend QA',
      icon: FileSearch,
      color: 'purple',
      description:
        'Audits top navigation bars, mobile menus, and language dropdown switchers using Playwright and synthetic DOM. Ensures clicking a language switch preserves the current page context instead of redirecting to the homepage.',
      metrics: ['Context Preservation Check', 'Broken Header Link Audit', 'Dropdown Language Verification', 'Destination HTTP Status'],
      tabTarget: 'validation',
      validationTab: 'header',
      supportsExclusionModal: true,
    },
    {
      id: 'tool-amp',
      toolId: 'amp',
      number: 'Tool 5',
      title: 'AMP Mobile Parity Validator',
      subtitle: 'Accelerated Mobile Pages Verification',
      category: 'seo',
      categoryLabel: 'SEO & Mobile',
      icon: Smartphone,
      color: 'amber',
      description:
        'Validates existence of AMP versions, checks <link rel="amphtml"> tags, verifies reciprocal canonical tags, and generates side-by-side text content parity comparisons between desktop and AMP pages.',
      metrics: ['amphtml Tag Audit', 'Reciprocal Canonical Check', 'Content Similarity %', 'Visual Content Diff Viewer'],
      tabTarget: 'validation',
      validationTab: 'amp',
      supportsExclusionModal: true,
    },
    {
      id: 'tool-asset',
      toolId: 'asset',
      number: 'Tool 6',
      title: 'Asset, Resource & Media Health Inspector',
      subtitle: 'Deep Asset Audit & Broken Resource Detector',
      category: 'assets',
      categoryLabel: 'Media & Assets',
      icon: FileCheck2,
      color: 'rose',
      description:
        'Crawls all embedded page resources—images, stylesheets, scripts, videos, fonts, and PDFs. Flags broken 404 assets, slow response times, and allows configuring granular domain exclusion rules.',
      metrics: ['Broken 404 Asset Detector', 'Resource Latency Audit', 'Media Category Breakdown', 'Custom Asset Filtering Rules'],
      tabTarget: 'validation',
      validationTab: 'asset',
      supportsTool6Modal: true,
      supportsExclusionModal: true,
    },
    {
      id: 'tool-visual',
      toolId: 'visual',
      number: 'Tool 7',
      title: 'Responsive & Multi-Viewport Layout Auditor',
      subtitle: 'Desktop, Tablet & Mobile Overflow Inspector',
      category: 'qa',
      categoryLabel: 'Frontend QA',
      icon: Eye,
      color: 'teal',
      description:
        'Renders pages across Desktop (1280px), Tablet (768px), and Mobile (375px) viewports. Detects horizontal scroll overflows, cut-off tables, overflowing text containers, and captures visual metrics.',
      metrics: ['Horizontal Overflow Detection', 'Offending Element CSS Selector', 'Multi-Viewport Rendering', 'Visual Evidence Reports'],
      tabTarget: 'validation',
      validationTab: 'visual',
      supportsExclusionModal: true,
    },
    {
      id: 'tool-interaction',
      toolId: 'interaction',
      number: 'Tool 8',
      title: 'Interactive Console & UI Health Validator',
      subtitle: 'Headless DOM Interaction & JS Error Monitor',
      category: 'qa',
      categoryLabel: 'Frontend QA',
      icon: MousePointerClick,
      color: 'cyan',
      description:
        'Monitors JavaScript runtime console errors, failed AJAX/fetch network requests, and triggers interactive elements like hamburger navigation toggles, dropdowns, and form submits.',
      metrics: ['JS Runtime Error Logger', 'Failed Network Request Sniffer', 'Interactive Button Testing', 'Form & Drawer Health'],
      tabTarget: 'validation',
      validationTab: 'interaction',
      supportsExclusionModal: true,
    },
    {
      id: 'tool-link-health',
      toolId: 'linkHealth',
      number: 'Tool 9',
      title: 'Link & URL Health Engine',
      subtitle: 'Dual-Mode Link, Redirect & Anchor Audit',
      category: 'seo',
      categoryLabel: 'Links & SEO',
      icon: Link2,
      color: 'emerald',
      description:
        'Audits every <a> tag in two modes: a full-website deep scan of the crawled session, or an instant audit of a pasted URL list. Detects 4xx/5xx destinations, multi-hop redirect chains, redirect loops, double slashes, placeholder hrefs, broken in-page anchors, empty anchor text, and tracking parameter pollution.',
      metrics: [
        'Broken 4xx/5xx Links',
        'Redirect Chains & Loops',
        'Placeholder (#) Links',
        'Broken In-Page Anchors',
        'Empty Anchor Text',
        'Double-Slash URLs',
        'Tracking Params',
        'CSV + Jira Export',
      ],
      tabTarget: 'validation',
      validationTab: 'linkhealth',
      supportsExclusionModal: true,
    },
    {
      id: 'tool-crawler',
      toolId: 'crawler',
      number: 'Engine',
      title: 'High-Speed Webpage URL Extractor & Sieve',
      subtitle: 'BFS Recursive Crawler + XML Sitemap Discoverer',
      category: 'crawler',
      categoryLabel: 'Discovery & Crawl',
      icon: Compass,
      color: 'slate',
      description:
        'Parallelized crawler supporting both full domain recursive crawling and instant target URL lists. Automatically isolates webpage URLs from static media assets, strips tracking tags, and resolves redirects.',
      metrics: ['Recursive BFS Traversal', 'Parallel Concurrency (up to 50)', 'Sitemap Discovery', 'Robots.txt Adherence'],
      tabTarget: 'crawler',
      supportsAdvancedSettings: true,
    },
    {
      id: 'tool-urls-table',
      toolId: 'urls',
      number: 'Data Hub',
      title: 'Discovered URLs Explorer & Extractor',
      subtitle: 'Canonical Matching, Source Tracking & Data Export',
      category: 'crawler',
      categoryLabel: 'Extraction & Export',
      icon: ListOrdered,
      color: 'emerald',
      description:
        'Interactive data table for all discovered webpage URLs. View canonical paths, status codes, response times, language flags, and source pages. Filter by language and export to CSV or clipboard.',
      metrics: ['Instant Search & Filter', 'Source Traceability', 'Status Code Segmentation', 'CSV & Clipboard One-Click Export'],
      tabTarget: 'urls',
    },
    {
      id: 'tool-languages-hub',
      toolId: 'languages',
      number: 'Locale Hub',
      title: 'Multi-Language Segmenter & Analytics',
      subtitle: 'Language Breakdown, Locale Percentages & Targeted Export',
      category: 'localization',
      categoryLabel: 'Localization',
      icon: Globe2,
      color: 'blue',
      description:
        'Aggregates all discovered URLs into language families. Visualizes percentage share per locale and allows exporting targeted URL lists for specific localized paths (e.g. export only French URLs).',
      metrics: ['Locale Distribution Chart', 'Language Share %', 'Targeted Locale Export', 'Prefix-based Categorization'],
      tabTarget: 'languages',
    },
  ];

  const filteredTools = tools.filter((tool) => {
    const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
    const matchesSearch =
      !searchFilter.trim() ||
      tool.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      tool.subtitle.toLowerCase().includes(searchFilter.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      tool.metrics.some((m) => m.toLowerCase().includes(searchFilter.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleLaunchTool = (tool: (typeof tools)[0]) => {
    if (tool.tabTarget === 'validation' && tool.validationTab) {
      onSelectNavTab('validation');
      onOpenValidationTool?.(tool.validationTab);
    } else {
      onSelectNavTab(tool.tabTarget as MainNavTab);
    }
  };

  const handleOpenExclusion = (toolId: string) => {
    setSelectedExclusionTool(toolId as ValidationToolId);
    setIsExclusionModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Comprehensive 12-in-1 Webpage & SEO Suite</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              All Tools & Automated Auditing Suite
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Explore, configure, and inspect every specialized auditing tool in the platform. You can review all tool
              capabilities, customize exclusion rules, test with interactive demo data, or execute a live crawler session.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onLoadDemoData}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-2 transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              <Zap className="h-4 w-4 fill-slate-950" />
              <span>Load Sample Dataset (Instant Tour)</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectNavTab('crawler')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 text-emerald-400" />
              <span>Launch Live Crawler</span>
            </button>

            {hasActiveData && (
              <button
                type="button"
                onClick={onResetSession}
                className="px-3 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs border border-rose-500/20 flex items-center space-x-1.5 transition-all cursor-pointer"
                title="Reset active dataset"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Status ticker */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 text-[11px] block">Total Specialized Tools</span>
            <span className="font-bold text-white text-base">12 Tools Built-in</span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Active Session State</span>
            <span className={`font-bold ${hasActiveData ? 'text-emerald-400' : 'text-slate-300'}`}>
              {hasActiveData ? `Dataset Loaded (${totalUrlsCount} URLs)` : 'Pre-Crawl Ready'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Audit Engine</span>
            <span className="font-bold text-white">Playwright + Synthetic DOM</span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Target Domain</span>
            <span className="font-bold text-slate-200 truncate block">
              {activeDomain || 'togo-evisa.com (Demo)'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Tools (12)' },
            { id: 'seo', label: 'SEO & Sitemaps' },
            { id: 'localization', label: 'Localization' },
            { id: 'qa', label: 'Frontend QA' },
            { id: 'assets', label: 'Media & Assets' },
            { id: 'crawler', label: 'Crawl & Extract' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as ToolCategory)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search tools, checks, metrics..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
          />
        </div>
      </div>

      {/* Tool Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTools.map((tool) => {
          const IconComponent = tool.icon;
          return (
            <div
              key={tool.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
            >
              <div className="p-5 space-y-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {tool.number}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {tool.categoryLabel}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {tool.title}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Subtitle & Description */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-1">{tool.subtitle}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{tool.description}</p>
                </div>

                {/* Check list / Capabilities */}
                <div className="space-y-1.5 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Core Inspection Points:
                  </span>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                    {tool.metrics.map((metric, idx) => (
                      <div key={idx} className="flex items-center space-x-1.5 truncate">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{metric}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5">
                  {tool.supportsExclusionModal && (
                    <button
                      type="button"
                      onClick={() => handleOpenExclusion(tool.toolId)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                      title="Configure tool exclusion rules"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline text-[11px]">Rules</span>
                    </button>
                  )}

                  {tool.supportsTool6Modal && (
                    <button
                      type="button"
                      onClick={() => setIsTool6ModalOpen(true)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                      title="Configure Tool 6 settings"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline text-[11px]">Settings</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleLaunchTool(tool)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center space-x-1.5 transition-all cursor-pointer group-hover:bg-emerald-600"
                >
                  <span>Open Tool</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Exclusions Modal */}
      <ToolExclusionSettingsModal
        isOpen={isExclusionModalOpen}
        onClose={() => setIsExclusionModalOpen(false)}
        toolId={selectedExclusionTool}
        toolName={
          tools.find((t) => (t as any).toolId === selectedExclusionTool)?.title || selectedExclusionTool
        }
        domain={activeDomain || 'default'}
      />

      {/* Tool 6 Settings Modal */}
      <Tool6SettingsModal
        isOpen={isTool6ModalOpen}
        onClose={() => setIsTool6ModalOpen(false)}
        domain={activeDomain || 'default'}
      />
    </div>
  );
};
