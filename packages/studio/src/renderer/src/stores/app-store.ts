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

export interface BookDraft {
  title: string
  genre: string
  platform: string
  targetChapters: number
  chapterWords: number
  context: string
  language: 'zh' | 'en'
}

// ===== 活动面板数据类型 =====

export interface ActivityEntry {
  id: string
  operation: string
  status: 'running' | 'done' | 'error'
  startedAt: number
  finishedAt?: number
  detail?: string
  progress?: number
  error?: string
}

export interface TokenEntry {
  timestamp: number
  operation: string
  inputTokens: number
  outputTokens: number
  model: string
}

export interface ErrorEntry {
  timestamp: number
  message: string
  operation?: string
}

export interface ToastItem {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  createdAt: number
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
  theme: string

  // 创意库 → 创建新书
  pendingBookDraft: BookDraft | null

  // 活动面板
  activities: ActivityEntry[]
  tokenLog: TokenEntry[]
  errorLog: ErrorEntry[]
  panelOpen: boolean
  panelMinimized: boolean
  toasts: ToastItem[]

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
  setTheme: (theme: string) => void
  setPendingBookDraft: (draft: BookDraft | null) => void

  // 活动面板 Actions
  startActivity: (operation: string) => string
  updateActivity: (id: string, detail: string, progress?: number) => void
  finishActivity: (id: string, error?: string) => void
  logTokenUsage: (entry: Omit<TokenEntry, 'timestamp'>) => void
  logError: (message: string, operation?: string) => void
  togglePanel: () => void
  minimizePanel: () => void
  restorePanel: () => void
  clearActivities: () => void
  addToast: (type: ToastItem['type'], message: string) => void
  removeToast: (id: string) => void
}

let _activitySeq = 0

export const useAppStore = create<AppState>((set, get) => ({
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
  theme: (typeof window !== 'undefined' && localStorage.getItem('HintOS-theme')) || 'twilight',
  pendingBookDraft: null,

  // 活动面板初始状态
  activities: [],
  tokenLog: [],
  errorLog: [],
  panelOpen: false,
  panelMinimized: true,
  toasts: [],

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
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setTheme: (theme) => {
    localStorage.setItem('HintOS-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  },
  setPendingBookDraft: (draft) => set({ pendingBookDraft: draft }),

  // 活动面板 Actions
  startActivity: (operation) => {
    const id = `act-${++_activitySeq}-${Date.now()}`
    const ts = new Date().toTimeString().slice(0, 8)
    set((s) => ({
      activities: [{ id, operation, status: 'running' as const, startedAt: Date.now() }, ...s.activities].slice(0, 50),
      panelOpen: true,
      panelMinimized: false
    }))
    window.hintos?.appendActivityLog?.('ACTIVITY', `[START] ${operation} (${ts})`)
    return id
  },
  updateActivity: (id, detail, progress) =>
    set((s) => ({
      activities: s.activities.map((a) =>
        a.id === id ? { ...a, detail, ...(progress !== undefined ? { progress } : {}) } : a
      )
    })),
  finishActivity: (id, error) => {
    set((s) => ({
      activities: s.activities.map((a) =>
        a.id === id ? { ...a, status: error ? 'error' : 'done', finishedAt: Date.now(), error } : a
      )
    }))
    const act = get().activities.find(a => a.id === id)
    if (act) {
      const elapsed = ((act.finishedAt ?? Date.now()) - act.startedAt)
      const dur = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`
      window.hintos?.appendActivityLog?.(
        error ? 'ERROR' : 'ACTIVITY',
        `[${error ? 'FAIL' : 'DONE'}] ${act.operation} (${dur})${error ? ' | ' + error : ''}`
      )
    }
  },
  logTokenUsage: (entry) => {
    set((s) => ({ tokenLog: [...s.tokenLog, { ...entry, timestamp: Date.now() }].slice(-200) }))
    window.hintos?.appendActivityLog?.('TOKEN', `${entry.operation} | model=${entry.model} in=${entry.inputTokens} out=${entry.outputTokens}`)
  },
  logError: (message, operation) => {
    set((s) => ({ errorLog: [...s.errorLog, { timestamp: Date.now(), message, operation }].slice(-100) }))
    window.hintos?.appendActivityLog?.('ERROR', `${operation ?? 'unknown'} | ${message}`)
  },
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen, panelMinimized: false })),
  minimizePanel: () => set({ panelMinimized: true }),
  restorePanel: () => set({ panelMinimized: false, panelOpen: true }),
  clearActivities: () => set({ activities: [], tokenLog: [], errorLog: [] }),
  addToast: (type, message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    set((s) => ({ toasts: [...s.toasts, { id, type, message, createdAt: Date.now() }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))
