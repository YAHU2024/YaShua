<template>
  <ThemeWrapper>
  <view class="page">
    <NavBar title="设置" />
    
    <view class="content">
      <view class="section">
        <view class="section-title">外观设置</view>
        <view class="setting-list">
          <view class="setting-item" @click="setThemeMode">
            <view class="setting-info">
              <text class="setting-label">深色模式</text>
              <text class="setting-value">{{ themePreferenceLabel }}</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-title">关于</view>
        <view class="setting-list">
          <view class="setting-item" @click="showAbout">
            <view class="setting-info">
              <text class="setting-label">版本信息</text>
              <text class="setting-value">v1.0.0</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
          <view class="setting-item" @click="showFeedback">
            <view class="setting-info">
              <text class="setting-label">意见反馈</text>
              <text class="setting-value">帮助我们改进</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
          <view class="setting-item" @click="showPrivacy">
            <view class="setting-info">
              <text class="setting-label">隐私政策</text>
              <text class="setting-value"></text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-title">学习设置</view>
        <view class="setting-list">
          <view class="setting-item" @click="setDailyGoal">
            <view class="setting-info">
              <text class="setting-label">每日目标</text>
              <text class="setting-value">{{ statsStore.dailyGoal }} 题/天</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
        </view>
      </view>

      <!-- AI 模型设置 -->
      <view class="section">
        <view class="section-title">AI 模型</view>
        <view class="setting-list">
          <view class="setting-item" @click="showModelPicker">
            <view class="setting-info">
              <text class="setting-label">当前模型</text>
              <text class="setting-value">{{ aiSettings.currentProviderName }}</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
          <view class="setting-item" @click="openProviderManager">
            <view class="setting-info">
              <text class="setting-label">自定义 Provider</text>
              <text class="setting-value">{{ aiSettings.customProviders.length }} 个已配置</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-title">数据管理</view>
        <view class="setting-list">
          <view class="setting-item" @click="clearCache">
            <view class="setting-info">
              <text class="setting-label">清除缓存</text>
              <text class="setting-value">清理本地数据</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-title">联系我们</view>
        <view class="setting-list">
          <view class="setting-item" @click="contactUs">
            <view class="setting-info">
              <text class="setting-label">联系客服</text>
              <text class="setting-value">获取帮助</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
        </view>
      </view>

      <view class="footer">
        <text class="footer-text">雅刷 · 轻松学习</text>
        <text class="footer-copyright">© 2024 All Rights Reserved</text>
      </view>
    </view>

    <!-- 自定义 Provider 管理弹窗 -->
    <view v-if="showManagerModal" class="modal-overlay" @click="closeManagerModal">
      <view class="modal-content provider-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">自定义 Provider</text>
          <view class="modal-close" @click="closeManagerModal">×</view>
        </view>
        <view class="modal-body">
          <view v-if="aiSettings.customProviders.length > 0" class="provider-list">
            <view
              v-for="p in aiSettings.customProviders"
              :key="p.id"
              class="provider-item"
            >
              <view class="provider-info" @click="editProvider(p)">
                <text class="provider-name">{{ p.name }}</text>
                <text class="provider-detail">{{ p.model }} · {{ maskUrl(p.apiUrl) }}</text>
              </view>
              <view class="provider-actions">
                <text class="provider-action edit" @click="editProvider(p)">编辑</text>
                <text class="provider-action delete" @click="confirmDeleteProvider(p)">删除</text>
              </view>
            </view>
          </view>
          <view v-else class="provider-empty">
            <text class="empty-text">暂无自定义 Provider</text>
            <text class="empty-hint">添加自定义 AI 服务，支持 OpenAI 兼容 API</text>
          </view>
        </view>
        <view class="modal-footer">
          <BaseButton variant="primary" size="md" block @click="openAddForm">+ 添加 Provider</BaseButton>
        </view>
      </view>
    </view>

    <!-- 添加/编辑 Provider 表单弹窗 -->
    <view v-if="showFormModal" class="modal-overlay" @click="closeFormModal">
      <view class="modal-content form-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editingProvider ? '编辑 Provider' : '添加 Provider' }}</text>
          <view class="modal-close" @click="closeFormModal">×</view>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="form-label">名称</text>
            <input
              class="form-input"
              v-model="formData.name"
              placeholder="如：我的 GPT-4o"
            />
          </view>
          <view class="form-item">
            <text class="form-label">API 端点</text>
            <input
              class="form-input"
              v-model="formData.apiUrl"
              placeholder="https://api.openai.com/v1/chat/completions"
            />
            <text class="form-hint">需兼容 OpenAI Chat Completions 接口</text>
          </view>
          <view class="form-item">
            <text class="form-label">模型</text>
            <input
              class="form-input"
              v-model="formData.model"
              placeholder="如：gpt-4o、deepseek-chat"
            />
          </view>
          <view class="form-item">
            <text class="form-label">API Key</text>
            <input
              class="form-input"
              :password="!showApiKey"
              v-model="formData.apiKey"
              :placeholder="editingProvider ? '已配置，留空保持不变' : 'sk-xxx'"
            />
            <view class="form-extra">
              <text class="form-toggle" @click="showApiKey = !showApiKey">
                {{ showApiKey ? '隐藏' : '显示' }}
              </text>
              <text class="form-hint-inline">API Key 安全存储在云端，不会明文保存在本地</text>
            </view>
          </view>

          <!-- 连通性测试 -->
          <view class="form-item test-section">
            <BaseButton
              variant="secondary"
              size="sm"
              :loading="isTesting"
              :disabled="isTesting || !canTest"
              @click="testConnection"
            >{{ isTesting ? '测试中...' : '测试连通性' }}</BaseButton>
            <view v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
              <text class="test-icon">{{ testResult.success ? '✓' : '✗' }}</text>
              <text class="test-msg">{{ testResult.message }}</text>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <BaseButton variant="secondary" size="md" class="footer-btn" @click="closeFormModal">取消</BaseButton>
          <BaseButton
            variant="primary"
            size="md"
            class="footer-btn"
            :loading="isSaving"
            :disabled="isSaving"
            @click="saveProvider"
          >{{ isSaving ? '保存中...' : '保存' }}</BaseButton>
        </view>
      </view>
    </view>
  </view>
  </ThemeWrapper>
