<template>
  <view class="page">
    <NavBar title="错题本" />

    <view class="content">
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

      <EmptyState
        v-else
        icon="🎉"
        title="暂无错题"
        description="继续加油，保持全对！"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useWrongStore } from '@/stores/wrong'
import { useUserStore } from '@/stores/user'
import { useLibraryStore } from '@/stores/library'
import type { WrongQuestion, Question } from '@/types'

const wrongStore = useWrongStore()
const userStore = useUserStore()
const libraryStore = useLibraryStore()

const wrongList = ref<(WrongQuestion & { question: Question })[]>([])

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
@import '@/styles/tokens/_index.scss';

.page {
  min-height: 100vh;
  background: $color-bg-page;
}

.content {
  padding: $space-xl;
  padding-bottom: 80rpx;
}

.wrong-groups {
  display: flex;
  flex-direction: column;
  gap: $list-gap;
}

.group-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $space-lg $space-xl;
  background: $color-bg-card;
  border-radius: $radius-xl;
  box-shadow: $shadow-md;
  transition: background $duration-instant;

  &:active {
    background: #fafafa;
  }
}

.group-info {
  display: flex;
  flex-direction: column;
}

.group-name {
  font-size: 34rpx;
  font-weight: $font-weight-semibold;
  color: $color-text-primary;
}

.group-count {
  font-size: $font-size-xs;
  color: $color-error;
  margin-top: 12rpx;
}

.group-arrow {
  font-size: 48rpx;
  color: $color-text-disabled;
  font-weight: 300;
}
</style>
