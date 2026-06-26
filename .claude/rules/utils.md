---
paths: ["src/utils/**"]
---

# 工具函数规则

- 纯函数用 `export function` / `export async function` 导出
- 云 API 封装统一经过 `cloud.ts` 的 `callFunction()`，不直接调 `uni.cloud.callFunction`
- 文件解析类函数（`parser.ts`）必须是纯函数，不依赖 VNode 或 DOM
- 存储相关工具集中到 `storage.ts`，不分散到各文件中
- 客户端本地解析 `parseRichMarkdown()` 仅针对 `.md/.txt`；其他格式走云函数
