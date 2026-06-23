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
  // options 已改为可选，需要空值保护
  return props.question.options || []
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
.question-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.question-type {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.type-tag {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  
  &.single {
    background: #e8f4fd;
    color: #1890ff;
  }
  
  &.multiple {
    background: #f6ffed;
    color: #52c41a;
  }
  
  &.judge {
    background: #fff7e6;
    color: #fa8c16;
  }
}

.question-number {
  font-size: 14px;
  color: #999;
}

.question-content {
  font-size: 18px;
  color: #333;
  line-height: 1.6;
  margin-bottom: 20px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px solid transparent;
  transition: all 0.3s;
  
  &.selected {
    background: #f0f5ff;
    border-color: #667eea;
  }
  
  &.correct {
    background: #f6ffed;
    border-color: #52c41a;
  }
  
  &.wrong {
    background: #fff2f0;
    border-color: #ff4d4f;
  }
}

.option-marker {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #666;
  margin-right: 12px;
  flex-shrink: 0;
  
  .selected & {
    background: #667eea;
    border-color: #667eea;
    color: #fff;
  }
  
  .correct & {
    background: #52c41a;
    border-color: #52c41a;
    color: #fff;
  }
  
  .wrong & {
    background: #ff4d4f;
    border-color: #ff4d4f;
    color: #fff;
  }
}

.option-text {
  flex: 1;
  font-size: 16px;
  color: #333;
}

.option-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  margin-left: 12px;
  
  &.correct-icon {
    background: #52c41a;
    color: #fff;
  }
  
  &.wrong-icon {
    background: #ff4d4f;
    color: #fff;
  }
}

.analysis-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.analysis-title {
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 8px;
}

.analysis-content {
  font-size: 15px;
  color: #666;
  line-height: 1.8;
  background: #f8f9fa;
  padding: 12px;
  border-radius: 8px;
}
</style>
