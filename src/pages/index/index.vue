<template>
  <ThemeWrapper>
  <view class="page">
    <!-- ===== 1. 顶部状态栏 / 品牌 Header ===== -->
    <view class="header">
      <!-- 装饰光晕 -->
      <view class="header-glow header-glow-1"></view>
      <view class="header-glow header-glow-2"></view>
      
      <view class="header-top">
        <view class="header-top-spacer"></view>
        <text class="header-brand">雅刷</text>
        <view class="header-top-spacer"></view>
      </view>
      <text class="header-subtitle">轻松学习，高效备考</text>
    </view>

    <!-- ===== 2. 环形进度盘区域 ===== -->
    <view class="stats-container">
      <view class="stats-card">
        <text class="stats-card-title">今日学习进度</text>
        <CircularProgress
          ref="circularProgressRef"
          :value="statsStore.todayQuestions"
          :total="statsStore.dailyGoal"
          :accuracy="statsStore.getTodayAccuracy()"
          label="已完成"
          sub-label="今日正确率"
        />
        <!-- 统计摘要行 -->
        <view class="stats-summary">
          <view class="stats-summary-item">
            <text class="stats-summary-value">{{ statsStore.todayQuestions }}</text>
            <text class="stats-summary-label">今日完成</text>
          </view>
          <view class="stats-summary-divider"></view>
          <view class="stats-summary-item">
            <text class="stats-summary-value correct">{{ statsStore.todayCorrect }}</text>
            <text class="stats-summary-label">正确</text>
          </view>
          <view class="stats-summary-divider"></view>
          <view class="stats-summary-item">
            <text class="stats-summary-value total">{{ statsStore.totalQuestions }}</text>
            <text class="stats-summary-label">累计</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ===== 3. 功能金刚区（刷题模式）===== -->
    <view class="mode-section">
      <text class="section-title">刷题模式</text>
      <view class="mode-grid">
        <view class="mode-card" @click="startQuiz('sequence')">
          <view class="mode-icon-wrapper sequence">
            <text class="mode-icon-text">📖</text>
          </view>
          <text class="mode-name">顺序练习</text>
          <text class="mode-desc">按序刷题</text>
        </view>
        <view class="mode-card" @click="startQuiz('random')">
          <view class="mode-icon-wrapper random">
            <text class="mode-icon-text">🎲</text>
          </view>
          <text class="mode-name">随机练习</text>
          <text class="mode-desc">随机出题</text>
        </view>
        <view class="mode-card" @click="startQuiz('wrong')">
          <view class="mode-icon-wrapper wrong">
            <text class="mode-icon-text">❌</text>
          </view>
          <text class="mode-name">错题重做</text>
          <text class="mode-desc">攻克薄弱</text>
        </view>
      </view>
    </view>

    <!-- ===== 4. 推荐题库（多层叠加卡片）===== -->
    <view class="library-section">
      <view class="section-header">
        <text class="section-title">推荐题库</text>
        <text class="section-more" @click="goToLibrary">查看全部 →</text>
      </view>

      <view v-if="libraries.length > 0" class="library-stack">
        <!-- 背景叠加层 -->
        <view
          v-for="(_, i) in Math.min(libraries.length, 3)"
          :key="'bg-' + i"
          class="library-card-bg"
          :style="getStackStyle(i)"
        ></view>
        <!-- 前景可交互卡片 -->
        <view
          v-for="(library, i) in libraries.slice(0, 3)"
          :key="library._id"
          class="library-card"
          :class="{ 'is-first': i === 0 }"
          :style="getStackStyle(i)"
          @click="startQuizFromLibrary(library, 'sequence')"
        >
          <view class="library-card-inner">
            <!-- 题库封面 emoji（与题库管理/错题本页统一） -->
            <view class="library-cover-sm">
              <text class="library-cover-emoji">{{ getLibraryEmoji(library._id) }}</text>
            </view>
            <view class="library-info">
              <text class="library-name">{{ library.name }}</text>
              <text class="library-count">{{ library.totalQuestions }} 道题</text>
            </view>
            <view class="library-action">
              <text class="library-action-text">开始</text>
              <text class="library-arrow">→</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else class="library-empty">
        <EmptyState
          icon="📝"
          title="暂无题库"
          description="点击下方按钮添加题库开始学习"
        />
      </view>
    </view>

    <!-- ===== 5. 底部操作 & 页脚 ===== -->
    <view class="action-section">
      <BaseButton variant="primary" size="xl" block @click="goToLibrary">
        题库管理
      </BaseButton>
    </view>

    <view class="footer">
      <text class="footer-text">坚持每天刷题，进步看得见 ✨</text>
    </view>
  </view>
  </ThemeWrapper>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import ThemeWrapper from '@/components/ThemeWrapper.vue'
