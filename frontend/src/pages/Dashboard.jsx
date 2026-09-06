import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Folder, GripVertical, MoveRight, Plus, Trash2, User, LogOut, Sparkles, Star, Palette, Pencil, Copy, ShieldCheck, Send } from 'lucide-react';
import { ProjectOrganizer } from '@tigao/organizer-react';
import '@tigao/organizer-react/styles.css';
import './Dashboard.css';
// 导入网络请求工具
import { copyProject, distributeProjectToClass, fetchMyClasses, fetchStudentsByClass } from '../services/api';
import { createP5ProjectOrganizerAdapter } from '../project-organizer-adapter.mjs';
import { useAppDialog } from '../hooks/useAppDialog';
import ProfileDialog from '../components/Common/ProfileDialog';
import LanguageSelect from '../components/Common/LanguageSelect';
import ContactTeacherButton from '../components/Common/ContactTeacherButton';
import { useLanguage } from '../i18n/LanguageContext';

const DASHBOARD_SELECTED_CLASS_KEY = 'teaching_dashboard_selected_class_code';
const DASHBOARD_SELECTED_STUDENT_KEY = 'teaching_dashboard_selected_student_id';
const DASHBOARD_CURRENT_GROUP_KEY = 'teaching_dashboard_current_group_id';
const DASHBOARD_CURRENT_GROUP_PATHS_KEY_PREFIX = 'teaching_dashboard_current_group_paths_v2';

const canUseTeacherFeatures = (user) => user?.role === 'teacher' || user?.role === 'admin';

const normalizeDashboardGroupId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const groupId = Number(value);
  return Number.isFinite(groupId) && groupId > 0 ? groupId : null;
};

const getDashboardGroupOwnerKey = (studentId) => studentId === 'me' ? 'me' : `student:${studentId}`;
const getDashboardGroupPathsStorageKey = (userId) => `${DASHBOARD_CURRENT_GROUP_PATHS_KEY_PREFIX}:${userId}`;

const getStoredDashboardUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('teaching_user') || 'null')?.id || null;
  } catch (e) {
    return null;
  }
};

const readSavedDashboardGroupId = (userId, studentId) => {
  if (!userId) return undefined;

  try {
    const savedPaths = JSON.parse(localStorage.getItem(getDashboardGroupPathsStorageKey(userId)) || '{}');
    const ownerKey = getDashboardGroupOwnerKey(studentId);
    if (!savedPaths || typeof savedPaths !== 'object' || Array.isArray(savedPaths) || !Object.prototype.hasOwnProperty.call(savedPaths, ownerKey)) {
      return undefined;
    }
    return normalizeDashboardGroupId(savedPaths[ownerKey]);
  } catch (e) {
    console.error('解析作品组路径失败', e);
    return undefined;
  }
};

const saveDashboardGroupId = (userId, studentId, groupId) => {
  if (!userId) return;

  const storageKey = getDashboardGroupPathsStorageKey(userId);
  let savedPaths = {};
  try {
    const parsedPaths = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (parsedPaths && typeof parsedPaths === 'object' && !Array.isArray(parsedPaths)) {
      savedPaths = parsedPaths;
    }
  } catch (e) {
    console.error('解析作品组路径失败', e);
  }

  savedPaths[getDashboardGroupOwnerKey(studentId)] = normalizeDashboardGroupId(groupId);
  localStorage.setItem(storageKey, JSON.stringify(savedPaths));
};

