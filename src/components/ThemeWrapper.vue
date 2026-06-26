<template>
  <view
    class="theme-root"
    :class="{ 'theme-dark': isDark, 'theme-light': !isDark }"
  >
    <slot />
  </view>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { isDark } = useTheme()
</script>

<style lang="scss" scoped>
.theme-root {
  min-height: 100vh;
}
</style>
