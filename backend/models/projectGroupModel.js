const db = require('../config/db');

exports.listForUser = async ({ userId, parentId = null }) => {
  const [rows] = await db.query(
    `SELECT id, user_id, name, parent_id, sort_order, created_at, updated_at
     FROM project_groups
     WHERE user_id = ? AND ${parentId === null ? 'parent_id IS NULL' : 'parent_id = ?'}
     ORDER BY sort_order ASC, created_at DESC, id DESC`,
    parentId === null ? [userId] : [userId, parentId]
  );
  return rows;
};

exports.findOwnedById = async ({ id, userId }) => {
  const [rows] = await db.query(
    'SELECT id, user_id, name, parent_id, sort_order FROM project_groups WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return rows[0] || null;
};

exports.create = async ({ userId, name, parentId = null, sortOrder = 0 }) => {
  const [result] = await db.query(
    'INSERT INTO project_groups (user_id, name, parent_id, sort_order) VALUES (?, ?, ?, ?)',
    [userId, name, parentId, sortOrder]
  );
  return result.insertId;
};

exports.updateName = async ({ id, userId, name }) => {
  const [result] = await db.query(
    'UPDATE project_groups SET name = ? WHERE id = ? AND user_id = ?',
    [name, id, userId]
  );
  return result.affectedRows;
};

exports.countProjectsRecursive = async ({ userId, groupId }) => {
  const [rows] = await db.query(
    `WITH RECURSIVE group_tree AS (
       SELECT id FROM project_groups WHERE id = ? AND user_id = ?
       UNION ALL
       SELECT pg.id FROM project_groups pg
       JOIN group_tree gt ON pg.parent_id = gt.id
       WHERE pg.user_id = ?
     )
     SELECT COUNT(*) AS total
     FROM projects p
     JOIN group_tree gt ON p.parent_id = gt.id
     WHERE p.user_id = ?`,
    [groupId, userId, userId, userId]
  );
  return Number(rows[0]?.total || 0);
};

exports.countDescendantGroups = async ({ userId, groupId }) => {
  const [rows] = await db.query(
    `WITH RECURSIVE group_tree AS (
       SELECT id FROM project_groups WHERE id = ? AND user_id = ?
       UNION ALL
       SELECT pg.id FROM project_groups pg
       JOIN group_tree gt ON pg.parent_id = gt.id
       WHERE pg.user_id = ?
     )
     SELECT COUNT(*) AS total
     FROM group_tree
     WHERE id <> ?`,
    [groupId, userId, userId, groupId]
  );
  return Number(rows[0]?.total || 0);
};

exports.deleteEmptyById = async ({ id, userId }) => {
  const [result] = await db.query(
    'DELETE FROM project_groups WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return result.affectedRows;
};

exports.getBreadcrumbs = async ({ userId, groupId }) => {
  if (groupId === null) return [];

  const [rows] = await db.query(
    `WITH RECURSIVE breadcrumbs AS (
       SELECT id, name, parent_id, 0 AS depth
       FROM project_groups
       WHERE id = ? AND user_id = ?
       UNION ALL
       SELECT pg.id, pg.name, pg.parent_id, b.depth + 1 AS depth
       FROM project_groups pg
       JOIN breadcrumbs b ON b.parent_id = pg.id
       WHERE pg.user_id = ?
     )
     SELECT id, name, parent_id
     FROM breadcrumbs
     ORDER BY depth DESC`,
    [groupId, userId, userId]
  );
  return rows;
};
