import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Plus, Trash2, Calendar, User, LogOut, Smile, Sparkles, Star, Palette, Pencil, Copy } from 'lucide-react';
// 导入网络请求工具
import { fetchMyProjects, copyProject } from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // === 教师模式新增状态 ===
  const [students, setStudents] = useState([]); // 存放学生列表
  const [selectedStudentId, setSelectedStudentId] = useState('me'); // 当前选中的学生 ID，默认为 'me' (自己)

  // 定义马卡龙卡通色系，让项目卡片五彩缤纷
  const cardStyles = [
    { border: 'border-sky-300', bg: 'bg-sky-50/40', text: 'text-sky-600', btnHover: 'hover:bg-sky-100', badge: 'bg-sky-100 text-sky-700 border-sky-200' },
    { border: 'border-amber-300', bg: 'bg-amber-50/40', text: 'text-amber-600', btnHover: 'hover:bg-amber-100', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    { border: 'border-emerald-300', bg: 'bg-emerald-50/40', text: 'text-emerald-600', btnHover: 'hover:bg-emerald-100', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { border: 'border-rose-300', bg: 'bg-rose-50/40', text: 'text-rose-600', btnHover: 'hover:bg-rose-100', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
    { border: 'border-purple-300', bg: 'bg-purple-50/40', text: 'text-purple-600', btnHover: 'hover:bg-purple-100', badge: 'bg-purple-100 text-purple-700 border-purple-200' }
  ];

  const formatLocalTime = (isoString) => {
    if (!isoString) return '神秘时间';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '神秘时间';

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  // 1. 初始化：获取用户信息
  useEffect(() => {
    // 1. 从本地缓存中获取当前成功登录的用户元数据
    const userJson = localStorage.getItem('teaching_user');
    let parsedUser = null;
    if (userJson) {
      try {
        parsedUser = JSON.parse(userJson);
        setCurrentUser(parsedUser);
      } catch (e) {
        console.error('解析用户信息失败', e);
      }
    }

    // 如果当前登录的是教师，拉取学生列表
    if (parsedUser && parsedUser.role === 'teacher') {
      const token = localStorage.getItem('teaching_token');
      fetch('/api/auth/students', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setStudents(data);
          }
        })
        .catch(err => console.error('拉取学生列表失败', err));
    }
  }, []);

  // 2. 监听选中学生的变化，动态拉取作品列表
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    // 如果选中的是 'me'，传入 null（拉取自己的项目）；否则传入具体的学生 ID
    const targetStudentId = selectedStudentId === 'me' ? null : selectedStudentId;

    fetchMyProjects(targetStudentId)
      .then(data => {
        if (data) setProjects(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('拉取项目列表失败', err);
        setLoading(false);
      });
  }, [selectedStudentId, currentUser]);

  // 3. 创建新项目逻辑
  const handleCreateProject = async () => {
    const projectName = prompt('🎨 想要给你的新作品起个什么酷炫的名字呢？', '我的奇妙创意');
    if (!projectName || !projectName.trim()) return;

    try {
      const token = localStorage.getItem('teaching_token');
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: projectName })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '新建项目失败了，请重试哦！');

      // 创建成功后，直接重定向至新项目编辑器
      navigate(`/editor/${data.id}`);
    } catch (err) {
      alert(err.message);
    }
  };

  // 4. 删除项目逻辑
  const handleDeleteProject = async (e, id) => {
    e.stopPropagation(); // 阻止卡片点击跳转到编辑页
    if (!confirm('⚠️ 确定要跟这个心爱的小作品说再见吗？一旦删除就无法找回了哦！')) return;

    try {
      const token = localStorage.getItem('teaching_token');
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '删除项目失败了，再试一次吧！');

      // 更新前端状态列表
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  // 5. 修改项目名称逻辑
  const handleRenameProject = async (e, id, currentName) => {
    e.stopPropagation(); // 阻止卡片点击跳转到编辑器
    const newName = prompt('🎨 想要给你的作品换个什么酷炫的新名字呢？', currentName);
    if (!newName || !newName.trim() || newName === currentName) return;

    try {
      const token = localStorage.getItem('teaching_token');
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '重命名失败了，请重试哦！');

      // 更新 React 本地状态列表，使界面立即呈现新名字
      setProjects(projects.map(p => p.id === id ? { ...p, name: newName } : p));
    } catch (err) {
      alert(err.message);
    }
  };
  
  const handleCopyProject = async (e, project) => {
    e.stopPropagation();
    const studentName = students.find(s => s.id === selectedStudentId)?.username || '学生';
    if (!confirm(`确定要把「${project.name}」复制成自己的项目吗？\n复制后的名称为：${project.name} - 来自${studentName}`)) return;

    try {
      setLoading(true);
      await copyProject(project.id);
      const myProjects = await fetchMyProjects();
      if (myProjects) setProjects(myProjects);
      setSelectedStudentId('me');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 6. 退出登录逻辑
  const handleLogout = () => {
    if (confirm('🚪 确定要离开我们的编程乐园基地吗？今天学得很棒，下次再见哦！')) {
      localStorage.removeItem('teaching_token');
      localStorage.removeItem('teaching_user');
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-indigo-50 to-pink-100 text-slate-800 flex flex-col font-sans">
      
      {/* 顶部全局导航栏 */}
      <header className="bg-white/95 border-b-4 border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-50 select-none shadow-[0_4px_12px_rgba(0,0,0,0.03)] backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-400 p-2 rounded-2xl shadow-[0_4px_0_0_#4f46e5] border border-indigo-500">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-black tracking-wide text-slate-800 flex items-center gap-1.5">
            p5.js 创意编程乐园
            <span className="text-xs bg-yellow-300 text-amber-950 font-extrabold px-2 py-0.5 rounded-full rotate-2">少儿版</span>
          </span>
        </div>

        <div className="flex items-center space-x-6">
          {/* 显示当前登录用户名 - 多角色微章样式 */}
          <div className="flex items-center space-x-2 bg-indigo-50/80 px-3.5 py-1.5 rounded-2xl border-2 border-indigo-200 shadow-sm">
            <div className="bg-indigo-200 p-1 rounded-full">
              <User className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="text-xs font-black text-indigo-950">
              {currentUser ? currentUser.username : '加载中...'}
            </span>
            <span className="text-[10px] bg-yellow-400 text-amber-950 px-2.5 py-0.5 rounded-full font-black tracking-wider shadow-sm">
              {/* 角色判断 */}
              {currentUser?.role === 'teacher' ? '教师' : currentUser?.role === 'admin' ? '管理员' : '小极客'}
            </span>
          </div>

          {/* 登出按钮 */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 text-slate-400 hover:text-rose-500 text-xs font-bold transition duration-150"
            title="离开基地"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>离开基地</span>
          </button>
        </div>
      </header>

      {/* 页面主体内容区 */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
        
        {/* === 【教师专属】学生看板控制区 === */}
        {currentUser?.role === 'teacher' && (
          <div className="mb-8 bg-white/80 border-4 border-indigo-100 rounded-[2rem] p-5 shadow-[0_6px_16px_rgba(0,0,0,0.02)]">
            <h3 className="text-xs font-black text-indigo-950 mb-3.5 flex items-center gap-2">
              <User className="w-4.5 h-4.5 text-indigo-500" />
              <span>👩‍🏫 班级学生作品督导看板（点击下方学生名字可以查看其作品哦）：</span>
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {/* “我”的选项卡 */}
              <button
                onClick={() => setSelectedStudentId('me')}
                className={`px-4 py-2 rounded-2xl text-xs font-black border-2 transition-all transform active:translate-y-0.5 ${
                  selectedStudentId === 'me'
                    ? 'bg-indigo-400 border-indigo-500 text-white shadow-md'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                }`}
              >
                🙋‍♂️ 我 (我的项目)
              </button>

              {/* 循环渲染学生列表 */}
              {students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-black border-2 transition-all transform active:translate-y-0.5 ${
                    selectedStudentId === student.id
                      ? 'bg-indigo-400 border-indigo-500 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  👤 {student.username}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 内容标题区 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-5 border-b-2 border-slate-200/50">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <span>
                {selectedStudentId === 'me' ? '🎨 我的创意工坊' : `📂 正在督导 [${students.find(s => s.id === selectedStudentId)?.username}] 的作品`}
              </span>
              <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
            </h1>
            <p className="text-xs font-bold text-slate-400 mt-1">
              {selectedStudentId === 'me' 
                ? '在这里收集你所有的精彩想法，开始天马行空的创意代码吧！' 
                : '请保护好学生作品，在这里您可以直接阅览并运行他们的精彩代码。'}
            </p>
          </div>
          
          {/* 3D 新建项目按钮（仅在看自己的项目时显示，防止老师去给学生建项目） */}
          {selectedStudentId === 'me' && (
            <button
              onClick={handleCreateProject}
              className="flex items-center space-x-2 bg-amber-400 hover:bg-amber-300 text-amber-950 px-5 py-3 rounded-2xl font-black transition-all transform active:translate-y-1 active:border-b-0 border-b-4 border-amber-600 shadow-[0_4px_8px_rgba(0,0,0,0.05)] text-sm"
            >
              <Plus className="w-5 h-5 stroke-[3px]" />
              <span>动手做个新作品</span>
            </button>
          )}
        </div>

        {/* 项目列表渲染 */}
        {loading ? (
          <div className="text-center py-24 text-slate-400 font-bold text-sm flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <span>正在召唤作品集，请稍候...</span>
          </div>
        ) : projects.length === 0 ? (
          // 空状态 - 卡通绘本手绘框样式
          <div className="text-center py-20 border-4 border-dashed border-slate-300 rounded-[2.5rem] bg-white/70 shadow-inner max-w-lg mx-auto">
            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-indigo-200">
              <Smile className="w-10 h-10 text-indigo-400" />
            </div>
            <p className="text-slate-500 font-black text-base mb-2">
              {selectedStudentId === 'me' ? '你的画板还是空空的哦！' : '该同学还没有创建作品哦！'}
            </p>
            <p className="text-slate-400 text-xs font-bold mb-6">
              {selectedStudentId === 'me' ? '点击下方，快来绘制你在数字世界的第一个奇迹吧！' : '等他写好代码运行后，这里就会出现他的作品卡片。'}
            </p>
            {selectedStudentId === 'me' && (
              <button
                onClick={handleCreateProject}
                className="bg-indigo-400 hover:bg-indigo-300 text-white px-6 py-3 rounded-2xl text-sm font-black transition transform active:translate-y-1 border-b-4 border-indigo-600 shadow-md"
              >
                🚀 创造第一个作品
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => {
              // 为当前卡片挑选一套专属的主题样式
              const style = cardStyles[index % cardStyles.length];
              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/editor/${project.id}`)}
                  className={`bg-white border-4 ${style.border} ${style.bg} hover:-translate-y-1.5 rounded-[2rem] p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between group h-44 shadow-sm hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] relative overflow-hidden`}
                >
                  {/* 右上角斜挎装饰，像一个小书签 */}
                  <div className={`absolute top-0 right-0 w-12 h-12 pointer-events-none opacity-20`}>
                    <Star className="w-full h-full text-slate-400 fill-current translate-x-3 -translate-y-3" />
                  </div>

                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className={`font-black text-base text-slate-800 ${style.text} truncate w-4/5`}>
                        ✨ {project.name}
                      </h3>
                      
                      {selectedStudentId !== 'me' && (
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={(e) => handleCopyProject(e, project)}
                            className="text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 p-1.5 rounded-xl transition duration-150"
                            title="复制成我的项目"
                          >
                            <Copy className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      )}

                      {/* 操作按钮区（仅在看自己的项目时显示，防止老师误修改或误删学生作品） */}
                      {selectedStudentId === 'me' && (
                        <div className="flex items-center space-x-1 shrink-0">
                          {/* 编辑名称画笔按钮 */}
                          <button
                            onClick={(e) => handleRenameProject(e, project.id, project.name)}
                            className="text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 p-1.5 rounded-xl transition duration-150"
                            title="修改作品名称"
                          >
                            <Pencil className="w-4.5 h-4.5" />
                          </button>
                          
                          {/* 垃圾桶按钮 */}
                          <button
                            onClick={(e) => handleDeleteProject(e, project.id)}
                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-xl transition duration-150"
                            title="删除作品"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono tracking-wider">编号: {project.id}</p>
                  </div>
                  
                  {/* 底栏修改为彩色标签与温馨小日历 */}
                  <div className="flex justify-between items-center mt-4 border-t-2 border-slate-100 pt-3 text-[11px] font-bold text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>更新时间: {formatLocalTime(project.updated_at)}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${style.badge}`}>
                      p5.js 魔法箱
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
