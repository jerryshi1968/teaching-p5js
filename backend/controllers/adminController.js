const User = require('../models/userModel');
const Class = require('../models/classModel');

const CLASS_CODE_PATTERN = /^[A-Za-z0-9]{4,10}$/;

const normalizeClassPayload = (body) => {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const classCode = typeof body.classCode === 'string' ? body.classCode.trim() : '';
  const teacherUserId = Number.parseInt(body.teacherUserId, 10);

  return { name, classCode, teacherUserId };
};

const validateClassPayload = async ({ name, classCode, teacherUserId }) => {
  if (!name) {
    return { status: 400, message: '班级名称不能为空。' };
  }

  if (!CLASS_CODE_PATTERN.test(classCode)) {
    return { status: 400, message: '班级码必须为 4~10 位英文字母或数字。' };
  }

  if (!Number.isFinite(teacherUserId) || teacherUserId <= 0) {
    return { status: 400, message: '请选择教师。' };
  }

  const teacher = await User.findById(teacherUserId);
  if (!teacher || teacher.role !== 'teacher') {
    return { status: 400, message: '请选择有效的教师账号。' };
  }

  return null;
};

exports.listUsers = async (req, res, next) => {
  try {
    const rawPage = Number.parseInt(req.query.page, 10);
    const rawPageSize = Number.parseInt(req.query.pageSize, 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, 100) : 10;
    const offset = (page - 1) * pageSize;
    const username = typeof req.query.username === 'string' ? req.query.username.trim() : '';

    const [items, total] = await Promise.all([
      User.listUsersPaginated({ limit: pageSize, offset, username }),
      User.countUsers({ username })
    ]);

    res.json({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (err) {
    next(err);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    const { role } = req.body;

    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ message: '用户 ID 不正确。' });
    }

    if (!['student', 'teacher'].includes(role)) {
      return res.status(400).json({ message: '只能将用户角色改为学生或教师。' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在。' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: '不支持修改管理员角色。' });
    }

    if (user.role === 'teacher' && role === 'student') {
      const classCount = await Class.countByTeacherUserId(userId);
      if (classCount > 0) {
        return res.status(409).json({ message: '该教师已绑定班级，不能修改为学生身份。' });
      }
    }

    const affectedRows = await User.updateRole({ id: userId, role });
    if (affectedRows === 0) {
      return res.status(400).json({ message: '角色未修改。' });
    }

    const updatedUser = await User.findById(userId);
    res.json({
      user: updatedUser,
      message: '角色已更新。'
    });
  } catch (err) {
    next(err);
  }
};

exports.listTeachers = async (req, res, next) => {
  try {
    const teachers = await User.listTeachers();
    res.json(teachers);
  } catch (err) {
    next(err);
  }
};

exports.listClasses = async (req, res, next) => {
  try {
    const rawPage = Number.parseInt(req.query.page, 10);
    const rawPageSize = Number.parseInt(req.query.pageSize, 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, 100) : 10;
    const offset = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      Class.listClassesPaginated({ limit: pageSize, offset }),
      Class.countClasses()
    ]);

    res.json({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (err) {
    next(err);
  }
};

exports.createClass = async (req, res, next) => {
  try {
    const payload = normalizeClassPayload(req.body);
    const validationError = await validateClassPayload(payload);
    if (validationError) {
      return res.status(validationError.status).json({ message: validationError.message });
    }

    const existingClass = await Class.findByCode(payload.classCode);
    if (existingClass) {
      return res.status(409).json({ message: '班级码已存在。' });
    }

    const classId = await Class.create(payload);
    const createdClass = await Class.findById(classId);
    res.status(201).json({
      class: createdClass,
      message: '班级已创建。'
    });
  } catch (err) {
    next(err);
  }
};

exports.updateClass = async (req, res, next) => {
  try {
    const classId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(classId) || classId <= 0) {
      return res.status(400).json({ message: '班级 ID 不正确。' });
    }

    const currentClass = await Class.findById(classId);
    if (!currentClass) {
      return res.status(404).json({ message: '班级不存在。' });
    }

    const payload = normalizeClassPayload(req.body);
    const validationError = await validateClassPayload(payload);
    if (validationError) {
      return res.status(validationError.status).json({ message: validationError.message });
    }

    const existingClass = await Class.findByCodeExceptId({ classCode: payload.classCode, id: classId });
    if (existingClass) {
      return res.status(409).json({ message: '班级码已存在。' });
    }

    const affectedRows = await Class.update({ id: classId, ...payload });
    if (affectedRows === 0) {
      return res.status(404).json({ message: '班级不存在。' });
    }

    const updatedClass = await Class.findById(classId);
    res.json({
      class: updatedClass,
      message: currentClass.class_code !== payload.classCode ? '班级已更新，学生班级码已同步。' : '班级已更新。'
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteClass = async (req, res, next) => {
  try {
    const classId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(classId) || classId <= 0) {
      return res.status(400).json({ message: '班级 ID 不正确。' });
    }

    const affectedRows = await Class.deleteById(classId);
    if (affectedRows === 0) {
      return res.status(404).json({ message: '班级不存在。' });
    }

    res.json({ message: '班级已删除，原班级学生已设为未分班。' });
  } catch (err) {
    next(err);
  }
};
