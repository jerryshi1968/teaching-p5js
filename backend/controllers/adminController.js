const User = require('../models/userModel');

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
