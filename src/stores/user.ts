import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login, isCloudAvailable } from '@/utils/cloud'
import { setOpenid, getOpenid } from '@/utils/storage'

// 本地匿名 ID 前缀
const LOCAL_USER_KEY = 'local_user_id'

function getOrCreateLocalUserId(): string {
  try {
    const existing = uni.getStorageSync(LOCAL_USER_KEY)
    if (existing) return existing
    const newId = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    uni.setStorageSync(LOCAL_USER_KEY, newId)
    return newId
  } catch {
    return 'local_anonymous'
  }
}

export const useUserStore = defineStore('user', () => {
  const openid = ref<string | null>(getOpenid())
  const isLoggedIn = ref(false)
  const isLocalMode = ref(false) // 标记是否为本地模式

  // Promise 级互斥锁：防止 App.vue onLaunch 和首页 onMounted 并发调用 doLogin
  // 导致两次 uni.login() + 两次 callFunction('login') 同时执行
  let loginPromise: Promise<boolean> | null = null

  async function doLogin() {
    if (loginPromise) return loginPromise
    loginPromise = _doLoginInternal()
    try {
      return await loginPromise
    } finally {
      loginPromise = null
    }
  }

  async function _doLoginInternal(): Promise<boolean> {
    if (isCloudAvailable()) {
      try {
        const result = await login()
        openid.value = result.openid
        isLoggedIn.value = true
        isLocalMode.value = false
        setOpenid(result.openid)
        return true
      } catch (e) {
        console.error('云登录失败，切换到本地模式', e)
      }
    }

    // 本地降级：使用本地生成的匿名 ID
    const localId = getOrCreateLocalUserId()
    openid.value = localId
    isLoggedIn.value = true
    isLocalMode.value = true
    setOpenid(localId)
    console.log('本地模式：使用匿名 ID', localId)
    return true
  }

  function logout() {
    openid.value = null
    isLoggedIn.value = false
    isLocalMode.value = false
    setOpenid('')
  }

  function getUserId() {
    return openid.value || getOrCreateLocalUserId()
  }

  return {
    openid,
    isLoggedIn,
    isLocalMode,
    doLogin,
    logout,
    getUserId
  }
})