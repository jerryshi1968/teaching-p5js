const db = require('../config/db');

const canAccessAllProjects = (user) => user.role === 'teacher' || user.role === 'admin';

exports.getConnection = () => db.getConnection();

exports.listForUser = async (userId) => {
  const [rows] = await db.query(
    'SELECT id, name, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
    [userId]
  );
  return rows;
};

exports.listVisibleToUser = async ({ currentUser, studentId }) => {
  const targetUserId = canAccessAllProjects(currentUser) && studentId
    ? studentId
    : currentUser.id;

  return exports.listForUser(targetUserId);
};

exports.createWithConnection = async (connection, { id, userId, name }) => {
  await connection.query(
    'INSERT INTO projects (id, user_id, name) VALUES (?, ?, ?)',
    [id, userId, name]
  );
};

exports.findOwnedById = async (projectId, userId) => {
  const [rows] = await db.query(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?',
    [projectId, userId]
  );
  return rows[0] || null;
};

exports.findAccessibleById = async (projectId, user) => {
  if (canAccessAllProjects(user)) {
    const [rows] = await db.query('SELECT id, name, user_id FROM projects WHERE id = ?', [projectId]);
    return rows[0] || null;
  }

  const [rows] = await db.query(
    'SELECT id, name, user_id FROM projects WHERE id = ? AND user_id = ?',
    [projectId, user.id]
  );
  return rows[0] || null;
};

exports.deleteById = async (projectId) => {
  const [result] = await db.query('DELETE FROM projects WHERE id = ?', [projectId]);
  return result.affectedRows;
};

exports.updateName = async ({ projectId, userId, name }) => {
  const [result] = await db.query(
    'UPDATE projects SET name = ? WHERE id = ? AND user_id = ?',
    [name, projectId, userId]
  );
  return result.affectedRows;
};
