import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { WrongQuestion, Question } from '@/types'

export const useWrongStore = defineStore('wrong', () => {
  const wrongQuestions = ref<WrongQuestion[]>([])

  async function loadWrongQuestions(openid: string) {
    try {
      const db = uni.cloud.database()
      const result = await db.collection('wrongQuestions')
        .where({ openid })
        .get()
      wrongQuestions.value = result.data as WrongQuestion[]
    } catch (e) {
      console.error('加载错题失败', e)
    }
  }

  async function getWrongQuestionDetails(openid: string): Promise<(WrongQuestion & { question: Question })[]> {
    try {
      await loadWrongQuestions(openid)
      const db = uni.cloud.database()
      const result = []
      
      for (const wrong of wrongQuestions.value) {
        const questionResult = await db.collection('questions')
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
      const db = uni.cloud.database()
      await db.collection('wrongQuestions').doc(id).remove()
      wrongQuestions.value = wrongQuestions.value.filter(w => w._id !== id)
      return true
    } catch (e) {
      console.error('删除错题失败', e)
      return false
    }
  }

  async function clearAllWrongQuestions(openid: string) {
    try {
      const db = uni.cloud.database()
      await db.collection('wrongQuestions').where({ openid }).remove()
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