const Project = require('../models/projectModel');

const AI_MODEL = 'deepseek-v4-flash';
const ALLOWED_FILES = new Set(['index.html', 'style.css', 'sketch.js']);
const OPTIONAL_FILES = new Set(['style.css', 'sketch.js']);
const P5_SCRIPT_TAG = '<script src="/teaching-p5js/libs/p5-1.11.13.min.js"></script>';

function normalizeAiFiles(files = {}) {
  const normalized = {};

  Object.entries(files || {}).forEach(([name, content]) => {
    const cleanName = String(name || '').replace(/\\/g, '/').split('/').pop();
    if (!ALLOWED_FILES.has(cleanName)) return;
    if (content === null || content === undefined) return;
    normalized[cleanName] = String(content);
  });

  return normalized;
}

function buildSystemPrompt(existingFileNames) {
  const optionalNote = Array.from(OPTIONAL_FILES)
    .filter((fileName) => !existingFileNames.includes(fileName))
    .join('、');

  return [
    '你是一个面向中小学生 p5.js 教学网站的代码助手。',
    '你只能修改 index.html、style.css、sketch.js 这三个文件。',
    'style.css 和 sketch.js 是可选文件；如果用户项目中不存在，不要因为缺失而报错，也不要强行创建，除非用户明确需要。',
    optionalNote ? `当前项目缺少这些可选文件：${optionalNote}。` : '',
    '必须保留已有中文注释和英文注释，不要删除、精简或改写任何已有注释。',
    '如果必须调整带行尾注释的代码，必须把原有行尾注释完整保留在修改后的代码旁边或上方。',
    `index.html 必须引用本站 p5.js 库：${P5_SCRIPT_TAG}，不要使用 cdnjs.cloudflare.com、unpkg、jsdelivr 或其他外部 p5.js CDN。`,
    '优先生成适合初学者理解的代码，不要引入复杂依赖。',
    '只返回严格 JSON，不要返回 Markdown、代码围栏或额外解释。',
    'JSON 格式必须是：{"message":"给用户看的简短说明","files":{"index.html":"完整内容","style.css":"完整内容","sketch.js":"完整内容"}}。',
    'files 里只包含需要修改或创建的文件；未修改文件可以省略。'
  ].filter(Boolean).join('\n');
}

function parseAiJson(rawContent) {
  const content = String(rawContent || '').trim();

  try {
    return JSON.parse(content);
  } catch (err) {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw err;
    return JSON.parse(match[0]);
  }
}

exports.generateCodeSuggestion = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findAccessibleById(projectId, req.user);

    if (!project || project.user_id !== req.user.id) {
      return res.status(403).json({ message: '无权使用 AI 修改该项目。' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: '服务器未配置 DEEPSEEK_API_KEY。' });
    }

    const prompt = String(req.body.prompt || '').trim();
    const files = normalizeAiFiles(req.body.files);
    const activeFile = String(req.body.activeFile || '');

    if (!prompt) {
      return res.status(400).json({ message: '请输入想让 AI 修改的内容。' });
    }

    if (!files['index.html']) {
      return res.status(400).json({ message: 'index.html 是必需文件，请先确认项目文件已加载。' });
    }

    const existingFileNames = Object.keys(files);
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: AI_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt(existingFileNames) },
          {
            role: 'user',
            content: JSON.stringify({
              request: prompt,
              activeFile,
              files
            })
          }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.error?.message || data?.message || 'DeepSeek API 调用失败。'
      });
    }

    const rawContent = data?.choices?.[0]?.message?.content;
    const parsed = parseAiJson(rawContent);
    const suggestedFiles = normalizeAiFiles(parsed.files);

    if (!parsed || typeof parsed !== 'object' || Object.keys(suggestedFiles).length === 0) {
      return res.status(502).json({ message: 'AI 没有返回可应用的代码修改。' });
    }

    res.json({
      message: String(parsed.message || 'AI 已生成代码修改建议。'),
      files: suggestedFiles,
      model: AI_MODEL
    });
  } catch (err) {
    next(err);
  }
};
