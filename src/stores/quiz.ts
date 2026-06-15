import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Question, QuizProgress } from '@/types'
import { setQuizProgress, getQuizProgress, clearQuizProgress } from '@/utils/storage'
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
    try {
      const db = uni.cloud.database()
      const batch = db.command.batch()
      const stats: Record<string, number> = { correct: 0, total: 0 }

      for (const question of questions.value) {
        const userAnswer = answers.value[question._id || ''] || []
        const correctAnswer = question.answer || []
        const isCorrect = arraysEqual(userAnswer.sort(), correctAnswer.sort())
        
        if (isCorrect) stats.correct++
        stats.total++

        batch.add('userRecords', {
          openid,
          questionId: question._id || '',
          libraryId: question.libraryId,
          isCorrect,
          answerTime: new Date(),
          duration: 0
        })

        if (!isCorrect) {
          const existing = await db.collection('wrongQuestions')
            .where({ openid, questionId: question._id })
            .get()
          
          if (existing.data.length > 0) {
            batch.update('wrongQuestions', existing.data[0]._id, {
              userAnswer,
              wrongCount: db.command.inc(1),
              lastWrongTime: new Date()
            })
          } else {
            batch.add('wrongQuestions', {
              openid,
              questionId: question._id || '',
              userAnswer,
              wrongCount: 1,
              lastWrongTime: new Date()
            })
          }
        }
      }

      await batch.commit()
      await updateStats(openid, stats)
    } catch (e) {
      console.error('保存答题结果失败', e)
    }
  }

  async function updateStats(openid: string, stats: { correct: number; total: number }) {
    try {
      const db = uni.cloud.database()
      const existing = await db.collection('userStats').doc(openid).get()
      
      if (existing.data.length > 0) {
        await db.collection('userStats').doc(openid).update({
          totalQuestions: db.command.inc(stats.total),
          correctCount: db.command.inc(stats.correct),
          todayQuestions: db.command.inc(stats.total),
          todayCorrect: db.command.inc(stats.correct),
          updatedAt: new Date()
        })
      } else {
        await db.collection('userStats').add({
          _id: openid,
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
    saveResults
  }
})