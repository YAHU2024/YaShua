import type { QuizProgress } from '@/types'

const QUIZ_PROGRESS_KEY = 'quiz_progress'
const OPENID_KEY = 'openid'

export function setQuizProgress(progress: QuizProgress): void {
  try {
    uni.setStorageSync(QUIZ_PROGRESS_KEY, JSON.stringify(progress))
  } catch (e) {
    console.error('保存刷题进度失败', e)
  }
}

export function getQuizProgress(): QuizProgress | null {
  try {
    const data = uni.getStorageSync(QUIZ_PROGRESS_KEY)
    return data ? JSON.parse(data) : null
  } catch (e) {
    console.error('获取刷题进度失败', e)
    return null
  }
}

export function clearQuizProgress(): void {
  try {
    uni.removeStorageSync(QUIZ_PROGRESS_KEY)
  } catch (e) {
    console.error('清除刷题进度失败', e)
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