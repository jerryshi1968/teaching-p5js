const db = require('../config/db');

exports.findByUsername = async (username) => {
  const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0] || null;
};

exports.findById = async (id) => {
  const [rows] = await db.query('SELECT id, username, phone, class_code, gender, birthday, role FROM users WHERE id = ?', [id]);
  return rows[0] || null;
};

exports.findPasswordById = async (id) => {
  const [rows] = await db.query('SELECT id, password_hash FROM users WHERE id = ?', [id]);
  return rows[0] || null;
};

exports.existsByUsername = async (username) => {
  const [rows] = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  return rows.length > 0;
};

exports.existsByUsernameExceptId = async (username, id) => {
  const [rows] = await db.query('SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1', [username, id]);
  return rows.length > 0;
};

exports.create = async ({ username, passwordHash, phone, classCode = null, gender = null, birthday = null, role = 'student' }) => {
  const [result] = await db.query(
    'INSERT INTO users (username, phone, class_code, gender, birthday, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, phone, classCode, gender, birthday, passwordHash, role]
  );
  return result.insertId;
};

exports.updateProfile = async ({ id, username, phone, classCode = null, gender = null, birthday = null }) => {
  const [result] = await db.query(
    'UPDATE users SET username = ?, phone = ?, class_code = ?, gender = ?, birthday = ? WHERE id = ?',
    [username, phone, classCode, gender, birthday, id]
  );
  return result.affectedRows;
};

exports.updatePassword = async ({ id, passwordHash }) => {
  const [result] = await db.query(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, id]
  );
  return result.affectedRows;
};

exports.listStudents = async () => {
  const [rows] = await db.query(
    'SELECT id, username FROM users WHERE role = "student" ORDER BY username ASC'
  );
  return rows;
};

exports.listUsersPaginated = async ({ limit, offset }) => {
  const [rows] = await db.query(
    'SELECT id, username, phone, gender, DATE_FORMAT(birthday, "%Y-%m-%d") AS birthday, role, created_at FROM users ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  return rows;
};

exports.countUsers = async () => {
  const [rows] = await db.query('SELECT COUNT(*) AS total FROM users');
  return Number(rows[0]?.total || 0);
};
