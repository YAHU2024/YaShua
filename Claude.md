# AGENTS.md

## Project Overview
雅刷 (YaShua) — 基于 Uni-app 3 + Vue 3 + TypeScript + Pinia 的跨端刷题小程序，使用 NutUI-UniApp 组件库和 SCSS Design Token 体系，后端依赖微信云开发（数据库 + 云函数 + 云存储）。

## Commands
- `npm run dev:h5` — H5 开发调试
- `npm run dev:mp-weixin` — 微信小程序开发调试
- `npm run type-check` — 提交流前 TS 类型检查（必须通过）
- `npm run build:mp-weixin` — 构建微信小程序生产包
- `npm run sync:cf` — 同步云函数到构建产物目录

## Architecture
```
src/
  pages/       — 5 个页面：index(首页), library(题库), quiz(答题), wrong(错题), settings
  stores/      — 5 个 Pinia Store：user, library, quiz, wrong, stats（云+本地双模）
  components/  — 公共组件：NavBar, QuestionCard, CircularProgress, EmptyState 等
  utils/       — 工具库：cloud, storage, parser, fileParser, aiParser
  styles/tokens/ — Design Token 变量（颜色、间距、阴影、排版、动画、圆角）
cloudfunctions/ — 4 个微信云函数：login, aiParse, importQuestions, parseFile
```

## Conventions
- **组件**：PascalCase 命名（`QuestionCard.vue`），文件名与组件名一致
- **Store**：camelCase，`useXxxStore` 模式（`useLibraryStore`），文件对应 store 名
- **页面**：每个页面目录入口统一为 `index.vue`，在 `pages.json` 中注册路由
- **类型**：共享类型集中在 `src/types/index.ts`，使用 `interface` 而非 `type`
- **路径别名**：`@/` → `src/`，禁止相对路径引用跨模块
- **SCSS**：所有颜色/间距/阴影使用 Token 变量（`$color-*`、`$space-*`、`$radius-*`）
- **云调用**：统一经过 `src/utils/cloud.ts` 的 `callFunction()`，不直接调 `uni.cloud`
- **本地存储 key**：`local_` 前缀（`local_libraries`、`local_wrong_questions`）
- **Git 分支前缀**：`codex/`
- **页面加载**：数据在 `onMounted`/`onShow` 中通过 Store action 加载

## Hard Constraints
- 不要绕过 `callFunction()` 直接调 `uni.cloud.callFunction()`（丢失统一错误处理和本地降级逻辑）
- 不要改动或删除 `local_` 前缀的本地 ID（云+本地双模依赖它区分数据来源）
- 不要在 `pages.json` 外硬编码导航路由字符串（小程序/H5 路由规则不同）
- 不要用硬编码值替代 `src/styles/tokens/` 中的 Design Token 变量（破坏视觉一致性）
- 不要编辑 cloudfunctions 中的 node_modules（云函数独立部署，npm install 在各自目录执行）
- 不要将 `DEEPSEEK_API_KEY` 等敏感配置硬编码到代码中（通过云函数环境变量注入）

## Gotchas
- 云开发 `uni.cloud.init()` 在 `App.vue` 的 `onLaunch` 中执行，Store 操作需等待其完成，否则静默降级到本地存储
- Canvas 2D 绘图：微信小程序无全局 `requestAnimationFrame`，必须用 `canvasNode.requestAnimationFrame()`，否则报 `TypeError`
- 多选题答案比较：`string[]` 需 `sort()` 后逐个比对，不能用 `===`
- 题库进度存储：复合 key `quiz_progress_{libraryId}_{mode}`，不同题库/模式完全隔离
- `.md/.txt` 导入走客户端本地 `parseRichMarkdown()`（~100ms）；`.docx/.xlsx` 必须走云函数上传→解析→AI 三条链路
- `uni.setStorageSync` 单 key 上限 1MB，大数据题库需分 key 或用云数据库
- Git baseline 为 `v1.0-baseline`，**禁止与 `origin/main` (c498efec) 合并**，会导致本地优化丢失
- `project.config.json` 已设 `ignoreDevUnusedFiles: false`，禁用了微信开发者工具"过滤无依赖文件"功能（uni-app 惰性标记可能被误判）
- 每日目标（dailyGoal）纯本地偏好，key 为 `daily_goal`，默认 20 题，不存云
