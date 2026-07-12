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
    '你只能修改 index.html、style.css、sketch.js 这三个文件。',
    'style.css 和 sketch.js 是可选文件；如果用户项目中不存在，不要因为缺失而报错，也不要强行创建，除非用户明确需要。',
    optionalNote ? `当前项目缺少这些可选文件：${optionalNote}。` : '',
    '必须保留已有中文注释和英文注释，不要删除、精简或改写任何已有注释。',
    '如果必须调整带行尾注释的代码，必须把原有行尾注释完整保留在修改后的代码旁边或上方。',
    `index.html 必须引用本站 p5.js 库：${P5_SCRIPT_TAG}，不要使用 cdnjs.cloudflare.com、unpkg、jsdelivr 或其他外部 p5.js CDN。`,
    '优先生成适合初学者理解的代码，不要引入复杂依赖。',
    '只返回严格 JSON，不要返回 Markdown、代码围栏或额外解释。',
    '只能返回一个 JSON 对象；不要在 JSON 对象前后追加任何文字，也不要连续返回多个 JSON 对象。',
    'JSON 格式必须是：{"message":"给用户看的简短说明","files":{"index.html":"完整内容","style.css":"完整内容","sketch.js":"完整内容"}}。',
    'files 里只包含需要修改或创建的文件；未修改文件可以省略。'
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
      await User.deductTokens({ id: req.user.id, amount: usedTokens });
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
        return res.status(502).json({ message: 'AI 返回内容过长被截断，请缩小修改范围或重试。' });
      }
      return res.status(502).json({ message: 'AI 返回的 JSON 格式异常，请再试一次。' });
    }
    const suggestedFiles = normalizeAiFiles(parsed.files);

    if (!parsed || typeof parsed !== 'object' || Object.keys(suggestedFiles).length === 0) {
      return res.status(502).json({ message: 'AI 没有返回可应用的代码修改。' });
    }

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
