import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const hintosAPI = {
  // 项目管理
  selectProjectDir: (): Promise<{ path: string; isProject: boolean } | null> =>
    ipcRenderer.invoke('select-project-dir'),
  initProject: (dirPath: string, name: string): Promise<boolean> =>
    ipcRenderer.invoke('init-project', dirPath, name),
  loadProjectInfo: () => ipcRenderer.invoke('load-project-info'),
  isProjectDir: (dirPath: string): Promise<boolean> =>
    ipcRenderer.invoke('is-project-dir', dirPath),
  getLastProject: (): Promise<string | null> =>
    ipcRenderer.invoke('get-last-project'),
  autoInitPipeline: (): Promise<{ ok: boolean; reason?: string }> =>
    ipcRenderer.invoke('auto-init-pipeline'),

  // LLM 配置
  loadLLMConfig: () => ipcRenderer.invoke('load-llm-config'),
  saveLLMConfig: (config: unknown): Promise<boolean> =>
    ipcRenderer.invoke('save-llm-config', config),
  testLLMConnection: (config: unknown): Promise<{ ok: boolean; error?: string; latencyMs?: number }> =>
    ipcRenderer.invoke('test-llm-connection', config),
  initPipeline: (config: unknown): Promise<boolean> =>
    ipcRenderer.invoke('init-pipeline', config),
  initPipelineRouting: (routing: unknown): Promise<boolean> =>
    ipcRenderer.invoke('init-pipeline-routing', routing),
  loadTaskRouting: (): Promise<unknown> =>
    ipcRenderer.invoke('load-task-routing'),
  saveTaskRouting: (routing: unknown): Promise<boolean> =>
    ipcRenderer.invoke('save-task-routing', routing),

  // 书籍管理
  listBooks: () => ipcRenderer.invoke('list-books'),
  loadBookConfig: (bookId: string) => ipcRenderer.invoke('load-book-config', bookId),
  getBookStatus: (bookId: string) => ipcRenderer.invoke('get-book-status', bookId),
  createBook: (opts: unknown): Promise<{ bookId: string }> =>
    ipcRenderer.invoke('create-book', opts),
  updateBookConfig: (bookId: string, updates: unknown): Promise<boolean> =>
    ipcRenderer.invoke('update-book-config', bookId, updates),
  deleteBook: (bookId: string): Promise<boolean> =>
    ipcRenderer.invoke('delete-book', bookId),
  selectStyleBookFiles: (): Promise<string[] | null> =>
    ipcRenderer.invoke('select-style-book-files'),

  // 章节管理
  loadChapterIndex: (bookId: string) => ipcRenderer.invoke('load-chapter-index', bookId),
  loadChapterContent: (bookId: string, filename: string): Promise<string> =>
    ipcRenderer.invoke('load-chapter-content', bookId, filename),
  resolveChapterFilename: (bookId: string, chapterNumber: number): Promise<string | null> =>
    ipcRenderer.invoke('resolve-chapter-filename', bookId, chapterNumber),
  updateChapterStatus: (bookId: string, chapterNumber: number, status: string, note?: string): Promise<boolean> =>
    ipcRenderer.invoke('update-chapter-status', bookId, chapterNumber, status, note),

  // 真相文件
  loadTruthFile: (bookId: string, filename: string): Promise<string> =>
    ipcRenderer.invoke('load-truth-file', bookId, filename),
  loadAllTruthFiles: (bookId: string): Promise<Record<string, string>> =>
    ipcRenderer.invoke('load-all-truth-files', bookId),

  // 写作管线
  writeNext: (bookId: string, wordCount?: number) =>
    ipcRenderer.invoke('write-next', bookId, wordCount),
  auditChapter: (bookId: string, chapterNumber?: number) =>
    ipcRenderer.invoke('audit-chapter', bookId, chapterNumber),
  reviseChapter: (bookId: string, chapterNumber?: number, mode?: string) =>
    ipcRenderer.invoke('revise-chapter', bookId, chapterNumber, mode),
  checkContinuityPlus: (bookId: string, chapterNumber?: number) =>
    ipcRenderer.invoke('check-continuity-plus', bookId, chapterNumber),
  polishChapter: (bookId: string, chapterNumber?: number) =>
    ipcRenderer.invoke('polish-chapter', bookId, chapterNumber),

  // 导出
  exportBook: (bookId: string, format: 'txt' | 'md'): Promise<string | null> =>
    ipcRenderer.invoke('export-book', bookId, format),
  exportEpub: (bookId: string, metadata: unknown, options: unknown): Promise<string | null> =>
    ipcRenderer.invoke('export-epub', bookId, metadata, options),
  saveCoverImage: (dataUrl: string): Promise<string | null> =>
    ipcRenderer.invoke('save-cover-image', dataUrl),
  resolveBookLanguage: (bookId: string): Promise<'zh' | 'en'> =>
    ipcRenderer.invoke('resolve-book-language', bookId),

  // 人性化引擎
  loadHumanizeSettings: (bookId: string) => ipcRenderer.invoke('load-humanize-settings', bookId),
  saveHumanizeSettings: (bookId: string, settings: unknown): Promise<boolean> =>
    ipcRenderer.invoke('save-humanize-settings', bookId, settings),
  loadVoiceCards: (bookId: string) => ipcRenderer.invoke('load-voice-cards', bookId),
  saveVoiceCards: (bookId: string, cards: unknown): Promise<boolean> =>
    ipcRenderer.invoke('save-voice-cards', bookId, cards),
  loadSceneBeats: (bookId: string, chapterNumber: number) =>
    ipcRenderer.invoke('load-scene-beats', bookId, chapterNumber),
  saveSceneBeats: (bookId: string, chapterNumber: number, beats: string[]): Promise<boolean> =>
    ipcRenderer.invoke('save-scene-beats', bookId, chapterNumber, beats),
  buildStyleGuidance: (bookId: string, chapterNumber?: number): Promise<string> =>
    ipcRenderer.invoke('build-style-guidance', bookId, chapterNumber),

  // 风格分析
  listStyleBooks: (bookId: string): Promise<string[]> =>
    ipcRenderer.invoke('list-style-books', bookId),

  // 热榜
  getTrendingPlatforms: (): Promise<{ id: string; name: string; lists: { type: string; label: string }[] }[]> =>
    ipcRenderer.invoke('trending-platforms'),
  fetchTrending: (platformId: string, listType: string, translate: boolean): Promise<unknown> =>
    ipcRenderer.invoke('fetch-trending', platformId, listType, translate),
  analyzeTrending: (novels: unknown[], language?: 'en' | 'zh'): Promise<string> =>
    ipcRenderer.invoke('analyze-trending', novels, language),

  // 创意库
  vaultSave: (entry: { novelCount: number; analysis: string; language?: 'en' | 'zh'; novels?: Array<{ rank: number; title: string; titleZh: string; tags: string; stats: string; platform: string; url: string }> }): Promise<{ id: string; createdAt: string }> =>
    ipcRenderer.invoke('vault-save', entry),
  vaultList: (): Promise<{ id: string; createdAt: string; novelCount: number; language: 'en' | 'zh'; preview: string }[]> =>
    ipcRenderer.invoke('vault-list'),
  vaultGet: (id: string): Promise<{ id: string; createdAt: string; novelCount: number; language: 'en' | 'zh'; analysis: string }> =>
    ipcRenderer.invoke('vault-get', id),
  vaultDelete: (id: string): Promise<void> =>
    ipcRenderer.invoke('vault-delete', id),
  vaultUpdate: (id: string, analysis: string): Promise<unknown> =>
    ipcRenderer.invoke('vault-update', id, analysis),
  vaultAllNovels: (lang?: 'en' | 'zh'): Promise<Array<{ rank: number; title: string; titleZh: string; tags: string; stats: string; platform: string; url: string }>> =>
    ipcRenderer.invoke('vault-all-novels', lang),
  importStyleBook: (bookId: string): Promise<string[] | null> =>
    ipcRenderer.invoke('import-style-book', bookId),
  removeStyleBook: (bookId: string, fileName: string): Promise<boolean> =>
    ipcRenderer.invoke('remove-style-book', bookId, fileName),
  analyzeStyleBooks: (bookId: string) => ipcRenderer.invoke('analyze-style-books', bookId),
  loadStyleProfile: (bookId: string) => ipcRenderer.invoke('load-style-profile', bookId),

  // 风格指纹
  loadFingerprint: (bookId: string) => ipcRenderer.invoke('load-fingerprint', bookId),
  saveFingerprint: (bookId: string, data: unknown): Promise<boolean> =>
    ipcRenderer.invoke('save-fingerprint', bookId, data),
  analyzeDeepFingerprint: (bookId: string) => ipcRenderer.invoke('analyze-deep-fingerprint', bookId),

  // AI建议
  generateSuggestions: (bookId: string) => ipcRenderer.invoke('generate-suggestions', bookId),
  loadSuggestions: (bookId: string) => ipcRenderer.invoke('load-suggestions', bookId),
  applySuggestions: (bookId: string): Promise<boolean> =>
    ipcRenderer.invoke('apply-suggestions', bookId),

  // 在线采样 (Book Inception Pipeline)
  scraperFetchChapters: (fictionUrl: string) =>
    ipcRenderer.invoke('scraper-fetch-chapters', fictionUrl),
  scraperScrapeForAnalysis: (bookId: string, fictionUrl: string, fictionTitle: string, maxSamples?: number) =>
    ipcRenderer.invoke('scraper-scrape-for-analysis', bookId, fictionUrl, fictionTitle, maxSamples ?? 15),

  // 同步 style_guide.md
  syncStyleGuide: (bookId: string): Promise<boolean> =>
    ipcRenderer.invoke('sync-style-guide', bookId),

  // AIGC检测
  analyzeAITells: (content: string, language?: 'zh' | 'en') => ipcRenderer.invoke('analyze-ai-tells', content, language),
  analyzeSensitiveWords: (content: string, customWords?: string[]) =>
    ipcRenderer.invoke('analyze-sensitive-words', content, customWords),
  detectChapter: (bookId: string, chapterNumber: number, chapterTitle: string, content: string) =>
    ipcRenderer.invoke('detect-chapter', bookId, chapterNumber, chapterTitle, content),
  loadDetectionHistory: (bookId: string) => ipcRenderer.invoke('load-detection-history', bookId),
  loadDetectionRecord: (bookId: string, chapterNumber: number) =>
    ipcRenderer.invoke('load-detection-record', bookId, chapterNumber),

  // 章节大纲规划
  planNext: (bookId: string): Promise<unknown> =>
    ipcRenderer.invoke('plan-next', bookId),
  planReplan: (bookId: string, chapter: number, feedback: string): Promise<unknown> =>
    ipcRenderer.invoke('plan-replan', bookId, chapter, feedback),
  planList: (bookId: string): Promise<unknown> =>
    ipcRenderer.invoke('plan-list', bookId),
  planGet: (bookId: string, chapter: number): Promise<string> =>
    ipcRenderer.invoke('plan-get', bookId, chapter),
  planApprove: (bookId: string, chapter: number): Promise<boolean> =>
    ipcRenderer.invoke('plan-approve', bookId, chapter),
  planReject: (bookId: string, chapter: number, feedback: string): Promise<boolean> =>
    ipcRenderer.invoke('plan-reject', bookId, chapter, feedback),
  planUpdate: (bookId: string, chapter: number, content: string): Promise<boolean> =>
    ipcRenderer.invoke('plan-update', bookId, chapter, content),
  planStats: (bookId: string): Promise<unknown> =>
    ipcRenderer.invoke('plan-stats', bookId),
  // 活动日志
  appendActivityLog: (type: string, message: string): Promise<void> =>
    ipcRenderer.invoke('append-activity-log', type, message),

  // 在默认浏览器打开链接
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('open-external', url),

  // 进度事件
  onProgress: (callback: (event: unknown) => void): (() => void) => {
    const listener = (_: unknown, event: unknown): void => { callback(event) }
    ipcRenderer.on('pipeline-progress', listener as never)
    return () => { ipcRenderer.removeListener('pipeline-progress', listener as never) }
  },

  // CyberFeed 事件
  onCyberFeed: (callback: (event: { source: string; level: string; message: string; detail?: string }) => void): (() => void) => {
    const listener = (_: unknown, event: { source: string; level: string; message: string; detail?: string }): void => { callback(event) }
    ipcRenderer.on('cyber-feed', listener as never)
    return () => { ipcRenderer.removeListener('cyber-feed', listener as never) }
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('hintos', hintosAPI)
} else {
  // @ts-expect-error fallback
  window.electron = electronAPI
  // @ts-expect-error fallback
  window.hintos = hintosAPI
}
