import type { Question } from '@/types'
import { callFunction } from './cloud'

export async function parseText(text: string): Promise<Question[]> {
  try {
    const result = await callFunction('aiParse', { text })
    if (result.success && result.data) {
      return result.data
    }
    return []
  } catch (e) {
    console.error('AI 解析失败', e)
    return []
  }
}