import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type ThemeMode = 'light' | 'dark'
export type UserPreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme-preference'

// tabBar 主题色（与 theme.json 保持一致）
const TAB_BAR_LIGHT = {
  color: '#999999',
  selectedColor: '#4A47A3',
  backgroundColor: '#ffffff'
}
const TAB_BAR_DARK = {
  color: '#808080',
  selectedColor: '#7B78D2',
  backgroundColor: '#1E1E1E'
}

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

    // 同步 tabBar 样式（theme.json 仅响应系统级主题变化，手动切换需 API 更新）
    syncTabBarStyle()
    watch(isDark, syncTabBarStyle)
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

  /** 根据当前 isDark 动态更新 tabBar 样式 */
  function syncTabBarStyle() {
    try {
      const style = isDark.value ? TAB_BAR_DARK : TAB_BAR_LIGHT
      uni.setTabBarStyle(style)
    } catch {
      // tabBar 不存在时静默降级（如非 tabBar 页面）
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
