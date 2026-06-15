const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    const { code } = event
    if (!code) {
      return { success: false, message: '缺少 code 参数' }
    }

    const result = await cloud.callFunction({
      name: '_login',
      data: { code }
    })

    return {
      success: true,
      data: {
        openid: result.result.openid
      }
    }
  } catch (e) {
    console.error('登录失败', e)
    return { success: false, message: '登录失败', error: e.message }
  }
}
