const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
require('dotenv').config();

const isValidBirthday = (birthday) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;

  const date = new Date(`${birthday}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === birthday;
};

const formatBirthday = (birthday) => {
  if (!birthday) return null;
  if (typeof birthday === 'string') return birthday.slice(0, 10);

  const year = birthday.getFullYear();
  const month = String(birthday.getMonth() + 1).padStart(2, '0');
  const day = String(birthday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatUserProfile = (user) => ({
  id: user.id,
  username: user.username,
  phone: user.phone || '',
  classCode: user.class_code || '',
  gender: user.gender || null,
  birthday: formatBirthday(user.birthday),
  role: user.role
});

exports.register = async (req, res, next) => {
  try {
    const { username, password, phone, classCode, gender, birthday } = req.body;

    if (!username || !password || !phone) {
      return res.status(400).json({ message: '用户名、密码和手机号不能为空。' });
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      return res.status(400).json({ message: '手机号不能为空。' });
    }

    if (gender && !['male', 'female'].includes(gender)) {
      return res.status(400).json({ message: '性别选项不正确。' });
    }

    if (birthday && !isValidBirthday(birthday)) {
      return res.status(400).json({ message: '生日格式不正确。' });
    }

    const userExists = await User.existsByUsername(username);
    if (userExists) {
      return res.status(409).json({ message: '该用户名已被占用，请尝试其他登录名。' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await User.create({
      username,
      passwordHash,
      phone: cleanPhone,
      classCode: classCode?.trim() || null,
      gender: gender || null,
      birthday: birthday || null
    });

    res.status(201).json({ message: '注册成功！' });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在。' });
    }

    res.json(formatUserProfile(user));
  } catch (err) {
    next(err);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const { username, phone, classCode, gender, birthday } = req.body;

    if (!username || !phone) {
      return res.status(400).json({ message: '用户名和手机号不能为空。' });
    }

    const cleanUsername = username.trim();
    const cleanPhone = phone.trim();

    if (!cleanUsername) {
      return res.status(400).json({ message: '用户名不能为空。' });
    }

    if (!cleanPhone) {
      return res.status(400).json({ message: '手机号不能为空。' });
    }

    if (gender && !['male', 'female'].includes(gender)) {
      return res.status(400).json({ message: '性别选项不正确。' });
    }

    if (birthday && !isValidBirthday(birthday)) {
      return res.status(400).json({ message: '生日格式不正确。' });
    }

    const userExists = await User.existsByUsernameExceptId(cleanUsername, req.user.id);
    if (userExists) {
      return res.status(409).json({ message: '该用户名已被占用，请尝试其他登录名。' });
    }

    const affectedRows = await User.updateProfile({
      id: req.user.id,
      username: cleanUsername,
      phone: cleanPhone,
      classCode: classCode?.trim() || null,
      gender: gender || null,
      birthday: birthday || null
    });

    if (affectedRows === 0) {
      return res.status(404).json({ message: '用户不存在。' });
    }

    const updatedUser = await User.findById(req.user.id);
    res.json({
      user: formatUserProfile(updatedUser),
      message: '个人信息已更新。'
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空。' });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).json({ message: '用户名或密码不正确。' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: '用户名或密码不正确。' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'teaching_p5js_secret_key_2026',
      { expiresIn: '7d' }
    );

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

exports.listStudents = async (req, res, next) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权查看学生列表。' });
    }

    const students = await User.listStudents();
    res.json(students);
  } catch (err) {
    next(err);
  }
};
