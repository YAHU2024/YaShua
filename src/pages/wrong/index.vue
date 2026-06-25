<template>
  <view class="page">
    <NavBar title="错题本" />
    
    <view class="content">
      <!-- 按题库分组展示错题 -->
      <view v-if="groupedList.length > 0" class="wrong-groups">
        <view
          v-for="group in groupedList"
          :key="group.libraryId"
          class="wrong-group"
        >
          <!-- 分组头部 -->
          <view class="group-header">
            <view class="group-info">
              <text class="group-name">{{ group.libraryName }}</text>
              <text class="group-count">{{ group.items.length }} 道错题</text>
            </view>
            <view class="group-actions">
              <text class="group-action-btn" @click="startGroupReview(group)">全部重做</text>
              <text class="group-action-btn secondary" @click="clearGroup(group)">清空</text>
            </view>
          </view>

          <!-- 该分组下的错题列表 -->
          <view class="wrong-list">
            <view
              v-for="item in group.items"
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
        </view>
      </view>

      <view v-else class="empty-state">
        <text class="empty-icon">🎉</text>
        <text class="empty-title">暂无错题</text>
        <text class="empty-desc">继续加油，保持全对！</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import { useWrongStore } from '@/stores/wrong'
import { useUserStore } from '@/stores/user'
import { useLibraryStore } from '@/stores/library'
import type { WrongQuestion, Question } from '@/types'

const wrongStore = useWrongStore()
const userStore = useUserStore()
const libraryStore = useLibraryStore()

const wrongList = ref<(WrongQuestion & { question: Question })[]>([])

// 错题按题库分组
interface WrongGroup {
  libraryId: string
  libraryName: string
  items: (WrongQuestion & { question: Question })[]
}

const groupedList = computed<WrongGroup[]>(() => {
  const groups: Record<string, WrongGroup> = {}

  for (const item of wrongList.value) {
    // 获取 libraryId：优先用错题记录里的，其次用题目数据里的
    const libId = item.libraryId || item.question?.libraryId || '__unknown__'
    if (!groups[libId]) {
      groups[libId] = {
        libraryId: libId,
        libraryName: getLibraryName(libId),
        items: []
      }
    }
    groups[libId].items.push(item)
  }

  return Object.values(groups)
})

function getLibraryName(libraryId: string): string {
  if (libraryId === '__unknown__') return '未分类'
  const lib = libraryStore.libraries.find(l => l._id === libraryId)
  return lib?.name || '未分类'
}

onMounted(async () => {
  // 加载题库列表（用于显示题库名称）
  if (libraryStore.libraries.length === 0) {
    await libraryStore.loadLibraries()
  }
  if (userStore.openid) {
    await loadWrongQuestions()
  }
})

// 页面显示时刷新错题列表（从 quiz 返回等场景）
onShow(async () => {
  if (userStore.openid) {
    await loadWrongQuestions()
  }
})

async function loadWrongQuestions() {
  wrongList.value = await wrongStore.getWrongQuestionDetails(userStore.openid!)
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

function startGroupReview(group: WrongGroup) {
  let libId = group.libraryId
  // __unknown__ 时尝试从第一条错题的题目数据中获取 libraryId
  if (libId === '__unknown__') {
    libId = group.items[0]?.question?.libraryId || ''
  }
  const encoded = libId ? encodeURIComponent(libId) : ''
  uni.navigateTo({ url: `/pages/quiz/index?mode=wrong&libraryId=${encoded}` })
}

async function clearGroup(group: WrongGroup) {
  const name = group.libraryId === '__unknown__' ? '未分类' : group.libraryName
  uni.showModal({
    title: '确认清空',
    content: `确定要清空「${name}」的所有错题吗？此操作不可恢复。`,
    success: async (res) => {
      if (res.confirm && userStore.openid) {
        const libId = group.libraryId === '__unknown__' ? undefined : group.libraryId
        const result = await wrongStore.clearAllWrongQuestions(userStore.openid, libId)
        if (result) {
          // 从列表中移除该分组
          wrongList.value = wrongList.value.filter(item => {
            const itemLibId = item.libraryId || item.question?.libraryId || '__unknown__'
            return itemLibId !== group.libraryId
          })
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
  padding-bottom: 40px;
}

.wrong-groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.wrong-group {
  // 每个分组
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.group-info {
  display: flex;
  flex-direction: column;
}

.group-name {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.group-count {
  font-size: 12px;
  color: #ff4d4f;
  margin-top: 4px;
}

.group-actions {
  display: flex;
  gap: 12px;
}

.group-action-btn {
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: 500;

  &.secondary {
    background: #f5f5f5;
    color: #999;
  }

  &:active {
    opacity: 0.8;
  }
}

.wrong-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
</style>
