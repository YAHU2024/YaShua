<template>
  <view class="navbar">
    <view class="navbar-status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="navbar-content">
      <view class="navbar-left" @click="handleBack" v-if="showBack" aria-label="返回上一页">
        <text class="back-icon">←</text>
      </view>
      <view class="navbar-title">{{ title }}</view>
      <view class="navbar-right">
        <slot name="right"></slot>
      </view>
    </view>
  </view>
  <view class="navbar-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title: string
  showBack?: boolean
}>()

const statusBarHeight = ref(20)

try {
  const windowInfo = uni.getWindowInfo()
  statusBarHeight.value = windowInfo.statusBarHeight || 20
} catch (e) {
  uni.getSystemInfo({
    success: (res) => {
      statusBarHeight.value = res.statusBarHeight || 20
    }
  })
}

function handleBack() {
  uni.navigateBack({
    fail: () => {
      uni.switchTab({ url: '/pages/index/index' })
    }
  })
}
</script>

<style lang="scss" scoped>
@import '@/styles/tokens/_index.scss';

.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: var(--color-glass-nav-bg);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1rpx solid var(--color-glass-nav-border);
}

.navbar-status-bar {
  width: 100%;
}

.navbar-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx; // 44px
  padding: 0 $space-lg;
}

.navbar-left {
  width: $touch-target-min;
  height: $touch-target-min;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: $font-size-2xl;
  color: var(--color-text-primary);
}

.navbar-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: $font-size-xl;
  font-weight: $font-weight-bold;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.navbar-right {
  width: $touch-target-min;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.navbar-placeholder {
  width: 100%;
}
</style>