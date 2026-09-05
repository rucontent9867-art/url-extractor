import React from 'react';
import { CrawlStats, CrawlUrlItem, LanguageInfo } from '../types';
import { Globe2, Copy, Download, ExternalLink, FileText, FileSpreadsheet } from 'lucide-react';
import {
  copyUrlsToClipboard,
  downloadUrlsAsCsv,
  downloadUrlsAsTxt,
} from '../utils/exportUtils';

interface LanguagesDashboardProps {
  items: CrawlUrlItem[];
  stats: CrawlStats;
  onSelectLanguage: (langCode: string) => void;
}

export const LanguagesDashboard: React.FC<LanguagesDashboardProps> = ({
  items,
  stats,
  onSelectLanguage,
}) => {
  const rawList = stats.languageCounts ? (Object.values(stats.languageCounts) as LanguageInfo[]) : [];
  const languageList: LanguageInfo[] = rawList.sort((a, b) => b.count - a.count);
  const totalUrls = items.length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Detected Language Distribution</h2>
            <p className="text-xs text-slate-500 mt-1">
              Discovered {stats.languagesDetected} language locales across {totalUrls} indexed webpage URLs.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700">
              Total Languages: {stats.languagesDetected}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {languageList.map((lang) => {
            const langItems = items.filter((i) => i.langCode === lang.code);
            const percentage = totalUrls > 0 ? ((lang.count / totalUrls) * 100).toFixed(1) : '0';

            return (
              <div
                key={lang.code}
                className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all bg-slate-50/50 hover:bg-white"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">{lang.name}</span>
                      <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                        {lang.code}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {lang.count} URLs ({percentage}%)
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-3 overflow-hidden">
                  <div
                    className="bg-slate-900 h-1.5 rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200/60 text-xs">
                  <button
                    type="button"
                    onClick={() => onSelectLanguage(lang.code)}
                    className="font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center space-x-1"
                  >
                    <span>View URLs</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => copyUrlsToClipboard(langItems)}
                      className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                      title="Copy all URLs in this language"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadUrlsAsTxt(langItems, `${lang.code}-urls.txt`)}
                      className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                      title="Download URLs as TXT"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadUrlsAsCsv(langItems, `${lang.code}-urls.csv`)}
                      className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                      title="Download URLs as CSV"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
