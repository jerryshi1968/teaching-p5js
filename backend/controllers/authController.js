const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const Class = require('../models/classModel');
const Verification = require('../models/verificationModel');
const smsService = require('../services/smsService');
require('dotenv').config();

const CAPTCHA_EXPIRES_MINUTES = 5;
const CAPTCHA_TOKEN_EXPIRES_MINUTES = 2;
const SMS_PHONE_LIMIT_PER_HOUR = 5;
const SMS_IP_LIMIT_PER_HOUR = 20;
const SMS_PURPOSES = ['register', 'update_phone'];

const isValidPhone = (phone) => /^1[3-9]\d{9}$/.test(phone);

const addMinutes = (minutes) => new Date(Date.now() + minutes * 60 * 1000);

const oneHourAgo = () => new Date(Date.now() - 60 * 60 * 1000);

const hashValue = (value) => crypto
  .createHash('sha256')
  .update(`${value}:${process.env.JWT_SECRET || 'teaching_p5js_secret_key_2026'}`)
  .digest('hex');

const normalizePurpose = (purpose) => SMS_PURPOSES.includes(purpose) ? purpose : null;

const canUseTeacherFeatures = (user) => user?.role === 'teacher' || user?.role === 'admin';

const getRequestIp = (req) => req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';

const verifySmsCode = async ({ phone, code, sourceIp }) => {
  if (!code || !/^\d{4,8}$/.test(String(code).trim())) {
    return false;
  }

  return smsService.checkVerificationCode({
    phone,
    verifyCode: String(code).trim(),
    sourceIp
  });
};

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
  role: user.role,
  tokens: Number(user.tokens || 0)
});

