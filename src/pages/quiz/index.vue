<template>
  <view class="page">
    <NavBar :title="modeTitle" show-back />
    
    <view v-if="!isLoading && questions.length > 0" class="quiz-content">
      <view class="progress-section">
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: quizStore.progress() + '%' }"></view>
        </view>
        <text class="progress-text">{{ quizStore.currentIndex + 1 }} / {{ quizStore.totalQuestions() }}</text>
      </view>

      <scroll-view class="question-scroll" scroll-y>
        <QuestionCard
          :question="currentQuestion!"
          :selected-answers="currentAnswers"
          :show-result="showResult"
          :question-number="quizStore.currentIndex + 1"
          :total="quizStore.totalQuestions()"
          @select="handleSelect"
        />
      </scroll-view>

      <view v-if="showResult" class="result-tip">
        <text :class="isCorrect ? 'correct-tip' : 'wrong-tip'">
          {{ isCorrect ? '✓ 回答正确！' : '✗ 回答错误' }}
        </text>
      </view>

      <view class="action-bar">
        <BaseButton 
          variant="secondary"
          size="lg"
          class="action-btn"
          :disabled="quizStore.currentIndex === 0"
          @click="prevQuestion"
        >上一题</BaseButton>
        
        <BaseButton
          v-if="!showResult" 
          variant="primary"
          size="lg"
          class="action-btn"
          :loading="confirming"
          @click="confirmAnswer"
        >确认答案</BaseButton>
        
        <BaseButton
          v-else-if="quizStore.currentIndex < quizStore.totalQuestions() - 1" 
          variant="primary"
          size="lg"
          class="action-btn"
          @click="nextQuestion"
        >下一题</BaseButton>
        
        <BaseButton
          v-else 
          variant="primary"
          size="lg"
          class="action-btn"
          @click="submitQuiz"
        >提交试卷</BaseButton>
      </view>
    </view>

    <LoadingState v-if="isLoading" text="加载中..." />

    <EmptyState
      v-if="!isLoading && questions.length === 0 && !errorMsg"
      icon="📝"
      :title="'暂无题目'"
      description="该题库暂无题目或暂无错题"
    />

    <ErrorState
      v-if="!isLoading && errorMsg"
      :message="errorMsg"
      detail="请检查网络后重试"
      show-retry
      @retry="retryLoad"
    />

    <!-- 恢复进度弹窗 -->
    <view v-if="showResumeDialog" class="resume-overlay" @click="handleCancelResume">
      <view class="resume-dialog" @click.stop>
        <text class="resume-dialog-title">发现上次进度</text>
        <view class="resume-dialog-body">
          <text class="resume-progress-text">
            已完成 {{ (savedProgressData?.currentIndex || 0) + 1 }} / {{ savedProgressData?.questions?.length || 0 }} 题
          </text>
          <text class="resume-progress-text">
            {{ Math.round(((savedProgressData?.currentIndex || -1) + 1) / (savedProgressData?.questions?.length || 1) * 100) }}% 完成
          </text>
          <view v-if="libraryChanged" class="resume-warning">
            <text>⚠️ 题库已更新，继续旧进度可能与当前题库不一致，建议重新开始</text>
          </view>
        </view>
        <view class="resume-dialog-actions">
          <BaseButton variant="primary" size="lg" block @click="handleResume">继续上次进度</BaseButton>
          <BaseButton variant="secondary" size="lg" block @click="handleRestart">重新开始</BaseButton>
          <BaseButton variant="ghost" size="lg" block @click="handleCancelResume">返回</BaseButton>
        </view>
      </view>
    </view>

    <view v-if="showScore" class="score-overlay" @click="closeScore">
      <view class="score-content" @click.stop>
        <view class="score-icon">{{ scoreIcon }}</view>
        <text class="score-title">答题完成</text>
        <view class="score-info">
          <text class="score-value">{{ scoreResult.correct }}/{{ scoreResult.total }}</text>
          <text class="score-percent">{{ Math.round((scoreResult.correct / scoreResult.total) * 100) }}%</text>
        </view>
        <view class="score-stats">
          <view class="stat-row">
            <text class="stat-label">正确</text>
            <text class="stat-value correct">{{ scoreResult.correct }}</text>
          </view>
          <view class="stat-row">
            <text class="stat-label">错误</text>
            <text class="stat-value wrong">{{ scoreResult.total - scoreResult.correct }}</text>
          </view>
        </view>
        <BaseButton variant="primary" size="lg" block @click="closeScore">完成</BaseButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onUnload } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import QuestionCard from '@/components/QuestionCard.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useQuizStore } from '@/stores/quiz'
