const db = require('../config/db');

exports.listClassesPaginated = async ({ limit, offset }) => {
  const [rows] = await db.query(
    `SELECT c.id, c.name, c.class_code, c.teacher_user_id, u.username AS teacher_name, COUNT(s.id) AS student_count, c.created_at, c.updated_at
     FROM classes c
     JOIN users u ON c.teacher_user_id = u.id
     LEFT JOIN users s ON s.class_code = c.class_code AND s.role = "student"
     GROUP BY c.id, c.name, c.class_code, c.teacher_user_id, u.username, c.created_at, c.updated_at
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
};

exports.countClasses = async () => {
  const [rows] = await db.query('SELECT COUNT(*) AS total FROM classes');
  return Number(rows[0]?.total || 0);
};

exports.findById = async (id) => {
  const [rows] = await db.query(
    `SELECT c.id, c.name, c.class_code, c.teacher_user_id, u.username AS teacher_name, c.created_at, c.updated_at
     FROM classes c
     JOIN users u ON c.teacher_user_id = u.id
     WHERE c.id = ?`,
    [id]
  );
  return rows[0] || null;
};

exports.findByCode = async (classCode) => {
  const [rows] = await db.query('SELECT id, name, class_code, teacher_user_id FROM classes WHERE class_code = ?', [classCode]);
  return rows[0] || null;
};

exports.findByCodeExceptId = async ({ classCode, id }) => {
  const [rows] = await db.query('SELECT id FROM classes WHERE class_code = ? AND id <> ? LIMIT 1', [classCode, id]);
  return rows[0] || null;
};

exports.countByTeacherUserId = async (teacherUserId) => {
  const [rows] = await db.query('SELECT COUNT(*) AS total FROM classes WHERE teacher_user_id = ?', [teacherUserId]);
  return Number(rows[0]?.total || 0);
};

exports.listByTeacherUserId = async (teacherUserId) => {
  const [rows] = await db.query(
    'SELECT id, name, class_code FROM classes WHERE teacher_user_id = ? ORDER BY created_at DESC, id DESC',
    [teacherUserId]
  );
  return rows;
};

exports.findByTeacherAndCode = async ({ teacherUserId, classCode }) => {
  const [rows] = await db.query(
    'SELECT id, name, class_code FROM classes WHERE teacher_user_id = ? AND class_code = ? LIMIT 1',
    [teacherUserId, classCode]
  );
  return rows[0] || null;
};

exports.listStudentsByClassId = async (id) => {
  const [rows] = await db.query(
    `SELECT u.id, u.username, u.phone, u.gender, DATE_FORMAT(u.birthday, "%Y-%m-%d") AS birthday, u.created_at
     FROM users u
     JOIN classes c ON u.class_code = c.class_code
     WHERE c.id = ? AND u.role = "student"
     ORDER BY u.created_at DESC, u.id DESC`,
    [id]
  );
  return rows;
};

exports.create = async ({ name, classCode, teacherUserId }) => {
  const [result] = await db.query(
    'INSERT INTO classes (name, class_code, teacher_user_id) VALUES (?, ?, ?)',
    [name, classCode, teacherUserId]
  );
  return result.insertId;
};

exports.update = async ({ id, name, classCode, teacherUserId }) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [currentRows] = await connection.query('SELECT class_code FROM classes WHERE id = ? FOR UPDATE', [id]);
    const currentClass = currentRows[0] || null;
    if (!currentClass) {
      await connection.rollback();
      return 0;
    }

    const oldClassCode = currentClass.class_code;
    const [result] = await connection.query(
      'UPDATE classes SET name = ?, class_code = ?, teacher_user_id = ? WHERE id = ?',
      [name, classCode, teacherUserId, id]
    );

    if (oldClassCode !== classCode) {
      await connection.query(
        'UPDATE users SET class_code = ? WHERE class_code = ?',
        [classCode, oldClassCode]
      );
    }

    await connection.commit();
    return result.affectedRows;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.deleteById = async (id) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [currentRows] = await connection.query('SELECT class_code FROM classes WHERE id = ? FOR UPDATE', [id]);
    const currentClass = currentRows[0] || null;
    if (!currentClass) {
      await connection.rollback();
      return 0;
    }

    const [result] = await connection.query('DELETE FROM classes WHERE id = ?', [id]);
    await connection.query('UPDATE users SET class_code = NULL WHERE class_code = ?', [currentClass.class_code]);

    await connection.commit();
    return result.affectedRows;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};
