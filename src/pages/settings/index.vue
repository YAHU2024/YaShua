<template>
  <view class="page">
    <NavBar title="设置" />
    
    <view class="content">
      <view class="section">
        <view class="section-title">关于</view>
        <view class="setting-list">
          <view class="setting-item" @click="showAbout">
            <view class="setting-info">
              <text class="setting-label">版本信息</text>
              <text class="setting-value">v1.0.0</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
          <view class="setting-item" @click="showFeedback">
            <view class="setting-info">
              <text class="setting-label">意见反馈</text>
              <text class="setting-value">帮助我们改进</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
          <view class="setting-item" @click="showPrivacy">
            <view class="setting-info">
              <text class="setting-label">隐私政策</text>
              <text class="setting-value"></text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-title">数据管理</view>
        <view class="setting-list">
          <view class="setting-item" @click="clearCache">
            <view class="setting-info">
              <text class="setting-label">清除缓存</text>
              <text class="setting-value">清理本地数据</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-title">联系我们</view>
        <view class="setting-list">
          <view class="setting-item" @click="contactUs">
            <view class="setting-info">
              <text class="setting-label">联系客服</text>
              <text class="setting-value">获取帮助</text>
            </view>
            <view class="setting-arrow">›</view>
          </view>
        </view>
      </view>

      <view class="footer">
        <text class="footer-text">智慧刷题 · 轻松学习</text>
        <text class="footer-copyright">© 2024 All Rights Reserved</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import NavBar from '@/components/NavBar.vue'

function showAbout() {
  uni.showModal({
    title: '版本信息',
    content: '智慧刷题 v1.0.0\n\n一款帮助你高效学习的刷题小程序',
    showCancel: false
  })
}

function showFeedback() {
  uni.showToast({
    title: '感谢你的反馈',
    icon: 'none'
  })
}

function showPrivacy() {
  uni.showModal({
    title: '隐私政策',
    content: '我们重视你的隐私安全。\n\n1. 用户数据仅存储在微信云开发平台\n2. 不会向第三方分享你的个人信息\n3. 所有数据传输均经过加密处理',
    showCancel: false
  })
}

function clearCache() {
  uni.showModal({
    title: '清除缓存',
    content: '确定要清除本地缓存吗？刷题进度将会丢失。',
    success: (res) => {
      if (res.confirm) {
        try {
          uni.clearStorageSync()
          uni.showToast({ title: '清除成功', icon: 'success' })
        } catch (e) {
          uni.showToast({ title: '清除失败', icon: 'none' })
        }
      }
    }
  })
}

function contactUs() {
  uni.showToast({
    title: '客服：support@example.com',
    icon: 'none',
    duration: 3000
  })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
}

.content {
  padding: 20px;
}

.section {
  background: #fff;
  border-radius: 16px;
  margin-bottom: 20px;
  overflow: hidden;
}

.section-title {
  padding: 16px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #999;
  background: #f8f9fa;
}

.setting-list {
  padding: 0 12px;
}

.setting-item {
  display: flex;
  align-items: center;
  padding: 16px 8px;
  border-bottom: 1px solid #f0f0f0;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:active {
    background: #f8f9fa;
  }
}

.setting-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-label {
  font-size: 16px;
  color: #333;
}

.setting-value {
  font-size: 14px;
  color: #999;
}

.setting-arrow {
  font-size: 18px;
  color: #ccc;
}

.footer {
  text-align: center;
  padding: 40px 20px;
}

.footer-text {
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.footer-copyright {
  font-size: 12px;
  color: #999;
}
</style>
