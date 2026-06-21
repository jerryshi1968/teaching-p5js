// 获取保存在 localStorage 的 token
export const getAuthHeader = () => {
  const token = localStorage.getItem('teaching_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// 示例：向后端拉取项目列表的方法
export const fetchMyProjects = async (studentId = null) => {
  const url = studentId ? `/api/projects?studentId=${studentId}` : '/api/projects';
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
