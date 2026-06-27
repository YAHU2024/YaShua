<template>
  <ThemeWrapper>
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
          @select="handleSelect"
        />

        <!-- AI 解析区域 -->
        <view v-if="showResult" class="ai-analysis-section">
          <!-- AI 加载中 -->
          <view v-if="aiLoading" class="ai-loading">
            <view class="ai-loading-spinner">
              <view
                v-for="i in 3"
                :key="i"
                class="spinner-dot"
                :style="{ animationDelay: `${(i - 1) * 0.15}s` }"
              />
            </view>
            <text class="ai-loading-text">{{ aiAnalysisText ? '重新生成中...' : 'AI 解析中...' }}</text>
          </view>

          <!-- AI 解析按钮（首次请求） -->
          <view v-else-if="!aiAnalysisText" class="ai-analyze-area">
            <view class="ai-analysis-title">✨ AI 解析</view>
            <BaseButton
              variant="outline"
              size="md"
              class="ai-analyze-btn"
              @click="requestAIAnalysis"
            >点击获取 AI 解析</BaseButton>
          </view>

          <!-- AI 解析结果 -->
          <view v-else class="ai-result-area">
            <view class="ai-analysis-title-row">
              <text class="ai-analysis-title">✨ AI 解析</text>
              <view
                class="ai-regenerate-btn"
                :class="{ disabled: aiLoading }"
                @click="regenerateAIAnalysis"
              >
                <text class="ai-regenerate-icon">↻</text>
                <text class="ai-regenerate-text">重新生成</text>
              </view>
            </view>
            <view class="ai-analysis-content">{{ aiAnalysisText }}</view>
          </view>

          <!-- AI 错误提示 -->
          <view v-if="aiError" class="ai-error">
            <text class="ai-error-text">{{ aiError }}</text>
          </view>
        </view>
      </scroll-view>

      <view class="action-bar">
        <BaseButton
          variant="outline"
          size="lg"
          block
          class="action-btn action-btn-prev"
          :disabled="quizStore.currentIndex === 0"
          @click="prevQuestion"
        >上一题</BaseButton>

        <BaseButton
          v-if="!showResult"
          variant="primary"
          size="lg"
          block
          class="action-btn"
          :loading="confirming"
          @click="confirmAnswer"
        >确认答案</BaseButton>

        <BaseButton
          v-else-if="quizStore.currentIndex < quizStore.totalQuestions() - 1"
          variant="primary"
          size="lg"
          block
          class="action-btn"
          @click="nextQuestion"
        >下一题</BaseButton>

        <BaseButton
          v-else
          variant="primary"
          size="lg"
          block
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
  </ThemeWrapper>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onUnload } from '@dcloudio/uni-app'
import ThemeWrapper from '@/components/ThemeWrapper.vue'
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
import { useAiSettingsStore } from '@/stores/aiSettings'
import { ensureCloudReady, isCloudAvailable } from '@/utils/cloud'
import { analyzeQuestion, getCachedAnalysis } from '@/utils/aiParser'
import { getQuizProgress, clearQuizProgress } from '@/utils/storage'
import { vibrateShort } from '@/utils/haptics'
import type { Question, QuizProgress } from '@/types'

const quizStore = useQuizStore()
const libraryStore = useLibraryStore()
const wrongStore = useWrongStore()
const userStore = useUserStore()
const aiSettings = useAiSettingsStore()

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

// AI 解析状态
const aiLoading = ref(false)
const aiAnalysisText = ref('')
const aiError = ref('')
const analyzingQuestionId = ref('')
const AI_ANALYSIS_TIMEOUT = 50000 // 50 秒超时保护（需大于云函数重试总耗时 ~42s）

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
    console.log('[quiz] showResult=true, AI section should render', {
      aiLoading: aiLoading.value,
      aiAnalysisText: aiAnalysisText.value,
      aiError: aiError.value
    })
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

