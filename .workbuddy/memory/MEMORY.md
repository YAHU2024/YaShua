# 智慧刷题项目 - 长期记忆

## 项目信息
- **appid**: wxeabb8b5fdc889d94
- **云环境 ID**: cloud1-d6gspphu1758644bc
- **项目名**: 智慧刷题（uni-app + Vue3 + Pinia + 微信云开发）
- **构建命令**: `npm run build:mp-weixin` → 产物在 `dist/build/mp-weixin/`

## 关键技术决策
- 云开发环境 ID 已硬编码在 `src/utils/cloud.ts` 和 `src/App.vue` 中
- 所有依赖云开发的操作都有本地 storage 降级方案
- 用户登录有本地降级（云不可用时使用本地匿名 ID）
- vite.config.ts 中有 copyCloudFunctions 插件，构建时自动复制云函数到产物目录
- AI 解析使用 DeepSeek `deepseek-v4-flash` 模型（$0.14/M 输入 + $0.28/M 输出），max_tokens=4000
- DeepSeek API Key 通过云函数环境变量 `DEEPSEEK_API_KEY` 配置，不在代码中硬编码
- 云数据库查询需分页处理（微信云每次最多返回20条），`getQuestions`/`loadLibraries` 已实现 skip+limit 分页
- importQuestions 云函数写入题目时显式设置 `_openid: openid`，确保客户端安全规则可读
- 云集合安全规则需设为 `"read": true`（题库/题目为公开学习内容）
- URL 参数传递 libraryId 时使用 `encodeURIComponent`/`decodeURIComponent`
- 页面 onMounted 需先调用 `ensureCloudReady()` 等待云初始化完成
- 刷题进度用复合键 `quiz_progress_{libraryId}_{mode}` 存储，不同题库/模式完全隔离
- 错题收集为实时逐题记录（confirmAnswer 答错即写入），同时保留交卷时的批量写入作为兜底
- 进入练习时检测上次进度，弹窗选择继续/重来/返回（错题模式不支持恢复）
- Git 基线：v1.0-baseline（16b115c），**切勿与 c498efec (origin/main) 合并**，会导致本地优化丢失
- project.config.json 已设置 `ignoreDevUnusedFiles: false` + `ignoreUploadUnusedFiles: false`，禁用微信开发者工具"过滤无依赖文件"功能（uni-app 的 `Math||()` 惰性标记会被误判为死代码）
