import { existsSync } from 'fs'
import { readFile, readdir, writeFile, mkdir, rm, appendFile } from 'fs/promises'
import { join } from 'path'
import type { BookConfig, ChapterMeta, PlanIndex, PlanEntry, PlanStats } from '@actalk/hintos-core'
import { buildEpub, type EpubChapter, type EpubMetadata, type KDPFormatOptions } from './epub-adapter'

export interface BookSummary {
  bookId: string
  title: string
  genre: string
  platform: string
  chapterCount: number
  totalWords: number
  status: string
}

export interface ProjectInfo {
  name: string
  llm: { provider: string; baseUrl: string; model: string }
  bookCount: number
}

/**
 * 状态适配器 — 文件系统读写，项目/书籍/章节管理
 */
export class StateAdapter {
  private projectRoot: string | null = null

  setProjectRoot(root: string): void {
    this.projectRoot = root
  }

  getProjectRoot(): string | null {
    return this.projectRoot
  }

  private getRoot(): string {
    if (!this.projectRoot) throw new Error('项目路径未设置')
    return this.projectRoot
  }

  isProjectDir(dirPath: string): boolean {
    return existsSync(join(dirPath, 'hintos.json'))
  }

  // ===== 项目配置 =====

  async loadProjectConfig(): Promise<Record<string, unknown> | null> {
    const configPath = join(this.getRoot(), 'hintos.json')
    if (!existsSync(configPath)) return null
    try {
      return JSON.parse(await readFile(configPath, 'utf-8'))
    } catch {
      throw new Error('hintos.json 格式损坏，请检查文件内容')
    }
  }

  async saveProjectConfig(config: Record<string, unknown>): Promise<void> {
    await writeFile(
      join(this.getRoot(), 'hintos.json'),
      JSON.stringify(config, null, 2),
      'utf-8'
    )
  }

  async loadProjectInfo(): Promise<ProjectInfo | null> {
    const config = await this.loadProjectConfig()
    if (!config) return null
    const books = await this.listBooks()
    const llm = (config.llm ?? {}) as Record<string, string>
    return {
      name: (config.name as string) ?? 'HintOS项目',
      llm: {
        provider: llm.provider ?? 'openai',
        baseUrl: llm.baseUrl ?? '',
        model: llm.model ?? ''
      },
      bookCount: books.length
    }
  }

  // ===== .env 配置（LLM密钥存储） =====

