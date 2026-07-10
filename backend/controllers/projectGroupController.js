const Project = require('../models/projectModel');
const ProjectGroup = require('../models/projectGroupModel');
const User = require('../models/userModel');

const normalizeParentId = (value) => {
  if (value === undefined || value === null || value === '' || value === 'null') return null;
  const parentId = Number.parseInt(value, 10);
  return Number.isFinite(parentId) && parentId > 0 ? parentId : NaN;
};

const canUseTeacherFeatures = (user) => user?.role === 'teacher' || user?.role === 'admin';

const resolveReadableOwnerId = async ({ currentUser, studentId }) => {
  if (!studentId) return currentUser.id;

  if (!canUseTeacherFeatures(currentUser)) return null;

  const visible = await User.isStudentVisibleToTeacher({
    teacherUserId: currentUser.id,
    studentId
  });
  return visible ? Number.parseInt(studentId, 10) : null;
};

exports.listGroups = async (req, res, next) => {
  try {
    const parentId = normalizeParentId(req.query.parentId);
    if (Number.isNaN(parentId)) {
      return res.status(400).json({ message: '作品组 ID 不正确。' });
    }

    const ownerId = await resolveReadableOwnerId({
      currentUser: req.user,
      studentId: req.query.studentId
    });
    if (!ownerId) {
      return res.status(403).json({ message: '无权查看作品组。' });
    }

    if (parentId !== null) {
      const parentGroup = await ProjectGroup.findOwnedById({ id: parentId, userId: ownerId });
      if (!parentGroup) {
        return res.status(404).json({ message: '作品组不存在或无权访问。' });
      }
    }

    const [groups, breadcrumbs] = await Promise.all([
      ProjectGroup.listForUser({ userId: ownerId, parentId }),
      ProjectGroup.getBreadcrumbs({ userId: ownerId, groupId: parentId })
    ]);

    res.json({ groups, breadcrumbs });
  } catch (err) {
    next(err);
  }
};

exports.listAllGroups = async (req, res, next) => {
  try {
    const groups = await ProjectGroup.listAllForUser(req.user.id);
    res.json({ groups });
  } catch (err) {
    next(err);
  }
};

exports.createGroup = async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const parentId = normalizeParentId(req.body.parentId);

    if (!name) {
      return res.status(400).json({ message: '作品组名称不能为空。' });
    }

    if (Number.isNaN(parentId)) {
      return res.status(400).json({ message: '上级作品组 ID 不正确。' });
    }

    if (parentId !== null) {
      const parentGroup = await ProjectGroup.findOwnedById({ id: parentId, userId: req.user.id });
      if (!parentGroup) {
        return res.status(404).json({ message: '上级作品组不存在或无权访问。' });
      }
    }

    const groupId = await ProjectGroup.create({
      userId: req.user.id,
      name,
      parentId
    });
    const group = await ProjectGroup.findOwnedById({ id: groupId, userId: req.user.id });

    res.status(201).json({
      group,
      message: '作品组已创建。'
    });
  } catch (err) {
    next(err);
  }
};

exports.updateGroup = async (req, res, next) => {
  try {
    const groupId = Number.parseInt(req.params.id, 10);
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    if (!Number.isFinite(groupId) || groupId <= 0) {
      return res.status(400).json({ message: '作品组 ID 不正确。' });
    }

    if (!name) {
      return res.status(400).json({ message: '作品组名称不能为空。' });
    }

    const affectedRows = await ProjectGroup.updateName({
      id: groupId,
      userId: req.user.id,
      name
    });
    if (affectedRows === 0) {
      return res.status(404).json({ message: '作品组不存在或无权访问。' });
    }

    const group = await ProjectGroup.findOwnedById({ id: groupId, userId: req.user.id });
    res.json({
      group,
      message: '作品组已更新。'
    });
  } catch (err) {
    next(err);
  }
};

exports.moveGroup = async (req, res, next) => {
  try {
    const groupId = Number.parseInt(req.params.id, 10);
    const parentId = normalizeParentId(req.body.parentId);

    if (!Number.isFinite(groupId) || groupId <= 0) {
      return res.status(400).json({ message: '作品组 ID 不正确。' });
    }

    if (Number.isNaN(parentId)) {
      return res.status(400).json({ message: '目标作品组 ID 不正确。' });
    }

    const group = await ProjectGroup.findOwnedById({ id: groupId, userId: req.user.id });
    if (!group) {
      return res.status(404).json({ message: '作品组不存在或无权访问。' });
    }

    if (parentId === groupId) {
      return res.status(400).json({ message: '不能把作品组移动到自己里面。' });
    }

    if (parentId !== null) {
      const parentGroup = await ProjectGroup.findOwnedById({ id: parentId, userId: req.user.id });
      if (!parentGroup) {
        return res.status(404).json({ message: '目标作品组不存在或无权访问。' });
      }

      const isDescendant = await ProjectGroup.isDescendantOf({
        userId: req.user.id,
        groupId,
        possibleDescendantId: parentId
      });
      if (isDescendant) {
        return res.status(400).json({ message: '不能把作品组移动到自己的子作品组中。' });
      }
    }

    const affectedRows = await ProjectGroup.move({ id: groupId, userId: req.user.id, parentId });
    if (affectedRows === 0) {
      return res.status(404).json({ message: '作品组不存在或无权访问。' });
    }

    res.json({ message: '作品组已移动。' });
  } catch (err) {
    next(err);
  }
};

exports.reorderGroups = async (req, res, next) => {
  try {
    const parentId = normalizeParentId(req.body.parentId);
    const orderedIds = Array.isArray(req.body.orderedIds) ? req.body.orderedIds.map((id) => Number.parseInt(id, 10)) : [];

    if (Number.isNaN(parentId)) {
      return res.status(400).json({ message: '作品组 ID 不正确。' });
    }

    if (orderedIds.some((id) => !Number.isFinite(id) || id <= 0)) {
      return res.status(400).json({ message: '排序数据不正确。' });
    }

    await ProjectGroup.reorder({
      userId: req.user.id,
      parentId,
      orderedIds
    });

    res.json({ message: '作品组排序已更新。' });
  } catch (err) {
    next(err);
  }
};

exports.deleteGroup = async (req, res, next) => {
  try {
    const groupId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      return res.status(400).json({ message: '作品组 ID 不正确。' });
    }

    const group = await ProjectGroup.findOwnedById({ id: groupId, userId: req.user.id });
    if (!group) {
      return res.status(404).json({ message: '作品组不存在或无权访问。' });
    }

    const [projectCount, groupCount] = await Promise.all([
      ProjectGroup.countProjectsRecursive({ userId: req.user.id, groupId }),
      ProjectGroup.countDescendantGroups({ userId: req.user.id, groupId })
    ]);
    if (projectCount > 0 || groupCount > 0) {
      return res.status(409).json({ message: '该作品组下还有作品或子作品组，不能删除。' });
    }

    await Project.clearParentId({ userId: req.user.id, parentId: groupId });
    const affectedRows = await ProjectGroup.deleteEmptyById({ id: groupId, userId: req.user.id });
    if (affectedRows === 0) {
      return res.status(404).json({ message: '作品组不存在或无权访问。' });
    }

    res.json({ message: '作品组已删除。' });
  } catch (err) {
    next(err);
  }
};
