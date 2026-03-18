import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync, mkdirSync } from 'fs'
import { PipelineAdapter } from '../adapters/pipeline-adapter'
import { StateAdapter } from '../adapters/state-adapter'
import { LLMAdapter, type LLMConfigUI, type TaskRoutingConfig } from '../adapters/llm-adapter'
import { HumanizeAdapter } from '../adapters/humanize-adapter'
import { DetectionAdapter } from '../adapters/detection-adapter'
import { TrendingAdapter } from '../adapters/trending-adapter'
import { ScraperAdapter } from '../adapters/scraper-adapter'

const stateAdapter = new StateAdapter()
const pipelineAdapter = new PipelineAdapter()
const llmAdapter = new LLMAdapter()
const humanizeAdapter = new HumanizeAdapter()
const detectionAdapter = new DetectionAdapter()
const trendingAdapter = new TrendingAdapter()
const scraperAdapter = new ScraperAdapter()

/** 持久化应用设置的简单 JSON 文件 */
function getAppSettingsPath(): string {
  return join(app.getPath('userData'), 'app-settings.json')
}
function loadAppSettings(): Record<string, unknown> {
  try {
    const p = getAppSettingsPath()
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8'))
  } catch { /* ignore */ }
  return {}
}
function saveAppSettings(data: Record<string, unknown>): void {
  try { writeFileSync(getAppSettingsPath(), JSON.stringify(data, null, 2), 'utf-8') } catch { /* ignore */ }
}

/**
 * 查找 Core 内置题材目录。
 * 因 electron-vite 打包后 import.meta.url 路径偏移，需主动探测。
 */
function findCoreGenresDir(): string | null {
  const candidates = [
    // Production: extraResources (优先)
    join(process.resourcesPath ?? '', 'genres'),
    // Dev: studio 同级的 core/genres
    join(app.getAppPath(), '..', 'core', 'genres'),
    // Dev: 可能在 workspace 根
    join(app.getAppPath(), 'packages', 'core', 'genres'),
    // Dev: cwd 是 workspace 根
    join(process.cwd(), 'packages', 'core', 'genres'),
    // __dirname 在打包后指向 out/main, 向上回溯到 workspace
    join(__dirname, '..', '..', '..', '..', 'packages', 'core', 'genres'),
    // Dev: monorepo 根
    join(__dirname, '..', '..', '..', '..', '..', '..', 'packages', 'core', 'genres'),
  ]
  for (const p of candidates) {
    if (existsSync(join(p, 'other.md'))) return p
  }
  return null
}

/**
 * 确保项目目录下有题材文件，Core 会优先读取 {projectRoot}/genres/
 */
function ensureProjectGenres(projectRoot: string): void {
  const coreDir = findCoreGenresDir()
  if (!coreDir) return
  const destDir = join(projectRoot, 'genres')
  mkdirSync(destDir, { recursive: true })
  const files = readdirSync(coreDir).filter(f => f.endsWith('.md'))
  for (const file of files) {
    const dest = join(destDir, file)
    if (!existsSync(dest)) {
      copyFileSync(join(coreDir, file), dest)
    }
  }
}

/**
 * Sync humanize engine guidance → story/style_guide.md
 * This is the critical "last mile" that connects the humanize engine to the
 * Writer / Auditor / Reviser agents.
 */