async function requestAIAnalysis() {
  if (!currentQuestion.value || aiLoading.value) return

  console.log('[quiz] AI 解析按钮被点击', {
    questionId: currentQuestion.value._id,
    isCloudAvailable: isCloudAvailable()
  })

  const qid = currentQuestion.value._id || ''
  analyzingQuestionId.value = qid
  aiLoading.value = true
  aiError.value = ''

  try {
    // 超时保护：防止 loading 无限旋转
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        analyzeQuestion(
          currentQuestion.value,
          [...currentAnswers.value],
          isCorrect.value,
          aiSettings.getProviderConfig()
        ),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('AI_ANALYSIS_TIMEOUT')), AI_ANALYSIS_TIMEOUT)
        })
      ])
      // 守卫：丢弃切题后的过期响应
      if (analyzingQuestionId.value !== qid) return
      aiAnalysisText.value = result
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  } catch (e: any) {
    if (analyzingQuestionId.value !== qid) return
    // 详细日志记录（控制台），友好提示（用户界面）
    console.error('AI 解析失败', {
      questionId: qid,
      error: e,
      message: e?.message || e?.errMsg || 'unknown'
    })
    // 适配微信错误对象（errMsg）+ 超时判断
    const errMsg = e?.errMsg || e?.message || ''
    if (errMsg.includes('AI_ANALYSIS_TIMEOUT') || errMsg.includes('timeout') || errMsg.includes('超时')) {
      aiError.value = 'AI 解析超时，请稍后重试'
    } else if (errMsg.includes('云开发不可用') || errMsg.includes('网络')) {
      aiError.value = '网络连接异常，请检查网络后重试'
    } else {
      aiError.value = 'AI 解析暂时不可用，请稍后重试'
    }
  } finally {
    aiLoading.value = false
  }
}

async function regenerateAIAnalysis() {
  if (!currentQuestion.value || aiLoading.value) return

  const qid = currentQuestion.value._id || ''
  analyzingQuestionId.value = qid
  aiLoading.value = true
  aiError.value = ''

  try {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        analyzeQuestion(
          currentQuestion.value,
          [...currentAnswers.value],
          isCorrect.value,
          aiSettings.getProviderConfig(),
          true // forceRegenerate: 跳过缓存，强制重新生成
        ),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('AI_ANALYSIS_TIMEOUT')), AI_ANALYSIS_TIMEOUT)
        })
      ])
      if (analyzingQuestionId.value !== qid) return
      aiAnalysisText.value = result
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  } catch (e: any) {
    if (analyzingQuestionId.value !== qid) return
    console.error('AI 重新生成失败', { questionId: qid, error: e })
    const errMsg = e?.errMsg || e?.message || ''
    if (errMsg.includes('AI_ANALYSIS_TIMEOUT') || errMsg.includes('timeout') || errMsg.includes('超时')) {
      aiError.value = 'AI 解析超时，请稍后重试'
    } else if (errMsg.includes('云开发不可用') || errMsg.includes('网络')) {
      aiError.value = '网络连接异常，请检查网络后重试'
    } else {
      aiError.value = 'AI 解析暂时不可用，请稍后重试'
    }
  } finally {
    aiLoading.value = false
  }
}

/**
 * 切题后自动检查当前题目是否有已缓存的 AI 解析，有则直接展示
 */
function loadCachedAnalysis() {
  if (!currentQuestion.value) return
  const cached = getCachedAnalysis(currentQuestion.value)
  if (cached) {
    aiAnalysisText.value = cached
    aiError.value = ''
  } else {
    aiAnalysisText.value = ''
    aiError.value = ''
  }
}

function prevQuestion() {
  if (quizStore.currentIndex > 0) {
    quizStore.prevQuestion()
    showResult.value = false
    aiLoading.value = false
    loadCachedAnalysis()
  }
}

function nextQuestion() {
  if (quizStore.currentIndex < quizStore.totalQuestions() - 1) {
    quizStore.nextQuestion()
    showResult.value = false
    aiLoading.value = false
    loadCachedAnalysis()
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

    // 初始加载完成后，自动展示当前题目的缓存解析
    loadCachedAnalysis()
  } else {
    errorMsg.value = '题库参数缺失'
  }
}

function handleResume() {
  const saved = savedProgressData.value
  if (!saved) return

  quizStore.loadProgress(libraryId.value, mode.value)
  showResumeDialog.value = false
  // 恢复进度后，自动展示当前题目的缓存解析
  loadCachedAnalysis()
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
  background: var(--color-bg-page);
  display: flex;
  flex-direction: column;
}

.quiz-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: $space-lg;
  padding-bottom: 0;
}

.progress-section {
  margin-bottom: $space-lg;
}

.progress-bar {
  height: 6rpx;
  background: rgba(74, 71, 163, 0.08);
  border-radius: 4rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: 4rpx;
  transition: width $duration-base $ease-default;
}

.progress-text {
  display: block;
  text-align: right;
  font-size: $font-size-xs;
  color: var(--color-text-tertiary);
  margin-top: $space-sm;
}

