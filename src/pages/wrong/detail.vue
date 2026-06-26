<template>
  <ThemeWrapper>
  <view class="page">
    <NavBar :title="libraryName" />

    <LoadingState v-if="loading" text="加载错题..." />

    <ErrorState
      v-else-if="errorMsg"
      :message="errorMsg"
      show-retry
      @retry="loadWrongQuestions"
    />

    <view v-else class="content">
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
            aria-label="删除错题"
            @click.stop="deleteQuestion(item)"
          >×</view>
        </view>
      </view>

      <EmptyState
        v-else
        icon="🎉"
        title="暂无错题"
        description="该题库还没有错题"
      />
    </view>

    <view v-if="wrongList.length > 0" class="bottom-bar">
      <BaseButton variant="secondary" size="md" class="bar-btn" @click="clearGroup">清空</BaseButton>
      <BaseButton variant="primary" size="md" class="bar-btn" @click="startGroupReview">全部重做</BaseButton>
    </view>
  </view>
  </ThemeWrapper>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import ThemeWrapper from '@/components/ThemeWrapper.vue'
import NavBar from '@/components/NavBar.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useWrongStore } from '@/stores/wrong'
import { useUserStore } from '@/stores/user'
import { isCloudAvailable } from '@/utils/cloud'
import type { WrongQuestion, Question } from '@/types'

const wrongStore = useWrongStore()
const userStore = useUserStore()

const libraryId = ref('')
const libraryName = ref('')
const loading = ref(true)
const errorMsg = ref('')

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

  loading.value = true
  errorMsg.value = ''

  try {
    await wrongStore.loadWrongQuestions(userStore.openid, libraryId.value)

    const list = wrongStore.wrongQuestions
    const result: WrongItem[] = []

    if (!isCloudAvailable() || userStore.openid.startsWith('local_')) {
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
        for (const wrong of list) {
          result.push({
            ...wrong,
            question: createPlaceholderQuestion(wrong.questionId)
          })
        }
      }
    }

    wrongList.value = result
  } catch (e) {
    console.error('加载错题失败', e)
    errorMsg.value = '加载失败，请检查网络连接'
  } finally {
    loading.value = false
  }
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
@import '@/styles/tokens/_index.scss';

.page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding-bottom: 160rpx;
}

.content {
  padding: $space-xl;
  padding-bottom: 80rpx;
}

.wrong-list {
  display: flex;
  flex-direction: column;
  gap: $list-gap;
}

.wrong-item {
  background: var(--color-bg-card);
  border-radius: $radius-xl;
  padding: $space-lg;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  transition: transform $duration-instant;
  
  &:active {
    transform: scale(0.99);
    background: var(--color-bg-hover);
  }
}

.wrong-content {
  flex: 1;
}

.wrong-text {
  font-size: $font-size-md;
  color: var(--color-text-primary);
  line-height: $line-height-base;
}

.wrong-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-right: $space-md;
}

.wrong-count {
  display: flex;
  align-items: center;
  margin-bottom: $space-xs;
}

.count-icon {
  font-size: $font-size-base;
  color: var(--color-error);
  margin-right: $space-xs;
}

.count-text {
  font-size: $font-size-sm;
  color: var(--color-error);
}

.wrong-time {
  font-size: $font-size-sm;
  color: var(--color-text-tertiary);
}

.wrong-delete {
  width: $touch-target-min;
  height: $touch-target-min;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-2xl;
  color: var(--color-text-disabled);
  border-radius: $radius-full;
  flex-shrink: 0;
  transition: all $duration-fast;

  &:active {
    background: var(--color-bg-hover);
    color: var(--color-error);
  }
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: $space-md $space-xl;
  padding-bottom: calc($space-md + $safe-area-bottom);
  background: var(--color-bg-card);
  box-shadow: var(--shadow-top);
  z-index: 100;
}

.bar-btn {
  width: 280rpx;
}
</style>
