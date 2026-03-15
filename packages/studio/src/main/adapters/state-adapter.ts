import { existsSync } from 'fs'
import { readFile, readdir, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { BookConfig, ChapterMeta } from '@actalk/inkos-core'

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
    return existsSync(join(dirPath, 'inkos.json'))
  }

  // ===== 项目配置 =====

  async loadProjectConfig(): Promise<Record<string, unknown> | null> {
    const configPath = join(this.getRoot(), 'inkos.json')
    if (!existsSync(configPath)) return null
    return JSON.parse(await readFile(configPath, 'utf-8'))
  }

  async saveProjectConfig(config: Record<string, unknown>): Promise<void> {
    await writeFile(
      join(this.getRoot(), 'inkos.json'),
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
      name: (config.name as string) ?? 'InkOS项目',
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
      '# InkOS LLM 配置 (由 InkOS Studio 管理)',
      ...Object.entries(values).map(([k, v]) => `${k}=${v}`)
    ]
    await writeFile(join(this.getRoot(), '.env'), lines.join('\n'), 'utf-8')
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
    await writeFile(join(dirPath, 'inkos.json'), JSON.stringify(config, null, 2), 'utf-8')
    await writeFile(join(dirPath, '.env'), [
      '# InkOS LLM 配置',
      'INKOS_LLM_PROVIDER=openai',
      'INKOS_LLM_BASE_URL=https://api.openai.com/v1',
      'INKOS_LLM_API_KEY=your-api-key-here',
      'INKOS_LLM_MODEL=gpt-4o'
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

  // ===== 章节管理 =====

  async loadChapterIndex(bookId: string): Promise<ChapterMeta[]> {
    const indexPath = join(this.getRoot(), 'books', bookId, 'chapters', 'index.json')
    if (!existsSync(indexPath)) return []
    return JSON.parse(await readFile(indexPath, 'utf-8'))
  }

  async loadChapterContent(bookId: string, filename: string): Promise<string> {
    return readFile(join(this.getRoot(), 'books', bookId, 'chapters', filename), 'utf-8')
  }

  async updateChapterStatus(bookId: string, chapterNumber: number, status: string, reviewNote?: string): Promise<void> {
    const indexPath = join(this.getRoot(), 'books', bookId, 'chapters', 'index.json')
    if (!existsSync(indexPath)) throw new Error('章节索引不存在')
    const chapters: ChapterMeta[] = JSON.parse(await readFile(indexPath, 'utf-8'))
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
      const filename = `${String(ch.number).padStart(4, '0')}_${ch.title?.replace(/[/\\:*?"<>|]/g, '_') ?? ''}.md`
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
}
