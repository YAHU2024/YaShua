const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_BATCH_SIZE = 50

async function checkContentSafety(content) {
  try {
    const result = await cloud.openapi.security.msgSecCheck({
      content: content.substring(0, 2000)
    })
    // result.result === 0 表示通过（suggest: "pass"），非 0 表示不通过（suggest: "risky"/"review"）
    return {
      isSafe: result.result === 0,
      suggest: result.suggest || 'unknown'
    }
  } catch (e) {
    // 权限不足 / 网络异常 / API 不可用等，不要当作内容违规处理
    console.error('内容安全检测 API 调用异常', e.message)
    return {
      isSafe: false,
      isApiError: true,
      error: e.message
    }
  }
}

async function batchInsertQuestions(questions, libraryId, openid) {
  const total = questions.length
  const batches = []

  for (let i = 0; i < total; i += MAX_BATCH_SIZE) {
    batches.push(questions.slice(i, i + MAX_BATCH_SIZE))
  }

  let importedCount = 0

  for (const batch of batches) {
    const operations = batch.map(question => {
      return db.collection('questions').add({
        data: {
          ...question,
          libraryId,
          _openid: openid,  // 显式设置用户的 openid，确保客户端安全规则可读
          createdAt: db.serverDate()
        }
      })
    })
    
    const results = await Promise.allSettled(operations)
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value._id) {
        importedCount++
      } else {
        console.warn('单题插入失败:', r.status === 'rejected' ? r.reason?.message : '无_id')
      }
    }
  }
  
  await db.collection('libraries').doc(libraryId).update({
    data: {
      totalQuestions: db.command.inc(importedCount),
      updatedAt: db.serverDate()
    }
  })
  
  return importedCount
}

exports.main = async (event, context) => {
  try {
    const { libraryId, questions, openid, skipSafetyCheck } = event
    
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
    
    // 内容安全检测（支持跳过）
    if (!skipSafetyCheck) {
      const contentsToCheck = questions.map(q => q.content).join('\n')
      const safetyResult = await checkContentSafety(contentsToCheck)

      if (!safetyResult.isSafe) {
        if (safetyResult.isApiError) {
          console.warn('内容安全检测 API 不可用，跳过审核继续导入')
          // API 异常时不阻止导入，只记录日志
        } else if (safetyResult.suggest === 'risky') {
          // 明确违规：阻止导入
          return {
            success: false,
            message: '部分题目内容包含敏感信息，请修改后重试',
            code: 'CONTENT_NOT_SAFE',
            suggest: safetyResult.suggest
          }
        } else {
          // review / unknown：微信判定需人工审核，已经过用户确认，放行
          console.warn(`内容安全检测返回 ${safetyResult.suggest}，建议人工审核，本次导入继续`)
        }
      }
    } else {
      console.warn('用户要求跳过内容安全检测，此次导入不进行审核')
    }
    
    const importedCount = await batchInsertQuestions(questions, libraryId, openid)
    
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
    console.error('错误详情:', JSON.stringify({
      message: e.message,
      errCode: e.errCode,
      stack: e.stack?.substring(0, 300)
    }))
    return {
      success: false,
      message: `导入失败: ${e.message || '未知错误'}`,
      code: 'IMPORT_ERROR',
      error: e.message
    }
  }
}
