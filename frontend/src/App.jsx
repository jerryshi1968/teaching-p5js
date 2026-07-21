import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EditorView from './pages/EditorView';
import Admin from './pages/Admin';
import { LanguageProvider } from './i18n/LanguageContext';

/**
 * 路由守卫组件：检查 localStorage 中是否存在登录 Token
 * 如果存在：允许访问子组件
 * 如果不存在：使用 replace 强制重定向至登录页
 */
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('teaching_token');
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <LanguageProvider>
    <Router basename="/teaching-p5js">
      <Routes>
        {/* 1. 默认访问根路径时，重定向到仪表盘（如果是未登录，会被 PrivateRoute 再次拦截到登录页） */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* 2. 公开路由：登录与注册 */}
        <Route path="/login" element={<Login />} />
        
        {/* 3. 私有保护路由：仪表盘和编辑器 */}
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/editor/:projectId" 
          element={
            <PrivateRoute>
              <EditorView />
            </PrivateRoute>
          } 
        />
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <Admin />
            </PrivateRoute>
          }
        />

        {/* 4. 兜底路由：匹配不到任何路径时，自动重定向到 /dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
    </LanguageProvider>
  );
}

export default App;
