import { existsSync } from 'fs'
import { readFile, writeFile, readdir, mkdir, copyFile, unlink } from 'fs/promises'
import { join, basename } from 'path'
import type { LLMClient } from '@actalk/inkos-core'

// Studio 用自己的 StyleProfile（从 core 的 StyleProfile 转换而来）
export interface StudioStyleProfile {
  avgSentenceLength: number
  sentenceLengthStdDev: number
  avgParagraphLength: number
  paragraphLengthRange: { min: number; max: number }
  vocabularyDiversity: number
  topPatterns: string[]
  rhetoricalFeatures: string[]
  sourceName?: string
  analyzedAt?: string
}

// ===== 人性化设置类型 =====

export interface HumanizeSettings {
  pov: 'first' | 'third-limited' | 'third-omniscient'
  tense: 'past' | 'present'
  creativity: number
  pacing: 'fast' | 'balanced' | 'slow'
  mood: 'neutral' | 'tense' | 'warm' | 'dark' | 'humorous' | 'epic'
  showDontTell: 'low' | 'medium' | 'high'
  dialogue: 'formal' | 'natural' | 'colloquial'
  density: 'sparse' | 'medium' | 'rich'
}

export interface VoiceCard {
  name: string
  speech: string
  tone: string
  quirks: string
}

export interface FingerprintData {
  fingerprint: string
  enabled: boolean
  strength: number
  analyzedBooks: string[]
  analyzedAt: string
}

export interface AISuggestions {
  storyIdeas?: Array<{ title: string; content: string }>
  writerRole?: string
  writingRules?: string
  humanizeSettings?: HumanizeSettings & { reasons?: Record<string, string> }
  voiceCards?: VoiceCard[]
  characterState?: Record<string, unknown>
  worldBible?: Record<string, unknown>
  sceneBeats?: Array<{ title: string; beats: string[] }>
  storyArc?: { phases: Array<{ name: string; chapters: string; goal: string }> }
  generatedAt?: string
  fromBooks?: string[]
  parseError?: boolean
  raw?: string
}

const DEFAULT_SETTINGS: HumanizeSettings = {
  pov: 'third-limited', tense: 'past', creativity: 5,
  pacing: 'balanced', mood: 'neutral', showDontTell: 'medium',
  dialogue: 'natural', density: 'medium'
}

/**
 * 人性化引擎适配器 — 风格分析/声音卡片/场景节拍/指纹/AI建议
 */
export class HumanizeAdapter {
  private projectRoot: string | null = null

  setProjectRoot(root: string): void { this.projectRoot = root }
  private getRoot(): string {
    if (!this.projectRoot) throw new Error('项目路径未设置')
    return this.projectRoot
  }

  private bookDataDir(bookId: string): string {
    return join(this.getRoot(), 'books', bookId, 'story')
  }

