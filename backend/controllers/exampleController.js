const fs = require('fs').promises;
const Project = require('../models/projectModel');
const File = require('../models/fileModel');
const ExampleService = require('../services/exampleService');

exports.listExamples = async (req, res, next) => {
  try {
    const examples = await ExampleService.listExamples();
    res.json(examples);
  } catch (err) {
    next(err);
  }
};

exports.importExample = async (req, res, next) => {
  let connection = null;
  let stagingDirectory = null;
  let backupDirectory = null;
  let projectDirectory = null;
  let transactionStarted = false;
  let diskSwapped = false;
  let committed = false;

  try {
    const projectId = req.params.id;
    const exampleId = String(req.body.exampleId || '').trim();
    const ownedProject = await Project.findOwnedById(projectId, req.user.id);

    if (!ownedProject) {
      return res.status(404).json({ message: req.t('examples.projectNotFound') });
    }

    if (!exampleId) {
      return res.status(400).json({ message: req.t('examples.idRequired') });
    }

    const example = await ExampleService.findExampleById(exampleId);
    if (!example) {
      return res.status(404).json({ message: req.t('examples.notFound') });
    }

    const preparedImport = await ExampleService.prepareImport({ example, projectId });
    stagingDirectory = preparedImport.stagingDirectory;
    projectDirectory = ExampleService.getProjectDirectory(projectId);
    backupDirectory = ExampleService.createBackupDirectory(projectId);

    connection = await Project.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const lockedProject = await Project.findOwnedByIdWithConnection(connection, projectId, req.user.id);
    if (!lockedProject) {
      const error = new Error(req.t('examples.projectNotFound'));
      error.statusCode = 404;
      throw error;
    }

    const projectStat = await fs.stat(projectDirectory).catch(() => null);
    if (projectStat) {
      if (!projectStat.isDirectory()) {
        throw new Error(req.t('examples.projectDirectoryInvalid'));
      }
      await fs.rename(projectDirectory, backupDirectory);
    } else {
      backupDirectory = null;
    }

    await fs.rename(stagingDirectory, projectDirectory);
    stagingDirectory = null;
    diskSwapped = true;

    await File.deleteByProjectIdWithConnection(connection, projectId);
    for (const record of preparedImport.records) {
      await File.createWithConnection(connection, {
        projectId,
        name: record.name,
        path: record.path
      });
    }

    await connection.commit();
    transactionStarted = false;
    committed = true;

    if (backupDirectory) {
      await fs.rm(backupDirectory, { recursive: true, force: true }).catch((err) => {
        console.error('Failed to remove project import backup:', err);
      });
      backupDirectory = null;
    }

    res.json({
      example: { id: example.id, names: example.names },
      message: req.t('examples.importSuccess')
    });
  } catch (err) {
    if (transactionStarted && connection) {
      await connection.rollback().catch(() => {});
    }

    if (!committed && diskSwapped && projectDirectory) {
      await fs.rm(projectDirectory, { recursive: true, force: true }).catch(() => {});
      if (backupDirectory) {
        await fs.rename(backupDirectory, projectDirectory).catch((restoreError) => {
          console.error('Failed to restore project after example import:', restoreError);
        });
      }
    } else if (!committed && backupDirectory && projectDirectory) {
      const projectStat = await fs.stat(projectDirectory).catch(() => null);
      if (!projectStat) {
        await fs.rename(backupDirectory, projectDirectory).catch((restoreError) => {
          console.error('Failed to restore project after example import:', restoreError);
        });
      }
    }

    if (stagingDirectory) {
      await fs.rm(stagingDirectory, { recursive: true, force: true }).catch(() => {});
    }

    next(err);
  } finally {
    if (connection) connection.release();
  }
};