</template>

<script setup lang="ts">
import ThemeWrapper from '@/components/ThemeWrapper.vue'
import NavBar from '@/components/NavBar.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useStatsStore } from '@/stores/stats'
import { useThemeStore } from '@/stores/theme'
import { useAiSettingsStore, BUILTIN_PROVIDERS } from '@/stores/aiSettings'
import { callFunction } from '@/utils/cloud'
import { computed, ref, reactive, onMounted } from 'vue'
import type { CustomProvider } from '@/types'

const statsStore = useStatsStore()
const themeStore = useThemeStore()
const aiSettings = useAiSettingsStore()

onMounted(() => {
  aiSettings.init()
})

const themePreferenceLabel = computed(() => themeStore.getPreferenceLabel())

// ============ 外观 / 学习 / 其他设置 ============

function setThemeMode() {
  uni.showActionSheet({
    itemList: ['跟随系统', '浅色模式', '深色模式'],
    success: (res) => {
      const prefs: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark']
      themeStore.setPreference(prefs[res.tapIndex])
      uni.showToast({ title: '设置成功', icon: 'success' })
    }
  })
}

function setDailyGoal() {
  uni.showActionSheet({
    itemList: ['10 题/天', '20 题/天', '30 题/天', '50 题/天', '100 题/天'],
    success: (res) => {
      const goals = [10, 20, 30, 50, 100]
      statsStore.setDailyGoal(goals[res.tapIndex])
      uni.showToast({ title: '设置成功', icon: 'success' })
    }
  })
}

function showAbout() {
  uni.showModal({
    title: '版本信息',
    content: '雅刷 v1.0.0\n\n一款帮助你高效学习的刷题小程序',
    showCancel: false
  })
}

function showFeedback() {
  uni.showToast({ title: '感谢你的反馈', icon: 'none' })
}

function showPrivacy() {
  uni.showModal({
    title: '隐私政策',
    content: '我们重视你的隐私安全。\n\n1. 用户数据仅存储在微信云开发平台\n2. 不会向第三方分享你的个人信息\n3. 所有数据传输均经过加密处理',
    showCancel: false
  })
}

function clearCache() {
  uni.showModal({
    title: '清除缓存',
    content: '确定要清除本地缓存吗？刷题进度将会丢失。',
    success: (res) => {
      if (res.confirm) {
        try {
          uni.clearStorageSync()
          uni.showToast({ title: '清除成功', icon: 'success' })
        } catch (e) {
          uni.showToast({ title: '清除失败', icon: 'none' })
        }
      }
    }
  })
}

function contactUs() {
  uni.showToast({ title: '客服：support@example.com', icon: 'none', duration: 3000 })
}

// ============ AI 模型选择 ============

function showModelPicker() {
  const providers = aiSettings.allProviders
  const itemList = providers.map(p => {
    const suffix = p.id === aiSettings.activeProviderId ? '（当前）' : ''
    return `${p.name}${suffix}`
  })

  uni.showActionSheet({
    itemList,
    success: (res) => {
      const selected = providers[res.tapIndex]
      aiSettings.setActiveProvider(selected.id)
      uni.showToast({ title: `已切换到 ${selected.name}`, icon: 'success' })
    }
  })
}

