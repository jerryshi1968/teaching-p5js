const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: '无权访问管理页面。' });
  }

  next();
};

module.exports = adminMiddleware;
