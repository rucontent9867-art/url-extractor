import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header, MainNavTab } from './components/Header';
import { CrawlForm } from './components/CrawlForm';
import { CrawlProgress } from './components/CrawlProgress';
import { CrawlSummary } from './components/CrawlSummary';
import { LanguageFilter } from './components/LanguageFilter';
import { ResultsTable } from './components/ResultsTable';
import { LanguagesDashboard } from './components/LanguagesDashboard';
import { ValidationDashboard } from './components/validation/ValidationDashboard';
import { CrawlProgressMessage, CrawlSettings, CrawlStats, CrawlUrlItem } from './types';
import { copyUrlsToClipboard, downloadUrlsAsCsv } from './utils/exportUtils';
import { Globe, ShieldCheck, ArrowRight, Layers, ListOrdered, Compass, RefreshCw } from 'lucide-react';
import { fetchJson } from './utils/apiUtils';

const DEFAULT_SETTINGS: CrawlSettings = {
  maxPages: 10000,
  concurrency: 15,
  requestTimeout: 15,
  respectRobotsTxt: true,
  followRedirects: true,
  includeSubdomains: false,
  userAgent: 'Mozilla/5.0 (compatible; DomainCrawlerBot/1.0; +https://ai.studio)',
  confidenceThreshold: 90,
  ignoredSlugs: ['community'],
};

const INITIAL_STATS: CrawlStats = {
  crawlId: '',
  domain: '',
  normalizedDomain: '',
  status: 'idle',
  pagesCrawled: 0,
  uniqueUrlsCount: 0,
  queueRemaining: 0,
  currentUrl: '',
  duplicatesRemoved: 0,
  assetsIgnored: 0,
  externalUrlsIgnored: 0,
  failedRequests: 0,
  languagesDetected: 0,
  languageCounts: {},
};

