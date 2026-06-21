const User = require('../models/userModel');

exports.listUsers = async (req, res, next) => {
  try {
    const rawPage = Number.parseInt(req.query.page, 10);
    const rawPageSize = Number.parseInt(req.query.pageSize, 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, 100) : 10;
    const offset = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      User.listUsersPaginated({ limit: pageSize, offset }),
      User.countUsers()
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
