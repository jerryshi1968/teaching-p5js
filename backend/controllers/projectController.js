const db = require('../config/db');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// 物理项目文件的根存放路径 (backend/storage/projects)
const PROJECTS_BASE_DIR = path.resolve(__dirname, '../storage/projects');

// 默认模板内容定义
const DEFAULT_TEMPLATES = {
  'index.html': `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://tigao123.com/teaching-p5js/libs/p5-1.11.13.min.js"></script>
  <link rel="stylesheet" type="text/css" href="style.css">
</head>
<body>
  <main></main>
  <script src="sketch.js"></script>
</body>
</html>`,
  'sketch.js': `function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
  ellipse(50, 50, 80, 80);
}`,
  'style.css': `html, body {
  margin: 0;
  padding: 0;
}
canvas {
  display: block;
}`
};

// 1. 获取当前用户的所有项目
exports.listProjects = async (req, res, next) => {
  try {
    let userId = req.user.id; // 默认拉取自己

    // 如果当前登录者是教师或管理员，并且参数中携带了 studentId，则拉取指定学生
    if ((req.user.role === 'teacher' || req.user.role === 'admin') && req.query.studentId) {
      userId = req.query.studentId;
    }

    const [rows] = await db.query(
      'SELECT id, name, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// 2. 创建新项目并生成初始物理文件
exports.createProject = async (req, res, next) => {
  const connection = await db.getConnection(); // 获取事务连接，确保数据库和磁盘操作的一致性
  try {
    await connection.beginTransaction();

    const userId = req.user.id;
    const { name } = req.body;
    const projectName = name || '未命名项目';
    const projectId = crypto.randomUUID(); // 生成唯一 UUID

    // A. 写入数据库项目表
    await connection.query(
      'INSERT INTO projects (id, user_id, name) VALUES (?, ?, ?)',
      [projectId, userId, projectName]
    );

    // B. 在磁盘上为该项目创建物理文件夹
    const projectFolder = path.join(PROJECTS_BASE_DIR, projectId);
    await fs.mkdir(projectFolder, { recursive: true });

    // C. 循环写入默认的 3 个模板物理文件，并将元数据存入数据库
    for (const [filename, content] of Object.entries(DEFAULT_TEMPLATES)) {
      const relativePath = `./${filename}`;
      const physicalPath = path.join(projectFolder, filename);

      // 写入物理磁盘
      await fs.writeFile(physicalPath, content, 'utf8');

      // 写入数据库 files 表
      await connection.query(
        'INSERT INTO files (project_id, name, path) VALUES (?, ?, ?)',
        [projectId, filename, relativePath]
      );
    }

    await connection.commit();
    res.status(201).json({ id: projectId, name: projectName, message: '项目及初始模版创建成功。' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// 3. 删除项目
exports.deleteProject = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;

    // 验证该项目是否属于当前用户
    const [projectRows] = await db.query('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, userId]);
    if (projectRows.length === 0) {
      return res.status(404).json({ message: '项目不存在或无权限。' });
    }

    // A. 删除物理磁盘上的项目目录
    const projectFolder = path.join(PROJECTS_BASE_DIR, projectId);
    await fs.rm(projectFolder, { recursive: true, force: true });

    // B. 从数据库中删除项目记录 (由于配置了 ON DELETE CASCADE，关联的 files 记录会自动删除)
    await db.query('DELETE FROM projects WHERE id = ?', [projectId]);

    res.json({ message: '项目及其磁盘文件已被彻底删除。' });
  } catch (err) {
    next(err);
  }
};

// 4. 获取项目信息：
exports.getProjectById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;
    
    let query = 'SELECT id, name FROM projects WHERE id = ? AND user_id = ?';
    let params = [projectId, userId];
    // 如果是老师，直接放行关联验证，只查项目是否存在
    if (req.user.role === 'teacher' || req.user.role === 'admin') {
      query = 'SELECT id, name FROM projects WHERE id = ?';
      params = [projectId];
    }

    const [rows] = await db.query(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ message: '项目不存在或无权限。' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// 5. 修改项目名称：
exports.updateProject = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: '项目名称不能为空。' });

    const [result] = await db.query(
      'UPDATE projects SET name = ? WHERE id = ? AND user_id = ?',
      [name, projectId, userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '项目不存在或无权限。' });
    }
    res.json({ message: '修改项目名称成功！' });
  } catch (err) {
    next(err);
  }
};
