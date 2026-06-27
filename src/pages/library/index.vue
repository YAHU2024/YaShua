<template>
  <ThemeWrapper>
  <view class="page">
    <NavBar title="题库管理" show-back />
    
    <view class="content">
      <!-- 毛玻璃质感添加按钮 -->
      <view class="add-library-card" @click="showAddModal = true">
        <view class="add-card-left">
          <text class="add-card-title">添加题库</text>
          <text class="add-card-subtitle">创建新的学习题库，AI 智能解析题目</text>
        </view>
        <view class="add-btn-circle">
          <text class="add-plus-icon">+</text>
        </view>
      </view>

      <view v-if="libraries.length > 0" class="library-list">
        <view
          v-for="library in libraries"
          :key="library._id"
          class="library-card"
        >
          <!-- 左侧封面占位 -->
          <view class="library-cover" @click="startQuiz(library)">
            <text class="cover-emoji">{{ getLibraryEmoji(library._id) }}</text>
          </view>
          
          <!-- 中间内容区 -->
          <view class="library-content" @click="startQuiz(library)">
            <text class="library-name">{{ library.name }}</text>
            <view class="library-meta">
              <text class="meta-question-count">{{ library.totalQuestions }} 道题</text>
              <text class="meta-dot">·</text>
              <text class="meta-date">{{ formatDate(library.createdAt) }}</text>
            </view>
            <text class="library-desc">{{ library.description || '暂无描述' }}</text>
          </view>
          
          <!-- 右侧操作图标 -->
          <view class="library-actions">
            <view class="action-icon-wrap edit" @click.stop="editLibrary(library)">
              <text class="action-icon-emoji">✎</text>
            </view>
            <view class="action-icon-wrap delete" @click.stop="deleteLibrary(library)">
              <text class="action-icon-emoji">✕</text>
            </view>
          </view>
        </view>
      </view>

      <EmptyState
        v-else
        icon="📚"
        title="暂无题库"
        description="点击上方按钮添加题库"
      />
    </view>

    <!-- 添加/编辑题库弹窗 -->
    <view v-if="showAddModal" class="modal-overlay" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editingLibrary ? '编辑题库' : '添加题库' }}</text>
          <view class="modal-close" @click="closeModal" aria-label="关闭">×</view>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="form-label">题库名称</text>
            <input
              class="form-input"
              :class="{ 'form-input-error': showNameError }"
              v-model="formData.name"
              placeholder="请输入题库名称"
              @input="showNameError = false"
            />
            <text v-if="showNameError" class="form-error-tip">题库名称不能为空</text>
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
              <!-- 导入方式 Tab -->
              <view class="import-tabs">
                <text
                  class="tab-item"
                  :class="{ active: importMode === 'file' }"
                  @click="switchImportMode('file')"
                >📁 文件导入</text>
                <text
                  class="tab-item"
                  :class="{ active: importMode === 'text' }"
                  @click="switchImportMode('text')"
                >📝 文本粘贴</text>
                <text
                  class="tab-item"
                  :class="{ active: importMode === 'markdown' }"
                  @click="switchImportMode('markdown')"
                >Markdown</text>
              </view>

              <!-- 文件导入模式 -->
              <view v-if="importMode === 'file'" class="import-mode-content">
                <view v-if="!uploadedFile" class="file-upload-area" @click="chooseFile">
                  <text class="upload-icon">📁</text>
                  <text class="upload-text">点击选择文件</text>
                  <text class="upload-hint">支持 .txt .md .doc .docx .xlsx</text>
                  <text class="upload-hint">文件大小限制 10MB</text>
                </view>
                <view v-else class="file-selected">
                  <view class="file-info">
                    <text class="file-icon">📄</text>
                    <text class="file-name">{{ uploadedFile.name }}</text>
                  </view>
                  <view class="file-actions">
                    <text class="file-action reselect" @click="chooseFile">重新选择</text>
                  </view>
                </view>
                <view v-if="isParsing" class="parsing-status">
                  <LoadingState :text="parsingStatusText" />
                </view>
                <view v-if="!isParsing && parsedQuestions.length === 0 && uploadedFile" class="parse-action">
                  <BaseButton variant="primary" size="md" block @click="parseWithAI">AI 智能解析</BaseButton>
                </view>
              </view>

              <!-- 文本粘贴模式 -->
              <view v-if="importMode === 'text'" class="import-mode-content">
                <textarea
                  class="import-textarea"
                  v-model="textContent"
                  :placeholder="TEXT_PLACEHOLDER"
                  placeholder-style="white-space: pre-line;"
                />
                <view v-if="isParsing" class="parsing-status">
                  <LoadingState :text="parsingStatusText" />
                </view>
                <view v-if="!isParsing && parsedQuestions.length === 0 && textContent.trim()" class="parse-action">
                  <BaseButton variant="primary" size="md" block @click="parseWithAI">AI 智能解析</BaseButton>
                </view>
              </view>

              <!-- Markdown 模式 -->
              <view v-if="importMode === 'markdown'" class="import-mode-content">
                <textarea
                  class="import-textarea"
                  v-model="formData.markdownContent"
                  :placeholder="MARKDOWN_PLACEHOLDER"
                  placeholder-style="white-space: pre-line;"
                />
                <view v-if="markdownParsedQuestions.length > 0" class="parse-preview">
                  <text class="preview-title">解析结果：{{ markdownParsedQuestions.length }} 道题</text>
                </view>
              </view>

              <!-- AI 解析结果预览（文件/文本模式） -->
              <view v-if="parsedQuestions.length > 0" class="parse-result">
                <view class="result-header">
                  <text class="result-title">✅ AI 解析完成，共 {{ parsedQuestions.length }} 道题</text>
                  <text class="result-action" @click="parsedQuestions = []">清空</text>
                </view>
                <view class="question-list">
                  <view
                    v-for="(question, index) in parsedQuestions"
                    :key="index"
                    class="question-item"
                  >
                    <view class="question-header">
                      <text class="question-type-tag" :class="question.type">
                        {{ getTypeLabel(question.type) }}
                      </text>
                      <text class="question-number">{{ index + 1 }}</text>
                      <view class="question-ops">
                        <text class="q-op edit" @click="editQuestion(index)">编辑</text>
                        <text class="q-op delete" @click="deleteQuestion(index)">删除</text>
                      </view>
                    </view>
                    <text class="question-content">{{ question.content }}</text>
                    <view v-if="question.options.length > 0" class="question-options">
                      <text
                        v-for="opt in question.options"
                        :key="opt"
                        class="question-option"
                      >{{ opt }}</text>
                    </view>
                    <view class="question-answer">
                      <text class="answer-label">答案：</text>
                      <text class="answer-value">{{ question.answer.join(', ') }}</text>
                    </view>
                    <text v-if="question.analysis" class="question-analysis">{{ question.analysis }}</text>
                  </view>
                </view>
                <view class="result-actions">
                  <button class="result-btn reparse" @click="reparse">重新解析</button>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <BaseButton variant="secondary" size="md" class="footer-btn" @click="closeModal">取消</BaseButton>
          <BaseButton
            variant="primary"
            size="md"
            class="footer-btn"
            :loading="isParsing"
            :disabled="isParsing"
            @click="saveLibrary"
          >{{ isParsing ? '解析中...' : '保存' }}</BaseButton>
        </view>
      </view>
    </view>

    <!-- 单题编辑弹窗 -->
    <view v-if="showEditModal" class="modal-overlay" @click="showEditModal = false">
      <view class="modal-content edit-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">编辑题目</text>
          <text class="modal-close" @click="showEditModal = false">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="form-label">题型</text>
            <view class="type-selector">
              <text
                class="type-option"
                :class="{ active: editingQuestion.type === 'single' }"
                @click="editingQuestion.type = 'single'"
              >单选题</text>
              <text
                class="type-option"
                :class="{ active: editingQuestion.type === 'multiple' }"
                @click="editingQuestion.type = 'multiple'"
              >多选题</text>
              <text
                class="type-option"
                :class="{ active: editingQuestion.type === 'judge' }"
                @click="editingQuestion.type = 'judge'"
              >判断题</text>
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">题目内容</text>
            <textarea
              class="form-textarea large"
              v-model="editingQuestion.content"
              placeholder="请输入题目内容"
            />
          </view>
          <view v-if="editingQuestion.type !== 'judge'" class="form-item">
            <text class="form-label">选项（每行一个）</text>
            <textarea
              class="form-textarea large"
              v-model="editingOptionsText"
              :placeholder="OPTIONS_PLACEHOLDER"
              placeholder-style="white-space: pre-line;"
            />
          </view>
          <view class="form-item">
            <text class="form-label">{{ editingQuestion.type === 'judge' ? '答案（正确/错误）' : '答案（多个用逗号分隔，如 A,C）' }}</text>
            <input
              class="form-input"
              v-model="editingAnswerText"
              :placeholder="editingQuestion.type === 'judge' ? '正确 或 错误' : '如 A 或 A,C'"
            />
          </view>
          <view class="form-item">
            <text class="form-label">解析（可选）</text>
            <textarea
              class="form-textarea"
              v-model="editingQuestion.analysis"
              placeholder="请输入解析内容"
            />
          </view>
        </view>
        <view class="modal-footer">
          <BaseButton variant="secondary" size="md" class="footer-btn" @click="showEditModal = false">取消</BaseButton>
          <BaseButton variant="primary" size="md" class="footer-btn" @click="saveEditedQuestion">保存</BaseButton>
        </view>
      </view>
    </view>
  </view>
  </ThemeWrapper>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import ThemeWrapper from '@/components/ThemeWrapper.vue'
