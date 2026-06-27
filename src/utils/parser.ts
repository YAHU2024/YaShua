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

/**
 * 解析 DOCX 提取的纯文本格式题库
 * 已知格式（题库导出工具生成）：
 *   N. 题目内容
 *   题型：单选题/多选题/判断题，X.X 分
 *   答案：X 原因：解释文本
 *   选项： - A. 选项1 - B. 选项2 - C. 选项3 - D. 选项4
 *
 * 也兼容以下变体：
 *   - 题号用 "N、" 而非 "N."
 *   - 答案行无原因：仅 "答案：X"
 *   - 选项每行一个（"- A. text"）而非行内
 *   - 判断题答案直接写 "正确"/"错误" 而非字母
 */
export function parseDocxText(content: string): Question[] {
  const questions: Question[] = []
  const lines = content.split('\n').map(l => l.trim())

  let current: Partial<Question> | null = null
  let currentOptions: string[] = []

  const flushQuestion = () => {
    if (current && current.content) {
      const opts = current.options && current.options.length > 0 ? current.options : currentOptions
      if (current.type === 'judge' && opts.length === 0) {
        opts.push('正确', '错误')
      }
      questions.push({
        libraryId: '',
        type: current.type || 'single',
        content: current.content,
        options: opts,
        answer: current.answer || [],
        analysis: current.analysis || '',
        difficulty: current.difficulty || 1
      })
    }
    current = null
    currentOptions = []
  }

  for (const line of lines) {
    if (!line) continue

    // 跳过分组标题：如 "1（第1-50题）"、"第一部分" 等
    if (/^\d+[\s]*[（(]第\s*\d+/.test(line) || /^第[一二三四五六七八九十\d]+[部章节]/.test(line)) {
      continue
    }

    // 跳过文件级标题
    if (/^题库.*汇总版/.test(line) || (/^#/.test(line) && !current)) {
      continue
    }

    // 题号行：N. 题目内容 或 N、题目内容
    const qMatch = line.match(/^(\d+)\s*[\.、．]\s*(.+)/)
    if (qMatch) {
      flushQuestion()
      current = { content: qMatch[2].trim(), options: [] }
      currentOptions = []
      continue
    }

    if (!current) continue

    // 题型行：题型：单选题/多选题/判断题（，X.X 分 可选）
    const typeMatch = line.match(/^题型[：:]\s*(单选题|多选题|判断题)/)
    if (typeMatch) {
      const typeText = typeMatch[1]
      if (typeText.includes('多选')) current.type = 'multiple'
      else if (typeText.includes('判断')) current.type = 'judge'
      else current.type = 'single'
      continue
    }

    // 答案行（含原因/解析）：答案：D 原因：xxx 或 答案：D 解析：xxx
    const answerReasonMatch = line.match(/^答案[：:]\s*([A-Za-z]+)\s*(?:原因|解析)[：:]\s*(.+)/)
    if (answerReasonMatch) {
      const answerLetter = answerReasonMatch[1].trim().toUpperCase()
      current.analysis = answerReasonMatch[2].trim()
      if (current.type === 'judge') {
        current.answer = answerLetter === 'A' || answerLetter === 'T' ? ['正确'] : ['错误']
      } else {
        current.answer = answerLetter.split('').filter(c => /[A-Z]/.test(c))
        if (current.answer.length > 1) current.type = 'multiple'
      }
      continue
    }

    // 答案行（无原因）：答案：D 或 答案：正确/错误
    const answerMatch = line.match(/^答案[：:]\s*(.+)/)
    if (answerMatch && !answerReasonMatch) {
      const answerText = answerMatch[1].trim()
      if (current.type === 'judge' || answerText.includes('正确') || answerText.includes('错误')) {
        current.type = 'judge'
        current.answer = answerText.includes('正确') ? ['正确'] : ['错误']
      } else {
        const letters = answerText.split(/[,，、;\s]+/).map(a => a.trim().toUpperCase()).filter(Boolean)
        current.answer = letters
        if (letters.length > 1) current.type = 'multiple'
      }
      continue
    }

    // 选项行（行内格式）：选项： - A. text - B. text - C. text - D. text
    const optionsLineMatch = line.match(/^选项[：:]\s*(.+)/)
    if (optionsLineMatch) {
      const optionsText = optionsLineMatch[1]
      // 按 " - " 或 " - " 分割提取各选项
      const optionParts = optionsText.split(/\s+[-—]\s+/)
      for (const part of optionParts) {
        const optMatch = part.trim().match(/^([A-Za-z])\s*[\.、．]\s*(.+)/)
        if (optMatch) {
          currentOptions.push(`${optMatch[1].toUpperCase()}. ${optMatch[2].trim()}`)
        }
      }
      continue
    }

    // 选项行（逐行格式）：- A. text 或 A. text
    const singleOptMatch = line.match(/^[-—]\s*([A-Za-z])\s*[\.、．]\s*(.+)/)
    if (singleOptMatch) {
      currentOptions.push(`${singleOptMatch[1].toUpperCase()}. ${singleOptMatch[2].trim()}`)
      continue
    }

    // 解析行（独立行）：解析：xxx
    const analysisMatch = line.match(/^(?:解析|原因)[：:]\s*(.+)/)
    if (analysisMatch && !current.analysis) {
      current.analysis = analysisMatch[1].trim()
      continue
    }
  }

  // 刷出最后一题
  flushQuestion()

  return questions
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