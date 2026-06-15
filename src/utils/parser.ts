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