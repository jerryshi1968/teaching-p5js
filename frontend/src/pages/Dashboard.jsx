import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, pointerWithin, rectIntersection, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, Folder, GripVertical, MoveRight, Plus, Trash2, Calendar, User, LogOut, Smile, Sparkles, Star, Palette, Pencil, Copy, ShieldCheck, Send } from 'lucide-react';
// 导入网络请求工具
import { fetchMyProjects, copyProject, distributeProjectToClass, fetchMyClasses, fetchStudentsByClass, fetchProjectGroups, fetchAllProjectGroups, createProjectGroup, updateProjectGroup, moveProjectGroup, repositionProjectGroup, deleteProjectGroup, moveProject, repositionProject } from '../services/api';
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

const buildSortableId = (type, id) => `sort-${type}:${id}`;
const buildGroupDropId = (id) => `into-group:${id}`;
const buildParentDropId = (id) => `into-parent:${id === null ? 'root' : id}`;

const parseDragId = (dragId) => {
  const value = String(dragId);
  const separatorIndex = value.indexOf(':');
  if (separatorIndex < 0) return { type: '', id: '' };
  return {
    type: value.slice(0, separatorIndex),
    id: value.slice(separatorIndex + 1)
  };
};

const dashboardCollisionDetection = (args) => {
  if (!args.pointerCoordinates) {
    const closestCollisions = closestCenter(args);
    const activeType = parseDragId(args.active.id).type;
    const sortableCollision = closestCollisions.find((collision) => parseDragId(collision.id).type === activeType);
    return sortableCollision ? [sortableCollision] : closestCollisions;
  }

  const pointerCollisions = pointerWithin(args);
  const moveCollision = pointerCollisions.find((collision) => String(collision.id).startsWith('into-'));
  if (moveCollision) return [moveCollision];
  if (pointerCollisions.length > 0) return pointerCollisions;

  const intersectingCollisions = rectIntersection(args);
  if (intersectingCollisions.length > 0) return intersectingCollisions;
  return closestCenter(args);
};

const SortableCard = ({ id, disabled, className, onClick, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`${className} ${isDragging ? 'opacity-30' : ''}`}
    >
      {children({
        dragHandleProps: {
          ...attributes,
          ...listeners
        },
        isDragging
      })}
    </div>
  );
};

const GroupIntoDropZone = ({ groupId, enabled }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: buildGroupDropId(groupId),
    disabled: !enabled
  });

  if (!enabled) return null;

  return (
    <div
      ref={setNodeRef}
      className={`pointer-events-none absolute inset-7 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed bg-emerald-50/95 text-xs font-black text-emerald-700 transition-all ${
        isOver ? 'scale-105 border-emerald-500 shadow-lg' : 'border-emerald-300 opacity-80'
      }`}
    >
      放入此作品组
    </div>
  );
};

