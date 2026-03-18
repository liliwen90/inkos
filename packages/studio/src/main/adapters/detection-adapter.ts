import { existsSync } from 'fs'
import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { join } from 'path'

// ===== Studio 检测结果类型（前端使用） =====

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
  count: number
  severity: string
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

// ===== Core → Studio 数据转换 =====

// Core 的 analyzeAITells 返回 { issues: Array<{severity, category, description, suggestion}> }
// 4个 category: "段落等长"(20), "套话密度"(21), "公式化转折"(22), "列表式结构"(23)
type AITellDimKey = keyof Pick<AITellResult, 'paragraphUniformity' | 'hedgeDensity' | 'formulaicTransitions' | 'listStructure'>
const CATEGORY_MAP: Record<string, AITellDimKey> = {
  '段落等长': 'paragraphUniformity',
  '套话密度': 'hedgeDensity',
  '公式化转折': 'formulaicTransitions',
  '列表式结构': 'listStructure',
  // English category names (when language='en')
  'Uniform Paragraph Length': 'paragraphUniformity',
  'Cliché Density': 'hedgeDensity',
  'Formulaic Transitions': 'formulaicTransitions',
  'List-Style Structure': 'listStructure'
}

function transformAITells(coreResult: { issues: ReadonlyArray<{ severity: string; category: string; description: string; suggestion: string }> }): AITellResult {
  const dims: AITellResult = {
    paragraphUniformity: { score: 0, detail: '未检出' },
    hedgeDensity: { score: 0, detail: '未检出' },
    formulaicTransitions: { score: 0, detail: '未检出' },
    listStructure: { score: 0, detail: '未检出' },
    overallScore: 0,
    verdict: '未检出AI痕迹'
  }

  for (const issue of coreResult.issues) {
    const key = CATEGORY_MAP[issue.category]
    if (key) {
      const score = issue.severity === 'warning' ? 7 : 3
      dims[key] = { score, detail: issue.description }
    }
  }

  // 加权平均
  const scores = [dims.paragraphUniformity.score, dims.hedgeDensity.score, dims.formulaicTransitions.score, dims.listStructure.score]
  dims.overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10

  if (dims.overallScore >= 7) dims.verdict = 'AI特征明显，建议深度改写'
  else if (dims.overallScore >= 4) dims.verdict = 'AI痕迹中等，建议局部润色'
  else if (dims.overallScore > 0) dims.verdict = '轻微AI痕迹，可接受'
  else dims.verdict = '未检出AI痕迹'

  return dims
}

// Core 的 analyzeSensitiveWords 返回 { issues: AuditIssue[], found: Array<{word, count, severity}> }
function transformSensitiveWords(coreResult: { issues: ReadonlyArray<unknown>; found: ReadonlyArray<{ word: string; count: number; severity: string }> }): SensitiveWordResult {
  const hits: SensitiveWordHit[] = []
  const categories: Record<string, number> = {}
  let totalHits = 0

  for (const match of coreResult.found) {
    const category = match.severity === 'block' ? '严重' : '警告'
    hits.push({ word: match.word, category, count: match.count, severity: match.severity })
    totalHits += match.count
    categories[category] = (categories[category] ?? 0) + match.count
  }

  return { hits, totalHits, categories }
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

  /** 从 bookId 解析语言：读 book.json → genre → readGenreProfile → language */
  private async resolveLanguage(bookId: string): Promise<'zh' | 'en'> {
    try {
      const bookJsonPath = join(this.getRoot(), 'books', bookId, 'book.json')
      const bookConfig = JSON.parse(await readFile(bookJsonPath, 'utf-8'))
      const genre: string = bookConfig?.genre
      if (genre) {
        const { readGenreProfile } = await import('@actalk/hintos-core')
        const { profile } = await readGenreProfile(this.getRoot(), genre)
        return profile.language ?? 'zh'
      }
    } catch { /* fallback to zh */ }
    return 'zh'
  }

  // ===== AI痕迹分析（纯规则，无需LLM） =====

  async analyzeAITells(content: string, language?: 'zh' | 'en'): Promise<AITellResult> {
    const { analyzeAITells } = await import('@actalk/hintos-core')
    const coreResult = analyzeAITells(content, language)
    return transformAITells(coreResult)
  }

  // ===== 敏感词检测 =====

  async analyzeSensitiveWords(content: string, customWords?: string[]): Promise<SensitiveWordResult> {
    const { analyzeSensitiveWords } = await import('@actalk/hintos-core')
    const coreResult = analyzeSensitiveWords(content, customWords)
    return transformSensitiveWords(coreResult)
  }

  // ===== 完整章节检测 =====

  async detectChapter(
    bookId: string,
    chapterNumber: number,
    chapterTitle: string,
    content: string,
    customWords?: string[]
  ): Promise<DetectionRecord> {
    const language = await this.resolveLanguage(bookId)
    const aiTells = await this.analyzeAITells(content, language)
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
