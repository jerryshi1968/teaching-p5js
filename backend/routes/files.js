const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/project/:projectId', fileController.getProjectFiles); // 获取项目下所有文件（包含代码）
router.put('/:id', fileController.saveFileContent); // 保存单个文件的代码

module.exports = router;