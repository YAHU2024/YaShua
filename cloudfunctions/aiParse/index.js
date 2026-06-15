const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    const { text } = event
    
    if (!text) {
      return { success: false, message: '缺少文本内容' }
    }
    
    return {
      success: true,
      message: 'AI 解析功能预留',
      data: {
        questions: [],
        hint: '此功能需要配置大模型 API 后启用'
      }
    }
  } catch (e) {
    console.error('AI 解析失败', e)
    return { success: false, message: '解析失败', error: e.message }
  }
}
