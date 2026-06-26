---
paths: ["src/stores/**"]
---

# Pinia Store 规则

- 统一使用 `defineStore` + `ref`/`computed` Composition API 模式
- 云+本地双模：先尝试云 API，catch 中立即降级到 `uni.setStorageSync`
- 错误处理：内部 try-catch + console.error，异常不抛出到组件层
- 本地存储 key 以 `local_` 前缀命名（如 `local_libraries`）
- 每道题答案实时记录：答对调 `recordSingleAnswer(true)`，答错调 `addWrongQuestion()`
- 错误处理统一在 Store 内部完成，组件层不关心降级细节
