export interface Question {
  _id?: string
  libraryId: string
  type: 'single' | 'multiple' | 'judge'
  content: string
  options?: string[]
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

export interface DailyStats {
  date: string
  totalQuestions: number
  correctCount: number
  duration: number
}

export interface LibraryMastery {
  libraryId: string
  libraryName: string
  totalQuestions: number
  correctCount: number
  accuracy: number
}

export interface QuizCountOption {
  label: string
  value: number
  isAll: boolean
}

export interface FilePickerOptions {
  extensions: string[]
  maxFileSize: number
}

export interface FilePickerResult {
  path: string
  name: string
  size: number
  content: string
}

export interface JSONQuestion {
  type: 'single' | 'multiple' | 'judge'
  question: string
  options?: string[]
  answer: string | string[]
  explanation?: string
}
