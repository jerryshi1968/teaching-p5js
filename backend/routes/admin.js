const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

router.get('/users', authMiddleware, adminMiddleware, adminController.listUsers);
router.put('/users/:id/role', authMiddleware, adminMiddleware, adminController.updateUserRole);
router.post('/users/:id/tokens/recharge', authMiddleware, adminMiddleware, adminController.rechargeUserTokens);
router.patch('/users/:id/tokens/recharge', authMiddleware, adminMiddleware, adminController.rechargeUserTokens);
router.get('/teachers', authMiddleware, adminMiddleware, adminController.listTeachers);
router.get('/classes', authMiddleware, adminMiddleware, adminController.listClasses);
router.post('/classes', authMiddleware, adminMiddleware, adminController.createClass);
router.get('/classes/:id/students', authMiddleware, adminMiddleware, adminController.listClassStudents);
router.delete('/classes/:id/students/:studentId', authMiddleware, adminMiddleware, adminController.removeClassStudent);
router.put('/classes/:id', authMiddleware, adminMiddleware, adminController.updateClass);
router.delete('/classes/:id', authMiddleware, adminMiddleware, adminController.deleteClass);

module.exports = router;
