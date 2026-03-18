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
  tokenUsage?: {
    input: number
    output: number
    model: string
    operation: string
  }
}

interface HumanizeSettings {
  pov: 'first' | 'third-limited' | 'third-omniscient'
  tense: 'past' | 'present'
  creativity: number
  pacing: 'fast' | 'balanced' | 'slow'
  mood: 'neutral' | 'tense' | 'warm' | 'dark' | 'humorous' | 'epic'
  showDontTell: 'low' | 'medium' | 'high'
  dialogue: 'formal' | 'natural' | 'colloquial'
  density: 'sparse' | 'medium' | 'rich'
}

interface VoiceCard {
  name: string
  speech: string
  tone: string
  quirks: string
}

interface FingerprintData {
  fingerprint: string
  enabled: boolean
  strength: number
  analyzedBooks: string[]
  analyzedAt: string
}

interface StyleProfile {
  avgSentenceLength: number
  sentenceLengthStdDev: number
  avgParagraphLength: number
  paragraphLengthRange: { min: number; max: number }
  vocabularyDiversity: number
  topPatterns: string[]
  rhetoricalFeatures: string[]
  sourceName?: string
  analyzedAt?: string
}

interface AITellResult {
  paragraphUniformity: { score: number; detail: string }
  hedgeDensity: { score: number; detail: string }
  formulaicTransitions: { score: number; detail: string }
  listStructure: { score: number; detail: string }
  overallScore: number
  verdict: string
}

interface SensitiveWordResult {
  hits: Array<{ word: string; category: string; count: number; severity: string }>
  totalHits: number
  categories: Record<string, number>
}

interface DetectionRecord {
  chapterNumber: number
  chapterTitle: string
  detectedAt: string
  aiTells: AITellResult
  sensitiveWords: SensitiveWordResult
  overallRisk: 'low' | 'medium' | 'high'
}

interface AISuggestions {
  storyIdeas?: Array<{ title: string; content: string }>
  writerRole?: string
  writingRules?: string
  humanizeSettings?: HumanizeSettings & { reasons?: Record<string, string> }
  voiceCards?: VoiceCard[]
  sceneBeats?: Array<{ title: string; beats: string[] }>
  storyArc?: { phases: Array<{ name: string; chapters: string; goal: string }> }
  generatedAt?: string
  fromBooks?: string[]
  parseError?: boolean
  raw?: string
}

interface ScrapedChapterInfo {
  title: string
  url: string
  index: number
}

interface ScrapeResult {
  bookId: string
  fictionTitle: string
  platform: string
  chaptersTotal: number
  chaptersSampled: number
  savedPath: string
}

interface PlanEntry {
  chapter: number
  status: 'unplanned' | 'pending' | 'approved' | 'rejected' | 'written'
  version: number
  createdAt?: string
  approvedAt?: string
  rejectedAt?: string
  writtenAt?: string
  feedback?: string
}

interface PlanIndex {
  plans: PlanEntry[]
}

interface PlanStats {
  total: number
  unplanned: number
  pending: number
  approved: number
  rejected: number
  written: number
}

interface OperationLogEntry {
  ts: string
  type: string
  [key: string]: unknown
}

interface HintOSAPI {
  // 项目管理
  selectProjectDir(): Promise<{ path: string; isProject: boolean } | null>
  initProject(dirPath: string, name: string): Promise<boolean>
  loadProjectInfo(): Promise<ProjectInfo | null>
  isProjectDir(dirPath: string): Promise<boolean>
  getLastProject(): Promise<string | null>
  autoInitPipeline(): Promise<{ ok: boolean; reason?: string }>

  // LLM 配置
  loadLLMConfig(): Promise<LLMConfig | null>
  saveLLMConfig(config: LLMConfig): Promise<boolean>
  testLLMConnection(config: LLMConfig): Promise<{ ok: boolean; error?: string; latencyMs?: number }>
  initPipeline(config: LLMConfig): Promise<boolean>
  initPipelineRouting(routing: unknown): Promise<boolean>
  loadTaskRouting(): Promise<unknown>
  saveTaskRouting(routing: unknown): Promise<boolean>

  // 书籍管理
  listBooks(): Promise<BookSummary[]>
  loadBookConfig(bookId: string): Promise<unknown>
  getBookStatus(bookId: string): Promise<unknown>
  createBook(opts: {
    title: string; genre: string; platform: string;
    targetChapters: number; chapterWordCount: number;
    context?: string; styleBookPaths?: string[]
  }): Promise<{ bookId: string }>
  updateBookConfig(bookId: string, updates: Record<string, unknown>): Promise<boolean>
  deleteBook(bookId: string): Promise<boolean>
  selectStyleBookFiles(): Promise<string[] | null>

  // 章节管理
  loadChapterIndex(bookId: string): Promise<ChapterMeta[]>
  loadChapterContent(bookId: string, filename: string): Promise<string>
  resolveChapterFilename(bookId: string, chapterNumber: number): Promise<string | null>
  updateChapterStatus(bookId: string, chapterNumber: number, status: string, note?: string): Promise<boolean>

  // 真相文件
  loadTruthFile(bookId: string, filename: string): Promise<string>
  loadAllTruthFiles(bookId: string): Promise<Record<string, string>>

