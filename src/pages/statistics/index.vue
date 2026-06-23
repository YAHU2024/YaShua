<template>
  <view class="page">
    <NavBar title="学习统计" show-back />
    
    <view class="content">
      <!-- 累计统计 -->
      <view class="summary-section">
        <view class="summary-card">
          <text class="summary-value">{{ statsStore.totalQuestions }}</text>
          <text class="summary-label">累计做题</text>
        </view>
        <view class="summary-divider"></view>
        <view class="summary-card">
          <text class="summary-value">{{ statsStore.getAccuracy() }}%</text>
          <text class="summary-label">总正确率</text>
        </view>
        <view class="summary-divider"></view>
        <view class="summary-card">
          <text class="summary-value">{{ statsStore.todayQuestions }}</text>
          <text class="summary-label">今日做题</text>
        </view>
      </view>

      <!-- 做题趋势图 -->
      <view class="chart-section">
        <view class="section-header">
          <text class="section-title">做题趋势</text>
          <view class="range-tabs">
            <text class="range-tab" :class="{ active: rangeDays === 7 }" @click="switchRange(7)">近7天</text>
            <text class="range-tab" :class="{ active: rangeDays === 30 }" @click="switchRange(30)">近30天</text>
          </view>
        </view>
        
        <view v-if="dailyStats.length > 0" class="chart-container">
          <!-- 简易 SVG 折线图 -->
          <svg :viewBox="'0 0 ' + chartWidth + ' 160'" class="chart-svg">
            <!-- 水平网格线 -->
            <line v-for="i in 4" :key="'grid-' + i"
              :x1="0" :y1="i * 40" :x2="chartWidth" :y2="i * 40"
              stroke="#eee" stroke-width="0.5"
            />
            <!-- 折线路径 -->
            <polyline
              :points="linePoints"
              fill="none"
              stroke="#667eea"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <!-- 数据点 -->
            <circle v-for="(point, i) in chartPoints" :key="'pt-' + i"
              :cx="point.x" :cy="point.y" r="3"
              fill="#667eea"
            />
            <!-- 日期标签 -->
            <text v-for="(label, i) in dateLabels" :key="'dl-' + i"
              :x="label.x" :y="165" text-anchor="middle"
              font-size="8" fill="#999"
            >{{ label.text }}</text>
          </svg>
          
          <!-- 纵轴标签 -->
          <view class="chart-y-labels">
            <text class="y-label">{{ maxValue }}</text>
            <text class="y-label">{{ Math.round(maxValue * 0.5) }}</text>
            <text class="y-label">0</text>
          </view>
        </view>
        <view v-else class="chart-empty">
          <text class="chart-empty-text">暂无做题记录</text>
        </view>
      </view>

      <!-- 题库掌握度 -->
      <view class="mastery-section">
        <text class="section-title">各题库掌握度</text>
        <view v-if="masteryList.length > 0" class="mastery-list">
          <view v-for="item in masteryList" :key="item.libraryId" class="mastery-item">
            <view class="mastery-header">
              <text class="mastery-name">{{ item.libraryName }}</text>
              <text class="mastery-percent">{{ item.accuracy }}%</text>
            </view>
            <view class="mastery-bar">
              <view class="mastery-fill" :style="{ width: item.accuracy + '%', backgroundColor: getMasteryColor(item.accuracy) }"></view>
            </view>
            <text class="mastery-detail">{{ item.correctCount }}/{{ item.totalQuestions }} 题正确</text>
          </view>
        </view>
        <view v-else class="mastery-empty">
          <text class="empty-hint">暂无题库练习记录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useStatsStore } from '@/stores/stats'
import { useUserStore } from '@/stores/user'
import type { DailyStats, LibraryMastery } from '@/types'

const statsStore = useStatsStore()
const userStore = useUserStore()

const rangeDays = ref(7)
const dailyStats = ref<DailyStats[]>([])
const masteryList = ref<LibraryMastery[]>([])

const chartWidth = 300
const chartHeight = 160

/**
 * 切换时间范围并重新加载每日统计数据
 */
async function switchRange(days: number) {
  rangeDays.value = days
  const userId = userStore.getUserId()
  if (userId) {
    dailyStats.value = await statsStore.loadDailyStats(days)
  }
}

/**
 * 计算 Y 轴最大值（向上取整到10的倍数）
 */
const maxValue = computed(() => {
  if (dailyStats.value.length === 0) return 10
  const max = Math.max(...dailyStats.value.map(s => s.totalQuestions))
  return Math.ceil(max / 10) * 10 || 10
})

/**
 * 折线图数据点坐标
 */
const chartPoints = computed(() => {
  return dailyStats.value.map((stat, i) => {
    const x = (i / (dailyStats.value.length - 1 || 1)) * chartWidth
    const ratio = maxValue.value > 0 ? stat.totalQuestions / maxValue.value : 0
    const y = chartHeight - ratio * chartHeight
    return { x, y }
  })
})

/**
 * SVG polyline 的 points 属性字符串
 */
const linePoints = computed(() => {
  return chartPoints.value.map(p => `${p.x},${p.y}`).join(' ')
})

/**
 * 日期标签（格式化为 M/D）
 */
const dateLabels = computed(() => {
  return dailyStats.value.map((stat, i) => {
    const x = (i / (dailyStats.value.length - 1 || 1)) * chartWidth
    const parts = stat.date.split('-')
    const text = parts.length >= 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : stat.date
    return { x, text }
  })
})

/**
 * 根据正确率返回对应颜色
 * ≥80% 绿色, ≥60% 橙色, 否则红色
 */
function getMasteryColor(accuracy: number): string {
  if (accuracy >= 80) return '#52c41a'
  if (accuracy >= 60) return '#faad14'
  return '#ff4d4f'
}

onMounted(async () => {
  const userId = userStore.getUserId()
  if (userId) {
    await statsStore.loadStats(userId)
    dailyStats.value = await statsStore.loadDailyStats(7)
    masteryList.value = await statsStore.getLibraryMastery(userId)
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
}

.content {
  padding: 20px;
}

/* 累计统计 */
.summary-section {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  margin-bottom: 16px;
}

.summary-card {
  flex: 1;
  text-align: center;
}

.summary-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 4px;
}

.summary-label {
  font-size: 13px;
  color: #999;
}

.summary-divider {
  width: 1px;
  background: #f0f0f0;
  margin: 0 8px;
}

/* 图表 */
.chart-section {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.range-tabs {
  display: flex;
  gap: 4px;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 2px;
}

.range-tab {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #666;
  
  &.active {
    background: #667eea;
    color: #fff;
  }
}

.chart-container {
  position: relative;
  padding-left: 30px;
  padding-right: 10px;
}

.chart-svg {
  width: 100%;
  height: auto;
}

.chart-y-labels {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 25px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.y-label {
  font-size: 10px;
  color: #999;
  width: 25px;
  text-align: right;
}

.chart-empty, .mastery-empty {
  padding: 40px 0;
  text-align: center;
}

.chart-empty-text {
  font-size: 14px;
  color: #999;
}

/* 题库掌握度 */
.mastery-section {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.mastery-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mastery-item {
  padding-bottom: 12px;
  border-bottom: 1px solid #f5f5f5;
  
  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.mastery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.mastery-name {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.mastery-percent {
  font-size: 16px;
  font-weight: 700;
  color: #667eea;
}

.mastery-bar {
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
}

.mastery-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.mastery-detail {
  font-size: 12px;
  color: #999;
}

.empty-hint {
  font-size: 14px;
  color: #999;
}
</style>
