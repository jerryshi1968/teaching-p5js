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