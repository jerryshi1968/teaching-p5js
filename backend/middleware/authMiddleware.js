const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
  // 1. 从 请求头中获取 Authorization 字段
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // 格式为 "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: '访问拒绝：未提供认证 Token。' });
  }

  try {
    // 2. 校验并解密 Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'teaching_p5js_secret_key_2026');
    
    // 3. 将用户信息挂载到 req 对象上，传递给后续控制器
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    
    next(); // 继续执行后续逻辑
  } catch (err) {
    return res.status(403).json({ message: '访问拒绝：无效或过期的 Token。' });
  }
};

module.exports = authMiddleware;