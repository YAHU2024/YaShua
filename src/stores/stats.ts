import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserStats, DailyStats, LibraryMastery } from '@/types'
import { storageAdapter } from '@/adapters/storageAdapter'
import { getDailyStats as getLocalDailyStats, setDailyStats as setLocalDailyStats } from '@/utils/storage'

export const useStatsStore = defineStore('stats', () => {
  const totalQuestions = ref(0)
  const correctCount = ref(0)
  const todayQuestions = ref(0)
  const todayCorrect = ref(0)

  async function loadStats(userId: string) {
    try {
      const result = await storageAdapter.getCollection('userStats').doc(userId).get()
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

  /**
   * 读取近N天的每日统计数据
   * 统一从全部数据中提取并过滤（兼容云存储和本地存储）
   */
  async function loadDailyStats(rangeDays: number): Promise<DailyStats[]> {
    // 计算截止日期
    const today = new Date()
    const cutoff = new Date()
    cutoff.setDate(today.getDate() - rangeDays + 1)
    const cutoffStr = formatDateStr(cutoff)

    // 优先尝试从云存储读取全部数据
    try {
      if (storageAdapter.isCloudAvailable()) {
        const result = await storageAdapter.getCollection('dailyStats').get()
        const allStats = result.data as DailyStats[]
        return allStats.filter((s: DailyStats) => s.date >= cutoffStr)
      }
    } catch (e) {
      console.error('从云存储加载每日统计失败，降级为本地数据', e)
    }

    // 离线模式或云存储失败：从本地存储读取
    const allStats = getLocalDailyStats()
    return allStats.filter(s => s.date >= cutoffStr)
  }

  /**
   * 聚合各题库正确率
   * 通过分析 userRecords 数据计算
   * BUG-06: 增加 userId 参数，按用户过滤答题记录
   */
  async function getLibraryMastery(userId: string): Promise<LibraryMastery[]> {
    try {
      // 按用户过滤答题记录
      const recordsResult = await storageAdapter.getCollection('userRecords').where({ openid: userId }).get()
      const records = recordsResult.data

      // 获取所有题库
      const librariesResult = await storageAdapter.getCollection('libraries').get()
      const libraries = librariesResult.data

      // 按 libraryId 聚合
      const masteryMap: Record<string, { total: number; correct: number; name: string }> = {}

      for (const lib of libraries) {
        masteryMap[lib._id] = { total: 0, correct: 0, name: lib.name }
      }

      for (const record of records) {
        if (record.libraryId && masteryMap[record.libraryId]) {
          masteryMap[record.libraryId].total++
          if (record.isCorrect) {
            masteryMap[record.libraryId].correct++
          }
        }
      }

      const result: LibraryMastery[] = []
      for (const libId of Object.keys(masteryMap)) {
        const m = masteryMap[libId]
        result.push({
          libraryId: libId,
          libraryName: m.name,
          totalQuestions: m.total,
          correctCount: m.correct,
          accuracy: m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0
        })
      }

      return result.sort((a, b) => b.accuracy - a.accuracy)
    } catch (e) {
      console.error('获取题库掌握度失败', e)
      return []
    }
  }

  /**
   * 记录每日统计（供答题完成后调用）
   */
  async function recordDailyStat(stat: DailyStats): Promise<void> {
    const localStats = getLocalDailyStats()
    const existingIdx = localStats.findIndex(s => s.date === stat.date)
    if (existingIdx !== -1) {
      localStats[existingIdx] = stat
    } else {
      localStats.push(stat)
    }
    setLocalDailyStats(localStats)

    // 云存储模式下也尝试同步（先查后写，避免重复）
    if (storageAdapter.isCloudAvailable()) {
      try {
        const existingResult = await storageAdapter.getCollection('dailyStats')
          .where({ date: stat.date })
          .get()
        if (existingResult.data.length > 0) {
          await storageAdapter.getCollection('dailyStats')
            .doc(existingResult.data[0]._id)
            .update(stat)
        } else {
          await storageAdapter.getCollection('dailyStats').add(stat)
        }
      } catch (e) {
        console.error('同步每日统计到云存储失败', e)
      }
    }
  }

  return {
    totalQuestions,
    correctCount,
    todayQuestions,
    todayCorrect,
    loadStats,
    getAccuracy,
    getTodayAccuracy,
    loadDailyStats,
    getLibraryMastery,
    recordDailyStat
  }
})

/**
 * 格式化日期为 YYYY-MM-DD 字符串
 */
function formatDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