import { useLibraryStore } from '@/stores/library'
import { useWrongStore } from '@/stores/wrong'
import { useUserStore } from '@/stores/user'
import { ensureCloudReady } from '@/utils/cloud'
import { getQuizProgress, clearQuizProgress } from '@/utils/storage'
import { vibrateShort } from '@/utils/haptics'
import type { Question, QuizProgress } from '@/types'

const quizStore = useQuizStore()
const libraryStore = useLibraryStore()
const wrongStore = useWrongStore()
const userStore = useUserStore()

const isLoading = ref(true)
const showResult = ref(false)
const showScore = ref(false)
const confirming = ref(false)
const scoreResult = ref({ correct: 0, total: 0 })
const errorMsg = ref('')
const showResumeDialog = ref(false)
const savedProgressData = ref<QuizProgress | null>(null)
const libraryChanged = ref(false)
const targetQuestionId = ref('')

const mode = ref<'sequence' | 'random' | 'wrong'>('sequence')
const libraryId = ref('')

const modeTitle = computed(() => {
  const titles: Record<string, string> = {
    sequence: '顺序练习',
    random: '随机练习',
    wrong: '错题重做'
  }
  return titles[mode.value]
})

const questions = computed(() => quizStore.questions)

const currentQuestion = computed(() => quizStore.currentQuestion())

const currentAnswers = computed(() => {
  if (!currentQuestion.value) return []
  return quizStore.getAnswer(currentQuestion.value._id || '')
})

const isCorrect = computed(() => {
  if (!currentQuestion.value || !showResult.value) return false
  const correctAnswer = [...currentQuestion.value.answer].sort()
  const userAnswer = [...currentAnswers.value].sort()
  return arraysEqual(correctAnswer, userAnswer)
})

const scoreIcon = computed(() => {
  const percent = (scoreResult.value.correct / scoreResult.value.total) * 100
  if (percent >= 90) return '🏆'
  if (percent >= 70) return '👍'
  if (percent >= 60) return '💪'
  return '📚'
})

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((val, idx) => val === b[idx])
}

function handleSelect(answer: string) {
  if (!currentQuestion.value || showResult.value) return
  
  const questionId = currentQuestion.value._id || ''
  let current = [...currentAnswers.value]
  
  if (currentQuestion.value.type === 'multiple') {
    if (current.includes(answer)) {
      current = current.filter(a => a !== answer)
    } else {
      current.push(answer)
    }
  } else {
    current = [answer]
  }
  
  quizStore.setAnswer(questionId, current)
  vibrateShort('light')
}

async function confirmAnswer() {
  if (currentAnswers.value.length === 0) {
    uni.showToast({ title: '请选择答案', icon: 'none' })
    return
  }
  confirming.value = true
  try {
    showResult.value = true
    quizStore.recordSingleAnswer(isCorrect.value)

    // 触觉反馈
    vibrateShort(isCorrect.value ? 'medium' : 'heavy')

    const effectiveLibraryId = libraryId.value || currentQuestion.value?.libraryId || ''
    if (!isCorrect.value && currentQuestion.value && effectiveLibraryId) {
      try {
        await wrongStore.addWrongQuestion(
          userStore.openid!,
          currentQuestion.value._id || '',
          [...currentAnswers.value].sort(),
          effectiveLibraryId
        )
      } catch (e) {
        console.error('实时记录错题失败', e)
      }
    }
  } finally {
    confirming.value = false
  }
}

