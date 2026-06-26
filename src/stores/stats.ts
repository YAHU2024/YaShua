import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserStats } from '@/types'
import { isCloudAvailable } from '@/utils/cloud'

const LOCAL_KEY = 'local_user_stats'

// 防抖定时器（模块级单例，跨 store 实例共享）
let _cloudSyncTimer: ReturnType<typeof setTimeout> | null = null
const CLOUD_SYNC_DELAY = 5000 // 5 秒防抖

export const useStatsStore = defineStore('stats', () => {
  const totalQuestions = ref(0)
  const correctCount = ref(0)
  const todayQuestions = ref(0)
  const todayCorrect = ref(0)

  // 每日目标题数（用户可在设置页自定义，纯本地偏好）
  const dailyGoal = ref(20)
  try {
    const saved = uni.getStorageSync('daily_goal')
    // Storage 可能返回 string "20"，需显式转换
    if (saved != null) {
      const num = Number(saved)
      if (!isNaN(num)) dailyGoal.value = num
    }
  } catch { /* 静默降级 */ }

  function setDailyGoal(goal: number) {
    dailyGoal.value = goal
    try { uni.setStorageSync('daily_goal', goal) } catch { /* 静默降级 */ }
  }

  // ============================
  //  本地存储读写工具
  // ============================

  function readLocalStats(openid: string): UserStats | null {
    try {
      const raw = uni.getStorageSync(LOCAL_KEY)
      const list: any[] = raw ? JSON.parse(raw) : []
      return list.find((s: any) => s.openid === openid) || null
    } catch {
      return null
    }
  }

  /** 将当前 Pinia 内存值写入本地 storage（按 openid 隔离） */
  function writeLocalStats(openid: string) {
    try {
      const raw = uni.getStorageSync(LOCAL_KEY)
      const list: any[] = raw ? JSON.parse(raw) : []
      const idx = list.findIndex((s: any) => s.openid === openid)
      const data = {
        openid,
        totalQuestions: totalQuestions.value,
        correctCount: correctCount.value,
        todayQuestions: todayQuestions.value,
        todayCorrect: todayCorrect.value,
        updatedAt: new Date().toISOString()
      }
      if (idx >= 0) {
        list[idx] = data
      } else {
        list.push(data)
      }
      uni.setStorageSync(LOCAL_KEY, JSON.stringify(list))
    } catch (e) {
      console.error('[stats] 本地写入失败', e)
    }
  }

  /** 从一条 UserStats 数据填充 Pinia ref（含跨日清零） */
  function applyStats(stats: UserStats | any) {
    totalQuestions.value = stats.totalQuestions || 0
    correctCount.value = stats.correctCount || 0
    if (!isToday(stats.updatedAt)) {
      todayQuestions.value = 0
      todayCorrect.value = 0
    } else {
      todayQuestions.value = stats.todayQuestions || 0
      todayCorrect.value = stats.todayCorrect || 0
    }
  }

  // ============================
  //  加载：本地优先 + 云后台刷新
  // ============================

  async function loadStats(openid: string) {
    // 第一步：立即从本地 storage 读取（同步，零延迟）
    const localStats = readLocalStats(openid)
    if (localStats) {
      applyStats(localStats)
    }

    // 第二步：云可用时，后台异步拉取最新值覆盖（不阻塞 UI）
    if (isCloudAvailable() && !openid.startsWith('local_')) {
      _refreshFromCloud(openid)
    }
  }

  /** 后台从云 DB 刷新统计数据（fire-and-forget） */
  async function _refreshFromCloud(openid: string) {
    try {
      const db = uni.cloud.database()
      const result = await db.collection('userStats').where({ _id: openid }).get()
      if (result.data.length > 0) {
        applyStats(result.data[0])
        // 云数据更新后同步写本地，保持本地缓存最新
        writeLocalStats(openid)
      }
    } catch (e) {
      console.warn('[stats] 云刷新失败，使用本地数据', e)
    }
  }

  // ============================
  //  单题更新：写本地 + 防抖云同步
  // ============================

  /**
   * 每题确认后调用：更新本地 storage 并触发防抖云同步
   * 从 quiz.ts 的 saveResultsLocalForSingle 迁移而来
   */
  function saveLocalAndSyncCloud(openid: string, isCorrect: boolean) {
    // 1. 更新本地 storage（增量读-改-写）
    try {
      const raw = uni.getStorageSync(LOCAL_KEY)
      const list: any[] = raw ? JSON.parse(raw) : []
      const existing = list.find((s: any) => s.openid === openid)
      if (existing) {
        const isNewDay = !isSameDay(existing.updatedAt)
        existing.totalQuestions = (existing.totalQuestions || 0) + 1
        if (isCorrect) existing.correctCount = (existing.correctCount || 0) + 1
        existing.todayQuestions = isNewDay ? 1 : (existing.todayQuestions || 0) + 1
        existing.todayCorrect = isNewDay ? (isCorrect ? 1 : 0) : (existing.todayCorrect || 0) + (isCorrect ? 1 : 0)
        existing.updatedAt = new Date().toISOString()
      } else {
        list.push({
          openid,
          totalQuestions: 1,
          correctCount: isCorrect ? 1 : 0,
          todayQuestions: 1,
          todayCorrect: isCorrect ? 1 : 0,
          updatedAt: new Date().toISOString()
        })
      }
      uni.setStorageSync(LOCAL_KEY, JSON.stringify(list))
    } catch (e) {
      console.error('[stats] 本地持久化失败', e)
    }

    // 2. 触发防抖云同步
    _debouncedCloudSync(openid)
  }

  /** 防抖云同步：连续答题时合并为一次写入，减少网络开销 */
  function _debouncedCloudSync(openid: string) {
    if (!isCloudAvailable() || openid.startsWith('local_')) return
    if (_cloudSyncTimer) clearTimeout(_cloudSyncTimer)
    _cloudSyncTimer = setTimeout(() => {
      _cloudSyncTimer = null
      _uploadToCloud(openid)
    }, CLOUD_SYNC_DELAY)
  }

  /** 将当前 Pinia 值 SET 到云 DB（最终一致性） */
  async function _uploadToCloud(openid: string) {
    try {
      const db = uni.cloud.database()
      const existing = await db.collection('userStats').where({ _id: openid }).get()
      const cloudData = {
        totalQuestions: totalQuestions.value,
        correctCount: correctCount.value,
        todayQuestions: todayQuestions.value,
        todayCorrect: todayCorrect.value,
        updatedAt: new Date()
      }
      if (existing.data.length > 0) {
        await db.collection('userStats').doc(openid).update({ data: cloudData })
      } else {
        await db.collection('userStats').add({ data: { _id: openid, ...cloudData } })
      }
    } catch (e) {
      console.warn('[stats] 云同步失败，本地数据已保底', e)
    }
  }

  // ============================
  //  工具函数
  // ============================

  function isToday(dateStr?: string | Date): boolean {
    if (!dateStr) return false
    return new Date(dateStr).toDateString() === new Date().toDateString()
  }

  function isSameDay(dateStr?: string | Date): boolean {
    if (!dateStr) return false
    return new Date(dateStr).toDateString() === new Date().toDateString()
  }

  function getAccuracy(): number {
    if (totalQuestions.value === 0) return 0
    return Math.round((correctCount.value / totalQuestions.value) * 100)
  }

  function getTodayAccuracy(): number {
    if (todayQuestions.value === 0) return 0
    return Math.round((todayCorrect.value / todayQuestions.value) * 100)
  }

  return {
    totalQuestions,
    correctCount,
    todayQuestions,
    todayCorrect,
    dailyGoal,
    loadStats,
    setDailyGoal,
    saveLocalAndSyncCloud,
    getAccuracy,
    getTodayAccuracy
  }
})
