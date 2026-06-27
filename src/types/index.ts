export interface Question {
  _id?: string
  libraryId: string
  type: 'single' | 'multiple' | 'judge'
  content: string
  options: string[]
  answer: string[]
  analysis?: string
  difficulty: number
  createdAt?: Date
}

export interface Library {
  _id: string
  name: string
  description?: string
  totalQuestions: number
  createdAt: Date
  updatedAt: Date
}

export interface WrongQuestion {
  _id?: string
  questionId: string
  openid: string
  libraryId: string
  userAnswer: string[]
  wrongCount: number
  lastWrongTime: Date
}

export interface UserRecord {
  _id?: string
  openid: string
  questionId: string
  libraryId: string
  isCorrect: boolean
  answerTime: Date
  duration: number
}

export interface UserStats {
  _id: string
  totalQuestions: number
  correctCount: number
  todayQuestions: number
  todayCorrect: number
  updatedAt: Date
}

export interface QuizProgress {
  libraryId: string
  mode: 'sequence' | 'random' | 'wrong'
  questions: Question[]
  currentIndex: number
  answers: Record<string, string[]>
  startTime: number
}

export interface AIAnalysisCache {
  analysis: string
  generatedAt: number        // Date.now() 时间戳
  questionHash: string       // question.content + answer 的 hash，用于缓存失效检测
}

export interface UserState {
  openid: string | null
  isLoggedIn: boolean
}

export interface LibraryState {
  libraries: Library[]
  currentLibrary: Library | null
}

export interface QuizState {
  questions: Question[]
  currentIndex: number
  mode: 'sequence' | 'random' | 'wrong'
  answers: Record<string, string[]>
  startTime: number
  isFinished: boolean
}

export interface WrongState {
  wrongQuestions: WrongQuestion[]
}

export interface StatsState {
  totalQuestions: number
  correctCount: number
  todayQuestions: number
  todayCorrect: number
}

/** 自定义 AI Provider（客户端视图，不含 apiKey） */
export interface CustomProvider {
  id: string
  name: string
  apiUrl: string
  model: string
  hasApiKey?: boolean
}

/** 传给云函数的 Provider 配置（内置 or 自定义） */
export type ProviderConfig =
  | { id: string }                              // 内置模型：agnes / deepseek
  | { custom: { providerId: string; apiUrl: string; model: string } }  // 自定义模型（apiKey 由云函数从 DB 读取）