function prevQuestion() {
  if (quizStore.currentIndex > 0) {
    quizStore.prevQuestion()
    showResult.value = false
  }
}

function nextQuestion() {
  if (quizStore.currentIndex < quizStore.totalQuestions() - 1) {
    quizStore.nextQuestion()
    showResult.value = false
  }
}

async function submitQuiz() {
  scoreResult.value = quizStore.calculateScore()
  
  if (userStore.openid) {
    await quizStore.saveResults(userStore.openid)
  }
  
  quizStore.finishQuiz()
  showScore.value = true
}

function closeScore() {
  showScore.value = false
  uni.navigateBack()
}

async function loadQuizData() {
  isLoading.value = true
  errorMsg.value = ''

  try {
    await ensureCloudReady()

    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const options = (currentPage as any)?.options || {}

    mode.value = (options.mode as 'sequence' | 'random' | 'wrong') || 'sequence'
    libraryId.value = options.libraryId ? decodeURIComponent(options.libraryId) : ''
    targetQuestionId.value = options.questionId || ''

    if (mode.value !== 'wrong' && libraryId.value) {
      const saved = getQuizProgress(libraryId.value, mode.value)
      if (saved && saved.questions && saved.questions.length > 0) {
        savedProgressData.value = saved
        showResumeDialog.value = true
        isLoading.value = false
        return
      }
    }

    await loadQuestionsForMode()
    isLoading.value = false
  } catch (e) {
    console.error('加载题目失败', e)
    errorMsg.value = '加载题目失败'
    isLoading.value = false
  }
}

function retryLoad() {
  loadQuizData()
}

async function loadQuestionsForMode() {
  if (!userStore.openid) {
    await userStore.doLogin()
  }

  if (mode.value === 'wrong') {
    const wrongDetails = await wrongStore.getWrongQuestionDetails(userStore.openid!, libraryId.value || undefined)
    const questions = wrongDetails.map(w => w.question)
    quizStore.initQuiz(questions, 'wrong')
  } else if (libraryId.value) {
    const questions = await libraryStore.getQuestions(libraryId.value)
    if (questions.length === 0) {
      const lib = libraryStore.libraries.find(l => l._id === libraryId.value)
      if (lib && lib.totalQuestions > 0) {
        errorMsg.value = '题目加载失败'
      }
    }
    quizStore.initQuiz(questions, mode.value)
    if (questions.length > 0) {
      quizStore.saveProgress()
    }

    if (targetQuestionId.value && quizStore.questions.length > 0) {
      const idx = quizStore.questions.findIndex(q => q._id === targetQuestionId.value)
      if (idx !== -1) quizStore.goToQuestion(idx)
    }
  } else {
    errorMsg.value = '题库参数缺失'
  }
}

function handleResume() {
  const saved = savedProgressData.value
  if (!saved) return

  quizStore.loadProgress(libraryId.value, mode.value)
  showResumeDialog.value = false
}

async function handleRestart() {
  showResumeDialog.value = false
  clearQuizProgress(libraryId.value, mode.value)
  isLoading.value = true
  await loadQuestionsForMode()
  isLoading.value = false
}

function handleCancelResume() {
  showResumeDialog.value = false
  uni.navigateBack()
}

onMounted(() => {
  loadQuizData()
})

onUnload(() => {
  if (mode.value !== 'wrong' && libraryId.value && quizStore.questions.length > 0 && !quizStore.isFinished) {
    quizStore.saveProgress()
  }
})
</script>

<style lang="scss" scoped>
@import '@/styles/tokens/_index.scss';

.page {
  min-height: 100vh;
  background: $color-bg-page;
  display: flex;
  flex-direction: column;
}

