#!/bin/bash

# 定义项目根目录名称
PROJECT_ROOT="teaching-p5js"

echo "开始构建项目目录结构: ${PROJECT_ROOT}..."

# 1. 进入项目目录（需提前手工建好）
cd "../$PROJECT_ROOT" || exit

# 创建根目录下的说明文件
touch README.md

# 2. 创建后端目录及文件
echo "正在创建后端 (backend) 目录及占位文件..."
mkdir -p backend/config \
         backend/controllers \
         backend/middleware \
         backend/models \
         backend/routes \
         backend/storage/projects

touch backend/package.json \
      backend/app.js \
      backend/config/db.js \
      backend/controllers/authController.js \
      backend/controllers/projectController.js \
      backend/controllers/fileController.js \
      backend/middleware/authMiddleware.js \
      backend/middleware/securityMiddleware.js \
      backend/models/userModel.js \
      backend/models/projectModel.js \
      backend/models/fileModel.js \
      backend/routes/auth.js \
      backend/routes/projects.js \
      backend/routes/files.js

# 3. 创建前端目录及文件
echo "正在创建前端 (frontend) 目录及占位文件..."
mkdir -p frontend/public \
         frontend/src/assets \
         frontend/src/components/Workspace \
         frontend/src/components/Common \
         frontend/src/context \
         frontend/src/hooks \
         frontend/src/pages \
         frontend/src/services \
         frontend/src/utils

touch frontend/package.json \
      frontend/src/App.jsx \
      frontend/src/main.jsx \
      frontend/src/components/Workspace/FileTree.jsx \
      frontend/src/components/Workspace/CodeEditor.jsx \
      frontend/src/components/Workspace/Preview.jsx \
      frontend/src/components/Workspace/Console.jsx \
      frontend/src/context/AuthContext.jsx \
      frontend/src/context/WorkspaceContext.jsx \
      frontend/src/pages/Login.jsx \
      frontend/src/pages/Dashboard.jsx \
      frontend/src/pages/EditorView.jsx \
      frontend/src/services/api.js

echo "目录结构构建完成！"