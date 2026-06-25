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
        <EmptyState
          v-else
          icon="📝"
          title="暂无题库"
          description="点击下方按钮添加题库开始学习"
        />
      </view>

      <view class="action-section">
        <BaseButton variant="primary" size="xl" block @click="goToLibrary">题库管理</BaseButton>
      </view>

      <view class="footer">
        <text class="footer-text">坚持每天刷题，进步看得见 ✨</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import StatsCard from '@/components/StatsCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import BaseButton from '@/components/BaseButton.vue'
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

onShow(async () => {
  if (!userStore.openid) {
    await userStore.doLogin()
  }
  console.log('[index.onShow] statsStore 当前值:', { todayQuestions: statsStore.todayQuestions, todayCorrect: statsStore.todayCorrect, total: statsStore.totalQuestions, correct: statsStore.correctCount })
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
@import '@/styles/tokens/_index.scss';

.page {
  min-height: 100vh;
  background: $color-bg-page;
}

.header {
  background: $gradient-primary;
  border-radius: 0 0 $radius-3xl $radius-3xl;
  padding: 120rpx $space-2xl $space-3xl;
}

.header-content {
  text-align: center;
}

.app-title {
  display: block;
  font-size: $font-size-3xl;
  font-weight: $font-weight-bold;
  color: $color-text-inverse;
  margin-bottom: $space-sm;
}

.app-subtitle {
  font-size: $font-size-base;
  color: rgba(255, 255, 255, 0.8);
}

.content {
  padding: 0 $page-horizontal-padding;
  padding-bottom: 240rpx;
}

.stats-section {
  margin-top: -40rpx;
  margin-bottom: $section-gap;
}

.section-title {
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  color: $color-text-primary;
  margin-bottom: $space-lg;
}

.mode-section {
  margin-bottom: $section-gap;
}

.mode-grid {
  display: flex;
  gap: $space-md;
}

.mode-card {
  flex: 1;
  background: $color-bg-card;
  border-radius: $radius-xl;
  padding: $space-xl $space-md;
  text-align: center;
  box-shadow: $shadow-md;
  transition: transform $duration-fast;

  &:active {
    transform: scale(0.95);
  }
}

.mode-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  margin: 0 auto $space-md;
  
  &.sequence-icon { background: $color-info-bg; }
  &.random-icon   { background: $color-success-bg; }
  &.wrong-icon    { background: $color-warning-bg; }
}

.mode-name {
  display: block;
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: $color-text-primary;
  margin-bottom: $space-xs;
}

.mode-desc {
  font-size: $font-size-sm;
  color: $color-text-tertiary;
}

.library-section {
  background: $color-bg-card;
  border-radius: $radius-xl;
  padding: $card-padding;
  margin-bottom: $section-gap;
  box-shadow: $shadow-md;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $space-lg;
}

.section-more {
  font-size: $font-size-base;
  color: $color-primary;
}

.library-list {
  display: flex;
  flex-direction: column;
  gap: $list-gap;
}

.library-item {
  display: flex;
  align-items: center;
  padding: $space-lg;
  background: $color-bg-input;
  border-radius: $radius-lg;

  &:active {
    background: $color-bg-hover;
  }
}

.library-info {
  flex: 1;
}

.library-name {
  display: block;
  font-size: $font-size-lg;
  font-weight: $font-weight-medium;
  color: $color-text-primary;
  margin-bottom: $space-xs;
}

.library-count {
  font-size: $font-size-xs;
  color: $color-text-tertiary;
}

.library-arrow {
  font-size: $font-size-2xl;
  color: $color-text-disabled;
}

.action-section {
  margin-bottom: $section-gap;
}

.footer {
  text-align: center;
}

.footer-text {
  font-size: $font-size-xs;
  color: $color-text-tertiary;
}
</style>
