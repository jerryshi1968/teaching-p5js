const db = require('../config/db');

exports.createCaptchaChallenge = async ({ challengeId, targetX, expiresAt }) => {
  await db.query(
    'INSERT INTO captcha_challenges (challenge_id, target_x, expires_at) VALUES (?, ?, ?)',
    [challengeId, targetX, expiresAt]
  );
};

exports.findCaptchaChallenge = async (challengeId) => {
  const [rows] = await db.query(
    'SELECT * FROM captcha_challenges WHERE challenge_id = ? LIMIT 1',
    [challengeId]
  );
  return rows[0] || null;
};

exports.markCaptchaChallengeVerified = async ({ challengeId, tokenHash, tokenExpiresAt }) => {
  const [result] = await db.query(
    'UPDATE captcha_challenges SET verified_at = CURRENT_TIMESTAMP, captcha_token_hash = ?, token_expires_at = ? WHERE challenge_id = ? AND verified_at IS NULL',
    [tokenHash, tokenExpiresAt, challengeId]
  );
  return result.affectedRows;
};

exports.consumeCaptchaToken = async (tokenHash) => {
  const [result] = await db.query(
    'UPDATE captcha_challenges SET used_at = CURRENT_TIMESTAMP WHERE captcha_token_hash = ? AND verified_at IS NOT NULL AND used_at IS NULL AND token_expires_at > NOW()',
    [tokenHash]
  );
  return result.affectedRows;
};

exports.countSmsByPhone = async ({ phone, since }) => {
  const [rows] = await db.query(
    'SELECT COUNT(*) AS total FROM sms_send_logs WHERE phone = ? AND sent_at >= ?',
    [phone, since]
  );
  return Number(rows[0]?.total || 0);
};

exports.countSmsByIp = async ({ ipAddress, since }) => {
  const [rows] = await db.query(
    'SELECT COUNT(*) AS total FROM sms_send_logs WHERE ip_address = ? AND sent_at >= ?',
    [ipAddress, since]
  );
  return Number(rows[0]?.total || 0);
};

exports.logSmsSend = async ({ phone, ipAddress, purpose }) => {
  await db.query(
    'INSERT INTO sms_send_logs (phone, ip_address, purpose) VALUES (?, ?, ?)',
    [phone, ipAddress, purpose]
  );
};
