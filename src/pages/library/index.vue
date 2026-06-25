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

    <!-- 添加/编辑题库弹窗 -->
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
                  <text class="upload-hint">支持 .txt .md .docx .xlsx</text>
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
                  <text class="parsing-icon">⏳</text>
                  <text class="parsing-text">{{ parsingStatusText }}</text>
                </view>
                <view v-if="!isParsing && parsedQuestions.length === 0 && uploadedFile" class="parse-action">
                  <button class="parse-btn" @click="parseWithAI">AI 智能解析</button>
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
                  <text class="parsing-icon">⏳</text>
                  <text class="parsing-text">{{ parsingStatusText }}</text>
                </view>
                <view v-if="!isParsing && parsedQuestions.length === 0 && textContent.trim()" class="parse-action">
                  <button class="parse-btn" @click="parseWithAI">AI 智能解析</button>
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
          <button class="modal-btn cancel" @click="closeModal">取消</button>
          <button
            class="modal-btn confirm"
            :disabled="isParsing"
            @click="saveLibrary"
          >{{ isParsing ? '解析中...' : '保存' }}</button>
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
          <button class="modal-btn cancel" @click="showEditModal = false">取消</button>
          <button class="modal-btn confirm" @click="saveEditedQuestion">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useLibraryStore } from '@/stores/library'
import { useUserStore } from '@/stores/user'
import { parseMarkdown } from '@/utils/parser'
import { parseFileToQuestions, aiParseQuestions } from '@/utils/fileParser'
import type { Library, Question } from '@/types'

const libraryStore = useLibraryStore()
const userStore = useUserStore()

const showAddModal = ref(false)
const editingLibrary = ref<Library | null>(null)
const importMode = ref<'file' | 'text' | 'markdown'>('file')

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
    extension: ['txt', 'md', 'docx', 'xlsx'],
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
      // 文件模式：上传 → 提取文本 → AI 解析
      const questions = await parseFileToQuestions(
        uploadedFile.value.path,
        uploadedFile.value.name
      )
      parsedQuestions.value = questions
    } else if (importMode.value === 'text' && textContent.value.trim()) {
      const textLen = textContent.value.length
      parsingStatusText.value = textLen > 10000
        ? `AI 正在解析题目...（文本 ${textLen} 字，预计 10-20 秒）`
        : 'AI 正在解析题目...'
      // 文本模式：直接 AI 解析
      const startTime = Date.now()
      const questions = await aiParseQuestions(textContent.value)
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

    if (questions.length > 0 && userStore.openid) {
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
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.edit-modal {
  max-width: 550px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
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
  overflow-y: auto;
  flex: 1;
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
  
  &.large {
    height: 150px;
  }
}

.import-section {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
}

.import-tabs {
  display: flex;
  margin-bottom: 16px;
  gap: 8px;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 10px 4px;
  border-radius: 8px;
  font-size: 13px;
  color: #666;
  background: #fff;
  border: 1px solid #e8e8e8;
  
  &.active {
    background: #667eea;
    color: #fff;
    border-color: #667eea;
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
  padding: 30px 20px;
  background: #fff;
  border: 2px dashed #d9d9d9;
  border-radius: 12px;
  
  &:active {
    border-color: #667eea;
    background: #f0f5ff;
  }
}

.upload-icon {
  font-size: 40px;
  margin-bottom: 10px;
}

.upload-text {
  font-size: 15px;
  color: #333;
  font-weight: 500;
  margin-bottom: 6px;
}

.upload-hint {
  font-size: 12px;
  color: #999;
  line-height: 1.6;
}

.file-selected {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
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
  font-size: 28px;
  margin-right: 10px;
}

.file-name {
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-actions {
  flex-shrink: 0;
}

.file-action {
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 6px;
  
  &.reselect {
    color: #667eea;
    background: #f0f5ff;
  }
}

.parsing-status {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  margin-top: 12px;
  background: #fff;
  border-radius: 12px;
}

.parsing-icon {
  font-size: 20px;
  margin-right: 8px;
}

.parsing-text {
  font-size: 14px;
  color: #667eea;
}

.parse-action {
  margin-top: 12px;
}

.parse-btn {
  width: 100%;
  height: 44px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  
  &:active {
    opacity: 0.9;
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

.parse-result {
  margin-top: 16px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.result-title {
  font-size: 14px;
  color: #52c41a;
  font-weight: 500;
}

.result-action {
  font-size: 13px;
  color: #ff4d4f;
}

.question-list {
  max-height: 300px;
  overflow-y: auto;
}

.question-item {
  background: #fff;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 10px;
  border: 1px solid #f0f0f0;
}

.question-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.question-type-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 8px;
  font-weight: 500;
  
  &.single {
    background: #e6f7ff;
    color: #1890ff;
  }
  
  &.multiple {
    background: #f6ffed;
    color: #52c41a;
  }
  
  &.judge {
    background: #fff7e6;
    color: #fa8c16;
  }
}

.question-number {
  font-size: 13px;
  color: #999;
  flex: 1;
}

.question-ops {
  display: flex;
  gap: 8px;
}

.q-op {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 4px;
  
  &.edit {
    color: #667eea;
    background: #f0f5ff;
  }
  
  &.delete {
    color: #ff4d4f;
    background: #fff2f0;
  }
}

.question-content {
  display: block;
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  margin-bottom: 8px;
}

.question-options {
  margin-bottom: 8px;
}

.question-option {
  display: block;
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}

.question-answer {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.answer-label {
  font-size: 13px;
  color: #999;
}

.answer-value {
  font-size: 13px;
  color: #52c41a;
  font-weight: 500;
}

.question-analysis {
  display: block;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #f5f5f5;
}

.result-actions {
  margin-top: 12px;
  display: flex;
  gap: 12px;
}

.result-btn {
  flex: 1;
  height: 40px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  
  &.reparse {
    background: #f0f5ff;
    color: #667eea;
  }
}

.type-selector {
  display: flex;
  gap: 8px;
}

.type-option {
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  color: #666;
  background: #f5f5f5;
  border: 1px solid #e8e8e8;
  
  &.active {
    background: #667eea;
    color: #fff;
    border-color: #667eea;
  }
}

.modal-footer {
  display: flex;
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
  gap: 12px;
  flex-shrink: 0;
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
    
    &[disabled] {
      opacity: 0.5;
    }
  }
}
</style>
