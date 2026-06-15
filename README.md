# teaching-p5js

> 版本：1.0.0

`teaching-p5js` 是一个面向 p5.js 创意编程教学的在线练习平台。学生可以注册登录、创建 p5.js 项目、编辑 `index.html` / `sketch.js` / `style.css`，并在浏览器中实时运行预览；教师账号可以查看学生列表并进入学生作品进行督导查看。

## 功能特性

- 用户注册与登录，基于 JWT 进行接口认证
- 学生项目管理：创建、重命名、删除、查看项目
- 默认生成 p5.js 项目模板文件
- 在线代码编辑器，支持 HTML、JavaScript、CSS 语法高亮
- 实时预览 p5.js 作品，并支持独立窗口打开预览
- 运行时自动保存当前文件，支持手动保存
- 教师/管理员可查看学生列表与学生项目
- 项目代码同时记录在数据库元数据与本地物理文件中

## 技术栈

### 前端

- React 18
- Vite 5
- React Router
- Tailwind CSS
- CodeMirror 6
- lucide-react
- react-split

### 后端

- Node.js
- Express
- MySQL 8
- mysql2
- bcryptjs
- jsonwebtoken
- dotenv

## 项目结构

```text
teaching-p5js/
├── backend/
│   ├── app.js
│   ├── package.json
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── fileController.js
│   │   └── projectController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── files.js
│   │   └── projects.js
│   └── storage/
│       └── projects/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   │   └── libs/
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/
│       ├── context/
│       ├── pages/
│       └── services/
├── setup_project.sh
└── README.md
```

## 环境要求

- Node.js 18 或更高版本
- npm
- MySQL 8.x

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repository-url>
cd teaching-p5js
```

### 2. 安装依赖

后端：

```bash
cd backend
npm install
```

前端：

```bash
cd ../frontend
npm install
```

### 3. 配置后端环境变量

在 `backend/.env` 中配置以下变量：

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=teaching_p5js

JWT_SECRET=replace_with_a_strong_secret
```

### 4. 初始化数据库

创建数据库：

```sql
CREATE DATABASE teaching_p5js
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

参考当前后端代码，至少需要以下三张表：

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id CHAR(36) PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_files_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE CASCADE
);
```

如需创建教师账号，可以先注册普通账号，再在数据库中修改角色：

```sql
UPDATE users SET role = 'teacher' WHERE username = 'teacher_username';
```

### 5. 启动后端

```bash
cd backend
npm run dev
```

后端默认运行在：

```text
http://localhost:5000
```

健康检查接口：

```text
GET /api/health
```

### 6. 启动前端

```bash
cd frontend
npm run dev
```

前端默认运行在：

```text
http://localhost:5173/teaching-p5js/
```

> 注意：当前前端代码使用 `/api/...` 相对路径请求后端接口。开发环境中需要将 `/api` 请求代理到 `http://localhost:5000`，或通过同源服务/反向代理部署前后端。

## 常用脚本

### 后端

```bash
npm start
npm run dev
```

### 前端

```bash
npm run dev
npm run build
npm run preview
```

## API 概览

### 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | 注册学生账号 |
| `POST` | `/api/auth/login` | 登录并获取 JWT |
| `GET` | `/api/auth/students` | 获取学生列表，教师/管理员可用 |

### 项目

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/projects` | 获取当前用户项目列表 |
| `GET` | `/api/projects?studentId=<id>` | 教师/管理员查看指定学生项目 |
| `POST` | `/api/projects` | 创建项目并生成默认文件 |
| `GET` | `/api/projects/:id` | 获取单个项目信息 |
| `PUT` | `/api/projects/:id` | 修改项目名称 |
| `DELETE` | `/api/projects/:id` | 删除项目及对应物理文件 |

### 文件

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/files/project/:projectId` | 获取项目下所有文件及内容 |
| `PUT` | `/api/files/:id` | 保存单个文件内容 |

除注册、登录与健康检查外，业务接口需要在请求头中携带：

```text
Authorization: Bearer <token>
```

## 项目文件模板

新建项目时，后端会自动创建以下文件：

- `index.html`
- `sketch.js`
- `style.css`

文件会保存在：

```text
backend/storage/projects/<project-id>/
```

同时，文件元数据会写入 MySQL 的 `files` 表。

## 构建与部署

前端构建：

```bash
cd frontend
npm run build
```

构建产物位于：

```text
frontend/dist/
```

后端生产运行：

```bash
cd backend
npm start
```

部署时建议：

- 使用强随机值配置 `JWT_SECRET`
- 不要提交真实 `.env` 到公开仓库
- 配置 HTTPS
- 将 `/api` 反向代理到后端服务
- 确保 `backend/storage/projects` 具备可写权限
- 定期备份 MySQL 数据库与项目文件目录

## 已知说明

- 前端路由基准路径为 `/teaching-p5js/`，由 `frontend/vite.config.js` 中的 `base` 配置决定。
- 当前项目没有内置数据库迁移脚本，首次部署需要手动建表。
- 当前前端开发配置未内置 `/api` 代理，开发或部署时需要额外配置代理。

## 版本

当前版本：`1.0.0`

## License

本项目基于 MIT License 开源，详情请查看 [LICENSE](./LICENSE)。
