const express = require('express');
const router = express.Router();
const projectGroupController = require('../controllers/projectGroupController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', projectGroupController.listGroups);
router.post('/', projectGroupController.createGroup);
router.put('/:id', projectGroupController.updateGroup);
router.delete('/:id', projectGroupController.deleteGroup);

module.exports = router;
