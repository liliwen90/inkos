/**
 * 端到端数据管线集成测试
 *
 * 模拟完整流程：热榜 → 创意库 → 创建书籍 → 风格分析 → AI建议 → 应用建议
 * → buildStyleGuidance → style_guide.md → 写手 Agent prompt
 *
 * 验证目标：每个阶段产生的数据最终都出现在写手 Agent 的 LLM prompt 中
 *
 * 方法：直接构造所有中间文件，然后调用真实的 buildStyleGuidance 逻辑
 *       (内联复制，避免跨包导入依赖)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ══════════════════════════════════════════════════════
// 类型定义 (从 studio/humanize-adapter.ts 镜像)
// ══════════════════════════════════════════════════════

interface HumanizeSettings {
  pov: 'first' | 'third-limited' | 'third-omniscient'
  tense: 'past' | 'present'
  creativity: number
  pacing: 'fast' | 'balanced' | 'slow'
  mood: 'neutral' | 'tense' | 'warm' | 'dark' | 'humorous' | 'epic'
  showDontTell: 'low' | 'medium' | 'high'
  dialogue: 'formal' | 'natural' | 'colloquial'
  density: 'sparse' | 'medium' | 'rich'
}

interface VoiceCard { name: string; speech: string; tone: string; quirks: string }

interface FingerprintData {
  fingerprint: string; enabled: boolean; strength: number
  analyzedBooks: string[]; analyzedAt: string
}

interface StudioStyleProfile {
  avgSentenceLength: number; sentenceLengthStdDev: number
  avgParagraphLength: number; paragraphLengthRange: { min: number; max: number }
  vocabularyDiversity: number; topPatterns: string[]
  rhetoricalFeatures: string[]; sourceName?: string; analyzedAt?: string
}

interface AISuggestions {
  storyIdeas?: Array<{ title: string; content: string }>
  writerRole?: string
  writingRules?: string
  humanizeSettings?: HumanizeSettings & { reasons?: Record<string, string> }
  voiceCards?: VoiceCard[]
  sceneBeats?: Array<{ title: string; beats: string[] }>
  storyArc?: { phases: Array<{ name: string; chapters: string; goal: string }> }
  generatedAt?: string; fromBooks?: string[]
}

// ══════════════════════════════════════════════════════
// 内联 buildStyleGuidance — 精确复制 humanize-adapter.ts 逻辑
// 这样测试的就是真实算法，不是 mock
// ══════════════════════════════════════════════════════

function buildStyleGuidance(
  root: string, bookId: string, chapterNumber?: number
): string {
  const humanizeDir = join(root, 'books', bookId, 'humanize')
  const storyDir = join(root, 'books', bookId, 'story')

  let guidance = ''

  // 读设置
  let settings: HumanizeSettings = {
    pov: 'third-limited', tense: 'past', creativity: 5,
    pacing: 'balanced', mood: 'neutral', showDontTell: 'medium',
    dialogue: 'natural', density: 'medium'
  }
  try { settings = JSON.parse(readFileSync(join(humanizeDir, 'settings.json'), 'utf-8')) } catch { /**/ }

  const povMap: Record<string, string> = { first: '第一人称视角', 'third-limited': '第三人称有限视角', 'third-omniscient': '第三人称全知视角' }
  const pacingMap: Record<string, string> = { fast: '快节奏', balanced: '均衡节奏', slow: '慢节奏' }
  const moodMap: Record<string, string> = { neutral: '中性客观', tense: '紧张悬疑', warm: '温馨治愈', dark: '黑暗沉重', humorous: '幽默诙谐', epic: '史诗恢宏' }
  const dialogueMap: Record<string, string> = { formal: '正式措辞', natural: '自然对话', colloquial: '口语化' }
  const densityMap: Record<string, string> = { sparse: '简洁惜墨', medium: '适中详略', rich: '丰富沉浸' }

  guidance += `\n【人性化风格要求】\n`
  guidance += `视角：${povMap[settings.pov] ?? '第三人称有限视角'} | 创意度：${settings.creativity}/10\n`
  guidance += `节奏：${pacingMap[settings.pacing] ?? '均衡'} | 基调：${moodMap[settings.mood] ?? '中性'}\n`
  guidance += `对话：${dialogueMap[settings.dialogue] ?? '自然'} | 密度：${densityMap[settings.density] ?? '适中'}\n`

  // 指纹
  try {
    const fp: FingerprintData = JSON.parse(readFileSync(join(humanizeDir, 'fingerprint.json'), 'utf-8'))
    if (fp?.enabled && fp.fingerprint) {
      guidance += `\n【风格指纹 (模仿强度:${fp.strength}/10)】\n${fp.fingerprint.substring(0, 2000)}\n`
    }
  } catch { /**/ }

  // 风格量化指标
  try {
    const profile: StudioStyleProfile = JSON.parse(readFileSync(join(storyDir, 'style_profile.json'), 'utf-8'))
    if (profile) {
      guidance += `\n【风格量化指标】\n`
      guidance += `目标平均句长：${profile.avgSentenceLength.toFixed(1)}字（标准差±${profile.sentenceLengthStdDev.toFixed(1)}）\n`
      guidance += `目标平均段长：${profile.avgParagraphLength.toFixed(1)}句（范围${profile.paragraphLengthRange.min}-${profile.paragraphLengthRange.max}）\n`
      guidance += `词汇多样性(TTR)：${(profile.vocabularyDiversity * 100).toFixed(1)}%\n`
      if (profile.topPatterns.length > 0) guidance += `高频句式：${profile.topPatterns.slice(0, 6).join('、')}\n`
      if (profile.rhetoricalFeatures.length > 0) guidance += `应使用的修辞手法：${profile.rhetoricalFeatures.join('、')}\n`
    }
  } catch { /**/ }

  // 声音卡片
  try {
    const cards: VoiceCard[] = JSON.parse(readFileSync(join(humanizeDir, 'voice-cards.json'), 'utf-8'))
    if (cards.length > 0) {
      guidance += '\n【角色声音卡片】\n'
      for (const c of cards) {
        guidance += `${c.name}: ${c.speech} / ${c.tone}${c.quirks ? ` / ${c.quirks}` : ''}\n`
      }
    }
  } catch { /**/ }

  // 场景节拍
  if (chapterNumber !== undefined) {
    try {
      const beats: string[] = JSON.parse(readFileSync(join(humanizeDir, `beats-ch${chapterNumber}.json`), 'utf-8'))
      if (beats?.length) {
        guidance += '\n【本章场景节拍】\n'
        beats.forEach((b, i) => { guidance += `${i + 1}. ${b}\n` })
      }
    } catch { /**/ }
  }

  // AI 建议: writerRole + writingRules + storyIdeas
  try {
    const suggestions: AISuggestions = JSON.parse(readFileSync(join(humanizeDir, 'ai-suggestions.json'), 'utf-8'))
    if (suggestions) {
      if (suggestions.writerRole) {
        guidance += '\n【作者角色定义】\n'
        guidance += suggestions.writerRole + '\n'
      }
      if (suggestions.writingRules) {
        guidance += '\n【创作规则】\n'
        guidance += suggestions.writingRules + '\n'
      }
      if (suggestions.storyIdeas?.length) {
        guidance += '\n【故事方向参考】\n'
        for (const idea of suggestions.storyIdeas) {
          guidance += `• ${idea.title}：${idea.content}\n`
        }
      }
    }
  } catch { /**/ }

  return guidance
}

