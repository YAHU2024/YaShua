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
@import '@/styles/tokens/_index.scss';

.page {
  min-height: 100vh;
  background: $color-bg-page;
}

.content {
  padding: $space-xl;
}

.section {
  background: $color-bg-card;
  border-radius: $radius-xl;
  margin-bottom: $section-gap;
  overflow: hidden;
}

.section-title {
  padding: $space-lg $space-xl;
  font-size: $font-size-base;
  font-weight: $font-weight-semibold;
  color: $color-text-tertiary;
  background: $color-bg-input;
}

.setting-list {
  padding: 0 $space-md;
}

.setting-item {
  display: flex;
  align-items: center;
  padding: $space-lg $space-sm;
  border-bottom: 1rpx solid $color-border-base;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background: $color-bg-input;
  }
}

.setting-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-label {
  font-size: $font-size-lg;
  color: $color-text-primary;
}

.setting-value {
  font-size: $font-size-base;
  color: $color-text-tertiary;
}

.setting-arrow {
  font-size: $font-size-xl;
  color: $color-text-disabled;
  margin-left: $space-sm;
}

.footer {
  text-align: center;
  padding: 80rpx $space-xl;
}

.footer-text {
  display: block;
  font-size: $font-size-base;
  color: $color-text-secondary;
  margin-bottom: $space-sm;
}

.footer-copyright {
  font-size: $font-size-sm;
  color: $color-text-tertiary;
}
</style>
