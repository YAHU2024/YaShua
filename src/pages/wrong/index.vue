<template>
  <ThemeWrapper>
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
          <!-- 左侧：图片占位（对齐 library-cover） -->
          <view class="card-cover">
            <text class="cover-icon">{{ getLibraryEmoji(group.libraryId) }}</text>
          </view>

          <!-- 中间：标题 + 红色错题数副标题 -->
          <view class="card-content">
            <text class="card-name">{{ group.libraryName }}</text>
            <text class="card-sub">{{ group.items.length }} 道错题</text>
          </view>

          <!-- 右侧：箭头 -->
          <view class="card-right">
            <text class="card-arrow">›</text>
          </view>
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
  </ThemeWrapper>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import ThemeWrapper from '@/components/ThemeWrapper.vue'
import NavBar from '@/components/NavBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useWrongStore } from '@/stores/wrong'
import { useUserStore } from '@/stores/user'
import { useLibraryStore } from '@/stores/library'
import { getLibraryEmoji } from '@/utils/libraryEmoji'
import type { WrongQuestion, Question } from '@/types'

const wrongStore = useWrongStore()
const userStore = useUserStore()
const libraryStore = useLibraryStore()

const wrongList = ref<(WrongQuestion & { question: Question })[]>([])

interface WrongGroup {
  libraryId: string
  libraryName: string
  totalQuestions: number
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
        totalQuestions: getLibraryTotal(libId),
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

function getLibraryTotal(libraryId: string): number {
  if (libraryId === '__unknown__') return 0
  const lib = libraryStore.libraries.find(l => l._id === libraryId)
  return lib?.totalQuestions ?? 0
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
  background: var(--color-bg-page);
}

.content {
  padding: $space-xl;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.wrong-groups {
  display: flex;
  flex-direction: column;
  gap: $list-gap; // 24rpx
}

// ============ Neumorphic 错题卡片（对齐 .library-card） ============
.group-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: var(--color-bg-card);
  border-radius: 24rpx;              // 与题库管理页一致（= $radius-lg）
  padding: 28rpx 32rpx;
  box-shadow: var(--shadow-neu-md);        // ✅ Neumorphic 微立体阴影
  transition: transform $duration-instant, box-shadow $duration-fast;

  &:active {
    transform: scale(0.985);
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.02);
  }
}

// --- 左侧图片占位（复用 .library-cover 规格） ---
.card-cover {
  width: 96rpx;
  height: 96rpx;
  border-radius: 16rpx;              // = $radius-md
  background: linear-gradient(135deg, #F0F0F3 0%, #E5E5EA 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cover-icon {
  font-size: 44rpx;
  line-height: 1;
}

// --- 中间内容区 ---
.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  overflow: hidden;
}

.card-name {
  font-size: 32rpx;                  // = $font-size-lg
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);        // 黑色加粗主标题
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-sub {
  font-size: $font-size-xs;          // 22rpx 红色小字
  color: var(--color-error);               // #ff4d4f
  line-height: 1;
}

// --- 右侧：箭头 ---
.card-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

// --- 箭头（放大并右移至原pill位置） ---
.card-arrow {
  font-size: 56rpx;
  color: var(--color-text-disabled);
  font-weight: 300;
  line-height: 1;
  margin-left: 16rpx;
}
</style>
