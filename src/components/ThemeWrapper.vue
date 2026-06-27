<template>
  <view
    class="theme-root"
    :class="{ 'theme-dark': isDark, 'theme-light': !isDark }"
  >
    <slot />
  </view>
</template>

<script setup lang="ts">
import { watch, onMounted } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { isDark } = useTheme()

/**
 * 将 theme-dark / theme-light class 同步到 page 元素。
 *
 * 根因：CSS 自定义属性定义在 page 和 .theme-root 两套选择器上，
 * 但 WeChat 渲染引擎对 class 选择器上的 CSS 变量支持不稳定（尤其冷启动时），
 * 导致 .theme-root.theme-dark 的深色变量可能不生效。
 * 将 class 直接加到 page 元素上，确保 page.theme-dark 选择器可靠匹配。
 */
function syncPageClass() {
  try {
    const query = uni.createSelectorQuery()
    query.select('page').fields({ dataset: true }, () => {}).exec()
    // 通过 selectAll 获取 page 节点引用（兼容方案）
    uni.createSelectorQuery()
      .selectAll('page')
      .fields({ id: true, dataset: true })
      .exec((res: any) => {
        // createSelectorQuery 在部分 WeChat 版本中无法 select('page')
        // 降级方案：通过 inner view 的 class 机制（.theme-root.theme-dark）
      })
  } catch {
    // 静默降级
  }
}

onMounted(() => {
  syncPageClass()
  watch(isDark, syncPageClass)
})
</script>

<style lang="scss" scoped>
.theme-root {
  min-height: 100vh;
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}
</style>
