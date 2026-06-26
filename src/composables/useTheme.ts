import { computed, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'
import type { UserPreference } from '@/stores/theme'

/** Canvas 绘制 / 动态内联样式用的颜色对象 */
export interface ThemeColors {
  primary: string
  primaryDark: string
  secondary: string
  gradientStart: string
  gradientMid: string
  gradientEnd: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  bgPage: string
  bgCard: string
  bgInput: string
  success: string
  error: string
  warning: string
  borderBase: string
  // CircularProgress 专用
  ringBg: string
  glowDot: string
  glowOuter: string
}

export function useTheme() {
  const themeStore = useThemeStore()

  const isDark = computed(() => themeStore.isDark)
  const userPreference = computed(() => themeStore.userPreference)

  /** Canvas 和 JS 动态样式使用的颜色（CSS 变量无法用于 Canvas API） */
  const themeColors = computed<ThemeColors>(() => {
    if (isDark.value) {
      return {
        primary: '#7B78D2',
        primaryDark: '#6B68C2',
        secondary: '#9B6FD4',
        gradientStart: '#7B78D2',
        gradientMid: '#8C84DE',
        gradientEnd: '#9B6FD4',
        textPrimary: '#F0F0F0',
        textSecondary: '#B8B8B8',
        textTertiary: '#808080',
        bgPage: '#121212',
        bgCard: '#1E1E1E',
        bgInput: '#2A2A2A',
        success: '#66BB6A',
        error: '#EF5350',
        warning: '#FFA726',
        borderBase: '#333333',
        // CircularProgress
        ringBg: 'rgba(123, 120, 210, 0.10)',
        glowDot: '#9B6FD4',
        glowOuter: 'rgba(155, 111, 212, 0.3)'
      }
    }
    return {
      primary: '#4A47A3',
      primaryDark: '#3D3A8A',
      secondary: '#7048B6',
      gradientStart: '#4A47A3',
      gradientMid: '#5C4FB0',
      gradientEnd: '#7048B6',
      textPrimary: '#333333',
      textSecondary: '#666666',
      textTertiary: '#999999',
      bgPage: '#F5F5F7',
      bgCard: '#ffffff',
      bgInput: '#f8f9fa',
      success: '#52c41a',
      error: '#ff4d4f',
      warning: '#fa8c16',
      borderBase: '#f0f0f0',
      // CircularProgress
      ringBg: 'rgba(74, 71, 163, 0.08)',
      glowDot: '#7048B6',
      glowOuter: 'rgba(112, 72, 182, 0.3)'
    }
  })

  function setTheme(pref: UserPreference) {
    themeStore.setPreference(pref)
  }

  function toggleTheme() {
    themeStore.toggleDark()
  }

  return {
    isDark,
    userPreference,
    themeColors,
    setTheme,
    toggleTheme
  }
}
