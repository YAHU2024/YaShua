import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Question, QuizProgress } from '@/types'
import { setQuizProgress, getQuizProgress, clearQuizProgress, hasQuizProgress } from '@/utils/storage'
import { isCloudAvailable } from '@/utils/cloud'
import { useUserStore } from './user'
import { useStatsStore } from './stats'

export const useQuizStore = defineStore('quiz', () => {
  const questions = ref<Question[]>([])
  const currentIndex = ref(0)
  const mode = ref<'sequence' | 'random' | 'wrong'>('sequence')
  const answers = ref<Record<string, string[]>>({})
  const startTime = ref(0)
  const isFinished = ref(false)

  function initQuiz(quizQuestions: Question[], quizMode: 'sequence' | 'random' | 'wrong') {
    questions.value = quizMode === 'random' 
      ? [...quizQuestions].sort(() => Math.random() - 0.5)
      : [...quizQuestions]
    mode.value = quizMode
    currentIndex.value = 0
    answers.value = {}
    startTime.value = Date.now()
    isFinished.value = false
    // 注意：不在 initQuiz 里调用 saveProgress()
    // 由调用方（quiz/index.vue）在需要时显式保存，避免覆盖旧进度或在错题模式下误存
  }

  function setAnswer(questionId: string, userAnswer: string[]) {
    answers.value[questionId] = userAnswer
    saveProgress()
  }

  function getAnswer(questionId: string): string[] {
    return answers.value[questionId] || []
  }

  function nextQuestion() {
    if (currentIndex.value < questions.value.length - 1) {
      currentIndex.value++
      saveProgress()
    }
  }

  function prevQuestion() {
    if (currentIndex.value > 0) {
      currentIndex.value--
      saveProgress()
    }
  }

  function goToQuestion(index: number) {
    if (index >= 0 && index < questions.value.length) {
      currentIndex.value = index
      saveProgress()
    }
  }

  function currentQuestion(): Question | null {
    return questions.value[currentIndex.value] || null
  }

  function totalQuestions(): number {
    return questions.value.length
  }

  function progress(): number {
    if (questions.value.length === 0) return 0
    return ((currentIndex.value + 1) / questions.value.length) * 100
  }

  function finishQuiz() {
    isFinished.value = true
    const libId = questions.value[0]?.libraryId || ''
    clearQuizProgress(libId, mode.value)
  }

  function saveProgress() {
    // Guard: no questions means nothing to save
    if (!questions.value || questions.value.length === 0) {
      console.warn('[quiz] Skipping saveProgress: no questions loaded')
      return
    }

    const progress: QuizProgress = {
      libraryId: questions.value[0].libraryId,
      mode: mode.value,
      questions: questions.value,
      currentIndex: currentIndex.value,
      answers: answers.value,
      startTime: startTime.value
    }
    setQuizProgress(progress)
  }

  function loadProgress(libraryId: string, quizMode: 'sequence' | 'random' | 'wrong'): boolean {
    const progress = getQuizProgress(libraryId, quizMode)
    if (progress) {
      questions.value = progress.questions
      mode.value = progress.mode
      currentIndex.value = progress.currentIndex
      answers.value = progress.answers
      startTime.value = progress.startTime
      isFinished.value = false
      return true
    }
    return false
  }

  /**
   * 检查是否有该题库+模式的保存进度
   */
  function savedProgressExists(libraryId: string, quizMode: 'sequence' | 'random' | 'wrong'): boolean {
    return hasQuizProgress(libraryId, quizMode)
  }

  function calculateScore(): { correct: number; total: number } {
    let correct = 0
    for (const question of questions.value) {
      const userAnswer = answers.value[question._id || ''] || []
      const correctAnswer = question.answer || []
      if (arraysEqual(userAnswer.sort(), correctAnswer.sort())) {
        correct++
      }
    }
    return { correct, total: questions.value.length }
  }

  function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    return a.every((val, idx) => val === b[idx])
  }

  async function saveResults(openid: string) {
    const stats = { correct: 0, total: 0 }

    // 先计算成绩
    for (const question of questions.value) {
      const userAnswer = answers.value[question._id || ''] || []
      const correctAnswer = question.answer || []
      if (arraysEqual(userAnswer.sort(), correctAnswer.sort())) stats.correct++
      stats.total++
    }

    // 云不可用或本地模式 → 全部存本地 storage
    // 注意：今日学习 stats 已由 recordSingleAnswer 逐题实时更新，此处不一重复计数
    if (!isCloudAvailable() || openid.startsWith('local_')) {
      saveResultsLocal(openid)
      return
    }

    // 云模式：循环逐个保存
    try {
      const db = uni.cloud.database()
      let errorCount = 0

      for (const question of questions.value) {
        const userAnswer = answers.value[question._id || ''] || []
        const correctAnswer = question.answer || []
        const isCorrect = arraysEqual(userAnswer.sort(), correctAnswer.sort())

        // 答题记录
        try {
          await db.collection('userRecords').add({
            data: {
              openid,
              questionId: question._id || '',
              libraryId: question.libraryId,
              isCorrect,
              answerTime: new Date(),
              duration: 0
            }
          })
        } catch {
          errorCount++
        }

        // 错题：查重后新增或更新
        if (!isCorrect) {
          try {
            const existing = await db.collection('wrongQuestions')
              .where({ openid, questionId: question._id, libraryId: question.libraryId })
              .get()

            if (existing.data.length > 0) {
              await db.collection('wrongQuestions').doc(existing.data[0]._id).update({
                data: {
                  userAnswer,
                  libraryId: question.libraryId,
                  wrongCount: db.command.inc(1),
                  lastWrongTime: new Date()
                }
              })
            } else {
              await db.collection('wrongQuestions').add({
                data: {
                  openid,
                  questionId: question._id || '',
                  libraryId: question.libraryId,
                  userAnswer,
                  wrongCount: 1,
                  lastWrongTime: new Date()
                }
              })
            }
          } catch {
            errorCount++
            // 降级到本地存储
            const localWrong = localGet('local_wrong_questions')
            const widx = localWrong.findIndex((w: any) => w.questionId === question._id && w.libraryId === question.libraryId)
            if (widx >= 0) {
              localWrong[widx].userAnswer = userAnswer
              localWrong[widx].wrongCount = (localWrong[widx].wrongCount || 1) + 1
              localWrong[widx].lastWrongTime = new Date().toISOString()
              localWrong[widx].libraryId = question.libraryId
            } else {
              localWrong.push({
                openid, questionId: question._id || '', libraryId: question.libraryId,
                userAnswer, wrongCount: 1, lastWrongTime: new Date().toISOString()
              })
            }
            localSet('local_wrong_questions', localWrong)
          }
        }
      }

      if (errorCount > 0) {
        console.warn(`保存答题结果：${errorCount} 条记录写入失败`)
      }
      // 云统计更新（用 SET 写入当前 statsStore 值，因为每题已由 recordSingleAnswer 实时累加）
      const cloudOk = await updateStats(openid)
      if (!cloudOk) {
        console.warn('[saveResults] 云统计写入失败，已由 recordSingleAnswer 逐题保底到本地 storage')
      }
    } catch (e) {
      console.error('保存答题结果失败', e)
      // 即使异常，stats 也已在每题确认时实时写入本地 storage
    }
  }

  // 本地存储答题结果
  function saveResultsLocal(openid: string) {
    const localRecords = localGet('local_quiz_records')
    const localWrong = localGet('local_wrong_questions')

    for (const question of questions.value) {
      const userAnswer = answers.value[question._id || ''] || []
      const correctAnswer = question.answer || []
      const isCorrect = arraysEqual(userAnswer.sort(), correctAnswer.sort())

      // 答题记录
      localRecords.push({
        openid,
        questionId: question._id || '',
        libraryId: question.libraryId,
        isCorrect,
        answerTime: new Date().toISOString(),
        duration: 0
      })

      // 错题（兜底，实际上 confirmAnswer 已逐题保存）
      if (!isCorrect) {
        const idx = localWrong.findIndex((w: any) => w.questionId === question._id)
        if (idx >= 0) {
          localWrong[idx].userAnswer = userAnswer
          localWrong[idx].wrongCount = (localWrong[idx].wrongCount || 1) + 1
          localWrong[idx].lastWrongTime = new Date().toISOString()
          localWrong[idx].libraryId = question.libraryId
        } else {
          localWrong.push({
            openid,
            questionId: question._id || '',
            libraryId: question.libraryId,
            userAnswer,
            wrongCount: 1,
            lastWrongTime: new Date().toISOString()
          })
        }
      }
    }

    localSet('local_quiz_records', localRecords)
    localSet('local_wrong_questions', localWrong)
    // 不再写入 local_user_stats：已由 recordSingleAnswer → saveResultsLocalForSingle 逐题实时更新
  }

  function localGet(key: string): any[] {
    try {
      const raw = uni.getStorageSync(key)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  function localSet(key: string, data: any[]) {
    try {
      uni.setStorageSync(key, JSON.stringify(data))
    } catch (e) {
      console.error('本地存储失败', key, e)
    }
  }

  /**
   * 判断日期是否为今日
   */
  function isSameDay(dateStr?: string | Date): boolean {
    if (!dateStr) return false
    return new Date(dateStr).toDateString() === new Date().toDateString()
  }

  /**
   * 每题实时统计：确认答案后立刻更新今日学习数据（不依赖交卷）
   * 与错题收集保持一致的实时性，确保用户中途返回也能看到更新
   */
  function recordSingleAnswer(isCorrect: boolean) {
    const statsStore = useStatsStore()
    const today = new Date().toDateString()
    // 跨日检测：新的一天清零
    if (_lastSyncDate && _lastSyncDate !== today) {
      statsStore.todayQuestions = 1
      statsStore.todayCorrect = isCorrect ? 1 : 0
    } else {
      statsStore.todayQuestions += 1
      if (isCorrect) statsStore.todayCorrect += 1
    }
    statsStore.totalQuestions += 1
    if (isCorrect) statsStore.correctCount += 1
    _lastSyncDate = today
    console.log(`[recordSingleAnswer] ${isCorrect ? '正确' : '错误'}, todayQuestions=${statsStore.todayQuestions}, todayCorrect=${statsStore.todayCorrect}`)
    // 同步写本地 storage 做持久化
    try {
      const openid = useUserStore().openid
      if (openid) {
        saveResultsLocalForSingle(openid, isCorrect)
      }
    } catch { /* 静默 */ }
  }

  /** 单题统计写入本地 storage */
  function saveResultsLocalForSingle(openid: string, isCorrect: boolean) {
    const localStats = localGet('local_user_stats')
    const existing = localStats.find((s: any) => s.openid === openid)
    if (existing) {
      const isNewDay = !isSameDay(existing.updatedAt)
      existing.totalQuestions = (existing.totalQuestions || 0) + 1
      if (isCorrect) existing.correctCount = (existing.correctCount || 0) + 1
      existing.todayQuestions = isNewDay ? 1 : (existing.todayQuestions || 0) + 1
      existing.todayCorrect = isNewDay ? (isCorrect ? 1 : 0) : (existing.todayCorrect || 0) + (isCorrect ? 1 : 0)
      existing.updatedAt = new Date().toISOString()
    } else {
      localStats.push({
        openid,
        totalQuestions: 1,
        correctCount: isCorrect ? 1 : 0,
        todayQuestions: 1,
        todayCorrect: isCorrect ? 1 : 0,
        updatedAt: new Date().toISOString()
      })
    }
    localSet('local_user_stats', localStats)
  }

  /**
   * 批量同步更新 statsStore 响应式值（交卷时调用）
   * 内置跨日检测：新的一天自动清零今日计数再累加
   */
  let _lastSyncDate = ''
  function syncStatsStore(stats: { correct: number; total: number }) {
    const statsStore = useStatsStore()
    const beforeToday = statsStore.todayQuestions
    const beforeCorrect = statsStore.todayCorrect
    console.log(`[syncStatsStore] 收到本次: +${stats.total}题/${stats.correct}对, 跨日:${_lastSyncDate && _lastSyncDate !== new Date().toDateString()}, 累加前: ${beforeToday}/${beforeCorrect}`)
    statsStore.totalQuestions += stats.total
    statsStore.correctCount += stats.correct
    // 跨日检测：新的一天用 = 赋初值，同一天用 += 累加
    const today = new Date().toDateString()
    if (_lastSyncDate && _lastSyncDate !== today) {
      statsStore.todayQuestions = stats.total
      statsStore.todayCorrect = stats.correct
    } else {
      statsStore.todayQuestions += stats.total
      statsStore.todayCorrect += stats.correct
    }
    _lastSyncDate = today
    console.log(`[syncStatsStore] 完成: todayQuestions=${statsStore.todayQuestions}, todayCorrect=${statsStore.todayCorrect}`)
  }

  async function updateStats(openid: string): Promise<boolean> {
    // 本地模式已由 saveResultsLocalForSingle 处理，云不可用时跳过
    if (!isCloudAvailable() || openid.startsWith('local_')) return false

    try {
      const statsStore = useStatsStore()
      const db = uni.cloud.database()
      const existing = await db.collection('userStats').where({ _id: openid }).get()
      
      // 直接 SET statsStore 当前值（每题已由 recordSingleAnswer 实时累加，云只需同步最终结果）
      const cloudData = {
        totalQuestions: statsStore.totalQuestions,
        correctCount: statsStore.correctCount,
        todayQuestions: statsStore.todayQuestions,
        todayCorrect: statsStore.todayCorrect,
        updatedAt: new Date()
      }
      
      if (existing.data.length > 0) {
        await db.collection('userStats').doc(openid).update({ data: cloudData })
      } else {
        await db.collection('userStats').add({
          data: { _id: openid, ...cloudData }
        })
      }
      return true
    } catch (e) {
      console.error('[updateStats] 云统计更新失败:', e)
      return false
    }
  }

  return {
    questions,
    currentIndex,
    mode,
    answers,
    startTime,
    isFinished,
    initQuiz,
    setAnswer,
    getAnswer,
    nextQuestion,
    prevQuestion,
    goToQuestion,
    currentQuestion,
    totalQuestions,
    progress,
    finishQuiz,
    loadProgress,
    savedProgressExists,
    saveProgress,
    calculateScore,
    saveResults,
    recordSingleAnswer
  }
})