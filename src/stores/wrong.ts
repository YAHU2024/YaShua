import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { WrongQuestion, Question } from '@/types'
import { isCloudAvailable } from '@/utils/cloud'

const LOCAL_KEY = 'local_wrong_questions'

function localGet(): WrongQuestion[] {
  try {
    const raw = uni.getStorageSync(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function localSet(data: WrongQuestion[]): void {
  try {
    uni.setStorageSync(LOCAL_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('本地存储错题失败', e)
  }
}

export const useWrongStore = defineStore('wrong', () => {
  const wrongQuestions = ref<WrongQuestion[]>([])

  async function loadWrongQuestions(openid: string) {
    // 云不可用或本地模式 → 从本地存储读取
    if (!isCloudAvailable() || openid.startsWith('local_')) {
      wrongQuestions.value = localGet().filter(w => w.openid === openid)
      return
    }

    try {
      const db = uni.cloud.database()
      const result = await db.collection('wrongQuestions')
        .where({ openid })
        .get()
      wrongQuestions.value = result.data as WrongQuestion[]
      // 同步到本地缓存
      localSet(result.data as WrongQuestion[])
    } catch (e) {
      console.error('加载错题失败', e)
      wrongQuestions.value = localGet().filter(w => w.openid === openid)
    }
  }

  async function getWrongQuestionDetails(openid: string): Promise<(WrongQuestion & { question: Question })[]> {
    await loadWrongQuestions(openid)

    // 云不可用或本地模式 → 从本地存储获取问题数据
    if (!isCloudAvailable() || openid.startsWith('local_')) {
      const result: (WrongQuestion & { question: Question })[] = []
      for (const wrong of wrongQuestions.value) {
        // 本地模式尝试从本地题库中获取题目详情
        try {
          const raw = uni.getStorageSync('local_questions')
          const questionsMap: Record<string, Question[]> = raw ? JSON.parse(raw) : {}
          for (const lib of Object.values(questionsMap)) {
            const found = lib.find((q: Question) => q._id === wrong.questionId)
            if (found) {
              result.push({ ...wrong, question: found })
              break
            }
          }
        } catch { /* skip */ }
      }
      return result
    }

    try {
      const db = uni.cloud.database()
      const result: (WrongQuestion & { question: Question })[] = []

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
    if (!isCloudAvailable()) {
      const local = localGet()
      wrongQuestions.value = local.filter(w => w._id !== id)
      localSet(wrongQuestions.value)
      return true
    }

    try {
      const db = uni.cloud.database()
      await db.collection('wrongQuestions').doc(id).remove()
      wrongQuestions.value = wrongQuestions.value.filter(w => w._id !== id)
      return true
    } catch (e) {
      console.error('删除错题失败', e)
      // 本地降级
      const local = localGet()
      wrongQuestions.value = local.filter(w => w._id !== id)
      localSet(wrongQuestions.value)
      return true
    }
  }

  async function clearAllWrongQuestions(openid: string) {
    if (!isCloudAvailable() || openid.startsWith('local_')) {
      const local = localGet().filter(w => w.openid !== openid)
      localSet(local)
      wrongQuestions.value = []
      return true
    }

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
