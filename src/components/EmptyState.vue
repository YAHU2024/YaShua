<template>
  <view class="empty-state" role="status">
    <text class="empty-icon">{{ icon }}</text>
    <text class="empty-title">{{ title }}</text>
    <text class="empty-desc" v-if="description">{{ description }}</text>
    <button v-if="actionText" class="empty-action-btn" @click="$emit('action')">
      {{ actionText }}
    </button>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
  actionText?: string
}>()

defineEmits<{
  (e: 'action'): void
}>()
</script>

<style lang="scss" scoped>
@import '@/styles/tokens/_index.scss';

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx $space-xl;
}

.empty-icon {
  font-size: 96rpx;
  margin-bottom: $space-xl;
  line-height: 1;
}

.empty-title {
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  color: $color-text-primary;
  margin-bottom: $space-sm;
}

.empty-desc {
  font-size: $font-size-base;
  color: $color-text-tertiary;
  margin-bottom: $space-md;
}

.empty-action-btn {
  margin-top: $space-md;
  min-width: 200rpx;
  height: $btn-height-md;
  background: $gradient-primary;
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
}
</style>
