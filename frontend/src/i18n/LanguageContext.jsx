import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const LANGUAGE_STORAGE_KEY = 'teaching_language';
const DEFAULT_LANGUAGE = 'zh';
const SUPPORTED_LANGUAGES = ['zh', 'en'];
const DOCUMENT_TITLES = {
  zh: 'p5.js 青少年编程教学平台',
  en: 'p5.js Youth Coding Platform'
};

const zhToEn = {
  '中文': 'Chinese',
  'English': 'English',
  '语言': 'Language',
  'p5.js 创意编程乐园': 'p5.js Creative Coding Playground',
  'p5.js 青少年编程教学平台': 'p5.js Youth Coding Platform',
  '用户登录': 'User Login',
  '新用户注册': 'New User Registration',
  '欢迎回来！': 'Welcome back!',
  '开启你的编程大冒险': 'Start your coding adventure',
  '输入用户名和密码，快来和伙伴们汇合吧！': 'Enter your username and password to join your friends.',
  '只需几步，即可创建你专属的编程基地！': 'Create your own coding base in just a few steps.',
  '我的用户名 / 登录名': 'My username / login name',
  '请输入你在基地的用户名': 'Enter your username',
  '秘密钥匙 (密码)': 'Secret key (password)',
  '请输入你的密码钥匙': 'Enter your password',
  '家长手机号': 'Parent phone number',
  '请输入可联系的手机号': 'Enter a reachable phone number',
  '手机验证码': 'SMS verification code',
  '班级码（可选）': 'Class code (optional)',
  '如果老师提供了班级码，可以填在这里': 'If your teacher provided a class code, enter it here',
  '性别（可选）': 'Gender (optional)',
  '男': 'Male',
  '女': 'Female',
  '生日（可选）': 'Birthday (optional)',
  '年': 'Year',
  '月': 'Month',
  '日': 'Day',
  '再次确认密码': 'Confirm password again',
  '请再次输入相同的密码': 'Enter the same password again',
  '正在呼唤魔法中...': 'Calling the magic...',
  '开启探险之旅': 'Start Adventure',
  '建立我的新账号': 'Create My Account',
  '哎呀！请把名字和密码填写完整哦。': 'Please fill in both username and password.',
  '两次输入的密码不一样，请再检查一下吧！': 'The two passwords do not match. Please check again.',
  '哎呀！注册时需要填写手机号哦。': 'A phone number is required for registration.',
  '请填写手机验证码。': 'Please enter the SMS verification code.',
  '生日如果要填写，请把年、月、日都选完整哦。': 'If you enter a birthday, please select year, month, and day.',
  '这个生日日期不存在，请重新选择一下哦。': 'This birthday date does not exist. Please choose again.',
  '操作失败了，请再试一次吧。': 'The operation failed. Please try again.',
  '注册成功': 'Registration Successful',
  '快用刚刚建好的账号登录，开启冒险吧！': 'Use your new account to log in and start the adventure!',
  '知道啦': 'Got it',
  '确定': 'Confirm',
  '取消': 'Cancel',
  '关闭弹框': 'Close dialog',
  '关闭': 'Close',
  '我的创意工坊': 'My Creative Studio',
  '正在督导': 'Supervising',
  '学生': 'Student',
  '的作品': 'Projects',
  '在这里收集你所有的精彩想法，开始天马行空的创意代码吧！': 'Collect your ideas here and start coding freely.',
  '请保护好学生作品，在这里您可以直接阅览并运行他们的精彩代码。': 'Review and run student projects here while keeping their work safe.',
  '新建作品组': 'New Project Group',
  '动手做个新作品': 'Create a New Project',
  '根作品组': 'Root Group',
  '正在召唤作品集，请稍等...': 'Loading projects, please wait...',
  '你的画板还是空空的哦！': 'Your canvas is still empty.',
  '该同学还没有创建作品哦！': 'This student has not created any projects yet.',
  '点击下方，快来绘制你在数字世界的第一个奇迹吧！': 'Click below to create your first digital-world project.',
  '等他写好代码运行后，这里就会出现他的作品卡片。': 'Their project cards will appear here after they write and run code.',
  '创造第一个作品': 'Create First Project',
  '班级学生作品督导看板': 'Class Student Project Review',
  '班级': 'Class',
  '暂无班级': 'No classes',
  '你还没有绑定任何班级，请联系管理员。': 'You are not assigned to any class. Please contact an administrator.',
  '当前班级：': 'Current class: ',
  '未选择班级': 'No class selected',
  '我 (我的项目)': 'Me (My Projects)',
  '该班级暂无学生。': 'No students in this class.',
  '点击进入作品组': 'Open project group',
  '文件夹': 'Folder',
  '作品组编号': 'Group ID',
  '编号': 'ID',
  '更新时间': 'Updated',
  'p5.js 魔法箱': 'p5.js Magic Box',
  '上移作品组': 'Move group up',
  '下移作品组': 'Move group down',
  '拖放作品组': 'Drag project group',
  '移动作品组': 'Move group',
  '修改作品组名称': 'Rename group',
  '删除作品组': 'Delete group',
  '复制成我的项目': 'Copy to my projects',
  '分发给当前班级': 'Distribute to current class',
  '请先选择班级': 'Please select a class first',
  '上移作品': 'Move project up',
  '下移作品': 'Move project down',
  '拖放作品': 'Drag project',
  '移动作品': 'Move project',
  '修改作品名称': 'Rename project',
  '删除作品': 'Delete project',
  '退出登录': 'Log Out',
  '离开基地': 'Log Out',
  '确定要离开我们的编程乐园基地吗？今天学得很棒，下次再见哦！': 'Are you sure you want to leave our coding playground? Great work today. See you next time!',
  '个人信息': 'Profile',
  '管理员后台': 'Admin',
  '创建新作品': 'Create New Project',
  '想要给你的新作品起个什么酷炫的名字呢？': 'What cool name should this new project have?',
  '我的奇妙创意': 'My Amazing Idea',
  '请输入作品名称': 'Enter a project name',
  '开始创作': 'Start Creating',
  '创建失败': 'Create Failed',
  '新建项目失败了，请重试哦！': 'Failed to create the project. Please try again.',
  '创建作品组': 'Create Project Group',
  '给这个作品组起个清晰的名字吧。': 'Give this project group a clear name.',
  '新的作品组': 'New Project Group',
  '请输入作品组名称': 'Enter a project group name',
  '请输入新的作品组名称。': 'Enter a new project group name.',
  '保存名称': 'Save Name',
  '重命名失败': 'Rename Failed',
  '删除失败': 'Delete Failed',
  '给这个作品组起个清楚的名字吧。': 'Give this project group a clear name.',
  '复制项目': 'Copy Project',
  '确认分发': 'Confirm Distribution',
  '排序失败': 'Sort Failed',
  '拖放失败': 'Drag and Drop Failed',
  '放入此作品组': 'Move into this group',
  '移动接口未正确响应，请重启后端服务后重试。': 'The move endpoint did not respond correctly. Restart the backend service and try again.',
  '移动失败': 'Move Failed',
  '打开移动失败': 'Open Move Dialog Failed',
  '删除': 'Delete',
  '移动到作品组': 'Move to Project Group',
  '目标作品组': 'Target Group',
  '根目录': 'Root',
  '正在移动...': 'Moving...',
  '移动中...': 'Moving...',
  '移动': 'Move',
  '确认移动': 'Confirm Move',
  '返回 Dashboard': 'Back to Dashboard',
  '管理': 'Admin',
  '用户管理': 'User Management',
  '班级管理': 'Class Management',
  '作品管理': 'Project Management',
  'Token 记录': 'Token Records',
  '共': 'Total',
  '个用户': 'users',
  '个班级': 'classes',
  '个作品': 'projects',
  '条记录': 'records',
  '按用户名查找': 'Search by username',
  '按作者用户名查找': 'Search by author username',
  '按作者名过滤': 'Filter by author name',
  '按用户名过滤': 'Filter by username',
  '搜索': 'Search',
  '查找': 'Search',
  '清空': 'Clear',
  '导出': 'Export',
  '导出中...': 'Exporting...',
  '新建班级': 'New Class',
  '编辑班级': 'Edit Class',
  '加载中...': 'Loading...',
  '暂无用户': 'No users',
  '暂无作品': 'No projects',
  '暂无 Token 记录': 'No token records',
  '暂无学生': 'No students',
  '上一页': 'Previous page',
  '下一页': 'Next page',
  '第': 'Page',
  '页': 'page',
  '用户名': 'Username',
  '手机号': 'Phone',
  '手机号码': 'Phone',
  'Phone码': 'Phone',
  '性别': 'Gender',
  '生日': 'Birthday',
  '角色': 'Role',
  '余额': 'Balance',
  'Token余额': 'Token Balance',
  'TokenBalance': 'Token Balance',
  '创建时间': 'Created',
  '操作': 'Actions',
  '导出用户列表失败，请重试。': 'Failed to export user list. Please try again.',
  '获取用户列表失败，请重试。': 'Failed to load users. Please try again.',
  '获取班级列表失败，请重试。': 'Failed to load classes. Please try again.',
  '获取 Token 记录失败，请重试。': 'Failed to load token records. Please try again.',
  '获取作品列表失败，请重试。': 'Failed to load projects. Please try again.',
  '获取教师列表失败，请重试。': 'Failed to load teachers. Please try again.',
  '修改用户角色失败，请重试。': 'Failed to update user role. Please try again.',
  'Token 充值数量必须是正整数。': 'Token recharge amount must be a positive integer.',
  'Token 充值失败，请重试。': 'Token recharge failed. Please try again.',
  '班级名称不能为空。': 'Class name is required.',
  '班级码必须为 4~10 位英文字母或数字。': 'Class code must be 4-10 letters or numbers.',
  '请选择教师。': 'Please select a teacher.',
  '保存班级失败，请重试。': 'Failed to save class. Please try again.',
  '删除班级失败，请重试。': 'Failed to delete class. Please try again.',
  '获取班级学生列表失败，请重试。': 'Failed to load class students. Please try again.',
  '移除班级学生失败，请重试。': 'Failed to remove class student. Please try again.',
  '教师': 'Teacher',
  '管理员': 'Admin',
  '小极客': 'Young Coder',
  '未填写': 'Not provided',
  '未分班': 'Unassigned',
  '无效：': 'Invalid: ',
  '充值': 'Recharge',
  '充值中...': 'Recharging...',
  '消费': 'Consume',
  '消耗': 'Consume',
  '发生时间': 'Time',
  '用户': 'User',
  '用户 ID': 'User ID',
  '类型': 'Type',
  '变动量': 'Change',
  '变动前': 'Before',
  '变动后': 'After',
  '操作人': 'Operator',
  '详情': 'Details',
  '作品 ID': 'Project ID',
  '作品名称': 'Project Name',
  '作者名': 'Author',
  '查看': 'View',
  '班级名称': 'Class Name',
  '班级码': 'Class Code',
  '班级人数': 'Students',
  '人': 'students',
  '编辑': 'Edit',
  '移除': 'Remove',
  '移除中...': 'Removing...',
  '学生列表': 'Student List',
  '班级码：': 'Class code: ',
  '请选择教师': 'Please select a teacher',
  '保存': 'Save',
  '保存中...': 'Saving...',
  '保存资料': 'Save Profile',
  '修改密码': 'Change Password',
  '旧密码': 'Current Password',
  '新密码': 'New Password',
  '确认新密码': 'Confirm New Password',
  '请输入当前密码': 'Enter current password',
  '请输入新密码': 'Enter new password',
  '请再次输入新密码': 'Enter new password again',
  '确认修改': 'Confirm Change',
  '提交中...': 'Submitting...',
  '更新你的账号资料': 'Update your account profile',
  '当前 Token 余额': 'Current token balance',
  '正在加载个人信息...': 'Loading profile...',
  '请输入用户名': 'Enter username',
  '关闭个人信息弹框': 'Close profile dialog',
  '关闭修改密码对话框': 'Close change password dialog',
  '旧密码、新密码和确认密码都要填写。': 'Current password, new password, and confirmation are required.',
  '两次输入的新密码不一致，请再检查一下。': 'The two new passwords do not match. Please check again.',
  '用户名不能为空。': 'Username cannot be empty.',
  '手机号不能为空。': 'Phone number cannot be empty.',
  '个人信息加载失败。': 'Failed to load profile.',
  '旧密码不正确，请重新输入。': 'The current password is incorrect. Please enter it again.',
  '密码修改失败，请重试。': 'Failed to change password. Please try again.',
  '个人信息保存失败。': 'Failed to save profile.',
  '请输入短信验证码': 'Enter SMS verification code',
  '发送中...': 'Sending...',
  '发送验证码': 'Send Code',
  '秒后重发': 's to resend',
  '请输入正确的手机号码。': 'Please enter a valid phone number.',
  '滑块验证': 'Slider Verification',
  '拖动滑块到缺口位置': 'Drag the slider to the gap',
  '验证中...': 'Verifying...',
  '确认': 'Confirm',
  '验证码发送失败，请稍后重试。': 'Failed to send verification code. Please try again later.',
  '滑块验证加载失败，请重试。': 'Failed to load slider verification. Please try again.',
  '滑块验证失败，请重试。': 'Slider verification failed. Please try again.',
  '创意项目': 'Creative Project',
  '只读': 'Read-only',
  '返回我的工坊': 'Back to My Studio',
  '正在封存...': 'Saving...',
  '保存魔法书': 'Save Code',
  '施放魔法 (运行)': 'Run',
  '正在为你拼装魔法画板，代码正在飞速赶来...': 'Preparing your creative canvas. Code is on the way...',
  '项目文件': 'Project Files',
  '新建文本文件': 'New Text File',
  '只读模式不能新建文件': 'Read-only mode cannot create files',
  '新建文件夹': 'New Folder',
  '只读模式不能新建文件夹': 'Read-only mode cannot create folders',
  '上传文件': 'Upload File',
  '只读模式不能上传文件': 'Read-only mode cannot upload files',
  '重命名': 'Rename',
  '只读模式不能重命名': 'Read-only mode cannot rename',
  '不能重命名': 'cannot be renamed',
  '不能删除': 'cannot be deleted',
  '只读模式不能删除': 'Read-only mode cannot delete',
  'AI助手': 'AI Assistant',
  '应用AI修改': 'Apply AI changes',
  '取消AI修改': 'Cancel AI changes',
  '输入想让 AI 修改的效果，或询问提示词和编程思路。': 'Describe what you want AI to change, or ask about prompts and coding ideas.',
  '描述要修改的代码，或询问提示词和编程思路': 'Describe code changes, or ask about prompts and coding ideas',
  '只读模式不能使用AI修改': 'Read-only mode cannot use AI edits',
  '发送中': 'Sending',
  '发送AI': 'Send AI',
  '移除图片': 'Remove image',
  '无打开的文件': 'No file open',
  '小': 'S',
  '中': 'M',
  '大': 'L',
  '小字号': 'Small font',
  '中字': 'Medium font',
  '大字号': 'Large font',
  '在这里编写您的代码...': 'Write your code here...',
  '请选中一个文本文件进行编辑。': 'Select a text file to edit.',
  '暂无可编辑文件。': 'No editable files.',
  '魔法画布 (神奇预览窗口)': 'Canvas Preview',
  '独立大视窗': 'Open Large View',
  '屏幕运行': 'Open preview',
  '你的魔法画布现在空空如也，': 'Your preview canvas is empty,',
  '快点点击上方的 “施放魔法” 运行代码吧！': 'click Run above to launch the code.',
  '在新窗口打开': 'Open in new window',
  '加载失败': 'Load Failed',
  '保存成功': 'Saved',
  '个人信息已经更新啦。': 'Profile updated.',
  '保存失败': 'Save Failed',
  '运行失败': 'Run Failed',
  '打开失败': 'Open Failed',
  '上传失败': 'Upload Failed',
  '文件类型不支持': 'Unsupported File Type',
  '只能创建 .html、.css、.js、.txt 文本文件。': 'Only .html, .css, .js, and .txt text files can be created.',
  '删除文件': 'Delete File',
  '图片已满': 'Image Limit Reached',
  '一次最多粘贴': 'You can paste at most',
  '张图片。': 'images at a time.',
  '图片处理失败': 'Image Processing Failed',
  '没有找到 index.html，暂时不能让 AI 修改这个项目。': 'index.html was not found, so AI cannot edit this project yet.',
  '请参考图片修改代码。': 'Please use the attached image as a reference when editing code.',
  '已附加': 'Attached',
  '张图片': 'images',
  '本次消耗': 'Used',
  '剩余': 'remaining',
  'AI 已生成代码修改建议。': 'AI generated code change suggestions.',
  '点击上方对勾应用修改，点击叉号取消。': 'Click the check above to apply changes, or X to cancel.',
  '已取消这次 AI 修改。': 'This AI edit was canceled.',
  'AI 没有返回可应用的文件内容。': 'AI did not return applicable file content.',
  'AI 返回的文件在当前项目中不存在，没有写入任何内容。': 'The file returned by AI does not exist in this project. Nothing was written.',
  '已应用并保存 AI 修改：': 'Applied and saved AI changes: ',
  '管理员充值': 'Admin recharge',
  'AI 代码建议': 'AI code suggestion',
  '项目：': 'Project: ',
  '模型：': 'Model: ',
  '修改班级码会同步更新该班级下学生的班级码。': 'Changing the class code will also update it for students in this class.'
};

