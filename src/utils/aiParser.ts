import type { Question, AIAnalysisCache } from '@/types'
import { aiParseQuestions } from './fileParser'
import { callFunction, isCloudAvailable } from './cloud'
import { getItem, setItem } from './storage'

/**
 * AI 解析题库文本
 * @param text 题库文本内容
 * @returns 解析出的题目数组
 */
export async function parseText(text: string): Promise<Question[]> {
  try {
    return await aiParseQuestions(text)
  } catch (e) {
    console.error('AI 解析失败', e)
    throw e
  }
}

// ============ 单题 AI 解析 ============

const AI_ANALYSIS_PREFIX = 'local_ai_analysis_'

/**
 * 生成题目内容的简单 hash，用于缓存失效检测
 * 使用 DJB2 算法（小程序环境下 crypto 不可用）
 */
function hashQuestion(question: Question): string {
  const str = `${question.content}|${(question.answer || []).join(',')}`
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * 构建缓存 key
 */
function buildCacheKey(questionId: string): string {
  return `${AI_ANALYSIS_PREFIX}${questionId}`
}

/**
 * 从本地缓存读取 AI 解析（带 hash 校验）
 */
export function getCachedAnalysis(question: Question): string | null {
  try {
    const key = buildCacheKey(question._id || hashQuestion(question))
    const cached: AIAnalysisCache | null = getItem(key)
    if (!cached) return null

    const currentHash = hashQuestion(question)
    if (cached.questionHash !== currentHash) {
      // 题目内容/答案有变化 → 缓存失效
      return null
    }
    return cached.analysis
  } catch {
    return null
  }
}

/**
 * 保存 AI 解析到本地缓存
 */
export function saveCachedAnalysis(question: Question, analysis: string): void {
  try {
    const key = buildCacheKey(question._id || hashQuestion(question))
    const cache: AIAnalysisCache = {
      analysis,
      generatedAt: Date.now(),
      questionHash: hashQuestion(question)
    }
    setItem(key, cache)
  } catch (e) {
    console.error('保存 AI 解析缓存失败', e)
  }
}

/**
 * 异步写回云数据库（fire-and-forget，失败静默）
 */
async function writeAnalysisToCloud(question: Question, analysis: string): Promise<void> {
  if (!question._id) return
  try {
    // @ts-ignore uni.cloud 由 App.vue 初始化
    const db = uni.cloud.database()
    await db.collection('questions').doc(question._id).update({
      data: {
        analysis: db.command.set(analysis)
      }
    })
  } catch (e) {
    // 静默失败 — 本地缓存是主持久化
    console.error('AI 解析写回云数据库失败', e)
  }
}

/**
 * 为单道题目生成 AI 解析
 *
 * 流程：
 * 1. 先查本地缓存，命中则直接返回
 * 2. 调用 aiParse 云函数（action: 'analyze'）
 * 3. 成功 → 写入本地缓存 + 异步写回云数据库
 * 4. 失败 → 抛出错误
 *
 * @param question    题目对象
 * @param userAnswer  用户选择的答案
 * @param isCorrect   用户是否答对
 * @returns AI 生成的解析文本
 */
export async function analyzeQuestion(
  question: Question,
  userAnswer: string[],
  isCorrect: boolean
): Promise<string> {
  // 1. 检查本地缓存
  const cached = getCachedAnalysis(question)
  if (cached) {
    return cached
  }

  // 2. 检查云开发可用性
  if (!isCloudAvailable()) {
    throw new Error('云开发不可用，AI 解析需要云函数支持。请检查网络连接后重试。')
  }

  // 3. 调用云函数
  const result = await callFunction('aiParse', {
    action: 'analyze',
    question: {
      type: question.type,
      content: question.content,
      options: question.options,
      answer: question.answer,
      analysis: question.analysis || ''
    },
    userAnswer,
    isCorrect
  })

  if (result && result.success && result.data?.analysis) {
    const analysis = result.data.analysis

    // 4. 写入本地缓存
    saveCachedAnalysis(question, analysis)

    // 5. 异步写回云数据库（不阻塞返回）
    writeAnalysisToCloud(question, analysis)

    return analysis
  }

  if (!result) {
    throw new Error('云函数返回空结果，请稍后重试')
  }

  throw new Error(result.message || 'AI 解析失败，请稍后重试')
}