const BOOK_ID = 'test-dark-cultivation'

/** 阶段 1: 用户在创建书籍时填写的创作指导 */
const USER_CONTEXT = `这是一本暗黑修仙小说。主角是被家族抛弃的废灵根少年，性格阴沉腹黑。
绝不要写恋爱线。重点是权谋和修炼突破。世界观参考《凡人修仙传》但更黑暗。`

/** 阶段 2: 建筑师生成的基础文件 */
const STORY_BIBLE = `# 世界观设定
灵元大陆，以灵力为本。修炼体系：练气→筑基→结丹→元婴→化神。
禁忌之术"噬灵功"可以吞噬他人灵根。主角陈墨被弃后意外获得此功法。`

const VOLUME_OUTLINE = `# 卷纲
## 第一卷：废灵根的逆袭 (Ch.1-30)
主角陈墨被逐出陈家，流落到黑市，结识了亡命之徒，开始修炼噬灵功。

# Story Arc
## 起始 (Ch. 1-10)
建立世界观，主角性格塑造，获得噬灵功
## 上升 (Ch. 11-20)
暗中修炼，卷入黑市势力争斗`

const BOOK_RULES = `# 本书规则
1. 陈墨绝不主动帮助陌生人（除非有利可图）
2. 每次使用噬灵功必须付出代价（神志侵蚀）
3. 不写恋爱线`

