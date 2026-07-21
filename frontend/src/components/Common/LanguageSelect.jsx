import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

const LanguageSelect = ({ className = '' }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <label data-i18n-skip className={`inline-flex items-center gap-2 rounded-2xl border-2 border-white/70 bg-white/85 px-3 py-2 text-xs font-black text-slate-600 shadow-sm backdrop-blur ${className}`}>
      <Languages className="h-4 w-4 text-indigo-500" />
      <span>{language === 'en' ? 'Language' : '语言'}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        aria-label={language === 'en' ? 'Language' : '语言'}
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
    </label>
  );
};

export default LanguageSelect;