import CircularProgress from '@/components/CircularProgress.vue'
import EmptyState from '@/components/EmptyState.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useUserStore } from '@/stores/user'
import { useLibraryStore } from '@/stores/library'
import { useStatsStore } from '@/stores/stats'
import { useWrongStore } from '@/stores/wrong'
import { getLibraryEmoji } from '@/utils/libraryEmoji'
import type { Library } from '@/types'

const userStore = useUserStore()
const libraryStore = useLibraryStore()
const statsStore = useStatsStore()
const wrongStore = useWrongStore()

const circularProgressRef = ref()

const libraries = computed(() => libraryStore.libraries)

function getStackStyle(index: number) {
  const offset = index * 12
  return {
    zIndex: 3 - index,
    transform: `translateX(${offset}rpx)`,
    opacity: index === 0 ? 1 : index === 1 ? 0.85 : 0.65
  }
}

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
  // 页面从后台恢复时强制重绘环形进度盘
  // 原因：答题时首页在后台，requestAnimationFrame 不触发，Canvas 和数字动画卡在第一帧
  nextTick(() => {
    circularProgressRef.value?.redraw()
  })
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

// ==============================
//  PAGE BASE
// ==============================
.page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding-bottom: 120rpx;
}

// ==============================
//  1. HEADER — 深紫渐变 + 圆弧底
// ==============================
.header {
  position: relative;
  background: var(--gradient-primary);
  border-radius: 0 0 $radius-3xl $radius-3xl;
  padding: calc(var(--status-bar-height) + 32rpx) $space-2xl $space-3xl $space-2xl;
  overflow: hidden;
}

// 装饰光晕
.header-glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  
  &-1 {
    width: 320rpx;
    height: 320rpx;
    background: radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%);
    top: -100rpx;
    right: -80rpx;
  }
  
  &-2 {
    width: 200rpx;
    height: 200rpx;
    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
    bottom: 20rpx;
    left: -60rpx;
  }
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-top-spacer {
  width: 64rpx;
  height: 64rpx;
  
  &.header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
}

.header-brand {
  font-size: $font-size-2xl;
  font-weight: $font-weight-bold;
  color: var(--color-text-inverse);
  letter-spacing: 2rpx;
}

.header-subtitle {
  display: block;
  text-align: center;
  font-size: $font-size-sm;
  color: rgba(255, 255, 255, 0.7);
  margin-top: $space-sm;
}

// ==============================
//  2. STATS — 微立体进度卡片
// ==============================
.stats-container {
  padding: 0 $page-horizontal-padding;
  margin-top: -48rpx;
  position: relative;
  z-index: 10;
}

.stats-card {
  background: var(--color-bg-card);
  border-radius: $radius-xl;
  padding: $card-padding;
  box-shadow: var(--shadow-neu-md);
}

.stats-card-title {
  display: block;
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  margin-bottom: $space-lg;
  text-align: center;
}

.stats-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: $space-lg;
  padding-top: $space-lg;
  border-top: 1rpx solid var(--color-border-base);
}

.stats-summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 $space-xl;
}

.stats-summary-value {
  font-size: 36rpx;
  font-weight: $font-weight-bold;
  color: var(--color-primary);
  
  &.correct {
    color: var(--color-success);
  }
  
  &.total {
    color: var(--color-text-secondary);
  }
}