// ============ 自定义 Provider 管理 ============

const showManagerModal = ref(false)
const showFormModal = ref(false)
const editingProvider = ref<CustomProvider | null>(null)
const isSaving = ref(false)
const showApiKey = ref(false)

// 连通性测试
const isTesting = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

const canTest = computed(() => {
  return formData.apiUrl.trim() && formData.model.trim() && formData.apiKey.trim()
})

async function testConnection() {
  testResult.value = null
  isTesting.value = true
  try {
    const result = await callFunction('aiParse', {
      action: 'testProvider',
      apiUrl: formData.apiUrl.trim(),
      model: formData.model.trim(),
      apiKey: formData.apiKey.trim()
    })
    testResult.value = {
      success: result?.success ?? false,
      message: result?.message || '未知错误'
    }
  } catch (e: any) {
    testResult.value = { success: false, message: e.message || '测试请求失败' }
  } finally {
    isTesting.value = false
  }
}

const formData = reactive({
  name: '',
  apiUrl: '',
  model: '',
  apiKey: ''
})

function openProviderManager() {
  showManagerModal.value = true
}

function closeManagerModal() {
  showManagerModal.value = false
}

function openAddForm() {
  editingProvider.value = null
  formData.name = ''
  formData.apiUrl = ''
  formData.model = ''
  formData.apiKey = ''
  showApiKey.value = false
  testResult.value = null
  showFormModal.value = true
}

