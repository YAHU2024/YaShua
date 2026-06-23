const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_BATCH_SIZE = 50

async function checkContentSafety(content) {
  try {
    const result = await cloud.openapi.security.msgSecCheck({
      content: content.substring(0, 10000)
    })
    return result.result === 0
  } catch (e) {
    console.error('内容安全检测失败', e)
    return false
  }
}

async function batchInsertQuestions(questions, libraryId) {
  const total = questions.length
  const batches = []
  
  for (let i = 0; i < total; i += MAX_BATCH_SIZE) {
    batches.push(questions.slice(i, i + MAX_BATCH_SIZE))
  }
  
  let importedCount = 0
  
  for (const batch of batches) {
    const operations = batch.map(question => {
      return db.collection('questions').add({
        ...question,
        libraryId,
        createdAt: new Date()
      })
    })
    
    const results = await Promise.all(operations)
    importedCount += results.filter(r => r._id).length
  }
  
  // BUG-01: 修复变量作用域错误 — 使用 importedCount 替代 batch.length
  await db.collection('libraries').doc(libraryId).update({
    totalQuestions: db.command.inc(importedCount),
    updatedAt: new Date()
  })
  
  return importedCount
}

exports.main = async (event, context) => {
  try {
    const { libraryId, questions, openid } = event
    
    if (!libraryId || !questions || !Array.isArray(questions)) {
      return { success: false, message: '参数错误' }
    }
    
    if (questions.length === 0) {
      return { success: false, message: '题目列表为空' }
    }
    
    for (const question of questions) {
      if (!question.content || !question.answer || !Array.isArray(question.answer)) {
        return { success: false, message: '题目数据格式错误' }
      }
    }
    
    const contentsToCheck = questions.map(q => q.content).join('\n')
    const isSafe = await checkContentSafety(contentsToCheck)
    
    if (!isSafe) {
      return { success: false, message: '内容包含敏感信息' }
    }
    
    const importedCount = await batchInsertQuestions(questions, libraryId)
    
    return {
      success: true,
      message: `成功导入 ${importedCount} 道题`,
      data: {
        importedCount,
        totalCount: questions.length
      }
    }
  } catch (e) {
    console.error('导入题目失败', e)
    return { success: false, message: '导入失败', error: e.message }
  }
}
