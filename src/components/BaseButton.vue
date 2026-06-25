<template>
  <button
    class="base-btn"
    :class="classes"
    :disabled="disabled || loading"
    :aria-label="ariaLabel"
    @click="handleClick"
  >
    <view v-if="loading" class="btn-spinner" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  block?: boolean
  loading?: boolean
  disabled?: boolean
  ariaLabel?: string
}>(), {
  size: 'md',
  variant: 'primary',
  block: false,
  loading: false,
  disabled: false
})

const emit = defineEmits<{
  (e: 'click'): void
}>()

const classes = computed(() => [
  `btn-${props.size}`,
  `btn-${props.variant}`,
  { 'btn-block': props.block, 'btn-loading': props.loading }
])

function handleClick() {
  if (!props.disabled && !props.loading) {
    emit('click')
  }
}
</script>

<style lang="scss" scoped>
@import '@/styles/tokens/_index.scss';

.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  font-weight: $font-weight-medium;
  border-radius: $radius-lg;
  transition: opacity $duration-instant, transform $duration-instant;

  &:active:not([disabled]) {
    transform: scale(0.97);
  }

  &[disabled] {
    opacity: 0.4;
  }

  &.btn-block {
    display: flex;
    width: 100%;
  }

  // Sizes
  &.btn-sm {
    height: $btn-height-sm;
    font-size: $font-size-sm;
    padding: 0 $space-md;
    border-radius: $radius-md;
  }

  &.btn-md {
    height: $btn-height-md;
    font-size: $font-size-base;
    padding: 0 $space-lg;
  }

  &.btn-lg {
    height: $btn-height-lg;
    font-size: $font-size-lg;
    padding: 0 $space-xl;
  }

  &.btn-xl {
    height: $btn-height-xl;
    font-size: $font-size-lg;
    padding: 0 $space-xl;
  }

  // Variants
  &.btn-primary {
    background: $gradient-primary;
    color: $color-text-inverse;
  }

  &.btn-secondary {
    background: $color-bg-input;
    color: $color-text-secondary;
  }

  &.btn-outline {
    background: transparent;
    border: 2rpx solid $color-primary;
    color: $color-primary;
  }

  &.btn-ghost {
    background: transparent;
    color: $color-text-secondary;
  }
}

.btn-spinner {
  width: 32rpx;
  height: 32rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: $space-sm;
}

.btn-outline .btn-spinner,
.btn-ghost .btn-spinner,
.btn-secondary .btn-spinner {
  border-color: rgba(102, 126, 234, 0.2);
  border-top-color: $color-primary;
}
</style>