export default function App() {
  const [urlInput, setUrlInput] = useState('https://kenya-eta.info/');
  const [settings, setSettings] = useState<CrawlSettings>(DEFAULT_SETTINGS);
  const [activeCrawlId, setActiveCrawlId] = useState<string | null>(null);
  const [stats, setStats] = useState<CrawlStats>(INITIAL_STATS);
  const [items, setItems] = useState<CrawlUrlItem[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [liveMessage, setLiveMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [serverHealthy, setServerHealthy] = useState<boolean | null>(null);
  const [copiedAllFeedback, setCopiedAllFeedback] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState<MainNavTab>('crawler');

  const eventSourceRef = useRef<EventSource | null>(null);

  // Check backend server health and load persistent settings on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data?.status === 'ok') {
          setServerHealthy(true);
        } else {
          setServerHealthy(false);
        }
      })
      .catch(() => setServerHealthy(false));

    fetch('/api/settings/ignored-slugs')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.ignoredSlugs)) {
          setSettings((prev) => ({
            ...prev,
            ignoredSlugs: data.ignoredSlugs,
          }));
        }
      })
      .catch(() => {});

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Connect SSE for streaming active crawl updates
  const connectStream = (crawlId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sse = new EventSource(`/api/crawl/stream/${crawlId}`);
    eventSourceRef.current = sse;

    sse.onmessage = (e) => {
      try {
        const data: CrawlProgressMessage = JSON.parse(e.data);
        if (data.stats) {
          setStats(data.stats);
        }
        if (data.message) {
          setLiveMessage(data.message);
        }

        if (data.newItems && data.newItems.length > 0) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.url));
            const freshItems = data.newItems!.filter((item) => !existingIds.has(item.url));
            return [...prev, ...freshItems];
          });
        }

        if (data.type === 'completed' || data.type === 'stopped' || data.type === 'error') {
          sse.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        console.error('Failed to parse SSE event data:', err);
      }
    };

    sse.onerror = () => {
      // If error occurs, fallback poll results once
      fetch(`/api/crawl/results/${crawlId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.items) {
            setItems(data.items);
          }
          if (data.stats) {
            setStats(data.stats);
          }
        })
        .catch(() => {});
    };
  };

  const handleReloadResults = async () => {
    if (!activeCrawlId) return;
    try {
      const data = await fetchJson<{ items?: CrawlUrlItem[]; stats?: CrawlStats }>(
        `/api/crawl/results/${activeCrawlId}`
      );
      if (data.items) {
        setItems(data.items);
      }
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to reload results:', err);
    }
  };

  const handleStartCrawl = async () => {
    if (!urlInput.trim()) return;

    setErrorMessage('');
    setItems([]);
    setSelectedLanguage('all');
    setLiveMessage('Starting crawl session...');
    setActiveNavTab('crawler');

    try {
      const data = await fetchJson<{ crawlId: string; stats?: CrawlStats }>('/api/crawl/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: urlInput.trim(),
          settings,
        }),
      });

      setActiveCrawlId(data.crawlId);
      if (data.stats) {
        setStats(data.stats);
      }

      connectStream(data.crawlId);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while launching crawler.');
      setStats((prev) => ({ ...prev, status: 'error' }));
    }
  };

  const handleStopCrawl = async () => {
    if (!activeCrawlId) return;

    try {
      await fetch(`/api/crawl/stop/${activeCrawlId}`, { method: 'POST' });
      setLiveMessage('Stopping crawl...');
    } catch (err) {
      console.error('Failed to stop crawl:', err);
    }
  };

  const handleClear = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setActiveCrawlId(null);
    setStats(INITIAL_STATS);
    setItems([]);
    setSelectedLanguage('all');
    setLiveMessage('');
    setErrorMessage('');
    setActiveNavTab('crawler');
  };

  const handleRecrawl = () => {
    handleClear();
    setTimeout(() => {
      handleStartCrawl();
    }, 100);
  };

  // Filter items by language
  const filteredByLanguage = useMemo(() => {
    if (selectedLanguage === 'all') return items;
    return items.filter((item) => item.langCode === selectedLanguage);
  }, [items, selectedLanguage]);

  const selectedLanguageName = useMemo(() => {
    if (selectedLanguage === 'all') return 'All';
    const info = stats.languageCounts[selectedLanguage];
    return info ? info.name : selectedLanguage;
  }, [selectedLanguage, stats.languageCounts]);

  const handleCopyAll = async () => {
    const success = await copyUrlsToClipboard(filteredByLanguage);
    if (success) {
      setCopiedAllFeedback(true);
      setTimeout(() => setCopiedAllFeedback(false), 2500);
    }
  };

  const handleDownloadCsv = () => {
    downloadUrlsAsCsv(filteredByLanguage, `urls-${stats.hostname || 'site'}-${selectedLanguage}.csv`);
  };

  const isCrawling = stats.status === 'crawling' || stats.status === 'discovering_sitemaps';
  const hasFinished = stats.status === 'completed' || stats.status === 'stopped' || stats.status === 'error';

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col antialiased selection:bg-emerald-100 selection:text-emerald-900">
      <Header
        serverHealthy={serverHealthy}
        activeTab={activeNavTab}
        onSelectTab={setActiveNavTab}
        totalUrls={items.length}
        languagesCount={stats.languagesDetected}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* TAB 1: CRAWLER */}
        {activeNavTab === 'crawler' && (
          <div className="space-y-6">
            {/* URL Input and Launch Form */}
            <CrawlForm
              urlInput={urlInput}
              setUrlInput={setUrlInput}
              status={stats.status}
              settings={settings}
              setSettings={setSettings}
              onStartCrawl={handleStartCrawl}
              onStopCrawl={handleStopCrawl}
              errorMessage={errorMessage}
            />

            {/* Live Crawling Progress Indicator */}
            {isCrawling && (
              <CrawlProgress
                stats={stats}
                liveMessage={liveMessage}
                onStop={handleStopCrawl}
              />
            )}

            {/* Finished Crawl Summary Banner */}
            {hasFinished && stats.pagesCrawled > 0 && (
              <CrawlSummary
                stats={stats}
                onRecrawl={handleRecrawl}
                onClear={handleClear}
                onCopyAll={handleCopyAll}
                onDownloadCsv={handleDownloadCsv}
                onStartValidation={() => setActiveNavTab('validation')}
                copied={copiedAllFeedback}
              />
            )}

            {/* If items found, provide a quick gateway to URLs or Validation */}
            {items.length > 0 && !isCrawling && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => setActiveNavTab('urls')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <ListOrdered className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        View All Discovered URLs ({items.length})
                      </h4>
                      <p className="text-xs text-slate-500">
                        Filter by language, search canonical paths, inspect source and export data.
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
                </div>

                <div
                  onClick={() => setActiveNavTab('validation')}
                  className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950 group-hover:text-emerald-700 transition-colors">
                        Run Stage 2: SEO & Localization Validation
                      </h4>
                      <p className="text-xs text-emerald-800/80">
                        Check sitemap coverage, detect missing translations, and audit content languages.
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-emerald-600 group-hover:text-emerald-950 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            )}

            {/* Initial Empty State / Instructions Guide */}
            {items.length === 0 && !isCrawling && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 sm:p-12 text-center max-w-3xl mx-auto space-y-6">
                <div className="h-16 w-16 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                  <Globe className="h-8 w-8" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    Ready to Crawl Any Website & Extract Webpage URLs
                  </h2>
                  <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
                    Enter any domain above. The crawler automatically inspects sitemaps (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">sitemap.xml</code>, <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">robots.txt</code>) and recursively crawls same-domain HTML links, removing duplicates, unwanted media assets, and sorting by language.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-4 border-t border-slate-100">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800 mb-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Sitemap + BFS Crawl</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-normal">
                      Discovers URLs from both XML sitemaps and recursively visited internal hyperlinks for comprehensive coverage.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800 mb-1">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span>Strict File Filtration</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-normal">
                      Excludes images, PDFs, docs, media, CSS, JS, fonts, and tracking parameters, returning clean webpage URLs only.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800 mb-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span>Auto Language Grouping</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-normal">
                      Detects path prefixes like <code className="font-mono text-[11px]">/fr/</code>, <code className="font-mono text-[11px]">/de/</code>, and groups root pages into <code className="font-mono text-[11px]">Default / English</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: URLS RESULTS TABLE */}
        {activeNavTab === 'urls' && (
          <div className="space-y-6">
            {items.length > 0 ? (
              <>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
                  <LanguageFilter
                    selectedLanguage={selectedLanguage}
                    onSelectLanguage={setSelectedLanguage}
                    languageCounts={stats.languageCounts}
                    totalCount={items.length}
                  />
                </div>

                <ResultsTable
                  items={filteredByLanguage}
                  selectedLanguageName={selectedLanguageName}
                  onClearResults={handleClear}
                />
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <div className="max-w-md mx-auto space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                    <ListOrdered className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">No Discovered URLs Yet</h3>
                  <p className="text-xs text-slate-500">
                    Start a crawl in the Crawler tab to extract and index all valid internal webpage URLs.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveNavTab('crawler')}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center space-x-1.5"
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>Go to Crawler</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LANGUAGES DASHBOARD */}
        {activeNavTab === 'languages' && (
          <div className="space-y-6">
            {items.length > 0 ? (
              <LanguagesDashboard
                items={items}
                stats={stats}
                onSelectLanguage={(langCode) => {
                  setSelectedLanguage(langCode);
                  setActiveNavTab('urls');
                }}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <div className="max-w-md mx-auto space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                    <Layers className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">No Language Data Available</h3>
                  <p className="text-xs text-slate-500">
                    Perform a crawl to view the breakdown of detected languages, locale percentages, and targeted exports.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveNavTab('crawler')}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center space-x-1.5"
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>Go to Crawler</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: VALIDATION DASHBOARD */}
        {activeNavTab === 'validation' && (
          <div className="space-y-6">
            <ValidationDashboard
              crawlId={activeCrawlId}
              crawlStats={stats}
              onValidationComplete={handleReloadResults}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 mt-12 text-center text-xs text-slate-400">
        <p>
          Domain URL Crawler & SEO/Localization Validator • Reusable dataset • Canonical path alignment • Text language verification
        </p>
      </footer>
    </div>
  );
}
