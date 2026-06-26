---
paths: ["src/components/**"]
---

# 组件规则

- 文件名使用 PascalCase（`QuestionCard.vue`），default export 名与文件名一致
- 统一使用 `<script setup lang="ts">` + `<style lang="scss" scoped>`
- Props 用 `withDefaults(defineProps<...>(), {...})` 提供默认值
- 不在组件内写 `page` 或 `html`/`body` 选择器（`App.vue` 统一管理）
- 组件内部状态用 `ref`，跨组件状态通过 Store 透传
- 需要父页面触发的操作（如重绘），通过 `defineExpose` 暴露方法（如 `redraw()`）
