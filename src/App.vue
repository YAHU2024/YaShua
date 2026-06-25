<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { markCloudInitialized } from '@/utils/cloud'

onLaunch(async () => {
  // 初始化云开发（必须在所有云 API 调用之前执行）
  if (uni.cloud) {
    try {
      uni.cloud.init({
        env: 'cloud1-d6gspphu1758644bc',
        traceUser: true
      })
      markCloudInitialized()
      console.log('云开发初始化成功')
    } catch (e) {
      console.error('云开发初始化失败', e)
    }
  } else {
    console.warn('云开发不可用，将使用本地模式')
  }

  const userStore = useUserStore()
  await userStore.doLogin()
})

onShow(() => {})

onHide(() => {})
</script>

<style lang="scss">
@import '@/uni.scss';
@import '@/styles/global.scss';

page {
  background-color: $color-bg-page;
  font-family: $font-family-base;
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
