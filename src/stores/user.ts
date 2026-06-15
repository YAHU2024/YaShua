import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login } from '@/utils/cloud'
import { setOpenid, getOpenid } from '@/utils/storage'

export const useUserStore = defineStore('user', () => {
  const openid = ref<string | null>(getOpenid())
  const isLoggedIn = ref(false)

  async function doLogin() {
    try {
      const result = await login()
      openid.value = result.openid
      isLoggedIn.value = true
      setOpenid(result.openid)
      return true
    } catch (e) {
      console.error('登录失败', e)
      return false
    }
  }

  function logout() {
    openid.value = null
    isLoggedIn.value = false
    setOpenid('')
  }

  function getUserId() {
    return openid.value || 'anonymous'
  }

  return {
    openid,
    isLoggedIn,
    doLogin,
    logout,
    getUserId
  }
})