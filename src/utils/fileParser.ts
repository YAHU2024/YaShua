import type { Question, ProviderConfig } from '@/types'
import { callFunction, isCloudAvailable } from './cloud'
import { parseDocxText, parseRichMarkdown, parseMarkdown, parseExportDoc, parseXlsxStructured, parseBeiDouDocx, extractHtmlFromDoc } from './parser'

/**
 * 客户端直接读取本地文本文件内容（仅微信小程序环境）
 * 用于 .md / .txt 文件跳过云函数，直接用本地解析，消除超时问题
 */
function readLocalTextFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 仅在微信小程序环境下可用
    if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
      const fs = wx.getFileSystemManager()
      // 优先使用异步读取，避免大文件阻塞主线程
      fs.readFile({
        filePath,
        encoding: 'utf-8',
        success: (res: any) => {
          if (res.data) {
            resolve(res.data as string)
          } else {
            reject(new Error('文件内容为空'))
          }
        },
        fail: (err: any) => {
          // 异步失败时回退到同步读取
          try {
            const content = fs.readFileSync(filePath, 'utf-8') as string
            if (content) {
              resolve(content)
            } else {
              reject(err)
            }
          } catch (_) {
            reject(err)
          }
        }
      })
    } else {
      reject(new Error('当前环境不支持本地文件读取'))
    }
  })
}

/**
 * 客户端直接读取本地二进制文件内容（仅微信小程序环境）
 * 用于 .doc 文件在本地提取 HTML 文本，避免上传到云函数
 */
function readLocalBinaryFile(filePath: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
      const fs = wx.getFileSystemManager()
      fs.readFile({
        filePath,
        success: (res: any) => {
          if (res.data) {
            resolve(res.data as ArrayBuffer)
          } else {
            reject(new Error('文件内容为空'))
          }
        },
        fail: (err: any) => {
          reject(err)
        }
      })
    } else {
      reject(new Error('当前环境不支持本地文件读取'))
    }
  })
}

// 客户端分段大小（字符数），降低到 2000 确保单次 LLM 调用在 60s 超时限制内轻松完成
const CLIENT_CHUNK_SIZE = 2000
// 最大并行云函数调用数（日志分析：3路并行导致云函数实例资源竞争，超时率约40%；降为2路后显著改善）
const MAX_PARALLEL_CALLS = 2
// 单段失败后最大重试次数
const MAX_RETRY_PER_CHUNK = 2
// 重试间隔（毫秒），等待云函数资源释放
const RETRY_DELAY_MS = 2000

// ============ AI 解析缓存（减少重复 LLM 调用，节省 token） ============

const AI_FILE_CACHE_PREFIX = 'ai_file_cache_'
const AI_PARSE_CACHE_PREFIX = 'ai_parse_cache_'

/**
 * DJB2 字符串哈希（与 aiParser.ts 的 hashQuestion 保持一致的算法）
 */
