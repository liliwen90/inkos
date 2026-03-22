import { Send } from 'lucide-react'

/** 题材关键词 → genre key 映射 */
const GENRE_KEYWORDS: Record<string, string> = {
  '玄幻': 'xuanhuan', '仙侠': 'xianxia', '武侠': 'wuxia', '奇幻': 'qihuan',
  '都市': 'urban', '言情': 'yanqing', '现实': 'xianshi',
  '历史': 'lishi', '军事': 'junshi', '科幻': 'kehuan',
  '悬疑': 'xuanyi', '恐怖': 'horror', '灵异': 'lingyi',
  '游戏': 'youxi', '体育': 'tiyu', '二次元': 'erciyuan',
  '穿越': 'chuanyue', '重生': 'chongsheng', '末世': 'moshi',
  '无限流': 'wuxianliu', '诸天': 'zhutian',
  '同人': 'tongren', '短篇': 'duanpian',
  '系统流': 'xitong', '种田文': 'zhongtian', '规则怪谈': 'guize',
  'LitRPG': 'litrpg', 'System Apocalypse': 'system-apocalypse',
  '通用': 'other',
  // English genres
  'Progression Fantasy': 'progression-fantasy',
  'Cultivation': 'cultivation',
  'GameLit': 'gamelit',
  'Isekai': 'isekai', 'Portal Fantasy': 'isekai',
  'Dungeon Core': 'dungeon-core',
  'Epic Fantasy': 'epic-fantasy',
  'Urban Fantasy': 'urban-fantasy',
  'Cozy Fantasy': 'cozy-fantasy',
  'Sci-Fi': 'scifi', 'Space Opera': 'scifi', 'Science Fiction': 'scifi',
  'Horror': 'en-horror', 'Cosmic Horror': 'en-horror',
  'Post-Apocalyptic': 'apocalypse', 'Post Apocalyptic': 'apocalypse',
}

const PLATFORM_KEYWORDS: Record<string, string> = {
  '七猫': 'qimao', '番茄': 'tomato', '起点': 'qidian', '飞卢': 'feilu',
  'Royal Road': 'royalroad', 'RoyalRoad': 'royalroad',
  'Kindle': 'kindle', 'KU': 'kindle', 'Kindle/KU': 'kindle', 'Kindle Unlimited': 'kindle',
  'Patreon': 'patreon',
  'ScribbleHub': 'scribblehub', 'Scribble Hub': 'scribblehub',
  'Wattpad': 'wattpad',
  '其他': 'other', 'Other': 'other',
}

export interface ParsedIdea {
  title: string
  genre: string
  platform: string
  targetChapters: number
  chapterWords: number
  context: string
  language: 'zh' | 'en'
}

