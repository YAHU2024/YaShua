import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Library, Question } from '@/types'
import { callFunction } from '@/utils/cloud'

export const useLibraryStore = defineStore('library', () => {
  const libraries = ref<Library[]>([])
  const currentLibrary = ref<Library | null>(null)

  async function loadLibraries() {
    try {
      const db = uni.cloud.database()
      const result = await db.collection('libraries').get()
      libraries.value = result.data as Library[]
    } catch (e) {
      console.error('加载题库失败', e)
    }
  }

  async function createLibrary(name: string, description?: string) {
    try {
      const db = uni.cloud.database()
      const result = await db.collection('libraries').add({
        name,
        description: description || '',
        totalQuestions: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      await loadLibraries()
      return result._id
    } catch (e) {
      console.error('创建题库失败', e)
      return null
    }
  }

  async function updateLibrary(id: string, name: string, description?: string) {
    try {
      const db = uni.cloud.database()
      await db.collection('libraries').doc(id).update({
        name,
        description: description || '',
        updatedAt: new Date()
      })
      await loadLibraries()
      return true
    } catch (e) {
      console.error('更新题库失败', e)
      return false
    }
  }

  async function deleteLibrary(id: string) {
    try {
      const db = uni.cloud.database()
      await db.collection('libraries').doc(id).remove()
      await db.collection('questions').where({ libraryId: id }).remove()
      await loadLibraries()
      return true
    } catch (e) {
      console.error('删除题库失败', e)
      return false
    }
  }

  async function importQuestions(libraryId: string, questions: Question[], openid: string) {
    try {
      const result = await callFunction('importQuestions', {
        libraryId,
        questions,
        openid
      })
      if (result.success) {
        await loadLibraries()
      }
      return result
    } catch (e) {
      console.error('导入题目失败', e)
      return { success: false, message: '导入失败' }
    }
  }

  async function getQuestions(libraryId: string): Promise<Question[]> {
    try {
      const db = uni.cloud.database()
      const result = await db.collection('questions').where({ libraryId }).get()
      return result.data as Question[]
    } catch (e) {
      console.error('获取题目失败', e)
      return []
    }
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