const DATABASE_NAME = 'teaching-p5js-editor-drafts';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drafts';
const PROJECT_INDEX_NAME = 'projectId';
const EMERGENCY_DRAFT_PREFIX = 'teaching_editor_emergency_draft:';

const getDraftKey = (projectId, fileId) => `${String(projectId)}:${String(fileId)}`;
const getEmergencyDraftKey = (projectId, fileId) => (
  `${EMERGENCY_DRAFT_PREFIX}${encodeURIComponent(String(projectId))}:${encodeURIComponent(String(fileId))}`
);
const getEmergencyProjectPrefix = (projectId) => (
  `${EMERGENCY_DRAFT_PREFIX}${encodeURIComponent(String(projectId))}:`
);

const normalizeDraft = (draft) => ({
  key: getDraftKey(draft.projectId, draft.fileId),
  projectId: String(draft.projectId),
  fileId: String(draft.fileId),
  name: String(draft.name || ''),
  path: String(draft.path || ''),
  content: String(draft.content ?? ''),
  updatedAt: Number(draft.updatedAt) || Date.now()
});

const openDatabase = () => new Promise((resolve) => {
  if (typeof indexedDB === 'undefined') {
    resolve(null);
    return;
  }

  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    const store = database.objectStoreNames.contains(STORE_NAME)
      ? request.transaction.objectStore(STORE_NAME)
      : database.createObjectStore(STORE_NAME, { keyPath: 'key' });

    if (!store.indexNames.contains(PROJECT_INDEX_NAME)) {
      store.createIndex(PROJECT_INDEX_NAME, PROJECT_INDEX_NAME, { unique: false });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
  request.onblocked = () => resolve(null);
});

const runRequest = (request) => new Promise((resolve) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
});

const listEmergencyDrafts = (projectId) => {
  if (typeof localStorage === 'undefined') return [];

  const drafts = [];
  const prefix = getEmergencyProjectPrefix(projectId);

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;

      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (parsed && String(parsed.projectId) === String(projectId)) {
        drafts.push(normalizeDraft(parsed));
      }
    }
  } catch (err) {
    return [];
  }

  return drafts;
};

export const saveEmergencyEditorDraft = (draft) => {
  if (typeof localStorage === 'undefined') return;

  const normalizedDraft = normalizeDraft(draft);
  try {
    localStorage.setItem(
      getEmergencyDraftKey(normalizedDraft.projectId, normalizedDraft.fileId),
      JSON.stringify(normalizedDraft)
    );
  } catch (err) {
    // IndexedDB 仍会作为容量更大的草稿存储继续工作。
  }
};

export const saveEditorDraft = async (draft) => {
  const normalizedDraft = normalizeDraft(draft);
  saveEmergencyEditorDraft(normalizedDraft);

  const database = await openDatabase();
  if (!database) return;

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(normalizedDraft);
  } catch (err) {
    // 紧急草稿已经同步写入 localStorage，此处无需中断编辑流程。
  } finally {
    database.close();
  }
};

export const loadEditorDrafts = async (projectId) => {
  const mergedDrafts = new Map();
  listEmergencyDrafts(projectId).forEach((draft) => mergedDrafts.set(draft.fileId, draft));

  const database = await openDatabase();
  if (!database) return Array.from(mergedDrafts.values());

  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index(PROJECT_INDEX_NAME);
    const indexedDrafts = await runRequest(index.getAll(String(projectId)));

    (indexedDrafts || []).forEach((draft) => {
      const normalizedDraft = normalizeDraft(draft);
      const existingDraft = mergedDrafts.get(normalizedDraft.fileId);
      if (!existingDraft || normalizedDraft.updatedAt >= existingDraft.updatedAt) {
        mergedDrafts.set(normalizedDraft.fileId, normalizedDraft);
      }
    });
  } catch (err) {
    return Array.from(mergedDrafts.values());
  } finally {
    database.close();
  }

  return Array.from(mergedDrafts.values());
};

export const deleteEditorDraft = async (projectId, fileId) => {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(getEmergencyDraftKey(projectId, fileId));
    } catch (err) {
      // 删除浏览器紧急草稿失败时，IndexedDB 清理仍会继续。
    }
  }

  const database = await openDatabase();
  if (!database) return;

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(getDraftKey(projectId, fileId));
  } catch (err) {
    // 下次成功保存或用户放弃草稿时会再次尝试清理。
  } finally {
    database.close();
  }
};

export const deleteProjectDrafts = async (projectId) => {
  if (typeof localStorage !== 'undefined') {
    const prefix = getEmergencyProjectPrefix(projectId);
    const keysToDelete = [];

    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix)) keysToDelete.push(key);
      }
      keysToDelete.forEach((key) => localStorage.removeItem(key));
    } catch (err) {
      // IndexedDB 中的项目草稿仍会继续清理。
    }
  }

  const database = await openDatabase();
  if (!database) return;

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index(PROJECT_INDEX_NAME);
    const request = index.openKeyCursor(String(projectId));

    await new Promise((resolve) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
      request.onerror = () => resolve();
    });
  } catch (err) {
    // 清理失败不会影响导入后的服务器文件加载。
  } finally {
    database.close();
  }
};
