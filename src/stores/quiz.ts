import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Question, QuizProgress } from '@/types'
import { setQuizProgress, getQuizProgress, clearQuizProgress, getQuizCount, setQuizCount } from '@/utils/storage'
import { storageAdapter } from '@/adapters/storageAdapter'
import { useUserStore } from './user'

export const useQuizStore = defineStore('quiz', () => {
  const questions = ref<Question[]>([])
  const currentIndex = ref(0)
  const mode = ref<'sequence' | 'random' | 'wrong'>('sequence')
  const answers = ref<Record<string, string[]>>({})
  const startTime = ref(0)
  const isFinished = ref(false)
  const quizCount = ref(getQuizCount())

  function initQuiz(quizQuestions: Question[], quizMode: 'sequence' | 'random' | 'wrong', count?: number) {
    let processed = quizMode === 'random' 
      ? [...quizQuestions].sort(() => Math.random() - 0.5)
      : [...quizQuestions]
    
    // 按数量截取（0 或 undefined 表示全部）
    if (count && count > 0 && count < processed.length) {
      processed = processed.slice(0, count)
    }
    
    questions.value = processed
    mode.value = quizMode
    currentIndex.value = 0
    answers.value = {}
    startTime.value = Date.now()
    isFinished.value = false
    saveProgress()
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
    clearQuizProgress()
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

  function loadProgress(): boolean {
    const progress = getQuizProgress()
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

  function calculateScore(): { correct: number; total: number } {
    let correct = 0
    for (const question of questions.value) {
      const userAnswer = answers.value[question._id || ''] || []
      const correctAnswer = question.answer || []
      if (arraysEqual([...userAnswer].sort(), [...correctAnswer].sort())) {
        correct++
      }
    }
    return { correct, total: questions.value.length }
  }

  function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    return a.every((val, idx) => val === b[idx])
  }

  /**
   * 更新刷题数量设置并持久化
   */
  function updateQuizCount(count: number) {
    quizCount.value = count
    setQuizCount(count)
  }

  /**
   * BUG-03: 重写 saveResults，去掉不存在的 db.command.batch()，
   * 改为逐条 Promise.all 分批写入，使用 storageAdapter
   */
  async function saveResults(userId: string) {
    try {
      const stats = { correct: 0, total: 0 }
      const records: any[] = []

      for (const question of questions.value) {
        const userAnswer = answers.value[question._id || ''] || []
        const correctAnswer = question.answer || []
        const isCorrect = arraysEqual([...userAnswer].sort(), [...correctAnswer].sort())

        if (isCorrect) stats.correct++
        stats.total++

        records.push({
          openid: userId,
          questionId: question._id || '',
          libraryId: question.libraryId,
          isCorrect,
          answerTime: new Date(),
          duration: 0
        })
      }

      // 分批写入答题记录（每批20条）
      const BATCH_SIZE = 20
      const recordsCollection = storageAdapter.getCollection('userRecords')
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE)
        await Promise.all(batch.map(record =>
          recordsCollection.add(record)
        ))
      }

      // 处理错题：遍历题目，答错的写入 wrongQuestions
      const wrongCollection = storageAdapter.getCollection('wrongQuestions')
      const wrongPromises: Promise<any>[] = []

      for (const question of questions.value) {
        const userAnswer = answers.value[question._id || ''] || []
        const correctAnswer = question.answer || []
        const isCorrect = arraysEqual([...userAnswer].sort(), [...correctAnswer].sort())

        if (!isCorrect) {
          wrongPromises.push((async () => {
            const existing = await wrongCollection
              .where({ openid: userId, questionId: question._id })
              .get()

            if (existing.data.length > 0) {
              await wrongCollection
                .doc(existing.data[0]._id)
                .update({
                  userAnswer,
                  wrongCount: (existing.data[0].wrongCount || 0) + 1,
                  lastWrongTime: new Date()
                })
            } else {
              await wrongCollection.add({
                openid: userId,
                questionId: question._id || '',
                userAnswer,
                wrongCount: 1,
                lastWrongTime: new Date()
              })
            }
          })())
        }
      }
      await Promise.all(wrongPromises)

      // 更新用户统计
      await updateStats(userId, stats)
    } catch (e) {
      console.error('保存答题结果失败', e)
    }
  }

  async function updateStats(userId: string, stats: { correct: number; total: number }) {
    try {
      const statsCollection = storageAdapter.getCollection('userStats')
      const existing = await statsCollection.doc(userId).get()

      if (existing.data.length > 0) {
        const current = existing.data[0]
        await statsCollection.doc(userId).update({
          totalQuestions: (current.totalQuestions || 0) + stats.total,
          correctCount: (current.correctCount || 0) + stats.correct,
          todayQuestions: (current.todayQuestions || 0) + stats.total,
          todayCorrect: (current.todayCorrect || 0) + stats.correct,
          updatedAt: new Date()
        })
      } else {
        await statsCollection.add({
          _id: userId,
          totalQuestions: stats.total,
          correctCount: stats.correct,
          todayQuestions: stats.total,
          todayCorrect: stats.correct,
          updatedAt: new Date()
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
    quizCount,
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
    calculateScore,
    saveResults,
    updateQuizCount
  }
})
