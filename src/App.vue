<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

onLaunch(async () => {
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
