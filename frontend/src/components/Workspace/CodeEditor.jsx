import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { EditorView } from '@codemirror/view';

const FONT_SIZE_MAP = {
  small: 14,
  medium: 18,
  large: 24
};

const CodeEditor = ({ value, onChange, fileName, readOnly = false, fontSize = 'medium', onFontSizeChange }) => {
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

  return (
    <div className="h-full w-full overflow-hidden flex flex-col bg-[#1e1e1e]">
      {/* 编辑器顶栏（展示当前激活文件名） */}
      <div className="px-4 py-2 bg-[#252526] text-xs text-gray-400 border-b border-[#2d2d2d] font-mono select-none flex items-center justify-between gap-3">
        <span className="truncate">{fileName || '无打开的文件'}</span>
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
      </div>
      
      {/* 代码编辑区 */}
      <div className="flex-1 overflow-auto text-sm">
        <CodeMirror
          value={value || ''}
          height="100%"
          theme={vscodeDark}
          extensions={[...getLanguageExtension(fileName), editorFontTheme]}
          editable={!readOnly}
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
