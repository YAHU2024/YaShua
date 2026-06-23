<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

onLaunch(async () => {
  // 新版本基础库需显式初始化云开发
  // @ts-ignore
  if (typeof wx !== 'undefined' && wx.cloud) {
    try {
      wx.cloud.init({
        env: '',  // 使用默认云环境，如需指定请填写环境 ID
        traceUser: true,
      })
    } catch (e) {
      console.warn('[App] 云开发初始化失败，将使用本地存储模式', e)
    }
  }

  const userStore = useUserStore()
  await userStore.doLogin()
})

onShow(() => {})

onHide(() => {})
</script>

<style lang="scss">
@import '@/uni.scss';

page {
  background-color: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

view, text {
  box-sizing: border-box;
}

button {
  margin: 0;
  padding: 0;
  background: none;
  line-height: inherit;
}

button::after {
  display: none;
}
</style>
