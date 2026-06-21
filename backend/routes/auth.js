const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 注册和登录路由（无需加 authMiddleware 拦截，属于公开接口）
router.post('/register', authController.register);
router.post('/login', authController.login);

const authMiddleware = require('../middleware/authMiddleware');
router.get('/me', authMiddleware, authController.getMe);
router.put('/me', authMiddleware, authController.updateMe);
router.put('/me/password', authMiddleware, authController.changePassword);
router.get('/students', authMiddleware, authController.listStudents);

module.exports = router;
