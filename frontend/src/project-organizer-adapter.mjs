import { getAuthHeader } from './services/api.js';

export class ProjectOrganizerAdapterError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'ProjectOrganizerAdapterError';
    if (code) this.code = code;
    if (Number.isInteger(status)) this.status = status;
  }
}

const same = (a, b) => a === null || b === null ? a === b : String(a) === String(b);

const normalizeParentId = (value) => value === null || value === undefined ? null : Number(value);

export const normalizeProjectSummary = (project) => ({
  kind: 'project',
  id: String(project.id),
  name: project.name,
  parentId: normalizeParentId(project.parent_id ?? project.parentId),
  sortOrder: Number(project.sort_order ?? project.sortOrder ?? 0),
  updatedAt: project.updated_at ?? project.updatedAt ?? null
});

export const normalizeGroupSummary = (group) => ({
  kind: 'group',
  id: Number(group.id),
  name: group.name,
  parentId: normalizeParentId(group.parent_id ?? group.parentId),
  sortOrder: Number(group.sort_order ?? group.sortOrder ?? 0),
  updatedAt: group.updated_at ?? group.updatedAt ?? null
});

const appendDirectoryQuery = (path, { ownerId = null, parentId } = {}) => {
  const params = new URLSearchParams();
  if (ownerId !== null && ownerId !== undefined) params.set('studentId', String(ownerId));
  if (parentId !== undefined && parentId !== null) params.set('parentId', String(parentId));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

const defaultResolveOwner = (ownerId) => {
  if (ownerId !== null && ownerId !== undefined) return { id: Number(ownerId), username: String(ownerId) };

  try {
    const user = JSON.parse(localStorage.getItem('teaching_user') || 'null');
    return user?.id ? { id: Number(user.id), username: user.username } : null;
  } catch {
    return null;
  }
};

const defaultHandleAuthFailure = () => {
  localStorage.removeItem('teaching_token');
  localStorage.removeItem('teaching_user');
  window.location.href = `${import.meta.env.BASE_URL}login`;
};

export function createP5ProjectOrganizerAdapter({
  fetchImpl = fetch,
  resolveOwner = defaultResolveOwner,
  handleAuthFailure = defaultHandleAuthFailure,
  openProject,
  openCreatedProject = true
} = {}) {
  let activeContext = { ownerId: null, parentId: null, readOnly: false };
  let lastDirectory = null;

  const requestJson = async (url, { method = 'GET', body, redirectForbidden = false } = {}) => {
    const response = await fetchImpl(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const rawText = await response.text();
    let data = null;

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new ProjectOrganizerAdapterError(`接口返回了非 JSON 响应（HTTP ${response.status}）。`, { status: response.status });
    }

    if (response.status === 401 || (response.status === 403 && redirectForbidden)) {
      handleAuthFailure();
    }
    if (!response.ok) {
      throw new ProjectOrganizerAdapterError(data?.message || `请求失败（HTTP ${response.status}）。`, {
        code: data?.code,
        status: response.status
      });
    }
    return data;
  };

  const ensureWritable = () => {
    if (!activeContext.readOnly) return;
    throw new ProjectOrganizerAdapterError('当前作品目录为只读状态。', { code: 'READ_ONLY', status: 403 });
  };

  const fetchDirectory = async ({ ownerId = null, parentId = null } = {}) => {
    const [projectsData, groupsData, owner] = await Promise.all([
      requestJson(appendDirectoryQuery('/api/projects', { ownerId, parentId }), { redirectForbidden: true }),
      requestJson(appendDirectoryQuery('/api/project-groups', { ownerId, parentId }), { redirectForbidden: true }),
      Promise.resolve(resolveOwner(ownerId))
    ]);
    return {
      projects: (Array.isArray(projectsData) ? projectsData : []).map(normalizeProjectSummary),
      groups: (Array.isArray(groupsData?.groups) ? groupsData.groups : []).map(normalizeGroupSummary),
      breadcrumbs: (Array.isArray(groupsData?.breadcrumbs) ? groupsData.breadcrumbs : []).map(normalizeGroupSummary),
      owner: owner ? { id: Number(owner.id), username: owner.username } : null,
      readOnly: ownerId !== null && ownerId !== undefined
    };
  };

  const findAuthoritativeItem = async ({ kind, id, parentId }) => {
    const directory = await fetchDirectory({ ownerId: null, parentId });
    const collection = kind === 'project' ? directory.projects : directory.groups;
    const item = collection.find((candidate) => same(candidate.id, id));
    if (!item) {
      throw new ProjectOrganizerAdapterError('操作成功，但重新读取时找不到对应项目。', {
        code: 'AUTHORITATIVE_ITEM_MISSING',
        status: 409
      });
    }
    return item;
  };

  const itemParentId = async (kind, id) => {
    const collection = kind === 'project' ? lastDirectory?.projects : lastDirectory?.groups;
    const cached = collection?.find((candidate) => same(candidate.id, id));
    if (cached) return cached.parentId;

    if (kind === 'group') {
      const groups = await adapter.loadAllGroups({ ownerId: activeContext.ownerId });
      const group = groups.find((candidate) => same(candidate.id, id));
      if (group) return group.parentId;
    }
    return activeContext.parentId;
  };

  const adapter = {
    async loadDirectory({ ownerId = null, parentId = null } = {}) {
      const directory = await fetchDirectory({ ownerId, parentId });
      activeContext = { ownerId, parentId, readOnly: directory.readOnly };
      lastDirectory = directory;
      return directory;
    },

    async loadAllGroups({ ownerId = null } = {}) {
      const data = await requestJson(appendDirectoryQuery('/api/project-groups/all', { ownerId }), { redirectForbidden: true });
      return (Array.isArray(data?.groups) ? data.groups : []).map(normalizeGroupSummary);
    },

    async createProject({ name, parentId = null, templateId } = {}) {
      ensureWritable();
      const created = await requestJson('/api/projects', {
        method: 'POST',
        body: { name, parentId, templateId }
      });
      const project = await findAuthoritativeItem({ kind: 'project', id: created.id, parentId });
      if (openCreatedProject) await adapter.openProject(project.id);
      return project;
    },

    async createGroup({ name, parentId = null } = {}) {
      ensureWritable();
      const created = await requestJson('/api/project-groups', {
        method: 'POST',
        body: { name, parentId }
      });
      const groupId = created?.group?.id ?? created?.id;
      return findAuthoritativeItem({ kind: 'group', id: groupId, parentId });
    },

    async renameItem({ kind, id, name } = {}) {
      ensureWritable();
      const parentId = await itemParentId(kind, id);
      const path = kind === 'project' ? 'projects' : 'project-groups';
      await requestJson(`/api/${path}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: { name }
      });
      return findAuthoritativeItem({ kind, id, parentId });
    },

    async repositionItem({ kind, id, parentId, beforeId } = {}) {
      ensureWritable();
      const path = kind === 'project' ? 'projects' : 'project-groups';
      await requestJson(`/api/${path}/${encodeURIComponent(id)}/reposition`, {
        method: 'PUT',
        body: { parentId, beforeId }
      });
      const item = await findAuthoritativeItem({ kind, id, parentId });
      return { repositioned: true, item };
    },

    async deleteItem({ kind, id } = {}) {
      ensureWritable();
      const path = kind === 'project' ? 'projects' : 'project-groups';
      await requestJson(`/api/${path}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return { deleted: true };
    },

    openProject(id) {
      if (typeof openProject !== 'function') {
        throw new ProjectOrganizerAdapterError('宿主应用没有提供打开作品的方法。', { code: 'OPEN_PROJECT_UNAVAILABLE' });
      }
      return openProject(id);
    }
  };

  return adapter;
}
