---
paths: ["src/types/**"]
---

# 类型定义规则

- 所有共享类型集中在 `src/types/index.ts` 中
- 使用 `interface` 而非 `type` 定义对象类型
- 可选字段用 `?` 标记（如 `_id?: string`）
- 字段名使用 camelCase
- 枚举类字段使用 literal union type（如 `type: 'single' | 'multiple' | 'judge'`）
