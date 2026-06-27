const cloud = require('wx-server-sdk')
const fs = require('fs')
const path = require('path')
const os = require('os')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 支持的文件扩展名
const SUPPORTED_EXTENSIONS = ['txt', 'md', 'docx', 'doc', 'xlsx']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * 从文件名中提取扩展名（小写）
 */
function getExtension(filename) {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

/**
 * 解析纯文本文件（.txt / .md）
 */
async function parseTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8')
}

/**
 * 解析 Word 文档（.docx）
 */
async function parseDocxFile(filePath) {
  const mammoth = require('mammoth')
  const result = await mammoth.extractRawText({ path: filePath })
  return result.value
}

/**
 * 解析 .doc 文件（OLE 容器包裹的 HTML）
 * 许多在线考试系统导出的 .doc 实际上是 HTML 内容嵌入 OLE 容器
 * 此函数从二进制中搜索 HTML 内容并提取纯文本
 */
async function parseDocFile(filePath) {
  const buffer = fs.readFileSync(filePath)
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

  if (htmlStart < 0) {
    // 不是 HTML 格式的 .doc，尝试当纯文本读取
    return fs.readFileSync(filePath, 'utf-8')
  }

  // 也尝试找 <!doctype（在 <html 之前最多 100 字节范围内搜索）
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
  let html
  try {
    html = decodeURIComponent(escape(binary))
  } catch {
    html = binary
  }

  // 去除 HTML 标签，提取纯文本
  let text = html
  text = text.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
  text = text.replace(/<\/(?:p|div|br|tr|li|h[1-6])>/gi, '\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  text = text.replace(/&#[xX]([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

/**
 * 解析 Excel 文件（.xlsx）
 * 输出结构化文本格式，便于客户端精确解析：
 *   ===SHEET:SheetName===
 *   序号\t题型\t题目\t选项\t答案\t解析
 *   1\tsingle\t题目内容\tA. 选项1\nB. 选项2\tA\t解析文本
 */
async function parseXlsxFile(filePath) {
  const XLSX = require('xlsx')
  const workbook = XLSX.readFile(filePath)
  const sections = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })

    if (rows.length === 0) continue

    // 检测表头行，确定列映射
    let headerRowIdx = -1
    let colMap = {}
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const row = rows[r].map(c => String(c).trim().toLowerCase())
      const hasContent = row.some(c => c.includes('题目') || c.includes('内容') || c.includes('question'))
      if (hasContent || (row.length >= 3 && /^\d+$/.test(String(rows[r][0]).trim()))) {
        // 尝试识别列
        for (let c = 0; c < row.length; c++) {
          const cell = row[c]
          if (cell.includes('序号') || cell.includes('编号') || cell === '#') colMap.num = c
          else if (cell.includes('题型') || cell.includes('类型') || cell.includes('type')) colMap.type = c
          else if (cell.includes('题目') || cell.includes('内容') || cell.includes('question')) colMap.content = c
          else if (cell.includes('选项') || cell.includes('option')) colMap.options = c
          else if (cell.includes('答案') || cell.includes('answer')) colMap.answer = c
          else if (cell.includes('解析') || cell.includes('分析') || cell.includes('explanation')) colMap.analysis = c
          else if (cell.includes('难度') || cell.includes('difficulty')) colMap.difficulty = c
        }
        // 如果没有明确识别到"题目"列，按位置推断
        if (colMap.content === undefined && row.length >= 2) {
          // 常见布局：序号(0), 题目(1), 选项A(2), B(3), C(4), D(5), 答案(6), ...
          // 或者：序号(0), 题目(1), 答案(2), 难度(3)
          if (colMap.num !== undefined) {
            colMap.content = colMap.num + 1
          }
        }
        headerRowIdx = r
        break
      }
    }

    // 如果没找到表头，使用默认列映射
    if (headerRowIdx === -1) {
      headerRowIdx = 0
      colMap = { num: 0, content: 1, answer: rows[0].length >= 8 ? 6 : 2 }
      // 如果有 8 列，推测为：序号, 题目, A, B, C, D, 答案, 难度
      if (rows[0].length >= 8) {
        colMap.options = 'abcd' // 特殊标记，表示 A/B/C/D 分别在 2/3/4/5 列
      }
    }

    const dataStartRow = headerRowIdx + 1
    const lines = []

    // 判断 sheet 题型
    let sheetType = ''
    if (sheetName.includes('判断')) sheetType = 'judge'
    else if (sheetName.includes('多选')) sheetType = 'multiple'
    else if (sheetName.includes('选择') || sheetName.includes('单选')) sheetType = 'single'

    for (let r = dataStartRow; r < rows.length; r++) {
      const row = rows[r]
      if (!row || row.length === 0) continue

      const num = String(row[colMap.num] || '').trim()
      if (!num || !/^\d+$/.test(num)) continue

      const content = String(row[colMap.content] || '').trim()
      if (!content) continue

      // 确定题型
      let qType = sheetType
      if (colMap.type !== undefined) {
        const typeVal = String(row[colMap.type] || '').trim()
        if (typeVal.includes('判断')) qType = 'judge'
        else if (typeVal.includes('多选')) qType = 'multiple'
        else if (typeVal.includes('单选') || typeVal.includes('选择')) qType = 'single'
      }
      if (!qType) qType = 'single'

      // 提取选项
      let optionsStr = ''
      if (colMap.options === 'abcd') {
        // A/B/C/D 分别在列 2/3/4/5
        const optA = String(row[2] || '').trim()
        const optB = String(row[3] || '').trim()
        const optC = String(row[4] || '').trim()
        const optD = String(row[5] || '').trim()
        const opts = []
        if (optA) opts.push(`A. ${optA}`)
        if (optB) opts.push(`B. ${optB}`)
        if (optC) opts.push(`C. ${optC}`)
        if (optD) opts.push(`D. ${optD}`)
        optionsStr = opts.join('\\n')
      } else if (colMap.options !== undefined) {
        optionsStr = String(row[colMap.options] || '').trim().replace(/\n/g, '\\n')
      }

      // 如果是选择题但没有解析出的选项，尝试从各列推断
      if (qType !== 'judge' && !optionsStr && row.length >= 6) {
        const optA = String(row[2] || '').trim()
        const optB = String(row[3] || '').trim()
        const optC = String(row[4] || '').trim()
        const optD = String(row[5] || '').trim()
        if (optA && optB) {
          const opts = []
          opts.push(`A. ${optA}`)
          opts.push(`B. ${optB}`)
          if (optC) opts.push(`C. ${optC}`)
          if (optD) opts.push(`D. ${optD}`)
          optionsStr = opts.join('\\n')
        }
      }

      // 答案
      const answerCol = colMap.answer !== undefined ? colMap.answer : (row.length >= 8 ? 6 : 2)
      let answer = String(row[answerCol] || '').trim()

      // 判断题答案标准化
      if (qType === 'judge' || answer === '正确' || answer === '错误') {
        qType = 'judge'
        if (answer.includes('正确') || answer === '对' || answer === 'T' || answer === 'True') {
          answer = '正确'
        } else {
          answer = '错误'
        }
      }

      // 解析
      let analysis = ''
      if (colMap.analysis !== undefined) {
        analysis = String(row[colMap.analysis] || '').trim()
      }

      // 难度
      let difficulty = '1'
      if (colMap.difficulty !== undefined) {
        difficulty = String(row[colMap.difficulty] || '1').trim()
      }

      const fields = [num, qType, content, optionsStr, answer, analysis]
      lines.push(fields.join('\t'))
    }

    if (lines.length > 0) {
      sections.push(`===SHEET:${sheetName}===\n${lines.join('\n')}`)
    }
  }

  return sections.join('\n\n')
}

