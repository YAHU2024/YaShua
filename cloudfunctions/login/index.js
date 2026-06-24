const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    // 通过 getWXContext 直接获取调用者的 openid，无需再调用 _login
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    if (!openid) {
      return { success: false, message: '获取 openid 失败' }
    }

    return {
      success: true,
      data: {
        openid
      }
    }
  } catch (e) {
    console.error('登录失败', e)
    return { success: false, message: '登录失败', error: e.message }
  }
}
