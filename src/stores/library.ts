import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Library, Question } from '@/types'
import { storageAdapter } from '@/adapters/storageAdapter'

export const useLibraryStore = defineStore('library', () => {
  const libraries = ref<Library[]>([])
  const currentLibrary = ref<Library | null>(null)

  async function loadLibraries() {
    try {
      const result = await storageAdapter.getCollection('libraries').get()
      libraries.value = result.data as Library[]
    } catch (e) {
      console.error('加载题库失败', e)
    }
  }

  async function createLibrary(name: string, description?: string) {
    try {
      const result = await storageAdapter.getCollection('libraries').add({
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
      await storageAdapter.getCollection('libraries').doc(id).update({
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
      await storageAdapter.getCollection('libraries').doc(id).remove()
      await storageAdapter.getCollection('questions').where({ libraryId: id }).remove()
      await loadLibraries()
      return true
    } catch (e) {
      console.error('删除题库失败', e)
      return false
    }
  }

  async function importQuestions(libraryId: string, questions: Question[], openid: string) {
    try {
      const result = await storageAdapter.callFunction('importQuestions', {
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
      const result = await storageAdapter.getCollection('questions').where({ libraryId }).get()
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
