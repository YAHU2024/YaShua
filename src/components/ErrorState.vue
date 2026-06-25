<template>
  <view class="error-state" role="alert">
    <text class="error-icon">⚠️</text>
    <text class="error-title">{{ message || '加载失败' }}</text>
    <text class="error-desc" v-if="detail">{{ detail }}</text>
    <button
      v-if="showRetry"
      class="retry-btn"
      :disabled="retrying"
      @click="$emit('retry')"
    >
      <view v-if="retrying" class="btn-spinner" />
      <text v-else>{{ retryText || '重新加载' }}</text>
    </button>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  message?: string
  detail?: string
  showRetry?: boolean
  retrying?: boolean
  retryText?: string
}>()

defineEmits<{
  (e: 'retry'): void
}>()
</script>

<style lang="scss" scoped>
@import '@/styles/tokens/_index.scss';

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx $space-xl;
}

.error-icon {
  font-size: 80rpx;
  margin-bottom: $space-lg;
  line-height: 1;
}

.error-title {
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  color: $color-error;
  margin-bottom: $space-sm;
}

.error-desc {
  font-size: $font-size-base;
  color: $color-text-tertiary;
  margin-bottom: $space-md;
}

.retry-btn {
  margin-top: $space-md;
  min-width: 200rpx;
  height: $btn-height-md;
  background: $color-error;
  color: $color-text-inverse;
  border-radius: $radius-lg;
  font-size: $font-size-lg;
  font-weight: $font-weight-medium;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 $space-xl;

  &:active {
    opacity: 0.8;
  }

  &[disabled] {
    opacity: 0.6;
  }
}

.btn-spinner {
  width: 32rpx;
  height: 32rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
