import type { Question } from '@/types'
import { callFunction, isCloudAvailable } from './cloud'
import { parseRichMarkdown } from './parser'

/**
 * 客户端直接读取本地文本文件内容（仅微信小程序环境）
 * 用于 .md / .txt 文件跳过云函数，直接用本地解析，消除超时问题
 */
function readLocalTextFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 仅在微信小程序环境下可用
    if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
      // 先尝试同步读取
      try {
        const fs = wx.getFileSystemManager()
        const content = fs.readFileSync(filePath, 'utf-8') as string
        if (content) {
          resolve(content)
          return
        }
      } catch (_) {
        // 同步失败，继续尝试异步方式
      }
      // 异步读取兜底
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'utf-8',
        success: (res: any) => resolve(res.data as string),
        fail: reject
      })
    } else {
      reject(new Error('当前环境不支持本地文件读取'))
    }
  })
}

/**
 * 上传文件到云存储并获取 fileID
 * @param filePath 本地文件路径
 * @param fileName 原始文件名（用于提取扩展名）
 * @returns 云文件 fileID
 */
export async function uploadQuestionFile(filePath: string, fileName: string): Promise<string> {
  if (!isCloudAvailable()) {
    throw new Error('云开发不可用，无法上传文件。请在微信开发者工具中使用真实 appid 打开项目。')
  }

  // 从文件名中提取扩展名，保留原始扩展名方便云函数识别格式
  const ext = fileName.split('.').pop()?.toLowerCase() || 'file'
  const cloudPath = `question-files/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  return new Promise((resolve, reject) => {
    uni.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res: any) => resolve(res.fileID),
      fail: (err: any) => {
        console.error('上传文件失败', err)
        reject(new Error('文件上传失败'))
      }
    })
  })
}

/**
 * 调用云函数提取文件文本内容
 * @param fileID 云文件 fileID
 * @param fileName 原始文件名
 * @returns 提取出的纯文本
 */
export async function extractFileText(fileID: string, fileName?: string): Promise<string> {
  if (!isCloudAvailable()) {
    throw new Error('云开发不可用，无法解析文件。')
  }

  const result = await callFunction('parseFile', { fileID, fileName })
  if (result.success && result.data) {
    return result.data.text
  }
  throw new Error(result.message || '文件解析失败')
}

/**
 * 调用云函数进行 AI 智能解析
 * @param text 题库文本内容
 * @returns 解析出的题目数组
 */
export async function aiParseQuestions(text: string): Promise<Question[]> {
  if (!isCloudAvailable()) {
    throw new Error('云开发不可用，AI 解析需要云函数支持。请确保云开发环境已开通并正确配置。')
  }

  const result = await callFunction('aiParse', { text })
  if (result.success && result.data) {
    return result.data.questions as Question[]
  }
  throw new Error(result.message || 'AI 解析失败')
}

/**
 * 完整的文件导入流程
 * - .md / .txt：优先客户端本地读取 + parseRichMarkdown 解析（< 100ms，无超时风险）
 * - .docx / .xlsx：上传 → parseFile 云函数提取文本 → aiParse 云函数 AI 解析
 * @param filePath 本地文件路径
 * @param fileName 原始文件名
 * @returns 解析出的题目数组
 */
export async function parseFileToQuestions(filePath: string, fileName: string): Promise<Question[]> {
  // === 分支 A：.md / .txt 文件 → 客户端本地解析（跳过所有云函数） ===
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const isTextFile = ext === 'md' || ext === 'txt'

  if (isTextFile) {
    try {
      const text = await readLocalTextFile(filePath)
      if (text && text.trim()) {
        const localQuestions = parseRichMarkdown(text)
        if (localQuestions.length > 0) {
          console.log(`本地解析成功（${ext}），共 ${localQuestions.length} 道题`)
          return localQuestions
        }
        console.warn('本地解析无结果，回退到云函数流程')
      }
    } catch (e) {
      console.warn('客户端读取文件失败，回退到云函数流程:', (e as Error).message)
    }
    // 本地解析失败 → 继续走云函数流程作为兜底
  }

  // === 分支 B：云函数流程（.docx/.xlsx 或文本文件本地解析失败的兜底） ===
  // 1. 上传文件到云存储
  const fileID = await uploadQuestionFile(filePath, fileName)

  // 2. 调用云函数提取文本
  const text = await extractFileText(fileID, fileName)

  if (!text.trim()) {
    throw new Error('文件内容为空')
  }

  // 3. 调用 AI 解析（保留 AI 解析结果）
  let aiQuestions: Question[] = []
  let aiError: Error | null = null

  try {
    aiQuestions = await aiParseQuestions(text)
    if (aiQuestions.length > 0) {
      return aiQuestions
    }
    console.warn('AI 解析返回空结果，尝试本地解析降级')
  } catch (e) {
    aiError = e as Error
    console.warn('AI 解析失败，尝试本地解析降级:', aiError.message)
  }

  // 4. AI 解析失败或返回空时，降级到本地富文本解析
  const localQuestions = parseRichMarkdown(text)
  if (localQuestions.length > 0) {
    console.log(`本地解析成功，共 ${localQuestions.length} 道题`)
    return localQuestions
  }

  // 5. 两种方式都失败
  throw aiError || new Error('未能从文件中解析出题目，请检查文件格式')
}