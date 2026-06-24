const CLOUD_ENV_ID = 'cloud1-d6gspphu1758644bc'

/**
 * 检测云开发是否可用
 * 返回 true 表示 uni.cloud 对象存在且已初始化
 */
export function isCloudAvailable(): boolean {
  try {
    return !!uni.cloud && typeof uni.cloud.callFunction === 'function'
  } catch {
    return false
  }
}

/**
 * 检测云开发是否已初始化
 * 通过尝试执行一个简单操作来判断
 */
let cloudInitialized = false

export function markCloudInitialized(): void {
  cloudInitialized = true
}

export function isCloudInitialized(): boolean {
  return cloudInitialized
}

/**
 * 等待云开发初始化完成
 * 用于确保页面 onMounted 中云 API 调用不会因初始化未完成而失败
 * 最多等待 3 秒，超时后不再阻塞
 */
export async function ensureCloudReady(): Promise<void> {
  if (cloudInitialized) return
  // 等待最多 3 秒
  for (let i = 0; i < 30; i++) {
    if (cloudInitialized) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  console.warn('云开发初始化等待超时，继续执行（可能降级到本地模式）')
}

export async function callFunction(name: string, data?: Record<string, any>): Promise<any> {
  if (!isCloudAvailable()) {
    throw new Error('云开发不可用，请检查网络连接或小程序配置')
  }

  return new Promise((resolve, reject) => {
    uni.cloud.callFunction({
      name,
      data: data || {},
      success: (res) => {
        resolve(res.result)
      },
      fail: (err) => {
        console.error(`调用云函数 ${name} 失败`, err)
        reject(err)
      }
    })
  })
}

export async function login(): Promise<{ openid: string }> {
  return new Promise((resolve, reject) => {
    uni.login({
      success: async (loginRes) => {
        try {
          const result = await callFunction('login', { code: loginRes.code })
          if (result.success && result.data?.openid) {
            resolve({ openid: result.data.openid })
          } else {
            reject(new Error('获取 openid 失败'))
          }
        } catch (e) {
          reject(e)
        }
      },
      fail: (err) => {
        console.error('登录失败', err)
        reject(err)
      }
    })
  })
}

export function getCloudEnvId(): string {
  return CLOUD_ENV_ID
}
