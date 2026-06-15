<template>
  <view class="page">
    <NavBar title="题库管理" show-back />
    
    <view class="content">
      <view class="add-btn" @click="showAddModal = true">
        <text class="add-icon">+</text>
        <text class="add-text">添加题库</text>
      </view>

      <view v-if="libraries.length > 0" class="library-list">
        <view
          v-for="library in libraries"
          :key="library._id"
          class="library-card"
        >
          <view class="library-info" @click="startQuiz(library)">
            <text class="library-name">{{ library.name }}</text>
            <text class="library-desc">{{ library.description || '暂无描述' }}</text>
            <view class="library-meta">
              <text class="meta-item">{{ library.totalQuestions }} 道题</text>
              <text class="meta-divider">·</text>
              <text class="meta-item">{{ formatDate(library.createdAt) }}</text>
            </view>
          </view>
          <view class="library-actions">
            <view class="action-btn edit" @click.stop="editLibrary(library)">
              <text>编辑</text>
            </view>
            <view class="action-btn delete" @click.stop="deleteLibrary(library)">
              <text>删除</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else class="empty-state">
        <text class="empty-icon">📚</text>
        <text class="empty-title">暂无题库</text>
        <text class="empty-desc">点击上方按钮添加题库</text>
      </view>
    </view>

    <view v-if="showAddModal" class="modal-overlay" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editingLibrary ? '编辑题库' : '添加题库' }}</text>
          <text class="modal-close" @click="closeModal">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="form-label">题库名称</text>
            <input
              class="form-input"
              v-model="formData.name"
              placeholder="请输入题库名称"
            />
          </view>
          <view class="form-item">
            <text class="form-label">题库描述</text>
            <textarea
              class="form-textarea"
              v-model="formData.description"
              placeholder="请输入题库描述（可选）"
            />
          </view>
          <view v-if="!editingLibrary" class="form-item">
            <text class="form-label">导入题目</text>
            <view class="import-section">
              <view class="import-tabs">
                <text
                  class="tab-item"
                  :class="{ active: importMode === 'markdown' }"
                  @click="importMode = 'markdown'"
                >Markdown</text>
                <text
                  class="tab-item"
                  :class="{ active: importMode === 'ai' }"
                  @click="importMode = 'ai'"
                >AI 解析</text>
              </view>
              <textarea
                class="import-textarea"
                v-model="formData.markdownContent"
                placeholder="请输入 Markdown 格式的题目内容...&#10;&#10;示例：&#10;1. 题目内容？&#10;A. 选项A&#10;B. 选项B&#10;答案：A&#10;解析：解析内容"
              />
              <view v-if="parsedQuestions.length > 0" class="parse-preview">
                <text class="preview-title">解析结果：{{ parsedQuestions.length }} 道题</text>
              </view>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn cancel" @click="closeModal">取消</button>
          <button class="modal-btn confirm" @click="saveLibrary">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useLibraryStore } from '@/stores/library'
import { useUserStore } from '@/stores/user'
import { parseMarkdown } from '@/utils/parser'
import type { Library, Question } from '@/types'

const libraryStore = useLibraryStore()
const userStore = useUserStore()

const showAddModal = ref(false)
const editingLibrary = ref<Library | null>(null)
const importMode = ref<'markdown' | 'ai'>('markdown')

const formData = ref({
  name: '',
  description: '',
  markdownContent: ''
})

const libraries = computed(() => libraryStore.libraries)

const parsedQuestions = computed<Question[]>(() => {
  if (!formData.value.markdownContent) return []
  try {
    return parseMarkdown(formData.value.markdownContent)
  } catch {
    return []
  }
})

watch(showAddModal, (val) => {
  if (!val) {
    editingLibrary.value = null
    formData.value = { name: '', description: '', markdownContent: '' }
  }
})

