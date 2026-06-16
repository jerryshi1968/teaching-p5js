const db = require('../config/db');

exports.createWithConnection = async (connection, { projectId, name, path }) => {
  await connection.query(
    'INSERT INTO files (project_id, name, path) VALUES (?, ?, ?)',
    [projectId, name, path]
  );
};

exports.findByProjectId = async (projectId) => {
  const [rows] = await db.query(
    'SELECT id, name, path FROM files WHERE project_id = ?',
    [projectId]
  );
  return rows;
};

exports.findOwnedFile = async (fileId, userId) => {
  const [rows] = await db.query(
    `SELECT f.path, f.project_id FROM files f
     JOIN projects p ON f.project_id = p.id
     WHERE f.id = ? AND p.user_id = ?`,
    [fileId, userId]
  );
  return rows[0] || null;
};

exports.touchUpdatedAt = async (fileId) => {
  const [result] = await db.query(
    'UPDATE files SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [fileId]
  );
  return result.affectedRows;
};
