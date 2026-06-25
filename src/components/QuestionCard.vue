<template>
  <view class="question-card">
    <view class="question-type">
      <text class="type-tag" :class="typeClass">{{ typeText }}</text>
      <text class="question-number">{{ questionNumber }}/{{ total }}</text>
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
  questionNumber?: number
  total?: number
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

.question-card {
  background: $color-bg-card;
  border-radius: $radius-xl;
  padding: $space-xl;
  margin-bottom: $space-lg;
  box-shadow: $shadow-lg;
}

.question-type {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $space-lg;
}

.type-tag {
  padding: $space-xs $space-md;
  border-radius: $radius-full;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  
  &.single {
    background: $color-info-bg;
    color: $color-info;
  }
  
  &.multiple {
    background: $color-success-bg;
    color: $color-success;
  }
  
  &.judge {
    background: $color-warning-bg;
    color: $color-warning;
  }
}

.question-number {
  font-size: $font-size-base;
  color: $color-text-tertiary;
}

.question-content {
  font-size: $font-size-xl;
  color: $color-text-primary;
  line-height: $line-height-relaxed;
  margin-bottom: $space-xl;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: $space-md;
}

.option-item {
  display: flex;
  align-items: center;
  padding: $space-lg;
  background: $color-bg-input;
  border-radius: $radius-lg;
  border: 2rpx solid transparent;
  transition: background $duration-fast, border-color $duration-fast, transform $duration-instant;
  
  &:active:not(.correct):not(.wrong) {
    transform: scale(0.99);
    background: #f0f1f2;
  }
  
  &.selected {
    background: $color-primary-light;
    border-color: $color-primary;
  }
  
  &.correct {
    background: $color-success-bg;
    border-color: $color-success;
    animation: pulseCorrect $duration-slow $ease-bounce;
  }
  
  &.wrong {
    background: $color-error-bg;
    border-color: $color-error;
    animation: shake $duration-slow $ease-out;
  }
}

.option-marker {
  width: 56rpx;
  height: 56rpx;
  border-radius: $radius-full;
  background: $color-bg-card;
  border: 2rpx solid $color-border-input;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-base;
  font-weight: $font-weight-semibold;
  color: $color-text-secondary;
  margin-right: $space-md;
  flex-shrink: 0;
  transition: all $duration-fast;
  
  .selected & {
    background: $color-primary;
    border-color: $color-primary;
    color: $color-text-inverse;
  }
  
  .correct & {
    background: $color-success;
    border-color: $color-success;
    color: $color-text-inverse;
  }
  
  .wrong & {
    background: $color-error;
    border-color: $color-error;
    color: $color-text-inverse;
  }
}

.option-text {
  flex: 1;
  font-size: $font-size-lg;
  color: $color-text-primary;
}

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
