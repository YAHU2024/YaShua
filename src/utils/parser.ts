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

// ============ HTML / DOC 工具函数 ============

/**
 * 去除 HTML 标签并解码常见 HTML 实体，返回纯文本
 */
function stripHtmlTags(html: string): string {
  let text = html
  // 移除 <style> 和 <script> 块
  text = text.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
  // 将块级标签替换为换行
  text = text.replace(/<\/(?:p|div|br|tr|li|h[1-6])>/gi, '\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  // 移除所有剩余标签
  text = text.replace(/<[^>]+>/g, '')
  // 解码常见 HTML 实体
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  text = text.replace(/&#[xX]([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
  // 合并多余空行
  text = text.replace(/\n{3,}/g, '\n\n')
  return text
}

/**
 * 从 .doc 文件二进制内容中提取 HTML 文本
 * 许多在线考试系统导出的 .doc 实际上是 OLE 容器包裹的 HTML
 */
export function extractHtmlFromDoc(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer)
  // 在二进制中搜索 <html 标记（ASCII: 3C 68 74 6D 6C）
  const marker = [0x3C, 0x68, 0x74, 0x6D, 0x6C] // '<html'
  let htmlStart = -1
  for (let i = 0; i < bytes.length - marker.length; i++) {
    let found = true
    for (let j = 0; j < marker.length; j++) {
      if (bytes[i + j] !== marker[j]) { found = false; break }
    }
    if (found) { htmlStart = i; break }
  }
  if (htmlStart < 0) return null

  // 也尝试找 <!doctype
  const doctypeMarker = [0x3C, 0x21, 0x44, 0x4F, 0x43] // '<!DOC'
  for (let i = Math.max(0, htmlStart - 100); i < htmlStart; i++) {
    let found = true
    for (let j = 0; j < doctypeMarker.length; j++) {
      if (bytes[i + j] !== doctypeMarker[j]) { found = false; break }
    }
    if (found) { htmlStart = i; break }
  }

  const htmlBytes = bytes.slice(htmlStart)
  // 将字节数组转为 binary 字符串，再按 UTF-8 解码
  let binary = ''
  for (let i = 0; i < htmlBytes.length; i++) {
    binary += String.fromCharCode(htmlBytes[i])
  }
  try {
    const text = decodeURIComponent(escape(binary))
    return stripHtmlTags(text)
  } catch {
    return stripHtmlTags(binary)
  }
}

// ============ 导出工具 .doc 格式解析 ============

/**
 * 解析在线考试系统导出的 .doc 文本格式题库
 *
 * 支持格式：
 *   N、题目内容
 *   A、选项A内容       （或 A、\n选项A内容）
 *   B、选项B内容
 *   C、选项C内容
 *   D、选项D内容
 *   答案：X            （或 答案：\nX）
 *   解析：xxx           （可选）
 *
 * 也支持判断题（答案为 正确/错误）和简答题（无选项，答案为文本）
 * 无选项且无 正确/错误 答案的题目会被跳过（如实操题）
 */
export function parseExportDoc(content: string): Question[] {
  const questions: Question[] = []
  const lines = content.split('\n').map(l => l.trim())

  // 找到所有题目起始行的索引
  // 注意：只匹配中文顿号"、"或全角点"．"作为题号分隔符，
  // 不使用半角点"."以避免将 IP 地址（如 192.168.1.1）误识别为题号
  const questionStarts: { index: number; num: number; content: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d+)\s*[、．]\s*(.+)/)
    if (m) {
      questionStarts.push({ index: i, num: parseInt(m[1]), content: m[2].trim() })
    }
  }

  for (let qi = 0; qi < questionStarts.length; qi++) {
    const start = questionStarts[qi]
    const end = qi + 1 < questionStarts.length ? questionStarts[qi + 1].index : lines.length

    const qContent = start.content
    const options: string[] = []
    let answer = ''
    let analysis = ''
    let currentOptLetter = ''
    let currentOptContent = ''

    const flushOption = () => {
      if (currentOptLetter && currentOptContent) {
        options.push(`${currentOptLetter}. ${currentOptContent}`)
      }
      currentOptLetter = ''
      currentOptContent = ''
    }

    // 从题目行的下一行开始解析
    for (let i = start.index + 1; i < end; i++) {
      const line = lines[i]
      if (!line) continue

      // 选项行：A、xxx 或 A、xxx。 或 A.xxx
      const optMatch = line.match(/^([A-Ea-e])\s*[、.．]\s*(.*)/)
      if (optMatch) {
        flushOption()
        currentOptLetter = optMatch[1].toUpperCase()
        currentOptContent = optMatch[2].trim()
        continue
      }

      // 答案行：答案：xxx 或 答案：
      const ansMatch = line.match(/^答案\s*[：:]\s*(.*)/)
      if (ansMatch) {
        flushOption()
        const ansText = ansMatch[1].trim()
        if (ansText) {
          // 答案在同一行：答案：D 或 答案：D 解析：xxx
          const ansWithAnalysis = ansText.match(/^([A-Ea-e]+|正确|错误)\s*(?:解析|原因)[：:]\s*(.+)/)
          if (ansWithAnalysis) {
            answer = ansWithAnalysis[1].trim()
            analysis = ansWithAnalysis[2].trim()
          } else {
            answer = ansText
          }
        }
        // 如果答案行为空（答案：），答案在下一非空行
        continue
      }

      // 续行处理：注意顺序很重要
      // 优先处理选项内容（当选项字母已设置但内容为空时，下一行作为选项内容）
      const anaMatch = line.match(/^(?:解析|原因)\s*[：:]\s*(.+)/)
      if (currentOptLetter && !currentOptContent) {
        // 选项字母行无内容（如 "A、" 单独一行），下一行作为选项内容
        currentOptContent = line
      } else if (currentOptLetter && currentOptContent) {
        // 已有内容的选项行，追加续行
        currentOptContent += line
      } else if (!answer && !line.match(/^[解析]/)) {
        // 答案尚未获取，且不是特殊标记行 → 作为答案（处理 "答案：\nX" 格式）
        answer = line
      } else if (anaMatch && !analysis) {
        // 解析行
        analysis = anaMatch[1].trim()
      } else if (analysis) {
        analysis += '\n' + line
      } else if (answer && !line.match(/^(?:答案|解析|题型|难度)/)) {
        // 简答题答案的续行
        answer += '\n' + line
      }
    }
    flushOption()

    // 清理答案文本（去掉 "我的答案:X 得分:X" 等后缀）
    answer = answer.replace(/\s*我的答案.*$/, '').replace(/\s*得分.*$/, '').trim()

    // 确定题型
    let type: Question['type'] = 'single'
    let answerArr: string[] = []

    if (options.length > 0) {
      // 有选项 → 选择题
      const letters = answer.split(/[,，、;\s]+/).map(a => a.trim().toUpperCase()).filter(a => /^[A-E]$/.test(a))
      if (letters.length > 1) {
        type = 'multiple'
        answerArr = letters
      } else if (letters.length === 1) {
        type = 'single'
        answerArr = letters
      } else {
        // 有选项但无法解析答案字母，跳过
        continue
      }
    } else if (answer.includes('正确') || answer.includes('错误')) {
      // 判断题
      type = 'judge'
      answerArr = [answer.includes('正确') ? '正确' : '错误']
      // 精确匹配：如果同时包含正确和错误，取第一个
      if (answer.includes('正确') && answer.includes('错误')) {
        answerArr = [answer.indexOf('正确') < answer.indexOf('错误') ? '正确' : '错误']
      }
    } else if (answer) {
      // 简答题（无选项、非判断题）→ 跳过（当前不支持简答题型）
      continue
    } else {
      // 无答案，跳过（实操题等）
      continue
    }

    questions.push({
      libraryId: '',
      type,
      content: qContent,
      options: type === 'judge' && options.length === 0 ? ['正确', '错误'] : options,
      answer: answerArr,
      analysis,
      difficulty: 1
    })
  }

  return questions
}

