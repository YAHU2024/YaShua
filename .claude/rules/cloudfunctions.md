---
paths: ["cloudfunctions/**"]
---

# 云函数规则

- 云函数统一使用 `async function main(event, context)` 导出
- 返回值格式：`{ success: boolean, data?: any, message?: string }`
- 敏感配置（`DEEPSEEK_API_KEY` 等）通过云函数环境变量注入，不硬编码
- npm install 在各自云函数目录下执行，不在根目录
- 导入题目时显式设置 `_openid: openid` 以通过客户端安全规则
