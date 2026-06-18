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

export const copyProject = async (projectId) => {
  const response = await fetch('/api/projects/copy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify({ projectId })
  });
  const rawText = await response.text();
  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (err) {
    throw new Error('复制接口没有返回 JSON，请确认后端服务已重启，并且 /api 请求已代理到后端。');
  }

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('teaching_token');
    localStorage.removeItem('teaching_user');
    window.location.href = '/login';
    return null;
  }
  if (!response.ok) throw new Error(data?.message || '复制项目失败，请重试。');
  return data;
};
