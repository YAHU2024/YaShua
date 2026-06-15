export async function callFunction(name: string, data?: Record<string, any>): Promise<any> {
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