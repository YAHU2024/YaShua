import type { QuizProgress, DailyStats } from '@/types'

const QUIZ_PROGRESS_KEY = 'quiz_progress'
const OPENID_KEY = 'openid'
const DAILY_STATS_KEY = 'local_daily_stats'
const QUIZ_COUNT_KEY = 'local_quiz_count'
const LOCAL_USER_ID_KEY = 'local_userId'

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

/**
 * 获取本地用户 ID，不存在则生成 UUID 并保存
 */
export function getLocalUserId(): string {
  try {
    let userId = uni.getStorageSync(LOCAL_USER_ID_KEY)
    if (!userId) {
      userId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      uni.setStorageSync(LOCAL_USER_ID_KEY, userId)
    }
    return userId
  } catch (e) {
    const fallback = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    uni.setStorageSync(LOCAL_USER_ID_KEY, fallback)
    return fallback
  }
}

/**
 * 获取每日统计数据
 */
export function getDailyStats(): DailyStats[] {
  try {
    const raw = uni.getStorageSync(DAILY_STATS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error('获取每日统计失败', e)
    return []
  }
}

/**
 * 保存每日统计数据
 */
export function setDailyStats(stats: DailyStats[]): void {
  try {
    uni.setStorageSync(DAILY_STATS_KEY, JSON.stringify(stats))
  } catch (e) {
    console.error('保存每日统计失败', e)
  }
}

/**
 * 获取刷题数量设置
 */
export function getQuizCount(): number {
  try {
    const count = uni.getStorageSync(QUIZ_COUNT_KEY)
    return count ? parseInt(String(count), 10) : 20
  } catch (e) {
    return 20
  }
}

/**
 * 保存刷题数量设置
 */
export function setQuizCount(count: number): void {
  try {
    uni.setStorageSync(QUIZ_COUNT_KEY, count)
  } catch (e) {
    console.error('保存刷题数量设置失败', e)
  }
}
