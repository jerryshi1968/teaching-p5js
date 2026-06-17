import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

const CodeEditor = ({ value, onChange, fileName, readOnly = false }) => {
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

  return (
    <div className="h-full w-full overflow-hidden flex flex-col bg-[#1e1e1e]">
      {/* 编辑器顶栏（展示当前激活文件名） */}
      <div className="px-4 py-2 bg-[#252526] text-xs text-gray-400 border-b border-[#2d2d2d] font-mono select-none">
        {fileName || '无打开的文件'}
      </div>
      
      {/* 代码编辑区 */}
      <div className="flex-1 overflow-auto text-sm">
        <CodeMirror
          value={value || ''}
          height="100%"
          theme={vscodeDark}
          extensions={getLanguageExtension(fileName)}
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