async function syncStyleGuide(bookId: string): Promise<void> {
  const guidance = await humanizeAdapter.buildStyleGuidance(bookId)
  if (!guidance || guidance.trim().length < 10) return
  const root = stateAdapter.getProjectRoot()
  if (!root) return
  const storyDir = join(root, 'books', bookId, 'story')
  mkdirSync(storyDir, { recursive: true })
  writeFileSync(join(storyDir, 'style_guide.md'), guidance, 'utf-8')
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // ===== 项目管理 =====

  ipcMain.handle('select-project-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择 HintOS 项目目录'
    })
    if (result.canceled || !result.filePaths.length) return null
    const dirPath = result.filePaths[0]
    if (stateAdapter.isProjectDir(dirPath)) {
      stateAdapter.setProjectRoot(dirPath)
      humanizeAdapter.setProjectRoot(dirPath)
      detectionAdapter.setProjectRoot(dirPath)
      scraperAdapter.setProjectRoot(dirPath)
      ensureProjectGenres(dirPath)
      // 记住上次打开的项目
      const settings = loadAppSettings()
      settings.lastProjectPath = dirPath
      saveAppSettings(settings)
      return { path: dirPath, isProject: true }
    }
    return { path: dirPath, isProject: false }
  })

  ipcMain.handle('init-project', async (_e, dirPath: string, name: string) => {
    await stateAdapter.initProject(dirPath, name)
    humanizeAdapter.setProjectRoot(dirPath)
    detectionAdapter.setProjectRoot(dirPath)
    scraperAdapter.setProjectRoot(dirPath)
    ensureProjectGenres(dirPath)
    const settings = loadAppSettings()
    settings.lastProjectPath = dirPath
    saveAppSettings(settings)
    return true
  })

  ipcMain.handle('load-project-info', async () => {
    return stateAdapter.loadProjectInfo()
  })

  ipcMain.handle('is-project-dir', (_e, dirPath: string) => {
    return stateAdapter.isProjectDir(dirPath)
  })

  // 获取上次打开的项目路径
  ipcMain.handle('get-last-project', () => {
    const settings = loadAppSettings()
    const p = settings.lastProjectPath as string | undefined
    if (p && stateAdapter.isProjectDir(p)) {
      stateAdapter.setProjectRoot(p)
      humanizeAdapter.setProjectRoot(p)
      detectionAdapter.setProjectRoot(p)
      scraperAdapter.setProjectRoot(p)
      ensureProjectGenres(p)
      return p
    }
    return null
  })

  // 自动初始化管线（加载已保存的配置并初始化）
  ipcMain.handle('auto-init-pipeline', async () => {
    const root = stateAdapter.getProjectRoot()
    if (!root) return { ok: false, reason: 'no-project' }
    try {
      // 读取 LLM 配置
      const config = await stateAdapter.loadProjectConfig()
      const env = await stateAdapter.loadEnvConfig()
      if (!config || !env.HINTOS_LLM_API_KEY) return { ok: false, reason: 'no-config' }
      const llm = (config.llm ?? {}) as Record<string, unknown>
      const llmConfig: LLMConfigUI = {
        provider: (env.HINTOS_LLM_PROVIDER || llm.provider as string || 'openai') as LLMConfigUI['provider'],
        baseUrl: env.HINTOS_LLM_BASE_URL || llm.baseUrl as string || 'https://api.openai.com/v1',
        apiKey: env.HINTOS_LLM_API_KEY,
        model: env.HINTOS_LLM_MODEL || llm.model as string || 'gpt-4o',
        temperature: Number(env.HINTOS_LLM_TEMPERATURE || llm.temperature) || 0.7,
        maxTokens: Number(env.HINTOS_LLM_MAX_TOKENS || llm.maxTokens) || 8192
      }
      // 检查是否有任务路由配置
      const routing = await stateAdapter.loadTaskRouting()
      if (routing && typeof routing === 'object' && (routing as Record<string, unknown>).agents) {
        const r = routing as TaskRoutingConfig
        r.default = llmConfig
        const { client, modelOverrides } = await llmAdapter.createRoutingClient(r)
        await pipelineAdapter.initialize(client, llmConfig.model, root, modelOverrides)
      } else {
        const client = await llmAdapter.createClient(llmConfig)
        await pipelineAdapter.initialize(client, llmConfig.model, root)
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: (err as Error).message }
    }
  })

  // ===== LLM 配置 =====

  ipcMain.handle('load-llm-config', async () => {
    const config = await stateAdapter.loadProjectConfig()
    const env = await stateAdapter.loadEnvConfig()
    if (!config) return null
    const llm = (config.llm ?? {}) as Record<string, unknown>
    return {
      provider: (env.HINTOS_LLM_PROVIDER ?? llm.provider ?? 'openai') as string,
      baseUrl: (env.HINTOS_LLM_BASE_URL ?? llm.baseUrl ?? '') as string,
      apiKey: (env.HINTOS_LLM_API_KEY ?? '') as string,
      model: (env.HINTOS_LLM_MODEL ?? llm.model ?? '') as string,
      temperature: parseFloat(env.HINTOS_LLM_TEMPERATURE ?? String(llm.temperature ?? '0.7')),
      maxTokens: parseInt(env.HINTOS_LLM_MAX_TOKENS ?? String(llm.maxTokens ?? '8192'), 10)
    }
  })

  ipcMain.handle('save-llm-config', async (_e, config: LLMConfigUI) => {
    // 保存到 .env（密钥）和 hintos.json（非敏感配置）
    await stateAdapter.saveEnvConfig({
      HINTOS_LLM_PROVIDER: config.provider,
      HINTOS_LLM_BASE_URL: config.baseUrl,
      HINTOS_LLM_API_KEY: config.apiKey,
      HINTOS_LLM_MODEL: config.model,
      ...(config.temperature != null ? { HINTOS_LLM_TEMPERATURE: String(config.temperature) } : {}),
      ...(config.maxTokens != null ? { HINTOS_LLM_MAX_TOKENS: String(config.maxTokens) } : {})
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

  // 多模型路由初始化
  ipcMain.handle('init-pipeline-routing', async (_e, routing: TaskRoutingConfig) => {
    const root = stateAdapter.getProjectRoot()
    if (!root) throw new Error('请先打开项目')
    const { client, modelOverrides } = await llmAdapter.createRoutingClient(routing)
    await pipelineAdapter.initialize(client, routing.default.model, root, modelOverrides)
    return true
  })

  // 任务路由配置存储
  ipcMain.handle('load-task-routing', async () => {
    return stateAdapter.loadTaskRouting()
  })

  ipcMain.handle('save-task-routing', async (_e, routing: TaskRoutingConfig) => {
    await stateAdapter.saveTaskRouting(routing)
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
    targetChapters: number; chapterWordCount: number;
    context?: string; styleBookPaths?: string[]
  }) => {
    if (!pipelineAdapter.isInitialized()) throw new Error('请先配置LLM连接')
    // 确保题材文件可用（electron-vite 打包后 Core 内置路径偏移）
    const projectRoot = stateAdapter.getProjectRoot()
    if (projectRoot) ensureProjectGenres(projectRoot)
    const bookId = opts.title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30)
    const now = new Date().toISOString()

    // 构建创作上下文：用户指导 + 风格参考书样本
    let combinedContext = opts.context?.trim() || ''
    if (opts.styleBookPaths?.length) {
      let styleSamples = '\n\n## 风格参考\n以下是用户提供的风格参考书样本，请在生成世界观设定、本书规则和叙事风格时参考这些文本的写作风格特征（句式节奏、用词偏好、叙事距离、对话风格等）：\n'
      for (const fp of opts.styleBookPaths) {
        try {
          const content = readFileSync(fp, 'utf-8')
          const len = content.length
          const name = fp.split(/[\\/]/).pop()?.replace('.txt', '') || '未知'
          const sampleLen = Math.min(2000, Math.floor(len / 3))
          styleSamples += `\n--- 来自《${name}》---\n`
          if (len < 3000) {
            styleSamples += content + '\n'
          } else {
            styleSamples += `【开头】\n${content.substring(0, sampleLen)}\n`
            styleSamples += `【中间】\n${content.substring(Math.floor(len / 2) - sampleLen / 2, Math.floor(len / 2) + sampleLen / 2)}\n`
            styleSamples += `【结尾】\n${content.substring(len - sampleLen)}\n`
          }
        } catch { /* 跳过无法读取的文件 */ }
      }
      combinedContext += styleSamples
    }

    // 先复制参考书到书籍目录（initBook 失败时保留参考书供重试）
    if (opts.styleBookPaths?.length && projectRoot) {
      const styleDir = join(projectRoot, 'books', bookId, 'humanize', 'style-books')
      mkdirSync(styleDir, { recursive: true })
      for (const fp of opts.styleBookPaths) {
        try {
          const name = fp.split(/[\\/]/).pop() || 'unknown.txt'
          copyFileSync(fp, join(styleDir, name))
        } catch { /* skip */ }
      }
    }

    // 检查重复 bookId
    const existingBooks = await stateAdapter.listBooks()
    if (existingBooks.some(b => b.bookId === bookId)) {
      throw new Error(`书籍ID "${bookId}" 已存在，请使用不同的书名`)
    }

    await pipelineAdapter.initBook({
      id: bookId,
      title: opts.title,
      platform: opts.platform,
      genre: opts.genre,
      status: 'outlining',
      targetChapters: opts.targetChapters,
      chapterWordCount: opts.chapterWordCount,
      createdAt: now,
      updatedAt: now
    }, combinedContext || undefined)

    return { bookId }
  })

  ipcMain.handle('delete-book', async (_e, bookId: string) => {
    await stateAdapter.deleteBook(bookId)
    return true
  })

  ipcMain.handle('select-style-book-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择风格参考书',
      filters: [{ name: '文本文件', extensions: ['txt'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths
  })

  ipcMain.handle('update-book-config', async (_e, bookId: string, updates: {
    title?: string; genre?: string; platform?: string;
    targetChapters?: number; chapterWordCount?: number; status?: string
  }) => {
    const config = await stateAdapter.loadBookConfig(bookId)
    if (!config) throw new Error(`书籍 ${bookId} 不存在`)
    const merged = { ...config, ...updates, updatedAt: new Date().toISOString() }
    merged.id = config.id
    await stateAdapter.saveBookConfig(bookId, merged)
    return true
  })

  // ===== 章节管理 =====

  ipcMain.handle('load-chapter-index', async (_e, bookId: string) => {
    return stateAdapter.loadChapterIndex(bookId)
  })

  ipcMain.handle('load-chapter-content', async (_e, bookId: string, filename: string) => {
    return stateAdapter.loadChapterContent(bookId, filename)
  })

  ipcMain.handle('resolve-chapter-filename', async (_e, bookId: string, chapterNumber: number) => {
    return stateAdapter.resolveChapterFilename(bookId, chapterNumber)
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

  ipcMain.handle('check-continuity-plus', async (_e, bookId: string, chapterNumber?: number) => {
    return pipelineAdapter.checkContinuityPlus(bookId, chapterNumber)
  })

  ipcMain.handle('polish-chapter', async (_e, bookId: string, chapterNumber?: number) => {
    return pipelineAdapter.polishDraft(bookId, chapterNumber)
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

  ipcMain.handle('export-epub', async (_e, bookId: string, metadata: unknown, options: unknown) => {
    const buf = await stateAdapter.exportBookEpub(
      bookId,
      metadata as Parameters<typeof stateAdapter.exportBookEpub>[1],
      options as Parameters<typeof stateAdapter.exportBookEpub>[2]
    )
    const config = await stateAdapter.loadBookConfig(bookId)
    const defaultName = (config?.title ?? bookId).replace(/[<>:"/\\|?*]/g, '_')
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出 EPUB',
      defaultPath: `${defaultName}.epub`,
      filters: [{ name: 'EPUB', extensions: ['epub'] }]
    })
    if (result.canceled || !result.filePath) return null
    const { writeFile } = await import('fs/promises')
    await writeFile(result.filePath, buf)
    return result.filePath
  })

  ipcMain.handle('save-cover-image', async (_e, dataUrl: string) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存封面',
      defaultPath: 'cover.png',
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    })
    if (result.canceled || !result.filePath) return null
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
    const { writeFile } = await import('fs/promises')
    await writeFile(result.filePath, Buffer.from(base64, 'base64'))
    return result.filePath
  })

  ipcMain.handle('resolve-book-language', async (_e, bookId: string) => {
    return stateAdapter.resolveLanguage(bookId)
  })

  // ===== Phase 3: 人性化引擎 =====

  ipcMain.handle('load-humanize-settings', async (_e, bookId: string) => {
    return humanizeAdapter.loadSettings(bookId)
  })

  ipcMain.handle('save-humanize-settings', async (_e, bookId: string, settings: unknown) => {
    await humanizeAdapter.saveSettings(bookId, settings as never)
    // Auto-sync style_guide.md so Writer/Auditor/Reviser pick up humanize settings
    try { await syncStyleGuide(bookId) } catch { /* non-critical */ }
    return true
  })

  ipcMain.handle('load-voice-cards', async (_e, bookId: string) => {
    return humanizeAdapter.loadVoiceCards(bookId)
  })

  ipcMain.handle('save-voice-cards', async (_e, bookId: string, cards: unknown) => {
    await humanizeAdapter.saveVoiceCards(bookId, cards as never)
    try { await syncStyleGuide(bookId) } catch { /* non-critical */ }
    return true
  })

  ipcMain.handle('load-scene-beats', async (_e, bookId: string, chapterNumber: number) => {
    return humanizeAdapter.loadSceneBeats(bookId, chapterNumber)
  })

  ipcMain.handle('save-scene-beats', async (_e, bookId: string, chapterNumber: number, beats: string[]) => {
    await humanizeAdapter.saveSceneBeats(bookId, chapterNumber, beats)
    try { await syncStyleGuide(bookId) } catch { /* non-critical */ }
    return true
  })

  ipcMain.handle('build-style-guidance', async (_e, bookId: string, chapterNumber?: number) => {
    return humanizeAdapter.buildStyleGuidance(bookId, chapterNumber)
  })

  // ===== Phase 3: 风格分析 =====

  ipcMain.handle('list-style-books', async (_e, bookId: string) => {
    return humanizeAdapter.listStyleBooks(bookId)
  })

  ipcMain.handle('import-style-book', async (_e, bookId: string) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入风格参考书',
      filters: [{ name: '文本文件', extensions: ['txt'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || !result.filePaths.length) return null
    const names: string[] = []
    for (const fp of result.filePaths) {
      names.push(await humanizeAdapter.addStyleBook(bookId, fp))
    }
    return names
  })

  ipcMain.handle('remove-style-book', async (_e, bookId: string, fileName: string) => {
    await humanizeAdapter.removeStyleBook(bookId, fileName)
    return true
  })

  ipcMain.handle('analyze-style-books', async (_e, bookId: string) => {
    return humanizeAdapter.analyzeStyleFromBooks(bookId)
  })

  ipcMain.handle('load-style-profile', async (_e, bookId: string) => {
    return humanizeAdapter.loadStyleProfile(bookId)
  })

  // ===== Phase 3: 风格指纹 =====

  ipcMain.handle('load-fingerprint', async (_e, bookId: string) => {
    return humanizeAdapter.loadFingerprint(bookId)
  })

  ipcMain.handle('save-fingerprint', async (_e, bookId: string, data: unknown) => {
    await humanizeAdapter.saveFingerprint(bookId, data as never)
    try { await syncStyleGuide(bookId) } catch { /* non-critical */ }
    return true
  })

  ipcMain.handle('analyze-deep-fingerprint', async (_e, bookId: string) => {
    const client = llmAdapter.getClient()
    const config = llmAdapter.getConfig()
    if (!client || !config) throw new Error('请先配置LLM连接')
    return humanizeAdapter.analyzeDeepFingerprint(bookId, client, config.model, (msg, pct) => {
      mainWindow.webContents.send('pipeline-progress', { stage: msg, detail: `${pct}%`, timestamp: Date.now() })
    })
  })

  // ===== Phase 3: AI建议 =====

  ipcMain.handle('generate-suggestions', async (_e, bookId: string) => {
    const client = llmAdapter.getClient()
    const config = llmAdapter.getConfig()
    if (!client || !config) throw new Error('请先配置LLM连接')
    return humanizeAdapter.generateSuggestions(bookId, client, config.model, (msg, pct) => {
      mainWindow.webContents.send('pipeline-progress', { stage: msg, detail: `${pct}%`, timestamp: Date.now() })
    })
  })

  ipcMain.handle('load-suggestions', async (_e, bookId: string) => {
    return humanizeAdapter.loadSuggestions(bookId)
  })

  // ===== Phase 3: AIGC检测 =====

  ipcMain.handle('analyze-ai-tells', async (_e, content: string, language?: 'zh' | 'en') => {
    return detectionAdapter.analyzeAITells(content, language)
  })

  ipcMain.handle('analyze-sensitive-words', async (_e, content: string, customWords?: string[]) => {
    return detectionAdapter.analyzeSensitiveWords(content, customWords)
  })

  ipcMain.handle('detect-chapter', async (_e, bookId: string, chapterNumber: number, chapterTitle: string, content: string) => {
    return detectionAdapter.detectChapter(bookId, chapterNumber, chapterTitle, content)
  })

  ipcMain.handle('load-detection-history', async (_e, bookId: string) => {
    return detectionAdapter.loadDetectionHistory(bookId)
  })

  ipcMain.handle('load-detection-record', async (_e, bookId: string, chapterNumber: number) => {
    return detectionAdapter.loadDetectionRecord(bookId, chapterNumber)
  })

  // ===== 进度事件转发 =====
  pipelineAdapter.on('progress', (event) => {
    mainWindow.webContents.send('pipeline-progress', event)
  })

  // ===== 热榜雷达 =====

  ipcMain.handle('trending-platforms', async () => {
    return trendingAdapter.getPlatforms()
  })

  ipcMain.handle('fetch-trending', async (_e, platformId: string, listType: string, translate: boolean) => {
    // 尝试连接 LLM 用于翻译
    const client = llmAdapter.getClient()
    const config = llmAdapter.getConfig()
    if (client && config && translate) {
      const { chatCompletion } = await import('@actalk/hintos-core')
      trendingAdapter.setLLMChat(async (messages) => {
        const res = await chatCompletion(client, config.model, messages as never, { maxTokens: 4096, temperature: 0.3 })
        return res.content
      })
    }
    return trendingAdapter.fetchTrending(platformId, listType, translate)
  })

  ipcMain.handle('analyze-trending', async (_e, novels: unknown[]) => {
    const client = llmAdapter.getClient()
    const config = llmAdapter.getConfig()
    if (!client || !config) throw new Error('请先在设置中配置 LLM')
    const { chatCompletion } = await import('@actalk/hintos-core')
    trendingAdapter.setLLMChat(async (messages) => {
      const res = await chatCompletion(client, config.model, messages as never, { maxTokens: 8192, temperature: 0.7 })
      return res.content
    })
    return trendingAdapter.analyzeTrending(novels as never)
  })

  // ===== 创意库 =====

  const vaultDir = join(app.getPath('userData'), 'idea-vault')

  // 自动迁移：从旧 inkos-studio 目录迁移 idea-vault 和 app-settings
  {
    const oldUserData = join(app.getPath('userData'), '..', 'inkos-studio')
    if (existsSync(oldUserData)) {
      const oldVault = join(oldUserData, 'idea-vault')
      if (existsSync(oldVault) && !existsSync(vaultDir)) {
        mkdirSync(vaultDir, { recursive: true })
        for (const f of readdirSync(oldVault).filter(x => x.endsWith('.json'))) {
          const dest = join(vaultDir, f)
          if (!existsSync(dest)) copyFileSync(join(oldVault, f), dest)
        }
      }
      const oldSettings = join(oldUserData, 'app-settings.json')
      const newSettings = getAppSettingsPath()
      if (existsSync(oldSettings) && !existsSync(newSettings)) {
        copyFileSync(oldSettings, newSettings)
      }
    }
  }

  ipcMain.handle('vault-save', async (_e, entry: { novelCount: number; analysis: string }) => {
    if (!existsSync(vaultDir)) mkdirSync(vaultDir, { recursive: true })
    const id = Date.now().toString()
    const record = { id, createdAt: new Date().toISOString(), novelCount: entry.novelCount, analysis: entry.analysis }
    writeFileSync(join(vaultDir, `${id}.json`), JSON.stringify(record, null, 2), 'utf-8')
    return record
  })

  ipcMain.handle('vault-list', async () => {
    if (!existsSync(vaultDir)) return []
    const files = readdirSync(vaultDir).filter(f => f.endsWith('.json')).sort().reverse()
    return files.map(f => {
      try {
        const data = JSON.parse(readFileSync(join(vaultDir, f), 'utf-8'))
        return { id: data.id, createdAt: data.createdAt, novelCount: data.novelCount, preview: (data.analysis as string).slice(0, 120) }
      } catch { return null }
    }).filter(Boolean)
  })

  ipcMain.handle('vault-get', async (_e, id: string) => {
    const p = join(vaultDir, `${id}.json`)
    if (!existsSync(p)) throw new Error('记录不存在')
    return JSON.parse(readFileSync(p, 'utf-8'))
  })

  ipcMain.handle('vault-delete', async (_e, id: string) => {
    const p = join(vaultDir, `${id}.json`)
    if (existsSync(p)) { const { unlinkSync } = await import('fs'); unlinkSync(p) }
  })

  ipcMain.handle('vault-update', async (_e, id: string, analysis: string) => {
    const p = join(vaultDir, `${id}.json`)
    if (!existsSync(p)) throw new Error('记录不存在')
    const data = JSON.parse(readFileSync(p, 'utf-8'))
    data.analysis = analysis
    writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8')
    return data
  })

  // ===== Online Scraper (Book Inception Pipeline) =====

  ipcMain.handle('scraper-fetch-chapters', async (_e, fictionUrl: string) => {
    return scraperAdapter.fetchChapterList(fictionUrl)
  })

  ipcMain.handle('scraper-scrape-for-analysis', async (_e, bookId: string, fictionUrl: string, fictionTitle: string, maxSamples: number) => {
    scraperAdapter.setProgressCallback((p) => {
      mainWindow.webContents.send('pipeline-progress', {
        stage: p.phase === 'chapters' ? 'Fetching chapter list...' : `Sampling ${p.current}/${p.total}: ${p.chapterTitle ?? ''}`,
        detail: `${Math.round((p.current / p.total) * 100)}%`,
        timestamp: Date.now(),
      })
    })
    return scraperAdapter.scrapeForStyleAnalysis(bookId, fictionUrl, fictionTitle, maxSamples)
  })

  // ===== Sync style_guide.md on demand =====

  ipcMain.handle('sync-style-guide', async (_e, bookId: string) => {
    await syncStyleGuide(bookId)
    return true
  })

  // ===== Apply AI Suggestions to Humanize Engine =====

  ipcMain.handle('apply-suggestions', async (_e, bookId: string) => {
    const suggestions = await humanizeAdapter.loadSuggestions(bookId)
    if (!suggestions) throw new Error('No suggestions found')

    // Apply humanize settings
    if (suggestions.humanizeSettings) {
      const current = await humanizeAdapter.loadSettings(bookId)
      const merged = { ...current, ...suggestions.humanizeSettings }
      delete (merged as Record<string, unknown>).reasons
      await humanizeAdapter.saveSettings(bookId, merged as never)
    }

    // Apply voice cards
    if (suggestions.voiceCards?.length) {
      await humanizeAdapter.saveVoiceCards(bookId, suggestions.voiceCards as never)
    }

    // Apply scene beats (save as chapter 1 template)
    if (suggestions.sceneBeats?.length) {
      const beats = suggestions.sceneBeats[0]?.beats
      if (beats?.length) {
        await humanizeAdapter.saveSceneBeats(bookId, 1, beats)
      }
    }

    // Sync to style_guide.md
    await syncStyleGuide(bookId)
    return true
  })
}
