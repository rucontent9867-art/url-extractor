import React from 'react';
import { LanguageInfo } from '../types';
import { Globe } from 'lucide-react';

interface LanguageFilterProps {
  selectedLanguage: string; // 'all' or specific langCode
  onSelectLanguage: (langCode: string) => void;
  languageCounts: Record<string, LanguageInfo>;
  totalCount: number;
}

export const LanguageFilter: React.FC<LanguageFilterProps> = ({
  selectedLanguage,
  onSelectLanguage,
  languageCounts,
  totalCount,
}) => {
  // Sort languages: Default/English first, then others by highest count
  const rawLangs = languageCounts ? (Object.values(languageCounts) as LanguageInfo[]) : [];
  const sortedLanguages: LanguageInfo[] = rawLangs.sort((a, b) => {
    if (a.code === 'default') return -1;
    if (b.code === 'default') return 1;
    return b.count - a.count;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Globe className="h-3.5 w-3.5 text-slate-400" />
        <span>Filter by Discovered Language:</span>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {/* All URLs Tab */}
        <button
          type="button"
          onClick={() => onSelectLanguage('all')}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            selectedLanguage === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>All URLs</span>
          <span
            className={`px-1.5 py-0.2 rounded-md text-[11px] font-mono ${
              selectedLanguage === 'all'
                ? 'bg-slate-800 text-slate-200'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {totalCount.toLocaleString()}
          </span>
        </button>

        {/* Dynamic Discovered Languages */}
        {sortedLanguages.map((lang) => {
          const isSelected = selectedLanguage === lang.code;

          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onSelectLanguage(lang.code)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{lang.displayName}</span>
              <span
                className={`px-1.5 py-0.2 rounded-md text-[11px] font-mono ${
                  isSelected
                    ? 'bg-emerald-800 text-emerald-100'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {lang.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
