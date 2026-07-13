const db = require('../config/db');

exports.listPaginated = async ({ limit, offset, username = '' }) => {
  const keyword = username.trim();
  const whereClause = keyword ? ' WHERE u.username LIKE ?' : '';
  const params = keyword ? [`%${keyword}%`, limit, offset] : [limit, offset];
  const [rows] = await db.query(
    `SELECT tt.id, tt.user_id, u.username, tt.type, tt.amount, tt.balance_before, tt.balance_after, tt.operator_user_id, operator.username AS operator_username, tt.detail, tt.created_at
     FROM token_transactions tt
     JOIN users u ON tt.user_id = u.id
     LEFT JOIN users operator ON tt.operator_user_id = operator.id${whereClause}
     ORDER BY tt.created_at DESC, tt.id DESC
     LIMIT ? OFFSET ?`,
    params
  );
  return rows;
};

exports.count = async ({ username = '' } = {}) => {
  const keyword = username.trim();
  const whereClause = keyword ? ' WHERE u.username LIKE ?' : '';
  const params = keyword ? [`%${keyword}%`] : [];
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total FROM token_transactions tt JOIN users u ON tt.user_id = u.id${whereClause}`,
    params
  );
  return Number(rows[0]?.total || 0);
};