.question-scroll {
  flex: 1;
  height: 0;
  padding-bottom: 220rpx; // 为固定 action-bar 留出足够空间（~196rpx）
}

// ============ AI 解析区域（与 QuestionCard 解析区域同风格） ============
.ai-analysis-section {
  margin-top: $space-xl;
  padding-top: $space-xl;
  border-top: 1rpx solid var(--color-border-base);
}

.ai-analyze-area {
  // 按钮态容器
}

.ai-analysis-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $space-sm;
}

.ai-analysis-title {
  font-size: $font-size-base;
  font-weight: $font-weight-semibold;
  color: var(--color-primary);
}

.ai-regenerate-btn {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 6rpx 16rpx;
  border-radius: $radius-sm;
  background: var(--color-bg-hover);

  &.disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

.ai-regenerate-icon {
  font-size: $font-size-base;
  color: var(--color-text-tertiary);
}

.ai-regenerate-text {
  font-size: $font-size-xs;
  color: var(--color-text-tertiary);
}

.ai-analyze-btn {
  width: 100%;
}

// AI 加载动画
.ai-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $space-lg;
  background: var(--color-bg-input);
  border-radius: $radius-md;
}

.ai-loading-spinner {
  position: relative;
  width: 56rpx;
  height: 56rpx;
  margin-right: $space-md;
}

.spinner-dot {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 4rpx solid transparent;
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s $ease-default infinite;
}

.ai-loading-text {
  font-size: $font-size-base;
  color: var(--color-text-tertiary);
}

// AI 解析结果（与 .analysis-content 同风格）
.ai-result-area {
  // 结果容器
}

.ai-analysis-content {
  font-size: $font-size-md;
  color: var(--color-text-secondary);
  line-height: $line-height-relaxed;
  background: var(--color-bg-input);
  padding: $space-md;
  border-radius: $radius-md;
  white-space: pre-wrap;
  word-break: break-word;
}

// AI 错误提示
.ai-error {
  padding: $space-md;
  background: var(--color-error-bg);
  border-radius: $radius-md;
  border: 1rpx solid var(--color-error-border);
  text-align: center;
}

.ai-error-text {
  font-size: $font-size-sm;
  color: var(--color-error);
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: $space-md;
  padding: $space-lg;
  padding-bottom: calc($space-lg + env(safe-area-inset-bottom));
  background: var(--color-action-bar-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.02);
  z-index: 100;
}

.action-btn {
  flex: 1;
  height: 88rpx;
  box-sizing: border-box;
}

// 主操作按钮（确认答案/下一题/提交试卷）— 紫色外阴影
.action-btn:not(.action-btn-prev) {
  box-shadow: var(--shadow-btn-confirm);
}

// 恢复进度弹窗
.resume-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-mask);
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
  background: var(--color-bg-card);
  border-radius: $radius-3xl;
  padding: $space-3xl $space-2xl;
  animation: modalScaleIn $duration-slow $ease-bounce;
}

.resume-dialog-title {
  display: block;
  font-size: $font-size-2xl;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  text-align: center;
  margin-bottom: $space-xl;
}

.resume-dialog-body {
  background: var(--color-bg-input);
  border-radius: $radius-lg;
  padding: $space-lg;
  margin-bottom: $space-2xl;
}

.resume-progress-text {
  display: block;
  font-size: $font-size-md;
  color: var(--color-text-secondary);
  text-align: center;

  & + & {
    margin-top: $space-sm;
    font-size: $font-size-xs;
    color: var(--color-text-tertiary);
  }
}

.resume-warning {
  margin-top: $space-md;
  padding: 20rpx;
  background: var(--color-warning-bg);
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
  background: var(--color-bg-mask);
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
  background: var(--color-bg-card);
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
  color: var(--color-text-primary);
  margin-bottom: $space-2xl;
}

.score-info {
  margin-bottom: $space-2xl;
}

.score-value {
  display: block;
  font-size: $font-size-display;
  font-weight: $font-weight-bold;
  color: var(--color-primary);
}

.score-percent {
  display: block;
  font-size: $font-size-lg;
  color: var(--color-text-tertiary);
  margin-top: $space-sm;
}

.score-stats {
  background: var(--color-bg-input);
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
    border-top: 1rpx solid var(--color-border-base);
  }
}

.stat-label {
  font-size: $font-size-base;
  color: var(--color-text-secondary);
}

.stat-value {
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  
  &.correct {
    color: var(--color-success);
  }
  
  &.wrong {
    color: var(--color-error);
  }
}
</style>
