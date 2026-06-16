const fs = require('fs').promises;
const path = require('path');
const Project = require('../models/projectModel');
const File = require('../models/fileModel');

const PROJECTS_BASE_DIR = path.resolve(__dirname, '../storage/projects');

function getSafePhysicalPath(projectId, relativePath) {
  const projectFolder = path.resolve(PROJECTS_BASE_DIR, projectId);
  const targetPath = path.resolve(projectFolder, relativePath);

  if (!targetPath.startsWith(projectFolder)) {
    throw new Error('Access Denied: 检测到非法的路径穿越行为。');
  }

  return targetPath;
}

exports.getProjectFiles = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findAccessibleById(projectId, req.user);

    if (!project) {
      return res.status(403).json({ message: '无权访问该项目的文件。' });
    }

    const files = await File.findByProjectId(projectId);
    const filesWithContent = await Promise.all(
      files.map(async (file) => {
        try {
          const physicalPath = getSafePhysicalPath(projectId, file.path);
          const content = await fs.readFile(physicalPath, 'utf8');
          return { ...file, content };
        } catch (readErr) {
          return { ...file, content: '// 文件读取失败或已被移动。' };
        }
      })
    );

    res.json(filesWithContent);
  } catch (err) {
    next(err);
  }
};

exports.saveFileContent = async (req, res, next) => {
  try {
    const fileId = req.params.id;
    const { content } = req.body;
    const file = await File.findOwnedFile(fileId, req.user.id);

    if (!file) {
      return res.status(403).json({ message: '无权保存该文件。' });
    }

    const { path: relativePath, project_id: projectId } = file;
    const physicalPath = getSafePhysicalPath(projectId, relativePath);

    await fs.writeFile(physicalPath, content || '', 'utf8');
    await File.touchUpdatedAt(fileId);

    res.json({ message: '代码文件已安全同步至磁盘。' });
  } catch (err) {
    next(err);
  }
};
