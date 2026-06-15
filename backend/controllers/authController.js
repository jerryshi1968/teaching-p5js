const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// 1. 用户注册逻辑
exports.register = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空。' });
    }

    // A. 检查用户名是否重复（对应数据库唯一索引限制）
    const [existingUsers] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: '该用户名已被占用，请尝试其他登录名。' });
    }

    // B. 对密码进行加盐哈希加密
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // C. 将新用户存入数据库（默认角色为 student）
    await db.query(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [username, passwordHash, 'student']
    );

    res.status(201).json({ message: '注册成功！' });
  } catch (err) {
    next(err);
  }
};

// 2. 用户登录逻辑
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空。' });
    }

    // A. 查找该用户是否存在
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({ message: '用户名或密码不正确。' });
    }

    const user = users[0];

    // B. 比对哈希密码是否一致
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: '用户名或密码不正确。' });
    }

    // C. 登录成功，签发 JWT Token（有效期为 7 天）
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'teaching_p5js_secret_key_2026',
      { expiresIn: '7d' }
    );

    // D. 返回 Token 和用户信息
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      message: '登录成功！'
    });
  } catch (err) {
    next(err);
  }
};

// 3. 获取学生列表
exports.listStudents = async (req, res, next) => {
  try {
    // 只有教师或管理员才能调取学生账户名录
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权查看学生列表。' });
    }
    const [rows] = await db.query(
      'SELECT id, username FROM users WHERE role = "student" ORDER BY username ASC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};