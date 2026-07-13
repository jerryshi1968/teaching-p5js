const db = require('../config/db');

exports.findByUsername = async (username) => {
  const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0] || null;
};

exports.findById = async (id) => {
  const [rows] = await db.query('SELECT id, username, phone, class_code, gender, birthday, role, tokens FROM users WHERE id = ?', [id]);
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

exports.listStudentsByTeacher = async (teacherUserId) => {
  const [rows] = await db.query(
    `SELECT u.id, u.username
     FROM users u
     JOIN classes c ON u.class_code = c.class_code
     WHERE u.role = "student" AND c.teacher_user_id = ?
     ORDER BY u.username ASC`,
    [teacherUserId]
  );
  return rows;
};

exports.listStudentsByTeacherClass = async ({ teacherUserId, classCode }) => {
  const [rows] = await db.query(
    `SELECT u.id, u.username
     FROM users u
     JOIN classes c ON u.class_code = c.class_code
     WHERE u.role = "student" AND c.teacher_user_id = ? AND c.class_code = ?
     ORDER BY u.username ASC`,
    [teacherUserId, classCode]
  );
  return rows;
};

exports.isStudentVisibleToTeacher = async ({ teacherUserId, studentId }) => {
  const [rows] = await db.query(
    `SELECT u.id
     FROM users u
     JOIN classes c ON u.class_code = c.class_code
     WHERE u.id = ? AND u.role = "student" AND c.teacher_user_id = ?
     LIMIT 1`,
    [studentId, teacherUserId]
  );
  return rows.length > 0;
};

exports.listTeachers = async () => {
  const [rows] = await db.query(
    'SELECT id, username FROM users WHERE role IN ("teacher", "admin") ORDER BY username ASC'
  );
  return rows;
};

exports.listUsersPaginated = async ({ limit, offset, username = '' }) => {
  const keyword = username.trim();
  const whereClause = keyword ? ' WHERE u.username LIKE ?' : '';
  const params = keyword ? [`%${keyword}%`, limit, offset] : [limit, offset];
  const [rows] = await db.query(
    `SELECT u.id, u.username, u.phone, u.class_code, c.name AS class_name, u.gender, DATE_FORMAT(u.birthday, "%Y-%m-%d") AS birthday, u.role, u.tokens, u.created_at FROM users u LEFT JOIN classes c ON u.class_code = c.class_code${whereClause} ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
    params
  );
  return rows;
};

exports.countUsers = async ({ username = '' } = {}) => {
  const keyword = username.trim();
  const whereClause = keyword ? ' WHERE username LIKE ?' : '';
  const params = keyword ? [`%${keyword}%`] : [];
  const [rows] = await db.query(`SELECT COUNT(*) AS total FROM users${whereClause}`, params);
  return Number(rows[0]?.total || 0);
};

exports.updateRole = async ({ id, role }) => {
  const [result] = await db.query(
    'UPDATE users SET role = ? WHERE id = ? AND role <> "admin"',
    [role, id]
  );
  return result.affectedRows;
};

exports.getTokensById = async (id) => {
  const [rows] = await db.query('SELECT id, tokens FROM users WHERE id = ?', [id]);
  return rows[0] || null;
};

exports.rechargeTokens = async ({ id, amount, operatorUserId = null }) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT tokens FROM users WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return 0;
    }
    const balanceBefore = Number(rows[0].tokens || 0);
    const balanceAfter = balanceBefore + amount;
    const [result] = await connection.query(
      'UPDATE users SET tokens = ? WHERE id = ?',
      [balanceAfter, id]
    );
    await connection.query(
      'INSERT INTO token_transactions (user_id, type, amount, balance_before, balance_after, operator_user_id, detail) VALUES (?, "recharge", ?, ?, ?, ?, ?)',
      [id, amount, balanceBefore, balanceAfter, operatorUserId, JSON.stringify({ source: 'admin_recharge' })]
    );
    await connection.commit();
    return result.affectedRows;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.deductTokens = async ({ id, amount, detail = null }) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT tokens FROM users WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return 0;
    }
    const balanceBefore = Number(rows[0].tokens || 0);
    const balanceAfter = balanceBefore - amount;
    const [result] = await connection.query(
      'UPDATE users SET tokens = ? WHERE id = ?',
      [balanceAfter, id]
    );
    await connection.query(
      'INSERT INTO token_transactions (user_id, type, amount, balance_before, balance_after, detail) VALUES (?, "consume", ?, ?, ?, ?)',
      [id, -amount, balanceBefore, balanceAfter, JSON.stringify(detail)]
    );
    await connection.commit();
    return result.affectedRows;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};
