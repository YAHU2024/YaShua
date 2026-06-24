import type { QuizProgress } from '@/types'

const QUIZ_PROGRESS_PREFIX = 'quiz_progress'
const OPENID_KEY = 'openid'

/**
 * 构建复合键：quiz_progress_{libraryId}_{mode}
 * 实现不同题库、不同练习模式的数据隔离
 */
function buildKey(libraryId: string, mode: string): string {
  return `${QUIZ_PROGRESS_PREFIX}_${libraryId}_${mode}`
}

export function setQuizProgress(progress: QuizProgress): void {
  try {
    const key = buildKey(progress.libraryId, progress.mode)
    uni.setStorageSync(key, JSON.stringify(progress))
  } catch (e) {
    console.error('保存刷题进度失败', e)
  }
}

export function getQuizProgress(libraryId: string, mode: string): QuizProgress | null {
  try {
    const key = buildKey(libraryId, mode)
    const data = uni.getStorageSync(key)
    return data ? JSON.parse(data) : null
  } catch (e) {
    console.error('获取刷题进度失败', e)
    return null
  }
}

export function clearQuizProgress(libraryId: string, mode: string): void {
  try {
    const key = buildKey(libraryId, mode)
    uni.removeStorageSync(key)
  } catch (e) {
    console.error('清除刷题进度失败', e)
  }
}

/**
 * 检查是否有该题库+模式的保存进度
 */
export function hasQuizProgress(libraryId: string, mode: string): boolean {
  try {
    const key = buildKey(libraryId, mode)
    const data = uni.getStorageSync(key)
    return !!data
  } catch {
    return false
  }
}

export function setOpenid(openid: string): void {
  try {
    uni.setStorageSync(OPENID_KEY, openid)
  } catch (e) {
    console.error('保存 openid 失败', e)
  }
}

export function getOpenid(): string | null {
  try {
    return uni.getStorageSync(OPENID_KEY) || null
  } catch (e) {
    console.error('获取 openid 失败', e)
    return null
  }
}

export function setItem(key: string, value: any): void {
  try {
    uni.setStorageSync(key, JSON.stringify(value))
  } catch (e) {
    console.error(`保存 ${key} 失败`, e)
  }
}

export function getItem(key: string): any {
  try {
    const data = uni.getStorageSync(key)
    return data ? JSON.parse(data) : null
  } catch (e) {
    console.error(`获取 ${key} 失败`, e)
    return null
  }
}

export function removeItem(key: string): void {
  try {
    uni.removeStorageSync(key)
  } catch (e) {
    console.error(`删除 ${key} 失败`, e)
  }
}

export function clear(): void {
  try {
    uni.clearStorageSync()
  } catch (e) {
    console.error('清空存储失败', e)
  }
}