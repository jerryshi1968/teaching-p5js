import React, { useRef } from 'react';
import {
  Bot,
  Check,
  FileCode2,
  FilePlus2,
  Folder,
  FolderPlus,
  Image,
  Loader2,
  Music,
  Pencil,
  Trash2,
  Upload,
  Video,
  X
} from 'lucide-react';

const getDepth = (filePath) => {
  const clean = filePath.replace(/^\.\//, '');
  if (!clean) return 0;
  return clean.split('/').length - 1;
};

const getFileIcon = (file) => {
  if (file.isDirectory) return <Folder className="w-4 h-4 text-amber-500 shrink-0" />;

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return <Image className="w-4 h-4 text-emerald-500 shrink-0" />;
  }
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return <Music className="w-4 h-4 text-rose-500 shrink-0" />;
  }
  if (['mp4', 'webm', 'mov'].includes(ext)) {
    return <Video className="w-4 h-4 text-purple-500 shrink-0" />;
  }
  return <FileCode2 className="w-4 h-4 text-indigo-400 shrink-0" />;
};

const FileTree = ({
  files,
  activeFileId,
  canEdit,
  onSelect,
  onCreateFile,
  onCreateFolder,
  onUpload,
  onRename,
  onDelete,
  aiMessages = [],
  aiInput,
  aiLoading,
  aiPending,
  onAiInputChange,
  onAiSubmit,
  onAiApply,
  onAiCancel
}) => {
  const inputRef = useRef(null);

  const sortedFiles = [...files].sort((a, b) => {
    const aDepth = getDepth(a.path);
    const bDepth = getDepth(b.path);
    if (aDepth !== bDepth) return a.path.localeCompare(b.path);
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const handleUploadClick = () => {
    if (!canEdit) return;
    inputRef.current?.click();
  };

  const handleUploadChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
    }
    event.target.value = '';
  };

  const handleAiKeyDown = (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      if (!canEdit || aiLoading || !aiInput.trim()) return;
      onAiSubmit(event);
    }
  };

  const toolButtonClass = 'p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="w-64 bg-slate-100 border-r-4 border-slate-200/60 flex flex-col select-none">
      <div className="px-3 py-3 border-b-2 border-slate-200/50">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-slate-500">项目文件</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCreateFile}
              disabled={!canEdit}
              className={`${toolButtonClass} hover:text-indigo-600`}
              title={canEdit ? '新建文本文件' : '只读模式不能新建文件'}
            >
              <FilePlus2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onCreateFolder}
              disabled={!canEdit}
              className={`${toolButtonClass} hover:text-amber-600`}
              title={canEdit ? '新建文件夹' : '只读模式不能新建文件夹'}
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={!canEdit}
              className={`${toolButtonClass} hover:text-emerald-600`}
              title={canEdit ? '上传文件' : '只读模式不能上传文件'}
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={handleUploadChange} />
      </div>

      <div className="h-[190px] py-2 overflow-y-auto border-b-2 border-slate-200/50">
        {sortedFiles.map((file) => {
          const isActive = activeFileId === file.id;
          const isProtected = file.path === './index.html';
          const actionDisabled = !canEdit || isProtected;

          return (
            <div
              key={file.id}
              className={`group mx-2 mb-1 flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition ${
                isActive
                  ? 'bg-indigo-100 border-indigo-200 text-indigo-950'
                  : 'bg-white/70 border-transparent text-slate-600 hover:border-slate-200'
              }`}
              style={{ paddingLeft: `${8 + getDepth(file.path) * 14}px` }}
            >
              <button
                type="button"
                onClick={() => onSelect(file)}
                className="min-w-0 flex-1 flex items-center gap-2 text-left"
                title={file.path}
              >
                {getFileIcon(file)}
                <span className="truncate font-bold">{file.name}</span>
              </button>

              <button
                type="button"
                onClick={() => onRename(file)}
                disabled={actionDisabled}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed"
                title={isProtected ? 'index.html 不能重命名' : canEdit ? '重命名' : '只读模式不能重命名'}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(file)}
                disabled={actionDisabled}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 disabled:opacity-20 disabled:cursor-not-allowed"
                title={isProtected ? 'index.html 不能删除' : canEdit ? '删除' : '只读模式不能删除'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 flex flex-col bg-slate-50">
        <div className="px-3 py-2 border-b border-slate-200/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-600">
            <Bot className="w-4 h-4 text-indigo-500" />
            <span>AI助手</span>
          </div>
          {aiPending && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onAiApply}
                disabled={!canEdit || aiLoading}
                className="p-1 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="应用AI修改"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onAiCancel}
                disabled={aiLoading}
                className="p-1 rounded-md bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="取消AI修改"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
          {aiMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-[11px] leading-5 font-bold text-slate-400 px-2">
              输入想让 AI 修改的效果，确认后才会写入代码。
            </div>
          ) : (
            aiMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg border px-2.5 py-2 text-[11px] leading-5 font-bold whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'bg-indigo-50 border-indigo-100 text-indigo-900'
                    : message.role === 'error'
                      ? 'bg-rose-50 border-rose-100 text-rose-700'
                      : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {message.content}
              </div>
            ))
          )}
        </div>

        <form onSubmit={onAiSubmit} className="p-2 border-t border-slate-200/70 bg-slate-100">
          <div className="relative">
            <textarea
              value={aiInput}
              onChange={(event) => onAiInputChange(event.target.value)}
              onKeyDown={handleAiKeyDown}
              disabled={!canEdit || aiLoading}
              rows={4}
              className="min-h-[68px] max-h-28 w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-300 disabled:opacity-60"
              placeholder={canEdit ? '描述要修改的代码，按 Ctrl+Enter 发送给AI' : '只读模式不能使用AI修改'}
            />
            {aiLoading && (
              <Loader2 className="absolute bottom-2 right-2 w-4 h-4 animate-spin text-indigo-500" />
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default FileTree;
