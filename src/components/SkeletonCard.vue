<template>
  <view class="skeleton-card" aria-hidden="true">
    <view
      v-for="n in lines"
      :key="n"
      class="sk-line shimmer"
      :style="{
        width: getWidth(n),
        height: height + 'rpx',
        marginBottom: gap + 'rpx',
        borderRadius: radius + 'rpx'
      }"
    />
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  lines?: number
  height?: number
  gap?: number
  radius?: number
  widths?: number[]
}>(), {
  lines: 3,
  height: 28,
  gap: 16,
  radius: 8
})

function getWidth(index: number): string {
  if (props.widths && props.widths[index - 1]) {
    return props.widths[index - 1] + '%'
  }
  if (index === props.lines) return '60%'
  if (index === 1) return '90%'
  return '80%'
}
</script>

<style lang="scss" scoped>
.skeleton-card {
  padding: 40rpx;
  background: #fff;
  border-radius: 32rpx;
}

.sk-line {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
</style>
