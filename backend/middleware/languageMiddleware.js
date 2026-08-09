const { resolveLanguage, t } = require('../utils/i18n');

const languageMiddleware = (req, res, next) => {
  const languageHeader = req.headers['x-language'] || req.headers['accept-language'];
  req.language = resolveLanguage(languageHeader);
  req.t = (key, params) => t(req.language, key, params);
  next();
};

module.exports = languageMiddleware;