const enToZh = Object.fromEntries(Object.entries(zhToEn).map(([zh, en]) => [en, zh]));
const textNodeOriginals = new WeakMap();
const attrOriginals = new WeakMap();

const getStoredLanguage = () => {
  try {
    const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
  } catch (err) {
    return DEFAULT_LANGUAGE;
  }
};

const replaceByDictionary = (value, dictionary) => {
  if (!value) return value;

  const trimmedValue = value.trim();
  if (dictionary[trimmedValue]) {
    return value.replace(trimmedValue, dictionary[trimmedValue]);
  }

  return Object.entries(dictionary)
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((currentValue, [source, target]) => currentValue.split(source).join(target), value);
};

const translateValue = (value, language) => (
  language === 'en'
    ? replaceByDictionary(value, zhToEn)
    : replaceByDictionary(value, enToZh)
);

const translateTextNode = (node, language) => {
  if (!node.nodeValue || !node.nodeValue.trim()) return;

  let textState = textNodeOriginals.get(node);
  if (!textState) {
    textState = { original: node.nodeValue, translated: node.nodeValue };
    textNodeOriginals.set(node, textState);
  } else if (node.nodeValue !== textState.original && node.nodeValue !== textState.translated) {
    textState.original = node.nodeValue;
  }

  const nextValue = language === 'en' ? translateValue(textState.original, 'en') : textState.original;
  textState.translated = nextValue;
  if (node.nodeValue !== nextValue) {
    node.nodeValue = nextValue;
  }
};