  private bookConfigDir(bookId: string): string {
    return join(this.getRoot(), 'books', bookId, 'humanize')
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
        const { readGenreProfile } = await import('@actalk/inkos-core')
        const { profile } = await readGenreProfile(this.getRoot(), genre)
        return profile.language ?? 'zh'
      }
    } catch { /* fallback to zh */ }
    return 'zh'
  }

  // ===== 人性化设置 =====

  async loadSettings(bookId: string): Promise<HumanizeSettings> {
    const p = join(this.bookConfigDir(bookId), 'settings.json')
    try {
      if (existsSync(p)) return JSON.parse(await readFile(p, 'utf-8'))
    } catch { /* */ }
    return { ...DEFAULT_SETTINGS }
  }

  async saveSettings(bookId: string, settings: HumanizeSettings): Promise<void> {
    const dir = this.bookConfigDir(bookId)
    await this.ensureDir(dir)
    await writeFile(join(dir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8')
  }

  // ===== 声音卡片 =====

  async loadVoiceCards(bookId: string): Promise<VoiceCard[]> {
    const p = join(this.bookConfigDir(bookId), 'voice-cards.json')
    try {
      if (existsSync(p)) return JSON.parse(await readFile(p, 'utf-8'))
    } catch { /* */ }
    return []
  }

  async saveVoiceCards(bookId: string, cards: VoiceCard[]): Promise<void> {
    const dir = this.bookConfigDir(bookId)
    await this.ensureDir(dir)
    await writeFile(join(dir, 'voice-cards.json'), JSON.stringify(cards, null, 2), 'utf-8')
  }

  // ===== 场景节拍 =====

  async loadSceneBeats(bookId: string, chapterNumber: number): Promise<string[] | null> {
    const p = join(this.bookConfigDir(bookId), `beats-ch${chapterNumber}.json`)
    try {
      if (existsSync(p)) return JSON.parse(await readFile(p, 'utf-8'))
    } catch { /* */ }
    return null
  }

  async saveSceneBeats(bookId: string, chapterNumber: number, beats: string[]): Promise<void> {
    const dir = this.bookConfigDir(bookId)
    await this.ensureDir(dir)
    await writeFile(join(dir, `beats-ch${chapterNumber}.json`), JSON.stringify(beats, null, 2), 'utf-8')
  }

  // ===== 风格指纹 =====

  async loadFingerprint(bookId: string): Promise<FingerprintData | null> {
    const p = join(this.bookConfigDir(bookId), 'fingerprint.json')
    try {
      if (existsSync(p)) return JSON.parse(await readFile(p, 'utf-8'))
    } catch { /* */ }
    return null
  }

  async saveFingerprint(bookId: string, data: FingerprintData): Promise<void> {
    const dir = this.bookConfigDir(bookId)
    await this.ensureDir(dir)
    await writeFile(join(dir, 'fingerprint.json'), JSON.stringify(data, null, 2), 'utf-8')
  }

  // ===== 风格参考书管理 =====

  async listStyleBooks(bookId: string): Promise<string[]> {
    const dir = join(this.bookConfigDir(bookId), 'style-books')
    if (!existsSync(dir)) return []
    const files = await readdir(dir)
    return files.filter(f => f.endsWith('.txt'))
  }

  async addStyleBook(bookId: string, sourcePath: string): Promise<string> {
    const dir = join(this.bookConfigDir(bookId), 'style-books')
    await this.ensureDir(dir)
    const name = basename(sourcePath)
    await copyFile(sourcePath, join(dir, name))
    return name
  }

  async removeStyleBook(bookId: string, fileName: string): Promise<void> {
    const p = join(this.bookConfigDir(bookId), 'style-books', fileName)
    if (existsSync(p)) await unlink(p)
  }

  // ===== 风格分析（纯文本统计，用 core 的 analyzeStyle） =====

  async analyzeStyleFromBooks(bookId: string): Promise<StudioStyleProfile | null> {
    const { analyzeStyle } = await import('@actalk/inkos-core')
    const dir = join(this.bookConfigDir(bookId), 'style-books')
    if (!existsSync(dir)) return null
    const files = (await readdir(dir)).filter(f => f.endsWith('.txt'))
    if (files.length === 0) return null

    let allText = ''
    for (const f of files) {
      const content = await readFile(join(dir, f), 'utf-8')
      allText += content.substring(0, 10000) + '\n'
    }

    const coreProfile = analyzeStyle(allText, files.join(', '))
    // Core StyleProfile 与 Studio StudioStyleProfile 结构一致，直接序列化
    const profile: StudioStyleProfile = {
      avgSentenceLength: coreProfile.avgSentenceLength,
      sentenceLengthStdDev: coreProfile.sentenceLengthStdDev,
      avgParagraphLength: coreProfile.avgParagraphLength,
      paragraphLengthRange: { ...coreProfile.paragraphLengthRange },
      vocabularyDiversity: coreProfile.vocabularyDiversity,
      topPatterns: [...coreProfile.topPatterns],
      rhetoricalFeatures: [...coreProfile.rhetoricalFeatures],
      sourceName: coreProfile.sourceName,
      analyzedAt: coreProfile.analyzedAt
    }
    // 保存到 story/style_profile.json（core 读的位置）
    const storyDir = this.bookDataDir(bookId)
    await this.ensureDir(storyDir)
    await writeFile(join(storyDir, 'style_profile.json'), JSON.stringify(profile, null, 2), 'utf-8')
    return profile
  }

  async loadStyleProfile(bookId: string): Promise<StudioStyleProfile | null> {
    const p = join(this.bookDataDir(bookId), 'style_profile.json')
    try {
      if (existsSync(p)) return JSON.parse(await readFile(p, 'utf-8'))
    } catch { /* */ }
    return null
  }

  // ===== 深度风格指纹分析（LLM驱动） =====

  async analyzeDeepFingerprint(
    bookId: string,
    client: LLMClient,
    model: string,
    onProgress?: (msg: string, pct: number) => void
  ): Promise<FingerprintData> {
    const { chatCompletion } = await import('@actalk/inkos-core')
    const lang = await this.resolveLanguage(bookId)
    const en = lang === 'en'
    const dir = join(this.bookConfigDir(bookId), 'style-books')
    if (!existsSync(dir)) throw new Error(en ? 'No style reference books imported' : '没有导入风格参考书')
    const files = (await readdir(dir)).filter(f => f.endsWith('.txt'))
    if (files.length === 0) throw new Error(en ? 'No style reference books imported' : '没有导入风格参考书')

    onProgress?.(en ? 'Sampling text...' : '采样文本...', 10)
    let samples = ''
    for (const f of files) {
      const content = await readFile(join(dir, f), 'utf-8')
      const len = content.length
      if (len < 500) continue
      const sampleLen = Math.min(1500, Math.floor(len / 3))
      const bookName = f.replace('.txt', '')
      samples += en
        ? `\n--- From "${bookName}" ---\n`
        : `\n--- 来自《${bookName}》---\n`
      samples += en
        ? `[Opening]\n${content.substring(0, sampleLen)}\n`
        : `【开头】\n${content.substring(0, sampleLen)}\n`
      samples += en
        ? `[Middle]\n${content.substring(Math.floor(len / 2) - sampleLen / 2, Math.floor(len / 2) + sampleLen / 2)}\n`
        : `【中间】\n${content.substring(Math.floor(len / 2) - sampleLen / 2, Math.floor(len / 2) + sampleLen / 2)}\n`
      samples += en
        ? `[Ending]\n${content.substring(len - sampleLen)}\n`
        : `【结尾】\n${content.substring(len - sampleLen)}\n`
    }

    onProgress?.(en ? 'AI deep style analysis...' : 'AI深度分析风格...', 40)

    const systemContent = en
      ? 'You are a senior literary style analyst. Analyze the given text\'s writing style characteristics in detail. Respond in English.'
      : '你是一位资深的文学风格分析专家。请用中文详细分析给定文本的写作风格特征。'

    const userContent = en
      ? `Perform a deep analysis of the following novel samples and extract a precise "style fingerprint".

Analysis dimensions:
1. Sentence rhythm (long/short sentence ratio, punctuation habits)
2. Vocabulary preferences (common words, register level, colloquial vs formal)
3. Narrative distance (close POV vs wide-angle omniscient)
4. Rhetorical habits (metaphor, parallelism, hyperbole tendencies)
5. Emotional expression (direct emoting vs environment-as-mood vs action-implies-feeling)
6. Dialogue handling (dialogue proportion, dialogue tag habits, colloquial level)
7. Scene transitions (hard cuts vs transitions vs montage)
8. Unique markers (author's signature techniques, distinctive expressions)

Output a detailed style fingerprint report.

${samples}`
      : `请深度分析以下多本小说的文风特征，提炼出精准的"风格指纹"。

分析维度：
1. 句式节奏（长短句比例、断句习惯）
2. 用词偏好（常用词汇、文化程度、口语vs书面）
3. 叙事距离（紧贴角色 vs 远景俯瞰）
4. 修辞习惯（比喻、排比、夸张的使用倾向）
5. 情感表达方式（直接抒情 vs 景物寄情 vs 动作暗示）
6. 对话处理（对话占比、说话标签习惯、口语程度）
7. 场景转换方式（硬切 vs 过渡 vs 蒙太奇）
8. 独特标志（作者的个人特色手法、独特expression）

请输出一份详细的风格指纹报告。

${samples}`

    const res = await chatCompletion(client, model, [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent }
    ], { maxTokens: 4096 })

    onProgress?.(en ? 'Saving fingerprint...' : '保存指纹...', 90)
    const data: FingerprintData = {
      fingerprint: res.content,
      enabled: true,
      strength: 7,
      analyzedBooks: files.map(f => f.replace('.txt', '')),
      analyzedAt: new Date().toISOString()
    }
    await this.saveFingerprint(bookId, data)
    onProgress?.('完成', 100)
    return data
  }

  // ===== AI 内容建议系统（LLM驱动） =====

  async generateSuggestions(
    bookId: string,
    client: LLMClient,
    model: string,
    onProgress?: (msg: string, pct: number) => void
  ): Promise<AISuggestions> {
    const { chatCompletion } = await import('@actalk/inkos-core')
    const lang = await this.resolveLanguage(bookId)
    const en = lang === 'en'
    const dir = join(this.bookConfigDir(bookId), 'style-books')
    if (!existsSync(dir)) throw new Error(en ? 'No style reference books imported' : '没有导入风格参考书')
    const files = (await readdir(dir)).filter(f => f.endsWith('.txt'))
    if (files.length === 0) throw new Error(en ? 'No style reference books imported' : '没有导入风格参考书')

    onProgress?.(en ? 'Sampling text...' : '采样文本...', 10)
    let samples = ''
    for (const f of files) {
      const content = await readFile(join(dir, f), 'utf-8')
      const len = content.length
      if (len < 500) continue
      const sampleLen = Math.min(2000, Math.floor(len / 3))
      const bookName = f.replace('.txt', '')
      samples += en
        ? `\n--- From "${bookName}" ---\n`
        : `\n--- 来自《${bookName}》---\n`
      samples += en
        ? `[Opening]\n${content.substring(0, sampleLen)}\n`
        : `【开头】\n${content.substring(0, sampleLen)}\n`
      samples += en
        ? `[Middle]\n${content.substring(Math.floor(len / 2) - sampleLen / 2, Math.floor(len / 2) + sampleLen / 2)}\n`
        : `【中间】\n${content.substring(Math.floor(len / 2) - sampleLen / 2, Math.floor(len / 2) + sampleLen / 2)}\n`
      samples += en
        ? `[Ending]\n${content.substring(len - sampleLen)}\n`
        : `【结尾】\n${content.substring(len - sampleLen)}\n`
    }

    onProgress?.(en ? 'AI generating comprehensive suggestions...' : 'AI正在生成全方位建议...', 30)

    const systemContent = en
      ? 'You are a senior novel writing consultant. Output content suggestions strictly in the required JSON format. Do not output any text outside the JSON.'
      : '你是一位精通各类型小说创作的资深顾问。请严格按要求的JSON格式输出内容建议，不要输出任何JSON以外的文字。'

    const userContent = en
      ? `Based on the following novel samples, generate comprehensive creative suggestions. Output strictly in JSON format:

{
  "storyIdeas": [{"title":"Idea 1","content":"200-word description"},{"title":"Idea 2","content":"description"},{"title":"Idea 3","content":"description"}],
  "writerRole": "Author role definition (200 words)",
  "writingRules": "Writing rules (300 words)",
  "humanizeSettings": {"pov":"third-limited","tense":"past","creativity":5,"pacing":"balanced","mood":"neutral","showDontTell":"medium","dialogue":"natural","density":"medium","reasons":{"pov":"reason","tense":"reason","pacing":"reason","mood":"reason","dialogue":"reason","density":"reason"}},
  "voiceCards": [{"name":"Character Type","speech":"Speaking style","tone":"Tone","quirks":"Speech quirks"}],
  "sceneBeats": [{"title":"Beat Template Name","beats":["Beat 1","Beat 2","Beat 3","Beat 4"]}],
  "storyArc": {"phases":[{"name":"Phase","chapters":"1-N","goal":"Goal"}]}
}

Novel samples:
${samples}`
      : `基于以下小说样本，生成完整的创作建议。严格按JSON格式输出：

{
  "storyIdeas": [{"title":"创意1","content":"200字描述"},{"title":"创意2","content":"描述"},{"title":"创意3","content":"描述"}],
  "writerRole": "作者角色定义(200字)",
  "writingRules": "创作规则(300字)",
  "humanizeSettings": {"pov":"third-limited","tense":"past","creativity":5,"pacing":"balanced","mood":"neutral","showDontTell":"medium","dialogue":"natural","density":"medium","reasons":{"pov":"原因","tense":"原因","pacing":"原因","mood":"原因","dialogue":"原因","density":"原因"}},
  "voiceCards": [{"name":"角色类型","speech":"说话风格","tone":"语调","quirks":"口癖"}],
  "sceneBeats": [{"title":"节拍模板名","beats":["节拍1","节拍2","节拍3","节拍4"]}],
  "storyArc": {"phases":[{"name":"阶段","chapters":"1-N","goal":"目标"}]}
}

小说样本：
${samples}`

    const res = await chatCompletion(client, model, [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent }
    ], { maxTokens: 4096 })

    onProgress?.('解析建议...', 85)
    let suggestions: AISuggestions = {}
    try {
      const jsonMatch = res.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) suggestions = JSON.parse(jsonMatch[0])
    } catch {
      suggestions = { raw: res.content, parseError: true }
    }

    suggestions.generatedAt = new Date().toISOString()
    suggestions.fromBooks = files.map(f => f.replace('.txt', ''))

    const configDir = this.bookConfigDir(bookId)
    await this.ensureDir(configDir)
    await writeFile(join(configDir, 'ai-suggestions.json'), JSON.stringify(suggestions, null, 2), 'utf-8')
    onProgress?.('完成', 100)
    return suggestions
  }

  async loadSuggestions(bookId: string): Promise<AISuggestions | null> {
    const p = join(this.bookConfigDir(bookId), 'ai-suggestions.json')
    try {
      if (existsSync(p)) return JSON.parse(await readFile(p, 'utf-8'))
    } catch { /* */ }
    return null
  }

  // ===== 构建写手prompt注入的风格指导文本 =====

  async buildStyleGuidance(bookId: string, chapterNumber?: number): Promise<string> {
    let guidance = ''
    const settings = await this.loadSettings(bookId)
    const lang = await this.resolveLanguage(bookId)
    const en = lang === 'en'

    const povMap: Record<string, string> = en
      ? { first: 'First Person', 'third-limited': 'Third Person Limited', 'third-omniscient': 'Third Person Omniscient' }
      : { first: '第一人称视角', 'third-limited': '第三人称有限视角', 'third-omniscient': '第三人称全知视角' }
    const pacingMap: Record<string, string> = en
      ? { fast: 'Fast-paced', balanced: 'Balanced', slow: 'Slow-burn' }
      : { fast: '快节奏', balanced: '均衡节奏', slow: '慢节奏' }
    const moodMap: Record<string, string> = en
      ? { neutral: 'Neutral/Objective', tense: 'Tense/Suspenseful', warm: 'Warm/Cozy', dark: 'Dark/Gritty', humorous: 'Humorous/Witty', epic: 'Epic/Grand' }
      : { neutral: '中性客观', tense: '紧张悬疑', warm: '温馨治愈', dark: '黑暗沉重', humorous: '幽默诙谐', epic: '史诗恢宏' }
    const dialogueMap: Record<string, string> = en
      ? { formal: 'Formal speech', natural: 'Natural dialogue', colloquial: 'Colloquial/Slangy' }
      : { formal: '正式措辞', natural: '自然对话', colloquial: '口语化' }
    const densityMap: Record<string, string> = en
      ? { sparse: 'Sparse/Lean prose', medium: 'Balanced detail', rich: 'Rich/Immersive' }
      : { sparse: '简洁惜墨', medium: '适中详略', rich: '丰富沉浸' }

    const defaultPov = en ? 'Third Person Limited' : '第三人称有限视角'
    const defaultMood = en ? 'Neutral/Objective' : '中性'
    const defaultDialogue = en ? 'Natural dialogue' : '自然'
    const defaultDensity = en ? 'Balanced detail' : '适中'

    if (en) {
      guidance += `\n[Humanization Style Requirements]\n`
      guidance += `POV: ${povMap[settings.pov] ?? defaultPov} | Creativity: ${settings.creativity}/10\n`
      guidance += `Pacing: ${pacingMap[settings.pacing] ?? 'Balanced'} | Mood: ${moodMap[settings.mood] ?? defaultMood}\n`
      guidance += `Dialogue: ${dialogueMap[settings.dialogue] ?? defaultDialogue} | Density: ${densityMap[settings.density] ?? defaultDensity}\n`
    } else {
      guidance += `\n【人性化风格要求】\n`
      guidance += `视角：${povMap[settings.pov] ?? defaultPov} | 创意度：${settings.creativity}/10\n`
      guidance += `节奏：${pacingMap[settings.pacing] ?? '均衡'} | 基调：${moodMap[settings.mood] ?? defaultMood}\n`
      guidance += `对话：${dialogueMap[settings.dialogue] ?? defaultDialogue} | 密度：${densityMap[settings.density] ?? defaultDensity}\n`
    }

    // 指纹
    const fp = await this.loadFingerprint(bookId)
    if (fp?.enabled && fp.fingerprint) {
      guidance += en
        ? `\n[Style Fingerprint (imitation strength: ${fp.strength}/10)]\n${fp.fingerprint.substring(0, 2000)}\n`
        : `\n【风格指纹 (模仿强度:${fp.strength}/10)】\n${fp.fingerprint.substring(0, 2000)}\n`
    }

    // 声音卡片
    const cards = await this.loadVoiceCards(bookId)
    if (cards.length > 0) {
      guidance += en ? '\n[Character Voice Cards]\n' : '\n【角色声音卡片】\n'
      for (const c of cards) {
        guidance += `${c.name}: ${c.speech} / ${c.tone}${c.quirks ? ` / ${c.quirks}` : ''}\n`
      }
    }

    // 场景节拍
    if (chapterNumber !== undefined) {
      const beats = await this.loadSceneBeats(bookId, chapterNumber)
      if (beats?.length) {
        guidance += en ? '\n[Scene Beats for This Chapter]\n' : '\n【本章场景节拍】\n'
        beats.forEach((b, i) => { guidance += `${i + 1}. ${b}\n` })
      }
    }

    return guidance
  }
}
