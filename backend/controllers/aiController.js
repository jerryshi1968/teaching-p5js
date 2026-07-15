const Project = require('../models/projectModel');
const User = require('../models/userModel');

const AI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_BASE_URL = (process.env.GEMINI_BASE_URL || 'https://relay.tigao123.top').replace(/\/+$/, '');
const configuredMaxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS);
const GEMINI_MAX_OUTPUT_TOKENS = Number.isFinite(configuredMaxOutputTokens) && configuredMaxOutputTokens > 0 ? configuredMaxOutputTokens : 24576;
const ALLOWED_FILES = new Set(['index.html', 'style.css', 'sketch.js']);
const OPTIONAL_FILES = new Set(['style.css', 'sketch.js']);
const P5_SCRIPT_TAG = '<script src="/teaching-p5js/libs/p5-1.11.13.min.js"></script>';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AI_IMAGE_MAX_SIZE = 2 * 1024 * 1024;
const AI_IMAGE_MAX_COUNT = 3;

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

function getDataUrlByteSize(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
}

function createBadRequestError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function normalizeAiImages(images = []) {
  if (!Array.isArray(images)) return [];

  return images.slice(0, AI_IMAGE_MAX_COUNT).map((image) => {
    const mimeType = String(image?.mimeType || '').toLowerCase();
    const dataUrl = String(image?.dataUrl || '');
    const expectedPrefix = `data:${mimeType};base64,`;

    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      throw createBadRequestError('只支持 JPEG、PNG 或 WebP 图片。');
    }
    if (!dataUrl.startsWith(expectedPrefix)) {
      throw createBadRequestError('图片数据格式不正确。');
    }
    if (getDataUrlByteSize(dataUrl) > AI_IMAGE_MAX_SIZE) {
      throw createBadRequestError('单张图片不能超过 2MB。');
    }

    return { mimeType, dataUrl };
  });
}

function getGeminiEndpoint() {
  return `${GEMINI_BASE_URL}/v1beta/models/${encodeURIComponent(AI_MODEL)}:generateContent`;
}

function getGeminiImagePart(image) {
  const data = String(image.dataUrl || '').split(',')[1] || '';
  return {
    inlineData: {
      mimeType: image.mimeType,
      data
    }
  };
}

function buildGeminiRequestBody({ prompt, activeFile, files, images, existingFileNames }) {
  const text = JSON.stringify({
    request: prompt,
    activeFile,
    files
  });

  return {
    contents: [
      {
        role: 'user',
        parts: [
          { text },
          ...images.map(getGeminiImagePart)
        ]
      }
    ],
    systemInstruction: {
      parts: [
        { text: buildSystemPrompt(existingFileNames) }
      ]
    },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          message: { type: 'STRING' },
          files: {
            type: 'OBJECT',
            properties: {
              'index.html': { type: 'STRING' },
              'style.css': { type: 'STRING' },
              'sketch.js': { type: 'STRING' }
            }
          }
        },
        required: ['message', 'files']
      }
    }
  };
}

