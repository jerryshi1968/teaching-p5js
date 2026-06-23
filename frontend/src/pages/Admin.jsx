import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Edit2, Plus, Save, School, Trash2, Users, X } from 'lucide-react';
import { createAdminClass, deleteAdminClass, fetchAdminClasses, fetchAdminClassStudents, fetchAdminTeachers, fetchAdminUsers, updateAdminClass, updateAdminUserRole } from '../services/api';

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
  const [classes, setClasses] = useState([]);
  const [classPage, setClassPage] = useState(1);
  const [classTotalPages, setClassTotalPages] = useState(1);
  const [classTotal, setClassTotal] = useState(0);
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [classForm, setClassForm] = useState({ name: '', classCode: '', teacherUserId: '' });
  const [classSaving, setClassSaving] = useState(false);
  const [classDeletingId, setClassDeletingId] = useState(null);
  const [classStudentsDialog, setClassStudentsDialog] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [classStudentsLoading, setClassStudentsLoading] = useState(false);
  const [classStudentsError, setClassStudentsError] = useState('');

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

  useEffect(() => {
    if (currentUser?.role !== 'admin' || activeMenu !== 'classes') return;

    setClassLoading(true);
    setClassError('');
    fetchAdminClasses(classPage, PAGE_SIZE)
      .then(data => {
        setClasses(Array.isArray(data.items) ? data.items : []);
        setClassTotal(Number(data.total || 0));
        setClassTotalPages(Math.max(1, Number(data.totalPages || 1)));
      })
      .catch(err => {
        setClassError(err.message || '获取班级列表失败，请重试。');
      })
      .finally(() => {
        setClassLoading(false);
      });
  }, [activeMenu, classPage, currentUser]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' || activeMenu !== 'classes') return;

    fetchAdminTeachers()
      .then(data => {
        setTeachers(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        setClassError(err.message || '获取教师列表失败，请重试。');
      });
  }, [activeMenu, currentUser]);

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

  const openCreateClassDialog = () => {
    setEditingClass(null);
    setClassForm({ name: '', classCode: '', teacherUserId: teachers[0]?.id ? String(teachers[0].id) : '' });
    setClassError('');
    setClassDialogOpen(true);
  };

  const openEditClassDialog = (classItem) => {
    setEditingClass(classItem);
    setClassForm({
      name: classItem.name || '',
      classCode: classItem.class_code || '',
      teacherUserId: classItem.teacher_user_id ? String(classItem.teacher_user_id) : ''
    });
    setClassError('');
    setClassDialogOpen(true);
  };

  const closeClassDialog = () => {
    if (classSaving) return;

    setClassDialogOpen(false);
    setEditingClass(null);
    setClassForm({ name: '', classCode: '', teacherUserId: '' });
  };

  const handleClassSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      name: classForm.name.trim(),
      classCode: classForm.classCode.trim(),
      teacherUserId: Number(classForm.teacherUserId)
    };

    if (!payload.name) {
      setClassError('班级名称不能为空。');
      return;
    }

    if (!/^[A-Za-z0-9]{4,10}$/.test(payload.classCode)) {
      setClassError('班级码必须为 4~10 位英文字母或数字。');
      return;
    }

    if (!payload.teacherUserId) {
      setClassError('请选择教师。');
      return;
    }

    try {
      setClassSaving(true);
      setClassError('');
      if (editingClass) {
        await updateAdminClass(editingClass.id, payload);
      } else {
        await createAdminClass(payload);
      }
      setClassDialogOpen(false);
      setEditingClass(null);
      setClassForm({ name: '', classCode: '', teacherUserId: '' });
      setClassLoading(true);
      const data = await fetchAdminClasses(classPage, PAGE_SIZE);
      setClasses(Array.isArray(data.items) ? data.items : []);
      setClassTotal(Number(data.total || 0));
      setClassTotalPages(Math.max(1, Number(data.totalPages || 1)));
    } catch (err) {
      setClassError(err.message || '保存班级失败，请重试。');
    } finally {
      setClassSaving(false);
      setClassLoading(false);
    }
  };

  const handleDeleteClass = async (classItem) => {
    if (!window.confirm(`确定删除班级“${classItem.name}”？该班级下学生会变为未分班。`)) return;

    try {
      setClassDeletingId(classItem.id);
      setClassError('');
      await deleteAdminClass(classItem.id);
      const nextPage = classes.length === 1 ? Math.max(1, classPage - 1) : classPage;
      if (nextPage !== classPage) {
        setClassPage(nextPage);
      } else {
        setClassLoading(true);
        const data = await fetchAdminClasses(nextPage, PAGE_SIZE);
        setClasses(Array.isArray(data.items) ? data.items : []);
        setClassTotal(Number(data.total || 0));
        setClassTotalPages(Math.max(1, Number(data.totalPages || 1)));
      }
    } catch (err) {
      setClassError(err.message || '删除班级失败，请重试。');
    } finally {
      setClassDeletingId(null);
      setClassLoading(false);
    }
  };

  const openClassStudentsDialog = async (classItem) => {
    setClassStudentsDialog(classItem);
    setClassStudents([]);
    setClassStudentsError('');
    setClassStudentsLoading(true);

    try {
      const data = await fetchAdminClassStudents(classItem.id);
      setClassStudents(Array.isArray(data.students) ? data.students : []);
    } catch (err) {
      setClassStudentsError(err.message || '获取班级学生列表失败，请重试。');
    } finally {
      setClassStudentsLoading(false);
    }
  };

  const closeClassStudentsDialog = () => {
    setClassStudentsDialog(null);
    setClassStudents([]);
    setClassStudentsError('');
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

  const formatUserClass = (user) => {
    if (!user.class_code) return '未分班';
    if (user.class_name) return user.class_name;
    return `无效：${user.class_code}`;
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
            {activeMenu === 'classes' && (
              <p className="text-xs text-slate-400 font-bold mt-0.5">共 {classTotal} 个班级</p>
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
          {activeMenu === 'classes' && (
            <button
              type="button"
              onClick={openCreateClassDialog}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              disabled={classLoading}
            >
              <Plus className="w-4 h-4" />
              <span>新建班级</span>
            </button>
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
                      <th className="px-4 py-3 text-left font-black">班级</th>
                      <th className="px-4 py-3 text-left font-black">性别</th>
                      <th className="px-4 py-3 text-left font-black">生日</th>
                      <th className="px-4 py-3 text-left font-black">角色</th>
                      <th className="px-4 py-3 text-left font-black">创建时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-slate-400 font-bold" colSpan="7">加载中...</td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-rose-500 font-bold" colSpan="7">{error}</td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-slate-400 font-bold" colSpan="7">暂无用户</td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-800">{user.username || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{user.phone || '-'}</td>
                          <td className={`px-4 py-3 ${user.class_code && !user.class_name ? 'text-rose-500 font-bold' : 'text-slate-600'}`}>{formatUserClass(user)}</td>
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
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-black">班级名称</th>
                      <th className="px-4 py-3 text-left font-black">班级码</th>
                      <th className="px-4 py-3 text-left font-black">教师</th>
                      <th className="px-4 py-3 text-left font-black">班级人数</th>
                      <th className="px-4 py-3 text-left font-black">创建时间</th>
                      <th className="px-4 py-3 text-right font-black">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classLoading ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-slate-400 font-bold" colSpan="6">加载中...</td>
                      </tr>
                    ) : classError ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-rose-500 font-bold" colSpan="6">{classError}</td>
                      </tr>
                    ) : classes.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-slate-400 font-bold" colSpan="6">暂无班级</td>
                      </tr>
                    ) : (
                      classes.map((classItem) => (
                        <tr key={classItem.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-800">{classItem.name || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{classItem.class_code || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{classItem.teacher_name || '-'}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openClassStudentsDialog(classItem)}
                              className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700 transition hover:bg-indigo-100"
                            >
                              {Number(classItem.student_count || 0)} 人
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatDateTime(classItem.created_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditClassDialog(classItem)}
                                className="w-9 h-9 rounded-lg border border-slate-200 inline-flex items-center justify-center text-slate-600 transition hover:bg-slate-100"
                                title="编辑"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClass(classItem)}
                                disabled={classDeletingId === classItem.id}
                                className="w-9 h-9 rounded-lg border border-rose-100 inline-flex items-center justify-center text-rose-500 transition hover:bg-rose-50 disabled:opacity-50"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">第 {classPage} / {classTotalPages} 页</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setClassPage((current) => Math.max(1, current - 1))}
                    disabled={classPage <= 1 || classLoading}
                    className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
                    title="上一页"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassPage((current) => Math.min(classTotalPages, current + 1))}
                    disabled={classPage >= classTotalPages || classLoading}
                    className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
                    title="下一页"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {classStudentsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-5xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-black text-slate-900">{classStudentsDialog.name} 学生列表</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">班级码：{classStudentsDialog.class_code || '-'}</p>
              </div>
              <button
                type="button"
                onClick={closeClassStudentsDialog}
                className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-500 transition hover:bg-slate-100"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-5">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-black">用户名</th>
                    <th className="px-4 py-3 text-left font-black">手机号</th>
                    <th className="px-4 py-3 text-left font-black">性别</th>
                    <th className="px-4 py-3 text-left font-black">生日</th>
                    <th className="px-4 py-3 text-left font-black">创建时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classStudentsLoading ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-400 font-bold" colSpan="5">加载中...</td>
                    </tr>
                  ) : classStudentsError ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-rose-500 font-bold" colSpan="5">{classStudentsError}</td>
                    </tr>
                  ) : classStudents.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-400 font-bold" colSpan="5">暂无学生</td>
                    </tr>
                  ) : (
                    classStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-800">{student.username || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{student.phone || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{formatGender(student.gender)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(student.birthday)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(student.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {classDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-black text-slate-900">{editingClass ? '编辑班级' : '新建班级'}</h3>
              <button
                type="button"
                onClick={closeClassDialog}
                className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-500 transition hover:bg-slate-100"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleClassSubmit} className="p-5 space-y-4">
              <label className="block">
                <span className="block text-xs font-black text-slate-500 mb-1.5">班级名称</span>
                <input
                  type="text"
                  value={classForm.name}
                  onChange={(e) => setClassForm((current) => ({ ...current, name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  disabled={classSaving}
                />
              </label>

              <label className="block">
                <span className="block text-xs font-black text-slate-500 mb-1.5">班级码</span>
                <input
                  type="text"
                  value={classForm.classCode}
                  onChange={(e) => setClassForm((current) => ({ ...current, classCode: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  disabled={classSaving}
                />
              </label>

              <label className="block">
                <span className="block text-xs font-black text-slate-500 mb-1.5">教师</span>
                <select
                  value={classForm.teacherUserId}
                  onChange={(e) => setClassForm((current) => ({ ...current, teacherUserId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  disabled={classSaving}
                >
                  <option value="">请选择教师</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.username}</option>
                  ))}
                </select>
              </label>

              {editingClass && editingClass.class_code !== classForm.classCode.trim() && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">修改班级码会同步更新该班级下学生的班级码。</p>
              )}

              {classError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">{classError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeClassDialog}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100"
                  disabled={classSaving}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  disabled={classSaving}
                >
                  <Save className="w-4 h-4" />
                  <span>{classSaving ? '保存中...' : '保存'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
