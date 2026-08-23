const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Project = require('../models/projectModel');
const File = require('../models/fileModel');

const PROJECTS_BASE_DIR = path.resolve(__dirname, '../storage/projects');
const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.txt']);

function isRootIndexFile(filePath) {
  return normalizeRelativePath(filePath) === './index.html';
}

function normalizeRelativePath(input = '.') {
  const rawPath = String(input || '.').replace(/\\/g, '/').trim();

  if (rawPath === '' || rawPath === '.' || rawPath === './') {
    return '.';
  }

  if (rawPath.startsWith('/')) {
    throw new Error('路径不能以 / 开头。');
  }

  const withoutPrefix = rawPath.startsWith('./') ? rawPath.slice(2) : rawPath;
  const normalized = path.posix.normalize(withoutPrefix);

  if (normalized === '.' || normalized === '') {
    return '.';
  }

  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error('路径不能跳出项目目录。');
  }

  return `./${normalized}`;
}

function validateEntryName(name) {
  const value = String(name || '').trim();

  if (!value) {
    throw new Error('名称不能为空。');
  }

  if (value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error('名称不能包含路径分隔符。');
  }

  return value;
}

function buildRelativePath(parentPath, name) {
  const parent = normalizeRelativePath(parentPath);
  return parent === '.' ? `./${name}` : `${parent}/${name}`;
}

function getSafePhysicalPath(projectId, relativePath) {
  const projectFolder = path.resolve(PROJECTS_BASE_DIR, projectId);
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const targetPath = normalizedRelativePath === '.'
    ? projectFolder
    : path.resolve(projectFolder, normalizedRelativePath);

  if (targetPath !== projectFolder && !targetPath.startsWith(`${projectFolder}${path.sep}`)) {
    throw new Error('Access Denied: 检测到非法的路径穿越行为。');
  }

  return targetPath;
}

