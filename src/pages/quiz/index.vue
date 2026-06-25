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
        <button 
          class="action-btn prev" 
          :disabled="quizStore.currentIndex === 0"
          @click="prevQuestion"
        >
          <text>上一题</text>
        </button>
        
        <button 
          v-if="!showResult" 
          class="action-btn confirm"
          @click="confirmAnswer"
        >
          <text>确认答案</text>
        </button>
        
        <button 
          v-else-if="quizStore.currentIndex < quizStore.totalQuestions() - 1" 
          class="action-btn next"
          @click="nextQuestion"
        >
          <text>下一题</text>
        </button>
        
        <button 
          v-else 
          class="action-btn submit"
          @click="submitQuiz"
        >
          <text>提交试卷</text>
        </button>
      </view>
    </view>

    <view v-if="isLoading" class="loading-state">
      <view class="loading-icon">⏳</view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-if="!isLoading && questions.length === 0" class="empty-state">
      <text class="empty-icon">📝</text>
      <text class="empty-title">{{ errorMsg || '暂无题目' }}</text>
      <text class="empty-desc">{{ errorMsg ? '请检查网络后重试' : '该题库暂无题目或暂无错题' }}</text>
      <button v-if="errorMsg" class="retry-btn" @click="retryLoad">重新加载</button>
    </view>

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
          <button class="resume-btn primary" @click="handleResume">
            <text>继续上次进度</text>
          </button>
          <button class="resume-btn secondary" @click="handleRestart">
            <text>重新开始</text>
          </button>
          <button class="resume-btn cancel" @click="handleCancelResume">
            <text>返回</text>
          </button>
        </view>
      </view>
    </view>

    <view v-if="showScore" class="score-modal" @click="closeScore">
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
        <button class="score-btn" @click="closeScore">
          <text>完成</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import QuestionCard from '@/components/QuestionCard.vue'
import { useQuizStore } from '@/stores/quiz'
import { useLibraryStore } from '@/stores/library'
import { useWrongStore } from '@/stores/wrong'
import { useUserStore } from '@/stores/user'
import { ensureCloudReady } from '@/utils/cloud'
import { getQuizProgress, clearQuizProgress } from '@/utils/storage'
import type { Question, QuizProgress } from '@/types'

const quizStore = useQuizStore()
const libraryStore = useLibraryStore()
const wrongStore = useWrongStore()
const userStore = useUserStore()

const isLoading = ref(true)
const showResult = ref(false)
const showScore = ref(false)
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
  const correctAnswer = currentQuestion.value.answer.sort()
  const userAnswer = currentAnswers.value.sort()
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
}

