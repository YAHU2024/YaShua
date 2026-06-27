const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 多模型 Provider 配置（agnes 为主，deepseek 降级备选）
const PROVIDERS = {
  agnes: {
    name: 'Agnes',
    apiUrl: 'https://apihub.agnes-ai.com/v1/chat/completions',
    model: 'agnes-2.0-flash',
    apiKeyEnv: 'AGNES_API_KEY'
  },
  deepseek: {
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-v4-flash',
    apiKeyEnv: 'DEEPSEEK_API_KEY'
  }
}

const PRIMARY_PROVIDER = PROVIDERS.agnes
const FALLBACK_PROVIDER = PROVIDERS.deepseek

const MAX_CHUNK_CHARS = 6000 // 每段最大字符数（小段并行更快，降低单次超时风险）
const MAX_RETRY = 1 // 单个 Provider API 调用失败重试次数

/**
 * 解析客户端传入的 providerConfig，返回实际使用的 primary/fallback provider
 *
 * providerConfig 格式：
 *   内置模型：{ id: 'agnes' }
 *   自定义模型：{ custom: { providerId, apiUrl, model } }  — apiKey 从云DB读取
 *
 * @param {object} wxContext - 微信云函数上下文（含 OPENID）
 * @param {object} providerConfig - 客户端传入的 provider 配置
 * @returns {{ primary: object, fallback: object }}
 */
async function resolveProvider(wxContext, providerConfig) {
  if (!providerConfig) {
    return { primary: PRIMARY_PROVIDER, fallback: FALLBACK_PROVIDER }
  }

  // 内置模型
  if (providerConfig.id && PROVIDERS[providerConfig.id]) {
    const primary = PROVIDERS[providerConfig.id]
    const fallback = Object.values(PROVIDERS).find(p => p !== primary) || FALLBACK_PROVIDER
    return { primary, fallback }
  }

  // 自定义模型：从云DB读取 apiKey
  if (providerConfig.custom) {
    const { providerId, apiUrl, model } = providerConfig.custom
    const openid = wxContext.OPENID

    try {
      const db = cloud.database()
      const { data } = await db.collection('user_ai_providers')
        .where({ openid, providerId })
        .limit(1)
        .get()

      if (!data.length || !data[0].apiKey) {
        console.warn(`自定义 Provider ${providerId} 未找到或无 API Key，降级到内置模型`)
        return { primary: PRIMARY_PROVIDER, fallback: FALLBACK_PROVIDER }
      }

      const doc = data[0]
      const primary = {
        name: `自定义(${doc.name || model})`,
        apiUrl,
        model,
        apiKey: doc.apiKey  // 从云DB读取，不返回给客户端
      }
      // 降级到内置默认模型
      return { primary, fallback: PRIMARY_PROVIDER }
    } catch (e) {
      console.error(`读取自定义 Provider ${providerId} 失败:`, e.message)
      return { primary: PRIMARY_PROVIDER, fallback: FALLBACK_PROVIDER }
    }
  }

  return { primary: PRIMARY_PROVIDER, fallback: FALLBACK_PROVIDER }
}

/**
 * 构建解析 Prompt
 */
function buildPrompt(text) {
  return `你是一个专业的题库解析专家。请将以下题库文本解析为结构化的 JSON 数组。

解析要求：
1. 识别每道题的题型：single（单选题）、multiple（多选题）、judge（判断题）
2. 提取题目内容（content）、选项（options）、正确答案（answer）、解析（analysis，如有）
3. 判断题的 options 固定为 ["正确", "错误"]，answer 为 ["正确"] 或 ["错误"]
4. 单选题/多选题的 options 格式为 ["A. 选项内容", "B. 选项内容", ...]
5. 单选题 answer 为单个字母如 ["A"]，多选题为多个字母如 ["A", "C"]
6. 如果没有解析内容，analysis 设为空字符串 ""
7. difficulty 默认设为 1
8. 忽略题库中的标题、说明等非题目内容
9. 如果文本中有无法识别为题目的内容，直接跳过

输出格式：纯 JSON 对象，不要包含 markdown 代码块标记，不要包含任何解释文字。
格式为 {"questions": [...]}，questions 是题目数组。
示例输出：
{"questions":[{"type":"single","content":"题目内容？","options":["A. 选项A","B. 选项B","C. 选项C","D. 选项D"],"answer":["A"],"analysis":"解析内容","difficulty":1}]}

题库文本：
---
${text}
---`
}

