const DEFAULT_LANGUAGE = 'zh';
const SUPPORTED_LANGUAGES = ['zh', 'en'];

const messages = {
  'auth.captchaExpired': {
    zh: '滑块验证已失效，请重新验证。',
    en: 'The slider verification has expired. Please verify again.'
  },
  'auth.captchaPositionInvalid': {
    zh: '滑块位置不正确，请再试一次。',
    en: 'The slider position is incorrect. Please try again.'
  },
  'auth.smsPurposeInvalid': {
    zh: '短信验证码场景不正确。',
    en: 'The SMS verification scenario is invalid.'
  },
  'auth.loginRequiredForPhoneUpdate': {
    zh: '请先登录后再修改手机号。',
    en: 'Please log in before changing your phone number.'
  },
  'auth.phoneInvalid': {
    zh: '请输入正确的手机号码。',
    en: 'Please enter a valid phone number.'
  },
  'auth.captchaRequired': {
    zh: '请先完成滑块验证。',
    en: 'Please complete the slider verification first.'
  },
  'auth.captchaTokenExpired': {
    zh: '滑块验证已过期，请重新验证。',
    en: 'The slider verification has expired. Please verify again.'
  },
  'auth.smsPhoneTooFrequent': {
    zh: '该手机号验证码发送过于频繁，请 1 小时后再试。',
    en: 'Verification codes have been sent too often to this phone number. Please try again in 1 hour.'
  },
  'auth.smsIpTooFrequent': {
    zh: '当前网络验证码发送过于频繁，请稍后再试。',
    en: 'Verification codes have been requested too often from this network. Please try again later.'
  },
  'auth.smsSendFailed': {
    zh: '短信发送失败：{reason}',
    en: 'SMS send failed: {reason}'
  },
  'auth.smsSent': {
    zh: '验证码已发送，请注意查收。',
    en: 'The verification code has been sent.'
  },
  'auth.registerRequiredFields': {
    zh: '用户名、密码和手机号不能为空。',
    en: 'Username, password, and phone number are required.'
  },
  'auth.phoneRequired': {
    zh: '手机号不能为空。',
    en: 'Phone number is required.'
  },
  'auth.genderInvalid': {
    zh: '性别选项不正确。',
    en: 'The gender option is invalid.'
  },
  'auth.birthdayInvalid': {
    zh: '生日格式不正确。',
    en: 'The birthday format is invalid.'
  },
  'auth.usernameTaken': {
    zh: '该用户名已被占用，请尝试其他登录名。',
    en: 'This username is already taken. Please try another login name.'
  },
  'auth.smsCodeInvalid': {
    zh: '手机验证码不正确或已过期。',
    en: 'The SMS verification code is incorrect or has expired.'
  },
  'auth.registerSuccess': {
    zh: '注册成功！',
    en: 'Registration successful!'
  },
  'auth.userNotFound': {
    zh: '用户不存在。',
    en: 'User not found.'
  },
  'auth.profileRequiredFields': {
    zh: '用户名和手机号不能为空。',
    en: 'Username and phone number are required.'
  },
  'auth.usernameRequired': {
    zh: '用户名不能为空。',
    en: 'Username is required.'
  },
  'auth.profileUpdated': {
    zh: '个人信息已更新。',
    en: 'Profile updated.'
  },
  'auth.passwordFieldsRequired': {
    zh: '旧密码、新密码和确认密码不能为空。',
    en: 'Current password, new password, and confirmation are required.'
  },
  'auth.passwordMismatch': {
    zh: '两次输入的新密码不一致，请重新检查。',
    en: 'The two new passwords do not match. Please check again.'
  },
  'auth.oldPasswordIncorrect': {
    zh: '旧密码不正确，请重新输入。',
    en: 'The current password is incorrect. Please enter it again.'
  },
  'auth.passwordChanged': {
    zh: '密码已修改。',
    en: 'Password changed.'
  },
  'auth.loginRequiredFields': {
    zh: '用户名和密码不能为空。',
    en: 'Username and password are required.'
  },
  'auth.invalidCredentials': {
    zh: '用户名或密码不正确。',
    en: 'Username or password is incorrect.'
  },
  'auth.loginSuccess': {
    zh: '登录成功！',
    en: 'Login successful!'
  },
  'auth.studentsForbidden': {
    zh: '无权查看学生列表。',
    en: 'You do not have permission to view the student list.'
  },
  'auth.classesForbidden': {
    zh: '无权查看班级列表。',
    en: 'You do not have permission to view the class list.'
  },
  'auth.classStudentsForbidden': {
    zh: '无权查看班级学生列表。',
    en: 'You do not have permission to view the class student list.'
  },
  'auth.classCodeRequired': {
    zh: '班级码不能为空。',
    en: 'Class code is required.'
  },
  'auth.classNotFoundOrForbidden': {
    zh: '班级不存在或无权访问。',
    en: 'The class does not exist or you do not have permission to access it.'
  },
  'auth.tokenMissing': {
    zh: '访问拒绝：未提供认证 Token。',
    en: 'Access denied: no authentication token was provided.'
  },
  'auth.tokenInvalid': {
    zh: '访问拒绝：无效或过期的 Token。',
    en: 'Access denied: the token is invalid or expired.'
  },
  'admin.forbidden': {
    zh: '无权访问管理页面。',
    en: 'You do not have permission to access the admin page.'
  },
  'server.unexpected': {
    zh: '服务器发生未知错误。',
    en: 'An unexpected internal error occurred.'
  }
};

const resolveLanguage = (value) => {
  if (!value) return DEFAULT_LANGUAGE;

  const normalizedValue = String(value).toLowerCase();
  const matchedLanguage = SUPPORTED_LANGUAGES.find((language) => (
    normalizedValue === language || normalizedValue.startsWith(`${language}-`) || normalizedValue.startsWith(`${language},`)
  ));
  return matchedLanguage || DEFAULT_LANGUAGE;
};

const formatMessage = (message, params = {}) => Object.entries(params).reduce(
  (currentMessage, [key, value]) => currentMessage.split(`{${key}}`).join(String(value)),
  message
);

const t = (language, key, params = {}) => {
  const resolvedLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
  const entry = messages[key];
  if (!entry) return key;

  return formatMessage(entry[resolvedLanguage] || entry[DEFAULT_LANGUAGE] || key, params);
};

module.exports = {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  resolveLanguage,
  t
};
