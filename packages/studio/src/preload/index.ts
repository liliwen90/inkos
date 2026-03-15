import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const inkosAPI = {
  // 项目管理
  selectProjectDir: (): Promise<{ path: string; isProject: boolean } | null> =>
    ipcRenderer.invoke('select-project-dir'),
  initProject: (dirPath: string, name: string): Promise<boolean> =>
    ipcRenderer.invoke('init-project', dirPath, name),
  loadProjectInfo: () => ipcRenderer.invoke('load-project-info'),
  isProjectDir: (dirPath: string): Promise<boolean> =>
    ipcRenderer.invoke('is-project-dir', dirPath),

  // LLM 配置
  loadLLMConfig: () => ipcRenderer.invoke('load-llm-config'),
  saveLLMConfig: (config: unknown): Promise<boolean> =>
    ipcRenderer.invoke('save-llm-config', config),
  testLLMConnection: (config: unknown): Promise<{ ok: boolean; error?: string; latencyMs?: number }> =>
    ipcRenderer.invoke('test-llm-connection', config),
  initPipeline: (config: unknown): Promise<boolean> =>
    ipcRenderer.invoke('init-pipeline', config),

  // 书籍管理
  listBooks: () => ipcRenderer.invoke('list-books'),
  loadBookConfig: (bookId: string) => ipcRenderer.invoke('load-book-config', bookId),
  getBookStatus: (bookId: string) => ipcRenderer.invoke('get-book-status', bookId),
  createBook: (opts: unknown): Promise<{ bookId: string }> =>
    ipcRenderer.invoke('create-book', opts),

  // 章节管理
  loadChapterIndex: (bookId: string) => ipcRenderer.invoke('load-chapter-index', bookId),
  loadChapterContent: (bookId: string, filename: string): Promise<string> =>
    ipcRenderer.invoke('load-chapter-content', bookId, filename),
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

  // 导出
  exportBook: (bookId: string, format: 'txt' | 'md'): Promise<string | null> =>
    ipcRenderer.invoke('export-book', bookId, format),

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

  // AIGC检测
  analyzeAITells: (content: string) => ipcRenderer.invoke('analyze-ai-tells', content),
  analyzeSensitiveWords: (content: string, customWords?: string[]) =>
    ipcRenderer.invoke('analyze-sensitive-words', content, customWords),
  detectChapter: (bookId: string, chapterNumber: number, chapterTitle: string, content: string) =>
    ipcRenderer.invoke('detect-chapter', bookId, chapterNumber, chapterTitle, content),
  loadDetectionHistory: (bookId: string) => ipcRenderer.invoke('load-detection-history', bookId),
  loadDetectionRecord: (bookId: string, chapterNumber: number) =>
    ipcRenderer.invoke('load-detection-record', bookId, chapterNumber),

  // 进度事件
  onProgress: (callback: (event: unknown) => void): (() => void) => {
    const listener = (_: unknown, event: unknown): void => { callback(event) }
    ipcRenderer.on('pipeline-progress', listener as never)
    return () => { ipcRenderer.removeListener('pipeline-progress', listener as never) }
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('inkos', inkosAPI)
} else {
  // @ts-expect-error fallback
  window.electron = electronAPI
  // @ts-expect-error fallback
  window.inkos = inkosAPI
}