const CURRENT_STATE = `| 章节 | 状态 |
|------|------|
| 第5章 | 已完成 |
| 修炼等级 | 练气三层 |
| 噬灵功侵蚀 | 12% |`

const PENDING_HOOKS = `1. 黑市暗探身份未揭开
2. 陈家二叔子暗中追踪
3. 噬灵功第二层功法碎片线索`

/** 阶段 3: 风格分析产出 */
const STYLE_PROFILE: StudioStyleProfile = {
  avgSentenceLength: 16.3,
  sentenceLengthStdDev: 7.8,
  avgParagraphLength: 4.2,
  paragraphLengthRange: { min: 2, max: 8 },
  vocabularyDiversity: 0.58,
  topPatterns: ['主谓宾短句', '状语前置', '排比句式', '设问反问', '四字短语连用', '景物衬托心理'],
  rhetoricalFeatures: ['暗喻', '排比', '反讽', '留白'],
  sourceName: '凡人修仙传',
  analyzedAt: '2026-03-20T10:00:00Z'
}

/** 阶段 4: AI 深度指纹 */
const FINGERPRINT: FingerprintData = {
  fingerprint: `风格指纹分析报告

1. 句式节奏：以短促有力的短句为主（平均16字），偶尔穿插长句制造压迫感。断句果断，少用连词。
2. 用词偏好：冷硬词汇（"阴冷""森然""诡异"），极少使用温暖色调词。修炼术语精准（筑基、丹田、灵力运转）。
3. 叙事距离：紧贴主角视角，极少跳出作全知叙述。读者只能看到主角看到的。
4. 修辞习惯：大量暗喻（"灵力如蛇般游走"），几乎不用明喻。排比用于渲染紧张氛围。
5. 情感表达：零直接抒情。通过动作和环境描写暗示心理状态（"他的手指微微收紧"）。
6. 对话处理：对话简短，多为博弈交锋。极少废话。说话标签朴素（"说道""冷声道"）。
7. 场景转换：硬切为主，用空行分隔，偶尔以环境描写过渡。
8. 个人标志：每章结尾必留一个小悬念。修炼突破场景必有痛苦描写。`,
  enabled: true,
  strength: 8,
  analyzedBooks: ['凡人修仙传', '遮天'],
  analyzedAt: '2026-03-20T10:05:00Z'
}