function formatDate(date: Date): string {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startQuiz(library: Library) {
  uni.showActionSheet({
    itemList: ['顺序练习', '随机练习'],
    success: (res) => {
      const mode = res.tapIndex === 0 ? 'sequence' : 'random'
      uni.navigateTo({ url: `/pages/quiz/index?mode=${mode}&libraryId=${library._id}` })
    }
  })
}

function editLibrary(library: Library) {
  editingLibrary.value = library
  formData.value = {
    name: library.name,
    description: library.description || '',
    markdownContent: ''
  }
  showAddModal.value = true
}

async function deleteLibrary(library: Library) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除题库「${library.name}」吗？此操作不可恢复。`,
    success: async (res) => {
      if (res.confirm) {
        const result = await libraryStore.deleteLibrary(library._id)
        if (result) {
          uni.showToast({ title: '删除成功', icon: 'success' })
        } else {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

function closeModal() {
  showAddModal.value = false
}

async function saveLibrary() {
  if (!formData.value.name.trim()) {
    uni.showToast({ title: '请输入题库名称', icon: 'none' })
    return
  }

  if (editingLibrary.value) {
    const result = await libraryStore.updateLibrary(
      editingLibrary.value._id,
      formData.value.name,
      formData.value.description
    )
    if (result) {
      uni.showToast({ title: '更新成功', icon: 'success' })
      closeModal()
    } else {
      uni.showToast({ title: '更新失败', icon: 'none' })
    }
  } else {
    const libraryId = await libraryStore.createLibrary(
      formData.value.name,
      formData.value.description
    )
    
    if (libraryId && formData.value.markdownContent.trim()) {
      if (userStore.openid) {
        const questions = parseMarkdown(formData.value.markdownContent)
        if (questions.length > 0) {
          const result = await libraryStore.importQuestions(libraryId, questions, userStore.openid)
          if (result.success) {
            uni.showToast({ title: `创建成功，导入 ${result.data.importedCount} 道题`, icon: 'success' })
          } else {
            uni.showToast({ title: result.message || '导入失败', icon: 'none' })
          }
        }
      }
      closeModal()
    } else if (libraryId) {
      uni.showToast({ title: '创建成功', icon: 'success' })
      closeModal()
    } else {
      uni.showToast({ title: '创建失败', icon: 'none' })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
}

.content {
  padding: 20px;
}

.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  
  &:active {
    opacity: 0.9;
  }
}

.add-icon {
  font-size: 24px;
  color: #fff;
  margin-right: 8px;
}

.add-text {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.library-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.library-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.library-info {
  margin-bottom: 16px;
}

.library-name {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.library-desc {
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}

.library-meta {
  display: flex;
  align-items: center;
}

.meta-item {
  font-size: 13px;
  color: #999;
}

.meta-divider {
  margin: 0 8px;
  color: #ddd;
}

.library-actions {
  display: flex;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  
  &.edit {
    background: #f0f5ff;
    color: #667eea;
  }
  
  &.delete {
    background: #fff2f0;
    color: #ff4d4f;
  }
  
  &:active {
    opacity: 0.7;
  }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  display: block;
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-title {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  color: #999;
}

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
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  width: 100%;
  max-width: 600px;
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.modal-close {
  font-size: 24px;
  color: #999;
  padding: 8px;
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.form-item {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 1px solid #ddd;
  border-radius: 12px;
  font-size: 16px;
}

.form-textarea {
  width: 100%;
  height: 100px;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 12px;
  font-size: 16px;
}

.import-section {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
}

.import-tabs {
  display: flex;
  margin-bottom: 12px;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  color: #666;
  background: #fff;
  
  &.active {
    background: #667eea;
    color: #fff;
  }
}

.import-textarea {
  width: 100%;
  height: 200px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
}

.parse-preview {
  margin-top: 12px;
  padding: 12px;
  background: #e8f4fd;
  border-radius: 8px;
}

.preview-title {
  font-size: 13px;
  color: #1890ff;
}

.modal-footer {
  display: flex;
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
  gap: 12px;
}

.modal-btn {
  flex: 1;
  height: 48px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  border: none;
  
  &.cancel {
    background: #f5f5f5;
    color: #666;
  }
  
  &.confirm {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
}
</style>