/**
 * 通用 LLM API 调用（含重试）
 * @param {object} provider - Provider 配置对象
 * @param {Array} messages - OpenAI 格式消息数组
 * @param {object} options - { temperature, max_tokens, timeout }
 * @returns {string} 模型返回的 content 文本
 */
async function callLLM(provider, messages, { temperature, max_tokens, timeout }) {
  // 自定义 Provider 直接携带 apiKey；内置 Provider 从环境变量读取
  const apiKey = provider.apiKey || process.env[provider.apiKeyEnv]

  if (!apiKey) {
    if (provider.apiKeyEnv) {
      throw new Error(`未配置 ${provider.apiKeyEnv} 环境变量，请在微信云开发控制台 → 云函数 aiParse → 环境变量中设置`)
    }
    throw new Error(`Provider "${provider.name}" 未提供 API Key`)
  }

  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      const response = await axios.post(
        provider.apiUrl,
        {
          model: provider.model,
          messages,
          temperature,
          max_tokens,
          top_p: 0.9,
          frequency_penalty: 0.5,
          presence_penalty: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout
        }
      )

      const choices = response.data?.choices
      if (!Array.isArray(choices) || choices.length === 0) {
        throw new Error(`${provider.name} API 返回无效: choices 为空`)
      }
      return choices[0].message.content
    } catch (e) {
      console.error(`[${provider.name}] API 调用失败 (尝试 ${attempt + 1}/${MAX_RETRY + 1})`, e.message)
      lastError = e
      // 429 限流或 5xx 服务器错误：等待后重试
      if (e.response && (e.response.status === 429 || e.response.status >= 500)) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
      // 4xx 客户端错误（非429）：不可重试，直接跳出
      if (e.response && e.response.status >= 400 && e.response.status < 500) {
        console.warn(`[${provider.name}] 不可重试的错误，停止重试:`, e.response.status)
        break
      }
    }
  }

  throw lastError || new Error(`${provider.name} API 调用失败`)
}

/**
 * 带降级的 LLM 调用：先尝试主模型，失败后自动降级到备选模型
 * @param {Array} messages - OpenAI 格式消息数组
 * @param {object} options - { temperature, max_tokens, timeout }
 * @param {object} [primaryProvider] - 可选主模型，默认 PRIMARY_PROVIDER
 * @param {object} [fallbackProvider] - 可选降级模型，默认 FALLBACK_PROVIDER
 */
async function callLLMWithFallback(messages, options, primaryProvider, fallbackProvider) {
  const primary = primaryProvider || PRIMARY_PROVIDER
  const fallback = fallbackProvider || FALLBACK_PROVIDER
  try {
    const content = await callLLM(primary, messages, options)
    console.log(`[${primary.name}] 调用成功`)
    return { content, provider: primary }
  } catch (primaryError) {
    console.warn(`[${primary.name}] 全部重试失败，降级到 [${fallback.name}]`)
    try {
      const content = await callLLM(fallback, messages, options)
      console.log(`[${fallback.name}] 降级调用成功`)
      return { content, provider: fallback }
    } catch (fallbackError) {
      // 两个 provider 都失败，抛出原始错误（主模型的）
      console.error(`[${fallback.name}] 降级也失败:`, fallbackError.message)
      throw primaryError
    }
  }
}

/**
 * 调用 LLM API 解析题库文本
 * @param {string} text - 题库文本
 * @param {object} wxContext - 微信云函数上下文（含 OPENID）
 * @param {object} [providerConfig] - 客户端传入的 provider 配置
 */
async function callDeepSeekAPI(text, wxContext, providerConfig) {
  const { primary: primaryProvider, fallback: fallbackProvider } = await resolveProvider(wxContext, providerConfig)

  const messages = [
    {
      role: 'system',
      content: '你是一个题库解析专家，擅长从各种格式的文本中提取题目并结构化为 JSON。只输出 JSON 对象格式 {"questions": [...]}，不输出任何其他内容。'
    },
    {
      role: 'user',
      content: buildPrompt(text)
    }
  ]

  const { content, provider } = await callLLMWithFallback(messages, {
    temperature: 0.1,
    max_tokens: 16000,
    timeout: 55000
  }, primaryProvider, fallbackProvider)

  // 后处理：检测并清理重复输出
  const cleanedContent = deduplicateOutput(content)
  const result = parseAIResponse(cleanedContent)
  if (result.length === 0) {
    console.warn(`[${provider.name}] AI 返回内容无法解析出题目，原始响应前 500 字符:`, content.substring(0, 500))
  }
  return result
}

