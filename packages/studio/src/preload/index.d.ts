import { ElectronAPI } from '@electron-toolkit/preload'

interface BookSummary {
  bookId: string
  title: string
  genre: string
  platform: string
  chapterCount: number
  totalWords: number
  status: string
}

interface ChapterMeta {
  number: number
  title: string
  status: string
  wordCount: number
  createdAt: string
  updatedAt: string
  auditIssues: string[]
  reviewNote?: string
}

interface LLMConfig {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
}

interface ProjectInfo {
  name: string
  llm: { provider: string; baseUrl: string; model: string }
  bookCount: number
}

interface ProgressEvent {
  stage: string
  detail: string
  timestamp: number
}

interface InkOSAPI {
  // 项目管理
  selectProjectDir(): Promise<{ path: string; isProject: boolean } | null>
  initProject(dirPath: string, name: string): Promise<boolean>
  loadProjectInfo(): Promise<ProjectInfo | null>
  isProjectDir(dirPath: string): Promise<boolean>

  // LLM 配置
  loadLLMConfig(): Promise<LLMConfig | null>
  saveLLMConfig(config: LLMConfig): Promise<boolean>
  testLLMConnection(config: LLMConfig): Promise<{ ok: boolean; error?: string; latencyMs?: number }>
  initPipeline(config: LLMConfig): Promise<boolean>

  // 书籍管理
  listBooks(): Promise<BookSummary[]>
  loadBookConfig(bookId: string): Promise<unknown>
  getBookStatus(bookId: string): Promise<unknown>
  createBook(opts: {
    title: string; genre: string; platform: string;
    targetChapters: number; chapterWordCount: number; context?: string
  }): Promise<{ bookId: string }>

  // 章节管理
  loadChapterIndex(bookId: string): Promise<ChapterMeta[]>
  loadChapterContent(bookId: string, filename: string): Promise<string>
  updateChapterStatus(bookId: string, chapterNumber: number, status: string, note?: string): Promise<boolean>

  // 真相文件
  loadTruthFile(bookId: string, filename: string): Promise<string>
  loadAllTruthFiles(bookId: string): Promise<Record<string, string>>

  // 写作管线
  writeNext(bookId: string, wordCount?: number): Promise<unknown>
  auditChapter(bookId: string, chapterNumber?: number): Promise<unknown>
  reviseChapter(bookId: string, chapterNumber?: number, mode?: string): Promise<unknown>

  // 导出
  exportBook(bookId: string, format: 'txt' | 'md'): Promise<string | null>

  // 进度事件
  onProgress(callback: (event: ProgressEvent) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    inkos: InkOSAPI
  }
}
