<template>
  <view class="cp-container">
    <canvas 
      type="2d" 
      id="cp-canvas" 
      class="cp-canvas"
    ></canvas>
    <!-- 中心文字层（覆盖在 canvas 上方） -->
    <view class="cp-center">
      <text class="cp-value">{{ displayValue }}</text>
      <text class="cp-label">{{ label }}</text>
    </view>
    <!-- 底部百分比 -->
    <view class="cp-bottom">
      <text class="cp-percent">{{ percentage }}%</text>
      <text class="cp-bottom-label">{{ subLabel }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, getCurrentInstance } from 'vue'

const props = defineProps<{
  value: number       // 已完成数量（中心大数字）
  total: number       // 总数
  label: string       // 下方标签（如"已完成"）
  subLabel?: string   // 底部副标签（如"今日正确率"）
}>()

const instance = getCurrentInstance()
const displayValue = ref(0)

const percentage = computed(() => {
  if (props.total === 0) return 0
  return Math.round((props.value / props.total) * 100)
})

// Canvas 绘制
let canvasNode: any = null
let ctx: any = null
let animFrameId: number | null = null

// 设计尺寸 (rpx → 实际 px 由 canvas 属性设置)
const CANVAS_SIZE = 300  // rpx（CSS 尺寸）
const LINE_WIDTH = 14    // rpx（描边宽度）
const RING_RADIUS = 108  // rpx（环外径中心）

async function initCanvas() {
  try {
    const query = uni.createSelectorQuery().in(instance?.proxy || instance)
    const res = await new Promise<any>((resolve) => {
      query.select('#cp-canvas')
        .fields({ node: true, size: true })
        .exec((res) => resolve(res))
    })
    
    if (!res?.[0]?.node) {
      console.warn('[CircularProgress] canvas node not found, retrying...')
      setTimeout(initCanvas, 200)
      return
    }

    canvasNode = res[0].node
    ctx = canvasNode.getContext('2d')

    const dpr = uni.getSystemInfoSync().pixelRatio
    // Canvas 实际像素尺寸 = CSS 尺寸 × DPR
    const cssWidth = res[0].width
    const cssHeight = res[0].height
    canvasNode.width = cssWidth * dpr
    canvasNode.height = cssHeight * dpr
    ctx.scale(dpr, dpr)

    await drawRing()
  } catch (e) {
    console.error('[CircularProgress] initCanvas error:', e)
  }
}

// 绘制环形进度
async function drawRing(targetProgress?: number) {
  if (!ctx) return

  const w = CANVAS_SIZE
  const h = CANVAS_SIZE
  const cx = w / 2
  const cy = h * 0.45  // 环中心偏上，给底部文字留空间
  const r = RING_RADIUS

  // 终止之前的动画
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }

  const finalProgress = targetProgress ?? percentage.value
  const startProgress = 0
  const duration = 800  // ms
  const startTime = Date.now()

  ctx.clearRect(0, 0, w, h)

  function frame() {
    const elapsed = Date.now() - startTime
    const t = Math.min(elapsed / duration, 1)
    // 缓出函数 (ease-out)
    const ease = 1 - Math.pow(1 - t, 3)
    const currentProgress = startProgress + (finalProgress - startProgress) * ease

    ctx.clearRect(0, 0, w, h)

    // --- 底环（背景轨道）---
    drawArc(
      cx, cy, r, LINE_WIDTH,
      0, 360,
      'rgba(74, 71, 163, 0.08)',  // 浅紫色底环
      'round'
    )

    // --- 进度弧 ---
    if (currentProgress > 0) {
      // 使用紫色渐变描边
      const startAngleDeg = -90  // 从12点钟方向开始
      const sweepDeg = currentProgress * 3.6  // 进度百分比转角度

      drawArc(
        cx, cy, r, LINE_WIDTH,
        startAngleDeg, sweepDeg,
        getGradient(cx, cy - r, cx + r, cy),
        'round'
      )
    }

    // --- 科技感光晕点（进度弧末端）---
    if (currentProgress > 1) {
      const endAngle = (-90 + currentProgress * 3.6) * Math.PI / 180
      const dotX = cx + (r - 2) * Math.cos(endAngle)
      const dotY = cy + (r - 2) * Math.sin(endAngle)
      
      ctx.beginPath()
      ctx.arc(dotX, dotY, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#7048B6'
      ctx.fill()
      
      // 外发光
      ctx.beginPath()
      ctx.arc(dotX, dotY, 14, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(112, 72, 182, 0.3)'
      ctx.fill()
    }

    if (t < 1) {
      animFrameId = requestAnimationFrame(frame) as unknown as number
    } else {
      animFrameId = null
    }
  }

  frame()
}

function drawArc(
  cx: number, cy: number, radius: number, lineWidth: number,
  startDeg: number, sweepDeg: number,
  color: string | CanvasGradient,
  lineCap: CanvasLineCap
) {
  ctx.beginPath()
  ctx.arc(
    cx, cy, radius,
    (startDeg * Math.PI) / 180,
    ((startDeg + sweepDeg) * Math.PI) / 180,
    false
  )
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = lineCap
  ctx.stroke()
}

function getGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const grad = ctx.createLinearGradient(x0, y0, x1, y1)
  grad.addColorStop(0, '#4A47A3')
  grad.addColorStop(0.5, '#5C4FB0')
  grad.addColorStop(1, '#7048B6')
  return grad
}

// 数字动画
function animateValue(target: number) {
  let startVal = 0
  const duration = 600
  const startTime = Date.now()

  function frame() {
    const elapsed = Date.now() - startTime
    const t = Math.min(elapsed / duration, 1)
    const ease = 1 - Math.pow(1 - t, 2)
    displayValue.value = Math.round(startVal + (target - startVal) * ease)

    if (t < 1) {
      requestAnimationFrame(frame)
    } else {
      displayValue.value = target
    }
  }
  frame()
}

// 监听 props 变化
watch(() => [props.value, props.total], () => {
  nextTick(() => {
    if (ctx) {
      drawRing(percentage.value)
    }
  })
  animateValue(props.value)
})

onMounted(() => {
  nextTick(() => {
    initCanvas()
    animateValue(props.value)
  })
})
</script>

<style lang="scss" scoped>
.cp-container {
  position: relative;
  width: 300rpx;
  height: 340rpx;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cp-canvas {
  width: 300rpx;
  height: 300rpx;
}

.cp-center {
  position: absolute;
  top: 90rpx;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.cp-value {
  font-size: 72rpx;
  font-weight: 700;
  color: #4A47A3;
  line-height: 1;
}

.cp-label {
  font-size: 24rpx;
  color: #8E8E93;
  margin-top: 8rpx;
}

.cp-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 0rpx;
}

.cp-percent {
  font-size: 28rpx;
  font-weight: 600;
  color: #4A47A3;
  line-height: 1;
}

.cp-bottom-label {
  font-size: 22rpx;
  color: #8E8E93;
  margin-top: 4rpx;
}
</style>
