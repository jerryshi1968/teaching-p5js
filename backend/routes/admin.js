const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

router.get('/users', authMiddleware, adminMiddleware, adminController.listUsers);
router.put('/users/:id/role', authMiddleware, adminMiddleware, adminController.updateUserRole);
router.get('/teachers', authMiddleware, adminMiddleware, adminController.listTeachers);
router.get('/classes', authMiddleware, adminMiddleware, adminController.listClasses);
router.post('/classes', authMiddleware, adminMiddleware, adminController.createClass);
router.put('/classes/:id', authMiddleware, adminMiddleware, adminController.updateClass);
router.delete('/classes/:id', authMiddleware, adminMiddleware, adminController.deleteClass);

module.exports = router;
