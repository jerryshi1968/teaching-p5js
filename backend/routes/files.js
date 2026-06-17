const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/project/:projectId', fileController.getProjectFiles);
router.post('/project/:projectId', fileController.createEntry);
router.post('/project/:projectId/upload', fileController.uploadFile);
router.patch('/:id/rename', fileController.renameEntry);
router.delete('/:id', fileController.deleteEntry);
router.put('/:id', fileController.saveFileContent);

module.exports = router;