.quiz-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: $space-lg;
}

.progress-section {
  margin-bottom: $space-lg;
}

.progress-bar {
  height: 12rpx;
  background: $color-border-light;
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: $gradient-primary;
  border-radius: 6rpx;
  transition: width $duration-base $ease-default;
}

.progress-text {
  display: block;
  text-align: right;
  font-size: $font-size-xs;
  color: $color-text-tertiary;
  margin-top: $space-sm;
}

.question-scroll {
  flex: 1;
  height: 0;
}

.result-tip {
  margin: $space-lg 0;
  padding: $space-md;
  border-radius: $radius-lg;
  text-align: center;
}

.correct-tip {
  color: $color-success;
  font-weight: $font-weight-semibold;
}

.wrong-tip {
  color: $color-error;
  font-weight: $font-weight-semibold;
}

.action-bar {
  display: flex;
  gap: $space-md;
  padding: $space-lg 0;
}

.action-btn {
  flex: 1;
}

// 恢复进度弹窗
.resume-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: $color-bg-mask;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: $space-xl;
  animation: overlayFadeIn $duration-slow $ease-out;
}

.resume-dialog {
  width: 100%;
  max-width: 680rpx;
  background: $color-bg-card;
  border-radius: $radius-3xl;
  padding: $space-3xl $space-2xl;
  animation: modalScaleIn $duration-slow $ease-bounce;
}

.resume-dialog-title {
  display: block;
  font-size: $font-size-2xl;
  font-weight: $font-weight-semibold;
  color: $color-text-primary;
  text-align: center;
  margin-bottom: $space-xl;
}

.resume-dialog-body {
  background: $color-bg-input;
  border-radius: $radius-lg;
  padding: $space-lg;
  margin-bottom: $space-2xl;
}

.resume-progress-text {
  display: block;
  font-size: $font-size-md;
  color: $color-text-secondary;
  text-align: center;

  & + & {
    margin-top: $space-sm;
    font-size: $font-size-xs;
    color: $color-text-tertiary;
  }
}

.resume-warning {
  margin-top: $space-md;
  padding: 20rpx;
  background: $color-warning-bg;
  border-radius: $radius-md;
  border-left: 6rpx solid #faad14;

  text {
    font-size: 26rpx;
    color: #d48806;
    line-height: $line-height-base;
  }
}

.resume-dialog-actions {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

// 分数弹窗
.score-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: $color-bg-mask;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: $space-xl;
  animation: overlayFadeIn $duration-slow $ease-out;
}

.score-content {
  width: 100%;
  max-width: 640rpx;
  background: $color-bg-card;
  border-radius: $radius-3xl;
  padding: 80rpx $space-3xl;
  text-align: center;
  animation: modalScaleIn $duration-slow $ease-bounce;
}

.score-icon {
  font-size: 128rpx;
  margin-bottom: $space-lg;
}

.score-title {
  display: block;
  font-size: $font-size-2xl;
  font-weight: $font-weight-semibold;
  color: $color-text-primary;
  margin-bottom: $space-2xl;
}

.score-info {
  margin-bottom: $space-2xl;
}

.score-value {
  display: block;
  font-size: $font-size-display;
  font-weight: $font-weight-bold;
  color: $color-primary;
}

.score-percent {
  display: block;
  font-size: $font-size-lg;
  color: $color-text-tertiary;
  margin-top: $space-sm;
}

.score-stats {
  background: $color-bg-input;
  border-radius: $radius-lg;
  padding: $space-lg;
  margin-bottom: $space-2xl;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  & + & {
    margin-top: $space-md;
    padding-top: $space-md;
    border-top: 1rpx solid $color-border-base;
  }
}

.stat-label {
  font-size: $font-size-base;
  color: $color-text-secondary;
}

.stat-value {
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  
  &.correct {
    color: $color-success;
  }
  
  &.wrong {
    color: $color-error;
  }
}
</style>
