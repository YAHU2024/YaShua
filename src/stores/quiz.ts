import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Question, QuizProgress } from '@/types'
import { setQuizProgress, getQuizProgress, clearQuizProgress, hasQuizProgress } from '@/utils/storage'
import { isCloudAvailable } from '@/utils/cloud'
import { useUserStore } from './user'

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
    const progress: QuizProgress = {
      libraryId: questions.value[0]?.libraryId || '',
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
    if (!isCloudAvailable() || openid.startsWith('local_')) {
      saveResultsLocal(openid, stats)
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
              .where({ openid, questionId: question._id })
              .get()

            if (existing.data.length > 0) {
              await db.collection('wrongQuestions').doc(existing.data[0]._id).update({
                data: {
                  userAnswer,
                  wrongCount: db.command.inc(1),
                  lastWrongTime: new Date()
                }
              })
            } else {
              await db.collection('wrongQuestions').add({
                data: {
                  openid,
                  questionId: question._id || '',
                  userAnswer,
                  wrongCount: 1,
                  lastWrongTime: new Date()
                }
              })
            }
          } catch {
            errorCount++
          }
        }
      }

      if (errorCount > 0) {
        console.warn(`保存答题结果：${errorCount} 条记录写入失败`)
      }
      await updateStats(openid, stats)
    } catch (e) {
      console.error('保存答题结果失败', e)
      // 云失败降级到本地
      saveResultsLocal(openid, stats)
    }
  }

  // 本地存储答题结果
  function saveResultsLocal(openid: string, stats: { correct: number; total: number }) {
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

      // 错题
      if (!isCorrect) {
        const idx = localWrong.findIndex((w: any) => w.questionId === question._id)
        if (idx >= 0) {
          localWrong[idx].userAnswer = userAnswer
          localWrong[idx].wrongCount = (localWrong[idx].wrongCount || 1) + 1
          localWrong[idx].lastWrongTime = new Date().toISOString()
        } else {
          localWrong.push({
            openid,
            questionId: question._id || '',
            userAnswer,
            wrongCount: 1,
            lastWrongTime: new Date().toISOString()
          })
        }
      }
    }

    localSet('local_quiz_records', localRecords)
    localSet('local_wrong_questions', localWrong)

    // 更新本地统计
    const localStats = localGet('local_user_stats')
    const existing = localStats.find((s: any) => s.openid === openid)
    if (existing) {
      existing.totalQuestions += stats.total
      existing.correctCount += stats.correct
      existing.todayQuestions += stats.total
      existing.todayCorrect += stats.correct
      existing.updatedAt = new Date().toISOString()
    } else {
      localStats.push({
        openid,
        totalQuestions: stats.total,
        correctCount: stats.correct,
        todayQuestions: stats.total,
        todayCorrect: stats.correct,
        updatedAt: new Date().toISOString()
      })
    }
    localSet('local_user_stats', localStats)
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

  async function updateStats(openid: string, stats: { correct: number; total: number }) {
    // 本地模式已由 saveResultsLocal 处理，云不可用时跳过
    if (!isCloudAvailable() || openid.startsWith('local_')) return

    try {
      const db = uni.cloud.database()
      const existing = await db.collection('userStats').where({ _id: openid }).get()
      
      if (existing.data.length > 0) {
        await db.collection('userStats').doc(openid).update({
          data: {
            totalQuestions: db.command.inc(stats.total),
            correctCount: db.command.inc(stats.correct),
            todayQuestions: db.command.inc(stats.total),
            todayCorrect: db.command.inc(stats.correct),
            updatedAt: new Date()
          }
        })
      } else {
        await db.collection('userStats').add({
          data: {
            _id: openid,
            totalQuestions: stats.total,
            correctCount: stats.correct,
            todayQuestions: stats.total,
            todayCorrect: stats.correct,
            updatedAt: new Date()
          }
        })
      }
    } catch (e) {
      console.error('更新统计失败', e)
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
    saveResults
  }
})