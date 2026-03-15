import { ipcMain, dialog, BrowserWindow } from 'electron'
import { PipelineAdapter } from '../adapters/pipeline-adapter'
import { StateAdapter } from '../adapters/state-adapter'
import { LLMAdapter, type LLMConfigUI } from '../adapters/llm-adapter'

const stateAdapter = new StateAdapter()
const pipelineAdapter = new PipelineAdapter()
const llmAdapter = new LLMAdapter()

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // ===== 项目管理 =====

  ipcMain.handle('select-project-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择 InkOS 项目目录'
    })
    if (result.canceled || !result.filePaths.length) return null
    const dirPath = result.filePaths[0]
    if (stateAdapter.isProjectDir(dirPath)) {
      stateAdapter.setProjectRoot(dirPath)
      return { path: dirPath, isProject: true }
    }
    return { path: dirPath, isProject: false }
  })

  ipcMain.handle('init-project', async (_e, dirPath: string, name: string) => {
    await stateAdapter.initProject(dirPath, name)
    return true
  })

  ipcMain.handle('load-project-info', async () => {
    return stateAdapter.loadProjectInfo()
  })

  ipcMain.handle('is-project-dir', (_e, dirPath: string) => {
    return stateAdapter.isProjectDir(dirPath)
  })

  // ===== LLM 配置 =====

  ipcMain.handle('load-llm-config', async () => {
    const config = await stateAdapter.loadProjectConfig()
    const env = await stateAdapter.loadEnvConfig()
    if (!config) return null
    const llm = (config.llm ?? {}) as Record<string, unknown>
    return {
      provider: (env.INKOS_LLM_PROVIDER ?? llm.provider ?? 'openai') as string,
      baseUrl: (env.INKOS_LLM_BASE_URL ?? llm.baseUrl ?? '') as string,
      apiKey: (env.INKOS_LLM_API_KEY ?? '') as string,
      model: (env.INKOS_LLM_MODEL ?? llm.model ?? '') as string,
      temperature: parseFloat(env.INKOS_LLM_TEMPERATURE ?? String(llm.temperature ?? '0.7')),
      maxTokens: parseInt(env.INKOS_LLM_MAX_TOKENS ?? String(llm.maxTokens ?? '8192'), 10)
    }
  })

  ipcMain.handle('save-llm-config', async (_e, config: LLMConfigUI) => {
    // 保存到 .env（密钥）和 inkos.json（非敏感配置）
    await stateAdapter.saveEnvConfig({
      INKOS_LLM_PROVIDER: config.provider,
      INKOS_LLM_BASE_URL: config.baseUrl,
      INKOS_LLM_API_KEY: config.apiKey,
      INKOS_LLM_MODEL: config.model,
      ...(config.temperature != null ? { INKOS_LLM_TEMPERATURE: String(config.temperature) } : {}),
      ...(config.maxTokens != null ? { INKOS_LLM_MAX_TOKENS: String(config.maxTokens) } : {})
    })
    const projectConfig = await stateAdapter.loadProjectConfig()
    if (projectConfig) {
      (projectConfig as Record<string, unknown>).llm = {
        provider: config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? 8192
      }
      await stateAdapter.saveProjectConfig(projectConfig)
    }
    return true
  })

  ipcMain.handle('test-llm-connection', async (_e, config: LLMConfigUI) => {
    return llmAdapter.testConnection(config)
  })

  ipcMain.handle('init-pipeline', async (_e, config: LLMConfigUI) => {
    const root = stateAdapter.getProjectRoot()
    if (!root) throw new Error('请先打开项目')
    const client = await llmAdapter.createClient(config)
    await pipelineAdapter.initialize(client, config.model, root)
    return true
  })

  // ===== 书籍管理 =====

  ipcMain.handle('list-books', async () => {
    return stateAdapter.listBooks()
  })

  ipcMain.handle('load-book-config', async (_e, bookId: string) => {
    return stateAdapter.loadBookConfig(bookId)
  })

  ipcMain.handle('get-book-status', async (_e, bookId: string) => {
    if (!pipelineAdapter.isInitialized()) throw new Error('管线未初始化')
    return pipelineAdapter.getBookStatus(bookId)
  })

  ipcMain.handle('create-book', async (_e, opts: {
    title: string; genre: string; platform: string;
    targetChapters: number; chapterWordCount: number; context?: string
  }) => {
    if (!pipelineAdapter.isInitialized()) throw new Error('请先配置LLM连接')
    const bookId = opts.title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30)
    const now = new Date().toISOString()
    await pipelineAdapter.initBook({
      id: bookId,
      title: opts.title,
      platform: opts.platform as 'tomato' | 'feilu' | 'qidian' | 'other',
      genre: opts.genre as 'xuanhuan' | 'xianxia' | 'urban' | 'horror' | 'other',
      status: 'outlining',
      targetChapters: opts.targetChapters,
      chapterWordCount: opts.chapterWordCount,
      createdAt: now,
      updatedAt: now
    })
    return { bookId }
  })

  // ===== 章节管理 =====

  ipcMain.handle('load-chapter-index', async (_e, bookId: string) => {
    return stateAdapter.loadChapterIndex(bookId)
  })

  ipcMain.handle('load-chapter-content', async (_e, bookId: string, filename: string) => {
    return stateAdapter.loadChapterContent(bookId, filename)
  })

  ipcMain.handle('update-chapter-status', async (_e, bookId: string, chapterNumber: number, status: string, note?: string) => {
    await stateAdapter.updateChapterStatus(bookId, chapterNumber, status, note)
    return true
  })

  // ===== 真相文件 =====

  ipcMain.handle('load-truth-file', async (_e, bookId: string, filename: string) => {
    return stateAdapter.loadTruthFile(bookId, filename)
  })

  ipcMain.handle('load-all-truth-files', async (_e, bookId: string) => {
    return stateAdapter.loadAllTruthFiles(bookId)
  })

  // ===== 写作管线 =====

  ipcMain.handle('write-next', async (_e, bookId: string, wordCount?: number) => {
    return pipelineAdapter.writeNext(bookId, wordCount)
  })

  ipcMain.handle('audit-chapter', async (_e, bookId: string, chapterNumber?: number) => {
    return pipelineAdapter.auditDraft(bookId, chapterNumber)
  })

  ipcMain.handle('revise-chapter', async (_e, bookId: string, chapterNumber?: number, mode?: string) => {
    return pipelineAdapter.reviseDraft(bookId, chapterNumber, mode as 'rewrite' | 'polish' | 'minimal')
  })

  // ===== 导出 =====

  ipcMain.handle('export-book', async (_e, bookId: string, format: 'txt' | 'md') => {
    const content = await stateAdapter.exportBook(bookId, format)
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出书籍',
      defaultPath: `${bookId}.${format}`,
      filters: [{ name: format === 'md' ? 'Markdown' : 'Text', extensions: [format] }]
    })
    if (result.canceled || !result.filePath) return null
    const { writeFile } = await import('fs/promises')
    await writeFile(result.filePath, content, 'utf-8')
    return result.filePath
  })

  // ===== 进度事件转发 =====
  pipelineAdapter.on('progress', (event) => {
    mainWindow.webContents.send('pipeline-progress', event)
  })
}
