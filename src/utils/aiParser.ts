import type { Question } from '@/types'
import { aiParseQuestions } from './fileParser'

/**
 * AI 解析题库文本
 * @param text 题库文本内容
 * @returns 解析出的题目数组
 */
export async function parseText(text: string): Promise<Question[]> {
  try {
    return await aiParseQuestions(text)
  } catch (e) {
    console.error('AI 解析失败', e)
    throw e
  }
}
