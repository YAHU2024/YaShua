import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CustomProvider, ProviderConfig } from '@/types'
import { callFunction, isCloudAvailable, ensureCloudReady } from '@/utils/cloud'

const STORAGE_KEY_ACTIVE = 'ai-active-provider'

/** 内置 Provider 列表（与云函数 PROVIDERS 对应） */
export const BUILTIN_PROVIDERS: { id: string; name: string; isBuiltin: boolean }[] = [
  { id: 'agnes', name: 'Agnes', isBuiltin: true },
  { id: 'deepseek', name: 'DeepSeek', isBuiltin: true }
]

export const useAiSettingsStore = defineStore('aiSettings', () => {
  // 当前选中的 provider id（内置 id 或 'custom_xxx'）
  const activeProviderId = ref('agnes')

  // 用户自定义 Provider 列表（不含 apiKey）
  const customProviders = ref<CustomProvider[]>([])

  // 是否已初始化
  const initialized = ref(false)

  // ============ Computed ============

  /** 所有可用 Provider（内置 + 自定义） */
  const allProviders = computed(() => [
    ...BUILTIN_PROVIDERS,
    ...customProviders.value.map(p => ({ id: p.id, name: p.name, isBuiltin: false }))
  ])

  /** 当前选中 Provider 的显示名称 */
  const currentProviderName = computed(() => {
    const found = allProviders.value.find(p => p.id === activeProviderId.value)
    return found?.name || 'Agnes'
  })

  /** 当前选中 Provider 是否为自定义 */
  const isCustomActive = computed(() => {
    return customProviders.value.some(p => p.id === activeProviderId.value)
  })

  // ============ 初始化 ============

  async function init() {
    if (initialized.value) return

    // 读取本地持久化的选中偏好
    try {
      const saved = uni.getStorageSync(STORAGE_KEY_ACTIVE)
      if (saved) {
        activeProviderId.value = saved
      }
    } catch {
      // 读取失败保持默认
    }

    // 从云DB拉取自定义 Provider 列表
    await loadCustomProviders()

    // 如果当前选中的自定义 Provider 已不存在，回退到默认
    if (activeProviderId.value.startsWith('custom_') &&
        !customProviders.value.some(p => p.id === activeProviderId.value)) {
      activeProviderId.value = 'agnes'
      persistActiveProvider()
    }

    initialized.value = true
  }

  // ============ 持久化 ============

  function persistActiveProvider() {
    try {
      uni.setStorageSync(STORAGE_KEY_ACTIVE, activeProviderId.value)
    } catch {
      console.warn('[AiSettings] 持久化选中 Provider 失败')
    }
  }

  // ============ 自定义 Provider CRUD ============

  /** 从云DB加载自定义 Provider 列表 */
  async function loadCustomProviders() {
    if (!isCloudAvailable()) return
    try {
      await ensureCloudReady()
      const result = await callFunction('aiParse', { action: 'getProviderConfigs' })
      if (result?.success && result.data?.providers) {
        customProviders.value = result.data.providers as CustomProvider[]
      }
    } catch (e) {
      console.warn('[AiSettings] 加载自定义 Provider 失败:', (e as Error).message)
    }
  }

  /** 添加自定义 Provider */
  async function addCustomProvider(data: {
    name: string
    apiUrl: string
    model: string
    apiKey: string
  }): Promise<boolean> {
    if (!isCloudAvailable()) {
      throw new Error('云开发不可用')
    }

    const providerId = `custom_${Date.now()}`

    const result = await callFunction('aiParse', {
      action: 'saveProviderConfig',
      providerId,
      name: data.name,
      apiUrl: data.apiUrl,
      model: data.model,
      apiKey: data.apiKey
    })

    if (result?.success) {
      // 添加到本地列表（不含 apiKey）
      customProviders.value.push({
        id: providerId,
        name: data.name,
        apiUrl: data.apiUrl,
        model: data.model,
        hasApiKey: true
      })
      return true
    }
    return false
  }

  /** 更新自定义 Provider */
  async function updateCustomProvider(
    providerId: string,
    data: {
      name: string
      apiUrl: string
      model: string
      apiKey?: string  // 可选，传入则更新
    }
  ): Promise<boolean> {
    if (!isCloudAvailable()) {
      throw new Error('云开发不可用')
    }

    const result = await callFunction('aiParse', {
      action: 'saveProviderConfig',
      providerId,
      name: data.name,
      apiUrl: data.apiUrl,
      model: data.model,
      ...(data.apiKey ? { apiKey: data.apiKey } : {})
    })

    if (result?.success) {
      const idx = customProviders.value.findIndex(p => p.id === providerId)
      if (idx >= 0) {
        customProviders.value[idx] = {
          ...customProviders.value[idx],
          name: data.name,
          apiUrl: data.apiUrl,
          model: data.model,
          hasApiKey: true
        }
      }
      return true
    }
    return false
  }

  /** 删除自定义 Provider */
  async function deleteCustomProvider(providerId: string): Promise<boolean> {
    if (!isCloudAvailable()) {
      throw new Error('云开发不可用')
    }

    const result = await callFunction('aiParse', {
      action: 'deleteProviderConfig',
      providerId
    })

    if (result?.success) {
      customProviders.value = customProviders.value.filter(p => p.id !== providerId)
      // 如果删除的是当前选中的，回退到默认
      if (activeProviderId.value === providerId) {
        setActiveProvider('agnes')
      }
      return true
    }
    return false
  }

  // ============ 选中管理 ============

  function setActiveProvider(id: string) {
    activeProviderId.value = id
    persistActiveProvider()
  }

  // ============ 对外接口：生成传给云函数的 ProviderConfig ============

  function getProviderConfig(): ProviderConfig {
    // 内置模型
    const builtin = BUILTIN_PROVIDERS.find(p => p.id === activeProviderId.value)
    if (builtin) {
      return { id: builtin.id }
    }

    // 自定义模型
    const custom = customProviders.value.find(p => p.id === activeProviderId.value)
    if (custom) {
      return {
        custom: {
          providerId: custom.id,
          apiUrl: custom.apiUrl,
          model: custom.model
        }
      }
    }

    // 兜底
    return { id: 'agnes' }
  }

  return {
    activeProviderId,
    customProviders,
    allProviders,
    currentProviderName,
    isCustomActive,
    init,
    setActiveProvider,
    addCustomProvider,
    updateCustomProvider,
    deleteCustomProvider,
    getProviderConfig,
    loadCustomProviders
  }
})