// 定义马卡龙卡通色系，让项目卡片五彩缤纷
const ORGANIZER_ICONS = {
  group: (props) => <Folder {...props} className="w-6 h-6" />,
  project: (props) => <Star {...props} className="w-6 h-6" />,
  drag: (props) => <GripVertical {...props} className="w-5 h-5" />,
  up: (props) => <ArrowUp {...props} className="w-5 h-5" />,
  down: (props) => <ArrowDown {...props} className="w-5 h-5" />,
  rename: (props) => <Pencil {...props} className="w-5 h-5" />,
  move: (props) => <MoveRight {...props} className="w-5 h-5" />,
  delete: (props) => <Trash2 {...props} className="w-5 h-5" />
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const appDialog = useAppDialog();
  const { isEnglish } = useLanguage();
  const [currentGroupId, setCurrentGroupId] = useState(() => {
    const stateGroupId = location.state?.dashboardGroupId;
    if (stateGroupId !== undefined) return normalizeDashboardGroupId(stateGroupId);

    const savedStudentId = localStorage.getItem(DASHBOARD_SELECTED_STUDENT_KEY) || 'me';
    const savedGroupId = readSavedDashboardGroupId(getStoredDashboardUserId(), savedStudentId);
    if (savedGroupId !== undefined) return savedGroupId;

    const legacyGroupId = localStorage.getItem(DASHBOARD_CURRENT_GROUP_KEY) || sessionStorage.getItem(DASHBOARD_CURRENT_GROUP_KEY);
    return normalizeDashboardGroupId(legacyGroupId);
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [organizerRevision, setOrganizerRevision] = useState(0);
  const [organizerActionPending, setOrganizerActionPending] = useState(false);

  // === 教师模式新增状态 ===
  const [teacherClasses, setTeacherClasses] = useState([]); // 存放教师绑定的班级列表
  const [selectedClassCode, setSelectedClassCode] = useState(() => localStorage.getItem(DASHBOARD_SELECTED_CLASS_KEY) || ''); // 当前选中的班级码
  const [students, setStudents] = useState([]); // 存放学生列表
  const [studentsLoaded, setStudentsLoaded] = useState(false); // 标记当前班级学生列表是否已加载
  const [selectedStudentId, setSelectedStudentId] = useState(() => localStorage.getItem(DASHBOARD_SELECTED_STUDENT_KEY) || 'me'); // 当前选中的学生 ID，默认为 'me' (自己)

  // 定义马卡龙卡通色系，让项目卡片五彩缤纷
  const currentUserRef = useRef(currentUser);
  const studentsRef = useRef(students);
  const currentGroupIdRef = useRef(currentGroupId);
  const appDialogRef = useRef(appDialog);
  const dashboardStateRef = useRef(null);
  currentUserRef.current = currentUser;
  studentsRef.current = students;
  currentGroupIdRef.current = currentGroupId;
  appDialogRef.current = appDialog;
  dashboardStateRef.current = {
    currentGroupId,
    currentUser,
    isEnglish,
    selectedClassCode,
    selectedStudentId,
    students,
    teacherClasses
  };

  const findSelectedStudent = () => students.find(s => String(s.id) === String(selectedStudentId));
  const findSelectedClass = () => teacherClasses.find(c => String(c.class_code) === String(selectedClassCode));
  const restoreProjectOwner = (studentId) => {
    const userId = currentUser?.id || getStoredDashboardUserId();
    const savedGroupId = readSavedDashboardGroupId(userId, studentId);
    setCurrentGroupId(savedGroupId === undefined ? null : savedGroupId);
    setSelectedStudentId(studentId);
  };
  const selectProjectOwner = (studentId) => {
    const userId = currentUser?.id || getStoredDashboardUserId();
    saveDashboardGroupId(userId, selectedStudentId, currentGroupId);
    restoreProjectOwner(studentId);
  };
  const handleStudentChange = (studentId) => {
    selectProjectOwner(studentId);
  };

  const resolveOrganizerOwner = useCallback((ownerId) => {
    if (ownerId === null || ownerId === undefined) {
      const user = currentUserRef.current;
      return user?.id ? { id: Number(user.id), username: user.username } : null;
    }

    const student = studentsRef.current.find((item) => String(item.id) === String(ownerId));
    return { id: Number(ownerId), username: student?.username || (isEnglish ? 'Student' : '学生') };
  }, [isEnglish]);

  const openOrganizerProject = useCallback((id) => {
    navigate(`/editor/${id}`, { state: { dashboardGroupId: currentGroupIdRef.current } });
  }, [navigate]);

  const organizerAdapter = useMemo(() => createP5ProjectOrganizerAdapter({
    resolveOwner: resolveOrganizerOwner,
    openProject: openOrganizerProject,
    openCreatedProject: true
  }), [openOrganizerProject, resolveOrganizerOwner]);

  const handleCurrentParentIdChange = useCallback((parentId) => {
    setCurrentGroupId(parentId);
  }, []);

  const handleOrganizerError = useCallback((error) => {
    if (error?.status === 404 && currentGroupIdRef.current !== null) {
      setCurrentGroupId(null);
    }
  }, []);

  const organizerMessages = useMemo(() => isEnglish ? {
    title: 'Projects',
    root: 'Root group',
    groups: 'Project groups',
    projects: 'Projects',
    createGroup: 'Create group',
    createProject: 'Create project',
    groupName: 'Group name',
    projectName: 'Project name',
    open: 'Open',
    rename: 'Rename',
    move: 'Move',
    delete: 'Delete',
    moveUp: 'Move up',
    moveDown: 'Move down',
    drag: 'Drag to reorder or move',
    dropInside: 'Drop inside this group',
    loading: 'Loading projects…',
    loadingTargets: 'Loading destinations…',
    empty: 'This group is empty.',
    readOnly: 'This student project collection is read-only.',
    saving: 'Saving changes…',
    retry: 'Retry',
    cancel: 'Cancel',
    confirm: 'Confirm',
    renameTitle: 'Rename item',
    moveTitle: 'Move item',
    deleteTitle: 'Delete item',
    deleteQuestion: 'Delete this item?',
    chooseDestination: 'Choose a destination',
    structureBlocked: 'Editing is disabled because the group structure is invalid.',
    noDestinations: 'No valid destinations are available.'
  } : {
    title: '作品管理',
    root: '根作品组',
    groups: '作品组',
    projects: '作品',
    createGroup: '新建作品组',
    createProject: '新建作品',
    groupName: '作品组名称',
    projectName: '作品名称',
    open: '打开',
    rename: '重命名',
    move: '移动',
    delete: '删除',
    moveUp: '上移',
    moveDown: '下移',
    drag: '拖放排序或移动',
    dropInside: '放入此作品组',
    loading: '正在召唤作品集，请稍候…',
    loadingTargets: '正在读取目标作品组…',
    empty: '这个作品组还是空空的哦！',
    readOnly: '当前正在查看学生作品，只能浏览和复制。',
    saving: '正在保存更改…',
    retry: '重试',
    cancel: '取消',
    confirm: '确认',
    renameTitle: '修改名称',
    moveTitle: '移动作品',
    deleteTitle: '删除作品',
    deleteQuestion: '确定删除这个项目吗？',
    chooseDestination: '请选择目标作品组',
    structureBlocked: '作品组结构异常，编辑功能已停用。',
    noDestinations: '没有可用的目标作品组。'
  }, [isEnglish]);

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

    // 如果当前登录的是教师，拉取班级列表
    if (parsedUser && canUseTeacherFeatures(parsedUser)) {
      fetchMyClasses()
        .then(data => {
          const classes = Array.isArray(data) ? data : [];
          const savedClassCode = localStorage.getItem(DASHBOARD_SELECTED_CLASS_KEY) || '';
          const nextClassCode = classes.some(item => item.class_code === savedClassCode)
            ? savedClassCode
            : (classes[0]?.class_code || '');
          setTeacherClasses(classes);
          setSelectedClassCode(nextClassCode);
          if (nextClassCode) {
            localStorage.setItem(DASHBOARD_SELECTED_CLASS_KEY, nextClassCode);
          } else {
            localStorage.removeItem(DASHBOARD_SELECTED_CLASS_KEY);
            localStorage.setItem(DASHBOARD_SELECTED_STUDENT_KEY, 'me');
            if (selectedStudentId !== 'me') restoreProjectOwner('me');
          }
        })
        .catch(err => console.error('拉取班级列表失败', err));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_SELECTED_STUDENT_KEY, selectedStudentId);
  }, [selectedStudentId]);

  useEffect(() => {
    if (!currentUser?.id) return;

    saveDashboardGroupId(currentUser.id, selectedStudentId, currentGroupId);
    localStorage.removeItem(DASHBOARD_CURRENT_GROUP_KEY);
    sessionStorage.removeItem(DASHBOARD_CURRENT_GROUP_KEY);
  }, [currentGroupId, currentUser, selectedStudentId]);

  useEffect(() => {
    if (location.state?.dashboardGroupId === undefined) return;

    const nextState = { ...location.state };
    delete nextState.dashboardGroupId;
    navigate(location.pathname, {
      replace: true,
      state: Object.keys(nextState).length > 0 ? nextState : null
    });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!currentUser || !canUseTeacherFeatures(currentUser)) return;

    if (!selectedClassCode) {
      setStudents([]);
      setStudentsLoaded(true);
      if (selectedStudentId !== 'me') restoreProjectOwner('me');
      return;
    }

    localStorage.setItem(DASHBOARD_SELECTED_CLASS_KEY, selectedClassCode);
    setStudentsLoaded(false);
    fetchStudentsByClass(selectedClassCode)
      .then(data => {
        const nextStudents = Array.isArray(data) ? data : [];
        const savedStudentId = localStorage.getItem(DASHBOARD_SELECTED_STUDENT_KEY) || 'me';
        const nextStudentId = savedStudentId === 'me' || nextStudents.some(item => String(item.id) === String(savedStudentId))
          ? savedStudentId
          : 'me';
        setStudents(nextStudents);
        if (String(nextStudentId) !== String(selectedStudentId)) restoreProjectOwner(nextStudentId);
        setStudentsLoaded(true);
      })
      .catch(err => {
        console.error('拉取班级学生列表失败', err);
        setStudents([]);
        if (selectedStudentId !== 'me') restoreProjectOwner('me');
        setStudentsLoaded(true);
      });
  }, [currentUser, selectedClassCode]);

  const handleClassChange = (classCode) => {
    setSelectedClassCode(classCode);
    selectProjectOwner('me');
    localStorage.setItem(DASHBOARD_SELECTED_STUDENT_KEY, 'me');
    if (classCode) {
      localStorage.setItem(DASHBOARD_SELECTED_CLASS_KEY, classCode);
    } else {
      localStorage.removeItem(DASHBOARD_SELECTED_CLASS_KEY);
    }
  };

  // 2. 监听选中学生的变化，动态拉取作品列表
  useEffect(() => {
    if (!currentUser || canUseTeacherFeatures(currentUser) || selectedStudentId === 'me') return;
    restoreProjectOwner('me');
  }, [currentUser, selectedStudentId]);

  // 如果选中的是 'me'，传入 null（拉取自己的项目）；否则传入具体的学生 ID
  const organizerOwnerId = selectedStudentId === 'me' ? null : Number(selectedStudentId);
  const organizerReady = Boolean(currentUser) && (selectedStudentId === 'me' || studentsLoaded);

  // 3. 创建新项目逻辑
  const handleCreateProject = async () => {
    const projectName = await appDialog.prompt({
      disableAutoTranslate: true,
      title: isEnglish ? 'Create New Project' : '创建新作品',
      message: isEnglish ? '🎨 What cool name should this new project have?' : '🎨 想要给你的新作品起个什么酷炫的名字呢？',
      defaultValue: isEnglish ? 'My Amazing Idea' : '我的奇妙创意',
      placeholder: isEnglish ? 'Enter a project name' : '请输入作品名称',
      confirmText: isEnglish ? 'Start Creating' : '开始创作',
      cancelText: isEnglish ? 'Cancel' : '取消'
    });
    if (!projectName || !projectName.trim()) return;

    try {
      setOrganizerActionPending(true);
      await organizerAdapter.createProject({
        name: projectName.trim(),
        parentId: currentGroupId,
        templateId: null
      });
      // 创建成功后，直接重定向至新项目编辑器
    } catch (err) {
      await appDialog.alert({
        title: '创建失败',
        message: err.message
      });
    } finally {
      setOrganizerActionPending(false);
    }
  };

  const handleCreateGroup = async () => {
    const groupName = await appDialog.prompt({
      title: '创建作品组',
      message: '给这个作品组起个清楚的名字吧。',
      defaultValue: '新的作品组',
      placeholder: '请输入作品组名称',
      confirmText: '创建作品组'
    });
    if (!groupName || !groupName.trim()) return;

    try {
      setOrganizerActionPending(true);
      await organizerAdapter.createGroup({ name: groupName.trim(), parentId: currentGroupId });
      setOrganizerRevision((revision) => revision + 1);
    } catch (err) {
      await appDialog.alert({
        title: '创建失败',
        message: err.message
      });
    } finally {
      setOrganizerActionPending(false);
    }
  };

  // 4. 删除项目逻辑
  // 阻止卡片点击跳转到编辑页
  // 更新前端状态列表
  // 5. 修改项目名称逻辑
  // 阻止卡片点击跳转到编辑器
  // 更新 React 本地状态列表，使界面立即呈现新名字
  const handleCopyProject = useCallback(async (e, project) => {
    e.stopPropagation();
    const state = dashboardStateRef.current;
    const dialog = appDialogRef.current;
    const studentName = state.students.find((student) => String(student.id) === String(state.selectedStudentId))?.username || (state.isEnglish ? 'Student' : '学生');
    const confirmed = await dialog.confirm({
      disableAutoTranslate: true,
      title: state.isEnglish ? 'Copy to My Projects' : '复制到我的项目',
      message: state.isEnglish ? `Do you want to copy "${project.name}" to your own projects?` : `确定要把「${project.name}」复制成自己的项目吗？`,
      highlight: state.isEnglish ? `Copied project name: ${project.name} - from ${studentName}` : `复制后的名称为：${project.name} - 来自${studentName}`,
      confirmText: state.isEnglish ? 'Copy Project' : '复制项目'
    });
    if (!confirmed) return;

    try {
      setOrganizerActionPending(true);
      await copyProject(project.id);
      saveDashboardGroupId(state.currentUser?.id || getStoredDashboardUserId(), state.selectedStudentId, state.currentGroupId);
      setCurrentGroupId(null);
      setSelectedStudentId('me');
    } catch (err) {
      await dialog.alert({
        title: state.isEnglish ? 'Copy Failed' : '复制失败',
        message: err.message
      });
    } finally {
      setOrganizerActionPending(false);
    }
  }, []);

  const handleDistributeProject = useCallback(async (e, project) => {
    e.stopPropagation();

    const state = dashboardStateRef.current;
    const dialog = appDialogRef.current;
    const selectedClass = state.teacherClasses.find((classItem) => String(classItem.class_code) === String(state.selectedClassCode));
    if (!selectedClass) {
      await dialog.alert({
        disableAutoTranslate: true,
        title: state.isEnglish ? 'Cannot Distribute' : '无法分发',
        message: state.isEnglish ? 'Please select a class above before distributing the project.' : '请先在上方选择一个班级，再分发项目。'
      });
      return;
    }

    const confirmed = await dialog.confirm({
      disableAutoTranslate: true,
      title: state.isEnglish ? 'Distribute to Class' : '分发给班级',
      message: state.isEnglish ? `Distribute "${project.name}" to all students in "${selectedClass.name}"?` : `确定将「${project.name}」分发给「${selectedClass.name}」的所有学生吗？`,
      highlight: state.isEnglish ? `Students will see this in Root Group after refreshing: from ${state.currentUser?.username || 'Teacher'} - ${project.name}` : `学生刷新后会在根作品组看到：来自${state.currentUser?.username || '老师'} - ${project.name}`,
      confirmText: state.isEnglish ? 'Confirm Distribution' : '确认分发'
    });
    if (!confirmed) return;

    try {
      setOrganizerActionPending(true);
      const result = await distributeProjectToClass(project.id, selectedClass.id);
      await dialog.alert({
        disableAutoTranslate: true,
        title: state.isEnglish ? 'Distribution Complete' : '分发完成',
        message: state.isEnglish ? 'The project has been distributed to the class students.' : (result.message || '项目已分发给班级学生。')
      });
    } catch (err) {
      await dialog.alert({
        disableAutoTranslate: true,
        title: state.isEnglish ? 'Distribution Failed' : '分发失败',
        message: err.message
      });
    } finally {
      setOrganizerActionPending(false);
    }
  }, []);

  const renderProjectExtraActions = useCallback((project) => {
    const state = dashboardStateRef.current;
    if (!canUseTeacherFeatures(state.currentUser)) return null;
    const hasSelectedClass = state.teacherClasses.some((classItem) => String(classItem.class_code) === String(state.selectedClassCode));

    return (
      <button
        type="button"
        onClick={(e) => handleDistributeProject(e, project)}
        disabled={!hasSelectedClass || organizerActionPending}
        className="p5-project-organizer__host-action p5-project-organizer__host-action--distribute"
        title={hasSelectedClass ? '分发给当前班级' : '请先选择班级'}
        aria-label={hasSelectedClass ? '分发给当前班级' : '请先选择班级'}
      >
        <Send className="w-5 h-5" />
      </button>
    );
  }, [handleDistributeProject, organizerActionPending]);

  const renderProjectHostActions = useCallback((project, { readOnly }) => {
    if (!readOnly) return null;

    return (
      <button
        type="button"
        onClick={(e) => handleCopyProject(e, project)}
        disabled={organizerActionPending}
        className="p5-project-organizer__host-action p5-project-organizer__host-action--copy"
        title="复制成我的项目"
        aria-label="复制成我的项目"
      >
        <Copy className="w-5 h-5" />
      </button>
    );
  }, [handleCopyProject, organizerActionPending]);

  // 6. 退出登录逻辑
  const handleLogout = async () => {
    if (await appDialog.confirm({
      disableAutoTranslate: true,
      title: isEnglish ? 'Log Out' : '离开基地',
      message: isEnglish ? '🚪 Are you sure you want to leave our coding playground? Great work today. See you next time!' : '🚪 确定要离开我们的编程乐园基地吗？今天学得很棒，下次再见哦！',
      confirmText: isEnglish ? 'Log Out' : '离开基地'
    })) {
      localStorage.removeItem('teaching_token');
      localStorage.removeItem('teaching_user');
      localStorage.removeItem(DASHBOARD_SELECTED_CLASS_KEY);
      localStorage.removeItem(DASHBOARD_SELECTED_STUDENT_KEY);
      localStorage.removeItem(DASHBOARD_CURRENT_GROUP_KEY);
      sessionStorage.removeItem(DASHBOARD_CURRENT_GROUP_KEY);
      navigate('/login');
    }
  };

  const handleProfileSaved = async (updatedUser) => {
    const nextUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role
    };
    localStorage.setItem('teaching_user', JSON.stringify(nextUser));
    setCurrentUser(nextUser);
    await appDialog.alert({
      title: '保存成功',
      message: '个人信息已经更新啦。'
    });
  };

  // 空状态 - 卡通绘本手绘框样式
  // 为当前卡片挑选一套专属的主题样式
  return (
    <>
    {appDialog.dialog}
    <ProfileDialog
      open={profileDialogOpen}
      onClose={() => setProfileDialogOpen(false)}
      onSaved={handleProfileSaved}
    />
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-indigo-50 to-pink-100 text-slate-800 flex flex-col font-sans">
      
      {/* 顶部全局导航栏 */}
      <header className="bg-white/95 border-b-4 border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-50 select-none shadow-[0_4px_12px_rgba(0,0,0,0.03)] backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-400 p-2 rounded-2xl shadow-[0_4px_0_0_#4f46e5] border border-indigo-500">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-black tracking-wide text-slate-800 flex items-center gap-1.5">
            p5.js 创意编程乐园
          </span>
          <ContactTeacherButton />
        </div>

        <div className="flex items-center space-x-6">
          <LanguageSelect />

          {/* 显示当前登录用户名 - 多角色微章样式 */}
          <button
            type="button"
            onClick={() => setProfileDialogOpen(true)}
            className="flex items-center space-x-2 bg-indigo-50/80 px-3.5 py-1.5 rounded-2xl border-2 border-indigo-200 shadow-sm transition hover:bg-indigo-100 hover:border-indigo-300 active:translate-y-0.5"
            title="修改个人信息"
          >
            <div className="bg-indigo-200 p-1 rounded-full">
              <User className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="text-xs font-black text-indigo-950">
              {currentUser ? <span data-i18n-skip>{currentUser.username}</span> : '加载中...'}
            </span>
            <span className="text-[10px] bg-yellow-400 text-amber-950 px-2.5 py-0.5 rounded-full font-black tracking-wider shadow-sm">
              {/* 角色判断 */}
              {currentUser?.role === 'teacher' ? '教师' : currentUser?.role === 'admin' ? '管理员' : '小极客'}
            </span>
          </button>

          {currentUser?.role === 'admin' && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-2 border-emerald-200 hover:border-emerald-300 px-3.5 py-1.5 rounded-2xl text-xs font-black transition active:translate-y-0.5"
              title="管理"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>管理</span>
            </button>
          )}

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
        {canUseTeacherFeatures(currentUser) && (
          <div className="mb-8 bg-white/80 border-4 border-indigo-100 rounded-[2rem] p-5 shadow-[0_6px_16px_rgba(0,0,0,0.02)]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <h3 className="text-xs font-black text-indigo-950 flex items-center gap-2">
                <User className="w-4.5 h-4.5 text-indigo-500" />
                <span>👩‍🏫 班级学生作品督导看板</span>
              </h3>
              <label className="flex items-center gap-2 text-xs font-black text-slate-500">
                <span>班级</span>
                <select
                  value={selectedClassCode}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="min-w-48 rounded-2xl border-2 border-indigo-100 bg-white px-3 py-2 text-xs font-black text-indigo-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  disabled={teacherClasses.length === 0}
                >
                  {teacherClasses.length === 0 ? (
                    <option value="">暂无班级</option>
                  ) : (
                    teacherClasses.map((classItem) => (
                      <option data-i18n-skip key={classItem.id} value={classItem.class_code}>{classItem.name}</option>
                    ))
                  )}
                </select>
              </label>
            </div>

            {teacherClasses.length === 0 ? (
              <p className="text-xs font-bold text-slate-400">你还没有绑定任何班级，请联系管理员。</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400">当前班级：{findSelectedClass()?.name ? <span data-i18n-skip>{findSelectedClass()?.name}</span> : '未选择班级'}</p>
                <div className="flex flex-wrap gap-2.5">
                  {/* “我”的选项卡 */}
                  <button
                    onClick={() => handleStudentChange('me')}
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
                      onClick={() => handleStudentChange(String(student.id))}
                      className={`px-4 py-2 rounded-2xl text-xs font-black border-2 transition-all transform active:translate-y-0.5 ${
                      String(selectedStudentId) === String(student.id)
                          ? 'bg-indigo-400 border-indigo-500 text-white shadow-md'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                    }`}
                    >
                      👤 <span data-i18n-skip>{student.username}</span>
                    </button>
                  ))}
                </div>
                {studentsLoaded && students.length === 0 && (
                  <p className="text-xs font-bold text-slate-400">该班级暂无学生。</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 内容标题区 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-5 border-b-2 border-slate-200/50">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <span>
                {selectedStudentId === 'me' ? '🎨 我的创意工坊' : <>📂 正在督导 [<span data-i18n-skip>{findSelectedStudent()?.username || (isEnglish ? 'Student' : '学生')}</span>] 的作品</>}
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
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCreateGroup}
                disabled={organizerActionPending}
                className="flex items-center space-x-2 bg-white hover:bg-indigo-50 text-indigo-700 px-5 py-3 rounded-2xl font-black transition-all transform active:translate-y-1 border-2 border-indigo-200 shadow-[0_4px_8px_rgba(0,0,0,0.03)] text-sm"
              >
                <Folder className="w-5 h-5 stroke-[3px]" />
                <span>新建作品组</span>
              </button>
              <button
                onClick={handleCreateProject}
                disabled={organizerActionPending}
                className="flex items-center space-x-2 bg-amber-400 hover:bg-amber-300 text-amber-950 px-5 py-3 rounded-2xl font-black transition-all transform active:translate-y-1 active:border-b-0 border-b-4 border-amber-600 shadow-[0_4px_8px_rgba(0,0,0,0.05)] text-sm"
              >
                <Plus className="w-5 h-5 stroke-[3px]" />
                <span>动手做个新作品</span>
              </button>
            </div>
          )}
        </div>

        <div className="p5-project-organizer" translate="no" data-i18n-skip>
          {/* 项目列表渲染 */}
          {/* 右上角斜挎装饰，像一个小书签 */}
          {/* 操作按钮区（仅在看自己的项目时显示，防止老师误修改或误删学生作品） */}
          {/* 编辑名称画笔按钮 */}
          {/* 垃圾桶按钮 */}
          {/* 底栏修改为彩色标签与温馨小日历 */}
          {organizerReady ? (
            <ProjectOrganizer
              key={organizerRevision}
              adapter={organizerAdapter}
              ownerId={organizerOwnerId}
              currentParentId={currentGroupId}
              onCurrentParentIdChange={handleCurrentParentIdChange}
              messages={organizerMessages}
              icons={ORGANIZER_ICONS}
              onError={handleOrganizerError}
              renderProjectExtraActions={renderProjectExtraActions}
              renderProjectHostActions={renderProjectHostActions}
            />
          ) : (
            <div className="p5-project-organizer__loading">正在召唤作品集，请稍候...</div>
          )}
        </div>
      </main>
    </div>
    </>
  );
};

export default Dashboard;