function buildSystemPrompt(existingFileNames) {
  const optionalNote = Array.from(OPTIONAL_FILES)
    .filter((fileName) => !existingFileNames.includes(fileName))
    .join('、');

  return [
    '你是一个面向中小学生和教师 p5.js 教学网站的代码助手。',
    '如果必要，你只能修改 index.html、style.css、sketch.js 这三个文件。',
    'style.css 和 sketch.js 是可选文件；如果用户项目中不存在，不要因为缺失而报错，也不要强行创建，除非用户明确需要。',
    optionalNote ? `当前项目缺少这些可选文件：${optionalNote}。` : '',
    '必须保留已有中文注释和英文注释，不要删除、精简或改写任何已有注释。',
    '如果必须调整带行尾注释的代码，必须把原有行尾注释完整保留在修改后的代码旁边或上方。',
    `index.html 必须引用本站 p5.js 库：${P5_SCRIPT_TAG}，不要使用 cdnjs.cloudflare.com、unpkg、jsdelivr 或其他外部 p5.js CDN。`,
    '优先生成适合初学者理解的代码，不要引入复杂依赖。',
    '生成代码必须简洁，不要为了凑长度重复输出相同或相似代码。',
    '严禁重复生成相同的 CSS selector、相同注释、相同函数、相同变量声明或相同逻辑块。',
    '这些生成规则只用于约束你自己的输出，严禁把规则文字写进 index.html、style.css 或 sketch.js 的注释里。',
    '保留已有注释不等于新增注释；新建或重写代码时默认不新增 CSS 注释、HTML 注释或无实际代码意义的占位注释。',
    '如果无法确认某条注释来自用户原文件，就不要把它写入返回文件；不要连续生成多个只有注释、没有实际代码意义的块。',
    'CSS 中同一个 selector 原则上只定义一次；如需覆盖样式，请合并到同一个规则中。',
    '不要生成连续重复叠加的 CSS 伪类链。',
    '不要生成通过重复单词拼接形成的 CSS 类名。',
    '不要用大量重复 media query、重复按钮样式、重复 reset 样式来填充代码。',
    '做游戏或动画时，主要界面、按钮、提示文字和得分显示优先在 p5.js canvas 中绘制，不要为了 UI 创建大量 DOM 节点和 CSS 规则。',
    'style.css 只能包含页面基础布局、canvas 基础样式和少量必要的移动端适配；不要把游戏元素、关卡面板、按钮状态或复杂视觉效果写成 CSS。',
    '如果是生成全新的 p5.js 程序，style.css 可以只返回最小基础样式，复杂视觉效果必须放在 sketch.js 的绘图逻辑中。',
    '如果代码接近输出上限，优先生成核心可运行版本，而不是继续添加装饰样式或额外功能。',
    'style.css 必须尽量短，通常不超过 120 行；sketch.js 通常不超过 800 行；如果超出，必须优先删减装饰、特效和重复 UI。',
    '优先使用少量通用 class 和函数复用，不要展开大量重复规则。',
    '如果用户需要修改程序，message 必须非常简短，不要复述用户提示词，不要写实现方案、代码规范或长篇解释。',
    '如果用户需要修改程序，files 里只能放可运行的完整代码内容，不要把提示词、说明文字或 Markdown 放进任何文件。',
    '生成全新 p5.js 游戏或动画时，默认不要返回 style.css；除非用户明确要求修改页面样式、移动端布局或 CSS，否则只返回 index.html 和 sketch.js。',
    '如果现有 style.css 已经能正常工作，就不要返回 style.css；需要的视觉效果、按钮、文字和交互状态全部写在 sketch.js 中。',
    '如果只需要修改 sketch.js，就不要返回 index.html 或 style.css；只返回确实发生变化的文件。',
    '如果用户是在询问写提示词、实现思路、编程建议或协商方案，并不需要修改程序，就只返回有帮助的 message，并让 files 为 {}。',
    '只返回严格 JSON，不要返回 Markdown、代码围栏或额外解释。',
    '只能返回一个 JSON 对象；不要在 JSON 对象前后追加任何文字，也不要连续返回多个 JSON 对象。',
    'JSON 格式必须是：{"message":"给用户看的简短说明","files":{"被修改的文件名":"完整内容"}}。',
    'files 里只包含需要修改或创建的文件；未修改文件可以省略；没有代码修改时返回空对象 {}。'
  ].filter(Boolean).join('\n');
}

function stripJsonFence(content) {
  return String(content || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractFirstJsonObject(content) {
  const text = stripJsonFence(content);
  const start = text.indexOf('{');
  if (start === -1) return text;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return text.slice(start);
}

function extractPartialJsonStringProperty(rawContent, propertyName) {
  const text = stripJsonFence(rawContent);
  const key = `"${propertyName}"`;
  const keyIndex = text.indexOf(key);
  if (keyIndex === -1) return '';

  let index = text.indexOf(':', keyIndex + key.length);
  if (index === -1) return '';
  index += 1;

  while (index < text.length && /\s/.test(text[index])) index += 1;
  if (text[index] !== '"') return '';
  index += 1;

  let value = '';
  let escaped = false;
  for (; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      if (char === 'n') value += '\n';
      else if (char === 'r') value += '\r';
      else if (char === 't') value += '\t';
      else if (char === 'b') value += '\b';
      else if (char === 'f') value += '\f';
      else if (char === 'u') {
        const hex = text.slice(index + 1, index + 5);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          value += String.fromCharCode(parseInt(hex, 16));
          index += 4;
        }
      } else {
        value += char;
      }
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') return value.trim();
    value += char;
  }

  return value.trim();
}

function hasJsonProperty(rawContent, propertyName) {
  return stripJsonFence(rawContent).includes(`"${propertyName}"`);
}

function parseAiJson(rawContent) {
  const content = stripJsonFence(rawContent);

  try {
    return JSON.parse(content);
  } catch (err) {
    const jsonObject = extractFirstJsonObject(content);
    if (jsonObject === content) throw err;
    return JSON.parse(jsonObject);
  }
}

function getGeminiContent(data = {}) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text || '')
    .join('')
    .trim();
}