import NavBar from '@/components/NavBar.vue'
import BaseButton from '@/components/BaseButton.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useLibraryStore } from '@/stores/library'
import { useUserStore } from '@/stores/user'
import { useAiSettingsStore } from '@/stores/aiSettings'
import { parseMarkdown } from '@/utils/parser'
import { parseFileToQuestions, aiParseQuestions, getRecommendedTimeout } from '@/utils/fileParser'
import { getLibraryEmoji } from '@/utils/libraryEmoji'
import type { Library, Question } from '@/types'

const libraryStore = useLibraryStore()
const userStore = useUserStore()
const aiSettings = useAiSettingsStore()

const showAddModal = ref(false)
const editingLibrary = ref<Library | null>(null)
const importMode = ref<'file' | 'text' | 'markdown'>('file')
const showNameError = ref(false)

const formData = ref({
  name: '',
  description: '',
  markdownContent: ''
})

// 文件导入相关状态
const uploadedFile = ref<{ name: string; path: string } | null>(null)
const textContent = ref('')
const isParsing = ref(false)
const parsingStatusText = ref('AI 正在解析题目...')
const parsedQuestions = ref<Question[]>([])

// 单题编辑相关状态
const showEditModal = ref(false)
const editingQuestionIndex = ref(-1)
const editingQuestion = reactive<Question>({
  libraryId: '',
  type: 'single',
  content: '',
  options: [],
  answer: [],
  analysis: '',
  difficulty: 1
})
const editingOptionsText = ref('')
const editingAnswerText = ref('')