function confirmAnswer() {
  if (currentAnswers.value.length === 0) {
    uni.showToast({ title: '请选择答案', icon: 'none' })
    return
  }
  showResult.value = true

  // 实时错题收集：答错立即记录到错题本
  if (!isCorrect.value && currentQuestion.value && userStore.openid && libraryId.value) {
    wrongStore.addWrongQuestion(
      userStore.openid,
      currentQuestion.value._id || '',
      [...currentAnswers.value].sort()
    )
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

function closeScoreAndGoHome() {
  showScore.value = false
  uni.switchTab({ url: '/pages/index/index' })
}

async function loadQuizData() {
  isLoading.value = true
  errorMsg.value = ''

  try {
    // 等待云开发初始化完成，避免云 API 在初始化完成前调用导致失败
    await ensureCloudReady()

    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const options = (currentPage as any)?.options || {}

    mode.value = (options.mode as 'sequence' | 'random' | 'wrong') || 'sequence'
    // 解码 URL 参数，处理可能包含特殊字符的 libraryId
    libraryId.value = options.libraryId ? decodeURIComponent(options.libraryId) : ''
    targetQuestionId.value = options.questionId || ''

    // 检测是否有保存的进度（错题模式不支持恢复）
    if (mode.value !== 'wrong' && libraryId.value) {
      const saved = getQuizProgress(libraryId.value, mode.value)
      if (saved && saved.questions && saved.questions.length > 0) {
        savedProgressData.value = saved
        // 检测题库是否变更：比较保存的题目 ID 与当前题库
        showResumeDialog.value = true
        isLoading.value = false
        return
      }
    }

    // 无进度或错题模式 → 正常加载题目
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

/**
 * 加载题目数据（正常模式/错题模式）
 */
async function loadQuestionsForMode() {
  if (mode.value === 'wrong') {
    if (!userStore.openid) {
      await userStore.doLogin()
    }
    const wrongDetails = await wrongStore.getWrongQuestionDetails(userStore.openid!)
    const questions = wrongDetails.map(w => w.question)
    quizStore.initQuiz(questions, 'wrong')
    // 错题模式不保存进度
  } else if (libraryId.value) {
    const questions = await libraryStore.getQuestions(libraryId.value)
    if (questions.length === 0) {
      const lib = libraryStore.libraries.find(l => l._id === libraryId.value)
      if (lib && lib.totalQuestions > 0) {
        errorMsg.value = '题目加载失败'
      }
    }
    quizStore.initQuiz(questions, mode.value)
    // 新开始后立即保存初始进度（currentIndex=0, answers={}）
    if (questions.length > 0) {
      quizStore.saveProgress()
    }

    // 如有 targetQuestionId，跳转到指定题目
    if (targetQuestionId.value && quizStore.questions.length > 0) {
      const idx = quizStore.questions.findIndex(q => q._id === targetQuestionId.value)
      if (idx !== -1) quizStore.goToQuestion(idx)
    }
  } else {
    errorMsg.value = '题库参数缺失'
  }
}

/**
 * 用户选择"继续上次进度"
 */
function handleResume() {
  const saved = savedProgressData.value
  if (!saved) return

  // 直接从 store 恢复完整状态，不走 initQuiz（避免重置 answers 和覆盖进度）
  quizStore.loadProgress(libraryId.value, mode.value)
  showResumeDialog.value = false
  // 进度继续，不清除，下次还可以恢复
}

/**
 * 用户选择"重新开始"
 */
async function handleRestart() {
  showResumeDialog.value = false
  clearQuizProgress(libraryId.value, mode.value)
  isLoading.value = true
  await loadQuestionsForMode()
  isLoading.value = false
}

/**
 * 用户取消（点返回或遮罩），保留进度不清除
 */
function handleCancelResume() {
  showResumeDialog.value = false
  uni.navigateBack()
}

onMounted(() => {
  loadQuizData()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.quiz-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.progress-section {
  margin-bottom: 16px;
}

.progress-bar {
  height: 6px;
  background: #e8e8e8;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px;
  transition: width 0.3s;
}

.progress-text {
  display: block;
  text-align: right;
  font-size: 13px;
  color: #999;
  margin-top: 8px;
}

.question-scroll {
  flex: 1;
  height: 0;
}

.result-tip {
  margin: 16px 0;
  padding: 12px;
  border-radius: 12px;
  text-align: center;
}

.correct-tip {
  color: #52c41a;
  font-weight: 600;
}

.wrong-tip {
  color: #ff4d4f;
  font-weight: 600;
}

.action-bar {
  display: flex;
  gap: 12px;
  padding: 16px 0;
}

.action-btn {
  flex: 1;
  height: 52px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  border: none;
  
  &.prev {
    background: #f5f5f5;
    color: #666;
    
    &[disabled] {
      opacity: 0.4;
    }
  }
  
  &.confirm {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
  
  &.next {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
  
  &.submit {
    background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
    color: #fff;
  }
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loading-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.loading-text {
  font-size: 16px;
  color: #999;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  color: #999;
  margin-bottom: 16px;
}

.retry-btn {
  width: 140px;
  height: 44px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  border: none;
}

// 恢复进度弹窗
.resume-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.resume-dialog {
  width: 100%;
  max-width: 340px;
  background: #fff;
  border-radius: 24px;
  padding: 32px 24px;
}

.resume-dialog-title {
  display: block;
  font-size: 20px;
  font-weight: 600;
  color: #333;
  text-align: center;
  margin-bottom: 20px;
}

.resume-dialog-body {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.resume-progress-text {
  display: block;
  font-size: 15px;
  color: #555;
  text-align: center;

  & + & {
    margin-top: 8px;
    font-size: 13px;
    color: #999;
  }
}

.resume-warning {
  margin-top: 12px;
  padding: 10px;
  background: #fff7e6;
  border-radius: 8px;
  border-left: 3px solid #faad14;

  text {
    font-size: 13px;
    color: #d48806;
    line-height: 1.5;
  }
}

.resume-dialog-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.resume-btn {
  width: 100%;
  height: 48px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  border: none;

  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }

  &.secondary {
    background: #f5f5f5;
    color: #666;
  }

  &.cancel {
    background: #fff;
    color: #999;
    border: 1px solid #e8e8e8;
  }
}

.score-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.score-content {
  width: 100%;
  max-width: 320px;
  background: #fff;
  border-radius: 24px;
  padding: 40px 32px;
  text-align: center;
}

.score-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.score-title {
  display: block;
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin-bottom: 24px;
}

.score-info {
  margin-bottom: 24px;
}

.score-value {
  display: block;
  font-size: 48px;
  font-weight: 700;
  color: #667eea;
}

.score-percent {
  display: block;
  font-size: 16px;
  color: #999;
  margin-top: 8px;
}

.score-stats {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  & + & {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #eee;
  }
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  
  &.correct {
    color: #52c41a;
  }
  
  &.wrong {
    color: #ff4d4f;
  }
}

.score-btn {
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  border: none;
}
</style>