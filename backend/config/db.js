const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,   // 连接池最大连接数，可根据生产环境配置调整
  queueLimit: 0          // 当无可用连接时，排队请求不限制数量
});

// 导出 promise 化的 pool 实例
module.exports = pool;