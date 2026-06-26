import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ThemeMode = 'light' | 'dark'
export type UserPreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme-preference'

export const useThemeStore = defineStore('theme', () => {
  // 用户偏好（'system' = 跟随系统）
  const userPreference = ref<UserPreference>('system')

  // 系统当前是否深色模式
  const systemDark = ref(false)

  // 最终生效的模式
  const isDark = computed(() => {
    if (userPreference.value === 'system') {
      return systemDark.value
    }
    return userPreference.value === 'dark'
  })

  /** 初始化：读取持久化偏好 + 检测系统状态 + 监听系统变化 */
  function init() {
    // 读取持久化的偏好
    try {
      const saved = uni.getStorageSync(STORAGE_KEY)
      if (saved && ['light', 'dark', 'system'].includes(saved)) {
        userPreference.value = saved as UserPreference
      }
    } catch {
      // 读取失败时保持默认 'system'
    }

    // 检测系统深色模式
    detectSystemDarkMode()

    // 监听系统主题变化
    listenSystemChanges()
  }

  function detectSystemDarkMode() {
    try {
      const sysInfo = uni.getSystemInfoSync()
      // osTheme: 'light' | 'dark'（微信小程序）
      systemDark.value = (sysInfo as any).osTheme === 'dark'
    } catch {
      systemDark.value = false
    }
  }

  function listenSystemChanges() {
    try {
      // 微信小程序 API：监听系统主题变化
      if (typeof uni.onThemeChange === 'function') {
        uni.onThemeChange((res: { theme: string }) => {
          systemDark.value = res.theme === 'dark'
        })
      }
    } catch {
      // 不支持时静默降级
    }
  }

  /** 设置偏好并持久化 */
  function setPreference(pref: UserPreference) {
    userPreference.value = pref
    try {
      uni.setStorageSync(STORAGE_KEY, pref)
    } catch {
      console.warn('[Theme] 持久化偏好失败')
    }
  }

  /** 快速切换深色/浅色 */
  function toggleDark() {
    setPreference(isDark.value ? 'light' : 'dark')
  }

  /** 获取偏好显示文本 */
  function getPreferenceLabel(): string {
    const labels: Record<UserPreference, string> = {
      system: '跟随系统',
      light: '浅色模式',
      dark: '深色模式'
    }
    return labels[userPreference.value]
  }

  return {
    userPreference,
    systemDark,
    isDark,
    init,
    setPreference,
    toggleDark,
    getPreferenceLabel
  }
})
