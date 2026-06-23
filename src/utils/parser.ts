import type { Question, JSONQuestion } from '@/types'

export function parseMarkdown(content: string): Question[] {
  const questions: Question[] = []
  const lines = content.split('\n').map(line => line.trim())
  
  let currentQuestion: Partial<Question> = {}
  let currentOptions: string[] = []
  let inQuestion = false
  let libraryId = 'default'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (line.startsWith('# ')) {
      continue
    }
    
    if (line.startsWith('## ')) {
      if (inQuestion && currentQuestion.content) {
        questions.push(completeQuestion(currentQuestion, currentOptions, libraryId))
        currentQuestion = {}
        currentOptions = []
      }
      inQuestion = false
      continue
    }
    
    const numberMatch = line.match(/^(\d+)\.\s*(.+)/)
    if (numberMatch) {
      if (inQuestion && currentQuestion.content) {
        questions.push(completeQuestion(currentQuestion, currentOptions, libraryId))
      }
      currentQuestion = { content: numberMatch[2], options: [] }
      currentOptions = []
      inQuestion = true
      continue
    }
    
    const optionMatch = line.match(/^([A-Za-z])\.\s*(.+)/)
    if (optionMatch && inQuestion) {
      currentOptions.push(`${optionMatch[1]}. ${optionMatch[2]}`)
      continue
    }
    
    const answerMatch = line.match(/^答案[：:]?\s*(.+)/)
    if (answerMatch && inQuestion) {
      const answerText = answerMatch[1].trim()
      if (answerText.includes('正确') || answerText.includes('错误')) {
        currentQuestion.type = 'judge'
        currentQuestion.answer = answerText.includes('正确') ? ['正确'] : ['错误']
      } else {
        const answers = answerText.split(/[,，]/).map(a => a.trim().toUpperCase()).filter(Boolean)
        currentQuestion.type = answers.length > 1 ? 'multiple' : 'single'
        currentQuestion.answer = answers
      }
      continue
    }
    
    const analysisMatch = line.match(/^解析[：:]?\s*(.+)/)
    if (analysisMatch && inQuestion) {
      currentQuestion.analysis = analysisMatch[1].trim()
      continue
    }
  }
  
  if (inQuestion && currentQuestion.content) {
    questions.push(completeQuestion(currentQuestion, currentOptions, libraryId))
  }
  
  return questions
}

/**
 * 补全题目信息，确保返回完整的 Question 对象
 * BUG-02: 修复 question.options 可能为 undefined 时访问 .length 导致的 TypeError
 */
function completeQuestion(
  question: Partial<Question>,
  options: string[],
  libraryId: string
): Question {
  return {
    libraryId,
    type: question.type || 'single',
    content: question.content || '',
    options: (question.options && question.options.length > 0) ? question.options : (options.length > 0 ? options : undefined),
    answer: question.answer || [],
    analysis: question.analysis || '',
    difficulty: question.difficulty || 1
  }
}

export function parseQuestionBlock(block: string): Question {
  const lines = block.split('\n').map(line => line.trim())
  const question: Partial<Question> = { options: [] }
  const options: string[] = []

  for (const line of lines) {
    const numberMatch = line.match(/^(\d+)\.\s*(.+)/)
    if (numberMatch) {
      question.content = numberMatch[2]
      continue
    }

    const optionMatch = line.match(/^([A-Za-z])\.\s*(.+)/)
    if (optionMatch) {
      options.push(`${optionMatch[1]}. ${optionMatch[2]}`)
      continue
    }

    const answerMatch = line.match(/^答案[：:]?\s*(.+)/)
    if (answerMatch) {
      const answerText = answerMatch[1].trim()
      if (answerText.includes('正确') || answerText.includes('错误')) {
        question.type = 'judge'
        question.answer = answerText.includes('正确') ? ['正确'] : ['错误']
      } else {
        const answers = answerText.split(/[,，]/).map(a => a.trim().toUpperCase()).filter(Boolean)
        question.type = answers.length > 1 ? 'multiple' : 'single'
        question.answer = answers
      }
      continue
    }

    const analysisMatch = line.match(/^解析[：:]?\s*(.+)/)
    if (analysisMatch) {
      question.analysis = analysisMatch[1].trim()
      continue
    }
  }

  const resolvedOptions = (question.options && question.options.length > 0)
    ? question.options
    : (options.length > 0 ? options : undefined)

  return {
    libraryId: 'default',
    type: question.type || 'single',
    content: question.content || '',
    options: resolvedOptions,
    answer: question.answer || [],
    analysis: question.analysis || '',
    difficulty: question.difficulty || 1
  }
}

export function detectQuestionType(content: string): 'single' | 'multiple' | 'judge' {
  const answerMatch = content.match(/答案[：:]?\s*(.+)/)
  if (answerMatch) {
    const answerText = answerMatch[1].trim()
    if (answerText.includes('正确') || answerText.includes('错误')) {
      return 'judge'
    }
    const answers = answerText.split(/[,，]/).map(a => a.trim()).filter(Boolean)
    return answers.length > 1 ? 'multiple' : 'single'
  }
  return 'single'
}

/**
 * 解析 JSON 格式的题目数组
 * 输入为 JSON 字符串，期望是一个 JSONQuestion 对象数组
 */
export function parseJSON(content: string): { success: boolean; questions: Question[]; error?: string } {
  try {
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      return { success: false, questions: [], error: 'JSON 格式错误：期望一个题目数组' }
    }
    const questions: Question[] = []
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] as JSONQuestion
      if (!item.question) {
        return { success: false, questions: [], error: `第 ${i + 1} 题缺少题干（question 字段）` }
      }
      if (!item.answer || (Array.isArray(item.answer) && item.answer.length === 0)) {
        return { success: false, questions: [], error: `第 ${i + 1} 题缺少答案（answer 字段）` }
      }
      const answer = Array.isArray(item.answer) ? item.answer.map(String) : [String(item.answer)]
      let type = item.type || 'single'
      if (!['single', 'multiple', 'judge'].includes(type)) {
        // 根据答案数量推断
        type = answer.length > 1 ? 'multiple' : 'single'
      }
      questions.push({
        libraryId: '',
        type,
        content: item.question,
        options: item.options || undefined,
        answer,
        analysis: item.explanation || '',
        difficulty: 1,
        createdAt: new Date()
      })
    }
    return { success: true, questions }
  } catch (e: any) {
    return { success: false, questions: [], error: `JSON 解析失败：${e.message}` }
  }
}