/**
 * 解析 AI 返回的文本为题目数组
 * 兼容多种返回格式：纯 JSON 数组、json_object 包装、带 markdown 代码块等
 */
function parseAIResponse(content) {
  if (!content || typeof content !== 'string') {
    return []
  }

  let contentStr = content.trim()

  // 尝试去除 markdown 代码块标记
  contentStr = contentStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

  let parsed

  try {
    parsed = JSON.parse(contentStr)
  } catch (e) {
    // 尝试从文本中提取 JSON 数组
    const jsonMatch = contentStr.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch (e2) {
        // 尝试提取 JSON 对象（response_format: json_object 可能返回 {questions: [...]}）
        const objMatch = contentStr.match(/\{[\s\S]*\}/)
        if (objMatch) {
          try {
            parsed = JSON.parse(objMatch[0])
          } catch (e3) {
            console.error('JSON 解析失败', contentStr.substring(0, 500))
            return []
          }
        } else {
          return []
        }
      }
    } else {
      console.error('无法从 AI 响应中提取 JSON', contentStr.substring(0, 500))
      return []
    }
  }

  // 处理不同返回结构：json_object 模式可能包裹在不同键名下
  let questions = []
  if (Array.isArray(parsed)) {
    questions = parsed
  } else if (typeof parsed === 'object' && parsed !== null) {
    // 兼容各种可能的包装键名
    const wrapperKeys = ['questions', 'data', 'result', 'items', 'list', 'content']
    for (const key of wrapperKeys) {
      if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
        questions = parsed[key]
        break
      }
    }
    // 兜底：遍历所有键，找到第一个数组值作为题目列表
    if (questions.length === 0) {
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val) && val.length > 0) {
          questions = val
          break
        }
      }
    }
  }

  // 标准化每道题的数据结构
  return questions.map(q => normalizeQuestion(q)).filter(q => q !== null)
}

/**
 * 标准化题目数据结构
 */
function normalizeQuestion(q) {
  if (!q) return null

  // 尝试从各种可能的字段名中提取 content
  let content = q.content || q.question || q.title || q.stem || q.text || ''
  if (typeof content !== 'string') content = String(content)
  content = content.trim()
  if (!content) return null

  // 验证题型
  const validTypes = ['single', 'multiple', 'judge']
  let type = q.type
  if (!validTypes.includes(type)) {
    // 尝试推断题型
    if (q.options && q.options.length === 2 &&
        q.options.some(o => o.includes('正确') || o.includes('错误'))) {
      type = 'judge'
    } else if (q.answer && Array.isArray(q.answer) && q.answer.length > 1) {
      type = 'multiple'
    } else {
      type = 'single'
    }
  }

  // 标准化选项
  let options = []
  if (Array.isArray(q.options)) {
    options = q.options.map(o => typeof o === 'string' ? o : String(o))
  }

  // 判断题特殊处理
  if (type === 'judge') {
    if (options.length === 0) {
      options = ['正确', '错误']
    }
  }

  // 标准化答案
  let answer = []
  if (Array.isArray(q.answer)) {
    answer = q.answer.map(a => typeof a === 'string' ? a.trim() : String(a))
  } else if (typeof q.answer === 'string') {
    answer = q.answer.split(/[,，、\s]+/).map(a => a.trim()).filter(Boolean)
  }

  // 判断题答案标准化
  if (type === 'judge') {
    const answerStr = answer.join('')
    if (answerStr.includes('正确') || answerStr.includes('对') || answerStr === 'A' || answerStr === 'T' || answerStr === 'true') {
      answer = ['正确']
    } else if (answerStr.includes('错误') || answerStr.includes('错') || answerStr === 'B' || answerStr === 'F' || answerStr === 'false') {
      answer = ['错误']
    }
  }

  return {
    type,
    content,
    options,
    answer,
    analysis: q.analysis ? String(q.analysis).trim() : '',
    difficulty: q.difficulty || 1
  }
}

/**
 * 将长文本按题目边界分段
 */