const getElementAttrOriginals = (element) => {
  const existing = attrOriginals.get(element);
  if (existing) return existing;

  const nextOriginals = {};
  attrOriginals.set(element, nextOriginals);
  return nextOriginals;
};

const translateElementAttributes = (element, language) => {
  ['title', 'placeholder', 'aria-label'].forEach((attrName) => {
    if (!element.hasAttribute(attrName)) return;

    const originalStates = getElementAttrOriginals(element);
    const currentValue = element.getAttribute(attrName);
    if (!Object.prototype.hasOwnProperty.call(originalStates, attrName)) {
      originalStates[attrName] = { original: currentValue, translated: currentValue };
    } else if (currentValue !== originalStates[attrName].original && currentValue !== originalStates[attrName].translated) {
      originalStates[attrName].original = currentValue;
    }

    const originalValue = originalStates[attrName].original;
    const nextValue = language === 'en' ? translateValue(originalValue, 'en') : originalValue;
    originalStates[attrName].translated = nextValue;
    if (element.getAttribute(attrName) !== nextValue) {
      element.setAttribute(attrName, nextValue);
    }
  });
};

const translateNode = (node, language) => {
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE && node.parentElement?.closest('[data-i18n-skip]')) return;

  if (node.nodeType === Node.TEXT_NODE) {
    translateTextNode(node, language);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  if (node.closest('[data-i18n-skip]')) return;

  translateElementAttributes(node, language);
  if (['SCRIPT', 'STYLE', 'TEXTAREA'].includes(node.tagName)) return;
  node.childNodes.forEach((childNode) => translateNode(childNode, language));
};

const translateDocument = (language) => {
  const root = document.getElementById('root');
  if (!root) return;

  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  document.title = DOCUMENT_TITLES[language] || DOCUMENT_TITLES[DEFAULT_LANGUAGE];
  translateNode(root, language);
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getStoredLanguage);

  const setLanguage = useCallback((nextLanguage) => {
    const resolvedLanguage = SUPPORTED_LANGUAGES.includes(nextLanguage) ? nextLanguage : DEFAULT_LANGUAGE;
    setLanguageState(resolvedLanguage);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, resolvedLanguage);
  }, []);

  useEffect(() => {
    translateDocument(language);

    const root = document.getElementById('root');
    if (!root) return undefined;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => translateNode(node, language));
        if (mutation.type === 'characterData') {
          translateNode(mutation.target, language);
        }
        if (mutation.type === 'attributes') {
          translateNode(mutation.target, language);
        }
      });
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['title', 'placeholder', 'aria-label'],
      childList: true,
      characterData: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [language]);

  useEffect(() => {
    window.setTimeout(() => translateDocument(language), 0);
  });

  const value = useMemo(() => ({
    language,
    setLanguage,
    isEnglish: language === 'en'
  }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
};