function isTextFile(filename) {
  return TEXT_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

async function writeTextFileAtomically(targetPath, content) {
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
  let handle = null;

  try {
    handle = await fs.open(temporaryPath, 'wx');
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temporaryPath, targetPath);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

function toPublicUrl(projectId, relativePath) {
  const cleanPath = normalizeRelativePath(relativePath).replace(/^\.\//, '');
  return `/teaching-p5js/projects/${encodeURIComponent(projectId)}/${cleanPath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

async function ensureOwnedProject(projectId, userId) {
  const project = await Project.findOwnedById(projectId, userId);
  if (!project) {
    const error = new Error('项目不存在或无权限。');
    error.statusCode = 403;
    throw error;
  }
}

async function ensureParentDirectory(projectId, parentPath) {
  const physicalParentPath = getSafePhysicalPath(projectId, parentPath);
  const stat = await fs.stat(physicalParentPath).catch(() => null);

  if (!stat || !stat.isDirectory()) {
    throw new Error('目标目录不存在。');
  }
}

async function ensurePathAvailable(projectId, relativePath) {
  const existingRecord = await File.findByProjectAndPath(projectId, relativePath);
  if (existingRecord) {
    throw new Error('同名文件或文件夹已经存在。');
  }

  const physicalPath = getSafePhysicalPath(projectId, relativePath);
  const existingStat = await fs.stat(physicalPath).catch(() => null);
  if (existingStat) {
    throw new Error('磁盘上已经存在同名文件或文件夹。');
  }
}

function decodeBase64Payload(data) {
  const raw = String(data || '');
  const base64 = raw.includes(',') ? raw.split(',').pop() : raw;
  return Buffer.from(base64, 'base64');
}

exports.getProjectFiles = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findAccessibleById(projectId, req.user);

    if (!project) {
      return res.status(403).json({ message: '无权访问该项目的文件。' });
    }

    const files = await File.findByProjectId(projectId);
    const filesWithMetadata = await Promise.all(
      files.map(async (file) => {
        const physicalPath = getSafePhysicalPath(projectId, file.path);
        const stat = await fs.stat(physicalPath).catch(() => null);
        const isDirectory = Boolean(stat && stat.isDirectory());
        const isText = !isDirectory && isTextFile(file.name);
        const isBinary = !isDirectory && !isText;

        if (isDirectory) {
          return { ...file, isDirectory: true, isText: false, isBinary: false, content: null };
        }

        if (isText) {
          const content = await fs.readFile(physicalPath, 'utf8').catch(() => '// 文件读取失败或已被移动。');
          return {
            ...file,
            isDirectory: false,
            isText: true,
            isBinary: false,
            content,
            url: toPublicUrl(projectId, file.path),
            size: stat ? stat.size : 0
          };
        }

        return {
          ...file,
          isDirectory: false,
          isText: false,
          isBinary: true,
          content: null,
          url: toPublicUrl(projectId, file.path),
          size: stat ? stat.size : 0
        };
      })
    );

    res.json(filesWithMetadata);
  } catch (err) {
    next(err);
  }
};

exports.createEntry = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const { name, parentPath = '.', type = 'file', content = '' } = req.body;
    const safeName = validateEntryName(name);
    const relativePath = buildRelativePath(parentPath, safeName);

    await ensureOwnedProject(projectId, req.user.id);
    await ensureParentDirectory(projectId, parentPath);
    await ensurePathAvailable(projectId, relativePath);

    const physicalPath = getSafePhysicalPath(projectId, relativePath);

    if (type === 'directory') {
      await fs.mkdir(physicalPath, { recursive: false });
    } else {
      if (!isTextFile(safeName)) {
        return res.status(400).json({ message: '只能创建 .html、.css、.js、.txt 文本文件。' });
      }
      await fs.writeFile(physicalPath, content || '', 'utf8');
    }

    const entry = await File.create({ projectId, name: safeName, path: relativePath });
    res.status(201).json({
      ...entry,
      isDirectory: type === 'directory',
      isText: type !== 'directory',
      isBinary: false,
      content: type === 'directory' ? null : (content || '')
    });
  } catch (err) {
    next(err);
  }
};

exports.uploadFile = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const { name, parentPath = '.', data } = req.body;
    const safeName = validateEntryName(name);
    const relativePath = buildRelativePath(parentPath, safeName);

    if (!data) {
      return res.status(400).json({ message: '未收到文件内容。' });
    }

    await ensureOwnedProject(projectId, req.user.id);
    await ensureParentDirectory(projectId, parentPath);
    await ensurePathAvailable(projectId, relativePath);

    const physicalPath = getSafePhysicalPath(projectId, relativePath);
    const buffer = decodeBase64Payload(data);
    await fs.writeFile(physicalPath, buffer);

    const entry = await File.create({ projectId, name: safeName, path: relativePath });
    res.status(201).json({
      ...entry,
      isDirectory: false,
      isText: isTextFile(safeName),
      isBinary: !isTextFile(safeName),
      content: isTextFile(safeName) ? buffer.toString('utf8') : null,
      url: toPublicUrl(projectId, relativePath),
      size: buffer.length
    });
  } catch (err) {
    next(err);
  }
};

exports.renameEntry = async (req, res, next) => {
  try {
    const fileId = req.params.id;
    const safeName = validateEntryName(req.body.name);
    const file = await File.findOwnedFile(fileId, req.user.id);

    if (!file) {
      return res.status(403).json({ message: '无权重命名该文件或文件夹。' });
    }

    if (isRootIndexFile(file.path)) {
      return res.status(400).json({ message: 'index.html 不能被重命名。' });
    }

    const oldPath = normalizeRelativePath(file.path);
    const parentPath = path.posix.dirname(oldPath);
    const newPath = parentPath === '.' ? `./${safeName}` : `${parentPath}/${safeName}`;

    await ensurePathAvailable(file.project_id, newPath);

    const oldPhysicalPath = getSafePhysicalPath(file.project_id, oldPath);
    const newPhysicalPath = getSafePhysicalPath(file.project_id, newPath);
    const stat = await fs.stat(oldPhysicalPath);

    await fs.rename(oldPhysicalPath, newPhysicalPath);
    await File.updateNameAndPath({ fileId, name: safeName, path: newPath });

    if (stat.isDirectory()) {
      await File.updateChildPaths({
        projectId: file.project_id,
        oldPrefix: oldPath,
        newPrefix: newPath
      });
    }

    res.json({ message: '重命名成功。', path: newPath, name: safeName });
  } catch (err) {
    next(err);
  }
};

exports.deleteEntry = async (req, res, next) => {
  try {
    const fileId = req.params.id;
    const file = await File.findOwnedFile(fileId, req.user.id);

    if (!file) {
      return res.status(403).json({ message: '无权删除该文件或文件夹。' });
    }

    if (isRootIndexFile(file.path)) {
      return res.status(400).json({ message: 'index.html 不能被删除。' });
    }

    const physicalPath = getSafePhysicalPath(file.project_id, file.path);
    const stat = await fs.stat(physicalPath);

    if (stat.isDirectory()) {
      await fs.rm(physicalPath, { recursive: true, force: true });
      await File.deleteByPathPrefix({ projectId: file.project_id, pathPrefix: file.path });
    } else {
      await fs.unlink(physicalPath);
    }

    await File.deleteById(fileId);
    res.json({ message: '删除成功。' });
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

    if (!isTextFile(file.name)) {
      return res.status(400).json({ message: '该文件不是可编辑的文本文件。' });
    }

    const physicalPath = getSafePhysicalPath(file.project_id, file.path);
    await writeTextFileAtomically(physicalPath, content || '');
    await File.touchUpdatedAt(fileId);

    res.json({ message: '代码文件已安全同步至磁盘。' });
  } catch (err) {
    next(err);
  }
};
