const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Project = require('../models/projectModel');
const File = require('../models/fileModel');

const PROJECTS_BASE_DIR = path.resolve(__dirname, '../storage/projects');

const DEFAULT_TEMPLATES = {
  'index.html': `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="/teaching-p5js/libs/p5-1.11.13.min.js"></script>
  <link rel="stylesheet" type="text/css" href="style.css">
</head>
<body>
  <main></main>
  <script src="sketch.js"></script>
</body>
</html>`,
  'sketch.js': `function setup() {
  createCanvas(400, 400);
  background(220);
}

function draw() {
  circle(50, 50, 80, 80);
}`,
  'style.css': `html, body {
  margin: 0;
  padding: 0;
}
canvas {
  display: block;
}`
};

exports.listProjects = async (req, res, next) => {
  try {
    const projects = await Project.listVisibleToUser({
      currentUser: req.user,
      studentId: req.query.studentId
    });

    res.json(projects);
  } catch (err) {
    next(err);
  }
};

exports.createProject = async (req, res, next) => {
  const connection = await Project.getConnection();

  try {
    await connection.beginTransaction();

    const userId = req.user.id;
    const { name } = req.body;
    const projectName = name || '未命名项目';
    const projectId = crypto.randomUUID();

    await Project.createWithConnection(connection, {
      id: projectId,
      userId,
      name: projectName
    });

    const projectFolder = path.join(PROJECTS_BASE_DIR, projectId);
    await fs.mkdir(projectFolder, { recursive: true });

    for (const [filename, content] of Object.entries(DEFAULT_TEMPLATES)) {
      const relativePath = `./${filename}`;
      const physicalPath = path.join(projectFolder, filename);

      await fs.writeFile(physicalPath, content, 'utf8');
      await File.createWithConnection(connection, {
        projectId,
        name: filename,
        path: relativePath
      });
    }

    await connection.commit();
    res.status(201).json({ id: projectId, name: projectName, message: '项目及初始模板创建成功。' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findOwnedById(projectId, req.user.id);

    if (!project) {
      return res.status(404).json({ message: '项目不存在或无权限。' });
    }

    const projectFolder = path.join(PROJECTS_BASE_DIR, projectId);
    await fs.rm(projectFolder, { recursive: true, force: true });
    await Project.deleteById(projectId);

    res.json({ message: '项目及其磁盘文件已被彻底删除。' });
  } catch (err) {
    next(err);
  }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findAccessibleById(req.params.id, req.user);

    if (!project) {
      return res.status(404).json({ message: '项目不存在或无权限。' });
    }

    res.json({
      id: project.id,
      name: project.name,
      canEdit: project.user_id === req.user.id
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: '项目名称不能为空。' });
    }

    const affectedRows = await Project.updateName({
      projectId,
      userId: req.user.id,
      name
    });

    if (affectedRows === 0) {
      return res.status(404).json({ message: '项目不存在或无权限。' });
    }

    res.json({ message: '修改项目名称成功！' });
  } catch (err) {
    next(err);
  }
};
