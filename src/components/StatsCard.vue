<template>
  <view class="stats-card">
    <view class="stats-header">
      <text class="stats-title">{{ title }}</text>
    </view>
    <view class="stats-content">
      <view class="stat-item">
        <text class="stat-value animated">{{ value }}</text>
        <text class="stat-label">{{ label }}</text>
      </view>
      <view v-if="subValue !== undefined" class="stat-item sub-item">
        <text class="stat-value animated">{{ subValue }}</text>
        <text class="stat-label">{{ subLabel }}</text>
      </view>
    </view>
    <view v-if="progress !== undefined" class="progress-section">
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progress + '%' }"></view>
      </view>
      <text class="progress-text">{{ progress }}%</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { watch } from 'vue'

const props = defineProps<{
  title: string
  value: string | number
  label: string
  subValue?: string | number
  subLabel?: string
  progress?: number
}>()

watch(() => props.value, (newVal) => {
  console.log(`[StatsCard.${props.title}] value 变化: ${newVal}`)
})
watch(() => props.subValue, (newVal) => {
  console.log(`[StatsCard.${props.title}] subValue 变化: ${newVal}`)
})
</script>

<style lang="scss" scoped>
@import '@/styles/tokens/_index.scss';

.stats-card {
  background: $gradient-primary;
  border-radius: $radius-xl;
  padding: $space-xl;
  color: $color-text-inverse;
}

.stats-header {
  margin-bottom: $space-lg;
}

.stats-title {
  font-size: $font-size-base;
  opacity: 0.8;
}

.stats-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.stat-item {
  &.sub-item {
    .stat-value {
      font-size: 48rpx;
    }
    .stat-label {
      font-size: $font-size-sm;
    }
  }
}

.stat-value {
  display: block;
  font-size: 72rpx;
  font-weight: $font-weight-bold;
  animation: countUp $duration-slow $ease-out;
}

.stat-label {
  display: block;
  font-size: $font-size-xs;
  opacity: 0.8;
  margin-top: $space-xs;
}

.progress-section {
  margin-top: $space-lg;
}

.progress-bar {
  height: 12rpx;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: $color-text-inverse;
  border-radius: 6rpx;
  transition: width $duration-base $ease-default;
}

.progress-text {
  display: block;
  text-align: right;
  font-size: $font-size-sm;
  margin-top: $space-xs;
  opacity: 0.8;
}
</style>
