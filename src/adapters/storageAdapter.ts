// === 集合引用接口 ===

export interface IQueryResult {
  data: any[]
  errMsg?: string
}

export interface IAddResult {
  _id: string
  errMsg?: string
}

export interface IUpdateResult {
  stats: { updated: number }
  errMsg?: string
}

export interface IRemoveResult {
  stats: { removed: number }
  errMsg?: string
}

export interface IFilteredRef {
  get(): Promise<IQueryResult>
  remove(): Promise<IRemoveResult>
}

export interface IDocRef {
  get(): Promise<IQueryResult>
  update(data: any): Promise<IUpdateResult>
  remove(): Promise<IRemoveResult>
}

export interface ICollectionRef {
  get(): Promise<IQueryResult>
  add(data: any): Promise<IAddResult>
  doc(id: string): IDocRef
  where(condition: any): IFilteredRef
}

// === 主接口 ===

export interface IStorageAdapter {
  getCollection(name: string): ICollectionRef
  callFunction(name: string, data: Record<string, any>): Promise<any>
  getOpenid(): string | null
  isCloudAvailable(): boolean
}

// === UUID 生成 ===

function generateLocalId(): string {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// === CloudAdapter ===

class CloudAdapter implements IStorageAdapter {
  isCloudAvailable(): boolean {
    return true
  }

  getOpenid(): string | null {
    // CloudAdapter 不负责获取 openid，由 user store 管理
    return null
  }

  getCollection(name: string): ICollectionRef {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (uni as any).cloud.database()
    const collection = db.collection(name)

    return {
      async get(): Promise<IQueryResult> {
        try {
          const result = await collection.get()
          return { data: result.data || [] }
        } catch (e: any) {
          console.error(`CloudAdapter.get(${name}) 失败`, e)
          return { data: [], errMsg: e.message }
        }
      },

      async add(data: any): Promise<IAddResult> {
        const result = await collection.add(data)
        return { _id: result._id }
      },

      doc(id: string): IDocRef {
        const docRef = collection.doc(id)
        return {
          async get(): Promise<IQueryResult> {
            try {
              const result = await docRef.get()
              return { data: result.data || [] }
            } catch (e: any) {
              console.error(`CloudAdapter.doc(${id}).get() 失败`, e)
              return { data: [], errMsg: e.message }
            }
          },

          async update(data: any): Promise<IUpdateResult> {
            const result = await docRef.update(data)
            return { stats: { updated: result.stats?.updated || 1 } }
          },

          async remove(): Promise<IRemoveResult> {
            const result = await docRef.remove()
            return { stats: { removed: result.stats?.removed || 1 } }
          }
        }
      },

      where(condition: any): IFilteredRef {
        const filtered = collection.where(condition)
        return {
          async get(): Promise<IQueryResult> {
            const result = await filtered.get()
            return { data: result.data || [] }
          },

          async remove(): Promise<IRemoveResult> {
            const result = await filtered.remove()
            return { stats: { removed: result.stats?.removed || 0 } }
          }
        }
      }
    }
  }

  async callFunction(name: string, data: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      (uni as any).cloud.callFunction({
        name,
        data: data || {},
        success: (res: any) => resolve(res.result),
        fail: (err: any) => {
          console.error(`调用云函数 ${name} 失败`, err)
          reject(err)
        }
      })
    })
  }
}

// === LocalAdapter ===

class LocalAdapter implements IStorageAdapter {
  isCloudAvailable(): boolean {
    return false
  }

  getOpenid(): string | null {
    return getLocalUserId()
  }