exports.main = async (event, context) => {
  try {
    const { fileID } = event

    if (!fileID) {
      return { success: false, message: '缺少文件 fileID 参数' }
    }

    // 下载文件到临时目录
    const fileRes = await cloud.downloadFile({ fileID })
    const fileBuffer = fileRes.fileContent

    // 检查文件大小
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return { success: false, message: '文件大小超过 10MB 限制' }
    }

    // 从 fileID 中提取文件扩展名
    // fileID 格式示例: cloud://env-id.xxxx/question-files/1234-abc.file
    // 或可能包含原始扩展名: cloud://env-id.xxxx/question-files/1234-abc.xlsx
    const lowerFileID = fileID.toLowerCase()
    let ext = ''
    for (const e of SUPPORTED_EXTENSIONS) {
      if (lowerFileID.endsWith('.' + e)) {
        ext = e
        break
      }
    }

    // 如果 fileID 没有扩展名信息，尝试从 event 中获取
    if (!ext && event.fileName) {
      ext = getExtension(event.fileName)
    }

    // 写入临时文件
    const tempPath = path.join(os.tmpdir(), `upload_${Date.now()}.${ext || 'tmp'}`)
    fs.writeFileSync(tempPath, fileBuffer)

    let text = ''

    switch (ext) {
      case 'txt':
      case 'md':
        text = await parseTextFile(tempPath)
        break
      case 'docx':
        text = await parseDocxFile(tempPath)
        break
      case 'doc':
        text = await parseDocFile(tempPath)
        break
      case 'xlsx':
        text = await parseXlsxFile(tempPath)
        break
      default:
        // 无法确定格式时，尝试当文本读取
        try {
          text = await parseTextFile(tempPath)
        } catch (e) {
          return {
            success: false,
            message: `暂不支持此文件格式（.${ext || '未知'}），请使用 .txt、.md、.doc、.docx 或 .xlsx 格式`
          }
        }
    }

    // 清理临时文件
    try {
      fs.unlinkSync(tempPath)
    } catch (e) {
      // 忽略清理失败
    }

    // 去除多余空白
    text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

    if (!text) {
      return { success: false, message: '文件内容为空' }
    }

    return {
      success: true,
      message: '文件解析成功',
      data: {
        text,
        fileSize: fileBuffer.length,
        charCount: text.length
      }
    }
  } catch (e) {
    console.error('文件解析失败', e)
    return { success: false, message: '文件解析失败: ' + e.message, error: e.message }
  }
}
