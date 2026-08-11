const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const EXAMPLES_BASE_DIR = path.resolve(__dirname, '../storage/examples');
const PROJECTS_BASE_DIR = path.resolve(__dirname, '../storage/projects');
const MANIFEST_PATH = path.join(EXAMPLES_BASE_DIR, 'manifest.json');
const DEFAULT_MANIFEST = [
  { id: 'shapes-and-text', directory: '图形和文字', names: { zh: '图形和文字', en: 'Shapes and Text' }, order: 1 },
  { id: 'windmill', directory: '大风车', names: { zh: '大风车', en: 'Windmill' }, order: 2 },
  { id: 'bouncing-balls', directory: '弹球碰碰碰', names: { zh: '弹球碰碰碰', en: 'Bouncing Balls' }, order: 3 },
  { id: 'tank-battle', directory: '坦克大战', names: { zh: '坦克大战', en: 'Tank Battle' }, order: 4 },
  { id: 'animal-city', directory: '疯狂动物城', names: { zh: '疯狂动物城', en: 'Animal City' }, order: 5 },
  { id: 'airplane-battle', directory: '飞机大战', names: { zh: '飞机大战', en: 'Airplane Battle' }, order: 6 }
];

function createError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getSafeChildPath(baseDirectory, childPath) {
  const resolvedBase = path.resolve(baseDirectory);
  const resolvedChild = path.resolve(resolvedBase, childPath);

  if (resolvedChild === resolvedBase || !resolvedChild.startsWith(`${resolvedBase}${path.sep}`)) {
    throw createError('例子目录配置不正确。');
  }

  return resolvedChild;
}

function validateManifestEntry(entry, seenIds) {
  const id = String(entry?.id || '').trim();
  const directory = String(entry?.directory || '').trim();
  const zhName = String(entry?.names?.zh || '').trim();
  const enName = String(entry?.names?.en || '').trim();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || seenIds.has(id)) {
    throw createError('例子清单中存在无效或重复的 ID。');
  }

  if (!directory || !zhName || !enName) {
    throw createError(`例子 ${id} 的目录或多语言名称不完整。`);
  }

  getSafeChildPath(EXAMPLES_BASE_DIR, directory);
  seenIds.add(id);

  return {
    id,
    directory,
    names: { zh: zhName, en: enName },
    order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : 0
  };
}

async function readManifest() {
  let parsed;

  try {
    const content = await fs.readFile(MANIFEST_PATH, 'utf8');
    parsed = JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      parsed = DEFAULT_MANIFEST;
    } else {
      throw createError('例子清单读取失败。');
    }
  }

  if (!Array.isArray(parsed)) {
    throw createError('例子清单格式不正确。');
  }

  const seenIds = new Set();
  return parsed
    .map((entry) => validateManifestEntry(entry, seenIds))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

async function copyDirectoryEntries(sourceDirectory, targetDirectory, relativeDirectory = '', records = []) {
  await fs.mkdir(targetDirectory, { recursive: true });
  const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    if (entry.isSymbolicLink()) {
      throw createError(`例子中不允许包含符号链接：${relativePath}`);
    }

    if (entry.name.length > 100 || `./${relativePath}`.length > 255) {
      throw createError(`例子中的路径过长：${relativePath}`);
    }

    if (entry.isDirectory()) {
      records.push({ name: entry.name, path: `./${relativePath}` });
      await copyDirectoryEntries(sourcePath, targetPath, relativePath, records);
      continue;
    }

    if (!entry.isFile()) {
      throw createError(`例子中包含不支持的文件类型：${relativePath}`);
    }

    await fs.copyFile(sourcePath, targetPath);
    records.push({ name: entry.name, path: `./${relativePath}` });
  }

  return records;
}

exports.listExamples = async () => {
  const examples = await readManifest();
  const availableExamples = await Promise.all(examples.map(async (example) => {
    const exampleDirectory = getSafeChildPath(EXAMPLES_BASE_DIR, example.directory);
    const stat = await fs.stat(exampleDirectory).catch(() => null);
    return stat?.isDirectory() ? example : null;
  }));
  return availableExamples.filter(Boolean).map(({ id, names }) => ({ id, names }));
};

exports.findExampleById = async (exampleId) => {
  const examples = await readManifest();
  return examples.find((example) => example.id === exampleId) || null;
};

exports.prepareImport = async ({ example, projectId }) => {
  const sourceDirectory = getSafeChildPath(EXAMPLES_BASE_DIR, example.directory);
  const sourceStat = await fs.stat(sourceDirectory).catch(() => null);

  if (!sourceStat || !sourceStat.isDirectory()) {
    throw createError('例子程序目录不存在。', 404);
  }

  await fs.mkdir(PROJECTS_BASE_DIR, { recursive: true });
  const stagingDirectory = path.join(PROJECTS_BASE_DIR, `.import-${projectId}-${crypto.randomUUID()}`);

  try {
    const records = await copyDirectoryEntries(sourceDirectory, stagingDirectory);
    if (!records.some((record) => record.path === './index.html')) {
      throw createError('例子程序缺少根目录 index.html。');
    }

    return { stagingDirectory, records };
  } catch (err) {
    await fs.rm(stagingDirectory, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
};

exports.getProjectDirectory = (projectId) => getSafeChildPath(PROJECTS_BASE_DIR, projectId);

exports.createBackupDirectory = (projectId) => (
  path.join(PROJECTS_BASE_DIR, `.backup-${projectId}-${crypto.randomUUID()}`)
);
