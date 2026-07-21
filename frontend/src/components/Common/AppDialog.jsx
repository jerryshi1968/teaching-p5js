import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Pencil, X } from 'lucide-react';

const iconMap = {
  alert: CheckCircle2,
  confirm: HelpCircle,
  danger: AlertTriangle,
  prompt: Pencil
};

const toneMap = {
  alert: {
    iconWrap: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    confirm: 'bg-emerald-400 hover:bg-emerald-300 border-emerald-600 text-emerald-950'
  },
  confirm: {
    iconWrap: 'bg-indigo-100 text-indigo-600 border-indigo-200',
    confirm: 'bg-indigo-400 hover:bg-indigo-300 border-indigo-600 text-white'
  },
  danger: {
    iconWrap: 'bg-rose-100 text-rose-600 border-rose-200',
    confirm: 'bg-rose-400 hover:bg-rose-300 border-rose-600 text-white'
  },
  prompt: {
    iconWrap: 'bg-amber-100 text-amber-600 border-amber-200',
    confirm: 'bg-amber-400 hover:bg-amber-300 border-amber-600 text-amber-950'
  }
};

const AppDialog = ({ options, onResolve }) => {
  const [inputValue, setInputValue] = useState(options?.defaultValue || '');

  useEffect(() => {
    setInputValue(options?.defaultValue || '');
  }, [options]);

  useEffect(() => {
    if (!options) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onResolve(options.type === 'alert' ? true : null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onResolve, options]);

  if (!options) return null;

  const type = options.type || 'confirm';
  const tone = options.tone || type;
  const Icon = iconMap[tone] || iconMap[type] || HelpCircle;
  const styles = toneMap[tone] || toneMap[type] || toneMap.confirm;
  const confirmText = options.confirmText || (type === 'alert' ? '知道啦' : '确定');
  const cancelText = options.cancelText || '取消';

  const handleConfirm = () => {
    if (type === 'prompt') {
      onResolve(inputValue);
      return;
    }

    onResolve(true);
  };

  const handleCancel = () => {
    onResolve(type === 'alert' ? true : null);
  };

  return (
    <div data-i18n-skip={options.disableAutoTranslate ? '' : undefined} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border-4 border-white bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.20)]">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 ${styles.iconWrap}`}>
            <Icon className="h-6 w-6 stroke-[3px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-black text-slate-800">{options.title}</h2>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-full p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
                aria-label="关闭弹框"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            {options.message && (
              <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-slate-500">{options.message}</p>
            )}
            {options.highlight && (
              <div className="mt-3 rounded-2xl border-2 border-dashed border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm font-black text-indigo-950">
                {options.highlight}
              </div>
            )}
            {type === 'prompt' && (
              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
                className="mt-4 block w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                placeholder={options.placeholder || ''}
              />
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          {type !== 'alert' && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-2xl border-2 border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-black text-slate-500 transition hover:bg-slate-200"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className={`rounded-2xl border-b-4 px-5 py-2.5 text-sm font-black shadow-sm transition-all active:translate-y-1 active:border-b-0 ${styles.confirm}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppDialog;