function splitTextIntoChunks(text) {
  if (text.length <= MAX_CHUNK_CHARS) {
    return [text]
  }

  const chunks = []
  // 按双换行分割
  const blocks = text.split(/\n\n+/)
  let currentChunk = ''

  for (const block of blocks) {
    if ((currentChunk + '\n\n' + block).length > MAX_CHUNK_CHARS && currentChunk) {
      chunks.push(currentChunk)
      currentChunk = block
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + block : block
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks
}

/**
 * 检测并清理 LLM 输出中的重复内容
 * 小模型容易陷入重复循环（如 "D选项D选项D选项..."），此函数检测连续重复的句子/段落并截断
 * @param {string} text - LLM 原始输出
 * @returns {string} 清理后的文本
 */
function deduplicateOutput(text) {
  if (!text || text.length < 50) return text

  const lines = text.split('\n')
  const cleaned = []
  let repeatCount = 0
  const MAX_REPEAT = 2 // 允许最多 2 行相似内容

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      cleaned.push(lines[i])
      repeatCount = 0
      continue
    }

    // 检查是否与上一行高度相似（>70% 字符重叠）
    if (cleaned.length > 0) {
      const prevLine = cleaned[cleaned.length - 1].trim()
      if (prevLine && lineSimilarity(line, prevLine) > 0.7) {
        repeatCount++
        if (repeatCount >= MAX_REPEAT) {
          console.warn(`检测到重复输出，已截断（第 ${i + 1} 行）`)
          break
        }
      } else {
        repeatCount = 0
      }
    }

    cleaned.push(lines[i])
  }

  return cleaned.join('\n').trim()
}

/**
 * 计算两个字符串的相似度（基于字符集合的 Jaccard 系数）
 */
function lineSimilarity(a, b) {
  if (!a || !b) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])
  return intersection.size / union.size
}

/**
 * 构建单题分析 Prompt（结合用户作答情况）
 */
function buildAnalyzePrompt(question, userAnswer, isCorrect) {
  const typeLabel = { single: '单选题', multiple: '多选题', judge: '判断题' }[question.type] || '单选题'
  const optionsText = question.options && question.options.length > 0
    ? question.options.join('\n')
    : '无选项'
  const correctAnswer = (question.answer || []).join(', ')
  const userAnswerStr = (userAnswer || []).join(', ') || '未作答'
  const resultText = isCorrect ? '回答正确' : '回答错误'
  const existingAnalysis = question.analysis || ''

  return `你是一位专业的题目解析老师。请对以下题目进行详细解析，帮助学习者理解知识点。

【题目类型】${typeLabel}
【题目内容】${question.content}
【题目选项】
${optionsText}
【正确答案】${correctAnswer}
【学习者的答案】${userAnswerStr}
【答题结果】${resultText}
${existingAnalysis ? `【已有解析（参考）】${existingAnalysis}` : ''}

请按照以下要求生成解析：
1. 简要说明题目的知识点和考点
2. ${isCorrect ? '肯定学习者的正确思路，解释为什么这个答案是对的' : '指出学习者可能存在的知识盲区，解释正确答案的推理过程'}
3. 如果选项中有常见错误选项，简要说明其迷惑性
4. 解析尽量精炼，控制在 200-500 字之间
5. 使用中文输出，语气亲切友好
6. 只输出纯文本解析内容，不要包含编号、markdown 标题等格式标记
7. 不同段落之间请用换行符分隔，保证阅读体验
8. 严禁重复输出相同或相似的句子，每句话只说一次，保持内容简洁不啰嗦`
}

/**
 * 调用 LLM API 生成单题分析
 * @param {object} question - 题目对象
 * @param {Array} userAnswer - 用户答案
 * @param {boolean} isCorrect - 是否答对
 * @param {object} wxContext - 微信云函数上下文
 * @param {object} [providerConfig] - 客户端传入的 provider 配置
 */