function getGeminiFinishReason(data = {}) {
  return data?.candidates?.[0]?.finishReason || '';
}

function getUsedTokens(usage = {}) {
  return Number(usage.totalTokenCount || 0)
    || Number(usage.promptTokenCount || 0) + Number(usage.candidatesTokenCount || 0);
}

exports.generateCodeSuggestion = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findAccessibleById(projectId, req.user);

    if (!project || project.user_id !== req.user.id) {
      return res.status(403).json({ message: '无权使用 AI 修改该项目。' });
    }

    const tokenBalance = await User.getTokensById(req.user.id);
    if (!tokenBalance || Number(tokenBalance.tokens || 0) <= 0) {
      return res.status(402).json({ message: 'Token余额不足，请联系老师充值。' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: '服务器未配置 GEMINI_API_KEY。' });
    }

    const prompt = String(req.body.prompt || '').trim();
    const files = normalizeAiFiles(req.body.files);
    const activeFile = String(req.body.activeFile || '');
    const images = normalizeAiImages(req.body.images);

    if (!prompt && images.length === 0) {
      return res.status(400).json({ message: '请输入想让 AI 修改的内容。' });
    }

    if (!files['index.html']) {
      return res.status(400).json({ message: 'index.html 是必需文件，请先确认项目文件已加载。' });
    }

    const existingFileNames = Object.keys(files);
    const response = await fetch(getGeminiEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(buildGeminiRequestBody({ prompt, activeFile, files, images, existingFileNames }))
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.error?.message || data?.message || 'Gemini API 调用失败。'
      });
    }

    const rawContent = getGeminiContent(data);
    const finishReason = getGeminiFinishReason(data);
    if (!rawContent) {
      console.error('Gemini returned empty content:', {
        finishReason,
        response: data
      });
      return res.status(502).json({ message: 'Gemini 没有返回可解析的内容。' });
    }

    const usedTokens = getUsedTokens(data?.usageMetadata);
    if (usedTokens > 0) {
      await User.deductTokens({
        id: req.user.id,
        amount: usedTokens,
        detail: {
          source: 'ai_code_suggestion',
          projectId,
          model: AI_MODEL
        }
      });
    }
    const latestTokenBalance = await User.getTokensById(req.user.id);
    let parsed = null;
    try {
      parsed = parseAiJson(rawContent);
    } catch (err) {
      console.error('AI JSON parse failed:', {
        message: err.message,
        finishReason,
        rawContentLength: rawContent.length,
        rawContentPreview: rawContent.slice(0, 1000),
        rawContentTail: rawContent.slice(-1000)
      });
      if (finishReason === 'MAX_TOKENS') {
        const partialMessage = extractPartialJsonStringProperty(rawContent, 'message');
        if (partialMessage && !hasJsonProperty(rawContent, 'files')) {
          return res.json({
            message: `${partialMessage}\n\n[AI 返回内容过长，已显示可恢复的部分内容；当前 maxOutputTokens=${GEMINI_MAX_OUTPUT_TOKENS}。如需完整内容，请让 AI 分段输出。]`,
            files: {},
            model: AI_MODEL,
            usage: {
              usedTokens,
              remainingTokens: Number(latestTokenBalance?.tokens || 0)
            }
          });
        }
        return res.status(502).json({ message: `AI 返回内容过长被截断，当前 maxOutputTokens=${GEMINI_MAX_OUTPUT_TOKENS}。请确认后端服务已重启，或让 AI 分段输出后再重试。` });
      }
      return res.status(502).json({ message: 'AI 返回的 JSON 格式异常，请再试一次。' });
    }
    if (!parsed || typeof parsed !== 'object') {
      return res.status(502).json({ message: 'AI 返回的 JSON 格式异常，请再试一次。' });
    }

    const suggestedFiles = normalizeAiFiles(parsed.files);

    res.json({
      message: String(parsed.message || 'AI 已生成代码修改建议。'),
      files: suggestedFiles,
      model: AI_MODEL,
      usage: {
        usedTokens,
        remainingTokens: Number(latestTokenBalance?.tokens || 0)
      }
    });
  } catch (err) {
    next(err);
  }
};
