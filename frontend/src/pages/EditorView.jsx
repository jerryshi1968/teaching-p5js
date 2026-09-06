import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Split from 'react-split';
import { BookOpen, ChevronDown, ChevronLeft, ExternalLink, Loader2, Play, Save, Sparkles, Wand2 } from 'lucide-react';
import CodeEditor from '../components/Workspace/CodeEditor';
import FileTree from '../components/Workspace/FileTree';
import ContactTeacherButton from '../components/Common/ContactTeacherButton';
import { useAppDialog } from '../hooks/useAppDialog';
import { useLanguage } from '../i18n/LanguageContext';
import { deleteEditorDraft, deleteProjectDrafts, loadEditorDrafts, saveEditorDraft, saveEmergencyEditorDraft } from '../services/editorDraftStore';

const TEXT_EXTENSIONS = ['.html', '.htm', '.css', '.js', '.txt'];
const CODE_FONT_SIZE_KEY = 'teaching_editor_code_font_size';
const CODE_FONT_SIZES = ['small', 'medium', 'large'];
const AI_TARGET_FILES = ['index.html', 'style.css', 'sketch.js'];
const AI_IMAGE_MAX_EDGE = 1200;
const AI_IMAGE_MAX_SIZE = 2 * 1024 * 1024;
const AI_IMAGE_MAX_COUNT = 3;
const AI_IMAGE_QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.42];
const AUTO_SAVE_DELAY = 700;
const DRAFT_SAVE_DELAY = 250;

const isEditableTextFile = (file) => file && !file.isDirectory && file.isText;
const getFileKey = (fileId) => String(fileId);

const getParentPath = (file) => {
  if (!file) return '.';
  if (file.isDirectory) return file.path;

  const cleanPath = file.path.replace(/^\.\//, '');
  const parts = cleanPath.split('/');
  parts.pop();
  return parts.length === 0 ? '.' : `./${parts.join('/')}`;
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const loadImageFromFile = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve(image);
  };
  image.onerror = (err) => {
    URL.revokeObjectURL(url);
    reject(err);
  };
  image.src = url;
});

const canvasToBlob = (canvas, mimeType, quality) => new Promise((resolve) => {
  canvas.toBlob(resolve, mimeType, quality);
});

const compressImageForAi = async (file) => {
  const image = await loadImageFromFile(file);
  const scale = Math.min(1, AI_IMAGE_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  context.drawImage(image, 0, 0, width, height);

  for (const quality of AI_IMAGE_QUALITIES) {
    const blob = await canvasToBlob(canvas, 'image/webp', quality);
    if (blob && blob.size <= AI_IMAGE_MAX_SIZE) {
      const dataUrl = await readFileAsDataUrl(blob);
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name || 'pasted-image.webp',
        mimeType: blob.type || 'image/webp',
        dataUrl,
        size: blob.size,
        width,
        height
      };
    }
  }

  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  for (const quality of AI_IMAGE_QUALITIES) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= AI_IMAGE_MAX_SIZE) {
      const dataUrl = await readFileAsDataUrl(blob);
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name || 'pasted-image.jpg',
        mimeType: blob.type || 'image/jpeg',
        dataUrl,
        size: blob.size,
        width,
        height
      };
    }
  }

  throw new Error('图片压缩后仍超过 2MB，请裁剪或换一张更小的图片。');
};

