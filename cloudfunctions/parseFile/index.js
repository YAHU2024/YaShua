const cloud = require('wx-server-sdk')
const fs = require('fs')
const path = require('path')
const os = require('os')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 支持的文件扩展名
const SUPPORTED_EXTENSIONS = ['txt', 'md', 'docx', 'xlsx']
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
 * 解析 Excel 文件（.xlsx）
 * 将每个工作表逐行逐单元格拼接为文本，不同单元格用制表符分隔，行用换行符分隔
 */
async function parseXlsxFile(filePath) {
  const XLSX = require('xlsx')
  const workbook = XLSX.readFile(filePath)
  const sheets = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
    const lines = rows.map(row =>
      row.map(cell => String(cell).trim()).filter(Boolean).join('\t')
    )
    if (lines.length > 0) {
      sheets.push(lines.join('\n'))
    }
  }

  return sheets.join('\n\n')
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
            message: `暂不支持此文件格式（.${ext || '未知'}），请使用 .txt、.md、.docx 或 .xlsx 格式`
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