  // 写作管线
  writeNext(bookId: string, wordCount?: number): Promise<unknown>
  auditChapter(bookId: string, chapterNumber?: number): Promise<unknown>
  reviseChapter(bookId: string, chapterNumber?: number, mode?: string): Promise<unknown>
  checkContinuityPlus(bookId: string, chapterNumber?: number): Promise<unknown>
  polishChapter(bookId: string, chapterNumber?: number): Promise<unknown>

  // 章节大纲规划
  planNext(bookId: string): Promise<PlanEntry>
  planReplan(bookId: string, chapter: number, feedback: string): Promise<PlanEntry>
  planList(bookId: string): Promise<PlanIndex>
  planGet(bookId: string, chapter: number): Promise<string>
  planApprove(bookId: string, chapter: number): Promise<boolean>
  planReject(bookId: string, chapter: number, feedback: string): Promise<boolean>
  planUpdate(bookId: string, chapter: number, content: string): Promise<boolean>
  planStats(bookId: string): Promise<PlanStats>
  readOperationLog(bookId: string, limit?: number): Promise<OperationLogEntry[]>

  // 导出
  exportBook(bookId: string, format: 'txt' | 'md'): Promise<string | null>
  exportEpub(bookId: string, metadata: {
    title?: string
    author: string
    language?: 'zh' | 'en'
    description?: string
    keywords?: string[]
    coverImageBase64?: string
  }, options: {
    includeToC: boolean
    includeTitlePage: boolean
    includeCopyrightPage: boolean
    chapterHeadingStyle: 'chapter-number' | 'title-only' | 'full'
  }): Promise<string | null>
  saveCoverImage(dataUrl: string): Promise<string | null>
  resolveBookLanguage(bookId: string): Promise<'zh' | 'en'>

  // 人性化引擎
  loadHumanizeSettings(bookId: string): Promise<HumanizeSettings>
  saveHumanizeSettings(bookId: string, settings: HumanizeSettings): Promise<boolean>
  loadVoiceCards(bookId: string): Promise<VoiceCard[]>
  saveVoiceCards(bookId: string, cards: VoiceCard[]): Promise<boolean>
  loadSceneBeats(bookId: string, chapterNumber: number): Promise<string[] | null>
  saveSceneBeats(bookId: string, chapterNumber: number, beats: string[]): Promise<boolean>
  buildStyleGuidance(bookId: string, chapterNumber?: number): Promise<string>

  // 风格分析
  listStyleBooks(bookId: string): Promise<string[]>

  // 热榜
  getTrendingPlatforms(): Promise<{ id: string; name: string; lists: { type: string; label: string }[] }[]>
  fetchTrending(platformId: string, listType: string, translate: boolean): Promise<{
    platform: string
    listType: string
    novels: {
      rank: number
      title: string
      titleZh: string
      tags: string
      stats: string
      platform: string
      url: string
    }[]
    fetchedAt: string
  }>
  analyzeTrending(novels: {
    rank: number
    title: string
    titleZh: string
    tags: string
    stats: string
    platform: string
    url: string
  }[]): Promise<string>

  // 创意库
  vaultSave(entry: { novelCount: number; analysis: string; language?: 'en' | 'zh'; novels?: Array<{ rank: number; title: string; titleZh: string; tags: string; stats: string; platform: string; url: string }> }): Promise<{ id: string; createdAt: string }>
  vaultList(): Promise<{ id: string; createdAt: string; novelCount: number; preview: string }[]>
  vaultGet(id: string): Promise<{ id: string; createdAt: string; novelCount: number; analysis: string }>
  vaultDelete(id: string): Promise<void>
  vaultUpdate(id: string, analysis: string): Promise<{ id: string; createdAt: string; novelCount: number; analysis: string }>
  importStyleBook(bookId: string): Promise<string[] | null>
  removeStyleBook(bookId: string, fileName: string): Promise<boolean>
  analyzeStyleBooks(bookId: string): Promise<StyleProfile | null>
  loadStyleProfile(bookId: string): Promise<StyleProfile | null>

  // 风格指纹
  loadFingerprint(bookId: string): Promise<FingerprintData | null>
  saveFingerprint(bookId: string, data: FingerprintData): Promise<boolean>
  analyzeDeepFingerprint(bookId: string): Promise<FingerprintData>

  // AI建议
  generateSuggestions(bookId: string): Promise<AISuggestions>
  loadSuggestions(bookId: string): Promise<AISuggestions | null>
  applySuggestions(bookId: string): Promise<boolean>

  // 在线采样 (Book Inception Pipeline)
  scraperFetchChapters(fictionUrl: string): Promise<ScrapedChapterInfo[]>
  scraperScrapeForAnalysis(bookId: string, fictionUrl: string, fictionTitle: string, maxSamples?: number): Promise<ScrapeResult>

  // 同步 style_guide.md
  syncStyleGuide(bookId: string): Promise<boolean>

  // AIGC检测
  analyzeAITells(content: string, language?: 'zh' | 'en'): Promise<AITellResult>
  analyzeSensitiveWords(content: string, customWords?: string[]): Promise<SensitiveWordResult>
  detectChapter(bookId: string, chapterNumber: number, chapterTitle: string, content: string): Promise<DetectionRecord>
  loadDetectionHistory(bookId: string): Promise<DetectionRecord[]>
  loadDetectionRecord(bookId: string, chapterNumber: number): Promise<DetectionRecord | null>

  // 活动日志
  appendActivityLog(type: string, message: string): Promise<void>
  openExternal(url: string): Promise<void>

  // 进度事件
  onProgress(callback: (event: ProgressEvent) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    hintos: HintOSAPI
  }
}