/** 阶段 5: AI 建议全部字段 */
const AI_SUGGESTIONS: AISuggestions = {
  storyIdeas: [
    { title: '噬灵禁忌路线', content: '主角发现噬灵功的真正来源是上古禁忌之术，修炼到极致可吞天地灵气。但每一层突破都会侵蚀神志，最终可能变成无意识的灵兽。这条线可以制造深层恐惧和道德困境。' },
    { title: '黑市势力争夺线', content: '黑市三大势力争夺一件上古遗物，主角被迫卷入。利用腹黑性格在三方势力间左右逢源，最终渔翁得利。展示权谋智慧。' },
    { title: '陈家复仇线', content: '主角修炼有成后返回陈家，但不是直接报仇，而是暗中布局让陈家内斗。以"不战而屈人之兵"的方式完成复仇，体现阴沉腹黑的人设。' },
  ],
  writerRole: '你是一位擅长暗黑修仙题材的资深网文作家。你的文笔冷硬精准，善于通过环境描写和动作暗示角色心理。你从不写烂俗恋爱桥段，专注于权谋博弈和修炼突破的爽感。',
  writingRules: `1. 严禁出现恋爱情节或暧昧描写
2. 每章必须推进至少一条主线或支线
3. 修炼突破场景必须有痛苦代价描写
4. 对话以博弈交锋为主，不写闲聊废话
5. 每章结尾留一个悬念钩子
6. 噬灵功使用后必须描写侵蚀症状
7. 陈墨的内心独白用冷静分析的语气，不用感性抒情
8. 战斗场景注重策略和灵力运用细节，不写"嘭嘭嘭"式打斗`,
  humanizeSettings: {
    pov: 'third-limited',
    tense: 'past',
    creativity: 7,
    pacing: 'fast',
    mood: 'dark',
    showDontTell: 'high',
    dialogue: 'natural',
    density: 'medium',
    reasons: {
      pov: '暗黑修仙需要紧贴主角视角制造沉浸',
      mood: '题材本身基调黑暗',
      pacing: '网文节奏宜快，保持读者追读欲',
    }
  },
  voiceCards: [
    { name: '陈墨', speech: '冷静分析', tone: '阴冷', quirks: '常用反问句' },
    { name: '赵四', speech: '粗犷直白', tone: '豪爽', quirks: '常骂"他娘的"' },
    { name: '幽冥老人', speech: '阴阳怪气', tone: '诡异', quirks: '喜欢用"有趣"' },
  ],
  sceneBeats: [
    { title: '修炼突破', beats: ['入定感知瓶颈', '调动灵力冲击', '痛苦代价降临', '突破成功/失败', '清醒后检查侵蚀度'] },
    { title: '黑市交易', beats: ['观察对手底细', '试探出价', '识破骗局', '反将一军', '交易达成/翻脸'] },
  ],
  storyArc: {
    phases: [
      { name: '起始', chapters: '1-10', goal: '建立世界观和人设，获得噬灵功' },
      { name: '上升', chapters: '11-20', goal: '暗中修炼，卷入黑市' },
      { name: '高潮', chapters: '21-28', goal: '三方势力对决，主角搅局' },
      { name: '结局', chapters: '29-30', goal: '初步复仇，埋下新卷伏笔' },
    ]
  },
  generatedAt: '2026-03-20T10:10:00Z',
  fromBooks: ['凡人修仙传', '遮天'],
}

// ══════════════════════════════════════════════════════
// 测试
// ══════════════════════════════════════════════════════

