<template>
  <view class="loading-state" role="status" :aria-label="text || '加载中'">
    <view class="spinner">
      <view
        v-for="i in 3"
        :key="i"
        class="spinner-ring"
        :style="{ animationDelay: `${(i - 1) * 0.15}s` }"
      />
    </view>
    <text class="loading-text" v-if="text">{{ text }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  text?: string
}>()
</script>

<style lang="scss" scoped>
@import '@/styles/tokens/_index.scss';

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $space-3xl;
}

.spinner {
  width: 80rpx;
  height: 80rpx;
  position: relative;
  margin-bottom: $space-lg;
}

.spinner-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 6rpx solid transparent;
  border-top-color: $color-primary;
  border-radius: 50%;
  animation: spin 1s $ease-default infinite;
}

.loading-text {
  font-size: $font-size-base;
  color: $color-text-tertiary;
}
</style>
