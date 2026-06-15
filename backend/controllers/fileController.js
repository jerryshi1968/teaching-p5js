const db = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

const PROJECTS_BASE_DIR = path.resolve(__dirname, '../storage/projects');

// 辅助函数：生成安全的物理路径并防范路径穿越
function getSafePhysicalPath(projectId, relativePath) {
  const projectFolder = path.resolve(PROJECTS_BASE_DIR, projectId);
  const targetPath = path.resolve(projectFolder, relativePath);

  // 校验：目标物理路径必须严格存在于当前项目根目录之下
  if (!targetPath.startsWith(projectFolder)) {
    throw new Error('Access Denied: 检测到非法的路径穿越行为。');
  }
  return targetPath;
}

// 1. 获取一个项目下的所有文件及对应的物理代码内容
exports.getProjectFiles = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.projectId;

    let query = 'SELECT id FROM projects WHERE id = ? AND user_id = ?';
    let params = [projectId, userId];

    // 如果是老师，直接允许读取任何人的文件
    if (req.user.role === 'teacher' || req.user.role === 'admin') {
      query = 'SELECT id FROM projects WHERE id = ?';
      params = [projectId];
    }

    const [projectRows] = await db.query(query, params);
    if (projectRows.length === 0) {
      return res.status(403).json({ message: '无权访问该项目的文件。' });
    }

    const [fileRows] = await db.query('SELECT id, name, path FROM files WHERE project_id = ?', [projectId]);

    // 异步循环读取物理磁盘上的文本代码内容
    const filesWithContent = await Promise.all(
      fileRows.map(async (file) => {
        try {
          const physicalPath = getSafePhysicalPath(projectId, file.path);
          const content = await fs.readFile(physicalPath, 'utf8');
          return { ...file, content };
        } catch (readErr) {
          // 如果是文本文件在磁盘缺失，返回空字符，避免程序崩溃
          return { ...file, content: '// 文件读取失败或已被移动。' };
        }
      })
    );

    res.json(filesWithContent);
  } catch (err) {
    next(err);
  }
};

// 2. 覆盖保存代码文件
exports.saveFileContent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const fileId = req.params.id;
    const { content } = req.body;

    // 验证此文件对应的项目是否属于该用户
    const [fileRows] = await db.query(
      `SELECT f.path, f.project_id FROM files f 
       JOIN projects p ON f.project_id = p.id 
       WHERE f.id = ? AND p.user_id = ?`,
      [fileId, userId]
    );

    if (fileRows.length === 0) {
      return res.status(403).json({ message: '无权保存该文件。' });
    }

    const { path: relativePath, project_id: projectId } = fileRows[0];

    // 获取并校验安全物理路径
    const physicalPath = getSafePhysicalPath(projectId, relativePath);

    // 将新代码内容写入物理磁盘
    await fs.writeFile(physicalPath, content || '', 'utf8');

    // 更新文件的 updated_at 戳
    await db.query('UPDATE files SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [fileId]);

    res.json({ message: '代码文件已安全同步至磁盘。' });
  } catch (err) {
    next(err);
  }
};