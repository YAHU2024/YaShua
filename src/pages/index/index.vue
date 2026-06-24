<template>
  <view class="page">
    <view class="header">
      <view class="header-content">
        <text class="app-title">智慧刷题</text>
        <text class="app-subtitle">轻松学习，高效备考</text>
      </view>
    </view>

    <view class="content">
      <view class="stats-section">
        <StatsCard
          title="今日学习"
          :value="statsStore.todayQuestions"
          label="已完成"
          :sub-value="statsStore.todayCorrect"
          sub-label="正确"
          :progress="statsStore.getTodayAccuracy()"
        />
      </view>

      <view class="mode-section">
        <text class="section-title">刷题模式</text>
        <view class="mode-grid">
          <view class="mode-card" @click="startQuiz('sequence')">
            <view class="mode-icon sequence-icon">📚</view>
            <text class="mode-name">顺序练习</text>
            <text class="mode-desc">按题库顺序练习</text>
          </view>
          <view class="mode-card" @click="startQuiz('random')">
            <view class="mode-icon random-icon">🎲</view>
            <text class="mode-name">随机练习</text>
            <text class="mode-desc">随机出题练习</text>
          </view>
          <view class="mode-card" @click="startQuiz('wrong')">
            <view class="mode-icon wrong-icon">❌</view>
            <text class="mode-name">错题重做</text>
            <text class="mode-desc">只练习错题</text>
          </view>
        </view>
      </view>

      <view class="library-section">
        <view class="section-header">
          <text class="section-title">题库列表</text>
          <text class="section-more" @click="goToLibrary">查看全部 →</text>
        </view>
        <view v-if="libraries.length > 0" class="library-list">
          <view
            v-for="library in libraries.slice(0, 3)"
            :key="library._id"
            class="library-item"
            @click="startQuizFromLibrary(library, 'sequence')"
          >
            <view class="library-info">
              <text class="library-name">{{ library.name }}</text>
              <text class="library-count">{{ library.totalQuestions }} 道题</text>
            </view>
            <view class="library-arrow">›</view>
          </view>
        </view>
        <view v-else class="empty-library">
          <text class="empty-icon">📝</text>
          <text class="empty-text">暂无题库</text>
          <text class="empty-hint">点击下方按钮添加题库</text>
        </view>
      </view>

      <view class="action-section">
        <button class="action-btn" @click="goToLibrary">
          <text class="btn-text">题库管理</text>
        </button>
      </view>

      <view class="footer">
        <text class="footer-text">坚持每天刷题，进步看得见 ✨</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import StatsCard from '@/components/StatsCard.vue'
import { useUserStore } from '@/stores/user'
import { useLibraryStore } from '@/stores/library'
import { useStatsStore } from '@/stores/stats'
import { useWrongStore } from '@/stores/wrong'
import type { Library } from '@/types'

const userStore = useUserStore()
const libraryStore = useLibraryStore()
const statsStore = useStatsStore()
const wrongStore = useWrongStore()

const libraries = computed(() => libraryStore.libraries)

onMounted(async () => {
  await userStore.doLogin()
  await libraryStore.loadLibraries()
  if (userStore.openid) {
    await statsStore.loadStats(userStore.openid)
    await wrongStore.loadWrongQuestions(userStore.openid)
  }
})

async function startQuiz(mode: 'sequence' | 'random' | 'wrong') {
  if (mode === 'wrong') {
    if (userStore.openid) {
      await wrongStore.loadWrongQuestions(userStore.openid)
      if (wrongStore.getWrongCount() === 0) {
        uni.showToast({ title: '暂无错题', icon: 'none' })
        return
      }
    }
    uni.navigateTo({ url: `/pages/quiz/index?mode=${mode}` })
    return
  }

  if (libraries.value.length === 0) {
    uni.showToast({ title: '请先添加题库', icon: 'none' })
    return
  }

  if (libraries.value.length === 1) {
    uni.navigateTo({ url: `/pages/quiz/index?mode=${mode}&libraryId=${encodeURIComponent(libraries.value[0]._id)}` })
  } else {
    uni.showActionSheet({
      itemList: libraries.value.map(l => l.name),
      success: (res) => {
        const library = libraries.value[res.tapIndex]
        uni.navigateTo({ url: `/pages/quiz/index?mode=${mode}&libraryId=${encodeURIComponent(library._id)}` })
      }
    })
  }
}

function startQuizFromLibrary(library: Library, mode: 'sequence' | 'random' | 'wrong') {
  uni.navigateTo({ url: `/pages/quiz/index?mode=${mode}&libraryId=${encodeURIComponent(library._id)}` })
}

function goToLibrary() {
  uni.switchTab({ url: '/pages/library/index' })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0 0 32px 32px;
  padding: 60px 24px 32px;
}

.header-content {
  text-align: center;
}

.app-title {
  display: block;
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
}

.app-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.content {
  padding: 0 16px;
  padding-bottom: 120px;
}

.stats-section {
  margin-top: -20px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.mode-section {
  margin-bottom: 20px;
}

.mode-grid {
  display: flex;
  gap: 12px;
}

.mode-card {
  flex: 1;
  background: #fff;
  border-radius: 16px;
  padding: 20px 12px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s;
  
  &:active {
    transform: scale(0.95);
  }
}

.mode-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin: 0 auto 12px;
  
  &.sequence-icon {
    background: #e8f4fd;
  }
  
  &.random-icon {
    background: #f6ffed;
  }
  
  &.wrong-icon {
    background: #fff7e6;
  }
}

.mode-name {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.mode-desc {
  font-size: 12px;
  color: #999;
}

.library-section {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-more {
  font-size: 14px;
  color: #667eea;
}

.library-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.library-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  
  &:active {
    background: #f0f0f0;
  }
}

.library-info {
  flex: 1;
}

.library-name {
  display: block;
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.library-count {
  font-size: 13px;
  color: #999;
}

.library-arrow {
  font-size: 20px;
  color: #ccc;
}

.empty-library {
  text-align: center;
  padding: 32px 0;
}

.empty-icon {
  display: block;
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-text {
  display: block;
  font-size: 16px;
  color: #666;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: #999;
}

.action-section {
  margin-bottom: 20px;
}

.action-btn {
  width: 100%;
  height: 52px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:active {
    opacity: 0.9;
  }
}

.btn-text {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.footer {
  text-align: center;
}

.footer-text {
  font-size: 13px;
  color: #999;
}
</style>