// 多行 placeholder 常量：避免在模板中写 &#10; 导致 WXML 解析失败
const TEXT_PLACEHOLDER = '请粘贴题库文本内容...\n\n支持任意格式的题库文本，AI 将自动识别题目结构。'
const MARKDOWN_PLACEHOLDER = '请输入 Markdown 格式的题目内容...\n\n示例：\n1. 题目内容？\nA. 选项A\nB. 选项B\n答案：A\n解析：解析内容'
const OPTIONS_PLACEHOLDER = 'A. 选项A\nB. 选项B\nC. 选项C\nD. 选项D'

const libraries = computed(() => libraryStore.libraries)

// Markdown 模式实时解析
const markdownParsedQuestions = computed<Question[]>(() => {
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
    uploadedFile.value = null
    textContent.value = ''
    parsedQuestions.value = []
    isParsing.value = false
  }
})

function switchImportMode(mode: 'file' | 'text' | 'markdown') {
  importMode.value = mode
  // 切换模式时不清空已解析结果，保留用户数据
}

function formatDate(date: Date): string {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    single: '单选题',
    multiple: '多选题',
    judge: '判断题'
  }
  return labels[type] || type
}

function startQuiz(library: Library) {
  uni.showActionSheet({
    itemList: ['顺序练习', '随机练习'],
    success: (res) => {
      const mode = res.tapIndex === 0 ? 'sequence' : 'random'
      uni.navigateTo({ url: `/pages/quiz/index?mode=${mode}&libraryId=${encodeURIComponent(library._id)}` })
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

// 选择文件（从微信聊天记录中选择）
function chooseFile() {
  // wx.chooseMessageFile 是微信小程序专属 API，uni-app 中通过 wx 命名空间调用
  wx.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['txt', 'md', 'doc', 'docx', 'xlsx'],
    success: (res: any) => {
      const file = res.tempFiles[0]
      // 检查文件大小（10MB）
      if (file.size > 10 * 1024 * 1024) {
        uni.showToast({ title: '文件大小不能超过 10MB', icon: 'none' })
        return
      }
      uploadedFile.value = {
        name: file.name,
        path: file.path
      }
      // 清空之前的解析结果
      parsedQuestions.value = []
    },
    fail: (err: any) => {
      console.error('选择文件失败', err)
    }
  })
}

// AI 解析（文件/文本模式共用）
async function parseWithAI() {
  isParsing.value = true
  parsedQuestions.value = []

  try {
    if (importMode.value === 'file' && uploadedFile.value) {
      parsingStatusText.value = '正在上传文件并提取文本...'

      // 进度回调：根据阶段更新文案
      const onProgress = (completed: number, total: number, stage?: string) => {
        if (stage === 'extracting') {
          parsingStatusText.value = '正在提取文件文本...'
        } else if (stage === 'parsing_local') {
          parsingStatusText.value = '正在本地解析题目...'
        } else if (stage === 'ai_parsing') {
          parsingStatusText.value = `AI 解析中（${completed}/${total} 段）...`
        }
      }

      // 文件模式：上传 → 提取文本 → 本地解析 → AI 兜底（超时 5 分钟）
      const questions = await Promise.race([
        parseFileToQuestions(
          uploadedFile.value.path,
          uploadedFile.value.name,
          onProgress,
          aiSettings.getProviderConfig()
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI 解析超时（5分钟），请检查网络后重试')), 300000)
        )
      ])
      parsedQuestions.value = questions
    } else if (importMode.value === 'text' && textContent.value.trim()) {
      const textLen = textContent.value.length
      parsingStatusText.value = textLen > 10000
        ? `AI 正在解析题目...（文本 ${textLen} 字，预计 10-20 秒）`
        : 'AI 正在解析题目...'

      // 进度回调：根据阶段更新文案
      const onProgress = (completed: number, total: number, stage?: string) => {
        if (stage === 'ai_parsing') {
          parsingStatusText.value = `AI 解析中（${completed}/${total} 段）...`
        }
      }

      // 文本模式：AI 分段解析（动态超时，基于文本长度计算分段数和重试开销）
      const timeoutMs = getRecommendedTimeout(textLen)
      const timeoutSec = Math.round(timeoutMs / 1000)
      const startTime = Date.now()
      const questions = await Promise.race([
        aiParseQuestions(textContent.value, onProgress, aiSettings.getProviderConfig()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`AI 解析超时（${timeoutSec}秒），请检查网络后重试`)), timeoutMs)
        )
      ])
      console.log(`[AI解析] 文本模式完成，${questions.length} 题，耗时 ${Date.now() - startTime}ms`)
      parsedQuestions.value = questions
    } else {
      uni.showToast({ title: '请先选择文件或输入文本', icon: 'none' })
      return
    }

    if (parsedQuestions.value.length > 0) {
      uni.showToast({ title: `解析完成，共 ${parsedQuestions.value.length} 道题`, icon: 'success' })
    } else {
      uni.showToast({ title: '未能解析出题目，请检查内容', icon: 'none' })
    }
  } catch (e: any) {
    console.error('AI 解析失败', e)
    uni.showToast({ title: e.message || 'AI 解析失败', icon: 'none', duration: 3000 })
  } finally {
    isParsing.value = false
  }
}

