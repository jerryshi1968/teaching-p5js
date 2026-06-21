import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Users, School } from 'lucide-react';
import { fetchAdminUsers, updateAdminUserRole } from '../services/api';

const PAGE_SIZE = 10;

const Admin = () => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('users');
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [usernameKeyword, setUsernameKeyword] = useState('');
  const [roleUpdatingId, setRoleUpdatingId] = useState(null);

  const currentUser = useMemo(() => {
    const userJson = localStorage.getItem('teaching_user');
    if (!userJson) return null;

    try {
      return JSON.parse(userJson);
    } catch (err) {
      return null;
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' || activeMenu !== 'users') return;

    setLoading(true);
    setError('');
    fetchAdminUsers(page, PAGE_SIZE, usernameKeyword)
      .then(data => {
        setUsers(Array.isArray(data.items) ? data.items : []);
        setTotal(Number(data.total || 0));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      })
      .catch(err => {
        setError(err.message || '获取用户列表失败，请重试。');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeMenu, currentUser, page, usernameKeyword]);

  const formatDate = (value) => {
    if (!value) return '-';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const date = new Date(value);
    if (isNaN(date.getTime())) return '-';

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatGender = (gender) => {
    if (gender === 'male') return '男';
    if (gender === 'female') return '女';
    return '未填写';
  };

  const formatRole = (role) => {
    if (role === 'admin') return '管理员';
    if (role === 'teacher') return '教师';
    if (role === 'student') return '学生';
    return role || '-';
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setUsernameKeyword(searchInput.trim());
  };

  const handleRoleChange = async (user, role) => {
    if (user.role === role || user.role === 'admin') return;

    try {
      setError('');
      setRoleUpdatingId(user.id);
      await updateAdminUserRole(user.id, role);
      setUsers((currentUsers) => currentUsers.map((item) => (
        item.id === user.id ? { ...item, role } : item
      )));
    } catch (err) {
      setError(err.message || '修改用户角色失败，请重试。');
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '-';

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  const menuItems = [
    { key: 'users', label: '用户管理', icon: Users },
    { key: 'classes', label: '班级管理', icon: School }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans">
      <aside className="w-56 shrink-0 bg-white border-r border-slate-200 min-h-screen flex flex-col">
        <div className="px-5 py-5 border-b border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回 Dashboard</span>
          </button>
          <h1 className="text-lg font-black text-slate-900">管理</h1>
        </div>

        <nav className="p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const selected = activeMenu === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveMenu(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  selected
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900">
              {activeMenu === 'users' ? '用户管理' : '班级管理'}
            </h2>
            {activeMenu === 'users' && (
              <p className="text-xs text-slate-400 font-bold mt-0.5">共 {total} 个用户</p>
            )}
          </div>
          {activeMenu === 'users' && (
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                placeholder="按用户名查找"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                disabled={loading}
              >
                查找
              </button>
              {usernameKeyword && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setUsernameKeyword('');
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100"
                >
                  清空
                </button>
              )}
            </form>
          )}
        </header>

        <section className="p-6">
          {activeMenu === 'users' ? (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-black">用户名</th>
                      <th className="px-4 py-3 text-left font-black">手机号码</th>
                      <th className="px-4 py-3 text-left font-black">性别</th>
                      <th className="px-4 py-3 text-left font-black">生日</th>
                      <th className="px-4 py-3 text-left font-black">角色</th>
                      <th className="px-4 py-3 text-left font-black">创建时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-slate-400 font-bold" colSpan="6">加载中...</td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-rose-500 font-bold" colSpan="6">{error}</td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-slate-400 font-bold" colSpan="6">暂无用户</td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-800">{user.username || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{user.phone || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{formatGender(user.gender)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(user.birthday)}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {user.role === 'admin' ? (
                              <span>{formatRole(user.role)}</span>
                            ) : (
                              <select
                                value={user.role}
                                onChange={(e) => handleRoleChange(user, e.target.value)}
                                disabled={roleUpdatingId === user.id}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                              >
                                <option value="student">学生</option>
                                <option value="teacher">教师</option>
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatDateTime(user.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">第 {page} / {totalPages} 页</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1 || loading}
                    className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
                    title="上一页"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages || loading}
                    className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
                    title="下一页"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-[360px]"></div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Admin;
