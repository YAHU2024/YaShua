<template>
  <view class="stats-card">
    <view class="stats-header">
      <text class="stats-title">{{ title }}</text>
    </view>
    <view class="stats-content">
      <view class="stat-item">
        <text class="stat-value">{{ value }}</text>
        <text class="stat-label">{{ label }}</text>
      </view>
      <view v-if="subValue !== undefined" class="stat-item sub-item">
        <text class="stat-value">{{ subValue }}</text>
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
.stats-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 20px;
  color: #fff;
}

.stats-header {
  margin-bottom: 16px;
}

.stats-title {
  font-size: 14px;
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
      font-size: 24px;
    }
    
    .stat-label {
      font-size: 12px;
    }
  }
}

.stat-value {
  display: block;
  font-size: 36px;
  font-weight: 700;
}

.stat-label {
  display: block;
  font-size: 13px;
  opacity: 0.8;
  margin-top: 4px;
}

.progress-section {
  margin-top: 16px;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #fff;
  border-radius: 3px;
  transition: width 0.3s;
}

.progress-text {
  display: block;
  text-align: right;
  font-size: 12px;
  margin-top: 4px;
  opacity: 0.8;
}
</style>