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
