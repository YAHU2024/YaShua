<template>
  <view class="page">
    <NavBar :title="libraryName" />

    <view class="content">
      <!-- 错题列表 -->
      <view v-if="wrongList.length > 0" class="wrong-list">
        <view
          v-for="item in wrongList"
          :key="item._id"
          class="wrong-item"
          @click="startReview(item)"
        >
          <view class="wrong-content">
            <text class="wrong-text">{{ truncate(item.question.content, 50) }}</text>
          </view>
          <view class="wrong-meta">
            <view class="wrong-count">
              <text class="count-icon">✗</text>
              <text class="count-text">{{ item.wrongCount }}次</text>
            </view>
            <view class="wrong-time">{{ formatDate(item.lastWrongTime) }}</view>
          </view>
          <view
            class="wrong-delete"
            @click.stop="deleteQuestion(item)"
          >×</view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-state">
        <text class="empty-icon">🎉</text>
        <text class="empty-title">暂无错题</text>
        <text class="empty-desc">该题库还没有错题</text>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view v-if="wrongList.length > 0" class="bottom-bar">
      <view class="bar-btn secondary" @click="clearGroup">清空</view>
      <view class="bar-btn primary" @click="startGroupReview">全部重做</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import { useWrongStore } from '@/stores/wrong'
import { useUserStore } from '@/stores/user'
import { isCloudAvailable } from '@/utils/cloud'
import type { WrongQuestion, Question } from '@/types'

const wrongStore = useWrongStore()
const userStore = useUserStore()

const libraryId = ref('')
const libraryName = ref('')

interface WrongItem extends WrongQuestion {
  question: Question
}

const wrongList = ref<WrongItem[]>([])

onLoad((options) => {
  if (options?.libraryId) {
    libraryId.value = decodeURIComponent(options.libraryId)
  }
  if (options?.libraryName) {
    libraryName.value = decodeURIComponent(options.libraryName)
  }
  // 设置导航栏标题
  uni.setNavigationBarTitle({ title: libraryName.value || '错题详情' })
})

onMounted(async () => {
  if (userStore.openid && libraryId.value) {
    await loadWrongQuestions()
  }
})

onShow(async () => {
  if (userStore.openid && libraryId.value) {
    await loadWrongQuestions()
  }
})

async function loadWrongQuestions() {
  if (!userStore.openid || !libraryId.value) return

  // 加载该题库的错题记录
  await wrongStore.loadWrongQuestions(userStore.openid, libraryId.value)

  // 组装题目详情
  const list = wrongStore.wrongQuestions
  const result: WrongItem[] = []

  if (!isCloudAvailable() || userStore.openid.startsWith('local_')) {
    // 本地模式：从本地存储获取题目数据
    for (const wrong of list) {
      try {
        const raw = uni.getStorageSync('local_questions')
        const questionsMap: Record<string, Question[]> = raw ? JSON.parse(raw) : {}
        let found: Question | undefined
        for (const lib of Object.values(questionsMap)) {
          found = lib.find((q: Question) => q._id === wrong.questionId)
          if (found) break
        }
        result.push({
          ...wrong,
          question: found || createPlaceholderQuestion(wrong.questionId)
        })
      } catch {
        result.push({
          ...wrong,
          question: createPlaceholderQuestion(wrong.questionId)
        })
      }
    }
  } else {
    // 云端模式：分批查询 questions 集合
    try {
      const db = uni.cloud.database()
      const questionIds = [...new Set(list.map(w => w.questionId))]
      const questionMap = new Map<string, Question>()

      if (questionIds.length > 0) {
        const BATCH_SIZE = 100
        for (let i = 0; i < questionIds.length; i += BATCH_SIZE) {
          const batch = questionIds.slice(i, i + BATCH_SIZE)
          const qResult = await db.collection('questions')
            .where({ _id: db.command.in(batch) })
            .get()
          for (const q of (qResult.data || []) as Question[]) {
            if (q._id) questionMap.set(q._id, q)
          }
        }
      }

      for (const wrong of list) {
        const question = questionMap.get(wrong.questionId)
        result.push({
          ...wrong,
          question: question || createPlaceholderQuestion(wrong.questionId)
        })
      }
    } catch (e) {
      console.error('获取错题详情失败', e)
      // 降级：使用占位题目
      for (const wrong of list) {
        result.push({
          ...wrong,
          question: createPlaceholderQuestion(wrong.questionId)
        })
      }
    }
  }

  wrongList.value = result
}

function createPlaceholderQuestion(questionId: string): Question {
  return {
    _id: questionId,
    libraryId: libraryId.value,
    type: 'single',
    content: '（题目已删除或暂时无法加载）',
    options: [],
    answer: [],
    difficulty: 0
  } as Question
}

function truncate(text: string, length: number): string {
  return text.length > length ? text.substring(0, length) + '...' : text
}

function formatDate(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`

  return `${d.getMonth() + 1}/${d.getDate()}`
}

function startReview(item: WrongItem) {
  uni.navigateTo({
    url: `/pages/quiz/index?mode=wrong&questionId=${item.questionId}`
  })
}

function startGroupReview() {
  const encoded = libraryId.value ? encodeURIComponent(libraryId.value) : ''
  uni.navigateTo({
    url: `/pages/quiz/index?mode=wrong&libraryId=${encoded}`
  })
}

async function deleteQuestion(item: WrongItem) {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这道错题吗？',
    success: async (res) => {
      if (res.confirm) {
        const result = await wrongStore.deleteWrongQuestion(item._id!)
        if (result) {
          wrongList.value = wrongList.value.filter(w => w._id !== item._id)
          uni.showToast({ title: '删除成功', icon: 'success' })
        }
      }
    }
  })
}

async function clearGroup() {
  uni.showModal({
    title: '确认清空',
    content: `确定要清空「${libraryName.value}」的所有错题吗？此操作不可恢复。`,
    success: async (res) => {
      if (res.confirm && userStore.openid) {
        const result = await wrongStore.clearAllWrongQuestions(userStore.openid, libraryId.value)
        if (result) {
          wrongList.value = []
          uni.showToast({ title: '清空成功', icon: 'success' })
        }
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 80px; /* 为底部操作栏留空间 */
}

.content {
  padding: 20px;
  padding-bottom: 40px;
}

.wrong-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wrong-item {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
}

.wrong-content {
  flex: 1;
}

.wrong-text {
  font-size: 15px;
  color: #333;
  line-height: 1.5;
}

.wrong-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-right: 12px;
}

.wrong-count {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.count-icon {
  font-size: 14px;
  color: #ff4d4f;
  margin-right: 4px;
}

.count-text {
  font-size: 12px;
  color: #ff4d4f;
}

.wrong-time {
  font-size: 12px;
  color: #999;
}

.wrong-delete {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #ccc;
  border-radius: 50%;
  flex-shrink: 0;

  &:active {
    background: #f5f5f5;
    color: #ff4d4f;
  }
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
}

.empty-icon {
  display: block;
  font-size: 80px;
  margin-bottom: 20px;
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

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
  z-index: 100;
}

.bar-btn {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;

  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }

  &.secondary {
    background: #f5f5f5;
    color: #666;
  }

  &:active {
    opacity: 0.8;
  }
}
</style>
