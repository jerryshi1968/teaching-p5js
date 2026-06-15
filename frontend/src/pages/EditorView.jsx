import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Split from 'react-split';
import { Play, Save, FileText, ChevronLeft, Sparkles, Wand2, Star, BookOpen, ExternalLink } from 'lucide-react';
import CodeEditor from '../components/Workspace/CodeEditor';

const EditorView = () => {
  const { projectId } = useParams();
  const iframeRef = useRef(null); // 用于引用 iframe 元素
  const [coords, setCoords] = useState(null); // 存放坐标 { x, y }，默认为 null（不显示）
  const navigate = useNavigate();

  // 1. 全局状态管理
  const [files, setFiles] = useState([]); // 存放从后端拉取的真实文件列表（含 id, name, path, content）
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeFileName, setActiveFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [projectName, setProjectName] = useState('加载中...');

  // 2. 初始化：从后端 API 拉取真实的物理代码文件
  useEffect(() => {
    const loadProjectFiles = async () => {
      try {
        const token = localStorage.getItem('teaching_token');
        
        // 请求单体项目信息，获取项目真实名称
        const projResponse = await fetch(`/api/projects/${projectId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (projResponse.ok) {
          const projData = await projResponse.json();
          setProjectName(projData.name); // 设置项目名称到状态中
        }

        // 拉取文件列表
        const response = await fetch(`/api/files/project/${projectId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '哎呀，没有找到魔法文件包。');

        setFiles(data);

        // 默认打开 sketch.js
        if (data.length > 0) {
          const defaultActive = data.find(f => f.name === 'sketch.js') || data[0];
          setActiveFileName(defaultActive.name);
        }
      } catch (err) {
        alert(err.message);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadProjectFiles();

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [projectId]);

  // 获取当前正在编辑的活动文件
  const activeFile = files.find(f => f.name === activeFileName);

  // 3. 处理代码实时输入（更新到 React 内存状态中）
  const handleCodeChange = (newContent) => {
    setFiles(prev => prev.map(f => f.name === activeFileName ? { ...f, content: newContent } : f));
  };

  // 4. 手动保存当前文件的代码
  const handleSaveActiveFile = async () => {
    if (!activeFile) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('teaching_token');
      const response = await fetch(`/api/files/${activeFile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: activeFile.content })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '保存失败了，请再试一次哦');

      // 友好活泼的保存提示
      alert(`🎉 太棒了！"${activeFile.name}" 已成功存入你的魔法书架！`);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // 5. 预览运行逻辑 (包含静默自动保存)
  const handleRun = async () => {
    const htmlFile = files.find(f => f.name === 'index.html');
    const cssFile = files.find(f => f.name === 'style.css');
    const jsFile = files.find(f => f.name === 'sketch.js');

    if (!htmlFile || !jsFile || !cssFile) return;

    // === 【自动静默保存】：运行代码时自动将数据上传至服务器 ===
    if (activeFile) {
      try {
        const token = localStorage.getItem('teaching_token');
        await fetch(`/api/files/${activeFile.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content: activeFile.content })
        });
      } catch (e) {
        console.warn('自动保存遇到了一点小麻烦:', e);
      }
    }

    // 动态拼接代码
    let combinedHtml = htmlFile.content;

    // 替换内存中最新的 CSS
    combinedHtml = combinedHtml.replace(
      /<link\s+rel="stylesheet"\s+type="text\/css"\s+href="style\.css">/i,
      `<style>${cssFile.content}</style>`
    );

    // 替换内存中最新的 JS
    combinedHtml = combinedHtml.replace(
      /<script\s+src="sketch\.js"><\/script>/i,
      `<script>${jsFile.content}</script>`
    );

    // 生成 Blob 渲染
    const blob = new Blob([combinedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // 垃圾回收，防止内存泄漏
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
  };

  // 6. 在独立标签页打开预览
  const handleOpenInNewTab = () => {
    if (!previewUrl) {
      alert('🪄 魔法画布还没有准备好，请先点击上方的“施放魔法”运行一次代码哦！');
      return;
    }
    // 直接在浏览器新标签页中打开临时的 Blob 预览页面
    window.open(previewUrl, '_blank');
  };

  // 7. 跨 Iframe 安全捕获鼠标/手指移动坐标 ====================
  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      // 获取 iframe 的内部 document 对象
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (!iframeDoc) return;

      // 统一的移动处理逻辑
      const handleMove = (clientX, clientY) => {
        const canvas = iframeDoc.querySelector('canvas');
        if (!canvas) {
          setCoords(null); // 防御机制：如果子文档中此时没有 canvas，清空坐标并不处理
          return;
        }

        // 计算鼠标/手指相对于 canvas 元素左上角的物理像素坐标
        const rect = canvas.getBoundingClientRect();
        const x = Math.round(clientX - rect.left);
        const y = Math.round(clientY - rect.top);

        // 安全范围限定：只有在 canvas 内部移动时才显示坐标，移出则清空
        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
          setCoords({ x, y });
        } else {
          setCoords(null);
        }
      };

      // 1. 鼠标移动监听
      const onMouseMove = (e) => {
        handleMove(e.clientX, e.clientY);
      };

      // 2. 触摸移动监听（支持手指触摸移动）
      const onTouchMove = (e) => {
        if (e.touches && e.touches.length > 0) {
          const touch = e.touches[0];
          handleMove(touch.clientX, touch.clientY);
        }
      };

      // 3. 移出监听
      const onMouseLeave = () => {
        setCoords(null);
      };

      // 将事件监听器绑定在 iframe 内部的 document 上
      // 这样即便 canvas 异步生成晚了，只要在 iframe 里移动依然能被动态捕获并处理
      iframeDoc.addEventListener('mousemove', onMouseMove, { passive: true });
      iframeDoc.addEventListener('touchmove', onTouchMove, { passive: true });
      iframeDoc.addEventListener('mouseleave', onMouseLeave, { passive: true });
      iframeDoc.addEventListener('touchend', onMouseLeave, { passive: true });

    } catch (err) {
      console.warn('跨域或沙箱限制，无法附加坐标监听器:', err);
    }
  };
  
  // 首次加载完毕后，自动在画布中静默绘制一次
  useEffect(() => {
    if (files.length > 0) {
      handleRun();
    }
  }, [loading]);

  // 加载状态也改造为生动有趣的魔法加载动效
  if (loading) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-sky-100 via-indigo-50 to-pink-100 flex flex-col items-center justify-center text-slate-600 gap-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          <Wand2 className="w-7 h-7 text-indigo-500 absolute animate-pulse" />
        </div>
        <p className="font-black text-base animate-bounce text-indigo-950">
          正在为你拼装魔法画板，代码正在飞速赶来... 🚀
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-50 text-slate-800 flex flex-col overflow-hidden font-sans">
      
      {/* 1. 顶栏 - 升级为白净可爱的操控中心 */}
      <header className="h-16 bg-white border-b-4 border-slate-100 flex items-center justify-between px-5 select-none shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="bg-slate-100 hover:bg-slate-200 p-2.5 rounded-2xl border-2 border-slate-200 text-slate-500 hover:text-slate-700 transition shadow-sm active:translate-y-0.5"
            title="返回我的工坊"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-indigo-100 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-full">
              创意项目
            </span>
            <span className="font-black text-sm truncate max-w-[200px] text-slate-700">
              {projectName}
            </span>
          </div>
        </div>
        
        {/* 操作区 - 升级为3D糖果按键 */}
        <div className="flex items-center space-x-3">
          {/* 保存按钮 */}
          <button
            onClick={handleSaveActiveFile}
            disabled={saving}
            className="flex items-center space-x-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 px-4 py-2 rounded-2xl text-xs font-black border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? '正在封存...' : '保存魔法书'}</span>
          </button>

          {/* 运行按钮 */}
          <button
            onClick={handleRun}
            className="flex items-center space-x-1.5 bg-emerald-400 hover:bg-emerald-300 text-white px-5 py-2 rounded-2xl text-xs font-black border-b-4 border-emerald-600 active:border-b-0 active:translate-y-1 transition-all shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>施放魔法 (运行)</span>
          </button>
        </div>
      </header>

      {/* 2. 主编辑器及拖拽区 */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 左侧固定的“魔法书架”（文件管理器） */}
        <div className="w-48 bg-slate-100 border-r-4 border-slate-200/60 flex flex-col select-none">
          <div className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-wider border-b-2 border-slate-200/50 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>魔法书目录</span>
          </div>
          <div className="flex-1 py-3 space-y-1.5 overflow-y-auto">
            {files.map(file => {
              const isActive = activeFileName === file.name;
              return (
                <button
                  key={file.name}
                  onClick={() => setActiveFileName(file.name)}
                  className={`w-[90%] mx-auto flex items-center space-x-2 px-3.5 py-2.5 text-xs text-left rounded-2xl transition-all ${
                    isActive 
                      ? 'bg-indigo-400 text-white font-extrabold shadow-sm translate-x-1' 
                      : 'hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 font-bold'
                  }`}
                >
                  {isActive ? (
                    <Star className="w-4 h-4 shrink-0 fill-yellow-200 text-yellow-200 animate-spin-slow" />
                  ) : (
                    <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                  )}
                  <span className="truncate">{file.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧：代码编辑区 与 页面预览区 */}
        <Split 
          className="flex-1 flex"
          sizes={[55, 45]} 
          minSize={250} 
          gutterSize={8}
          direction="horizontal"
        >
          {/* 左半边：代码编辑器容器 */}
          <div className="h-full bg-[#1e1e1e] rounded-l-2xl overflow-hidden border-2 border-transparent">
            <CodeEditor
              fileName={activeFileName}
              value={activeFile ? activeFile.content : ''}
              onChange={handleCodeChange}
            />
          </div>

          {/* 右半边：实时预览容器 - 升级为魔法显示屏 */}
          <div className="h-full bg-white flex flex-col border-l-4 border-slate-100">
            <div className="px-4 py-2.5 bg-slate-100 text-xs text-slate-500 font-black border-b-2 border-slate-200 select-none flex items-center justify-between">
              {/* 左侧标题 */}
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                <span>✨ 魔法画布 (神奇预览窗口)</span>
              </div>

              {/* 🎯 动态显示鼠标/手指坐标的软圆角红盒子 */}
              <div className="flex items-center">
                {coords ? (
                  <span className="bg-rose-50 border border-rose-200 text-rose-600 px-2 py-1 rounded-lg font-mono text-[12px] tracking-wider shadow-sm animate-fadeIn">
                    🎯 ({coords.x}, {coords.y})
                  </span>
                ) : (
                  <span className="bg-slate-50 border border-slate-200 text-slate-400 px-2.5 py-0.5 rounded-lg font-mono text-[10px] tracking-wider">
                    🎯 (--, --)
                  </span>
                )}
              </div>
              
              {/* 右侧独立大视窗按键 */}
              <button
                onClick={handleOpenInNewTab}
                className="flex items-center space-x-1.5 text-indigo-600 hover:text-indigo-800 transition duration-150 font-black bg-indigo-50 hover:bg-indigo-100/80 px-3 py-1 rounded-xl border border-indigo-200/60 shadow-sm active:translate-y-0.5"
                title="在浏览器独立的大标签页中全屏运行"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>独立大视窗</span>
              </button>
            </div>
            
            <div className="flex-1 bg-white relative">
              {previewUrl ? (
                <iframe
                  ref={iframeRef} // 绑定引用
                  onLoad={handleIframeLoad} // 每次 iframe 载入/刷新时自动挂载监听
                  title="p5js-preview"
                  src={previewUrl}
                  // 关键：增加 allow-same-origin 允许 p5.js 访问自身的渲染上下文并成功加载同域脚本
                  sandbox="allow-scripts allow-same-origin" 
                  className="w-full h-full border-none bg-white"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm font-bold gap-3 p-4 text-center">
                  <div className="bg-slate-100 p-4 rounded-full border-2 border-slate-200">
                    <Wand2 className="w-8 h-8 text-indigo-400" />
                  </div>
                  <span>你的魔法画布现在空空如也，<br />快点击上方的 “施放魔法” 运行代码吧！</span>
                </div>
              )}
            </div>
          </div>
        </Split>
      </div>
    </div>
  );
};

export default EditorView;