  getCollection(name: string): ICollectionRef {
    const storageKey = `local_${name}`
    const self = this

    function readAll(): any[] {
      try {
        const raw = uni.getStorageSync(storageKey)
        return raw ? JSON.parse(raw) : []
      } catch (e) {
        console.error(`LocalAdapter 读取 ${storageKey} 失败`, e)
        return []
      }
    }

    function writeAll(items: any[]): void {
      try {
        uni.setStorageSync(storageKey, JSON.stringify(items))
      } catch (e) {
        console.error(`LocalAdapter 写入 ${storageKey} 失败`, e)
      }
    }

    function matchCondition(item: any, condition: any): boolean {
      for (const key of Object.keys(condition)) {
        if (item[key] !== condition[key]) return false
      }
      return true
    }

    return {
      async get(): Promise<IQueryResult> {
        const data = readAll()
        return { data }
      },

      async add(data: any): Promise<IAddResult> {
        const items = readAll()
        const _id = data._id || generateLocalId()
        const newItem = { ...data, _id }
        items.push(newItem)
        writeAll(items)
        return { _id }
      },

      doc(id: string): IDocRef {
        return {
          async get(): Promise<IQueryResult> {
            const items = readAll()
            const item = items.find((i: any) => i._id === id)
            return { data: item ? [item] : [] }
          },

          async update(data: any): Promise<IUpdateResult> {
            const items = readAll()
            const idx = items.findIndex((i: any) => i._id === id)
            if (idx !== -1) {
              items[idx] = { ...items[idx], ...data }
              writeAll(items)
              return { stats: { updated: 1 } }
            }
            return { stats: { updated: 0 } }
          },

          async remove(): Promise<IRemoveResult> {
            const items = readAll()
            const idx = items.findIndex((i: any) => i._id === id)
            if (idx !== -1) {
              items.splice(idx, 1)
              writeAll(items)
              return { stats: { removed: 1 } }
            }
            return { stats: { removed: 0 } }
          }
        }
      },

      where(condition: any): IFilteredRef {
        return {
          async get(): Promise<IQueryResult> {
            const items = readAll()
            const filtered = items.filter((item: any) => matchCondition(item, condition))
            return { data: filtered }
          },

          async remove(): Promise<IRemoveResult> {
            const items = readAll()
            const remaining: any[] = []
            let removed = 0
            for (const item of items) {
              if (matchCondition(item, condition)) {
                removed++
              } else {
                remaining.push(item)
              }
            }
            writeAll(remaining)
            return { stats: { removed } }
          }
        }
      }
    }
  }

  async callFunction(name: string, data: Record<string, any>): Promise<any> {
    if (name === 'importQuestions') {
      const { libraryId, questions } = data
      if (!libraryId || !questions || !Array.isArray(questions)) {
        return { success: false, message: '参数错误' }
      }
      if (questions.length === 0) {
        return { success: false, message: '题目列表为空' }
      }

      const questionsCollection = this.getCollection('questions')
      let importedCount = 0

      for (const question of questions) {
        if (!question.content || !question.answer) {
          continue
        }
        await questionsCollection.add({
          ...question,
          answer: Array.isArray(question.answer) ? question.answer : [question.answer],
          libraryId,
          createdAt: new Date()
        })
        importedCount++
      }

      // 更新题库总数
      const libCollection = this.getCollection('libraries')
      const libResult = await libCollection.doc(libraryId).get()
      if (libResult.data.length > 0) {
        const lib = libResult.data[0]
        await libCollection.doc(libraryId).update({
          totalQuestions: (lib.totalQuestions || 0) + importedCount,
          updatedAt: new Date()
        })
      }

      return {
        success: true,
        message: `成功导入 ${importedCount} 道题`,
        data: {
          importedCount,
          totalCount: questions.length
        }
      }
    }

    // 其他云函数在本地模式下返回空结果
    console.warn(`LocalAdapter: 云函数 ${name} 不可用`)
    return { success: false, message: '云函数不可用（离线模式）' }
  }
}

// === 工厂函数 ===

export function createStorageAdapter(): IStorageAdapter {
  try {
    // 使用 wx.cloud 而非 uni.cloud 来判断云开发是否真正可用
    // uni.cloud 是 uni-app 的包装器，即使底层 WeChat 云 SDK 未注入也可能存在
    // 基础库 3.x 在某些情况下不会自动注入云 SDK（如游客模式），此时应降级为本地存储
    // 注意：IDE 可能提供 wx.cloud 桩代码（有 database 方法但 version 为 undefined），
    // 必须同时检查 wx.cloud.version 确保云 SDK 已真正加载
    if (typeof wx !== 'undefined' && wx.cloud && wx.cloud.version && typeof wx.cloud.database === 'function') {
      return new CloudAdapter()
    }
  } catch (e) {
    console.warn('云开发不可用，降级为本地存储', e)
  }
  console.log('[storageAdapter] 云开发不可用，使用本地存储模式')
  return new LocalAdapter()
}

export const storageAdapter: IStorageAdapter = createStorageAdapter()

// === 本地用户 ID 工具 ===

function getLocalUserId(): string {
  const key = 'local_userId'
  try {
    let userId = uni.getStorageSync(key)
    if (!userId) {
      userId = generateLocalId()
      uni.setStorageSync(key, userId)
    }
    return userId
  } catch (e) {
    const fallback = generateLocalId()
    uni.setStorageSync(key, fallback)
    return fallback
  }
}

export { getLocalUserId }