exports.createCaptchaChallenge = async (req, res, next) => {
  try {
    const challengeId = crypto.randomUUID();
    const targetX = crypto.randomInt(64, 236);

    await Verification.createCaptchaChallenge({
      challengeId,
      targetX,
      expiresAt: addMinutes(CAPTCHA_EXPIRES_MINUTES)
    });

    res.json({
      challengeId,
      trackWidth: 300,
      pieceWidth: 44,
      targetHint: targetX
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyCaptchaChallenge = async (req, res, next) => {
  try {
    const { challengeId, x } = req.body;
    const challenge = await Verification.findCaptchaChallenge(challengeId);

    if (!challenge || challenge.verified_at || challenge.used_at || new Date(challenge.expires_at).getTime() <= Date.now()) {
      return res.status(400).json({ message: '滑块验证已失效，请重新验证。' });
    }

    const submittedX = Number(x);
    if (!Number.isFinite(submittedX) || Math.abs(submittedX - Number(challenge.target_x)) > 6) {
      return res.status(400).json({ message: '滑块位置不正确，请再试一次。' });
    }

    const captchaToken = crypto.randomUUID();
    const affectedRows = await Verification.markCaptchaChallengeVerified({
      challengeId,
      tokenHash: hashValue(captchaToken),
      tokenExpiresAt: addMinutes(CAPTCHA_TOKEN_EXPIRES_MINUTES)
    });

    if (affectedRows === 0) {
      return res.status(400).json({ message: '滑块验证已失效，请重新验证。' });
    }

    res.json({ captchaToken });
  } catch (err) {
    next(err);
  }
};

exports.sendSmsCode = async (req, res, next) => {
  try {
    const { phone, captchaToken, purpose = 'register' } = req.body;
    const cleanPhone = phone?.trim();
    const cleanPurpose = normalizePurpose(purpose);
    const ipAddress = getRequestIp(req);

    if (!cleanPurpose) {
      return res.status(400).json({ message: '短信验证码场景不正确。' });
    }

    if (cleanPurpose === 'update_phone' && !req.user) {
      return res.status(401).json({ message: '请先登录后再修改手机号。' });
    }

    if (!cleanPhone || !isValidPhone(cleanPhone)) {
      return res.status(400).json({ message: '请输入正确的手机号码。' });
    }

    if (!captchaToken) {
      return res.status(400).json({ message: '请先完成滑块验证。' });
    }

    const captchaAffectedRows = await Verification.consumeCaptchaToken(hashValue(captchaToken));
    if (captchaAffectedRows === 0) {
      return res.status(400).json({ message: '滑块验证已过期，请重新验证。' });
    }

    const since = oneHourAgo();
    const phoneCount = await Verification.countSmsByPhone({ phone: cleanPhone, since });
    if (phoneCount >= SMS_PHONE_LIMIT_PER_HOUR) {
      return res.status(429).json({ message: '该手机号验证码发送过于频繁，请 1 小时后再试。' });
    }

    const ipCount = await Verification.countSmsByIp({ ipAddress, since });
    if (ipCount >= SMS_IP_LIMIT_PER_HOUR) {
      return res.status(429).json({ message: '当前网络验证码发送过于频繁，请稍后再试。' });
    }

    try {
      await smsService.sendVerificationCode({ phone: cleanPhone, sourceIp: ipAddress });
    } catch (smsErr) {
      console.error('SMS verification code send failed:', smsErr.message);
      return res.status(502).json({ message: 'SMS send failed: ' + smsErr.message });
    }

    await Verification.logSmsSend({
      phone: cleanPhone,
      ipAddress,
      purpose: cleanPurpose
    });

    res.json({ message: '验证码已发送，请注意查收。' });
  } catch (err) {
    next(err);
  }
};

exports.register = async (req, res, next) => {
  try {
    const { username, password, phone, classCode, gender, birthday, smsCode } = req.body;

    if (!username || !password || !phone) {
      return res.status(400).json({ message: '用户名、密码和手机号不能为空。' });
    }

    const cleanPhone = phone.trim();
    const ipAddress = getRequestIp(req);
    if (!cleanPhone) {
      return res.status(400).json({ message: '手机号不能为空。' });
    }

    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({ message: '请输入正确的手机号码。' });
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

    const smsCodeValid = await verifySmsCode({
      phone: cleanPhone,
      code: smsCode,
      sourceIp: ipAddress
    });

    if (!smsCodeValid) {
      return res.status(400).json({ message: '手机验证码不正确或已过期。' });
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
    const { username, phone, classCode, gender, birthday, smsCode } = req.body;

    if (!username || !phone) {
      return res.status(400).json({ message: '用户名和手机号不能为空。' });
    }

    const cleanUsername = username.trim();
    const cleanPhone = phone.trim();
    const ipAddress = getRequestIp(req);

    if (!cleanUsername) {
      return res.status(400).json({ message: '用户名不能为空。' });
    }

    if (!cleanPhone) {
      return res.status(400).json({ message: '手机号不能为空。' });
    }

    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({ message: '请输入正确的手机号码。' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const phoneChanged = (currentUser.phone || '') !== cleanPhone;

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

    if (phoneChanged) {
      const smsCodeValid = await verifySmsCode({
        phone: cleanPhone,
        code: smsCode,
        sourceIp: ipAddress
      });

      if (!smsCodeValid) {
        return res.status(400).json({ message: '手机验证码不正确或已过期。' });
      }
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

exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: '旧密码、新密码和确认密码不能为空。' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: '两次输入的新密码不一致，请重新检查。' });
    }

    const user = await User.findPasswordById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在。' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: '旧密码不正确，请重新输入。' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const affectedRows = await User.updatePassword({
      id: req.user.id,
      passwordHash
    });

    if (affectedRows === 0) {
      return res.status(404).json({ message: '用户不存在。' });
    }

    res.json({ message: '密码已修改。' });
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
    if (!canUseTeacherFeatures(req.user)) {
      return res.status(403).json({ message: '无权查看学生列表。' });
    }

    const students = await User.listStudentsByTeacher(req.user.id);
    res.json(students);
  } catch (err) {
    next(err);
  }
};

exports.listMyClasses = async (req, res, next) => {
  try {
    if (!canUseTeacherFeatures(req.user)) {
      return res.status(403).json({ message: '无权查看班级列表。' });
    }

    const classes = await Class.listByTeacherUserId(req.user.id);
    res.json(classes);
  } catch (err) {
    next(err);
  }
};

exports.listStudentsByClass = async (req, res, next) => {
  try {
    if (!canUseTeacherFeatures(req.user)) {
      return res.status(403).json({ message: '无权查看班级学生列表。' });
    }

    const classCode = typeof req.params.classCode === 'string' ? req.params.classCode.trim() : '';
    if (!classCode) {
      return res.status(400).json({ message: '班级码不能为空。' });
    }

    const teacherClass = await Class.findByTeacherAndCode({
      teacherUserId: req.user.id,
      classCode
    });
    if (!teacherClass) {
      return res.status(404).json({ message: '班级不存在或无权访问。' });
    }

    const students = await User.listStudentsByTeacherClass({
      teacherUserId: req.user.id,
      classCode
    });
    res.json(students);
  } catch (err) {
    next(err);
  }
};
