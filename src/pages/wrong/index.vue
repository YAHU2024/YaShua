<template>
  <view class="page">
    <NavBar title="错题本" />

    <view class="content">
      <!-- 按题库分组的菜单列表 -->
      <view v-if="groupedList.length > 0" class="wrong-groups">
        <view
          v-for="group in groupedList"
          :key="group.libraryId"
          class="group-card"
          @click="goDetail(group)"
        >
          <view class="group-info">
            <text class="group-name">{{ group.libraryName }}</text>
            <text class="group-count">{{ group.items.length }} 道错题</text>
          </view>
          <view class="group-arrow">›</view>
        </view>
      </view>

      <view v-else class="empty-state">
        <text class="empty-icon">🎉</text>
        <text class="empty-title">暂无错题</text>
        <text class="empty-desc">继续加油，保持全对！</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import { useWrongStore } from '@/stores/wrong'
import { useUserStore } from '@/stores/user'
import { useLibraryStore } from '@/stores/library'
import type { WrongQuestion, Question } from '@/types'

const wrongStore = useWrongStore()
const userStore = useUserStore()
const libraryStore = useLibraryStore()

const wrongList = ref<(WrongQuestion & { question: Question })[]>([])

// 错题按题库分组
interface WrongGroup {
  libraryId: string
  libraryName: string
  items: (WrongQuestion & { question: Question })[]
}

const groupedList = computed<WrongGroup[]>(() => {
  const groups: Record<string, WrongGroup> = {}

  for (const item of wrongList.value) {
    const libId = item.libraryId || item.question?.libraryId || '__unknown__'
    if (!groups[libId]) {
      groups[libId] = {
        libraryId: libId,
        libraryName: getLibraryName(libId),
        items: []
      }
    }
    groups[libId].items.push(item)
  }

  return Object.values(groups)
})

function getLibraryName(libraryId: string): string {
  if (libraryId === '__unknown__') return '未分类'
  const lib = libraryStore.libraries.find(l => l._id === libraryId)
  return lib?.name || '未分类'
}

onMounted(async () => {
  if (libraryStore.libraries.length === 0) {
    await libraryStore.loadLibraries()
  }
  if (userStore.openid) {
    await loadWrongQuestions()
  }
})

onShow(async () => {
  if (userStore.openid) {
    await loadWrongQuestions()
  }
})

async function loadWrongQuestions() {
  wrongList.value = await wrongStore.getWrongQuestionDetails(userStore.openid!)
}

function goDetail(group: WrongGroup) {
  const libId = group.libraryId
  const name = group.libraryId === '__unknown__' ? '未分类' : group.libraryName
  uni.navigateTo({
    url: `/pages/wrong/detail?libraryId=${encodeURIComponent(libId)}&libraryName=${encodeURIComponent(name)}`
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
  padding-bottom: 40px;
}

.wrong-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);

  &:active {
    background: #f9f9f9;
  }
}

.group-info {
  display: flex;
  flex-direction: column;
}

.group-name {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.group-count {
  font-size: 13px;
  color: #ff4d4f;
  margin-top: 6px;
}

.group-arrow {
  font-size: 24px;
  color: #ccc;
  font-weight: 300;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
}

.empty-icon {
  display: block;
  font-size: 80px;
  margin-bottom: 20px;
}

.empty-title {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  color: #999;
}
</style>
