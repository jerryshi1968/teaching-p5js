const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/project/:projectId/code', aiController.generateCodeSuggestion);

module.exports = router;
