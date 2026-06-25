import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserStats } from '@/types'
import { isCloudAvailable } from '@/utils/cloud'

const LOCAL_KEY = 'local_user_stats'

export const useStatsStore = defineStore('stats', () => {
  const totalQuestions = ref(0)
  const correctCount = ref(0)
  const todayQuestions = ref(0)
  const todayCorrect = ref(0)

  // 每日目标题数（用户可在设置页自定义，纯本地偏好）
  const dailyGoal = ref(20)
  try {
    const saved = uni.getStorageSync('daily_goal')
    if (saved && typeof saved === 'number') dailyGoal.value = saved
  } catch { /* 静默降级 */ }

  function setDailyGoal(goal: number) {
    dailyGoal.value = goal
    try { uni.setStorageSync('daily_goal', goal) } catch { /* 静默降级 */ }
  }

  async function loadStats(openid: string) {
    // 云不可用或本地模式 → 从本地存储读取
    if (!isCloudAvailable() || openid.startsWith('local_')) {
      try {
        const raw = uni.getStorageSync(LOCAL_KEY)
        const list: any[] = raw ? JSON.parse(raw) : []
        const stats = list.find((s: any) => s.openid === openid)
        if (stats) {
          totalQuestions.value = stats.totalQuestions || 0
          correctCount.value = stats.correctCount || 0
          // 检查是否是今日数据，非今日则仅清零内存（不再写回本地）
          if (!isToday(stats.updatedAt)) {
            todayQuestions.value = 0
            todayCorrect.value = 0
          } else {
            todayQuestions.value = stats.todayQuestions || 0
            todayCorrect.value = stats.todayCorrect || 0
          }
        }
      } catch (e) {
        console.error('加载本地统计数据失败', e)
      }
      return
    }

    try {
      const db = uni.cloud.database()
      const result = await db.collection('userStats').where({ _id: openid }).get()
      if (result.data.length > 0) {
        const stats = result.data[0] as UserStats
        totalQuestions.value = stats.totalQuestions || 0
        correctCount.value = stats.correctCount || 0
        // 检查是否是今日数据，非今日则仅清零内存（不再写回云端，避免覆盖 updateStats 刚写入的值）
        if (!isToday(stats.updatedAt)) {
          todayQuestions.value = 0
          todayCorrect.value = 0
        } else {
          todayQuestions.value = stats.todayQuestions || 0
          todayCorrect.value = stats.todayCorrect || 0
        }
      }
    } catch (e) {
      console.error('加载统计数据失败', e)
      // 降级到本地
      try {
        const raw = uni.getStorageSync(LOCAL_KEY)
        const list: any[] = raw ? JSON.parse(raw) : []
        const localStats = list.find((s: any) => s.openid === openid)
        if (localStats) {
          totalQuestions.value = localStats.totalQuestions || 0
          correctCount.value = localStats.correctCount || 0
          if (!isToday(localStats.updatedAt)) {
            todayQuestions.value = 0
            todayCorrect.value = 0
          } else {
            todayQuestions.value = localStats.todayQuestions || 0
            todayCorrect.value = localStats.todayCorrect || 0
          }
        }
      } catch { /* 静默降级 */ }
    }
  }

  /**
   * 判断是否为今日日期
   */
  function isToday(dateStr?: string | Date): boolean {
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
    getAccuracy,
    getTodayAccuracy
  }
})