const EditorView = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const appDialog = useAppDialog();
  const { language, isEnglish } = useLanguage();
  const iframeRef = useRef(null);
  const exampleMenuRef = useRef(null);
  const dashboardGroupId = location.state?.dashboardGroupId ?? null;
  const isVerticalLayout = new URLSearchParams(location.search).get('vertical') === '1';
  const isAutoRunEnabled = new URLSearchParams(location.search).get('autorun') !== '0';

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeFileId, setActiveFileId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [projectName, setProjectName] = useState('加载中...');
  const [canEdit, setCanEdit] = useState(false);
  const [coords, setCoords] = useState(null);
  const [aiInput, setAiInput] = useState('');
  const [aiImages, setAiImages] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [pendingAiFiles, setPendingAiFiles] = useState(null);
  const [examples, setExamples] = useState([]);
  const [examplesLoaded, setExamplesLoaded] = useState(false);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [examplesError, setExamplesError] = useState('');
  const [exampleMenuOpen, setExampleMenuOpen] = useState(false);
  const [importingExample, setImportingExample] = useState(false);
  const [dirtyFileIds, setDirtyFileIds] = useState(() => new Set());
  const [autoSaving, setAutoSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [codeFontSize, setCodeFontSize] = useState(() => {
    const savedSize = localStorage.getItem(CODE_FONT_SIZE_KEY);
    return CODE_FONT_SIZES.includes(savedSize) ? savedSize : 'medium';
  });
  const filesRef = useRef([]);
  const dirtyFileIdsRef = useRef(new Set());
  const fileVersionsRef = useRef(new Map());
  const saveQueuesRef = useRef(new Map());
  const draftQueuesRef = useRef(new Map());
  const draftTimersRef = useRef(new Map());
  const pendingDraftsRef = useRef(new Map());
  const activeAutoSaveCountRef = useRef(0);
  const autoSaveRetryDelayRef = useRef(AUTO_SAVE_DELAY);

  const activeFile = useMemo(
    () => files.find((file) => file.id === activeFileId) || null,
    [files, activeFileId]
  );

  const token = localStorage.getItem('teaching_token');

  const setDirtyFileKeys = (nextDirtyFileIds) => {
    dirtyFileIdsRef.current = nextDirtyFileIds;
    setDirtyFileIds(nextDirtyFileIds);
  };

  const addDirtyFileKeys = (fileIds) => {
    const nextDirtyFileIds = new Set(dirtyFileIdsRef.current);
    fileIds.forEach((fileId) => nextDirtyFileIds.add(getFileKey(fileId)));
    setDirtyFileKeys(nextDirtyFileIds);
  };

  const removeDirtyFileKeys = (fileIds) => {
    const nextDirtyFileIds = new Set(dirtyFileIdsRef.current);
    fileIds.forEach((fileId) => nextDirtyFileIds.delete(getFileKey(fileId)));
    setDirtyFileKeys(nextDirtyFileIds);
  };

  const buildEditorDraft = (file) => ({
    projectId,
    fileId: getFileKey(file.id),
    name: file.name,
    path: file.path,
    content: file.content || '',
    updatedAt: Date.now()
  });

  const queueDraftOperation = (fileId, operation) => {
    const fileKey = getFileKey(fileId);
    const previousOperation = draftQueuesRef.current.get(fileKey) || Promise.resolve();
    const nextOperation = previousOperation.catch(() => {}).then(operation);
    draftQueuesRef.current.set(fileKey, nextOperation);
    void nextOperation.finally(() => {
      if (draftQueuesRef.current.get(fileKey) === nextOperation) {
        draftQueuesRef.current.delete(fileKey);
      }
    }).catch(() => {});
    return nextOperation;
  };

  const flushPendingDraft = (fileId) => {
    const fileKey = getFileKey(fileId);
    const timer = draftTimersRef.current.get(fileKey);
    if (timer) {
      window.clearTimeout(timer);
      draftTimersRef.current.delete(fileKey);
    }

    const draft = pendingDraftsRef.current.get(fileKey);
    if (!draft) return Promise.resolve();

    pendingDraftsRef.current.delete(fileKey);
    return queueDraftOperation(fileKey, () => saveEditorDraft(draft));
  };

  const scheduleFileDraft = (file) => {
    const fileKey = getFileKey(file.id);
    const draft = buildEditorDraft(file);
    saveEmergencyEditorDraft(draft);
    pendingDraftsRef.current.set(fileKey, draft);

    const previousTimer = draftTimersRef.current.get(fileKey);
    if (previousTimer) window.clearTimeout(previousTimer);
    draftTimersRef.current.set(fileKey, window.setTimeout(() => {
      void flushPendingDraft(fileKey);
    }, DRAFT_SAVE_DELAY));
  };

  const deleteStoredDraft = (fileId, expectedVersion) => {
    const fileKey = getFileKey(fileId);
    const timer = draftTimersRef.current.get(fileKey);
    if (timer) window.clearTimeout(timer);
    draftTimersRef.current.delete(fileKey);
    pendingDraftsRef.current.delete(fileKey);

    return queueDraftOperation(fileKey, async () => {
      if (expectedVersion !== undefined && fileVersionsRef.current.get(fileKey) !== expectedVersion) return;
      await deleteEditorDraft(projectId, fileKey);
    });
  };

  const markFileDirty = (file) => {
    const fileKey = getFileKey(file.id);
    const nextVersion = (fileVersionsRef.current.get(fileKey) || 0) + 1;
    fileVersionsRef.current.set(fileKey, nextVersion);
    addDirtyFileKeys([fileKey]);
    scheduleFileDraft(file);
    autoSaveRetryDelayRef.current = AUTO_SAVE_DELAY;
    setSaveError('');
    return nextVersion;
  };

  const discardFileDrafts = async (fileIds) => {
    const fileKeys = fileIds.map(getFileKey);
    removeDirtyFileKeys(fileKeys);
    await Promise.all(fileKeys.map(async (fileKey) => {
      fileVersionsRef.current.delete(fileKey);
      await deleteStoredDraft(fileKey);
    }));
  };

  const discardAllProjectDrafts = async () => {
    const fileKeys = new Set([
      ...filesRef.current.map((file) => getFileKey(file.id)),
      ...dirtyFileIdsRef.current,
      ...pendingDraftsRef.current.keys()
    ]);
    setDirtyFileKeys(new Set());
    await Promise.all(Array.from(fileKeys).map(async (fileKey) => {
      fileVersionsRef.current.delete(fileKey);
      await deleteStoredDraft(fileKey);
    }));
    await deleteProjectDrafts(projectId);
  };

  const persistDirtyDrafts = () => {
    dirtyFileIdsRef.current.forEach((fileKey) => {
      const file = filesRef.current.find((item) => getFileKey(item.id) === fileKey);
      if (!isEditableTextFile(file)) return;

      const draft = buildEditorDraft(file);
      saveEmergencyEditorDraft(draft);
      pendingDraftsRef.current.set(fileKey, draft);
      void flushPendingDraft(fileKey);
    });
  };

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (dirtyFileIdsRef.current.size === 0) return;
      persistDirtyDrafts();
      event.preventDefault();
      event.returnValue = '';
    };

    const handlePageHide = () => persistDirtyDrafts();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistDirtyDrafts();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      persistDirtyDrafts();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleCodeFontSizeChange = (nextSize) => {
    if (!CODE_FONT_SIZES.includes(nextSize)) return;

    setCodeFontSize(nextSize);
    localStorage.setItem(CODE_FONT_SIZE_KEY, nextSize);
  };

  const handleBackToDashboard = async () => {
    if (dirtyFileIdsRef.current.size > 0) {
      const dirtyFiles = filesRef.current.filter((file) => dirtyFileIdsRef.current.has(getFileKey(file.id)));
      setSaving(true);
      try {
        await saveFilesToServer(dirtyFiles);
      } catch (err) {
        setSaveError(err.message);
        const shouldLeave = await appDialog.confirm({
          title: '代码尚未保存到服务器',
          message: `${err.message}\n\n浏览器草稿已经保留，是否仍然返回工作台？`,
          confirmText: '保留草稿并返回',
          cancelText: '继续编辑',
          tone: 'danger'
        });
        if (!shouldLeave) return;
      } finally {
        setSaving(false);
      }
    }

    navigate('/dashboard', { state: { dashboardGroupId } });
  };

  const getProjectPreviewUrl = () => (
    `/teaching-p5js/projects/${encodeURIComponent(projectId)}/index.html?t=${Date.now()}`
  );

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || `操作失败（HTTP ${response.status}），请稍后再试。`);
      error.status = response.status;
      throw error;
    }
    return data;
  };

  const loadProjectFiles = async ({ restoreDrafts = false, preserveDirty = true } = {}) => {
    const protectedFileIds = preserveDirty ? new Set(dirtyFileIdsRef.current) : new Set();
    const [projectResponse, fileResponse] = await Promise.all([
      fetch(`/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`/api/files/project/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    const projectData = await projectResponse.json().catch(() => ({}));
    const fileData = await fileResponse.json().catch(() => ({}));

    if (!projectResponse.ok) throw new Error(projectData.message || '哎呀，没有找到魔法文件包。');
    if (!fileResponse.ok) throw new Error(fileData.message || '哎呀，没有找到魔法文件。');

    setProjectName(projectData.name);
    setCanEdit(Boolean(projectData.canEdit));
    let nextFileData = fileData;

    if (preserveDirty) {
      dirtyFileIdsRef.current.forEach((fileKey) => protectedFileIds.add(fileKey));
      const localFilesById = new Map(filesRef.current.map((file) => [getFileKey(file.id), file]));
      nextFileData = fileData.map((file) => {
        const fileKey = getFileKey(file.id);
        const localFile = localFilesById.get(fileKey);
        return protectedFileIds.has(fileKey) && localFile
          ? { ...file, content: localFile.content }
          : file;
      });
    }

    if (restoreDrafts && projectData.canEdit) {
      const savedDrafts = await loadEditorDrafts(projectId);
      const serverFilesById = new Map(nextFileData.map((file) => [getFileKey(file.id), file]));
      const recoverableDrafts = savedDrafts.filter((draft) => {
        const serverFile = serverFilesById.get(getFileKey(draft.fileId));
        return isEditableTextFile(serverFile) && draft.content !== (serverFile.content || '');
      });
      const obsoleteDrafts = savedDrafts.filter((draft) => !recoverableDrafts.includes(draft));
      await Promise.all(obsoleteDrafts.map((draft) => deleteEditorDraft(projectId, draft.fileId)));

      if (recoverableDrafts.length > 0) {
        const shouldRestore = await appDialog.confirm({
          title: '发现未保存的代码',
          message: `检测到 ${recoverableDrafts.length} 个文件有浏览器草稿，是否恢复？`,
          highlight: recoverableDrafts.map((draft) => draft.name || draft.path).join('、'),
          confirmText: '恢复草稿',
          cancelText: '放弃草稿'
        });

        if (shouldRestore) {
          const draftsById = new Map(recoverableDrafts.map((draft) => [getFileKey(draft.fileId), draft]));
          nextFileData = nextFileData.map((file) => {
            const draft = draftsById.get(getFileKey(file.id));
            return draft ? { ...file, content: draft.content } : file;
          });
          const restoredFileIds = recoverableDrafts.map((draft) => getFileKey(draft.fileId));
          restoredFileIds.forEach((fileKey) => {
            fileVersionsRef.current.set(fileKey, (fileVersionsRef.current.get(fileKey) || 0) + 1);
          });
          addDirtyFileKeys(restoredFileIds);
        } else {
          await Promise.all(recoverableDrafts.map((draft) => deleteEditorDraft(projectId, draft.fileId)));
        }
      }
    }

    filesRef.current = nextFileData;
    setFiles(nextFileData);

    const stillExists = nextFileData.some((file) => file.id === activeFileId);
    if (!stillExists) {
      const defaultFile = nextFileData.find((file) => file.path === './sketch.js')
        || nextFileData.find((file) => file.isText)
        || nextFileData[0]
        || null;
      setActiveFileId(defaultFile?.id || null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await loadProjectFiles({ restoreDrafts: true, preserveDirty: false });
      } catch (err) {
        await appDialog.alert({
          title: '加载失败',
          message: err.message
        });
        handleBackToDashboard();
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (isAutoRunEnabled && !loading && files.length > 0) {
      handleRun();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAutoRunEnabled]);

  useEffect(() => {
    if (!exampleMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!exampleMenuRef.current?.contains(event.target)) {
        setExampleMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [exampleMenuOpen]);

  const getExampleName = (example) => (
    example?.names?.[language] || example?.names?.zh || example?.id || ''
  );

  const loadExamples = async () => {
    if (examplesLoading) return;

    setExamplesLoading(true);
    setExamplesError('');
    try {
      let data;
      try {
        data = await requestJson('/api/projects/examples', {
          headers: { 'Accept-Language': language }
        });
      } catch (err) {
        if (err.status !== 404) throw err;
        data = await requestJson('/api/examples', {
          headers: { 'Accept-Language': language }
        });
      }
      setExamples(Array.isArray(data) ? data : []);
      setExamplesLoaded(true);
    } catch (err) {
      setExamplesError(err.message);
    } finally {
      setExamplesLoading(false);
    }
  };

  const handleToggleExampleMenu = async () => {
    if (!canEdit || saving || autoSaving || importingExample) return;

    if (exampleMenuOpen) {
      setExampleMenuOpen(false);
      return;
    }

    setExampleMenuOpen(true);
    if (examplesLoaded || examplesLoading) return;
    await loadExamples();
  };

  const handleImportExample = async (example) => {
    if (!canEdit || saving || autoSaving || importingExample) return;

    setExampleMenuOpen(false);
    const exampleName = getExampleName(example);
    const confirmed = await appDialog.confirm({
      disableAutoTranslate: true,
      title: isEnglish ? 'Import Example' : '导入例子程序',
      message: isEnglish
        ? `Import "${exampleName}"? Every file in the current project, including unsaved changes, will be replaced. This action cannot be undone.`
        : `确定导入「${exampleName}」吗？当前项目中的全部文件和未保存修改都会被替换，此操作无法撤销。`,
      highlight: isEnglish ? 'The project name will stay unchanged.' : '项目名称不会改变。',
      confirmText: isEnglish ? 'Replace and Import' : '替换并导入',
      cancelText: isEnglish ? 'Cancel' : '取消',
      tone: 'danger'
    });
    if (!confirmed) return;

    setImportingExample(true);
    try {
      await Promise.allSettled(Array.from(saveQueuesRef.current.values()));
      await requestJson(`/api/projects/${projectId}/import-example`, {
        method: 'POST',
        headers: { 'Accept-Language': language },
        body: JSON.stringify({ exampleId: example.id })
      });
      await discardAllProjectDrafts();
      setPendingAiFiles(null);
      setAiMessages([]);
      setAiImages([]);
      setAiInput('');
      setActiveFileId(null);
      await loadProjectFiles({ preserveDirty: false });
      setPreviewUrl(getProjectPreviewUrl());
      await appDialog.alert({
        disableAutoTranslate: true,
        title: isEnglish ? 'Example Imported' : '导入成功',
        message: isEnglish
          ? `"${exampleName}" has replaced the files in this project.`
          : `「${exampleName}」已经替换当前项目中的文件。`,
        confirmText: isEnglish ? 'OK' : '知道啦'
      });
    } catch (err) {
      await appDialog.alert({
        disableAutoTranslate: true,
        title: isEnglish ? 'Import Failed' : '导入失败',
        message: err.message,
        confirmText: isEnglish ? 'OK' : '知道啦'
      });
    } finally {
      setImportingExample(false);
    }
  };

  const queueFileSave = async (file) => {
    const fileKey = getFileKey(file.id);
    const contentSnapshot = file.content || '';
    const versionSnapshot = fileVersionsRef.current.get(fileKey) || 0;
    const previousSave = saveQueuesRef.current.get(fileKey) || Promise.resolve();
    const nextSave = previousSave.catch(() => {}).then(() => (
      requestJson(`/api/files/${file.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content: contentSnapshot })
      })
    ));
    saveQueuesRef.current.set(fileKey, nextSave);

    try {
      await nextSave;
      const currentFile = filesRef.current.find((item) => getFileKey(item.id) === fileKey);
      const currentVersion = fileVersionsRef.current.get(fileKey) || 0;
      if (currentFile && currentVersion === versionSnapshot && (currentFile.content || '') === contentSnapshot) {
        removeDirtyFileKeys([fileKey]);
        await deleteStoredDraft(fileKey, versionSnapshot);
      }
    } finally {
      if (saveQueuesRef.current.get(fileKey) === nextSave) {
        saveQueuesRef.current.delete(fileKey);
      }
    }
  };

  const saveFilesToServer = async (filesToSave) => {
    if (!canEdit) return;

    const editableFiles = filesToSave.filter(isEditableTextFile);
    await Promise.all(editableFiles.map((file) => queueFileSave(file)));
  };

  const saveFilesInBackground = async (filesToSave) => {
    activeAutoSaveCountRef.current += 1;
    setAutoSaving(true);
    try {
      await saveFilesToServer(filesToSave);
      autoSaveRetryDelayRef.current = AUTO_SAVE_DELAY;
      setSaveError('');
    } catch (err) {
      autoSaveRetryDelayRef.current = Math.min(autoSaveRetryDelayRef.current * 2, 10000);
      setSaveError(err.message);
      throw err;
    } finally {
      activeAutoSaveCountRef.current -= 1;
      if (activeAutoSaveCountRef.current === 0) setAutoSaving(false);
    }
  };

  const handleCodeChange = (fileId, newContent) => {
    if (!canEdit) return;

    const fileKey = getFileKey(fileId);
    const currentFile = filesRef.current.find((file) => getFileKey(file.id) === fileKey);
    if (!isEditableTextFile(currentFile) || (currentFile.content || '') === newContent) return;

    const nextFile = { ...currentFile, content: newContent };
    const nextFiles = filesRef.current.map((file) => (
      getFileKey(file.id) === fileKey ? nextFile : file
    ));
    filesRef.current = nextFiles;
    setFiles(nextFiles);
    markFileDirty(nextFile);
  };

  const handleSelectFile = (file) => {
    if (file.id === activeFileId) return;

    const currentFile = filesRef.current.find((item) => item.id === activeFileId);
    if (currentFile && dirtyFileIdsRef.current.has(getFileKey(currentFile.id))) {
      void saveFilesInBackground([currentFile]).catch(() => {});
    }
    setActiveFileId(file.id);
  };

  useEffect(() => {
    if (loading || !canEdit || saving || autoSaving || importingExample || dirtyFileIds.size === 0) return undefined;

    const timeout = window.setTimeout(() => {
      const dirtyFiles = filesRef.current.filter((file) => dirtyFileIdsRef.current.has(getFileKey(file.id)));
      void saveFilesInBackground(dirtyFiles).catch(() => {});
    }, autoSaveRetryDelayRef.current);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, dirtyFileIds, canEdit, loading, saving, autoSaving, importingExample]);

  const getAiFilePayload = () => {
    const payload = {};

    files.forEach((file) => {
      if (!isEditableTextFile(file)) return;
      const cleanPath = file.path.replace(/^\.\//, '');
      if (!AI_TARGET_FILES.includes(cleanPath)) return;
      payload[cleanPath] = file.content || '';
    });

    return payload;
  };

  const appendAiMessage = (role, content) => {
    setAiMessages((previousMessages) => [
      ...previousMessages,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role,
        content
      }
    ]);
  };

  const handleAiImagesPaste = async (imageFiles) => {
    if (!canEdit || aiLoading) return;

    const availableCount = AI_IMAGE_MAX_COUNT - aiImages.length;
    if (availableCount <= 0) {
      await appDialog.alert({
        title: '图片已满',
        message: `一次最多粘贴 ${AI_IMAGE_MAX_COUNT} 张图片。`
      });
      return;
    }

    const filesToAdd = imageFiles.slice(0, availableCount);

    try {
      const compressedImages = [];
      for (const file of filesToAdd) {
        compressedImages.push(await compressImageForAi(file));
      }
      setAiImages((previousImages) => [...previousImages, ...compressedImages]);
    } catch (err) {
      await appDialog.alert({
        title: '图片处理失败',
        message: err.message
      });
    }
  };

  const handleAiImageRemove = (imageId) => {
    setAiImages((previousImages) => previousImages.filter((image) => image.id !== imageId));
  };

  const handleAiSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit || aiLoading) return;

    const prompt = aiInput.trim();
    const images = aiImages.map(({ mimeType, dataUrl }) => ({ mimeType, dataUrl }));
    if (!prompt && images.length === 0) return;

    const filePayload = getAiFilePayload();
    if (!filePayload['index.html']) {
      appendAiMessage('error', '没有找到 index.html，暂时不能让 AI 修改这个项目。');
      return;
    }

    setAiInput('');
    setAiImages([]);
    setPendingAiFiles(null);
    appendAiMessage('user', images.length > 0 ? `${prompt || '请参考图片修改代码。'}\n\n[已附加 ${images.length} 张图片]` : prompt);
    setAiLoading(true);

    try {
      const data = await requestJson(`/api/ai/project/${projectId}/code`, {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          images,
          files: filePayload,
          activeFile: activeFile?.path?.replace(/^\.\//, '') || ''
        })
      });
      const nextAiFiles = data.files || {};
      const hasAiFileChanges = Object.keys(nextAiFiles).length > 0;
      setPendingAiFiles(hasAiFileChanges ? nextAiFiles : null);
      const usageText = data.usage
        ? '\n\n本次消耗 ' + Number(data.usage.usedTokens || 0).toLocaleString() + ' tokens，剩余 ' + Number(data.usage.remainingTokens || 0).toLocaleString() + ' tokens。'
        : '';
      appendAiMessage('assistant', (data.message || 'AI 已生成代码修改建议。') + usageText + (hasAiFileChanges ? '\n\n点击上方对勾应用修改，点击叉号取消。' : ''));
    } catch (err) {
      appendAiMessage('error', err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiCancel = () => {
    setPendingAiFiles(null);
    appendAiMessage('assistant', '已取消这次 AI 修改。');
  };

  const handleAiApply = async () => {
    if (!canEdit || !pendingAiFiles) return;

    const entries = Object.entries(pendingAiFiles).filter(([fileName, content]) => (
      AI_TARGET_FILES.includes(fileName) && typeof content === 'string'
    ));
    if (entries.length === 0) {
      appendAiMessage('error', 'AI 没有返回可应用的文件内容。');
      return;
    }

    let nextFiles = files;
    const updatedIds = new Set();

    nextFiles = files.map((file) => {
      const cleanPath = file.path.replace(/^\.\//, '');
      const nextEntry = entries.find(([fileName]) => fileName === cleanPath);
      if (!nextEntry || !isEditableTextFile(file)) return file;

      updatedIds.add(file.id);
      return { ...file, content: nextEntry[1] };
    });

    const filesToSave = nextFiles.filter((file) => updatedIds.has(file.id));
    if (filesToSave.length === 0) {
      appendAiMessage('error', 'AI 返回的文件在当前项目中不存在，没有写入任何内容。');
      return;
    }

    filesRef.current = nextFiles;
    setFiles(nextFiles);
    filesToSave.forEach((file) => markFileDirty(file));
    setSaving(true);
    try {
      await saveFilesToServer(filesToSave);
      setPendingAiFiles(null);
      setPreviewUrl(getProjectPreviewUrl());
      setActiveFileId(filesToSave[0].id);
      appendAiMessage('assistant', `已应用并保存 AI 修改：${filesToSave.map((file) => file.name).join('、')}`);
    } catch (err) {
      setSaveError(err.message);
      appendAiMessage('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveActiveFile = async () => {
    if (!canEdit) return;

    const dirtyFiles = filesRef.current.filter((file) => dirtyFileIdsRef.current.has(getFileKey(file.id)));
    if (dirtyFiles.length === 0) return;

    setSaving(true);
    try {
      await saveFilesToServer(dirtyFiles);
      setSaveError('');
      await appDialog.alert({
        title: '保存成功',
        message: `${dirtyFiles.length} 个修改文件已全部保存。`
      });
    } catch (err) {
      setSaveError(err.message);
      await appDialog.alert({
        title: '保存失败',
        message: `${err.message}\n\n浏览器草稿已经保留，稍后会自动重试。`
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setSaving(true);
    try {
      await saveFilesToServer(filesRef.current);
      setSaveError('');
      setPreviewUrl(getProjectPreviewUrl());
    } catch (err) {
      setSaveError(err.message);
      await appDialog.alert({
        title: '运行失败',
        message: err.message
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenInNewTab = async () => {
    const previewWindow = window.open('about:blank', '_blank');
    setSaving(true);

    try {
      await saveFilesToServer(filesRef.current);
      setSaveError('');
      const url = getProjectPreviewUrl();
      setPreviewUrl(url);
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } catch (err) {
      setSaveError(err.message);
      if (previewWindow) previewWindow.close();
      await appDialog.alert({
        title: '打开失败',
        message: err.message
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFile = async () => {
    if (!canEdit || saving || importingExample) return;

    const name = await appDialog.prompt({
      title: '新建文本文件',
      message: '请输入新文本文件名（支持 .html、.css、.js、.txt）：',
      defaultValue: 'new-file.js',
      placeholder: 'new-file.js',
      confirmText: '创建文件'
    });
    if (!name) return;

    const lowerName = name.toLowerCase();
    if (!TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      await appDialog.alert({
        title: '文件类型不支持',
        message: '只能创建 .html、.css、.js、.txt 文本文件。'
      });
      return;
    }

    try {
      const created = await requestJson(`/api/files/project/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          parentPath: getParentPath(activeFile),
          type: 'file',
          content: ''
        })
      });
      await loadProjectFiles();
      setActiveFileId(created.id);
    } catch (err) {
      await appDialog.alert({
        title: '创建失败',
        message: err.message
      });
    }
  };

  const handleCreateFolder = async () => {
    if (!canEdit || saving || importingExample) return;

    const name = await appDialog.prompt({
      title: '新建文件夹',
      message: '请输入新文件夹名：',
      defaultValue: 'assets',
      placeholder: 'assets',
      confirmText: '创建文件夹'
    });
    if (!name) return;

    try {
      const created = await requestJson(`/api/files/project/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          parentPath: getParentPath(activeFile),
          type: 'directory'
        })
      });
      await loadProjectFiles();
      setActiveFileId(created.id);
    } catch (err) {
      await appDialog.alert({
        title: '创建失败',
        message: err.message
      });
    }
  };

  const handleUpload = async (selectedFiles) => {
    if (!canEdit || saving || importingExample) return;

    const parentPath = getParentPath(activeFile);

    try {
      setSaving(true);
      let lastUploaded = null;
      for (const selectedFile of selectedFiles) {
        const data = await readFileAsDataUrl(selectedFile);
        lastUploaded = await requestJson(`/api/files/project/${projectId}/upload`, {
          method: 'POST',
          body: JSON.stringify({
            name: selectedFile.name,
            parentPath,
            data
          })
        });
      }

      await loadProjectFiles();
      if (lastUploaded) setActiveFileId(lastUploaded.id);
    } catch (err) {
      await appDialog.alert({
        title: '上传失败',
        message: err.message
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (file) => {
    if (!canEdit || saving || importingExample || file.path === './index.html') return;

    const name = await appDialog.prompt({
      title: '重命名',
      message: '请输入新的名称：',
      defaultValue: file.name,
      placeholder: file.name,
      confirmText: '保存名称'
    });
    if (!name || name === file.name) return;

    setSaving(true);
    try {
      const affectedFileKeys = filesRef.current
        .filter((item) => item.path === file.path || item.path.startsWith(`${file.path}/`))
        .map((item) => getFileKey(item.id));
      const pendingSaves = affectedFileKeys
        .map((fileKey) => saveQueuesRef.current.get(fileKey))
        .filter(Boolean);
      await Promise.allSettled(pendingSaves);
      await requestJson(`/api/files/${file.id}/rename`, {
        method: 'PATCH',
        body: JSON.stringify({ name })
      });
      await loadProjectFiles();
    } catch (err) {
      await appDialog.alert({
        title: '重命名失败',
        message: err.message
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (file) => {
    if (!canEdit || saving || importingExample || file.path === './index.html') return;

    const ok = await appDialog.confirm({
      title: '删除文件',
      message: `确定删除 "${file.name}" 吗？${file.isDirectory ? ' 文件夹内的内容也会一起删除。' : ''}`,
      confirmText: '删除',
      tone: 'danger'
    });
    if (!ok) return;

    setSaving(true);
    try {
      const affectedFiles = filesRef.current.filter((item) => (
        item.path === file.path || item.path.startsWith(`${file.path}/`)
      ));
      const pendingSaves = affectedFiles
        .map((item) => saveQueuesRef.current.get(getFileKey(item.id)))
        .filter(Boolean);
      await Promise.allSettled(pendingSaves);
      await requestJson(`/api/files/${file.id}`, { method: 'DELETE' });
      await discardFileDrafts(affectedFiles.map((item) => item.id));
      await loadProjectFiles();
    } catch (err) {
      await appDialog.alert({
        title: '删除失败',
        message: err.message
      });
    } finally {
      setSaving(false);
    }
  };

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (!iframeDoc) return;

      const handleMove = (clientX, clientY) => {
        const canvas = iframeDoc.querySelector('canvas');
        if (!canvas) {
          setCoords(null);
          return;
        }

        const rect = canvas.getBoundingClientRect();
        const x = Math.round(clientX - rect.left);
        const y = Math.round(clientY - rect.top);
        setCoords(x >= 0 && x <= rect.width && y >= 0 && y <= rect.height ? { x, y } : null);
      };

      iframeDoc.addEventListener('mousemove', (event) => handleMove(event.clientX, event.clientY), { passive: true });
      iframeDoc.addEventListener('touchmove', (event) => {
        if (event.touches && event.touches.length > 0) {
          handleMove(event.touches[0].clientX, event.touches[0].clientY);
        }
      }, { passive: true });
      iframeDoc.addEventListener('mouseleave', () => setCoords(null), { passive: true });
      iframeDoc.addEventListener('touchend', () => setCoords(null), { passive: true });
    } catch (err) {
      console.warn('无法附加坐标监听器:', err);
    }
  };

  const renderBinaryPreview = () => {
    if (!activeFile || activeFile.isDirectory || activeFile.isText) return null;

    const ext = activeFile.name.split('.').pop()?.toLowerCase();
    const url = `${activeFile.url}?t=${Date.now()}`;

    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return <img src={url} alt={activeFile.name} className="max-w-full max-h-[70vh] object-contain rounded border border-slate-200 bg-white" />;
    }

    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
      return <audio src={url} controls className="w-full max-w-xl" />;
    }

    if (['mp4', 'webm', 'mov'].includes(ext)) {
      return <video src={url} controls className="max-w-full max-h-[70vh] rounded border border-slate-200 bg-black" />;
    }

    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-600 hover:text-indigo-800">
        在新窗口打开 {activeFile.name}
      </a>
    );
  };

  if (loading) {
    return (
      <>
      {appDialog.dialog}
      <div className="h-screen w-screen bg-gradient-to-br from-sky-100 via-indigo-50 to-pink-100 flex flex-col items-center justify-center text-slate-600 gap-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <Wand2 className="w-7 h-7 text-indigo-500 absolute animate-pulse" />
        </div>
        <p className="font-black text-base text-indigo-950">正在为你拼装魔法画板，代码正在飞速赶来... 🚀</p>
      </div>
      </>
    );
  }

  return (
    <>
    {appDialog.dialog}
    <div className="h-screen w-screen bg-slate-50 text-slate-800 flex flex-col overflow-hidden font-sans">
      <header className="h-16 bg-white border-b-4 border-slate-100 flex items-center justify-between px-5 select-none shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="bg-slate-100 hover:bg-slate-200 p-2.5 rounded-2xl border-2 border-slate-200 text-slate-500 hover:text-slate-700 transition shadow-sm active:translate-y-0.5"
            title="返回我的工坊"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-indigo-100 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-full">
              创意项目
            </span>
            <span className="font-black text-sm truncate max-w-[260px] text-slate-700">
              <span data-i18n-skip>{projectName}</span>
            </span>
            {!canEdit && (
              <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-black">
                只读
              </span>
            )}
            {canEdit && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  saveError
                    ? 'bg-rose-100 text-rose-600'
                    : saving || autoSaving
                      ? 'bg-sky-100 text-sky-600'
                      : dirtyFileIds.size > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                }`}
                title={saveError || undefined}
              >
                {saveError
                  ? (isEnglish ? 'Draft saved locally' : '保存失败，草稿已保留')
                  : saving || autoSaving
                    ? (isEnglish ? 'Saving...' : '正在自动保存...')
                    : dirtyFileIds.size > 0
                      ? (isEnglish ? `${dirtyFileIds.size} unsaved` : `${dirtyFileIds.size} 个修改待保存`)
                      : (isEnglish ? 'Saved' : '已保存')}
              </span>
            )}
          </div>
          <div ref={exampleMenuRef} data-i18n-skip className="relative">
            <button
              type="button"
              onClick={handleToggleExampleMenu}
              disabled={!canEdit || saving || autoSaving || importingExample}
              className="flex items-center gap-1.5 rounded-xl border-2 border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-45"
              title={canEdit ? (isEnglish ? 'Import an example program' : '导入例子程序') : (isEnglish ? 'Read-only projects cannot import examples' : '只读项目不能导入例子')}
            >
              {importingExample ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
              <span>{importingExample ? (isEnglish ? 'Importing...' : '正在导入...') : (isEnglish ? 'Import Example' : '导入例子')}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition ${exampleMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {exampleMenuOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border-2 border-indigo-100 bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
                <div className="px-2 pb-2 pt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {isEnglish ? 'Choose an example' : '选择例子程序'}
                </div>
                {examplesLoading ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-5 text-xs font-bold text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{isEnglish ? 'Loading...' : '加载中...'}</span>
                  </div>
                ) : examplesError ? (
                  <div className="rounded-xl bg-rose-50 px-3 py-3 text-center">
                    <div className="text-[11px] font-bold leading-5 text-rose-600">{examplesError}</div>
                    <button
                      type="button"
                      onClick={loadExamples}
                      className="mt-2 rounded-lg bg-rose-100 px-3 py-1.5 text-[11px] font-black text-rose-700 transition hover:bg-rose-200"
                    >
                      {isEnglish ? 'Try Again' : '重新加载'}
                    </button>
                  </div>
                ) : examples.length > 0 ? (
                  <div className="max-h-72 space-y-1 overflow-y-auto">
                    {examples.map((example) => (
                      <button
                        key={example.id}
                        type="button"
                        onClick={() => handleImportExample(example)}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-black text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        <BookOpen className="h-4 w-4 shrink-0 text-indigo-400" />
                        <span className="truncate">{getExampleName(example)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-5 text-center text-xs font-bold text-slate-400">
                    {isEnglish ? 'No examples are available.' : '暂时没有可用的例子程序。'}
                  </div>
                )}
              </div>
            )}
          </div>
          <ContactTeacherButton />
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleSaveActiveFile}
            disabled={saving || autoSaving || importingExample || !canEdit || dirtyFileIds.size === 0}
            className="flex items-center space-x-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 px-4 py-2 rounded-2xl text-xs font-black border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? '正在封存...' : '保存全部修改'}</span>
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={saving || autoSaving || importingExample}
            className="flex items-center space-x-1.5 bg-emerald-400 hover:bg-emerald-300 text-white px-5 py-2 rounded-2xl text-xs font-black border-b-4 border-emerald-600 active:border-b-0 active:translate-y-1 transition-all shadow-sm disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>施放魔法 (运行)</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <FileTree
          files={files}
          activeFileId={activeFileId}
          canEdit={canEdit}
          onSelect={handleSelectFile}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onUpload={handleUpload}
          onRename={handleRename}
          onDelete={handleDelete}
          aiMessages={aiMessages}
          aiInput={aiInput}
          aiImages={aiImages}
          aiLoading={aiLoading}
          aiPending={Boolean(pendingAiFiles)}
          onAiInputChange={setAiInput}
          onAiImagesPaste={handleAiImagesPaste}
          onAiImageRemove={handleAiImageRemove}
          onAiSubmit={handleAiSubmit}
          onAiApply={handleAiApply}
          onAiCancel={handleAiCancel}
        />

        <Split className={`flex-1 flex ${isVerticalLayout ? 'flex-col-reverse min-w-0 min-h-0' : ''}`} sizes={[55, 45]} minSize={250} gutterSize={8} direction={isVerticalLayout ? 'vertical' : 'horizontal'}>
          <div className={`h-full bg-[#1e1e1e] overflow-hidden border-2 border-transparent ${isVerticalLayout ? 'rounded-b-2xl' : 'rounded-l-2xl'}`}>
            {isEditableTextFile(activeFile) ? (
              <CodeEditor
                key={getFileKey(activeFile.id)}
                fileName={activeFile.path}
                value={activeFile.content || ''}
                onChange={(newContent) => handleCodeChange(activeFile.id, newContent)}
                readOnly={!canEdit}
                fontSize={codeFontSize}
                onFontSizeChange={handleCodeFontSizeChange}
              />
            ) : (
              <div className="h-full w-full bg-slate-950 text-slate-300 flex items-center justify-center p-6 text-center">
                {activeFile?.isDirectory
                  ? '请选择一个文本文件进行编辑。'
                  : activeFile
                    ? renderBinaryPreview()
                    : '暂无可编辑文件。'}
              </div>
            )}
          </div>

          <div className={`h-full bg-white flex flex-col ${isVerticalLayout ? 'border-b-4' : 'border-l-4'} border-slate-100`}>
            <div className="px-4 py-2.5 bg-slate-100 text-xs text-slate-500 font-black border-b-2 border-slate-200 select-none flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                <span>✨ 魔法画布 (神奇预览窗口)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-slate-50 border border-slate-200 text-slate-400 px-2.5 py-0.5 rounded-lg font-mono text-[10px] tracking-wider">
                  🎯 ({coords ? `${coords.x}, ${coords.y}` : '--, --'})
                </span>
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="flex items-center space-x-1.5 text-indigo-600 hover:text-indigo-800 transition duration-150 font-black bg-indigo-50 hover:bg-indigo-100/80 px-3 py-1 rounded-xl border border-indigo-200/60 shadow-sm active:translate-y-0.5"
                  title="屏运行"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>独立大视窗</span>
                </button>
              </div>
            </div>

            <div className="flex-1 bg-white relative">
              {previewUrl ? (
                <iframe
                  ref={iframeRef}
                  onLoad={handleIframeLoad}
                  title="p5js-preview"
                  src={previewUrl}
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full border-none bg-white"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm font-bold gap-3 p-4 text-center">
                  <div className="bg-slate-100 p-4 rounded-full border-2 border-slate-200">
                    <Wand2 className="w-8 h-8 text-indigo-400" />
                  </div>
                  <span>你的魔法画布现在空空如也，<br />快点击上方的 “施放魔法” 运行代码吧！</span>
                </div>
              )}
            </div>
          </div>
        </Split>
      </div>
    </div>
    </>
  );
};

export default EditorView;
