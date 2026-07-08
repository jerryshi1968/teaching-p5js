const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');

// 所有的项目操作均需要 JWT 验证
router.use(authMiddleware);

router.get('/', projectController.listProjects);
router.post('/', projectController.createProject);
router.post('/copy', projectController.copyProject);
router.put('/reorder', projectController.reorderProjects);
router.post('/:id/copy', projectController.copyProject);
router.post('/:id/distribute-to-class', projectController.distributeProjectToClass);
router.delete('/:id', projectController.deleteProject);
router.get('/:id', projectController.getProjectById);
router.put('/:id/move', projectController.moveProject);
router.put('/:id', projectController.updateProject);

module.exports = router;
