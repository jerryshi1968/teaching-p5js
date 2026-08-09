const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const db = require('./config/db');
const languageMiddleware = require('./middleware/languageMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);

// 1. 全局中间件配置
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // 允许的前端源
  credentials: true // 允许携带 Cookie/Auth Header
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(languageMiddleware);
app.use('/teaching-p5js/projects', express.static(path.resolve(__dirname, 'storage/projects')));

// 2. 健康检查路由：直接测试 Express 与 MySQL 8.4 的连接
app.get('/api/health', async (req, res) => {
  try {
    // 执行简单 SQL 验证连接池是否可用
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.status(200).json({
      status: 'OK',
      message: 'Express server is running and connected to MySQL successfully.',
      db_check: rows[0].result === 2 ? 'Database Active' : 'Database Error'
    });
  } catch (err) {
    console.error('Database connection check failed:', err);
    res.status(500).json({
      status: 'Error',
      message: 'Server is running, but database connection failed.',
      error: err.message
    });
  }
});

// 3. 业务路由挂载
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/project-groups', require('./routes/projectGroups'));
app.use('/api/files', require('./routes/files'));
app.use('/api/ai', require('./routes/ai'));

// 4. 全局错误捕获中间件
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error('Unhandled Server Error:', err.stack);
  res.status(statusCode).json({
    message: err.message || req.t?.('server.unexpected') || 'An unexpected internal error occurred.',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 5. 启动监听
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT} in ${process.env.NODE_ENV} mode.`);
});

module.exports = app;
