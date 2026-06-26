const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// DeepSeek API 配置（从云函数环境变量 DEEPSEEK_API_KEY 读取）
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-v4-flash'
const MAX_CHUNK_CHARS = 6000 // 每段最大字符数（小段并行更快，降低单次超时风险）
const MAX_RETRY = 1 // API 调用失败重试次数

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
 * 调用 DeepSeek API 解析题库文本
 */
async function callDeepSeekAPI(text) {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY 环境变量，请在微信云开发控制台 → 云函数 aiParse → 环境变量中设置')
  }

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

  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: DEEPSEEK_MODEL,
          messages,
          temperature: 0.1,
          max_tokens: 16000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 55000 // 55 秒超时（云函数 60s，留 5s 余量）
        }
      )

      const choices = response.data?.choices
      if (!Array.isArray(choices) || choices.length === 0) {
        throw new Error('DeepSeek API 返回无效: choices 为空')
      }
      const content = choices[0].message.content
      const result = parseAIResponse(content)
      if (result.length === 0) {
        // 解析为空时记录原始响应便于排查
        console.warn('AI 返回内容无法解析出题目，原始响应前 500 字符:', content.substring(0, 500))
      }
      return result
    } catch (e) {
      console.error(`DeepSeek API 调用失败 (尝试 ${attempt + 1}/${MAX_RETRY + 1})`, e.message)
      lastError = e
      // 429 限流或 5xx 服务器错误：等待后重试
      if (e.response && (e.response.status === 429 || e.response.status >= 500)) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
      // 4xx 客户端错误（非429）：不可重试，直接跳出
      if (e.response && e.response.status >= 400 && e.response.status < 500) {
        console.warn('不可重试的错误，停止重试:', e.response.status)
        break
      }
    }
  }

  throw lastError || new Error('DeepSeek API 调用失败')
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
7. 不同段落之间请用换行符分隔，保证阅读体验`
}

/**
 * 调用 DeepSeek API 生成单题分析
 */
async function callDeepSeekAnalyze(question, userAnswer, isCorrect) {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY 环境变量，请在微信云开发控制台 → 云函数 aiParse → 环境变量中设置')
  }

  const prompt = buildAnalyzePrompt(question, userAnswer, isCorrect)

  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: DEEPSEEK_MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一位专业且亲切的题目解析老师，擅长用通俗易懂的语言帮助学习者理解知识点。只输出纯文本解析，不要使用任何格式标记。不同段落之间请用换行符分隔，保证阅读体验。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        }
      )

      const choices = response.data?.choices
      if (!Array.isArray(choices) || choices.length === 0) {
        throw new Error('DeepSeek API 返回无效: choices 为空')
      }
      const content = choices[0].message.content
      return content?.trim() || ''
    } catch (e) {
      console.error(`DeepSeek Analyze 调用失败 (尝试 ${attempt + 1}/${MAX_RETRY + 1})`, e.message)
      lastError = e
      // 429 限流或 5xx 服务器错误：等待后重试
      if (e.response && (e.response.status === 429 || e.response.status >= 500)) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
      // 4xx 客户端错误（非429）：不可重试，直接跳出
      if (e.response && e.response.status >= 400 && e.response.status < 500) {
        console.warn('不可重试的错误，停止重试:', e.response.status)
        break
      }
      // 其他错误（网络超时等）：最后一次尝试时抛出
      if (attempt === MAX_RETRY) throw e
    }
  }

  throw lastError || new Error('DeepSeek Analyze 调用失败')
}

/**
 * 处理单题 AI 解析请求
 */
async function handleAnalyze(event) {
  const { question, userAnswer, isCorrect } = event

  if (!question || !question.content) {
    console.warn('handleAnalyze: 缺少题目信息', { hasQuestion: !!question, hasContent: !!question?.content })
    return { success: false, message: '缺少题目信息' }
  }

  try {
    const analysis = await callDeepSeekAnalyze(question, userAnswer, isCorrect)

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
    if (errMsg.includes('DEEPSEEK_API_KEY')) {
      return { success: false, message: 'AI 服务未正确配置，请联系管理员' }
    }
    if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')) {
      return { success: false, message: 'AI 解析超时，请稍后重试' }
    }
    return { success: false, message: 'AI 解析服务暂时不可用，请稍后重试' }
  }
}

exports.main = async (event, context) => {
  try {
    const { action } = event

    // 单题分析模式（答题页 AI 解析）
    if (action === 'analyze') {
      return await handleAnalyze(event)
    }

    // 原有批量解析模式
    const { text } = event

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
      // 单段：直接调用（保持原有错误处理）
      try {
        const questions = await callDeepSeekAPI(chunks[0])
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
      // 多段：并行调用以大幅缩短耗时
      console.log(`并行解析 ${chunks.length} 段，总长度 ${trimmedText.length} 字符`)
      const chunkResults = await Promise.allSettled(
        chunks.map((chunk, i) =>
          callDeepSeekAPI(chunk).then(questions => {
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