// ============ 表格导出 DOCX 格式解析（题号与题目分行） ============

/**
 * 解析表格导出的 DOCX 题库格式
 *
 * 支持格式（题号与题目分行，每题之间有空行）：
 *   题号              （表头，跳过）
 *   题目内容           （表头，跳过）
 *   1                 （题号独占一行）
 *   GPS卫星星座配置有（ ）颗在轨卫星。  （题目在下一行）
 *   A. 21
 *   B. 12
 *   C. 18
 *   D. 24
 *   【答案】D
 *   2
 *   UTC是指（ ）。
 *   ...
 *
 * 也支持：
 *   - 【答案】后附带解析：【答案】D 解析：xxx
 *   - 判断题（答案为 正确/错误）
 *   - 多选题（答案为 AB 等）
 */
export function parseBeiDouDocx(content: string): Question[] {
  const questions: Question[] = []
  // 过滤空行，保留非空行序列
  const lines = content.split('\n').map(l => l.trim()).filter(l => l)

  let i = 0

  // 跳过文件头部（标题、题数统计、表头等），找到第一道题
  // 头部特征：非数字行，或 "题号"/"题目内容" 等表头文字
  while (i < lines.length) {
    const line = lines[i]
    // 如果当前行是纯数字且下一行不是选项格式，则可能是第一道题的题号
    if (/^\d+$/.test(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      // 排除表头 "题号" 后面跟 "题目内容" 的情况
      if (nextLine !== '题目内容' && !nextLine.match(/^[A-Ea-e]\s*[.、．]/)) {
        break
      }
    }
    i++
  }

  // 逐题解析
  while (i < lines.length) {
    const line = lines[i]

    // 题号行：纯数字
    if (!/^\d+$/.test(line)) {
      i++
      continue
    }

    const qNum = parseInt(line)
    i++
    if (i >= lines.length) break

    // 题目内容行（题号后的第一个非空行）
    const qContent = lines[i]
    // 安全检查：如果下一行看起来像选项（A. xxx），说明题目内容缺失
    if (qContent.match(/^[A-Ea-e]\s*[.、．]/)) {
      i++
      continue
    }
    i++

    // 解析选项和答案
    const options: string[] = []
    let answer = ''
    let analysis = ''

    while (i < lines.length) {
      const optLine = lines[i]

      // 遇到下一个题号（纯数字），停止当前题的解析
      if (/^\d+$/.test(optLine)) break

      // 选项行：A. xxx 或 A、xxx
      const optMatch = optLine.match(/^([A-Ea-e])\s*[.、．]\s*(.*)/)
      if (optMatch) {
        const letter = optMatch[1].toUpperCase()
        const text = optMatch[2].trim()
        options.push(`${letter}. ${text}`)
        i++
        continue
      }

      // 答案行：【答案】X 或 【答案】X 解析：xxx
      const ansMatch = optLine.match(/^【答案】\s*(.*)/)
      if (ansMatch) {
        const ansText = ansMatch[1].trim()
        // 检查是否附带解析：【答案】D 解析：xxx
        const ansWithAnalysis = ansText.match(/^([A-Ea-e]+|正确|错误)\s*(?:解析|原因)[：:]\s*(.+)/)
        if (ansWithAnalysis) {
          answer = ansWithAnalysis[1].trim()
          analysis = ansWithAnalysis[2].trim()
        } else {
          answer = ansText
        }
        i++
        continue
      }

      // 独立解析行（备用）
      const analysisMatch = optLine.match(/^(?:解析|原因)\s*[：:]\s*(.+)/)
      if (analysisMatch && !analysis) {
        analysis = analysisMatch[1].trim()
        i++
        continue
      }

      // 其他行（可能是跨行选项内容或无关信息）
      i++
    }

    // 确定题型和答案数组
    let type: Question['type'] = 'single'
    let answerArr: string[] = []

    if (options.length > 0) {
      // 有选项 → 选择题
      const letters = answer.split(/[,，、;\s]+/).map(a => a.trim().toUpperCase()).filter(a => /^[A-E]$/.test(a))
      if (letters.length > 1) {
        type = 'multiple'
        answerArr = letters
      } else if (letters.length === 1) {
        type = 'single'
        answerArr = letters
      } else {
        // 有选项但无法解析答案字母，跳过
        continue
      }
    } else if (answer.includes('正确') || answer.includes('错误')) {
      type = 'judge'
      answerArr = [answer.includes('正确') ? '正确' : '错误']
      if (answer.includes('正确') && answer.includes('错误')) {
        answerArr = [answer.indexOf('正确') < answer.indexOf('错误') ? '正确' : '错误']
      }
    } else {
      // 无法解析，跳过
      continue
    }

    questions.push({
      libraryId: '',
      type,
      content: qContent,
      options: type === 'judge' && options.length === 0 ? ['正确', '错误'] : options,
      answer: answerArr,
      analysis,
      difficulty: 1
    })
  }

  return questions
}

// ============ Excel 结构化文本解析 ============

/**
 * 解析 xlsx 云函数提取的结构化文本格式
 *
 * 格式约定（由 parseFile 云函数输出）：
 *   ===SHEET:SheetName===
 *   序号\t题型\t题目\t选项\t答案\t解析    （表头行，跳过）
 *   1\tsingle\t题目内容\tA. 选项1\\nB. 选项2\\nC. 选项3\\nD. 选项4\tA\t解析文本
 *   ...
 *
 * 题型列值：single / multiple / judge
 * 选项列值：A. xxx\nB. xxx\nC. xxx\nD. xxx（判断题/简答题为空）
 */
export function parseXlsxStructured(content: string): Question[] {
  const questions: Question[] = []

  // 按 ===SHEET:xxx=== 分段
  const sheetSections = content.split(/(?====SHEET:)/)

  for (const section of sheetSections) {
    const headerMatch = section.match(/^===SHEET:([^=]+)===\n?/)
    if (!headerMatch) continue

    const sheetName = headerMatch[1].trim()
    const bodyLines = section.slice(headerMatch[0].length).split('\n')

    // 推断默认题型（用于题型列为空的情况）
    let defaultType: Question['type'] = 'single'
    if (sheetName.includes('判断')) defaultType = 'judge'
    else if (sheetName.includes('多选')) defaultType = 'multiple'

    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i].trim()
      if (!line) continue

      const fields = line.split('\t')

      // 跳过表头行
      if (fields[0] === '序号' || fields[1] === '题型') continue

      // 至少需要 序号 + 题目 + 答案（3 列）
      if (fields.length < 3) continue

      const num = fields[0]?.trim()
      if (!num || !/^\d+$/.test(num)) continue

      const typeStr = fields[1]?.trim() || ''
      const qContent = fields[2]?.trim() || ''
      const optionsStr = fields[3]?.trim() || ''
      const answerStr = fields[4]?.trim() || ''
      const analysisStr = fields[5]?.trim() || ''

      if (!qContent || !answerStr) continue

      // 确定题型
      let type: Question['type']
      if (typeStr === 'judge' || typeStr.includes('判断')) {
        type = 'judge'
      } else if (typeStr === 'multiple' || typeStr.includes('多选')) {
        type = 'multiple'
      } else if (typeStr === 'single' || typeStr.includes('单选') || typeStr.includes('选择')) {
        type = 'single'
      } else {
        type = defaultType
      }

      // 解析选项
      let options: string[] = []
      if (optionsStr) {
        options = optionsStr.split(/\\n|\n/).map(o => o.trim()).filter(Boolean)
      }

      // 解析答案
      let answerArr: string[]
      if (type === 'judge') {
        answerArr = [answerStr.includes('正确') ? '正确' : '错误']
        if (options.length === 0) options = ['正确', '错误']
      } else {
        answerArr = answerStr.split(/[,，、;\s]+/).map(a => a.trim().toUpperCase()).filter(a => /^[A-E]$/.test(a))
        if (answerArr.length > 1) type = 'multiple'
      }

      if (answerArr.length === 0) continue

      questions.push({
        libraryId: '',
        type,
        content: qContent,
        options,
        answer: answerArr,
        analysis: analysisStr,
        difficulty: 1
      })
    }
  }

  return questions
}