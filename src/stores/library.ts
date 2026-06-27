import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Library, Question } from '@/types'
import { callFunction, isCloudAvailable } from '@/utils/cloud'

// 本地存储键名
const LOCAL_LIBRARIES_KEY = 'local_libraries'
const LOCAL_QUESTIONS_KEY = 'local_questions'

// 本地存储辅助函数
function getLocalLibraries(): Library[] {
  try {
    const data = uni.getStorageSync(LOCAL_LIBRARIES_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveLocalLibraries(libraries: Library[]): void {
  try {
    uni.setStorageSync(LOCAL_LIBRARIES_KEY, JSON.stringify(libraries))
  } catch (e) {
    console.error('保存本地题库失败', e)
  }
}

function getLocalQuestions(): Record<string, Question[]> {
  try {
    const data = uni.getStorageSync(LOCAL_QUESTIONS_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function saveLocalQuestions(questionsMap: Record<string, Question[]>): void {
  try {
    uni.setStorageSync(LOCAL_QUESTIONS_KEY, JSON.stringify(questionsMap))
  } catch (e) {
    console.error('保存本地题目失败', e)
  }
}

// 生成本地唯一 ID
function generateLocalId(): string {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

export const useLibraryStore = defineStore('library', () => {
  const libraries = ref<Library[]>([])
  const currentLibrary = ref<Library | null>(null)

  async function loadLibraries() {
    if (isCloudAvailable()) {
      try {
        const db = uni.cloud.database()
        const MAX_LIMIT = 20

        // 先查总数
        const countResult = await db.collection('libraries').count()
        const total = countResult.total
        let allLibraries: Library[] = []

        // 分批获取（微信云开发每次最多返回20条）
        for (let i = 0; i < total; i += MAX_LIMIT) {
          const result = await db.collection('libraries')
            .skip(i).limit(MAX_LIMIT).get()
          allLibraries = allLibraries.concat(result.data as Library[])
        }

        libraries.value = allLibraries
        // 同步到本地存储（作为缓存）
        saveLocalLibraries(libraries.value)
        return
      } catch (e) {
        console.error('云开发加载题库失败，使用本地数据', e)
      }
    }
    // 云不可用或云失败时，从本地存储读取
    libraries.value = getLocalLibraries()
  }

  async function createLibrary(name: string, description?: string) {
    const now = new Date()
    const libraryData = {
      name,
      description: description || '',
      totalQuestions: 0,
      createdAt: now,
      updatedAt: now
    }

    if (isCloudAvailable()) {
      try {
        const db = uni.cloud.database()
        const result = await db.collection('libraries').add({ data: libraryData })
        await loadLibraries()
        return result._id
      } catch (e) {
        console.error('云开发创建题库失败，使用本地存储', e)
      }
    }

    // 本地降级：生成本地 ID 并存储
    const localId = generateLocalId()
    const localLibrary: Library = {
      _id: localId,
      ...libraryData,
      createdAt: now,
      updatedAt: now
    }
    const localList = getLocalLibraries()
    localList.push(localLibrary)
    saveLocalLibraries(localList)
    libraries.value = localList
    return localId
  }

  async function updateLibrary(id: string, name: string, description?: string) {
    const updateData = {
      name,
      description: description || '',
      updatedAt: new Date()
    }

    if (isCloudAvailable() && !id.startsWith('local_')) {
      try {
        const db = uni.cloud.database()
        await db.collection('libraries').doc(id).update({ data: updateData })
        await loadLibraries()
        return true
      } catch (e) {
        console.error('云开发更新题库失败，更新本地存储', e)
      }
    }

    // 本地降级
    const localList = getLocalLibraries()
    const idx = localList.findIndex(l => l._id === id)
    if (idx >= 0) {
      localList[idx] = { ...localList[idx], ...updateData }
      saveLocalLibraries(localList)
      libraries.value = localList
      return true
    }
    return false
  }

  async function deleteLibrary(id: string) {
    if (isCloudAvailable() && !id.startsWith('local_')) {
      try {
        const db = uni.cloud.database()
        await db.collection('libraries').doc(id).remove()
        await db.collection('questions').where({ libraryId: id }).remove()
        await loadLibraries()
        return true
      } catch (e) {
        console.error('云开发删除题库失败，删除本地存储', e)
      }
    }

    // 本地降级
    const localList = getLocalLibraries()
    const filtered = localList.filter(l => l._id !== id)
    saveLocalLibraries(filtered)
    libraries.value = filtered

    // 删除本地题目
    const questionsMap = getLocalQuestions()
    delete questionsMap[id]
    saveLocalQuestions(questionsMap)
    return true
  }

  async function importQuestions(libraryId: string, questions: Question[], openid: string) {
    // 大题目集分片：超过 100 题分批调用云函数，避免单次超时
    const MAX_PER_CALL = 100

    if (isCloudAvailable()) {
      let totalImported = 0
      let allCloudFailed = true

      // 分片
      for (let i = 0; i < questions.length; i += MAX_PER_CALL) {
        const chunk = questions.slice(i, i + MAX_PER_CALL)
        let chunkResult: any = null

        try {
          chunkResult = await callFunction('importQuestions', {
            libraryId,
            questions: chunk,
            openid
          })

          // 仅当内容安全检测导致的失败才用 skipSafetyCheck 重试一次
          if (!chunkResult.success && chunkResult.code === 'CONTENT_NOT_SAFE') {
            console.warn(`分片${Math.floor(i / MAX_PER_CALL) + 1}内容安全检测未通过，用 skipSafetyCheck 重试:`, chunkResult.message)
            chunkResult = await callFunction('importQuestions', {
              libraryId,
              questions: chunk,
              openid,
              skipSafetyCheck: true
            })
          }
        } catch (e) {
          console.error(`分片${Math.floor(i / MAX_PER_CALL) + 1}云函数调用异常`, e)
        }

        if (chunkResult?.success) {
          totalImported += (chunkResult.data?.importedCount || chunk.length)
          allCloudFailed = false
        } else {
          console.error(`分片${Math.floor(i / MAX_PER_CALL) + 1}导入最终失败:`, chunkResult?.message || '未知错误')
        }
      }

      // 如果至少有一批成功，视为整体成功
      if (!allCloudFailed) {
        await loadLibraries()
        // 云端成功后同步题目到本地缓存，确保降级可靠
        const questionsMap = getLocalQuestions()
        const cachedQuestions = questionsMap[libraryId] || []
        // 将新导入的题目追加到本地缓存（避免覆盖已有的本地题目）
        const newLocalQuestions: Question[] = questions.map(q => ({
          ...q,
          libraryId,
          createdAt: new Date()
        }))
        // 如果本地已有题目且云端也有题目，用云端数据覆盖本地
        // 因为刚导入，云端数据一定是最全的
        questionsMap[libraryId] = cachedQuestions.length > totalImported
          ? cachedQuestions
          : newLocalQuestions
        saveLocalQuestions(questionsMap)

        return {
          success: true,
          message: `成功导入 ${totalImported} 道题`,
          data: {
            importedCount: totalImported,
            totalCount: questions.length
          }
        }
      }

      // 全部云端失败，降级到本地
      console.error('所有分片云端导入均失败，降级到本地存储')
    }

    // 本地降级：保存到本地存储
    const questionsMap = getLocalQuestions()
    const localQuestions: Question[] = questions.map(q => ({
      ...q,
      _id: generateLocalId(),
      libraryId,
      createdAt: new Date()
    }))
    questionsMap[libraryId] = localQuestions
    saveLocalQuestions(questionsMap)

    // 更新题库的题目数量
    const localList = getLocalLibraries()
    const libIdx = localList.findIndex(l => l._id === libraryId)
    if (libIdx >= 0) {
      localList[libIdx].totalQuestions = localQuestions.length
      localList[libIdx].updatedAt = new Date()
      saveLocalLibraries(localList)
      libraries.value = localList
    }

    return {
      success: true,
      message: `本地保存 ${localQuestions.length} 道题`,
      data: {
        importedCount: localQuestions.length,
        totalCount: questions.length
      }
    }
  }

  /**
   * 后台静默从云端同步题目，若数据有变化则更新本地缓存并回调通知
   * 不阻塞主流程，失败时静默忽略
   */
  async function syncFromCloud(
    libraryId: string,
    localCount: number,
    onRefresh: (questions: Question[]) => void
  ): Promise<void> {
    try {
      const db = uni.cloud.database()
      const countResult = await db.collection('questions').where({ libraryId }).count()
      const total = countResult.total

      // 题目数量相同 → 大概率无变化，跳过拉取
      if (total === localCount) return

      if (total === 0) return

      // 并行分批拉取
      const MAX_LIMIT = 20
      const batchCount = Math.ceil(total / MAX_LIMIT)
      const batchPromises = Array.from({ length: batchCount }, (_, i) =>
        db.collection('questions').where({ libraryId })
          .skip(i * MAX_LIMIT).limit(MAX_LIMIT).get()
      )
      const batchResults = await Promise.all(batchPromises)
      const cloudQuestions: Question[] = []
      for (const result of batchResults) {
        cloudQuestions.push(...(result.data as Question[]))
      }

      if (cloudQuestions.length > 0 && cloudQuestions.length !== localCount) {
        // 更新本地缓存
        const questionsMap = getLocalQuestions()
        questionsMap[libraryId] = cloudQuestions
        saveLocalQuestions(questionsMap)
        // 通知调用方热更新
        onRefresh(cloudQuestions)
        console.log(`[library] 后台同步完成，题目数 ${localCount} → ${cloudQuestions.length}`)
      }
    } catch (e) {
      console.warn('[library] 后台云同步失败，继续使用本地缓存', e)
    }
  }

  async function getQuestions(libraryId: string, onCloudRefresh?: (questions: Question[]) => void): Promise<Question[]> {
    // 本地优先：有缓存时立即返回，后台静默同步云端最新数据
    const localQuestions = getLocalQuestions()[libraryId]
    const hasLocal = localQuestions && localQuestions.length > 0

    if (hasLocal) {
      // 有本地缓存 → 立即返回，后台异步检查云端更新
      if (isCloudAvailable() && onCloudRefresh) {
        syncFromCloud(libraryId, localQuestions.length, onCloudRefresh)
      }
      return localQuestions
    }

    // 无本地缓存 → 从云端拉取
    if (isCloudAvailable()) {
      try {
        const db = uni.cloud.database()

        // 先查总数
        const countResult = await db.collection('questions').where({ libraryId }).count()
        const total = countResult.total

        if (total === 0) {
          return []
        }

        // 并行分批获取（微信云开发每次最多返回20条）
        const MAX_LIMIT = 20
        const batchCount = Math.ceil(total / MAX_LIMIT)
        const batchPromises = Array.from({ length: batchCount }, (_, i) =>
          db.collection('questions').where({ libraryId })
            .skip(i * MAX_LIMIT).limit(MAX_LIMIT).get()
        )
        const batchResults = await Promise.all(batchPromises)
        const allQuestions: Question[] = []
        for (const result of batchResults) {
          allQuestions.push(...(result.data as Question[]))
        }

        // 同步到本地缓存
        if (allQuestions.length > 0) {
          const questionsMap = getLocalQuestions()
          questionsMap[libraryId] = allQuestions
          saveLocalQuestions(questionsMap)
        } else {
          console.warn(`[library] 题库 ${libraryId} 云端无题目`)
        }
        return allQuestions
      } catch (e) {
        console.error('云开发获取题目失败，使用本地数据', e)
      }
    }

    // 本地降级
    return localQuestions || []
  }

  function setCurrentLibrary(library: Library | null) {
    currentLibrary.value = library
  }

  return {
    libraries,
    currentLibrary,
    loadLibraries,
    createLibrary,
    updateLibrary,
    deleteLibrary,
    importQuestions,
    getQuestions,
    setCurrentLibrary
  }
})