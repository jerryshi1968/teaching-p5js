const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

router.get('/users', authMiddleware, adminMiddleware, adminController.listUsers);

module.exports = router;