async function callDeepSeekAnalyze(question, userAnswer, isCorrect, wxContext, providerConfig) {
  const { primary: primaryProvider, fallback: fallbackProvider } = await resolveProvider(wxContext, providerConfig)
  const prompt = buildAnalyzePrompt(question, userAnswer, isCorrect)

  const messages = [
    {
      role: 'system',
      content: '你是一位专业且亲切的题目解析老师，擅长用通俗易懂的语言帮助学习者理解知识点。只输出纯文本解析，不要使用任何格式标记。不同段落之间请用换行符分隔，保证阅读体验。'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  const { content } = await callLLMWithFallback(messages, {
    temperature: 0.1,
    max_tokens: 2000,
    timeout: 15000
  }, primaryProvider, fallbackProvider)

  // 后处理：检测并清理重复输出
  const cleaned = deduplicateOutput(content?.trim() || '')
  return cleaned
}

/**
 * 处理单题 AI 解析请求
 */
async function handleAnalyze(event, wxContext) {
  const { question, userAnswer, isCorrect, providerConfig } = event

  if (!question || !question.content) {
    console.warn('handleAnalyze: 缺少题目信息', { hasQuestion: !!question, hasContent: !!question?.content })
    return { success: false, message: '缺少题目信息' }
  }

  try {
    const analysis = await callDeepSeekAnalyze(question, userAnswer, isCorrect, wxContext, providerConfig)

    if (!analysis) {
      console.warn('handleAnalyze: AI 返回空解析')
      return {
        success: false,
        message: 'AI 未能生成有效解析，请稍后重试'
      }
    }

    console.log('handleAnalyze: 解析成功，长度', analysis.length)
    return {
      success: true,
      message: 'AI 解析完成',
      data: { analysis }
    }
  } catch (e) {
    console.error('handleAnalyze: 解析失败', e.message)
    // 区分错误类型，返回友好消息
    const errMsg = e.message || ''
    if (errMsg.includes('未配置')) {
      return { success: false, message: 'AI 服务未正确配置，请联系管理员' }
    }
    if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')) {
      return { success: false, message: 'AI 解析超时，请稍后重试' }
    }
    return { success: false, message: 'AI 解析服务暂时不可用，请稍后重试' }
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const { action } = event

    // 列出内置模型
    if (action === 'listModels') {
      return {
        success: true,
        data: {
          models: Object.entries(PROVIDERS).map(([key, p]) => ({
            id: key,
            name: p.name,
            model: p.model
          }))
        }
      }
    }

    // ============ 自定义 Provider CRUD ============

    // 获取用户的自定义 Provider 列表（不返回 apiKey 明文）
    if (action === 'getProviderConfigs') {
      const db = cloud.database()
      const openid = wxContext.OPENID
      const { data } = await db.collection('user_ai_providers')
        .where({ openid })
        .orderBy('createdAt', 'asc')
        .get()

      return {
        success: true,
        data: {
          providers: data.map(d => ({
            id: d.providerId,
            name: d.name,
            apiUrl: d.apiUrl,
            model: d.model,
            hasApiKey: !!d.apiKey
          }))
        }
      }
    }

    // 保存/更新自定义 Provider 配置（含 API Key）
    if (action === 'saveProviderConfig') {
      const { providerId, name, apiUrl, model, apiKey } = event
      const openid = wxContext.OPENID

      if (!providerId || !name || !apiUrl || !model) {
        return { success: false, message: '缺少必填字段（providerId, name, apiUrl, model）' }
      }
      // 新增时必须提供 apiKey；更新时可选
      if (!apiKey) {
        // 检查是否已存在（更新场景）
        const db = cloud.database()
        const { data: existing } = await db.collection('user_ai_providers')
          .where({ openid, providerId })
          .limit(1)
          .get()
        if (!existing.length) {
          return { success: false, message: '新增 Provider 必须提供 API Key' }
        }
        // 更新（保留原 apiKey）
        await db.collection('user_ai_providers').doc(existing[0]._id).update({
          data: { name, apiUrl, model, updatedAt: new Date() }
        })
        return { success: true, message: 'Provider 更新成功' }
      }

      // upsert：存在则更新（含 apiKey），不存在则插入
      const db = cloud.database()
      const { data: existing } = await db.collection('user_ai_providers')
        .where({ openid, providerId })
        .limit(1)
        .get()

      if (existing.length) {
        await db.collection('user_ai_providers').doc(existing[0]._id).update({
          data: { name, apiUrl, model, apiKey, updatedAt: new Date() }
        })
      } else {
        await db.collection('user_ai_providers').add({
          data: { openid, providerId, name, apiUrl, model, apiKey, createdAt: new Date(), updatedAt: new Date() }
        })
      }

      return { success: true, message: 'Provider 保存成功' }
    }

    // 删除自定义 Provider
    if (action === 'deleteProviderConfig') {
      const { providerId } = event
      const openid = wxContext.OPENID

      if (!providerId) {
        return { success: false, message: '缺少 providerId' }
      }

      const db = cloud.database()
      await db.collection('user_ai_providers')
        .where({ openid, providerId })
        .remove()

      return { success: true, message: 'Provider 已删除' }
    }

    // 测试自定义 Provider 连通性（不经过数据库，直接用客户端传入的参数）
    if (action === 'testProvider') {
      const { apiUrl, model, apiKey } = event

      if (!apiUrl || !model || !apiKey) {
        return { success: false, message: '请填写完整的 API 端点、模型和 API Key' }
      }

      try {
        const content = await callLLM(
          { name: '测试', apiUrl, model, apiKey },
          [{ role: 'user', content: 'hi' }],
          { temperature: 0, max_tokens: 10, timeout: 15000 }
        )
        return {
          success: true,
          message: '连接成功，模型响应正常',
          data: { response: content?.substring(0, 100) }
        }
      } catch (e) {
        const status = e.response?.status
        const detail = e.response?.data?.error?.message || e.message
        let userMsg
        if (status === 401 || status === 403) {
          userMsg = 'API Key 无效或已过期'
        } else if (status === 404) {
          userMsg = 'API 端点不存在，请检查 URL 是否正确'
        } else if (status === 400) {
          userMsg = '请求被拒绝，请检查模型名称是否正确'
        } else if (status === 429) {
          userMsg = 'API Key 有效，但请求被限流'
        } else if (status >= 500) {
          userMsg = `服务端错误（${status}），请稍后重试`
        } else if (e.code === 'ECONNABORTED' || (e.message && e.message.includes('timeout'))) {
          userMsg = '连接超时，请检查 API 端点是否正确'
        } else {
          userMsg = `连接失败：${detail}`
        }
        return { success: false, message: userMsg, data: { detail } }
      }
    }

    // ============ AI 解析 ============

    // 单题分析模式（答题页 AI 解析）
    if (action === 'analyze') {
      return await handleAnalyze(event, wxContext)
    }

    // 批量解析模式
    const { text, providerConfig } = event

    if (!text || typeof text !== 'string') {
      return { success: false, message: '缺少文本内容' }
    }

    const trimmedText = text.trim()
    if (!trimmedText) {
      return { success: false, message: '文本内容为空' }
    }

    // 文本过长时分段处理
    const chunks = splitTextIntoChunks(trimmedText)
    console.log(`文本分段：共 ${chunks.length} 段，总长度 ${trimmedText.length} 字符`)

    const allQuestions = []
    const totalStartTime = Date.now()

    if (chunks.length === 1) {
      // 单段：直接调用
      try {
        const questions = await callDeepSeekAPI(chunks[0], wxContext, providerConfig)
        allQuestions.push(...questions)
      } catch (e) {
        console.error('AI 解析失败', e.message)
        return {
          success: false,
          message: 'AI 解析失败: ' + e.message,
          error: e.message
        }
      }
    } else {
      // 多段：并行调用
      console.log(`并行解析 ${chunks.length} 段，总长度 ${trimmedText.length} 字符`)
      const chunkResults = await Promise.allSettled(
        chunks.map((chunk, i) =>
          callDeepSeekAPI(chunk, wxContext, providerConfig).then(questions => {
            console.log(`第 ${i + 1}/${chunks.length} 段完成，解析 ${questions.length} 题，耗时 ${Date.now() - totalStartTime}ms`)
            return questions
          })
        )
      )

      let failedChunks = 0
      for (const [i, result] of chunkResults.entries()) {
        if (result.status === 'fulfilled') {
          allQuestions.push(...result.value)
        } else {
          failedChunks++
          console.error(`第 ${i + 1} 段解析失败`, result.reason.message)
        }
      }

      if (failedChunks > 0) {
        console.warn(`${failedChunks}/${chunks.length} 段解析失败`)
      }
      console.log(`并行解析完成，共 ${allQuestions.length} 题，总耗时 ${Date.now() - totalStartTime}ms`)
    }

    if (allQuestions.length === 0) {
      console.warn('AI 解析返回空结果，文本预览:', trimmedText.substring(0, 200))
      return {
        success: false,
        message: '未能从文本中解析出题目，请确认文本中是否包含完整的题目内容（题干+选项+答案）',
        code: 'NO_QUESTIONS_FOUND'
      }
    }

    return {
      success: true,
      message: `AI 解析完成，共识别 ${allQuestions.length} 道题`,
      data: {
        questions: allQuestions,
        totalCount: allQuestions.length
      }
    }
  } catch (e) {
    console.error('AI 解析失败', e)
    return {
      success: false,
      message: 'AI 解析失败: ' + e.message,
      error: e.message
    }
  }
}
