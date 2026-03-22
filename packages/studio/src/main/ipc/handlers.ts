import { ipcMain, dialog, BrowserWindow, app, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync, mkdirSync, appendFileSync } from 'fs'
import { PipelineAdapter } from '../adapters/pipeline-adapter'
import { StateAdapter } from '../adapters/state-adapter'
import { LLMAdapter, type LLMConfigUI, type TaskRoutingConfig } from '../adapters/llm-adapter'
import { HumanizeAdapter } from '../adapters/humanize-adapter'
import { DetectionAdapter } from '../adapters/detection-adapter'
import { TrendingAdapter } from '../adapters/trending-adapter'
import { ScraperAdapter } from '../adapters/scraper-adapter'
import { matchNovelsByGenre } from '../utils/genre-tag-map'
import { isEnglishGenre } from '@actalk/hintos-core'
import { initAgentChatHandler, handleUserChatMessage, clearAgentHistory } from './agent-chat-handler'

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
  // vault 路径（多处 handler 引用，需提前定义）
  const vaultDir = join(app.getPath('userData'), 'idea-vault')

  // 当前操作标识（Token 追踪用）
  let currentOperation = '未知操作'

  // CyberFeed 广播
  function emitFeed(source: string, level: string, message: string, detail?: string): void {
    mainWindow.webContents.send('cyber-feed', { source, level, message, detail })
  }

  // Agent Chat 流式广播
  function emitAgentChatStream(agentName: string, chunkText: string, messageId: string, isComplete: boolean): void {
    mainWindow.webContents.send('agent-chat-stream', { agentName, chunkText, messageId, isComplete })
  }

  // Agent Chat 消息广播
  function emitAgentChatMessage(message: unknown): void {
    mainWindow.webContents.send('agent-chat-message', message)
  }

  // === 日志系统 ===
  const logDir = join(app.getPath('userData'), 'activity-logs')
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })

  function appendLog(type: 'ACTIVITY' | 'TOKEN' | 'ERROR', message: string): void {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 8) // HH:MM:SS
    const line = `[${timeStr}] [${type}] ${message}\n`
    const logFile = join(logDir, `${dateStr}.log`)
    try { appendFileSync(logFile, line, 'utf-8') } catch { /* ignore */ }
  }

  // Token 回调注册（所有 init 路径共享）
  function registerTokenCallback(): void {
    llmAdapter.setTokenUsageCallback((model, input, output) => {
      mainWindow.webContents.send('pipeline-progress', {
        stage: '', detail: '', timestamp: Date.now(),
        tokenUsage: { input, output, model, operation: currentOperation }
      })
      appendLog('TOKEN', `${currentOperation} | model=${model} in=${input} out=${output}`)
    })
  }

  // 日志 IPC — 前端可直接写日志
  ipcMain.handle('append-activity-log', (_e, type: string, message: string) => {
    appendLog(type as 'ACTIVITY' | 'TOKEN' | 'ERROR', message)
  })

  // 在默认浏览器打开链接（安全校验：仅允许 https）
  ipcMain.handle('open-external', (_e, url: string) => {
    if (typeof url === 'string' && url.startsWith('https://')) {
      return shell.openExternal(url)
    }
  })

  // ===== Agent Chat Gate 响应 =====
  ipcMain.handle('agent-chat-respond', (_e, stage: string, action: string, feedback?: string) => {
    appendLog('ACTIVITY', `Agent Chat gate respond: stage=${stage} action=${action}`)
    const resolved = pipelineAdapter.resolveGate(stage, action, feedback)
    if (!resolved) {
      appendLog('ACTIVITY', `Gate ${stage} not found (already resolved or expired)`)
    }
    return resolved
  })

  // ===== Agent Chat 对话 =====
  initAgentChatHandler({
    mainWindow,
    getClient: () => llmAdapter.getClient(),
    getModel: () => llmAdapter.getConfig()?.model ?? null,
    getProjectRoot: () => stateAdapter.getProjectRoot(),
    getModelOverride: (_agentName: string) => undefined,
    appendLog,
  })

  ipcMain.handle('agent-chat-send', async (_e, text: string, messageId: string) => {
    try {
      await handleUserChatMessage(text, messageId)
      return true
    } catch (err) {
      appendLog('ERROR', `Agent chat send error: ${(err as Error).message}`)
      return false
    }
  })

  ipcMain.handle('agent-chat-clear', (_e, agentName?: string) => {
    clearAgentHistory(agentName)
    return true
  })

  // Sync interaction mode from frontend to pipeline adapter
  ipcMain.handle('set-interaction-mode', (_e, mode: string) => {
    if (['interactive', 'auto-report', 'silent'].includes(mode)) {
      pipelineAdapter.setInteractionMode(mode as 'interactive' | 'auto-report' | 'silent')
      appendLog('ACTIVITY', `Interaction mode set to: ${mode}`)
      return true
    }
    return false
  })

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
      // 优先检查新格式（语言池） — task-routing.json 中含 pools + 已解析的 default/agents
      const routing = await stateAdapter.loadTaskRouting()
      if (routing && typeof routing === 'object') {
        const r = routing as Record<string, unknown>
        if (r.pools && r.default && (r.default as Record<string, unknown>).apiKey) {
          // 新格式：pools 模式 — 直接使用已保存的 default + agents
          const taskRouting = routing as TaskRoutingConfig
          if (taskRouting.agents && Object.keys(taskRouting.agents).length > 0) {
            const { client, modelOverrides } = await llmAdapter.createRoutingClient(taskRouting)
            registerTokenCallback()
            await pipelineAdapter.initialize(client, taskRouting.default.model, root, modelOverrides)
          } else {
            const client = await llmAdapter.createClient(taskRouting.default)
            registerTokenCallback()
            await pipelineAdapter.initialize(client, taskRouting.default.model, root)
          }
          return { ok: true }
        }
      }

      // 旧格式：从 .env + hintos.json 构建配置
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
      // 检查是否有旧式任务路由配置
      if (routing && typeof routing === 'object' && (routing as Record<string, unknown>).agents) {
        const r = routing as TaskRoutingConfig
        r.default = llmConfig
        const { client, modelOverrides } = await llmAdapter.createRoutingClient(r)
        registerTokenCallback()
        await pipelineAdapter.initialize(client, llmConfig.model, root, modelOverrides)
      } else {
        const client = await llmAdapter.createClient(llmConfig)
        registerTokenCallback()
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
    registerTokenCallback()
    await pipelineAdapter.initialize(client, config.model, root)
    return true
  })

  // 多模型路由初始化
  ipcMain.handle('init-pipeline-routing', async (_e, routing: TaskRoutingConfig) => {
    const root = stateAdapter.getProjectRoot()
    if (!root) throw new Error('请先打开项目')
    const { client, modelOverrides } = await llmAdapter.createRoutingClient(routing)
    // 注册 Token 使用回调 → 通过 pipeline-progress 通道推送给前端
    registerTokenCallback()
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
    currentOperation = '创建书籍'
    emitFeed('system', 'info', `创建书籍: ${opts.title}`, `${opts.genre} / ${opts.platform}`)
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

    // ===== 自动风格采样：从创意库 vault 中匹配同题材小说 =====
    if (!opts.styleBookPaths?.length && projectRoot) {
      try {
        const emitStyle = (detail: string): void => {
          mainWindow.webContents.send('pipeline-progress', { stage: 'auto-style', detail, timestamp: Date.now() })
        }
        emitStyle('🔍 从创意库筛选同题材小说...')

        // 遍历所有 vault 记录，按语言过滤，提取 novels[]
        const bookLang = isEnglishGenre(opts.genre) ? 'en' : 'zh'
        const allVaultNovels: Array<{ rank: number; title: string; titleZh: string; tags: string; stats: string; platform: string; url: string; localPath?: string }> = []
        if (existsSync(vaultDir)) {
          const vaultFiles = readdirSync(vaultDir).filter(f => f.endsWith('.json'))
          for (const f of vaultFiles) {
            try {
              const data = JSON.parse(readFileSync(join(vaultDir, f), 'utf-8'))
              // 只加载同语言的 vault 记录（旧记录无 language 字段默认 en）
              const recordLang = data.language ?? 'en'
              if (recordLang !== bookLang) continue
              if (Array.isArray(data.novels)) {
                for (const n of data.novels) {
                  if (n.title && (n.url || n.localPath)) allVaultNovels.push(n)
                }
              }
            } catch { /* skip corrupt vault files */ }
          }
        }

        if (allVaultNovels.length > 0) {
          const matched = matchNovelsByGenre(allVaultNovels, opts.genre, 3)
          if (matched.length > 0) {
            emitStyle(`🔍 找到 ${matched.length} 本匹配小说，开始采样...`)

            let sampledCount = 0
            for (let i = 0; i < matched.length; i++) {
              const novel = matched[i]
              emitStyle(`📥 采样参考书 ${i + 1}/${matched.length}: 《${novel.title}》 ${Math.round(((i + 1) / matched.length) * 50)}%`)
              try {
                if (novel.localPath && existsSync(novel.localPath)) {
                  // 中文导入的本地 TXT：直接复制到 style-books/
                  const styleDir = join(projectRoot!, 'books', bookId, 'humanize', 'style-books')
                  mkdirSync(styleDir, { recursive: true })
                  const destName = novel.localPath.split(/[\\/]/).pop() || `${novel.title}.txt`
                  copyFileSync(novel.localPath, join(styleDir, destName))
                  sampledCount++
                } else if (novel.url) {
                  // 英文在线小说：通过 scraper 下载
                  scraperAdapter.setProgressCallback((p) => {
                    mainWindow.webContents.send('pipeline-progress', {
                      stage: 'auto-style',
                      detail: p.phase === 'chapters' ? `📥 获取目录: 《${novel.title}》` : `📥 下载 ${p.current}/${p.total}: ${p.chapterTitle ?? ''} ${Math.round((p.current / p.total) * 100)}%`,
                      timestamp: Date.now(),
                    })
                  })
                  await scraperAdapter.scrapeForStyleAnalysis(bookId, novel.url, novel.title, 10)
                  sampledCount++
                }
              } catch {
                // 采样某本失败不阻塞整个流程
                emitStyle(`⚠️ 采样《${novel.title}》失败，跳过`)
              }
            }

            if (sampledCount > 0) {
              // 统计分析 + 深度指纹 + 写入 style_guide
              emitStyle('📊 分析文风统计指纹... 60%')
              try { await humanizeAdapter.analyzeStyleFromBooks(bookId) } catch { /* non-fatal */ }

              emitStyle('🧬 生成 AI 深度指纹... 80%')
              try {
                const llmClient = llmAdapter.getClient()
                const llmConfig = llmAdapter.getConfig()
                if (llmClient && llmConfig) {
                  await humanizeAdapter.analyzeDeepFingerprint(bookId, llmClient, llmConfig.model)
                }
              } catch { /* non-fatal: LLM 可能未配置本任务模型 */ }

              emitStyle('✅ 风格分析完成，正在合成 style_guide... 95%')
              try { await syncStyleGuide(bookId) } catch { /* non-fatal */ }
              mainWindow.webContents.send('pipeline-progress', { stage: 'auto-style-done', detail: '✅ 自动风格采样完成', timestamp: Date.now() })
            } else {
              mainWindow.webContents.send('pipeline-progress', { stage: 'auto-style-done', detail: '⚠️ 所有参考书采样失败，跳过风格分析', timestamp: Date.now() })
            }
          } else {
            mainWindow.webContents.send('pipeline-progress', { stage: 'auto-style-done', detail: '⏭️ 创意库中无匹配题材小说，跳过自动风格采样', timestamp: Date.now() })
          }
        } else {
          mainWindow.webContents.send('pipeline-progress', { stage: 'auto-style-done', detail: '⏭️ 创意库为空，跳过自动风格采样', timestamp: Date.now() })
        }
      } catch {
        // 自动采样整体失败不应阻止书籍创建
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

    // 持久化用户原始创作指导——写手每章都会读取，不再蒸发
    if (opts.context?.trim() && projectRoot) {
      const storyDir = join(projectRoot, 'books', bookId, 'story')
      mkdirSync(storyDir, { recursive: true })
      writeFileSync(join(storyDir, 'creative_context.md'), opts.context.trim(), 'utf-8')
    }

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
    currentOperation = '写作'
    return pipelineAdapter.writeNext(bookId, wordCount)
  })

  ipcMain.handle('audit-chapter', async (_e, bookId: string, chapterNumber?: number) => {
    currentOperation = '审计'
    return pipelineAdapter.auditDraft(bookId, chapterNumber)
  })

  ipcMain.handle('revise-chapter', async (_e, bookId: string, chapterNumber?: number, mode?: string) => {
    currentOperation = '修订'
    return pipelineAdapter.reviseDraft(bookId, chapterNumber, mode as 'rewrite' | 'polish' | 'minimal')
  })

  ipcMain.handle('check-continuity-plus', async (_e, bookId: string, chapterNumber?: number) => {
    currentOperation = '深度审查'
    return pipelineAdapter.checkContinuityPlus(bookId, chapterNumber)
  })

  ipcMain.handle('polish-chapter', async (_e, bookId: string, chapterNumber?: number) => {
    currentOperation = '润色'
    return pipelineAdapter.polishDraft(bookId, chapterNumber)
  })

  // ===== 章节大纲规划 =====

  ipcMain.handle('plan-next', async (_e, bookId: string) => {
    currentOperation = '章节规划'
    return pipelineAdapter.planNextChapter(bookId)
  })

  ipcMain.handle('plan-replan', async (_e, bookId: string, chapter: number, feedback: string) => {
    currentOperation = '重新规划'
    return pipelineAdapter.replanChapter(bookId, chapter, feedback)
  })

  ipcMain.handle('plan-list', async (_e, bookId: string) => {
    return stateAdapter.loadPlanIndex(bookId)
  })

  ipcMain.handle('plan-get', async (_e, bookId: string, chapter: number) => {
    return stateAdapter.loadChapterPlan(bookId, chapter)
  })

  ipcMain.handle('plan-approve', async (_e, bookId: string, chapter: number) => {
    await stateAdapter.approvePlan(bookId, chapter)
    await stateAdapter.appendOperationLog(bookId, { type: 'plan_approved', chapter })
    return true
  })

  ipcMain.handle('plan-reject', async (_e, bookId: string, chapter: number, feedback: string) => {
    await stateAdapter.rejectPlan(bookId, chapter, feedback)
    await stateAdapter.appendOperationLog(bookId, { type: 'plan_rejected', chapter, feedback })
    return true
  })

  ipcMain.handle('plan-update', async (_e, bookId: string, chapter: number, content: string) => {
    await stateAdapter.updatePlanContent(bookId, chapter, content)
    await stateAdapter.appendOperationLog(bookId, { type: 'plan_edited', chapter })
    return true
  })

  ipcMain.handle('plan-stats', async (_e, bookId: string) => {
    const index = await stateAdapter.loadPlanIndex(bookId)
    return stateAdapter.getPlanStats(index)
  })

  ipcMain.handle('read-operation-log', async (_e, bookId: string, limit?: number) => {
    return stateAdapter.readOperationLog(bookId, limit)
  })

  // ===== 导出 =====

  ipcMain.handle('export-book', async (_e, bookId: string, format: 'txt' | 'md') => {
    currentOperation = `导出${format.toUpperCase()}`
    mainWindow.webContents.send('pipeline-progress', { stage: `📦 正在导出 ${format.toUpperCase()}...`, detail: '', timestamp: Date.now() })
    const content = await stateAdapter.exportBook(bookId, format)
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出书籍',
      defaultPath: `${bookId}.${format}`,
      filters: [{ name: format === 'md' ? 'Markdown' : 'Text', extensions: [format] }]
    })
    if (result.canceled || !result.filePath) return null
    const { writeFile } = await import('fs/promises')
    await writeFile(result.filePath, content, 'utf-8')
    mainWindow.webContents.send('pipeline-progress', { stage: `✅ ${format.toUpperCase()} 导出完成`, detail: result.filePath, timestamp: Date.now() })
    return result.filePath
  })

  ipcMain.handle('export-epub', async (_e, bookId: string, metadata: unknown, options: unknown) => {
    currentOperation = '导出EPUB'
    mainWindow.webContents.send('pipeline-progress', { stage: '📦 正在生成 EPUB...', detail: '打包章节中', timestamp: Date.now() })
    const buf = await stateAdapter.exportBookEpub(
      bookId,
      metadata as Parameters<typeof stateAdapter.exportBookEpub>[1],
      options as Parameters<typeof stateAdapter.exportBookEpub>[2]
    )
    mainWindow.webContents.send('pipeline-progress', { stage: '📦 EPUB 生成完成，选择保存位置...', detail: '', timestamp: Date.now() })
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
    mainWindow.webContents.send('pipeline-progress', { stage: '✅ EPUB 导出完成', detail: result.filePath, timestamp: Date.now() })
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
    emitFeed('pipeline', 'info', '文本统计分析', bookId)
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
    currentOperation = 'AI深度指纹'
    emitFeed('llm', 'info', 'AI深度指纹分析', bookId)
    const client = llmAdapter.getClient()
    const config = llmAdapter.getConfig()
    if (!client || !config) throw new Error('请先配置LLM连接')
    return humanizeAdapter.analyzeDeepFingerprint(bookId, client, config.model, (msg, pct) => {
      mainWindow.webContents.send('pipeline-progress', { stage: msg, detail: `${pct}%`, timestamp: Date.now() })
    })
  })

  // ===== Phase 3: AI建议 =====

  ipcMain.handle('generate-suggestions', async (_e, bookId: string) => {
    currentOperation = 'AI建议生成'
    emitFeed('llm', 'info', 'AI建议生成', bookId)
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
    currentOperation = 'AIGC检测'
    mainWindow.webContents.send('pipeline-progress', { stage: '🔍 正在检测 AI 痕迹 + 敏感词...', detail: `第${chapterNumber}章`, timestamp: Date.now() })
    const record = await detectionAdapter.detectChapter(bookId, chapterNumber, chapterTitle, content)
    mainWindow.webContents.send('pipeline-progress', { stage: '✅ AIGC 检测完成', detail: `风险: ${record.overallRisk}`, timestamp: Date.now() })
    return record
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

  // ===== Agent Chat 事件转发 =====
  pipelineAdapter.on('gate', (payload) => {
    // Send gate as an agent-chat-message of type 'agent-gate'
    emitAgentChatMessage({
      type: 'agent-gate',
      agentName: payload.agentName,
      content: payload.summary,
      actions: payload.actions,
      richData: payload.data,
      stage: payload.stage,
    })
    appendLog('ACTIVITY', `Agent gate fired: ${payload.stage} — ${payload.summary}`)
  })

  pipelineAdapter.on('agent-report', (report: { agentName: string; content: string; richData?: Record<string, unknown> }) => {
    emitAgentChatMessage({
      type: 'agent-report',
      agentName: report.agentName,
      content: report.content,
      richData: report.richData,
    })
  })

  pipelineAdapter.on('chapter-landmark', (landmark: { chapterNum: number; title: string; wordCount: number; characters: string[]; hooksAdded: Array<{ id: string; brief: string }>; hooksResolved: Array<{ id: string; brief: string }>; auditCritical: number; chapterSummary: string }) => {
    emitAgentChatMessage({
      type: 'chapter-landmark',
      agentName: 'writer',
      content: `📍 第${landmark.chapterNum}章「${landmark.title}」${landmark.wordCount}字`,
      landmark,
    })
  })

  // ===== 热榜雷达 =====

  ipcMain.handle('trending-platforms', async () => {
    return trendingAdapter.getPlatforms()
  })

  ipcMain.handle('fetch-trending', async (_e, platformId: string, listType: string, translate: boolean) => {
    currentOperation = '抓取热榜'
    mainWindow.webContents.send('pipeline-progress', { stage: `📡 正在抓取 ${platformId} · ${listType}...`, detail: '', timestamp: Date.now() })
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

  ipcMain.handle('analyze-trending', async (_e, novels: unknown[], language?: 'en' | 'zh') => {
    const lang = language ?? 'en'
    currentOperation = 'AI选题分析'
    mainWindow.webContents.send('pipeline-progress', { stage: '🤖 AI 正在分析选题趋势...', detail: `基于 ${(novels as unknown[]).length} 部小说`, timestamp: Date.now() })
    const client = llmAdapter.getClient()
    const config = llmAdapter.getConfig()
    if (!client || !config) throw new Error('请先在设置中配置 LLM')
    const { chatCompletion } = await import('@actalk/hintos-core')
    trendingAdapter.setLLMChat(async (messages) => {
      const res = await chatCompletion(client, config.model, messages as never, { maxTokens: 8192, temperature: 0.7 })
      return res.content
    })
    const result = await trendingAdapter.analyzeTrending(novels as never, lang)
    mainWindow.webContents.send('pipeline-progress', { stage: '✅ AI 选题分析完成', detail: '', timestamp: Date.now() })
    return result
  })

  // ===== 中文小说 TXT 导入 =====

  ipcMain.handle('import-zh-novels', async () => {
    const dialogResult = await dialog.showOpenDialog(mainWindow, {
      title: '选择中文小说 TXT 文件',
      filters: [{ name: '文本文件', extensions: ['txt'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (dialogResult.canceled || dialogResult.filePaths.length === 0) return []

    // 复制到 radar/zh-imports/ 目录
    const root = stateAdapter.getProjectRoot()
    if (!root) throw new Error('请先打开项目')
    const importDir = join(root, 'radar', 'zh-imports')
    mkdirSync(importDir, { recursive: true })

    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    const imported: Array<{ fileName: string; title: string; charCount: number; localPath: string }> = []
    for (const fp of dialogResult.filePaths) {
      const { statSync: fstat } = await import('fs')
      const srcStat = fstat(fp)
      if (srcStat.size > MAX_FILE_SIZE) {
        mainWindow.webContents.send('pipeline-progress', { stage: 'import-warn', detail: `⚠️ 跳过「${fp.split(/[\\/]/).pop()}」: 文件超过 50MB`, timestamp: Date.now() })
        continue
      }
      const fileName = fp.split(/[\\/]/).pop() || 'unknown.txt'
      const title = fileName.replace(/\.txt$/i, '')
      const dest = join(importDir, fileName)
      if (!existsSync(dest)) copyFileSync(fp, dest)
      // 检测编码：UTF-8 BOM 或内容中无乱码特征
      const raw = readFileSync(dest)
      let content: string
      if (raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF) {
        content = raw.toString('utf-8') // UTF-8 BOM
      } else {
        content = raw.toString('utf-8')
        // 检测常见 GBK 乱码特征（连续的 U+FFFD 替换字符）
        const replacementCount = (content.match(/\uFFFD/g) || []).length
        if (replacementCount > content.length * 0.01 && content.length > 100) {
          mainWindow.webContents.send('pipeline-progress', { stage: 'import-warn', detail: `⚠️「${fileName}」可能不是 UTF-8 编码，请转换为 UTF-8 后重试`, timestamp: Date.now() })
          continue
        }
      }
      imported.push({ fileName, title, charCount: content.length, localPath: dest })
    }
    return imported
  })

  ipcMain.handle('analyze-zh-novels', async (_e, localPaths: string[]) => {
    currentOperation = '中文小说AI选题分析'
    mainWindow.webContents.send('pipeline-progress', { stage: '🤖 AI 正在分析中文参考小说...', detail: `基于 ${localPaths.length} 本小说`, timestamp: Date.now() })

    const client = llmAdapter.getClient()
    const config = llmAdapter.getConfig()
    if (!client || !config) throw new Error('请先在设置中配置 LLM')

    // 提取每本小说的摘要（首2000 + 中2000 + 尾2000字），用流式避免大文件 OOM
    const sampleLen = 2000
    const summaries: string[] = []
    for (const lp of localPaths) {
      if (!existsSync(lp)) continue
      const { statSync: fstat } = await import('fs')
      const fileSize = fstat(lp).size
      if (fileSize > 50 * 1024 * 1024) continue // 跳过超大文件
      const content = readFileSync(lp, 'utf-8')
      const title = lp.split(/[\\/]/).pop()?.replace(/\.txt$/i, '') || '未知'
      const len = content.length
      const wordLabel = len >= 10000 ? `${Math.round(len / 10000)}万字` : `${Math.round(len / 1000)}千字`
      let sample = `## 《${title}》（${wordLabel}）\n`
      sample += `【开头】\n${content.substring(0, sampleLen)}\n`
      if (len > sampleLen * 3) {
        sample += `【中间】\n${content.substring(Math.floor(len / 2) - sampleLen / 2, Math.floor(len / 2) + sampleLen / 2)}\n`
      }
      sample += `【结尾】\n${content.substring(Math.max(0, len - sampleLen))}\n`
      summaries.push(sample)
    }

    const novelsSummary = summaries.join('\n---\n')

    // 调用 trendingAdapter 的中文分析
    const { chatCompletion } = await import('@actalk/hintos-core')
    trendingAdapter.setLLMChat(async (messages) => {
      const res = await chatCompletion(client, config.model, messages as never, { maxTokens: 8192, temperature: 0.7 })
      return res.content
    })
    const result = await trendingAdapter.analyzeZhNovelSamples(novelsSummary)
    mainWindow.webContents.send('pipeline-progress', { stage: '✅ 中文选题分析完成', detail: '', timestamp: Date.now() })
    return result
  })

  // ===== 创意库 =====

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

  ipcMain.handle('vault-save', async (_e, entry: { novelCount: number; analysis: string; language?: 'en' | 'zh'; novels?: Array<{ rank: number; title: string; titleZh: string; tags: string; stats: string; platform: string; url: string; localPath?: string }> }) => {
    if (!existsSync(vaultDir)) mkdirSync(vaultDir, { recursive: true })
    const id = Date.now().toString()
    const record = { id, createdAt: new Date().toISOString(), novelCount: entry.novelCount, analysis: entry.analysis, language: entry.language ?? 'en', novels: entry.novels ?? [] }
    writeFileSync(join(vaultDir, `${id}.json`), JSON.stringify(record, null, 2), 'utf-8')
    return record
  })

  ipcMain.handle('vault-list', async () => {
    if (!existsSync(vaultDir)) return []
    const files = readdirSync(vaultDir).filter(f => f.endsWith('.json')).sort().reverse()
    return files.map(f => {
      try {
        const data = JSON.parse(readFileSync(join(vaultDir, f), 'utf-8'))
        return { id: data.id, createdAt: data.createdAt, novelCount: data.novelCount, language: data.language ?? 'en', preview: (data.analysis as string).slice(0, 120) }
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

  ipcMain.handle('vault-all-novels', async (_e, lang?: 'en' | 'zh') => {
    if (!existsSync(vaultDir)) return []
    const novels: Array<{ rank: number; title: string; titleZh: string; tags: string; stats: string; platform: string; url: string; localPath?: string }> = []
    for (const f of readdirSync(vaultDir).filter(x => x.endsWith('.json'))) {
      try {
        const data = JSON.parse(readFileSync(join(vaultDir, f), 'utf-8'))
        if (lang && (data.language ?? 'en') !== lang) continue
        if (Array.isArray(data.novels)) {
          for (const n of data.novels) {
            if (n.title && (n.url || n.localPath)) novels.push(n)
          }
        }
      } catch { /* skip corrupt */ }
    }
    // 按 url 或 localPath 去重
    const seen = new Set<string>()
    return novels.filter(n => {
      const key = n.url || n.localPath || n.title
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })

  // ===== Online Scraper (Book Inception Pipeline) =====

  ipcMain.handle('scraper-fetch-chapters', async (_e, fictionUrl: string) => {
    return scraperAdapter.fetchChapterList(fictionUrl)
  })

  ipcMain.handle('scraper-scrape-for-analysis', async (_e, bookId: string, fictionUrl: string, fictionTitle: string, maxSamples: number) => {
    emitFeed('scraper', 'info', `在线采样: ${fictionTitle}`, fictionUrl)
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
    emitFeed('system', 'info', '应用AI建议', bookId)
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

    // Apply ALL scene beats (not just [0]) — 修复死数据
    if (suggestions.sceneBeats?.length) {
      for (let i = 0; i < suggestions.sceneBeats.length; i++) {
        const entry = suggestions.sceneBeats[i]
        if (entry?.beats?.length) {
          await humanizeAdapter.saveSceneBeats(bookId, i + 1, entry.beats)
        }
      }
    }

    // Apply storyArc → volume_outline.md — 修复死数据
    if (suggestions.storyArc?.phases?.length) {
      emitFeed('system', 'info', '写入故事弧线到 volume_outline.md', `${suggestions.storyArc.phases.length} 个阶段`)
      const root = stateAdapter.getProjectRoot()
      if (root) {
        const storyDir = join(root, 'books', bookId, 'story')
        mkdirSync(storyDir, { recursive: true })
        const outlinePath = join(storyDir, 'volume_outline.md')
        let arcContent = '# Story Arc\n\n'
        for (const phase of suggestions.storyArc.phases) {
          arcContent += `## ${phase.name} (Ch. ${phase.chapters})\n${phase.goal}\n\n`
        }
        // 如果已有大纲，追加到末尾
        if (existsSync(outlinePath)) {
          const existing = readFileSync(outlinePath, 'utf-8')
          writeFileSync(outlinePath, existing + '\n---\n\n' + arcContent, 'utf-8')
        } else {
          writeFileSync(outlinePath, arcContent, 'utf-8')
        }
      }
    }

    // Sync to style_guide.md
    await syncStyleGuide(bookId)
    return true
  })
}
