import React, { useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { EditorView } from '@codemirror/view';
import { Check, Copy, HelpCircle, Palette, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

const FONT_SIZE_MAP = {
  small: 14,
  medium: 18,
  large: 24
};

const CodeEditor = ({ value, onChange, fileName, readOnly = false, fontSize = 'medium', onFontSizeChange }) => {
  const { language } = useLanguage();
  const editorViewRef = useRef(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#ffcc00');
  const [copySuccess, setCopySuccess] = useState(false);

  // 根据文件名动态匹配对应的 CodeMirror 6 语言插件
  const getLanguageExtension = (name) => {
    if (!name) return [];
    if (name.endsWith('.js')) {
      return [javascript({ jsx: true })];
    }
    if (name.endsWith('.html') || name.endsWith('.htm')) {
      return [html()];
    }
    if (name.endsWith('.css')) {
      return [css()];
    }
    return [];
  };

  const resolvedFontSize = FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP.medium;
  const editorFontTheme = EditorView.theme({
    '&': {
      fontSize: `${resolvedFontSize}px`
    },
    '.cm-content': {
      fontSize: `${resolvedFontSize}px`
    },
    '.cm-gutters': {
      fontSize: `${Math.max(12, resolvedFontSize - 1)}px`
    }
  });
  const selectedColorRgb = (() => {
    const red = parseInt(selectedColor.slice(1, 3), 16);
    const green = parseInt(selectedColor.slice(3, 5), 16);
    const blue = parseInt(selectedColor.slice(5, 7), 16);
    return `rgb(${red}, ${green}, ${blue})`;
  })();

  const handleCopyColor = async () => {
    try {
      await navigator.clipboard.writeText(selectedColor);
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 1200);
    } catch (err) {
      setCopySuccess(false);
    }
  };

  const handleSelectedColorChange = (nextColor) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(nextColor)) return;

    setSelectedColor(nextColor);
  };

  const handleInsertColor = () => {
    const editorView = editorViewRef.current;
    if (!editorView || readOnly) return;

    const selection = editorView.state.selection.main;
    editorView.dispatch({
      changes: { from: selection.from, to: selection.to, insert: selectedColor },
      selection: { anchor: selection.from + selectedColor.length },
      scrollIntoView: true
    });
    editorView.focus();
    setColorPickerOpen(false);
  };

  const handleOpenHelp = () => {
    window.open(`/teaching-p5js/help/?lang=${language}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-full w-full overflow-hidden flex flex-col bg-[#1e1e1e]">
      {/* 编辑器顶栏（展示当前激活文件名） */}
      <div className="px-4 py-2 bg-[#252526] text-xs text-gray-400 border-b border-[#2d2d2d] font-mono select-none flex items-center justify-between gap-3">
        <span className="truncate">{fileName || '无打开的文件'}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setColorPickerOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] text-gray-400 transition hover:bg-[#2d2d2d] hover:text-gray-100"
            title="Color picker"
          >
            <Palette className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] p-0.5">
          {[
            { key: 'small', label: '小' },
            { key: 'medium', label: '中' },
            { key: 'large', label: '大' }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onFontSizeChange && onFontSizeChange(item.key)}
              className={`rounded-md px-2 py-1 text-[11px] font-black transition ${
                fontSize === item.key
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-400 hover:bg-[#2d2d2d] hover:text-gray-100'
              }`}
              title={`${item.label}字号`}
            >
              {item.label}
            </button>
          ))}
          </div>
          <button
            type="button"
            onClick={handleOpenHelp}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] text-gray-400 transition hover:bg-[#2d2d2d] hover:text-gray-100"
            title="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* 代码编辑区 */}
      {colorPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#252526] p-4 text-slate-100 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black">
                <Palette className="h-4 w-4 text-amber-300" />
                <span>Color Picker</span>
              </div>
              <button
                type="button"
                onClick={() => setColorPickerOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-[#333333] hover:text-white"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <input
                type="color"
                value={selectedColor}
                onChange={(event) => setSelectedColor(event.target.value)}
                className="h-16 w-20 cursor-pointer rounded-xl border-2 border-slate-600 bg-transparent p-1"
                title="Pick color"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="text"
                  value={selectedColor}
                  onChange={(event) => handleSelectedColorChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-600 bg-[#1e1e1e] px-3 py-2 font-mono text-sm font-bold text-slate-100 outline-none focus:border-indigo-400"
                  maxLength={7}
                />
                <div className="truncate rounded-lg bg-[#1e1e1e] px-3 py-1.5 font-mono text-xs text-slate-400">
                  {selectedColorRgb}
                </div>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-slate-700 bg-[#1e1e1e] p-3">
              <div className="mb-2 h-12 rounded-lg border border-slate-600" style={{ backgroundColor: selectedColor }} />
              <div className="space-y-1 font-mono text-[11px] text-slate-400">
                <div>fill('{selectedColor}');</div>
                <div>stroke('{selectedColor}');</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCopyColor}
                className="flex items-center gap-1.5 rounded-xl border border-slate-600 bg-[#1e1e1e] px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-[#333333]"
              >
                {copySuccess ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copySuccess ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={handleInsertColor}
                disabled={readOnly}
                className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-black text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Insert Color
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto text-sm">
        <CodeMirror
          value={value || ''}
          height="100%"
          theme={vscodeDark}
          extensions={[...getLanguageExtension(fileName), editorFontTheme]}
          editable={!readOnly}
          onCreateEditor={(view) => {
            editorViewRef.current = view;
          }}
          onChange={(val) => onChange && onChange(val)}
          placeholder="// 在这里编写您的代码..."
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;