/** 将 AI 分析结果拆分为 intro + 各个选题段落 */
export function splitAnalysisIntoIdeas(text: string): { intro: string; ideas: { heading: string; body: string }[] } {
  // 匹配 ## 选题 / ### 选题 / --- 后跟 ### 选题
  const pattern = /(?:^|\n)(?:---\s*\n)?(?:#{2,3}\s*选题\s*[一二三四五六七八九十\d]+[：:：]?\s*)/gm
  const matches = [...text.matchAll(pattern)]

  if (matches.length === 0) {
    return { intro: text, ideas: [] }
  }

  const intro = text.slice(0, matches[0].index!).trim()
  const ideas: { heading: string; body: string }[] = []

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length
    const section = text.slice(start, end).trim()
    // 第一行是标题
    const newlineIdx = section.indexOf('\n')
    const heading = newlineIdx > 0 ? section.slice(0, newlineIdx).replace(/^[-#\s]+/, '').trim() : section.replace(/^[-#\s]+/, '').trim()
    const body = newlineIdx > 0 ? section.slice(newlineIdx + 1).trim() : ''
    ideas.push({ heading, body })
  }

  return { intro, ideas }
}

/** 从单个选题文本中解析结构化信息 */
export function parseIdeaFromSection(text: string, language: 'zh' | 'en' = 'zh'): ParsedIdea {
  // 英文选题格式: 《中文书名》/ English Title  →  提取 English Title
  // 中文选题格式: 《中文书名》                  →  提取 中文书名
  const isEn = language === 'en'
  let title = ''
  const titleLineMatch = text.match(/《([^》]+)》\s*[/／]\s*(.+)/m)
  if (titleLineMatch) {
    title = isEn ? titleLineMatch[2].trim() : titleLineMatch[1].trim()
  } else {
    const fallbackMatch = text.match(/《([^》]+)》/)
    title = fallbackMatch?.[1] ?? ''
  }

  let genre = isEn ? 'progression-fantasy' : 'qihuan'
  // 新格式：**题材分类**：xxx
  const genreMatch = text.match(/题材分类\*{0,2}[：:]\s*(.+)/m)
  if (genreMatch) {
    for (const [keyword, key] of Object.entries(GENRE_KEYWORDS)) {
      if (genreMatch[1].includes(keyword)) { genre = key; break }
    }
  }

  let platform = isEn ? 'royalroad' : 'tomato'
  const platformMatch = text.match(/建议平台\*{0,2}[：:]\s*(.+)/m)
  if (platformMatch) {
    for (const [keyword, key] of Object.entries(PLATFORM_KEYWORDS)) {
      if (platformMatch[1].includes(keyword)) { platform = key; break }
    }
  }

  // 将完整 AI 分析原文作为 context，用户在 CreateBookDialog 中可编辑后再传给架构师
  const context = text.trim()

  // 解析建议章数和每章字数
  let targetChapters = isEn ? 300 : 200
  const chaptersMatch = text.match(/建议章数\*{0,2}[：:]\s*(\d+)/m)
  if (chaptersMatch) targetChapters = parseInt(chaptersMatch[1], 10)

  let chapterWords = isEn ? 2500 : 3000
  const wordsMatch = text.match(/每章字数\*{0,2}[：:]\s*(\d+)/m)
  if (wordsMatch) chapterWords = parseInt(wordsMatch[1], 10)

  return { title, genre, platform, targetChapters, chapterWords, context, language }
}

/** 已知的题材关键词集（用于高亮） */
const KNOWN_GENRES = new Set(Object.keys(GENRE_KEYWORDS))

/**
 * 将纯文本拆分为富文本 JSX 片段：
 * - **加粗** → <strong>
 * - 《书名》 → 紫色高亮
 * - 数字/百分比 → 橙色
 * - 题材关键词 → 小标签
 */
function renderRichInline(text: string): (string | JSX.Element)[] {
  // 正则顺序：加粗 → 书名号 → 百分比/数字(含万/亿/章/字) → 题材关键词
  const genreAlt = [...KNOWN_GENRES].sort((a, b) => b.length - a.length).join('|')
  const pattern = new RegExp(
    `(\\*\\*(.+?)\\*\\*)|` +                                   // group 1,2: bold
    `(《([^》]+)》)|` +                                         // group 3,4: book title
    `(\\d[\\d,.]*\\s*[%％万亿章字个篇部本条次]+)|` +            // group 5: number+unit
    `((?:${genreAlt})(?=[，、。\\s）)\\]」】]|$))`,              // group 6: genre keyword
    'g',
  )

  const parts: (string | JSX.Element)[] = []
  let last = 0
  let key = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))

    if (match[1]) {
      // **bold**
      parts.push(<strong key={key++} className="text-zinc-100 font-semibold">{match[2]}</strong>)
    } else if (match[3]) {
      // 《书名》
      parts.push(
        <span key={key++} className="text-violet-400 font-semibold">《{match[4]}》</span>,
      )
    } else if (match[5]) {
      // 数字+单位
      parts.push(<span key={key++} className="text-amber-400 font-medium">{match[5]}</span>)
    } else if (match[6]) {
      // 题材关键词 badge
      parts.push(
        <span key={key++} className="inline-block px-1.5 py-0.5 rounded text-[11px] leading-none bg-violet-900/60 text-violet-300 font-medium align-middle">
          {match[6]}
        </span>,
      )
    }
    last = match.index + match[0].length
  }

  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** 将一段文本按行渲染，并识别字段标签（如 **核心卖点**：） */
