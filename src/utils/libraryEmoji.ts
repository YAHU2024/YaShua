/**
 * 题库封面 emoji 工具 — 各页面统一引用，同一题库 ID 始终映射到同一 emoji
 *
 * 使用方式：
 *   import { getLibraryEmoji, LIBRARY_EMOJIS } from '@/utils/libraryEmoji'
 *   const emoji = getLibraryEmoji(libraryId)
 */

/** 题库封面 emoji 候选集（16 个学习/书籍相关 emoji） */
export const LIBRARY_EMOJIS: readonly string[] = [
  '📚', '📖', '📕', '📗', '📘', '📙',
  '🎓', '💡', '🧠', '⭐', '🔬', '📝',
  '🏆', '🌟', '📐', '🔮'
] as const

/**
 * Java-style 字符串 hash，结果稳定跨进程。
 * 注：此 hash 不可用于安全场景，仅用于将题库 ID 映射到 emoji 集合。
 */
export function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // 转 32-bit int
  }
  return Math.abs(hash)
}

/**
 * 根据题库 ID 返回固定 emoji（同一 ID 始终相同）。
 * @param libraryId 题库 _id 字符串
 */
export function getLibraryEmoji(libraryId: string): string {
  return LIBRARY_EMOJIS[hashCode(libraryId) % LIBRARY_EMOJIS.length]
}