function editProvider(p: CustomProvider) {
  editingProvider.value = p
  formData.name = p.name
  formData.apiUrl = p.apiUrl
  formData.model = p.model
  formData.apiKey = ''  // 不回填 apiKey
  showApiKey.value = false
  testResult.value = null
  showFormModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  editingProvider.value = null
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}/...`
  } catch {
    return url.length > 30 ? url.substring(0, 30) + '...' : url
  }
}

async function saveProvider() {
  if (!formData.name.trim()) {
    uni.showToast({ title: '请输入名称', icon: 'none' })
    return
  }
  if (!formData.apiUrl.trim()) {
    uni.showToast({ title: '请输入 API 端点', icon: 'none' })
    return
  }
  if (!formData.model.trim()) {
    uni.showToast({ title: '请输入模型名称', icon: 'none' })
    return
  }

  isSaving.value = true
  try {
    if (editingProvider.value) {
      // 编辑模式
      const data: any = {
        name: formData.name.trim(),
        apiUrl: formData.apiUrl.trim(),
        model: formData.model.trim()
      }
      if (formData.apiKey.trim()) {
        data.apiKey = formData.apiKey.trim()
      }
      const ok = await aiSettings.updateCustomProvider(editingProvider.value.id, data)
      if (ok) {
        uni.showToast({ title: '更新成功', icon: 'success' })
        closeFormModal()
      } else {
        uni.showToast({ title: '更新失败', icon: 'none' })
      }
    } else {
      // 新增模式
      if (!formData.apiKey.trim()) {
        uni.showToast({ title: '请输入 API Key', icon: 'none' })
        return
      }
      const ok = await aiSettings.addCustomProvider({
        name: formData.name.trim(),
        apiUrl: formData.apiUrl.trim(),
        model: formData.model.trim(),
        apiKey: formData.apiKey.trim()
      })
      if (ok) {
        uni.showToast({ title: '添加成功', icon: 'success' })
        closeFormModal()
      } else {
        uni.showToast({ title: '添加失败', icon: 'none' })
      }
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
  } finally {
    isSaving.value = false
  }
}

function confirmDeleteProvider(p: CustomProvider) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除 Provider「${p.name}」吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          const ok = await aiSettings.deleteCustomProvider(p.id)
          if (ok) {
            uni.showToast({ title: '已删除', icon: 'success' })
          } else {
            uni.showToast({ title: '删除失败', icon: 'none' })
          }
        } catch (e: any) {
          uni.showToast({ title: e.message || '删除失败', icon: 'none' })
        }
      }
    }
  })
}
</script>

<style lang="scss" scoped>
@import '@/styles/tokens/_index.scss';

.page {
  min-height: 100vh;
  background: var(--color-bg-page);
}

.content {
  padding: $space-xl;
}

.section {
  background: var(--color-bg-card);
  border-radius: $radius-xl;
  margin-bottom: $section-gap;
  overflow: hidden;
}

.section-title {
  padding: $space-lg $space-xl;
  font-size: $font-size-base;
  font-weight: $font-weight-semibold;
  color: var(--color-text-tertiary);
  background: var(--color-bg-input);
}

.setting-list {
  padding: 0 $space-md;
}

.setting-item {
  display: flex;
  align-items: center;
  padding: $space-lg $space-sm;
  border-bottom: 1rpx solid var(--color-border-base);

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background: var(--color-bg-input);
  }
}

.setting-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-label {
  font-size: $font-size-lg;
  color: var(--color-text-primary);
}

.setting-value {
  font-size: $font-size-base;
  color: var(--color-text-tertiary);
}

.setting-arrow {
  font-size: $font-size-xl;
  color: var(--color-text-disabled);
  margin-left: $space-sm;
}

.footer {
  text-align: center;
  padding: 80rpx $space-xl;
}

.footer-text {
  display: block;
  font-size: $font-size-base;
  color: var(--color-text-secondary);
  margin-bottom: $space-sm;
}

.footer-copyright {
  font-size: $font-size-sm;
  color: var(--color-text-tertiary);
}

// ============ 弹窗通用 ============
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  width: 85%;
  max-height: 80vh;
  background: var(--color-bg-card);
  border-radius: $radius-xl;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $space-lg $space-xl;
  border-bottom: 1rpx solid var(--color-border-base);
}

.modal-title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
}

.modal-close {
  font-size: 48rpx;
  color: var(--color-text-disabled);
  padding: 0 $space-sm;
}

.modal-body {
  padding: $space-lg $space-xl;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  gap: $space-md;
  padding: $space-md $space-xl $space-lg;
  border-top: 1rpx solid var(--color-border-base);
}

.footer-btn {
  flex: 1;
}

// ============ Provider 管理弹窗 ============
.provider-modal {
  max-height: 70vh;
}

.provider-list {
  display: flex;
  flex-direction: column;
  gap: $space-md;
}

.provider-item {
  display: flex;
  align-items: center;
  padding: $space-md;
  background: var(--color-bg-input);
  border-radius: $radius-lg;
}

.provider-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  overflow: hidden;
}

.provider-name {
  font-size: $font-size-base;
  font-weight: $font-weight-medium;
  color: var(--color-text-primary);
}

.provider-detail {
  font-size: $font-size-xs;
  color: var(--color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-actions {
  display: flex;
  gap: $space-sm;
  flex-shrink: 0;
  margin-left: $space-md;
}

.provider-action {
  font-size: $font-size-xs;
  padding: $space-xs $space-md;
  border-radius: 12rpx;

  &.edit {
    color: var(--color-primary);
    background: var(--color-primary-light);
  }

  &.delete {
    color: var(--color-error);
    background: rgba(255, 59, 48, 0.1);
  }
}

.provider-empty {
  text-align: center;
  padding: 60rpx 0;
}

.empty-text {
  display: block;
  font-size: $font-size-base;
  color: var(--color-text-secondary);
  margin-bottom: $space-sm;
}

.empty-hint {
  display: block;
  font-size: $font-size-sm;
  color: var(--color-text-tertiary);
}

// ============ 表单弹窗 ============
.form-modal {
  max-height: 85vh;
}

.form-item {
  margin-bottom: $space-lg;
}

.form-label {
  display: block;
  font-size: $font-size-base;
  color: var(--color-text-primary);
  font-weight: $font-weight-medium;
  margin-bottom: $space-sm;
}

.form-input {
  width: 100%;
  padding: $space-md;
  border: 2rpx solid var(--color-border-input);
  border-radius: $radius-md;
  font-size: $font-size-base;
  color: var(--color-text-primary);
  background: var(--color-bg-card);
}

.form-hint {
  display: block;
  font-size: $font-size-xs;
  color: var(--color-text-tertiary);
  margin-top: $space-xs;
}

.form-extra {
  display: flex;
  align-items: center;
  gap: $space-sm;
  margin-top: $space-xs;
}

.form-toggle {
  font-size: $font-size-xs;
  color: var(--color-primary);
  flex-shrink: 0;
}

.form-hint-inline {
  font-size: $font-size-xs;
  color: var(--color-text-tertiary);
}

// ============ 连通性测试 ============
.test-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: $space-sm;
}

.test-result {
  display: flex;
  align-items: center;
  gap: $space-xs;
  padding: $space-sm $space-md;
  border-radius: $radius-md;
  width: 100%;

  &.success {
    background: rgba(52, 199, 89, 0.1);
    color: #34c759;
  }

  &.error {
    background: rgba(255, 59, 48, 0.1);
    color: #ff3b30;
  }
}

.test-icon {
  font-size: $font-size-lg;
  font-weight: bold;
  flex-shrink: 0;
}

.test-msg {
  font-size: $font-size-sm;
  flex: 1;
}
</style>
