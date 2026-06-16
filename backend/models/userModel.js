const db = require('../config/db');

exports.findByUsername = async (username) => {
  const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0] || null;
};

exports.existsByUsername = async (username) => {
  const [rows] = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  return rows.length > 0;
};

exports.create = async ({ username, passwordHash, role = 'student' }) => {
  const [result] = await db.query(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    [username, passwordHash, role]
  );
  return result.insertId;
};

exports.listStudents = async () => {
  const [rows] = await db.query(
    'SELECT id, username FROM users WHERE role = "student" ORDER BY username ASC'
  );
  return rows;
};