  async loadEnvConfig(): Promise<Record<string, string>> {
    const envPath = join(this.getRoot(), '.env')
    if (!existsSync(envPath)) return {}
    const content = await readFile(envPath, 'utf-8')
    const result: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        result[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1)
      }
    }
    return result
  }

  async saveEnvConfig(values: Record<string, string>): Promise<void> {
    const lines = [
      '# HintOS LLM 配置 (由 HintOS Studio 管理)',
      ...Object.entries(values).map(([k, v]) => `${k}=${v}`)
    ]
    await writeFile(join(this.getRoot(), '.env'), lines.join('\n'), 'utf-8')
  }

  // ===== 任务路由配置 =====

  async loadTaskRouting(): Promise<unknown | null> {
    const routingPath = join(this.getRoot(), 'task-routing.json')
    if (!existsSync(routingPath)) return null
    try {
      return JSON.parse(await readFile(routingPath, 'utf-8'))
    } catch {
      throw new Error('task-routing.json 格式损坏，请检查文件内容')
    }
  }

  async saveTaskRouting(routing: unknown): Promise<void> {
    await writeFile(
      join(this.getRoot(), 'task-routing.json'),
      JSON.stringify(routing, null, 2),
      'utf-8'
    )
  }

  // ===== 项目初始化 =====

  async initProject(dirPath: string, projectName: string): Promise<void> {
    await mkdir(join(dirPath, 'books'), { recursive: true })
    await mkdir(join(dirPath, 'radar'), { recursive: true })
    const config = {
      name: projectName,
      version: '0.1.0',
      llm: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
      notify: [],
      daemon: {
        schedule: { radarCron: '0 9 * * *', writeCron: '0 14 * * *', auditCron: '0 17 * * *' },
        maxConcurrentBooks: 3,
        qualityGates: { maxAuditRetries: 2, pauseAfterConsecutiveFailures: 3, retryTemperatureStep: 0.1 }
      }
    }
    await writeFile(join(dirPath, 'hintos.json'), JSON.stringify(config, null, 2), 'utf-8')
    await writeFile(join(dirPath, '.env'), [
      '# HintOS LLM 配置',
      'HINTOS_LLM_PROVIDER=openai',
      'HINTOS_LLM_BASE_URL=https://api.openai.com/v1',
      'HINTOS_LLM_API_KEY=your-api-key-here',
      'HINTOS_LLM_MODEL=gpt-4o'
    ].join('\n'), 'utf-8')
    await writeFile(join(dirPath, '.gitignore'), '.env\nnode_modules/\n.DS_Store', 'utf-8')
    this.setProjectRoot(dirPath)
  }

  // ===== 书籍管理 =====

  async listBooks(): Promise<BookSummary[]> {
    const booksDir = join(this.getRoot(), 'books')
    if (!existsSync(booksDir)) return []

    const entries = await readdir(booksDir, { withFileTypes: true })
    const books: BookSummary[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const bookJsonPath = join(booksDir, entry.name, 'book.json')
      if (!existsSync(bookJsonPath)) continue

      try {
        const config: BookConfig = JSON.parse(await readFile(bookJsonPath, 'utf-8'))
        let chapterCount = 0
        let totalWords = 0
        const indexPath = join(booksDir, entry.name, 'chapters', 'index.json')
        if (existsSync(indexPath)) {
          const chapters: ChapterMeta[] = JSON.parse(await readFile(indexPath, 'utf-8'))
          chapterCount = chapters.length
          totalWords = chapters.reduce((sum, ch) => sum + (ch.wordCount ?? 0), 0)
        }

        books.push({
          bookId: entry.name,
          title: config.title ?? entry.name,
          genre: config.genre ?? 'other',
          platform: config.platform ?? 'other',
          chapterCount,
          totalWords,
          status: config.status ?? 'active'
        })
      } catch {
        // 跳过损坏的 book.json
      }
    }
    return books
  }

  async loadBookConfig(bookId: string): Promise<BookConfig | null> {
    const path = join(this.getRoot(), 'books', bookId, 'book.json')
    if (!existsSync(path)) return null
    return JSON.parse(await readFile(path, 'utf-8'))
  }

  async saveBookConfig(bookId: string, config: BookConfig): Promise<void> {
    const path = join(this.getRoot(), 'books', bookId, 'book.json')
    await writeFile(path, JSON.stringify(config, null, 2), 'utf-8')
  }

  async deleteBook(bookId: string): Promise<void> {
    if (!bookId || bookId.includes('..') || bookId.includes('/') || bookId.includes('\\')) {
      throw new Error('无效的书籍ID')
    }
    const bookDir = join(this.getRoot(), 'books', bookId)
    if (!existsSync(bookDir)) throw new Error(`书籍 ${bookId} 不存在`)
    await rm(bookDir, { recursive: true, force: true })
  }

  // ===== 章节管理 =====

  async loadChapterIndex(bookId: string): Promise<ChapterMeta[]> {
    const indexPath = join(this.getRoot(), 'books', bookId, 'chapters', 'index.json')
    if (!existsSync(indexPath)) return []
    try {
      return JSON.parse(await readFile(indexPath, 'utf-8'))
    } catch {
      throw new Error('章节索引损坏，请检查 index.json')
    }
  }

  async loadChapterContent(bookId: string, filename: string): Promise<string> {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error('无效的文件名')
    }
    return readFile(join(this.getRoot(), 'books', bookId, 'chapters', filename), 'utf-8')
  }

  /**
   * 通过章节号查找实际文件名。Core 生成的格式: 0001_标题.md
   * 使用前缀匹配而非重建文件名，避免 sanitization 不一致。
   */
  async resolveChapterFilename(bookId: string, chapterNumber: number): Promise<string | null> {
    const dir = join(this.getRoot(), 'books', bookId, 'chapters')
    if (!existsSync(dir)) return null
    const prefix = String(chapterNumber).padStart(4, '0') + '_'
    const files = await readdir(dir)
    return files.find(f => f.startsWith(prefix) && f.endsWith('.md')) ?? null
  }

  async updateChapterStatus(bookId: string, chapterNumber: number, status: string, reviewNote?: string): Promise<void> {
    const indexPath = join(this.getRoot(), 'books', bookId, 'chapters', 'index.json')
    if (!existsSync(indexPath)) throw new Error('章节索引不存在')
    let chapters: ChapterMeta[]
    try {
      chapters = JSON.parse(await readFile(indexPath, 'utf-8'))
    } catch {
      throw new Error('章节索引损坏，请检查 index.json')
    }
    const ch = chapters.find(c => c.number === chapterNumber)
    if (!ch) throw new Error(`章节 ${chapterNumber} 不存在`)
    ;(ch as Record<string, unknown>).status = status
    ;(ch as Record<string, unknown>).updatedAt = new Date().toISOString()
    if (reviewNote !== undefined) (ch as Record<string, unknown>).reviewNote = reviewNote
    await writeFile(indexPath, JSON.stringify(chapters, null, 2), 'utf-8')
  }

  // ===== 真相文件 =====

  async loadTruthFile(bookId: string, filename: string): Promise<string> {
    const filePath = join(this.getRoot(), 'books', bookId, 'story', filename)
    if (!existsSync(filePath)) return ''
    return readFile(filePath, 'utf-8')
  }

  async loadAllTruthFiles(bookId: string): Promise<Record<string, string>> {
    const files = [
      'current_state.md', 'particle_ledger.md', 'pending_hooks.md',
      'story_bible.md', 'volume_outline.md', 'book_rules.md',
      'chapter_summaries.md', 'subplot_board.md', 'emotional_arcs.md',
      'character_matrix.md'
    ]
    const result: Record<string, string> = {}
    for (const f of files) {
      result[f] = await this.loadTruthFile(bookId, f)
    }
    return result
  }

  // ===== 导出 =====

  async exportBook(bookId: string, format: 'txt' | 'md'): Promise<string> {
    const chapters = await this.loadChapterIndex(bookId)
    const config = await this.loadBookConfig(bookId)
    const title = config?.title ?? bookId

    const parts: string[] = []
    if (format === 'md') parts.push(`# ${title}\n\n`)
    else parts.push(`${title}\n${'='.repeat(title.length)}\n\n`)

    for (const ch of chapters) {
      const filename = await this.resolveChapterFilename(bookId, ch.number)
      if (!filename) continue
      try {
        const content = await this.loadChapterContent(bookId, filename)
        if (format === 'md') {
          parts.push(`## 第${ch.number}章 ${ch.title}\n\n${content}\n\n`)
        } else {
          parts.push(`第${ch.number}章 ${ch.title}\n\n${content}\n\n`)
        }
      } catch {
        // 跳过无法读取的章节
      }
    }
    return parts.join('')
  }

  // ===== EPUB 导出 =====

  /** 从 bookId 解析语言 */
  async resolveLanguage(bookId: string): Promise<'zh' | 'en'> {
    try {
      const bookConfig = await this.loadBookConfig(bookId)
      const genre = bookConfig?.genre
      if (genre) {
        const { readGenreProfile } = await import('@actalk/hintos-core')
        const { profile } = await readGenreProfile(this.getRoot(), genre as string)
        return profile.language ?? 'zh'
      }
    } catch { /* fallback */ }
    return 'zh'
  }

  async exportBookEpub(
    bookId: string,
    metadata: Omit<EpubMetadata, 'language'> & { language?: 'zh' | 'en' },
    options: KDPFormatOptions
  ): Promise<Buffer> {
    const chapters = await this.loadChapterIndex(bookId)
    const config = await this.loadBookConfig(bookId)
    const lang = metadata.language ?? await this.resolveLanguage(bookId)

    const epubChapters: EpubChapter[] = []
    for (const ch of chapters) {
      const filename = await this.resolveChapterFilename(bookId, ch.number)
      if (!filename) continue
      try {
        const content = await this.loadChapterContent(bookId, filename)
        epubChapters.push({ number: ch.number, title: ch.title, content })
      } catch { /* skip */ }
    }

    const fullMeta: EpubMetadata = {
      title: metadata.title || config?.title || bookId,
      author: metadata.author || 'Unknown',
      language: lang,
      description: metadata.description,
      keywords: metadata.keywords,
      coverImageBase64: metadata.coverImageBase64,
    }

    return buildEpub(epubChapters, fullMeta, options)
  }

  // ===== 章节大纲 (Plan) =====

  async loadPlanIndex(bookId: string): Promise<PlanIndex> {
    const indexPath = join(this.getRoot(), 'books', bookId, 'plans', 'plan_index.json')
    try {
      const raw = await readFile(indexPath, 'utf-8')
      return JSON.parse(raw) as PlanIndex
    } catch {
      return { plans: [] }
    }
  }

  async savePlanIndex(bookId: string, index: PlanIndex): Promise<void> {
    const plansDir = join(this.getRoot(), 'books', bookId, 'plans')
    await mkdir(plansDir, { recursive: true })
    await writeFile(join(plansDir, 'plan_index.json'), JSON.stringify(index, null, 2), 'utf-8')
  }

  async loadChapterPlan(bookId: string, chapter: number): Promise<string> {
    const padded = String(chapter).padStart(3, '0')
    const planPath = join(this.getRoot(), 'books', bookId, 'plans', `chapter_plan_${padded}.md`)
    try {
      return await readFile(planPath, 'utf-8')
    } catch {
      return ''
    }
  }

  async saveChapterPlan(bookId: string, chapter: number, content: string): Promise<void> {
    const plansDir = join(this.getRoot(), 'books', bookId, 'plans')
    await mkdir(plansDir, { recursive: true })
    const padded = String(chapter).padStart(3, '0')
    await writeFile(join(plansDir, `chapter_plan_${padded}.md`), content, 'utf-8')
  }

  async approvePlan(bookId: string, chapter: number): Promise<void> {
    const index = await this.loadPlanIndex(bookId)
    const entry = index.plans.find((p) => p.chapter === chapter)
    if (!entry) throw new Error(`No plan found for chapter ${chapter}`)
    const now = new Date().toISOString()
    const updated: PlanIndex = {
      plans: index.plans.map((p) =>
        p.chapter === chapter ? { ...p, status: 'approved' as const, approvedAt: now } : p
      )
    }
    await this.savePlanIndex(bookId, updated)
  }

  async rejectPlan(bookId: string, chapter: number, feedback: string): Promise<void> {
    const index = await this.loadPlanIndex(bookId)
    const entry = index.plans.find((p) => p.chapter === chapter)
    if (!entry) throw new Error(`No plan found for chapter ${chapter}`)
    const now = new Date().toISOString()
    const updated: PlanIndex = {
      plans: index.plans.map((p) =>
        p.chapter === chapter ? { ...p, status: 'rejected' as const, rejectedAt: now, feedback } : p
      )
    }
    await this.savePlanIndex(bookId, updated)
  }

  async updatePlanContent(bookId: string, chapter: number, content: string): Promise<void> {
    const index = await this.loadPlanIndex(bookId)
    const entry = index.plans.find((p) => p.chapter === chapter)
    if (!entry) throw new Error(`No plan found for chapter ${chapter}`)
    if (entry.status === 'written') throw new Error(`Chapter ${chapter} plan is already written — cannot edit`)
    await this.saveChapterPlan(bookId, chapter, content)
  }

  getPlanStats(index: PlanIndex): PlanStats {
    const plans = index.plans
    return {
      total: plans.length,
      unplanned: 0,
      pending: plans.filter((p) => p.status === 'pending').length,
      approved: plans.filter((p) => p.status === 'approved').length,
      rejected: plans.filter((p) => p.status === 'rejected').length,
      written: plans.filter((p) => p.status === 'written').length,
    }
  }

  // ===== 操作日志 =====

  async appendOperationLog(bookId: string, event: { type: string; [key: string]: unknown }): Promise<void> {
    const logPath = join(this.getRoot(), 'books', bookId, 'operation_log.jsonl')
    const entry = { ts: new Date().toISOString(), ...event }
    await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf-8')
  }

  async readOperationLog(bookId: string, limit = 100): Promise<Array<Record<string, unknown>>> {
    const logPath = join(this.getRoot(), 'books', bookId, 'operation_log.jsonl')
    try {
      const raw = await readFile(logPath, 'utf-8')
      const lines = raw.trim().split('\n').filter(Boolean)
      return lines.slice(-limit).map((l) => JSON.parse(l))
    } catch {
      return []
    }
  }
}
