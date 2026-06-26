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

  async function loadWrongQuestions(openid: string, libraryId?: string) {
    // 云不可用或本地模式 → 从本地存储读取
    if (!isCloudAvailable() || openid.startsWith('local_')) {
      const all = localGet().filter(w => w.openid === openid)
      wrongQuestions.value = libraryId ? all.filter(w => w.libraryId === libraryId) : all
      return
    }

    try {
      const db = uni.cloud.database()
      const where: Record<string, string> = { openid }
      if (libraryId) {
        where.libraryId = libraryId
      }
      // 分页查询（微信云每次最多返回100条）
      const PAGE_SIZE = 100
      let allData: WrongQuestion[] = []
      let skip = 0
      while (true) {
        const result = await db.collection('wrongQuestions')
          .where(where)
          .skip(skip)
          .limit(PAGE_SIZE)
          .get()
        allData = allData.concat(result.data as WrongQuestion[])
        if (result.data.length < PAGE_SIZE) break
        skip += PAGE_SIZE
      }
      const result = { data: allData }
      wrongQuestions.value = result.data as WrongQuestion[]
      // 同步到本地缓存：合并而非覆盖（不同 libraryId 的共存）
      if (!libraryId) {
        if (result.data.length > 0) {
          localSet(result.data as WrongQuestion[])
        } else {
          // 云返回空时回退本地缓存，避免覆盖已写入本地的错题
          const local = localGet().filter(w => w.openid === openid)
          if (local.length > 0) {
            wrongQuestions.value = local
            console.log('[错题] 云为空，回退本地缓存', local.length, '条')
          }
        }
      } else {
        const local = localGet()
        const others = local.filter(w => w.openid !== openid || w.libraryId !== libraryId)
        localSet([...others, ...(result.data as WrongQuestion[])])
      }
    } catch (e) {
      console.error('加载错题失败', e)
      const all = localGet().filter(w => w.openid === openid)
      wrongQuestions.value = libraryId ? all.filter(w => w.libraryId === libraryId) : all
    }
  }

  async function getWrongQuestionDetails(openid: string, libraryId?: string): Promise<(WrongQuestion & { question: Question })[]> {
    await loadWrongQuestions(openid, libraryId)

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

      // 批量获取所有题目文档（避免逐条 doc().get() 的权限问题）
      const questionIds = [...new Set(wrongQuestions.value.map(w => w.questionId))]
      const questionMap = new Map<string, Question>()
      
      if (questionIds.length > 0) {
        // 微信云 where in 每次最多100条，分批查询
        const BATCH_SIZE = 100
        for (let i = 0; i < questionIds.length; i += BATCH_SIZE) {
          const batch = questionIds.slice(i, i + BATCH_SIZE)
          const qResult = await db.collection('questions')
            .where({ _id: db.command.in(batch) })
            .get()
          for (const q of (qResult.data || []) as Question[]) {
            if (q._id) questionMap.set(q._id, q)
          }
        }
      }

      for (const wrong of wrongQuestions.value) {
        const question = questionMap.get(wrong.questionId)
        if (question) {
          result.push({ ...wrong, question })
        } else {
          // 过滤掉题目不存在的记录，不再显示占位
          console.warn('[错题] 题目', wrong.questionId, '已被删除，从错题列表中移除该记录')
          // 可选：同时删除云端对应的错题记录（使用当前记录的 _id）
          try {
            await db.collection('wrongQuestions').doc(wrong._id || '').remove()
          } catch (e) {
            console.error('[错题] 删除无效错题记录失败', e)
          }
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

  async function clearAllWrongQuestions(openid: string, libraryId?: string) {
    if (!isCloudAvailable() || openid.startsWith('local_')) {
      if (libraryId) {
        const local = localGet().filter(w => !(w.openid === openid && w.libraryId === libraryId))
        localSet(local)
        wrongQuestions.value = wrongQuestions.value.filter(w => !(w.openid === openid && w.libraryId === libraryId))
      } else {
        const local = localGet().filter(w => w.openid !== openid)
        localSet(local)
        wrongQuestions.value = []
      }
      return true
    }

    try {
      const db = uni.cloud.database()
      const where: Record<string, string> = { openid }
      if (libraryId) {
        where.libraryId = libraryId
      }
      await db.collection('wrongQuestions').where(where).remove()
      if (libraryId) {
        wrongQuestions.value = wrongQuestions.value.filter(w => !(w.openid === openid && w.libraryId === libraryId))
      } else {
        wrongQuestions.value = []
      }
      return true
    } catch (e) {
      console.error('清空错题失败', e)
      return false
    }
  }

  /**
   * 实时记录单道错题（逐题收集）
   * 在 confirmAnswer 时调用，答错立即记录到对应题库的错题集
   */
  async function addWrongQuestion(openid: string, questionId: string, userAnswer: string[], libraryId: string): Promise<void> {
    // 本地模式 → 直接写本地存储
    if (!isCloudAvailable() || openid.startsWith('local_')) {
      const local = localGet()
      const idx = local.findIndex(w => w.questionId === questionId && w.libraryId === libraryId)
      if (idx >= 0) {
        local[idx].userAnswer = userAnswer
        local[idx].wrongCount = (local[idx].wrongCount || 1) + 1
        local[idx].lastWrongTime = new Date().toISOString()
      } else {
        local.push({
          openid,
          questionId,
          libraryId,
          userAnswer,
          wrongCount: 1,
          lastWrongTime: new Date().toISOString()
        } as any)
      }
      localSet(local)
      return
    }

    // 云模式：查重后新增或更新
    try {
      const db = uni.cloud.database()
      const existing = await db.collection('wrongQuestions')
        .where({ openid, questionId, libraryId })
        .get()

      if (existing.data.length > 0) {
        await db.collection('wrongQuestions').doc(existing.data[0]._id).update({
          data: {
            userAnswer,
            libraryId,
            wrongCount: db.command.inc(1),
            lastWrongTime: new Date()
          }
        })
        console.log('[错题] 云更新成功', questionId, '题库', libraryId, '第', existing.data[0].wrongCount + 1, '次')
      } else {
        await db.collection('wrongQuestions').add({
          data: {
            openid,
            questionId,
            libraryId,
            userAnswer,
            wrongCount: 1,
            lastWrongTime: new Date()
          }
        })
        console.log('[错题] 云写入成功', questionId, '题库', libraryId)
      }
    } catch (e) {
      console.error('实时记录错题失败', e)
      // 降级到本地
      const local = localGet()
      const idx = local.findIndex(w => w.questionId === questionId && w.libraryId === libraryId)
      if (idx >= 0) {
        local[idx].userAnswer = userAnswer
        local[idx].wrongCount = (local[idx].wrongCount || 1) + 1
        local[idx].libraryId = libraryId
      } else {
        local.push({ openid, questionId, libraryId, userAnswer, wrongCount: 1, lastWrongTime: new Date().toISOString() } as any)
      }
      localSet(local)
    }
  }

  function getWrongCount(): number {
    return wrongQuestions.value.length
  }

  /**
   * 获取某个题库的错题数量
   */
  function getWrongCountByLibrary(libraryId: string): number {
    return wrongQuestions.value.filter(w => w.libraryId === libraryId).length
  }

  return {
    wrongQuestions,
    loadWrongQuestions,
    getWrongQuestionDetails,
    deleteWrongQuestion,
    clearAllWrongQuestions,
    addWrongQuestion,
    getWrongCount,
    getWrongCountByLibrary
  }
})