const ParentDropButton = ({ parentId, enabled, onClick, className, children }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: buildParentDropId(parentId),
    disabled: !enabled
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      className={`${className} ${isOver ? 'scale-105 bg-emerald-100 text-emerald-700 ring-4 ring-emerald-200' : ''}`}
    >
      {children}
    </button>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const appDialog = useAppDialog();
  const { isEnglish } = useLanguage();
  const [projects, setProjects] = useState([]);
  const [projectGroups, setProjectGroups] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [currentGroupId, setCurrentGroupId] = useState(() => {
    const stateGroupId = location.state?.dashboardGroupId;
    if (stateGroupId !== undefined) return normalizeDashboardGroupId(stateGroupId);

    const savedStudentId = localStorage.getItem(DASHBOARD_SELECTED_STUDENT_KEY) || 'me';
    const savedGroupId = readSavedDashboardGroupId(getStoredDashboardUserId(), savedStudentId);
    if (savedGroupId !== undefined) return savedGroupId;

    const legacyGroupId = localStorage.getItem(DASHBOARD_CURRENT_GROUP_KEY) || sessionStorage.getItem(DASHBOARD_CURRENT_GROUP_KEY);
    return normalizeDashboardGroupId(legacyGroupId);
  });
  const [allProjectGroups, setAllProjectGroups] = useState([]);
  const [moveDialog, setMoveDialog] = useState(null);
  const [moveTargetId, setMoveTargetId] = useState('');
  const [moveSaving, setMoveSaving] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);
  const [dragSaving, setDragSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const projectLoadRequestIdRef = useRef(0);
  const dragSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // === 教师模式新增状态 ===
  const [teacherClasses, setTeacherClasses] = useState([]); // 存放教师绑定的班级列表
  const [selectedClassCode, setSelectedClassCode] = useState(() => localStorage.getItem(DASHBOARD_SELECTED_CLASS_KEY) || ''); // 当前选中的班级码
  const [students, setStudents] = useState([]); // 存放学生列表
  const [studentsLoaded, setStudentsLoaded] = useState(false); // 标记当前班级学生列表是否已加载
  const [selectedStudentId, setSelectedStudentId] = useState(() => localStorage.getItem(DASHBOARD_SELECTED_STUDENT_KEY) || 'me'); // 当前选中的学生 ID，默认为 'me' (自己)

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

  const findSelectedStudent = () => students.find(s => String(s.id) === String(selectedStudentId));
  const findSelectedClass = () => teacherClasses.find(c => String(c.class_code) === String(selectedClassCode));
  const getTargetStudentId = () => selectedStudentId === 'me' ? null : selectedStudentId;
  const buildGroupPath = (group) => {
    const groupMap = new Map(allProjectGroups.map((item) => [String(item.id), item]));
    const names = [group.name];
    let parentId = group.parent_id;

    while (parentId) {
      const parent = groupMap.get(String(parentId));
      if (!parent) break;
      names.unshift(parent.name);
      parentId = parent.parent_id;
    }

    return names.join(' / ');
  };
  const refreshCurrentDirectory = async () => {
    const requestId = ++projectLoadRequestIdRef.current;
    const targetStudentId = getTargetStudentId();
    const [projectData, groupData] = await Promise.all([
      fetchMyProjects(targetStudentId, currentGroupId),
      fetchProjectGroups({ studentId: targetStudentId, parentId: currentGroupId })
    ]);

    if (requestId !== projectLoadRequestIdRef.current) return;
    if (projectData) setProjects(projectData);
    if (groupData) {
      setProjectGroups(Array.isArray(groupData.groups) ? groupData.groups : []);
      setBreadcrumbs(Array.isArray(groupData.breadcrumbs) ? groupData.breadcrumbs : []);
    }
  };
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
    const requestId = ++projectLoadRequestIdRef.current;
    let cancelled = false;
    if (!currentUser) return () => { cancelled = true; };

    if (!canUseTeacherFeatures(currentUser) && selectedStudentId !== 'me') {
      restoreProjectOwner('me');
      return () => { cancelled = true; };
    }

    if (canUseTeacherFeatures(currentUser) && selectedStudentId !== 'me' && !studentsLoaded) return () => { cancelled = true; };

    setLoading(true);
    // 如果选中的是 'me'，传入 null（拉取自己的项目）；否则传入具体的学生 ID
    const targetStudentId = selectedStudentId === 'me' ? null : selectedStudentId;

    Promise.all([
      fetchMyProjects(targetStudentId, currentGroupId),
      fetchProjectGroups({ studentId: targetStudentId, parentId: currentGroupId })
    ])
      .then(([projectData, groupData]) => {
        if (cancelled || requestId !== projectLoadRequestIdRef.current) return;
        if (projectData) setProjects(projectData);
        if (groupData) {
          setProjectGroups(Array.isArray(groupData.groups) ? groupData.groups : []);
          setBreadcrumbs(Array.isArray(groupData.breadcrumbs) ? groupData.breadcrumbs : []);
        }
        setLoading(false);
      })
      .catch(err => {
        if (cancelled || requestId !== projectLoadRequestIdRef.current) return;
        if (err?.status === 404 && currentGroupId !== null) {
          setCurrentGroupId(null);
          return;
        }
        console.error('拉取项目列表失败', err);
        setProjectGroups([]);
        setBreadcrumbs([]);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedStudentId, currentUser, studentsLoaded, currentGroupId]);

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
      const token = localStorage.getItem('teaching_token');
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: projectName, parentId: currentGroupId })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '新建项目失败了，请重试哦！');

      // 创建成功后，直接重定向至新项目编辑器
      navigate(`/editor/${data.id}`, { state: { dashboardGroupId: currentGroupId } });
    } catch (err) {
      await appDialog.alert({
        title: '创建失败',
        message: err.message
      });
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
      setLoading(true);
      await createProjectGroup({ name: groupName.trim(), parentId: currentGroupId });
      const groupData = await fetchProjectGroups({ parentId: currentGroupId });
      if (groupData) {
        setProjectGroups(Array.isArray(groupData.groups) ? groupData.groups : []);
        setBreadcrumbs(Array.isArray(groupData.breadcrumbs) ? groupData.breadcrumbs : []);
      }
    } catch (err) {
      await appDialog.alert({
        title: '创建失败',
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRenameGroup = async (e, group) => {
    e.stopPropagation();
    const groupName = await appDialog.prompt({
      title: '修改作品组名称',
      message: '请输入新的作品组名称。',
      defaultValue: group.name,
      placeholder: '请输入作品组名称',
      confirmText: '保存名称'
    });
    if (!groupName || !groupName.trim() || groupName === group.name) return;

    try {
      await updateProjectGroup(group.id, { name: groupName.trim() });
      setProjectGroups((currentGroups) => currentGroups.map((item) => (
        item.id === group.id ? { ...item, name: groupName.trim() } : item
      )));
    } catch (err) {
      await appDialog.alert({
        title: '重命名失败',
        message: err.message
      });
    }
  };

  const handleDeleteGroup = async (e, group) => {
    e.stopPropagation();
    const confirmed = await appDialog.confirm({
      disableAutoTranslate: true,
      title: isEnglish ? 'Delete Project Group' : '删除作品组',
      message: isEnglish ? `Delete project group "${group.name}"? Only empty project groups can be deleted.` : `确定要删除作品组「${group.name}」吗？只有空作品组可以删除。`,
      confirmText: isEnglish ? 'Delete Project Group' : '删除作品组',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      await deleteProjectGroup(group.id);
      setProjectGroups((currentGroups) => currentGroups.filter((item) => item.id !== group.id));
    } catch (err) {
      await appDialog.alert({
        title: '删除失败',
        message: err.message
      });
    }
  };

  const handleOpenMoveDialog = async (e, type, item) => {
    e.stopPropagation();

    try {
      const data = await fetchAllProjectGroups();
      setAllProjectGroups(Array.isArray(data.groups) ? data.groups : []);
      setMoveDialog({ type, item });
      setMoveTargetId(item.parent_id ? String(item.parent_id) : '');
    } catch (err) {
      await appDialog.alert({
        title: '打开移动失败',
        message: err.message
      });
    }
  };

  const closeMoveDialog = () => {
    if (moveSaving) return;

    setMoveDialog(null);
    setMoveTargetId('');
  };

  const handleSubmitMove = async (e) => {
    e.preventDefault();
    if (!moveDialog) return;

    const parentId = moveTargetId ? Number(moveTargetId) : null;

    try {
      setMoveSaving(true);
      if (moveDialog.type === 'group') {
        await moveProjectGroup(moveDialog.item.id, { parentId });
      } else {
        await moveProject(moveDialog.item.id, { parentId });
      }
      await refreshCurrentDirectory();
      setMoveDialog(null);
      setMoveTargetId('');
    } catch (err) {
      await appDialog.alert({
        title: '移动失败',
        message: err.message
      });
    } finally {
      setMoveSaving(false);
    }
  };

  const handleReorderGroup = async (e, index, direction) => {
    e.stopPropagation();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= projectGroups.length) return;

    const nextGroups = [...projectGroups];
    [nextGroups[index], nextGroups[targetIndex]] = [nextGroups[targetIndex], nextGroups[index]];
    setProjectGroups(nextGroups);

    try {
      await repositionProjectGroup(nextGroups[targetIndex].id, {
        parentId: currentGroupId,
        beforeId: nextGroups[targetIndex + 1]?.id ?? null
      });
    } catch (err) {
      setProjectGroups(projectGroups);
      await appDialog.alert({
        title: '排序失败',
        message: err.message
      });
    }
  };

  const handleReorderProject = async (e, index, direction) => {
    e.stopPropagation();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= projects.length) return;

    const nextProjects = [...projects];
    [nextProjects[index], nextProjects[targetIndex]] = [nextProjects[targetIndex], nextProjects[index]];
    setProjects(nextProjects);

    try {
      await repositionProject(nextProjects[targetIndex].id, {
        parentId: currentGroupId,
        beforeId: nextProjects[targetIndex + 1]?.id ?? null
      });
    } catch (err) {
      setProjects(projects);
      await appDialog.alert({
        title: '排序失败',
        message: err.message
      });
    }
  };

  const handleDragStart = ({ active }) => {
    if (selectedStudentId !== 'me' || dragSaving) return;

    const parsed = parseDragId(active.id);
    if (parsed.type === 'sort-group') {
      const group = projectGroups.find((item) => String(item.id) === parsed.id);
      if (group) setActiveDrag({ type: 'group', id: group.id, name: group.name });
      return;
    }

    if (parsed.type === 'sort-project') {
      const project = projects.find((item) => String(item.id) === parsed.id);
      if (project) setActiveDrag({ type: 'project', id: project.id, name: project.name });
    }
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
  };

  const handleDropIntoParent = async (type, itemId, parentId) => {
    const originalItems = type === 'group' ? projectGroups : projects;

    if (type === 'group') {
      setProjectGroups(originalItems.filter((item) => String(item.id) !== String(itemId)));
    } else {
      setProjects(originalItems.filter((item) => String(item.id) !== String(itemId)));
    }

    try {
      setDragSaving(true);
      if (type === 'group') {
        await repositionProjectGroup(itemId, { parentId, beforeId: null });
      } else {
        await repositionProject(itemId, { parentId, beforeId: null });
      }
    } catch (err) {
      if (type === 'group') {
        setProjectGroups(originalItems);
      } else {
        setProjects(originalItems);
      }
      await appDialog.alert({
        title: '拖放失败',
        message: err.message
      });
    } finally {
      setDragSaving(false);
    }
  };

  const handleDropReorder = async (type, itemId, overItemId) => {
    const originalItems = type === 'group' ? projectGroups : projects;
    const oldIndex = originalItems.findIndex((item) => String(item.id) === String(itemId));
    const newIndex = originalItems.findIndex((item) => String(item.id) === String(overItemId));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const nextItems = arrayMove(originalItems, oldIndex, newIndex);
    const beforeId = nextItems[newIndex + 1]?.id ?? null;

    if (type === 'group') {
      setProjectGroups(nextItems);
    } else {
      setProjects(nextItems);
    }

    try {
      setDragSaving(true);
      if (type === 'group') {
        await repositionProjectGroup(itemId, { parentId: currentGroupId, beforeId });
      } else {
        await repositionProject(itemId, { parentId: currentGroupId, beforeId });
      }
    } catch (err) {
      if (type === 'group') {
        setProjectGroups(originalItems);
      } else {
        setProjects(originalItems);
      }
      await appDialog.alert({
        title: '排序失败',
        message: err.message
      });
    } finally {
      setDragSaving(false);
    }
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveDrag(null);
    if (!over || selectedStudentId !== 'me' || dragSaving) return;

    const activeItem = parseDragId(active.id);
    const overItem = parseDragId(over.id);
    const type = activeItem.type === 'sort-group'
      ? 'group'
      : activeItem.type === 'sort-project'
        ? 'project'
        : null;
    if (!type) return;

    if (overItem.type === 'into-parent') {
      const parentId = overItem.id === 'root' ? null : Number(overItem.id);
      const isCurrentParent = parentId === null
        ? currentGroupId === null
        : Number(parentId) === Number(currentGroupId);
      if (!isCurrentParent) await handleDropIntoParent(type, activeItem.id, parentId);
      return;
    }

    if (overItem.type === 'into-group') {
      if (type === 'group' && String(activeItem.id) === String(overItem.id)) return;
      await handleDropIntoParent(type, activeItem.id, Number(overItem.id));
      return;
    }

    if (type === 'project' && overItem.type === 'sort-group') {
      await handleDropIntoParent(type, activeItem.id, Number(overItem.id));
      return;
    }

    if (type === 'group' && overItem.type === 'sort-group') {
      await handleDropReorder(type, activeItem.id, overItem.id);
      return;
    }

    if (type === 'project' && overItem.type === 'sort-project') {
      await handleDropReorder(type, activeItem.id, overItem.id);
    }
  };

  // 4. 删除项目逻辑
  const handleDeleteProject = async (e, id) => {
    e.stopPropagation(); // 阻止卡片点击跳转到编辑页
    const confirmed = await appDialog.confirm({
      disableAutoTranslate: true,
      title: isEnglish ? 'Delete Project' : '删除作品',
      message: isEnglish ? '⚠️ Are you sure you want to delete this project? Once deleted, it cannot be recovered.' : '⚠️ 确定要跟这个心爱的小作品说再见吗？一旦删除就无法找回了哦！',
      confirmText: isEnglish ? 'Delete Project' : '删除作品',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('teaching_token');
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || (isEnglish ? 'Failed to delete the project. Please try again.' : '删除项目失败了，再试一次吧！'));

      // 更新前端状态列表
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      await appDialog.alert({
        title: isEnglish ? 'Delete Failed' : '删除失败',
        message: err.message
      });
    }
  };

  // 5. 修改项目名称逻辑
  const handleRenameProject = async (e, id, currentName) => {
    e.stopPropagation(); // 阻止卡片点击跳转到编辑器
    const newName = await appDialog.prompt({
      title: '修改作品名称',
      message: '🎨 想要给你的作品换个什么酷炫的新名字呢？',
      defaultValue: currentName,
      placeholder: '请输入新的作品名称',
      confirmText: '保存名称'
    });
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
      await appDialog.alert({
        title: '重命名失败',
        message: err.message
      });
    }
  };
  
  const handleCopyProject = async (e, project) => {
    e.stopPropagation();
    const studentName = findSelectedStudent()?.username || (isEnglish ? 'Student' : '学生');
    const confirmed = await appDialog.confirm({
      disableAutoTranslate: true,
      title: isEnglish ? 'Copy to My Projects' : '复制到我的项目',
      message: isEnglish ? `Do you want to copy "${project.name}" to your own projects?` : `确定要把「${project.name}」复制成自己的项目吗？`,
      highlight: isEnglish ? `Copied project name: ${project.name} - from ${studentName}` : `复制后的名称为：${project.name} - 来自${studentName}`,
      confirmText: isEnglish ? 'Copy Project' : '复制项目'
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      await copyProject(project.id);
      const myProjects = await fetchMyProjects();
      if (myProjects) setProjects(myProjects);
      setCurrentGroupId(null);
      setSelectedStudentId('me');
    } catch (err) {
      await appDialog.alert({
        title: isEnglish ? 'Copy Failed' : '复制失败',
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDistributeProject = async (e, project) => {
    e.stopPropagation();

    const selectedClass = findSelectedClass();
    if (!selectedClass) {
      await appDialog.alert({
        disableAutoTranslate: true,
        title: isEnglish ? 'Cannot Distribute' : '无法分发',
        message: isEnglish ? 'Please select a class above before distributing the project.' : '请先在上方选择一个班级，再分发项目。'
      });
      return;
    }

    const confirmed = await appDialog.confirm({
      disableAutoTranslate: true,
      title: isEnglish ? 'Distribute to Class' : '分发给班级',
      message: isEnglish ? `Distribute "${project.name}" to all students in "${selectedClass.name}"?` : `确定将「${project.name}」分发给「${selectedClass.name}」的所有学生吗？`,
      highlight: isEnglish ? `Students will see this in Root Group after refreshing: from ${currentUser?.username || 'Teacher'} - ${project.name}` : `学生刷新后会在根作品组看到：来自${currentUser?.username || '老师'} - ${project.name}`,
      confirmText: isEnglish ? 'Confirm Distribution' : '确认分发'
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      const result = await distributeProjectToClass(project.id, selectedClass.id);
      await appDialog.alert({
        disableAutoTranslate: true,
        title: isEnglish ? 'Distribution Complete' : '分发完成',
        message: isEnglish ? 'The project has been distributed to the class students.' : (result.message || '项目已分发给班级学生。')
      });
    } catch (err) {
      await appDialog.alert({
        disableAutoTranslate: true,
        title: isEnglish ? 'Distribution Failed' : '分发失败',
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <>
    {appDialog.dialog}
    <ProfileDialog
      open={profileDialogOpen}
      onClose={() => setProfileDialogOpen(false)}
      onSaved={handleProfileSaved}
    />
    {moveDialog && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-[2rem] border-4 border-white bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.20)]">
          <h2 className="text-base font-black text-slate-800">移动{moveDialog.type === 'group' ? '作品组' : '作品'}</h2>
          <form onSubmit={handleSubmitMove} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1.5 ml-1 block text-xs font-black text-slate-500">目标作品组</span>
              <select
                value={moveTargetId}
                onChange={(e) => setMoveTargetId(e.target.value)}
                className="block w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                disabled={moveSaving}
              >
                <option value="">根作品组</option>
                {allProjectGroups
                  .filter((group) => moveDialog.type !== 'group' || Number(group.id) !== Number(moveDialog.item.id))
                  .map((group) => (
                    <option data-i18n-skip key={group.id} value={group.id}>{buildGroupPath(group)}</option>
                  ))}
              </select>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeMoveDialog}
                className="rounded-2xl border-2 border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-black text-slate-500 transition hover:bg-slate-200"
                disabled={moveSaving}
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-2xl border-b-4 border-indigo-600 bg-indigo-400 px-5 py-2.5 text-sm font-black text-white shadow-sm transition-all active:translate-y-1 active:border-b-0 disabled:opacity-50"
                disabled={moveSaving}
              >
                {moveSaving ? '移动中...' : '确认移动'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
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
                className="flex items-center space-x-2 bg-white hover:bg-indigo-50 text-indigo-700 px-5 py-3 rounded-2xl font-black transition-all transform active:translate-y-1 border-2 border-indigo-200 shadow-[0_4px_8px_rgba(0,0,0,0.03)] text-sm"
              >
                <Folder className="w-5 h-5 stroke-[3px]" />
                <span>新建作品组</span>
              </button>
              <button
                onClick={handleCreateProject}
                className="flex items-center space-x-2 bg-amber-400 hover:bg-amber-300 text-amber-950 px-5 py-3 rounded-2xl font-black transition-all transform active:translate-y-1 active:border-b-0 border-b-4 border-amber-600 shadow-[0_4px_8px_rgba(0,0,0,0.05)] text-sm"
              >
                <Plus className="w-5 h-5 stroke-[3px]" />
                <span>动手做个新作品</span>
              </button>
            </div>
          )}
        </div>

        <DndContext
          sensors={dragSensors}
          collisionDetection={dashboardCollisionDetection}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
          <ParentDropButton
            parentId={null}
            enabled={Boolean(activeDrag) && currentGroupId !== null && !dragSaving}
            onClick={() => setCurrentGroupId(null)}
            className={`rounded-full px-3 py-1.5 transition ${
              currentGroupId === null
                ? 'bg-indigo-400 text-white'
                : 'bg-white/80 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            根作品组
          </ParentDropButton>
          {breadcrumbs.map((group) => (
            <React.Fragment key={group.id}>
              <span className="text-slate-300">/</span>
              <ParentDropButton
                parentId={group.id}
                enabled={Boolean(activeDrag) && Number(currentGroupId) !== Number(group.id) && !dragSaving}
                onClick={() => setCurrentGroupId(group.id)}
                className={`rounded-full px-3 py-1.5 transition ${
                  Number(currentGroupId) === Number(group.id)
                    ? 'bg-indigo-400 text-white'
                    : 'bg-white/80 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                <span data-i18n-skip>{group.name}</span>
              </ParentDropButton>
            </React.Fragment>
          ))}
        </div>

        {/* 项目列表渲染 */}
        {loading ? (
          <div className="text-center py-24 text-slate-400 font-bold text-sm flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <span>正在召唤作品集，请稍候...</span>
          </div>
        ) : projectGroups.length === 0 && projects.length === 0 ? (
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
            <SortableContext
              items={projectGroups.map((group) => buildSortableId('group', group.id))}
              strategy={rectSortingStrategy}
            >
            {projectGroups.map((group, index) => (
              <SortableCard
                key={`group-${group.id}`}
                id={buildSortableId('group', group.id)}
                disabled={selectedStudentId !== 'me' || dragSaving}
                onClick={() => setCurrentGroupId(group.id)}
                className="bg-white border-4 border-indigo-200 bg-indigo-50/40 hover:-translate-y-1.5 rounded-[2rem] p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between group h-44 shadow-sm hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] relative overflow-hidden"
              >
                {({ dragHandleProps }) => (
                <>
                <GroupIntoDropZone
                  groupId={group.id}
                  enabled={Boolean(activeDrag) && !(activeDrag.type === 'group' && String(activeDrag.id) === String(group.id))}
                />
                <div className="absolute top-0 right-0 w-14 h-14 pointer-events-none opacity-20">
                  <Folder className="w-full h-full text-indigo-400 fill-current translate-x-3 -translate-y-3" />
                </div>

                <div>
                  <div className="space-y-2">
                    <h3 className="font-black text-base text-indigo-700 truncate pr-10">
                      📁 <span data-i18n-skip>{group.name}</span>
                    </h3>

                    {selectedStudentId === 'me' && (
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          {...dragHandleProps}
                          onClick={(e) => e.stopPropagation()}
                          disabled={dragSaving}
                          style={{ touchAction: 'none' }}
                          className="cursor-grab text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 p-1.5 rounded-xl transition duration-150 active:cursor-grabbing disabled:opacity-30"
                          title="拖放作品组"
                          aria-label="拖放作品组"
                        >
                          <GripVertical className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={(e) => handleReorderGroup(e, index, -1)}
                          disabled={index === 0}
                          className="text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 p-1.5 rounded-xl transition duration-150 disabled:opacity-30"
                          title="上移作品组"
                        >
                          <ArrowUp className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={(e) => handleReorderGroup(e, index, 1)}
                          disabled={index === projectGroups.length - 1}
                          className="text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 p-1.5 rounded-xl transition duration-150 disabled:opacity-30"
                          title="下移作品组"
                        >
                          <ArrowDown className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={(e) => handleOpenMoveDialog(e, 'group', group)}
                          className="text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 p-1.5 rounded-xl transition duration-150"
                          title="移动作品组"
                        >
                          <MoveRight className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={(e) => handleRenameGroup(e, group)}
                          className="text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 p-1.5 rounded-xl transition duration-150"
                          title="修改作品组名称"
                        >
                          <Pencil className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteGroup(e, group)}
                          className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-xl transition duration-150"
                          title="删除作品组"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono tracking-wider">作品组编号: {group.id}</p>
                </div>

                <div className="flex justify-between items-center mt-4 border-t-2 border-indigo-100 pt-3 text-[11px] font-bold text-slate-400">
                  <span>点击进入作品组</span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-black border bg-indigo-100 text-indigo-700 border-indigo-200">
                    文件夹
                  </span>
                </div>
                </>
                )}
              </SortableCard>
            ))}
            </SortableContext>
            <SortableContext
              items={projects.map((project) => buildSortableId('project', project.id))}
              strategy={rectSortingStrategy}
            >
            {projects.map((project, index) => {
              // 为当前卡片挑选一套专属的主题样式
              const style = cardStyles[index % cardStyles.length];
              return (
                <SortableCard
                  key={project.id}
                  id={buildSortableId('project', project.id)}
                  disabled={selectedStudentId !== 'me' || dragSaving}
                  onClick={() => navigate(`/editor/${project.id}`, { state: { dashboardGroupId: currentGroupId } })}
                  className={`bg-white border-4 ${style.border} ${style.bg} hover:-translate-y-1.5 rounded-[2rem] p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between group h-44 shadow-sm hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] relative overflow-hidden`}
                >
                  {({ dragHandleProps }) => (
                  <>
                  {/* 右上角斜挎装饰，像一个小书签 */}
                  <div className={`absolute top-0 right-0 w-12 h-12 pointer-events-none opacity-20`}>
                    <Star className="w-full h-full text-slate-400 fill-current translate-x-3 -translate-y-3" />
                  </div>

                  <div>
                    <div className="space-y-2">
                      <h3 className={`font-black text-base text-slate-800 ${style.text} truncate pr-10`}>
                        ✨ <span data-i18n-skip>{project.name}</span>
                      </h3>
                      
                      {selectedStudentId !== 'me' && (
                        <div className="flex items-center justify-end space-x-1">
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
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            {...dragHandleProps}
                            onClick={(e) => e.stopPropagation()}
                            disabled={dragSaving}
                            style={{ touchAction: 'none' }}
                            className="cursor-grab text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 p-1.5 rounded-xl transition duration-150 active:cursor-grabbing disabled:opacity-30"
                            title="拖放作品"
                            aria-label="拖放作品"
                          >
                            <GripVertical className="w-4.5 h-4.5" />
                          </button>
                          {canUseTeacherFeatures(currentUser) && (
                            <button
                              onClick={(e) => handleDistributeProject(e, project)}
                              disabled={!findSelectedClass()}
                              className="text-slate-400 hover:text-amber-500 hover:bg-amber-50 p-1.5 rounded-xl transition duration-150 disabled:opacity-30"
                              title={findSelectedClass() ? '分发给当前班级' : '请先选择班级'}
                            >
                              <Send className="w-4.5 h-4.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleReorderProject(e, index, -1)}
                            disabled={index === 0}
                            className="text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 p-1.5 rounded-xl transition duration-150 disabled:opacity-30"
                            title="上移作品"
                          >
                            <ArrowUp className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={(e) => handleReorderProject(e, index, 1)}
                            disabled={index === projects.length - 1}
                            className="text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 p-1.5 rounded-xl transition duration-150 disabled:opacity-30"
                            title="下移作品"
                          >
                            <ArrowDown className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={(e) => handleOpenMoveDialog(e, 'project', project)}
                            className="text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 p-1.5 rounded-xl transition duration-150"
                            title="移动作品"
                          >
                            <MoveRight className="w-4.5 h-4.5" />
                          </button>
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
                  </>
                  )}
                </SortableCard>
              );
            })}
            </SortableContext>
          </div>
        )}
        <DragOverlay>
          {activeDrag ? (
            <div className="max-w-72 rounded-2xl border-4 border-indigo-300 bg-white px-5 py-3 text-sm font-black text-indigo-700 shadow-2xl">
              {activeDrag.type === 'group' ? '📁' : '✨'} <span data-i18n-skip>{activeDrag.name}</span>
            </div>
          ) : null}
        </DragOverlay>
        </DndContext>
      </main>
    </div>
    </>
  );
};

export default Dashboard;
