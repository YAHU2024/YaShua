import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login } from '@/utils/cloud'
import { setOpenid, getOpenid, getLocalUserId } from '@/utils/storage'

export const useUserStore = defineStore('user', () => {
  const openid = ref<string | null>(getOpenid())
  const isLoggedIn = ref(false)
  const isOffline = ref(false)

  /**
   * 登录：先尝试云登录，失败则降级为本地模式
   */
  async function doLogin() {
    try {
      const result = await login()
      openid.value = result.openid
      isLoggedIn.value = true
      isOffline.value = false
      setOpenid(result.openid)
      return true
    } catch (e) {
      // 云登录失败，降级为本地模式
      console.warn('云登录失败，降级为本地模式', e)
      isOffline.value = true
      isLoggedIn.value = true
      openid.value = null
      return true
    }
  }

  function logout() {
    openid.value = null
    isLoggedIn.value = false
    isOffline.value = false
    setOpenid('')
  }

  /**
   * 获取用户 ID：优先返回 openid，否则返回本地用户标识
   */
  function getUserId(): string {
    return openid.value || getLocalUserId()
  }

  return {
    openid,
    isLoggedIn,
    isOffline,
    doLogin,
    logout,
    getUserId
  }
})
