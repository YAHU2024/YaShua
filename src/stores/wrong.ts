import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { WrongQuestion, Question } from '@/types'
import { storageAdapter } from '@/adapters/storageAdapter'

export const useWrongStore = defineStore('wrong', () => {
  const wrongQuestions = ref<WrongQuestion[]>([])

  async function loadWrongQuestions(userId: string) {
    try {
      const result = await storageAdapter.getCollection('wrongQuestions')
        .where({ openid: userId })
        .get()
      wrongQuestions.value = result.data as WrongQuestion[]
    } catch (e) {
      console.error('加载错题失败', e)
    }
  }

  async function getWrongQuestionDetails(userId: string): Promise<(WrongQuestion & { question: Question })[]> {
    try {
      await loadWrongQuestions(userId)
      const questionsCollection = storageAdapter.getCollection('questions')
      const result: (WrongQuestion & { question: Question })[] = []

      for (const wrong of wrongQuestions.value) {
        const questionResult = await questionsCollection
          .doc(wrong.questionId)
          .get()
        if (questionResult.data.length > 0) {
          result.push({
            ...wrong,
            question: questionResult.data[0] as Question
          })
        }
      }
      return result
    } catch (e) {
      console.error('获取错题详情失败', e)
      return []
    }
  }

  async function deleteWrongQuestion(id: string) {
    try {
      await storageAdapter.getCollection('wrongQuestions').doc(id).remove()
      wrongQuestions.value = wrongQuestions.value.filter(w => w._id !== id)
      return true
    } catch (e) {
      console.error('删除错题失败', e)
      return false
    }
  }

  async function clearAllWrongQuestions(userId: string) {
    try {
      await storageAdapter.getCollection('wrongQuestions').where({ openid: userId }).remove()
      wrongQuestions.value = []
      return true
    } catch (e) {
      console.error('清空错题失败', e)
      return false
    }
  }

  function getWrongCount(): number {
    return wrongQuestions.value.length
  }

  return {
    wrongQuestions,
    loadWrongQuestions,
    getWrongQuestionDetails,
    deleteWrongQuestion,
    clearAllWrongQuestions,
    getWrongCount
  }
})
