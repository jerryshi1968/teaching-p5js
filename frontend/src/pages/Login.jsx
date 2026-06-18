import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, KeyRound, AlertCircle, Smile, Sparkles, Star, Rocket } from 'lucide-react';
import { useAppDialog } from '../hooks/useAppDialog';

const Login = () => {
  const navigate = useNavigate();
  const appDialog = useAppDialog();

  // 1. 状态定义
  const [isLoginTab, setIsLoginTab] = useState(true); // true 为登录状态，false 为注册状态
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // 仅注册时使用
  
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 切换选项卡时重置表单和错误信息
  const toggleTab = () => {
    setIsLoginTab(!isLoginTab);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setErrorMsg('');
  };

  // 2. 提交处理函数（登录与注册合并处理）
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    // 基础的前端格式校验
    if (!username.trim() || !password.trim()) {
      setErrorMsg('哎呀！请把名字和密码填写完整哦。');
      return;
    }

    if (!isLoginTab && password !== confirmPassword) {
      setErrorMsg('两次输入的密码不一样，请再检查一下吧！');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLoginTab ? '/api/auth/login' : '/api/auth/register';
      
      // 发起 Fetch 请求到您的 Express 后端（此处基于相对路径，建议在 Vite 中配置代理或使用完整路径）
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        // 如果后端返回错误（例如用户名重复返回 409，密码错误返回 401 等），展示对应的错误消息
        throw new Error(data.message || '操作失败了，请再试一次吧。');
      }

      if (isLoginTab) {
        // === 登录成功处理 ===
        // 1. 将 Token 和用户信息安全地保存到 localStorage 中，记住登录状态
        localStorage.setItem('teaching_token', data.token);
        localStorage.setItem('teaching_user', JSON.stringify(data.user));

        // 跳转到学生仪表盘页面
        navigate('/dashboard');
      } else {
        // === 注册成功处理 ===
        await appDialog.alert({
          title: '注册成功',
          message: '🎉 快用刚刚建好的账号登录，开启冒险吧！'
        });
        setIsLoginTab(true); // 注册成功后自动切回登录页
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    {appDialog.dialog}
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-indigo-100 to-pink-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* 背景装饰性卡通泡泡/星星，增加画面丰富度 */}
      <div className="absolute top-12 left-12 w-16 h-16 bg-yellow-200/60 rounded-full blur-lg animate-pulse" />
      <div className="absolute bottom-16 right-16 w-24 h-24 bg-pink-200/60 rounded-full blur-xl animate-pulse delay-75" />
      <div className="absolute top-1/4 right-10 text-yellow-400 opacity-60 hidden md:block">
        <Star className="w-12 h-12 fill-yellow-300" />
      </div>
      <div className="absolute bottom-1/4 left-10 text-indigo-400 opacity-60 hidden md:block">
        <Rocket className="w-12 h-12 -rotate-45" />
      </div>

      <div className="w-full max-w-md bg-white border-4 border-sky-300 rounded-[2.5rem] shadow-[0_12px_30px_rgba(0,0,0,0.1)] p-6 md:p-8 relative">
        
        {/* 卡片右上角可爱的小星星挂饰 */}
        <div className="absolute -top-5 -right-5 bg-amber-400 text-amber-950 px-3 py-1.5 rounded-full text-xs font-black shadow-md border-2 border-white flex items-center gap-1 rotate-12">
          <Sparkles className="w-3.5 h-3.5" />
          CODING
        </div>

        {/* 顶部选项卡切换 - 胶囊气泡形状 */}
        <div className="flex bg-slate-100 rounded-2xl p-1.5 mb-6 border-2 border-slate-200/50">
          <button
            onClick={() => !isLoginTab && toggleTab()}
            className={`flex-1 py-3 text-center text-sm font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 ${
              isLoginTab 
                ? 'bg-sky-400 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Smile className="w-4 h-4" />
            用户登录
          </button>
          <button
            onClick={() => isLoginTab && toggleTab()}
            className={`flex-1 py-3 text-center text-sm font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 ${
              !isLoginTab 
                ? 'bg-emerald-400 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            新用户注册
          </button>
        </div>

        {/* 主体内容 */}
        <div>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-slate-800">
              {isLoginTab ? '🎉 欢迎回来！' : '🚀 开启你的编程大冒险'}
            </h2>
            <p className="text-sm font-bold text-slate-400 mt-2">
              {isLoginTab ? '输入用户名和密码，快来和伙伴们汇合吧！' : '只需几步，即可创建你专属的编程基地！'}
            </p>
          </div>

          {/* 错误提示 - 改为温和醒目的卡通警示框 */}
          {errorMsg && (
            <div className="mb-5 bg-rose-50 border-2 border-rose-200 text-rose-700 px-4 py-3 rounded-2xl flex items-center space-x-2.5 text-xs font-bold animate-bounce">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 用户名输入 */}
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5 ml-1">
                🐱 我的用户名 / 登录名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入你在基地的用户名"
                  className="block w-full pl-11 pr-3 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 font-bold focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition duration-200"
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5 ml-1">
                🔑 秘密钥匙 (密码)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入你的密码钥匙"
                  className="block w-full pl-11 pr-11 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 font-bold focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 确认密码（仅注册时显示） */}
            {!isLoginTab && (
              <div className="transition-all duration-300">
                <label className="block text-xs font-black text-slate-500 mb-1.5 ml-1">
                  🎯 再次确认密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入相同的密码"
                    className="block w-full pl-11 pr-3 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition duration-200"
                  />
                </div>
              </div>
            )}

            {/* 提交按钮 - 经典的3D游戏按钮按下效果 */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white text-base font-black py-3 px-4 rounded-2xl transition-all duration-150 transform active:translate-y-1 mt-6 border-b-4 disabled:opacity-50 disabled:cursor-not-allowed ${
                isLoginTab 
                  ? 'bg-amber-400 hover:bg-amber-300 active:border-b-0 border-amber-600 shadow-md text-amber-950' 
                  : 'bg-emerald-400 hover:bg-emerald-300 active:border-b-0 border-emerald-600 shadow-md text-emerald-950'
              }`}
            >
              {loading 
                ? '正在呼唤魔法中...' 
                : isLoginTab 
                  ? '✨ 开启探险之旅 ✨' 
                  : '🍭 建立我的新账号 🍭'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
    </>
  );
};

export default Login;