// 重新解析
function reparse() {
  parsedQuestions.value = []
  parseWithAI()
}

// 编辑单题
function editQuestion(index: number) {
  editingQuestionIndex.value = index
  const q = parsedQuestions.value[index]
  editingQuestion.type = q.type
  editingQuestion.content = q.content
  editingQuestion.options = [...q.options]
  editingQuestion.answer = [...q.answer]
  editingQuestion.analysis = q.analysis || ''
  editingQuestion.difficulty = q.difficulty || 1
  editingOptionsText.value = q.options.join('\n')
  editingAnswerText.value = q.answer.join(', ')
  showEditModal.value = true
}

// 保存编辑后的题目
function saveEditedQuestion() {
  if (!editingQuestion.content.trim()) {
    uni.showToast({ title: '题目内容不能为空', icon: 'none' })
    return
  }

  // 更新选项
  if (editingQuestion.type === 'judge') {
    editingQuestion.options = ['正确', '错误']
    // 判断题答案标准化
    const ans = editingAnswerText.value.trim()
    if (ans.includes('正确') || ans.includes('对') || ans === 'A') {
      editingQuestion.answer = ['正确']
    } else {
      editingQuestion.answer = ['错误']
    }
  } else {
    editingQuestion.options = editingOptionsText.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    editingQuestion.answer = editingAnswerText.value
      .split(/[,，、\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
  }

  // 更新到数组
  const idx = editingQuestionIndex.value
  if (idx >= 0 && idx < parsedQuestions.value.length) {
    parsedQuestions.value[idx] = { ...editingQuestion }
  }

  showEditModal.value = false
  uni.showToast({ title: '已保存修改', icon: 'success' })
}

// 删除单题
function deleteQuestion(index: number) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除第 ${index + 1} 道题吗？`,
    success: (res) => {
      if (res.confirm) {
        parsedQuestions.value.splice(index, 1)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

// 保存题库
async function saveLibrary() {
  if (!formData.value.name.trim()) {
    showNameError.value = true
    uni.showToast({ title: '请输入题库名称', icon: 'none' })
    return
  }

  if (editingLibrary.value) {
    // 编辑模式
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
    // 创建模式
    const libraryId = await libraryStore.createLibrary(
      formData.value.name,
      formData.value.description
    )

    if (!libraryId) {
      uni.showToast({ title: '创建失败', icon: 'none' })
      return
    }

    // 根据导入模式获取题目
    let questions: Question[] = []
    if (importMode.value === 'markdown') {
      if (formData.value.markdownContent.trim()) {
        questions = parseMarkdown(formData.value.markdownContent)
      }
    } else {
      // file / text 模式使用 AI 解析结果
      questions = parsedQuestions.value
    }

    // file/text 模式下，有内容但未解析出题目时，提示用户先解析
    if (questions.length === 0 && !editingLibrary.value) {
      if (importMode.value === 'file' && uploadedFile.value) {
        uni.showToast({ title: '请先点击「AI 智能解析」解析文件', icon: 'none' })
        return
      }
      if (importMode.value === 'text' && textContent.value.trim()) {
        uni.showToast({ title: '请先点击「AI 智能解析」解析文本', icon: 'none' })
        return
      }
    }

    if (questions.length > 0) {
      if (!userStore.openid) {
        // openid 未获取时提示用户，不创建空题库
        uni.showModal({
          title: '登录未完成',
          content: '当前登录状态异常，题目无法保存。请退出小程序重新进入后再试。',
          showCancel: false
        })
        return
      }
      const result = await libraryStore.importQuestions(libraryId, questions, userStore.openid)
      if (result.success) {
        uni.showToast({ title: `创建成功，导入 ${result.data.importedCount} 道题`, icon: 'success' })
        closeModal()
      } else {
        // 导入失败，删除刚创建的空题库，不关弹窗让用户修改后重试
        await libraryStore.deleteLibrary(libraryId)
        const errMsg = result.message || '导入失败'
        uni.showModal({
          title: '题目导入失败',
          content: `${errMsg}\n\n请修改题目内容后重新保存。`,
          showCancel: false
        })
        return  // 不执行 closeModal()
      }
    } else {
      uni.showToast({ title: '创建成功', icon: 'success' })
      closeModal()
    }
  }
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

// ============ 毛玻璃添加卡片 ============
.add-library-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 36rpx;
  background: var(--color-glass-bg);
  border-radius: 24rpx;
  border: 2rpx solid var(--color-glass-border);
  box-shadow: var(--shadow-glass);
  // 微信小程序部分版本不支持 backdrop-filter，用 RGBA 背景做降级
  transition: transform $duration-instant, box-shadow $duration-fast;

  &:active {
    transform: scale(0.98);
    box-shadow: 0 2rpx 12rpx rgba(74, 71, 163, 0.06);
  }
}

.add-card-left {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.add-card-title {
  font-size: 32rpx;
  font-weight: $font-weight-semibold;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
}

.add-card-subtitle {
  font-size: 24rpx;
  color: var(--color-text-subtitle);
  line-height: 1.4;
}

.add-btn-circle {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: var(--color-icon-blue-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform $duration-instant;

  .add-library-card:active & {
    transform: scale(0.9);
  }
}

.add-plus-icon {
  font-size: 44rpx;
  color: var(--color-icon-blue);
  font-weight: 300;
  line-height: 1;
}

// ============ 题库列表 ============
.library-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 40rpx;
}

// ============ 题库卡片 — Neumorphic 微立体 ============
.library-card {
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
  background: var(--color-bg-card);
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  box-shadow: var(--shadow-neu-md);
  transition: transform $duration-instant, box-shadow $duration-fast;

  &:active {
    transform: scale(0.985);
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.02);
  }
}

// --- 左侧封面占位 ---
.library-cover {
  width: 96rpx;
  height: 96rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #F0F0F3 0%, #E5E5EA 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cover-emoji {
  font-size: 44rpx;
  line-height: 1;
}

// --- 中间内容区 ---
.library-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.library-name {
  font-size: 32rpx;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  margin-bottom: 8rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-meta {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.meta-question-count {
  font-size: 24rpx;
  color: var(--color-text-subtitle);
}

.meta-dot {
  margin: 0 10rpx;
  font-size: 24rpx;
  color: var(--color-text-disabled);
}

.meta-date {
  font-size: 24rpx;
  color: var(--color-text-subtitle);
}

.library-desc {
  font-size: 26rpx;
  color: var(--color-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}

// --- 右侧操作图标 ---
.library-actions {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  flex-shrink: 0;
}

.action-icon-wrap {
  width: 68rpx;
  height: 68rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid transparent;
  transition: background $duration-instant, border-color $duration-instant, transform $duration-instant;

  &:active {
    transform: scale(0.88);
  }

  &.edit {
    border-color: var(--color-border-input);
    background: transparent;

    &:active {
      background: var(--color-bg-hover);
    }
  }

  &.delete {
    border-color: var(--color-action-delete);
    background: transparent;

    &:active {
      background: var(--color-action-delete-bg);
    }
  }
}

.action-icon-emoji {
  font-size: 28rpx;
  line-height: 1;
  color: var(--color-text-secondary);

  .action-icon-wrap.delete & {
    color: var(--color-action-delete);
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-mask);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: $space-xl;
  animation: overlayFadeIn $duration-slow $ease-out;
}

.modal-content {
  width: 100%;
  max-width: 600px;
  background: var(--color-bg-card);
  border-radius: $radius-2xl;
  overflow: hidden;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  animation: modalScaleIn $duration-slow $ease-bounce;
}

.edit-modal {
  max-width: 550px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $space-xl;
  border-bottom: 1rpx solid var(--color-border-base);
  flex-shrink: 0;
}

.modal-title {
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
}

.modal-close {
  width: $touch-target-min;
  height: $touch-target-min;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: var(--color-text-tertiary);
}

.modal-body {
  padding: $space-xl;
  overflow-y: auto;
  flex: 1;
}

.form-item {
  margin-bottom: $section-gap;
}

.form-label {
  display: block;
  font-size: $font-size-base;
  font-weight: $font-weight-medium;
  color: var(--color-text-primary);
  margin-bottom: $space-sm;
}

.form-input {
  width: 100%;
  height: $btn-height-lg;
  padding: 0 $space-lg;
  border: 2rpx solid var(--color-border-input);
  border-radius: $radius-lg;
  font-size: $font-size-lg;
  transition: border-color $duration-fast;

  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 4rpx rgba(var(--color-primary), 0.1);
  }

  &.form-input-error {
    border-color: var(--color-error);
  }
}

.form-error-tip {
  display: block;
  font-size: $font-size-sm;
  color: var(--color-error);
  margin-top: $space-xs;
}

.form-textarea {
  width: 100%;
  height: 200rpx;
  padding: $space-md $space-lg;
  border: 2rpx solid var(--color-border-input);
  border-radius: $radius-lg;
  font-size: $font-size-lg;

  &:focus {
    border-color: var(--color-primary);
  }

  &.large {
    height: 300rpx;
  }
}

.import-section {
  background: var(--color-bg-input);
  border-radius: $radius-lg;
  padding: $space-lg;
}

.import-tabs {
  display: flex;
  margin-bottom: $space-lg;
  gap: $space-sm;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 8rpx;
  border-radius: $radius-md;
  font-size: $font-size-xs;
  color: var(--color-text-secondary);
  background: var(--color-bg-card);
  border: 2rpx solid var(--color-border-light);

  &.active {
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border-color: var(--color-primary);
  }
}

.import-mode-content {
  min-height: 120px;
}

.file-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx $space-xl;
  background: var(--color-bg-card);
  border: 4rpx dashed var(--color-border-input);
  border-radius: $radius-lg;
  transition: border-color $duration-fast;

  &:active {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }
}

.upload-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.upload-text {
  font-size: $font-size-md;
  color: var(--color-text-primary);
  font-weight: $font-weight-medium;
  margin-bottom: 12rpx;
}

.upload-hint {
  font-size: $font-size-sm;
  color: var(--color-text-tertiary);
  line-height: 1.6;
}

.file-selected {
  background: var(--color-bg-card);
  border-radius: $radius-lg;
  padding: $space-lg;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.file-info {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
}

.file-icon {
  font-size: 56rpx;
  margin-right: 20rpx;
}

.file-name {
  font-size: $font-size-base;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-actions {
  flex-shrink: 0;
}

.file-action {
  font-size: $font-size-xs;
  padding: $space-xs $space-md;
  border-radius: 12rpx;

  &.reselect {
    color: var(--color-primary);
    background: var(--color-primary-light);
  }
}

.parsing-status {
  margin-top: $space-md;
}

.parse-action {
  margin-top: $space-md;
}

.import-textarea {
  width: 100%;
  height: 400rpx;
  padding: $space-md;
  border: 2rpx solid var(--color-border-input);
  border-radius: $radius-md;
  font-size: $font-size-base;
  background: var(--color-bg-card);

  &:focus {
    border-color: var(--color-primary);
  }
}

.parse-preview {
  margin-top: $space-md;
  padding: $space-md;
  background: var(--color-info-bg);
  border-radius: $radius-md;
}

.preview-title {
  font-size: $font-size-xs;
  color: var(--color-info);
}

.parse-result {
  margin-top: $space-lg;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $space-md;
}

.result-title {
  font-size: $font-size-base;
  color: var(--color-success);
  font-weight: $font-weight-medium;
}

.result-action {
  font-size: $font-size-xs;
  color: var(--color-error);
}

.question-list {
  max-height: 600rpx;
  overflow-y: auto;
}

.question-item {
  background: var(--color-bg-card);
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  border: 2rpx solid var(--color-border-base);
}

.question-header {
  display: flex;
  align-items: center;
  margin-bottom: $space-sm;
}

.question-type-tag {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: $radius-xs;
  margin-right: $space-sm;
  font-weight: $font-weight-medium;

  &.single {
    background: var(--color-info-bg);
    color: var(--color-info);
  }

  &.multiple {
    background: var(--color-success-bg);
    color: var(--color-success);
  }

  &.judge {
    background: var(--color-warning-bg);
    color: var(--color-warning);
  }
}

.question-number {
  font-size: $font-size-xs;
  color: var(--color-text-tertiary);
  flex: 1;
}

.question-ops {
  display: flex;
  gap: $space-sm;
}

.q-op {
  font-size: $font-size-sm;
  padding: 4rpx 20rpx;
  border-radius: $radius-xs;

  &.edit {
    color: var(--color-primary);
    background: var(--color-primary-light);
  }

  &.delete {
    color: var(--color-error);
    background: var(--color-error-bg);
  }
}

.question-content {
  display: block;
  font-size: $font-size-base;
  color: var(--color-text-primary);
  line-height: $line-height-base;
  margin-bottom: $space-sm;
}

.question-options {
  margin-bottom: $space-sm;
}

.question-option {
  display: block;
  font-size: $font-size-xs;
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.question-answer {
  display: flex;
  align-items: center;
  margin-bottom: $space-xs;
}

.answer-label {
  font-size: $font-size-xs;
  color: var(--color-text-tertiary);
}

.answer-value {
  font-size: $font-size-xs;
  color: var(--color-success);
  font-weight: $font-weight-medium;
}

.question-analysis {
  display: block;
  font-size: $font-size-sm;
  color: var(--color-text-tertiary);
  line-height: $line-height-base;
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid var(--color-border-base);
}

.result-actions {
  margin-top: $space-md;
  display: flex;
  gap: $space-md;
}

.type-selector {
  display: flex;
  gap: $space-sm;
}

.type-option {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  border-radius: $radius-md;
  font-size: $font-size-base;
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
  border: 2rpx solid var(--color-border-light);

  &.active {
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border-color: var(--color-primary);
  }
}

.modal-footer {
  display: flex;
  padding: $space-lg $space-xl;
  border-top: 1rpx solid var(--color-border-base);
  gap: $space-md;
  flex-shrink: 0;
}

.footer-btn {
  flex: 1;
}
</style>
