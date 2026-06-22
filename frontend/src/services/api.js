// 获取保存在 localStorage 的 token
export const getAuthHeader = () => {
  const token = localStorage.getItem('teaching_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// 示例：向后端拉取项目列表的方法
export const fetchMyProjects = async (studentId = null, parentId = null) => {
  const params = new URLSearchParams();
  if (studentId) {
    params.set('studentId', studentId);
  }
  if (parentId !== null && parentId !== undefined) {
    params.set('parentId', String(parentId));
  }
  const query = params.toString();
  const url = query ? `/api/projects?${query}` : '/api/projects';
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('teaching_token');
    localStorage.removeItem('teaching_user');
    window.location.href = '/login';
    return null;
  }
  return response.json();
};

export const fetchProjectGroups = async ({ studentId = null, parentId = null } = {}) => {
  const params = new URLSearchParams();
  if (studentId) {
    params.set('studentId', studentId);
  }
  if (parentId !== null && parentId !== undefined) {
    params.set('parentId', String(parentId));
  }
  const query = params.toString();
  const response = await fetch(`/api/project-groups${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('teaching_token');
    localStorage.removeItem('teaching_user');
    window.location.href = '/login';
    return null;
  }
  if (!response.ok) throw new Error(data?.message || `获取作品组失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const fetchAllProjectGroups = async () => {
  const response = await fetch('/api/project-groups/all', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `获取作品组失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const createProjectGroup = async ({ name, parentId = null }) => {
  const response = await fetch('/api/project-groups', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify({ name, parentId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `创建作品组失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const moveProjectGroup = async (groupId, { parentId = null }) => {
  const response = await fetch(`/api/project-groups/${groupId}/move`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify({ parentId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `移动作品组失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const reorderProjectGroups = async ({ parentId = null, orderedIds }) => {
  const response = await fetch('/api/project-groups/reorder', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify({ parentId, orderedIds })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `调整作品组排序失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const updateProjectGroup = async (groupId, { name }) => {
  const response = await fetch(`/api/project-groups/${groupId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify({ name })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `修改作品组失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const moveProject = async (projectId, { parentId = null }) => {
  const response = await fetch(`/api/projects/${projectId}/move`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify({ parentId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `移动项目失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const reorderProjects = async ({ parentId = null, orderedIds }) => {
  const response = await fetch('/api/projects/reorder', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify({ parentId, orderedIds })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `调整项目排序失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const deleteProjectGroup = async (groupId) => {
  const response = await fetch(`/api/project-groups/${groupId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `删除作品组失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const fetchAdminUsers = async (page = 1, pageSize = 10, username = '') => {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  if (username.trim()) {
    params.set('username', username.trim());
  }

  const response = await fetch(`/api/admin/users?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    throw new Error(data?.message || '无权访问管理页面。');
  }
  if (!response.ok) throw new Error(data?.message || `获取用户列表失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const updateAdminUserRole = async (userId, role) => {
  const response = await fetch(`/api/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify({ role })
  });
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    throw new Error(data?.message || '无权修改用户角色。');
  }
  if (!response.ok) throw new Error(data?.message || `修改用户角色失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const fetchMyClasses = async () => {
  const response = await fetch('/api/auth/my-classes', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    throw new Error(data?.message || '无权获取班级列表。');
  }
  if (!response.ok) throw new Error(data?.message || `获取班级列表失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const fetchStudentsByClass = async (classCode) => {
  const response = await fetch(`/api/auth/classes/${encodeURIComponent(classCode)}/students`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    throw new Error(data?.message || '无权获取班级学生列表。');
  }
  if (!response.ok) throw new Error(data?.message || `获取班级学生列表失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const fetchAdminTeachers = async () => {
  const response = await fetch('/api/admin/teachers', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    throw new Error(data?.message || '无权访问教师列表。');
  }
  if (!response.ok) throw new Error(data?.message || `获取教师列表失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const fetchAdminClasses = async (page = 1, pageSize = 10) => {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });

  const response = await fetch(`/api/admin/classes?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    throw new Error(data?.message || '无权访问班级管理页面。');
  }
  if (!response.ok) throw new Error(data?.message || `获取班级列表失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const createAdminClass = async (payload) => {
  const response = await fetch('/api/admin/classes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    throw new Error(data?.message || '无权创建班级。');
  }
  if (!response.ok) throw new Error(data?.message || `创建班级失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const updateAdminClass = async (classId, payload) => {
  const response = await fetch(`/api/admin/classes/${classId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    throw new Error(data?.message || '无权修改班级。');
  }
  if (!response.ok) throw new Error(data?.message || `修改班级失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const deleteAdminClass = async (classId) => {
  const response = await fetch(`/api/admin/classes/${classId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }
  });
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    throw new Error(data?.message || '无权删除班级。');
  }
  if (!response.ok) throw new Error(data?.message || `删除班级失败（HTTP ${response.status}），请重试。`);
  return data;
};

export const copyProject = async (projectId) => {
  const requestCopyProject = async (url, body) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(body)
    });
    const rawText = await response.text();
    let data = null;

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (err) {
      return { response, data: null, rawText, jsonError: err };
    }

    return { response, data, rawText, jsonError: null };
  };

  let result = await requestCopyProject(`/api/projects/${projectId}/copy`, {});

  if (result.response.status === 404 && result.jsonError) {
    result = await requestCopyProject('/api/projects/copy', { projectId });
  }

  const { response, data, jsonError } = result;

  if (jsonError) {
    throw new Error(`复制接口返回了非 JSON 响应（HTTP ${response.status}），请确认 /api/projects/${projectId}/copy 已代理到后端并且后端服务已重启。`);
  }

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('teaching_token');
    localStorage.removeItem('teaching_user');
    window.location.href = '/login';
    return null;
  }
  if (!response.ok) throw new Error(data?.message || `复制项目失败（HTTP ${response.status}），请重试。`);
  return data;
};