function renderRichBlock(text: string, baseKey: string): JSX.Element {
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={`${baseKey}-${i}`} className="h-2" />

        // 检测字段标签行：**字段名**：内容  或  字段名：内容
        const labelMatch = trimmed.match(/^\*{0,2}([\u4e00-\u9fff\w]+)\*{0,2}[：:]\s*(.*)/)
        if (labelMatch) {
          return (
            <div key={`${baseKey}-${i}`} className="text-sm leading-relaxed">
              <span className="text-emerald-400 font-semibold">{labelMatch[1]}：</span>
              <span className="text-zinc-300">{renderRichInline(labelMatch[2])}</span>
            </div>
          )
        }

        // 检测列表项 - / •
        if (/^[-•]\s/.test(trimmed)) {
          return (
            <div key={`${baseKey}-${i}`} className="text-sm leading-relaxed pl-3 text-zinc-300 flex gap-1.5">
              <span className="text-zinc-600 shrink-0">•</span>
              <span>{renderRichInline(trimmed.replace(/^[-•]\s*/, ''))}</span>
            </div>
          )
        }

        // 检测数字列表 1. 2. 等
        const numListMatch = trimmed.match(/^(\d+)[.、]\s*(.*)/)
        if (numListMatch) {
          return (
            <div key={`${baseKey}-${i}`} className="text-sm leading-relaxed pl-3 text-zinc-300 flex gap-1.5">
              <span className="text-zinc-500 shrink-0 font-mono text-xs">{numListMatch[1]}.</span>
              <span>{renderRichInline(numListMatch[2])}</span>
            </div>
          )
        }

        // 普通文本行
        return (
          <div key={`${baseKey}-${i}`} className="text-sm leading-relaxed text-zinc-300">
            {renderRichInline(trimmed)}
          </div>
        )
      })}
    </div>
  )
}

/** 渲染 AI 分析结果，每个选题带独立的「发送到创建新书」按钮 */
export function AnalysisRenderer({
  analysis,
  onSendIdea,
  language = 'zh',
}: {
  analysis: string
  onSendIdea: (idea: ParsedIdea) => void
  language?: 'zh' | 'en'
}): JSX.Element {
  const { intro, ideas } = splitAnalysisIntoIdeas(analysis)

  // 如果无法拆分成选题（格式不匹配），整体显示
  if (ideas.length === 0) {
    return renderRichBlock(analysis, 'fallback')
  }

  return (
    <div className="space-y-4">
      {intro && renderRichBlock(intro, 'intro')}
      {ideas.map((idea, idx) => {
        const fullText = `${idea.heading}\n${idea.body}`
        const titleMatch = fullText.match(/《([^》]+)》/)
        const displayTitle = titleMatch ? `《${titleMatch[1]}》` : ''
        return (
          <div key={idx} className="border border-zinc-700/50 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-zinc-800/80 px-4 py-2">
              <span className="text-sm font-medium text-zinc-200">
                {renderRichInline(idea.heading.slice(0, 80))}
              </span>
              <button
                onClick={() => onSendIdea(parseIdeaFromSection(fullText, language))}
                className="flex items-center gap-1.5 px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs font-medium transition-colors shrink-0 ml-3"
                title={displayTitle ? `将${displayTitle}发送到「创建新书」` : '发送到创建新书'}
              >
                <Send className="w-3 h-3" /> 发送到创建新书
              </button>
            </div>
            <div className="px-4 py-3">
              {renderRichBlock(idea.body, `idea-${idx}`)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
