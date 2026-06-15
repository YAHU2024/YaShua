import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserStats } from '@/types'

export const useStatsStore = defineStore('stats', () => {
  const totalQuestions = ref(0)
  const correctCount = ref(0)
  const todayQuestions = ref(0)
  const todayCorrect = ref(0)

  async function loadStats(openid: string) {
    try {
      const db = uni.cloud.database()
      const result = await db.collection('userStats').doc(openid).get()
      if (result.data.length > 0) {
        const stats = result.data[0] as UserStats
        totalQuestions.value = stats.totalQuestions || 0
        correctCount.value = stats.correctCount || 0
        todayQuestions.value = stats.todayQuestions || 0
        todayCorrect.value = stats.todayCorrect || 0
      }
    } catch (e) {
      console.error('加载统计数据失败', e)
    }
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
    loadStats,
    getAccuracy,
    getTodayAccuracy
  }
})