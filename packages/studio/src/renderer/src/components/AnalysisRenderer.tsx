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
  '番茄': 'tomato', '起点': 'qidian', '飞卢': 'feilu',
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
export function parseIdeaFromSection(text: string): ParsedIdea {
  const titleMatch = text.match(/《([^》]+)》/)
  const title = titleMatch?.[1] ?? ''

  let genre = 'qihuan'
  // 新格式：**题材分类**：xxx
  const genreMatch = text.match(/题材分类\*{0,2}[：:]\s*(.+)/m)
  if (genreMatch) {
    for (const [keyword, key] of Object.entries(GENRE_KEYWORDS)) {
      if (genreMatch[1].includes(keyword)) { genre = key; break }
    }
  }

  let platform = 'royalroad'
  const platformMatch = text.match(/建议平台\*{0,2}[：:]\s*(.+)/m)
  if (platformMatch) {
    for (const [keyword, key] of Object.entries(PLATFORM_KEYWORDS)) {
      if (platformMatch[1].includes(keyword)) { platform = key; break }
    }
  }

  // 构建创作指导
  const contextParts: string[] = []

  const sellMatch = text.match(/核心卖点\*{0,2}[：:]\s*([\s\S]*?)(?=\n\*{0,2}(?:推荐标签|故事核心|创作指导|目标读者|题材分类|建议平台)|\n#{2,3}\s|$)/m)
  if (sellMatch) contextParts.push(`【核心卖点】${sellMatch[1].trim()}`)

  const creativityMatch = text.match(/故事核心创意\*{0,2}[：:]([\s\S]*?)(?=\n\*{0,2}创作指导|\n\*{0,2}推荐标签|\n---|\n#{2,3}\s|$)/m)
  if (creativityMatch) contextParts.push(`【故事核心创意】\n${creativityMatch[1].trim()}`)

  const guidanceMatch = text.match(/创作指导\*{0,2}[：:]([\s\S]*?)(?=\n\*{0,2}推荐标签|\n\*{0,2}目标读者|\n---|\n#{2,3}\s|$)/m)
  if (guidanceMatch) contextParts.push(`【创作指导】\n${guidanceMatch[1].trim()}`)

  const marketMatch = text.match(/市场空白分析\*{0,2}[：:]\s*([\s\S]*?)(?=\n---|\n#{2,3}\s|$)/m)
  if (marketMatch) contextParts.push(`【市场分析】${marketMatch[1].trim()}`)

  // 旧格式 fallback：如果没有匹配到结构化字段，就把整段内容当 context
  const context = contextParts.length > 0 ? contextParts.join('\n\n') : text.trim()

  // 解析建议章数和每章字数
  let targetChapters = 200
  const chaptersMatch = text.match(/建议章数\*{0,2}[：:]\s*(\d+)/m)
  if (chaptersMatch) targetChapters = parseInt(chaptersMatch[1], 10)

  let chapterWords = 3000
  const wordsMatch = text.match(/每章字数\*{0,2}[：:]\s*(\d+)/m)
  if (wordsMatch) chapterWords = parseInt(wordsMatch[1], 10)

  return { title, genre, platform, targetChapters, chapterWords, context }
}

/** 渲染 AI 分析结果，每个选题带独立的「发送到创建新书」按钮 */
export function AnalysisRenderer({
  analysis,
  onSendIdea,
}: {
  analysis: string
  onSendIdea: (idea: ParsedIdea) => void
}): JSX.Element {
  const { intro, ideas } = splitAnalysisIntoIdeas(analysis)

  // 如果无法拆分成选题（格式不匹配），整体显示
  if (ideas.length === 0) {
    return (
      <div className="prose prose-invert prose-sm max-w-none text-zinc-300 whitespace-pre-wrap leading-relaxed">
        {analysis}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {intro && (
        <div className="prose prose-invert prose-sm max-w-none text-zinc-300 whitespace-pre-wrap leading-relaxed">
          {intro}
        </div>
      )}
      {ideas.map((idea, idx) => {
        const fullText = `${idea.heading}\n${idea.body}`
        const titleMatch = fullText.match(/《([^》]+)》/)
        const displayTitle = titleMatch ? `《${titleMatch[1]}》` : ''
        return (
          <div key={idx} className="border border-zinc-700/50 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-zinc-800/80 px-4 py-2">
              <span className="text-sm font-medium text-zinc-200">
                {idea.heading.slice(0, 60)}{idea.heading.length > 60 ? '…' : ''}
              </span>
              <button
                onClick={() => onSendIdea(parseIdeaFromSection(fullText))}
                className="flex items-center gap-1.5 px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs font-medium transition-colors shrink-0 ml-3"
                title={displayTitle ? `将${displayTitle}发送到「创建新书」` : '发送到创建新书'}
              >
                <Send className="w-3 h-3" /> 发送到创建新书
              </button>
            </div>
            <div className="px-4 py-3 prose prose-invert prose-sm max-w-none text-zinc-300 whitespace-pre-wrap leading-relaxed text-sm">
              {idea.body}
            </div>
          </div>
        )
      })}
    </div>
  )
}
