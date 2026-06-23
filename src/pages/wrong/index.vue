<template>
  <view class="page">
    <NavBar title="错题本" />
    
    <view class="content">
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
          <view class="wrong-arrow">›</view>
        </view>
      </view>

      <view v-else class="empty-state">
        <text class="empty-icon">🎉</text>
        <text class="empty-title">暂无错题</text>
        <text class="empty-desc">继续加油，保持全对！</text>
      </view>

      <view v-if="wrongList.length > 0" class="action-bar">
        <button class="action-btn" @click="startAllReview">
          <text>重新练习全部错题</text>
        </button>
        <button class="action-btn secondary" @click="clearAll">
          <text>清空错题本</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useWrongStore } from '@/stores/wrong'
import { useUserStore } from '@/stores/user'
import type { WrongQuestion, Question } from '@/types'

const wrongStore = useWrongStore()
const userStore = useUserStore()

const wrongList = ref<(WrongQuestion & { question: Question })[]>([])

onMounted(async () => {
  const userId = userStore.getUserId()
  if (userId) {
    await loadWrongQuestions()
  }
})

async function loadWrongQuestions() {
  const userId = userStore.getUserId()
  wrongList.value = await wrongStore.getWrongQuestionDetails(userId)
}

function truncate(text: string, length: number): string {
  return text.length > length ? text.substring(0, length) + '...' : text
}

function formatDate(date: Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function startReview(item: WrongQuestion & { question: Question }) {
  uni.navigateTo({ url: `/pages/quiz/index?mode=wrong&questionId=${item.questionId}` })
}

function startAllReview() {
  uni.navigateTo({ url: '/pages/quiz/index?mode=wrong' })
}

async function clearAll() {
  const userId = userStore.getUserId()
  uni.showModal({
    title: '确认清空',
    content: '确定要清空所有错题吗？此操作不可恢复。',
    success: async (res) => {
      if (res.confirm && userId) {
        const result = await wrongStore.clearAllWrongQuestions(userId)
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
}

.content {
  padding: 20px;
  padding-bottom: 120px;
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

.wrong-arrow {
  font-size: 20px;
  color: #ccc;
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

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 12px;
  padding: 20px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}

.action-btn {
  flex: 1;
  height: 48px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  
  &.secondary {
    background: #f5f5f5;
    color: #666;
  }
  
  &:active {
    opacity: 0.8;
  }
}
</style>