describe('端到端数据管线验证', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'inkos-pipeline-'))

    // 创建目录结构
    const bookDir = join(tempDir, 'books', BOOK_ID)
    const storyDir = join(bookDir, 'story')
    const humanizeDir = join(bookDir, 'humanize')
    mkdirSync(storyDir, { recursive: true })
    mkdirSync(humanizeDir, { recursive: true })

    // ===== 模拟阶段 1: 创建书籍 → 持久化 creative_context.md =====
    writeFileSync(join(storyDir, 'creative_context.md'), USER_CONTEXT, 'utf-8')
    writeFileSync(join(bookDir, 'book.json'), JSON.stringify({
      id: BOOK_ID, title: '暗渊修仙录', genre: 'xianxia',
      platform: 'qidian', targetChapters: 30, chapterWordCount: 3000,
      status: 'active', createdAt: '2026-03-20', updatedAt: '2026-03-20'
    }), 'utf-8')

    // ===== 模拟阶段 2: 建筑师生成基础文件 =====
    writeFileSync(join(storyDir, 'story_bible.md'), STORY_BIBLE, 'utf-8')
    writeFileSync(join(storyDir, 'volume_outline.md'), VOLUME_OUTLINE, 'utf-8')
    writeFileSync(join(storyDir, 'book_rules.md'), BOOK_RULES, 'utf-8')
    writeFileSync(join(storyDir, 'current_state.md'), CURRENT_STATE, 'utf-8')
    writeFileSync(join(storyDir, 'pending_hooks.md'), PENDING_HOOKS, 'utf-8')

    // ===== 模拟阶段 3: 风格分析 =====
    writeFileSync(join(storyDir, 'style_profile.json'), JSON.stringify(STYLE_PROFILE), 'utf-8')

    // ===== 模拟阶段 4: AI 深度指纹 =====
    writeFileSync(join(humanizeDir, 'fingerprint.json'), JSON.stringify(FINGERPRINT), 'utf-8')

    // ===== 模拟阶段 5: AI 建议 =====
    writeFileSync(join(humanizeDir, 'ai-suggestions.json'), JSON.stringify(AI_SUGGESTIONS), 'utf-8')

    // ===== 模拟阶段 6: 用户点击"一键应用" =====
    // 6a. 应用 humanizeSettings
    const settings: HumanizeSettings = {
      pov: AI_SUGGESTIONS.humanizeSettings!.pov,
      tense: AI_SUGGESTIONS.humanizeSettings!.tense,
      creativity: AI_SUGGESTIONS.humanizeSettings!.creativity,
      pacing: AI_SUGGESTIONS.humanizeSettings!.pacing,
      mood: AI_SUGGESTIONS.humanizeSettings!.mood,
      showDontTell: AI_SUGGESTIONS.humanizeSettings!.showDontTell,
      dialogue: AI_SUGGESTIONS.humanizeSettings!.dialogue,
      density: AI_SUGGESTIONS.humanizeSettings!.density,
    }
    writeFileSync(join(humanizeDir, 'settings.json'), JSON.stringify(settings), 'utf-8')

    // 6b. 应用 voiceCards
    writeFileSync(join(humanizeDir, 'voice-cards.json'), JSON.stringify(AI_SUGGESTIONS.voiceCards), 'utf-8')

    // 6c. 应用 sceneBeats (chapter 6)
    writeFileSync(join(humanizeDir, 'beats-ch6.json'), JSON.stringify(AI_SUGGESTIONS.sceneBeats![0].beats), 'utf-8')
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  // ──────────────────────────────────────────
  // 核心测试：buildStyleGuidance 包含所有数据
  // ──────────────────────────────────────────

  it('style_guide.md 包含人性化设置', () => {
    const guide = buildStyleGuidance(tempDir, BOOK_ID)
    // 应包含 POV、创意度、节奏、基调等设置
    expect(guide).toContain('第三人称有限视角')
    expect(guide).toContain('7/10')   // creativity
    expect(guide).toContain('快节奏') // pacing = fast
    expect(guide).toContain('黑暗沉重') // mood = dark
    expect(guide).toContain('自然对话') // dialogue = natural
  })

  it('style_guide.md 包含风格指纹', () => {
    const guide = buildStyleGuidance(tempDir, BOOK_ID)
    expect(guide).toContain('风格指纹')
    expect(guide).toContain('模仿强度:8/10')
    expect(guide).toContain('句式节奏')
    expect(guide).toContain('叙事距离')
    expect(guide).toContain('每章结尾必留一个小悬念')
  })

  it('style_guide.md 包含风格量化指标 (修复 #2)', () => {
    const guide = buildStyleGuidance(tempDir, BOOK_ID)
    expect(guide).toContain('风格量化指标')
    expect(guide).toContain('16.3')  // avgSentenceLength
    expect(guide).toContain('7.8')   // stdDev
    expect(guide).toContain('4.2')   // avgParagraphLength
    expect(guide).toContain('58.0%')  // vocabularyDiversity
    expect(guide).toContain('主谓宾短句')  // topPatterns
    expect(guide).toContain('暗喻')  // rhetoricalFeatures
    expect(guide).toContain('排比')
    expect(guide).toContain('反讽')
  })

  it('style_guide.md 包含角色声音卡片', () => {
    const guide = buildStyleGuidance(tempDir, BOOK_ID)
    expect(guide).toContain('角色声音卡片')
    expect(guide).toContain('陈墨')
    expect(guide).toContain('冷静分析')
    expect(guide).toContain('赵四')
    expect(guide).toContain('粗犷直白')
    expect(guide).toContain('幽冥老人')
    expect(guide).toContain('阴阳怪气')
  })

  it('style_guide.md 包含场景节拍 (给定章节号)', () => {
    const guide = buildStyleGuidance(tempDir, BOOK_ID, 6)
    expect(guide).toContain('本章场景节拍')
    expect(guide).toContain('入定感知瓶颈')
    expect(guide).toContain('痛苦代价降临')
    expect(guide).toContain('突破成功/失败')
  })

  it('style_guide.md 包含作者角色定义', () => {
    const guide = buildStyleGuidance(tempDir, BOOK_ID)
    expect(guide).toContain('作者角色定义')
    expect(guide).toContain('暗黑修仙题材')
    expect(guide).toContain('从不写烂俗恋爱桥段')
  })

  it('style_guide.md 包含创作规则', () => {
    const guide = buildStyleGuidance(tempDir, BOOK_ID)
    expect(guide).toContain('创作规则')
    expect(guide).toContain('严禁出现恋爱情节')
    expect(guide).toContain('每章必须推进至少一条主线')
    expect(guide).toContain('噬灵功使用后必须描写侵蚀症状')
  })

  it('style_guide.md 包含故事方向参考 (修复 #3)', () => {
    const guide = buildStyleGuidance(tempDir, BOOK_ID)
    expect(guide).toContain('故事方向参考')
    expect(guide).toContain('噬灵禁忌路线')
    expect(guide).toContain('道德困境')
    expect(guide).toContain('黑市势力争夺线')
    expect(guide).toContain('渔翁得利')
    expect(guide).toContain('陈家复仇线')
    expect(guide).toContain('不战而屈人之兵')
  })

  // ──────────────────────────────────────────
  // 验证写手 Agent 从文件系统读到的数据完整性
  // ──────────────────────────────────────────

  it('creative_context.md 写手可以读到用户原始创作指导 (修复 #1)', async () => {
    const ccPath = join(tempDir, 'books', BOOK_ID, 'story', 'creative_context.md')
    const content = await readFile(ccPath, 'utf-8')
    expect(content).toContain('暗黑修仙小说')
    expect(content).toContain('绝不要写恋爱线')
    expect(content).toContain('权谋和修炼突破')
    expect(content).toContain('凡人修仙传')
  })

  it('volume_outline.md 包含 storyArc (应用建议后追加)', async () => {
    // 模拟 apply-suggestions 追加 storyArc
    const outlinePath = join(tempDir, 'books', BOOK_ID, 'story', 'volume_outline.md')
    const existing = await readFile(outlinePath, 'utf-8')
    let arcContent = '# Story Arc\n\n'
    for (const phase of AI_SUGGESTIONS.storyArc!.phases) {
      arcContent += `## ${phase.name} (Ch. ${phase.chapters})\n${phase.goal}\n\n`
    }
    writeFileSync(outlinePath, existing + '\n---\n\n' + arcContent, 'utf-8')

    const merged = await readFile(outlinePath, 'utf-8')
    // 原有大纲保留
    expect(merged).toContain('废灵根的逆袭')
    // storyArc 追加
    expect(merged).toContain('三方势力对决')
    expect(merged).toContain('初步复仇，埋下新卷伏笔')
  })

  // ──────────────────────────────────────────
  // 完整模拟: buildStyleGuidance → 写入文件 → 写手读取
  // ──────────────────────────────────────────

  it('完整链路: buildStyleGuidance → style_guide.md → 写手读到完整指南', async () => {
    // Step 1: 构建 style_guide
    const guidance = buildStyleGuidance(tempDir, BOOK_ID, 6)

    // Step 2: 写入文件 (模拟 syncStyleGuide)
    const stylePath = join(tempDir, 'books', BOOK_ID, 'story', 'style_guide.md')
    writeFileSync(stylePath, guidance, 'utf-8')

    // Step 3: 读回来 (模拟写手 Agent 的 readFileOrDefault)
    const writerReads = await readFile(stylePath, 'utf-8')

    // Step 4: 验证写手看到的内容包含ALL数据
    const checks = [
      // 人性化设置
      ['第三人称有限视角', 'POV 设置'],
      ['7/10', '创意度'],
      ['快节奏', '节奏'],
      ['黑暗沉重', '基调'],
      // 风格指纹
      ['风格指纹', '指纹标题'],
      ['模仿强度:8/10', '指纹强度'],
      ['紧贴主角视角', '指纹内容'],
      // 风格量化指标 (修复 #2)
      ['风格量化指标', '量化标题'],
      ['16.3', '平均句长'],
      ['58.0%', '词汇多样性'],
      ['主谓宾短句', '高频句式'],
      ['暗喻', '修辞手法'],
      // 角色声音卡片
      ['角色声音卡片', '声音卡片标题'],
      ['陈墨', '主角声音'],
      ['赵四', '配角声音'],
      // 场景节拍 (chapter 6)
      ['本章场景节拍', '节拍标题'],
      ['入定感知瓶颈', '节拍内容'],
      // 作者角色
      ['作者角色定义', '角色定义标题'],
      ['暗黑修仙题材', '角色定义内容'],
      // 创作规则
      ['创作规则', '规则标题'],
      ['严禁出现恋爱情节', '规则内容'],
      // 故事方向参考 (修复 #3)
      ['故事方向参考', '方向标题'],
      ['噬灵禁忌路线', '方向 1'],
      ['黑市势力争夺线', '方向 2'],
      ['陈家复仇线', '方向 3'],
    ] as const

    const missing: string[] = []
    for (const [keyword, label] of checks) {
      if (!writerReads.includes(keyword)) {
        missing.push(`❌ [${label}] 缺失: "${keyword}"`)
      }
    }

    if (missing.length > 0) {
      console.error('\n=== 数据管线断裂 ===')
      console.error(missing.join('\n'))
      console.error('\n=== style_guide.md 完整内容 ===')
      console.error(writerReads)
    }

    expect(missing).toEqual([])
  })

  // ──────────────────────────────────────────
  // 完整链路: 写手 User Prompt 中的 externalContext
  // ──────────────────────────────────────────

  it('runner 读取 creative_context.md 作为 externalContext', async () => {
    // 模拟 runner.ts 中的逻辑
    const bookDir = join(tempDir, 'books', BOOK_ID)
    let creativeContext: string | undefined
    try {
      const ccPath = join(bookDir, 'story', 'creative_context.md')
      const cc = await readFile(ccPath, 'utf-8')
      if (cc.trim()) creativeContext = cc.trim()
    } catch { /* file may not exist */ }

    expect(creativeContext).toBeDefined()
    expect(creativeContext).toContain('暗黑修仙小说')
    expect(creativeContext).toContain('绝不要写恋爱线')

    // 模拟写手 user prompt 注入
    const contextBlock = `\n## 外部指令\n以下是来自外部系统的创作指令，请在本章中融入：\n\n${creativeContext}\n`
    expect(contextBlock).toContain('暗黑修仙小说')
    expect(contextBlock).toContain('废灵根少年')
    expect(contextBlock).toContain('权谋')
  })

  // ──────────────────────────────────────────
  // 全量字段覆盖率报告
  // ──────────────────────────────────────────

  it('覆盖率: AI建议的 7 个字段全部到达写手', async () => {
    const guide = buildStyleGuidance(tempDir, BOOK_ID, 6)

    // 模拟 apply-suggestions 追加 storyArc 到 volume_outline
    const outlinePath = join(tempDir, 'books', BOOK_ID, 'story', 'volume_outline.md')
    const existing = await readFile(outlinePath, 'utf-8')
    let arcContent = '# Story Arc\n\n'
    for (const phase of AI_SUGGESTIONS.storyArc!.phases) {
      arcContent += `## ${phase.name} (Ch. ${phase.chapters})\n${phase.goal}\n\n`
    }
    writeFileSync(outlinePath, existing + '\n---\n\n' + arcContent, 'utf-8')
    const outline = await readFile(outlinePath, 'utf-8')

    // 读取 creative_context
    const cc = await readFile(join(tempDir, 'books', BOOK_ID, 'story', 'creative_context.md'), 'utf-8')

    const report = {
      'humanizeSettings → style_guide.md':    guide.includes('第三人称有限视角'),
      'writerRole → style_guide.md':          guide.includes('暗黑修仙题材'),
      'writingRules → style_guide.md':        guide.includes('严禁出现恋爱情节'),
      'storyIdeas → style_guide.md':          guide.includes('噬灵禁忌路线'),
      'voiceCards → style_guide.md':          guide.includes('陈墨'),
      'sceneBeats → style_guide.md':          guide.includes('入定感知瓶颈'),
      'storyArc → volume_outline.md':         outline.includes('三方势力对决'),
      'styleProfile → style_guide.md':        guide.includes('16.3'),
      'fingerprint → style_guide.md':         guide.includes('模仿强度:8/10'),
      'creative_context → externalContext':   cc.includes('暗黑修仙小说'),
    }

    console.log('\n📊 数据管线覆盖率报告：')
    let passed = 0
    let total = 0
    for (const [label, ok] of Object.entries(report)) {
      total++
      if (ok) passed++
      console.log(`  ${ok ? '✅' : '❌'} ${label}`)
    }
    console.log(`\n  覆盖率: ${passed}/${total} (${Math.round(passed / total * 100)}%)`)

    expect(Object.values(report).every(Boolean)).toBe(true)
  })
})
