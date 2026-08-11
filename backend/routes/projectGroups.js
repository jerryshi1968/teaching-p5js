const express = require('express');
const router = express.Router();
const projectGroupController = require('../controllers/projectGroupController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/all', projectGroupController.listAllGroups);
router.put('/reorder', projectGroupController.reorderGroups);
router.get('/', projectGroupController.listGroups);
router.post('/', projectGroupController.createGroup);
router.put('/:id/move', projectGroupController.moveGroup);
router.put('/:id/reposition', projectGroupController.repositionGroup);
router.put('/:id', projectGroupController.updateGroup);
router.delete('/:id', projectGroupController.deleteGroup);

module.exports = router;
