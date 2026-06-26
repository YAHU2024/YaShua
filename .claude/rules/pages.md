---
paths: ["src/pages/**"]
---

# 页面规则

- 每个页面目录下入口文件必须为 `index.vue`
- 使用 `<script setup lang="ts">` + `<template>` + `<style lang="scss" scoped>`
- 优先使用 `@/components/` 公共组件，不在页面内重复造轮子
- 数据加载统一在 `onMounted`/`onShow` 中调用 Store action
- `pages.json` 注册所有页面路由，tabBar 页使用 `switchTab` 跳转
- 页面间传参使用 URL query，`libraryId` 需经 `encodeURIComponent`/`decodeURIComponent`