.stats-summary-label {
  font-size: $font-size-xs;
  color: var(--color-text-subtitle);
  margin-top: 4rpx;
}

.stats-summary-divider {
  width: 2rpx;
  height: 40rpx;
  background: var(--color-border-base);
}

// ==============================
//  3. MODE GRID — 3列金刚区
// ==============================
.mode-section {
  padding: 0 $page-horizontal-padding;
  margin-top: $section-gap;
}

.section-title {
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  display: block;
  margin-bottom: $space-lg;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: $space-md;
}

.mode-card {
  background: var(--color-bg-card);
  border-radius: $radius-lg;
  padding: $space-xl $space-sm $space-lg;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: var(--shadow-neu-sm);
  transition: transform $duration-fast $ease-default;
  
  &:active {
    transform: scale(0.95);
  }
}

.mode-icon-wrapper {
  width: 88rpx;
  height: 88rpx;
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $space-md;
  
  &.sequence {
    background: linear-gradient(135deg, #E8F0FE, #D4E4FC);
  }
  
  &.random {
    background: linear-gradient(135deg, #E6F7EE, #D4F0E2);
  }
  
  &.wrong {
    background: linear-gradient(135deg, #FFF3E8, #FEE8D4);
  }
}

.mode-icon-text {
  font-size: 40rpx;
  line-height: 1;
}

.mode-name {
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  margin-bottom: $space-xs;
}

.mode-desc {
  font-size: $font-size-xs;
  color: var(--color-text-subtitle);
}

// ==============================
//  4. LIBRARY STACK — 多层叠加
// ==============================
.library-section {
  padding: 0 $page-horizontal-padding;
  margin-top: $section-gap;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $space-lg;
}

.section-more {
  font-size: $font-size-base;
  color: var(--color-primary);
  font-weight: $font-weight-medium;
  
  &:active {
    opacity: 0.7;
  }
}

.library-stack {
  position: relative;
  height: 220rpx; // 容纳最多3层卡片
}

.library-card-bg,
.library-card {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  border-radius: $radius-xl;
  transition: transform $duration-base $ease-default;
}

.library-card-bg {
  height: 140rpx;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-neu-sm);
  pointer-events: none;
}

.library-card {
  &.is-first {
    box-shadow: var(--shadow-neu-md);
    .library-card-inner {
      background: var(--color-bg-card);
    }
  }
}

.library-card-inner {
  display: flex;
  align-items: center;
  padding: $space-xl $space-lg;
  border-radius: $radius-xl;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-neu-sm);
}

// 题库封面 emoji（与题库管理/错题本页统一风格）
.library-cover-sm {
  width: 80rpx;
  height: 80rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #F0F0F3 0%, #E5E5EA 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: $space-lg;
  flex-shrink: 0;
}

.library-cover-emoji {
  font-size: 36rpx;
  line-height: 1;
}

.library-info {
  flex: 1;
  min-width: 0;
}

.library-name {
  display: block;
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4rpx;
}

.library-count {
  font-size: $font-size-xs;
  color: var(--color-text-subtitle);
}

.library-action {
  display: flex;
  align-items: center;
  margin-left: $space-md;
  flex-shrink: 0;
}

.library-action-text {
  font-size: $font-size-base;
  color: var(--color-primary);
  font-weight: $font-weight-medium;
}

.library-arrow {
  font-size: $font-size-sm;
  color: var(--color-primary);
  margin-left: 4rpx;
}

.library-empty {
  background: var(--color-bg-card);
  border-radius: $radius-xl;
  padding: $card-padding;
  box-shadow: var(--shadow-neu-md);
}

// ==============================
//  5. ACTION & FOOTER
// ==============================
.action-section {
  padding: 0 $page-horizontal-padding;
  margin-top: $section-gap;
}

.footer {
  text-align: center;
  margin-top: $space-xl;
}

.footer-text {
  font-size: $font-size-xs;
  color: var(--color-text-tertiary);
}
</style>
