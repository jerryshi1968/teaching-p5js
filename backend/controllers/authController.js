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
      return res.status(400).json({ message: req.t('auth.captchaExpired') });
    }

    const submittedX = Number(x);
    if (!Number.isFinite(submittedX) || Math.abs(submittedX - Number(challenge.target_x)) > 6) {
      return res.status(400).json({ message: req.t('auth.captchaPositionInvalid') });
    }

    const captchaToken = crypto.randomUUID();
    const affectedRows = await Verification.markCaptchaChallengeVerified({
      challengeId,
      tokenHash: hashValue(captchaToken),
      tokenExpiresAt: addMinutes(CAPTCHA_TOKEN_EXPIRES_MINUTES)
    });

    if (affectedRows === 0) {
      return res.status(400).json({ message: req.t('auth.captchaExpired') });
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
      return res.status(400).json({ message: req.t('auth.smsPurposeInvalid') });
    }

    if (cleanPurpose === 'update_phone' && !req.user) {
      return res.status(401).json({ message: req.t('auth.loginRequiredForPhoneUpdate') });
    }

    if (!cleanPhone || !isValidPhone(cleanPhone)) {
      return res.status(400).json({ message: req.t('auth.phoneInvalid') });
    }

    if (!captchaToken) {
      return res.status(400).json({ message: req.t('auth.captchaRequired') });
    }

    const captchaAffectedRows = await Verification.consumeCaptchaToken(hashValue(captchaToken));
    if (captchaAffectedRows === 0) {
      return res.status(400).json({ message: req.t('auth.captchaTokenExpired') });
    }

    const since = oneHourAgo();
    const phoneCount = await Verification.countSmsByPhone({ phone: cleanPhone, since });
    if (phoneCount >= SMS_PHONE_LIMIT_PER_HOUR) {
      return res.status(429).json({ message: req.t('auth.smsPhoneTooFrequent') });
    }

    const ipCount = await Verification.countSmsByIp({ ipAddress, since });
    if (ipCount >= SMS_IP_LIMIT_PER_HOUR) {
      return res.status(429).json({ message: req.t('auth.smsIpTooFrequent') });
    }

    try {
      await smsService.sendVerificationCode({ phone: cleanPhone, sourceIp: ipAddress });
    } catch (smsErr) {
      console.error('SMS verification code send failed:', smsErr.message);
      return res.status(502).json({ message: req.t('auth.smsSendFailed', { reason: smsErr.message }) });
    }

    await Verification.logSmsSend({
      phone: cleanPhone,
      ipAddress,
      purpose: cleanPurpose
    });

    res.json({ message: req.t('auth.smsSent') });
  } catch (err) {
    next(err);
  }
};

exports.register = async (req, res, next) => {
  try {
    const { username, password, phone, classCode, gender, birthday, smsCode } = req.body;

    if (!username || !password || !phone) {
      return res.status(400).json({ message: req.t('auth.registerRequiredFields') });
    }

    const cleanPhone = phone.trim();
    const ipAddress = getRequestIp(req);
    if (!cleanPhone) {
      return res.status(400).json({ message: req.t('auth.phoneRequired') });
    }

    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({ message: req.t('auth.phoneInvalid') });
    }

    if (gender && !['male', 'female'].includes(gender)) {
      return res.status(400).json({ message: req.t('auth.genderInvalid') });
    }

    if (birthday && !isValidBirthday(birthday)) {
      return res.status(400).json({ message: req.t('auth.birthdayInvalid') });
    }

    const userExists = await User.existsByUsername(username);
    if (userExists) {
      return res.status(409).json({ message: req.t('auth.usernameTaken') });
    }

    const smsCodeValid = await verifySmsCode({
      phone: cleanPhone,
      code: smsCode,
      sourceIp: ipAddress
    });

    if (!smsCodeValid) {
      return res.status(400).json({ message: req.t('auth.smsCodeInvalid') });
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

    res.status(201).json({ message: req.t('auth.registerSuccess') });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: req.t('auth.userNotFound') });
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
      return res.status(400).json({ message: req.t('auth.profileRequiredFields') });
    }

    const cleanUsername = username.trim();
    const cleanPhone = phone.trim();
    const ipAddress = getRequestIp(req);

    if (!cleanUsername) {
      return res.status(400).json({ message: req.t('auth.usernameRequired') });
    }

    if (!cleanPhone) {
      return res.status(400).json({ message: req.t('auth.phoneRequired') });
    }

    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({ message: req.t('auth.phoneInvalid') });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: req.t('auth.userNotFound') });
    }

    const phoneChanged = (currentUser.phone || '') !== cleanPhone;

    if (gender && !['male', 'female'].includes(gender)) {
      return res.status(400).json({ message: req.t('auth.genderInvalid') });
    }

    if (birthday && !isValidBirthday(birthday)) {
      return res.status(400).json({ message: req.t('auth.birthdayInvalid') });
    }

    const userExists = await User.existsByUsernameExceptId(cleanUsername, req.user.id);
    if (userExists) {
      return res.status(409).json({ message: req.t('auth.usernameTaken') });
    }

    if (phoneChanged) {
      const smsCodeValid = await verifySmsCode({
        phone: cleanPhone,
        code: smsCode,
        sourceIp: ipAddress
      });

      if (!smsCodeValid) {
        return res.status(400).json({ message: req.t('auth.smsCodeInvalid') });
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
      return res.status(404).json({ message: req.t('auth.userNotFound') });
    }

    const updatedUser = await User.findById(req.user.id);
    res.json({
      user: formatUserProfile(updatedUser),
      message: req.t('auth.profileUpdated')
    });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: req.t('auth.passwordFieldsRequired') });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: req.t('auth.passwordMismatch') });
    }

    const user = await User.findPasswordById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: req.t('auth.userNotFound') });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: req.t('auth.oldPasswordIncorrect') });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const affectedRows = await User.updatePassword({
      id: req.user.id,
      passwordHash
    });

    if (affectedRows === 0) {
      return res.status(404).json({ message: req.t('auth.userNotFound') });
    }

    res.json({ message: req.t('auth.passwordChanged') });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: req.t('auth.loginRequiredFields') });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).json({ message: req.t('auth.invalidCredentials') });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: req.t('auth.invalidCredentials') });
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
      message: req.t('auth.loginSuccess')
    });
  } catch (err) {
    next(err);
  }
};

exports.listStudents = async (req, res, next) => {
  try {
    if (!canUseTeacherFeatures(req.user)) {
      return res.status(403).json({ message: req.t('auth.studentsForbidden') });
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
      return res.status(403).json({ message: req.t('auth.classesForbidden') });
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
      return res.status(403).json({ message: req.t('auth.classStudentsForbidden') });
    }

    const classCode = typeof req.params.classCode === 'string' ? req.params.classCode.trim() : '';
    if (!classCode) {
      return res.status(400).json({ message: req.t('auth.classCodeRequired') });
    }

    const teacherClass = await Class.findByTeacherAndCode({
      teacherUserId: req.user.id,
      classCode
    });
    if (!teacherClass) {
      return res.status(404).json({ message: req.t('auth.classNotFoundOrForbidden') });
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
