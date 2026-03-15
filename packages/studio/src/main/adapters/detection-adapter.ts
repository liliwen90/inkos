import { existsSync } from 'fs'
import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { join } from 'path'

// ===== 检测结果类型 =====

export interface AITellResult {
  paragraphUniformity: { score: number; detail: string }
  hedgeDensity: { score: number; detail: string }
  formulaicTransitions: { score: number; detail: string }
  listStructure: { score: number; detail: string }
  overallScore: number
  verdict: string
}

export interface SensitiveWordHit {
  word: string
  category: string
  position: number
  context: string
}

export interface SensitiveWordResult {
  hits: SensitiveWordHit[]
  totalHits: number
  categories: Record<string, number>
}

export interface DetectionRecord {
  chapterNumber: number
  chapterTitle: string
  detectedAt: string
  aiTells: AITellResult
  sensitiveWords: SensitiveWordResult
  overallRisk: 'low' | 'medium' | 'high'
}

/**
 * AIGC检测适配器 — AI痕迹分析/敏感词检测/历史记录
 */
export class DetectionAdapter {
  private projectRoot: string | null = null

  setProjectRoot(root: string): void { this.projectRoot = root }
  private getRoot(): string {
    if (!this.projectRoot) throw new Error('项目路径未设置')
    return this.projectRoot
  }

  private detectionDir(bookId: string): string {
    return join(this.getRoot(), 'books', bookId, 'detection')
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  }

  // ===== AI痕迹分析（纯规则，无需LLM） =====

  async analyzeAITells(content: string): Promise<AITellResult> {
    const { analyzeAITells } = await import('@actalk/inkos-core')
    return analyzeAITells(content)
  }

  // ===== 敏感词检测 =====

  async analyzeSensitiveWords(content: string, customWords?: string[]): Promise<SensitiveWordResult> {
    const { analyzeSensitiveWords } = await import('@actalk/inkos-core')
    return analyzeSensitiveWords(content, customWords)
  }

  // ===== 完整章节检测 =====

  async detectChapter(
    bookId: string,
    chapterNumber: number,
    chapterTitle: string,
    content: string,
    customWords?: string[]
  ): Promise<DetectionRecord> {
    const aiTells = await this.analyzeAITells(content)
    const sensitiveWords = await this.analyzeSensitiveWords(content, customWords)

    let risk: 'low' | 'medium' | 'high' = 'low'
    if (aiTells.overallScore >= 7 || sensitiveWords.totalHits >= 5) risk = 'high'
    else if (aiTells.overallScore >= 4 || sensitiveWords.totalHits >= 2) risk = 'medium'

    const record: DetectionRecord = {
      chapterNumber, chapterTitle,
      detectedAt: new Date().toISOString(),
      aiTells, sensitiveWords, overallRisk: risk
    }

    // 保存到检测历史
    const dir = this.detectionDir(bookId)
    await this.ensureDir(dir)
    await writeFile(
      join(dir, `ch${chapterNumber}.json`),
      JSON.stringify(record, null, 2), 'utf-8'
    )

    return record
  }

  // ===== 检测历史 =====

  async loadDetectionHistory(bookId: string): Promise<DetectionRecord[]> {
    const dir = this.detectionDir(bookId)
    if (!existsSync(dir)) return []
    const files = (await readdir(dir)).filter(f => f.startsWith('ch') && f.endsWith('.json'))
    const records: DetectionRecord[] = []
    for (const f of files) {
      try {
        const data = JSON.parse(await readFile(join(dir, f), 'utf-8'))
        records.push(data)
      } catch { /* skip corrupted */ }
    }
    return records.sort((a, b) => a.chapterNumber - b.chapterNumber)
  }

  async loadDetectionRecord(bookId: string, chapterNumber: number): Promise<DetectionRecord | null> {
    const p = join(this.detectionDir(bookId), `ch${chapterNumber}.json`)
    try {
      if (existsSync(p)) return JSON.parse(await readFile(p, 'utf-8'))
    } catch { /* */ }
    return null
  }
}