function hashText(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/**
 * 将 ProviderConfig 序列化为缓存 key 的一部分
 * 不同 Provider 的解析结果可能不同，需要隔离缓存
 */
function providerCacheKey(providerConfig?: ProviderConfig): string {
  if (!providerConfig) return 'default'
  if ('id' in providerConfig) return `builtin_${providerConfig.id}`
  return `custom_${providerConfig.custom.model}`
}

/**
 * 文件级缓存：整个文本 → 完整题目列表
 */
function getFileCacheKey(text: string, providerConfig?: ProviderConfig): string {
  return `${AI_FILE_CACHE_PREFIX}${providerCacheKey(providerConfig)}_${hashText(text)}`
}

function getCachedFileQuestions(key: string): Question[] | null {
  try {
    const data = uni.getStorageSync(key)
    if (!data) return null
    const parsed = JSON.parse(data)
    // 只返回非空结果（空数组表示解析失败，不应缓存）
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

function setCachedFileQuestions(key: string, questions: Question[]): void {
  if (questions.length === 0) return
  try {
    uni.setStorageSync(key, JSON.stringify(questions))
  } catch (e) {
    console.error('保存文件级 AI 解析缓存失败', e)
  }
}

/**
 * 解析级缓存：文本 → 解析结果（aiParseQuestions 整包缓存）
 */
function getParseCacheKey(text: string, providerConfig?: ProviderConfig): string {
  return `${AI_PARSE_CACHE_PREFIX}${providerCacheKey(providerConfig)}_${hashText(text)}`
}

function getCachedParseResult(key: string): Question[] | null {
  try {
    const data = uni.getStorageSync(key)
    if (!data) return null
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

function setCachedParseResult(key: string, questions: Question[]): void {
  if (questions.length === 0) return
  try {
    uni.setStorageSync(key, JSON.stringify(questions))
  } catch (e) {
    console.error('保存 AI 解析缓存失败', e)
  }
}

/**
 * 将长文本按段落边界拆分为多个块，每块不超过 maxChars 字符
 */
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  const blocks = text.split(/\n\n+/)
  let current = ''

  for (const block of blocks) {
    if ((current + '\n\n' + block).length > maxChars && current) {
      chunks.push(current)
      current = block
    } else {
      current = current ? current + '\n\n' + block : block
    }
  }
  if (current) chunks.push(current)

  return chunks
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
 * 调用云函数进行 AI 智能解析（客户端分段并行，避免单次云函数超时）
 * @param text 题库文本内容
 * @param onProgress 可选进度回调，报告已完成的段数和阶段
 * @param providerConfig 可选 Provider 配置（内置或自定义），透传给云函数
 * @returns 解析出的题目数组
 */
export async function aiParseQuestions(
  text: string,
  onProgress?: (completed: number, total: number, stage?: string) => void,
  providerConfig?: ProviderConfig
): Promise<Question[]> {
  if (!isCloudAvailable()) {
    throw new Error('云开发不可用，AI 解析需要云函数支持。请确保云开发环境已开通并正确配置。')
  }

  // 解析级缓存：相同文本 + 相同 Provider → 跳过所有 LLM 调用
  const parseCacheKey = getParseCacheKey(text, providerConfig)
  const cachedResult = getCachedParseResult(parseCacheKey)
  if (cachedResult) {
    console.log(`[缓存命中] 解析级缓存，共 ${cachedResult.length} 道题（跳过 LLM 调用）`)
    return cachedResult
  }

  const chunks = splitTextIntoChunks(text, CLIENT_CHUNK_SIZE)
  console.log(`[AI解析] 文本总长 ${text.length} 字符，拆分为 ${chunks.length} 段并行处理`)

  // 短文本无需分段，直接调用（保持向后兼容）
  if (chunks.length === 1) {
    const result = await callFunction('aiParse', { text, providerConfig })
    if (result.success && result.data) {
      const questions = result.data.questions as Question[]
      setCachedParseResult(parseCacheKey, questions)
      return questions
    }
    throw new Error(result.message || 'AI 解析失败')
  }

  // 多段：限制并发数并行调用，每段独立云函数调用确保不超时
  const allQuestions: Question[] = []
  let completed = 0
  let failedChunks = 0

  // 并发控制：同时最多 MAX_PARALLEL_CALLS 个云函数调用
  const semaphore = { count: 0 }
  const acquire = () => new Promise<void>(resolve => {
    const check = () => {
      if (semaphore.count < MAX_PARALLEL_CALLS) {
        semaphore.count++
        resolve()
      } else {
        setTimeout(check, 200)
      }
    }
    check()
  })
  const release = () => { semaphore.count-- }

  const chunkPromises = chunks.map(async (chunk, index) => {
    await acquire()
    try {
      console.log(`[AI解析] 第 ${index + 1}/${chunks.length} 段开始处理（${chunk.length} 字符）`)

      let lastError: Error | null = null
      for (let attempt = 0; attempt <= MAX_RETRY_PER_CHUNK; attempt++) {
        if (attempt > 0) {
          console.log(`[AI解析] 第 ${index + 1}/${chunks.length} 段第 ${attempt} 次重试（等待 ${RETRY_DELAY_MS}ms）`)
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
        }
        try {
          const result = await callFunction('aiParse', { text: chunk, providerConfig })
          if (result.success && result.data?.questions?.length > 0) {
            const questions = result.data.questions as Question[]
            console.log(`[AI解析] 第 ${index + 1}/${chunks.length} 段完成，解析出 ${questions.length} 道题${attempt > 0 ? `（第 ${attempt} 次重试成功）` : ''}`)
            return questions
          }
          console.warn(`[AI解析] 第 ${index + 1}/${chunks.length} 段返回空结果:`, result.message)
          lastError = new Error(result.message || 'AI 解析返回空结果')
        } catch (e) {
          lastError = e as Error
          console.error(`[AI解析] 第 ${index + 1}/${chunks.length} 段${attempt > 0 ? `第 ${attempt} 次重试` : ''}失败:`, lastError.message)
        }
      }

      // 所有重试均失败
      failedChunks++
      return []
    } finally {
      release()
      completed++
      onProgress?.(completed, chunks.length, 'ai_parsing')
    }
  })

  const results = await Promise.all(chunkPromises)
  for (const questions of results) {
    allQuestions.push(...questions)
  }

  if (allQuestions.length === 0) {
    throw new Error(`AI 解析全部 ${chunks.length} 段均失败${failedChunks > 0 ? '，请检查网络后重试' : ''}`)
  }

  if (failedChunks > 0) {
    console.warn(`[AI解析] ${failedChunks}/${chunks.length} 段解析失败，已返回其余 ${allQuestions.length} 道题`)
  }

  setCachedParseResult(parseCacheKey, allQuestions)
  return allQuestions
}

/**
 * 根据文本长度计算推荐的客户端超时时间（毫秒）
 * 考虑分段数、并行度、重试开销和云函数冷启动
 */
export function getRecommendedTimeout(textLength: number): number {
  const chunkCount = Math.ceil(textLength / CLIENT_CHUNK_SIZE)
  const batches = Math.ceil(chunkCount / MAX_PARALLEL_CALLS)
  // 每批最多 60s（云函数超时）+ 重试 2 次各 2s 间隔 + 5s 缓冲
  const perBatch = 60 + MAX_RETRY_PER_CHUNK * (RETRY_DELAY_MS / 1000 + 60) + 5
  return Math.max(Math.ceil(batches * perBatch) * 1000, 120000)
}

/**
 * 完整的文件导入流程（本地优先策略）
 *
 * 解析优先级：
 *   1. 本地读取 + parseDocxText（毫秒级，覆盖 DOCX 导出的标准格式）
 *   2. 本地 parseRichMarkdown（覆盖 ## N. 题目 格式）
 *   3. 本地 parseMarkdown（覆盖简单 1. 题目 格式）
 *   4. AI 智能解析（LLM 兜底，处理非标准格式）
 *
 * 文件类型处理：
 *   - .md / .txt：客户端本地读取文本 → 本地解析 → AI 兜底
 *   - .docx / .xlsx：上传 → parseFile 云函数提取文本 → 本地解析 → AI 兜底
 *
 * @param filePath 本地文件路径
 * @param fileName 原始文件名
 * @param onProgress 可选进度回调，用于更新 UI 状态
 * @param providerConfig 可选 Provider 配置（内置或自定义），透传给云函数
 * @returns 解析出的题目数组
 */
export async function parseFileToQuestions(
  filePath: string,
  fileName: string,
  onProgress?: (completed: number, total: number, stage?: string) => void,
  providerConfig?: ProviderConfig
): Promise<Question[]> {
  // === 分支 A：.md / .txt 文件 → 客户端本地读取 + 解析 ===
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const isTextFile = ext === 'md' || ext === 'txt'

  let localText: string | null = null

  if (isTextFile) {
    try {
      localText = await readLocalTextFile(filePath)
      if (localText && localText.trim()) {
        // 尝试所有本地解析器
        const localQ = tryLocalParseAll(localText)
        if (localQ) {
          console.log(`本地解析成功（${ext}），共 ${localQ.length} 道题`)
          return localQ
        }
        console.warn('本地解析无结果，使用已读取文本进行 AI 解析（跳过云上传）')
      }
    } catch (e) {
      console.warn('客户端读取文件失败，回退到云函数流程:', (e as Error).message)
    }
  }

  // === 分支 A2：.doc 文件 → 客户端本地读取二进制 + 提取 HTML 文本 + 本地解析 ===
  if (ext === 'doc' && !localText) {
    try {
      const buffer = await readLocalBinaryFile(filePath)
      const htmlText = extractHtmlFromDoc(buffer)
      if (htmlText && htmlText.trim()) {
        localText = htmlText
        // 优先尝试 parseExportDoc（专为导出格式设计）
        const docQ = parseExportDoc(htmlText)
        if (docQ.length > 0) {
          console.log(`本地解析 .doc 成功，共 ${docQ.length} 道题`)
          return docQ
        }
        // 也尝试通用解析器
        const localQ = tryLocalParseAll(htmlText)
        if (localQ) {
          console.log(`本地解析 .doc 成功（通用解析器），共 ${localQ.length} 道题`)
          return localQ
        }
        console.warn('.doc 本地解析无结果，使用提取文本进行 AI 解析')
      }
    } catch (e) {
      console.warn('客户端读取 .doc 文件失败，回退到云函数流程:', (e as Error).message)
    }
  }

  // === 分支 B：云函数流程（.docx/.xlsx/.doc 或文本文件本地解析失败的兜底） ===
  let text: string

  if (localText && localText.trim()) {
    text = localText
  } else {
    // 通知 UI：正在提取文本
    onProgress?.(0, 1, 'extracting')

    // 1. 上传文件到云存储
    const fileID = await uploadQuestionFile(filePath, fileName)

    // 2. 调用云函数提取文本
    text = await extractFileText(fileID, fileName)
  }

  if (!text.trim()) {
    throw new Error('文件内容为空')
  }

  // 文件级缓存：相同文本 + 相同 Provider → 直接返回缓存结果
  const fileCacheKey = getFileCacheKey(text.trim(), providerConfig)
  const fileCached = getCachedFileQuestions(fileCacheKey)
  if (fileCached) {
    console.log(`[缓存命中] 文件级缓存，共 ${fileCached.length} 道题（跳过全部解析）`)
    return fileCached
  }

  // 3. 通知 UI：正在本地解析
  onProgress?.(0, 1, 'parsing_local')

  // 4. xlsx 文件优先尝试结构化解析（云函数已将表格转为 ===SHEET: 格式）
  if (ext === 'xlsx') {
    const xlsxQ = parseXlsxStructured(text)
    if (xlsxQ.length > 0) {
      console.log(`xlsx 结构化解析成功，共 ${xlsxQ.length} 道题（跳过 AI 解析）`)
      setCachedFileQuestions(fileCacheKey, xlsxQ)
      return xlsxQ
    }
  }

  // 5. 通用本地解析（三种格式依次尝试）
  const localQuestions = tryLocalParseAll(text)
  if (localQuestions) {
    console.log(`本地解析成功，共 ${localQuestions.length} 道题（跳过 AI 解析）`)
    setCachedFileQuestions(fileCacheKey, localQuestions)
    return localQuestions
  }

  console.log('本地解析无结果，回退到 AI 智能解析')

  // 6. AI 解析兜底
  let aiQuestions: Question[] = []
  let aiError: Error | null = null

  try {
    aiQuestions = await aiParseQuestions(text, onProgress, providerConfig)
    if (aiQuestions.length > 0) {
      setCachedFileQuestions(fileCacheKey, aiQuestions)
      return aiQuestions
    }
    console.warn('AI 解析返回空结果')
  } catch (e) {
    aiError = e as Error
    console.warn('AI 解析失败:', aiError.message)
  }

  // 7. 全部失败
  throw aiError || new Error('未能从文件中解析出题目，请检查文件格式')
}

/**
 * 依次尝试所有本地解析器，返回第一个有结果的解析
 */
function tryLocalParseAll(text: string): Question[] | null {
  // 优先 parseDocxText（DOCX 导出的标准格式）
  const docxQ = parseDocxText(text)
  if (docxQ.length > 0) return docxQ

  // 其次 parseExportDoc（在线考试系统导出的 .doc 格式）
  const exportDocQ = parseExportDoc(text)
  if (exportDocQ.length > 0) return exportDocQ

  // 表格导出 DOCX 格式（题号独占一行 + 【答案】标记）
  const beidouQ = parseBeiDouDocx(text)
  if (beidouQ.length > 0) return beidouQ

  // xlsx 结构化文本格式
  const xlsxQ = parseXlsxStructured(text)
  if (xlsxQ.length > 0) return xlsxQ

  // parseRichMarkdown（## N. 题目 + **题型** 格式）
  const richQ = parseRichMarkdown(text)
  if (richQ.length > 0) return richQ

  // 最后 parseMarkdown（简单 1. 题目 + A. 选项 格式）
  const simpleQ = parseMarkdown(text)
  if (simpleQ.length > 0) return simpleQ

  return null
}