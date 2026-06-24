import type { Question } from '@/types'

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

function completeQuestion(
  question: Partial<Question>,
  options: string[],
  libraryId: string
): Question {
  return {
    libraryId,
    type: question.type || 'single',
    content: question.content || '',
    options: question.options.length > 0 ? question.options : options,
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

  return {
    libraryId: 'default',
    type: question.type || 'single',
    content: question.content || '',
    options: question.options && question.options.length > 0 ? question.options : options,
    answer: question.answer || [],
    analysis: question.analysis || '',
    difficulty: question.difficulty || 1
  }
}

/**
 * 解析富文本 Markdown 格式题库（已知格式：## N. 题目 + **题型** + **答案** + **原因** + **选项**）
 * 作为 AI 解析失败时的本地降级方案
 */
export function parseRichMarkdown(content: string): Question[] {
  const questions: Question[] = []

  // 按 ## N. 题号分割
  const blocks = content.split(/\n(?=##\s+\d+\.)/)

  for (const block of blocks) {
    const q = parseRichQuestionBlock(block)
    if (q) {
      questions.push(q)
    }
  }

  return questions
}

function parseRichQuestionBlock(block: string): Question | null {
  const lines = block.split('\n')

  let content = ''
  let type: Question['type'] = 'single'
  let answer: string[] = []
  let analysis = ''
  const options: string[] = []

  let inOptions = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // ## N. 题目内容
    const headerMatch = trimmed.match(/^##\s+\d+\.\s*(.+)/)
    if (headerMatch) {
      content = headerMatch[1].trim()
      continue
    }

    // 跳过文件级标题
    if (/^#\s/.test(trimmed) && !content) continue

    // **题型**：单选题/多选题/判断题
    const typeMatch = trimmed.match(/^\*\*题型\*\*[：:]\s*(.+)/)
    if (typeMatch) {
      const typeText = typeMatch[1].trim()
      if (typeText.includes('多选')) {
        type = 'multiple'
      } else if (typeText.includes('判断')) {
        type = 'judge'
      }
      // 默认保持 single
      continue
    }

    // **答案**：X
    const answerMatch = trimmed.match(/^\*\*答案\*\*[：:]\s*(.+)/)
    if (answerMatch) {
      const answerText = answerMatch[1].trim()
      if (type === 'judge') {
        if (answerText.includes('正确') || answerText.includes('对') || answerText === 'A') {
          answer = ['正确']
        } else if (answerText.includes('错误') || answerText.includes('错') || answerText === 'B') {
          answer = ['错误']
        } else {
          answer = ['正确'] // 安全默认
        }
      } else {
        answer = answerText.split(/[,，、;\s]+/).map(a => a.trim().toUpperCase()).filter(Boolean)
      }
      continue
    }

    // **原因**：xxx 或 **解析**：xxx
    const analysisMatch = trimmed.match(/^\*\*(?:原因|解析)\*\*[：:]\s*(.+)/)
    if (analysisMatch) {
      analysis = analysisMatch[1].trim()
      continue
    }

    // **选项**： 标记进入选项区
    if (/^\*\*选项\*\*[：:]/.test(trimmed)) {
      inOptions = true
      continue
    }

    // 选项行：- A. xxx 或 - A、xxx
    if (inOptions) {
      const optionMatch = trimmed.match(/^[-—]\s*([A-Za-z])[.、．]\s*(.+)/)
      if (optionMatch) {
        options.push(`${optionMatch[1].toUpperCase()}. ${optionMatch[2].trim()}`)
      }
    }
  }

  if (!content) return null

  // 判断题默认选项
  if (type === 'judge' && options.length === 0) {
    options.push('正确', '错误')
  }

  return {
    libraryId: '',
    type,
    content,
    options,
    answer,
    analysis,
    difficulty: 1
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