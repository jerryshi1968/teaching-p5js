const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: req.t('admin.forbidden') });
  }

  next();
};

module.exports = adminMiddleware;
