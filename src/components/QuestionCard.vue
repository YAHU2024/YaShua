<template>
  <view class="question-card">
    <view class="question-type">
      <text class="type-tag" :class="typeClass">{{ typeText }}</text>
    </view>
    <view class="question-content">
      <text>{{ question.content }}</text>
    </view>
    <view class="options-list">
      <view
        v-for="(option, index) in options"
        :key="index"
        class="option-item"
        :class="{
          selected: isSelected(option),
          correct: showResult && isCorrectOption(option),
          wrong: showResult && isSelected(option) && !isCorrectOption(option)
        }"
        :role="question.type === 'multiple' ? 'checkbox' : 'radio'"
        :aria-checked="isSelected(option)"
        @click="handleSelect(option)"
      >
        <view class="option-marker">{{ getOptionMarker(index) }}</view>
        <text class="option-text">{{ getOptionText(option) }}</text>
        <view v-if="showResult && isCorrectOption(option)" class="option-icon correct-icon">✓</view>
        <view v-else-if="showResult && isSelected(option) && !isCorrectOption(option)" class="option-icon wrong-icon">✗</view>
      </view>
    </view>
    <view v-if="showResult && question.analysis" class="analysis-section">
      <view class="analysis-title">解析</view>
      <view class="analysis-content">{{ question.analysis }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Question } from '@/types'

const props = defineProps<{
  question: Question
  selectedAnswers: string[]
  showResult?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', answer: string): void
}>()

const typeText = computed(() => {
  const types: Record<string, string> = {
    single: '单选题',
    multiple: '多选题',
    judge: '判断题'
  }
  return types[props.question.type] || '单选题'
})

const typeClass = computed(() => props.question.type)

const options = computed(() => {
  if (props.question.type === 'judge') {
    return ['正确', '错误']
  }
  return props.question.options
})

function getOptionMarker(index: number): string {
  if (props.question.type === 'judge') {
    return index === 0 ? '✓' : '✗'
  }
  return String.fromCharCode(65 + index)
}

function getOptionText(option: string): string {
  if (props.question.type === 'judge') {
    return option
  }
  const match = option.match(/^[A-Za-z]\.\s*(.+)/)
  return match ? match[1] : option
}

function isSelected(option: string): boolean {
  const marker = props.question.type === 'judge' 
    ? (option === '正确' ? '正确' : '错误')
    : option.charAt(0).toUpperCase()
  return props.selectedAnswers.includes(marker)
}

function isCorrectOption(option: string): boolean {
  const marker = props.question.type === 'judge'
    ? option
    : option.charAt(0).toUpperCase()
  return props.question.answer.includes(marker)
}

function handleSelect(option: string) {
  if (props.disabled || props.showResult) return
  
  const marker = props.question.type === 'judge'
    ? (option === '正确' ? '正确' : '错误')
    : option.charAt(0).toUpperCase()
    
  emit('select', marker)
}
</script>

<style lang="scss" scoped>
@import '@/styles/tokens/_index.scss';

// ============ 题目卡片容器 — 微立体悬浮 ============
.question-card {
  background: $color-bg-card;
  border-radius: $radius-xl;
  padding: $space-xl;
  margin-bottom: $space-lg;
  box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.03);
}

// ============ 题型标签区域 ============
.question-type {
  display: flex;
  align-items: center;
  margin-bottom: $space-xl;
}

// 圆角矩形标签（非胶囊形）
.type-tag {
  padding: 8rpx 20rpx;
  border-radius: $radius-sm;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  letter-spacing: 0.5rpx;
  
  &.single {
    background: $color-tag-single-bg;
    color: $color-primary;
  }
  
  &.multiple {
    background: $color-tag-multiple-bg;
    color: #389e0d;
  }
  
  &.judge {
    background: $color-tag-judge-bg;
    color: #d46b08;
  }
}

// ============ 题目正文 ============
.question-content {
  font-size: $font-size-xl;
  color: $color-text-primary;
  line-height: 1.6;
  margin-bottom: $space-2xl;
}

// ============ 选项列表 ============
.options-list {
  display: flex;
  flex-direction: column;
  gap: $space-md;
}

// ============ 选项卡片 — 三级状态重构 ============
.option-item {
  display: flex;
  align-items: center;
  padding: $space-lg;
  background: $color-option-bg;
  border-radius: $radius-lg;
  border: 1px solid $color-option-border;
  transition: all $duration-fast $ease-default;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.02);
  
  // 点击缩放反馈
  &:active:not(.correct):not(.wrong) {
    transform: scale(0.98);
  }
  
  // 已选中态 — 淡紫背景 + 半透明紫边框
  &.selected {
    background: $color-option-selected-bg;
    border-color: $color-option-selected-border;
    box-shadow: none;
  }
  
  // 正确态 — 绿色背景 + 弹性脉冲
  &.correct {
    background: $color-success-bg;
    border-color: $color-success-border;
    box-shadow: none;
    animation: pulseCorrect $duration-slow $ease-bounce;
  }
  
  // 错误态 — 红色背景 + 抖动
  &.wrong {
    background: $color-error-bg;
    border-color: $color-error-border;
    box-shadow: none;
    animation: shake $duration-slow $ease-out;
  }
}

// ============ 选项标记圆圈 — 渐变升级 ============
.option-marker {
  width: 56rpx;
  height: 56rpx;
  border-radius: $radius-full;
  background: $color-option-marker-bg;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-base;
  font-weight: $font-weight-semibold;
  color: $color-text-secondary;
  margin-right: $space-md;
  flex-shrink: 0;
  transition: all $duration-fast $ease-default;
  
  // 选中态 — 渐变深紫 + 白色文字 + 内阴影
  .selected & {
    background: $gradient-primary;
    color: $color-text-inverse;
    box-shadow: $color-option-selected-marker-shadow;
  }
  
  .correct & {
    background: $gradient-success;
    color: $color-text-inverse;
  }
  
  .wrong & {
    background: $color-error;
    color: $color-text-inverse;
  }
}

// ============ 选项文字 ============
.option-text {
  flex: 1;
  font-size: $font-size-lg;
  color: $color-text-primary;
}

// ============ 正确/错误图标 ============
.option-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: $radius-full;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-base;
  font-weight: $font-weight-bold;
  margin-left: $space-md;
  
  &.correct-icon {
    background: $color-success;
    color: $color-text-inverse;
  }
  
  &.wrong-icon {
    background: $color-error;
    color: $color-text-inverse;
  }
}

// ============ 解析区域 ============
.analysis-section {
  margin-top: $space-xl;
  padding-top: $space-xl;
  border-top: 1rpx solid $color-border-base;
}

.analysis-title {
  font-size: $font-size-base;
  font-weight: $font-weight-semibold;
  color: $color-primary;
  margin-bottom: $space-sm;
}

.analysis-content {
  font-size: $font-size-md;
  color: $color-text-secondary;
  line-height: $line-height-relaxed;
  background: $color-bg-input;
  padding: $space-md;
  border-radius: $radius-md;
}
</style>
