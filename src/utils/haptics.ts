/**
 * 触觉反馈工具
 *
 * 在微信小程序中使用 wx.vibrateShort() 提供触觉反馈
 * 低版本基础库自动降级，不影响功能
 */

type HapticType = 'light' | 'medium' | 'heavy'

/**
 * 短震动反馈
 * @param type - 震动强度: light(轻) / medium(中) / heavy(重)
 */
export function vibrateShort(type: HapticType = 'light') {
  try {
    // @ts-ignore - wx API
    wx.vibrateShort({ type })
  } catch {
    // 降级：旧版基础库可能不支持 type 参数
    try {
      // @ts-ignore
      wx.vibrateShort({})
    } catch {
      // 静默失败，触觉反馈不是关键功能
    }
  }
}

/**
 * 长震动反馈（用于重要操作确认）
 */
export function vibrateLong() {
  try {
    // @ts-ignore
    wx.vibrateLong()
  } catch {
    // 静默失败
  }
}
