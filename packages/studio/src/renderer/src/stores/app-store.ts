import { create } from 'zustand'

// ===== 数据类型 =====

export interface BookSummary {
  bookId: string
  title: string
  genre: string
  platform: string
  chapterCount: number
  totalWords: number
  status: string
}

export interface ChapterMeta {
  number: number
  title: string
  status: string
  wordCount: number
  createdAt: string
  updatedAt: string
  auditIssues: string[]
  reviewNote?: string
}

export interface LLMConfig {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
}

export interface ProgressEvent {
  stage: string
  detail: string
  timestamp: number
}

// ===== Store =====

interface AppState {
  // 项目
  projectPath: string | null
  projectLoaded: boolean
  projectName: string

  // 书籍
  books: BookSummary[]
  currentBookId: string | null

  // LLM
  llmConfig: LLMConfig | null
  pipelineReady: boolean

  // 进度
  progressEvents: ProgressEvent[]
  isWriting: boolean

  // UI
  sidebarCollapsed: boolean

  // Actions
  setProjectPath: (path: string | null) => void
  setProjectLoaded: (loaded: boolean) => void
  setProjectName: (name: string) => void
  setBooks: (books: BookSummary[]) => void
  setCurrentBookId: (id: string | null) => void
  setLLMConfig: (config: LLMConfig | null) => void
  setPipelineReady: (ready: boolean) => void
  addProgressEvent: (event: ProgressEvent) => void
  clearProgress: () => void
  setIsWriting: (writing: boolean) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  projectPath: null,
  projectLoaded: false,
  projectName: '',
  books: [],
  currentBookId: null,
  llmConfig: null,
  pipelineReady: false,
  progressEvents: [],
  isWriting: false,
  sidebarCollapsed: false,

  setProjectPath: (path) => set({ projectPath: path }),
  setProjectLoaded: (loaded) => set({ projectLoaded: loaded }),
  setProjectName: (name) => set({ projectName: name }),
  setBooks: (books) => set({ books }),
  setCurrentBookId: (id) => set({ currentBookId: id }),
  setLLMConfig: (config) => set({ llmConfig: config }),
  setPipelineReady: (ready) => set({ pipelineReady: ready }),
  addProgressEvent: (event) =>
    set((s) => ({ progressEvents: [...s.progressEvents, event] })),
  clearProgress: () => set({ progressEvents: [] }),
  setIsWriting: (writing) => set({ isWriting: writing }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }))
}))
