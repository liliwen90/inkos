/**
 * 热榜适配器 — 从各英文平台抓取热门小说并使用 LLM 翻译简介
 */

import { request as httpsRequest, type IncomingMessage } from 'node:https'
import { createGunzip, createInflate } from 'node:zlib'

export interface TrendingNovel {
  rank: number
  title: string
  titleZh: string
  tags: string
  stats: string
  platform: string
  url: string
}

export interface TrendingResult {
  platform: string
  listType: string
  novels: TrendingNovel[]
  fetchedAt: string
}

// ─── 平台定义 ───

interface PlatformConfig {
  id: string
  name: string
  lists: { type: string; label: string; url: string }[]
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'royalroad',
    name: 'Royal Road',
    lists: [
      { type: 'trending', label: 'Trending', url: 'https://www.royalroad.com/fictions/trending' },
      { type: 'best-rated', label: 'Best Rated', url: 'https://www.royalroad.com/fictions/best-rated' },
      { type: 'rising-stars', label: 'Rising Stars', url: 'https://www.royalroad.com/fictions/rising-stars' },
    ]
  },
  {
    id: 'scribblehub',
    name: 'ScribbleHub',
    lists: [
      { type: 'trending', label: 'Weekly Trending', url: 'https://www.scribblehub.com/series-ranking/?sort=1&order=4' },
    ]
  }
]

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

/** 解码 HTML 实体 */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

// ─── 抓取器 ───

/** 用 Node.js 原生 https 模块抓取 HTML，绕过 Electron 的 net.fetch 覆写 */
function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = httpsRequest({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Referer': parsed.origin + '/',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      }
    }, (res: IncomingMessage) => {
      // 跟随 3xx 重定向
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsed.origin}${res.headers.location}`
        fetchHtml(loc).then(resolve, reject)
        res.resume()
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode} from ${url}`))
        return
      }
      // 处理 gzip/deflate 压缩
      let stream: NodeJS.ReadableStream = res
      const encoding = res.headers['content-encoding']
      if (encoding === 'gzip') stream = res.pipe(createGunzip())
      else if (encoding === 'deflate') stream = res.pipe(createInflate())

      let data = ''
      stream.setEncoding('utf-8')
      stream.on('data', (chunk: string) => { data += chunk })
      stream.on('end', () => resolve(data))
      stream.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

async function fetchRoyalRoad(url: string, _listType: string): Promise<TrendingNovel[]> {
  const html = await fetchHtml(url)
  const novels: TrendingNovel[] = []

  // 实际 HTML 结构:
  //   <h2 class="fiction-title">
  //     <a href="/fiction/132904/slug" class="font-red-sunglo bold">Title</a>
  //   </h2>
  const pattern = /<h2[^>]*class="fiction-title"[^>]*>\s*<a\s+href="(\/fiction\/\d+\/[^"]+)"[^>]*>([^<]+)<\/a>/g
  let m: RegExpExecArray | null
  const seen = new Set<string>()

  while ((m = pattern.exec(html)) !== null) {
    const title = decodeHtmlEntities(m[2].trim())
    if (!title || seen.has(title)) continue
    seen.add(title)

    const fictionUrl = `https://www.royalroad.com${m[1]}`
    const afterBlock = html.slice(m.index + m[0].length, m.index + m[0].length + 3000)

    // 提取标签: <a class="...fiction-tag" href="/fictions/search?tagsAdd=litrpg">LitRPG</a>
    const tagPattern = /fiction-tag"[^>]*>([^<]+)<\/a>/g
    const tags: string[] = []
    let tm: RegExpExecArray | null
    while ((tm = tagPattern.exec(afterBlock)) !== null) {
      tags.push(tm[1].trim())
      if (tags.length >= 6) break
    }

    // 提取统计: <span>162 Followers</span> / <span>6,394 Views</span>
    const followersM = afterBlock.match(/<span>(\d[\d,]*)\s*Followers<\/span>/i)
    const viewsM = afterBlock.match(/<span>([\d,.]+[KMB]?)\s*Views<\/span>/i)
    const pagesM = afterBlock.match(/<span>(\d[\d,]*)\s*Pages<\/span>/i)
    const chaptersM = afterBlock.match(/<span>(\d[\d,]*)\s*Chapters<\/span>/i)
    const stats = [
      followersM ? `${followersM[1]} followers` : '',
      viewsM ? `${viewsM[1]} views` : '',
      pagesM ? `${pagesM[1]} pages` : '',
      chaptersM ? `${chaptersM[1]} chapters` : '',
    ].filter(Boolean).join(' · ')

    novels.push({
      rank: novels.length + 1,
      title,
      titleZh: '',
      tags: tags.join(', '),
      stats,
      platform: 'Royal Road',
      url: fictionUrl,
    })

    if (novels.length >= 40) break
  }

  return novels
}

async function fetchScribbleHub(url: string): Promise<TrendingNovel[]> {
  const html = await fetchHtml(url)
  const novels: TrendingNovel[] = []

  // 实际 HTML 结构 (单行紧凑):
  // <div class="search_title"><span id="sid413997" class="rl_icons_en"></span>
  //   <span class="genre_rank">#1</span>
  //   <a href="https://www.scribblehub.com/series/413997/...">Title</a></div>
  //   <div class="search_stats"><span class="nl_stat destp">13.79M Views</span>...
  //   <div class="search_genre"><a class="fic_genre search">Action</a>...
  const pattern = /class="genre_rank">#(\d+)<\/span><a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g
  let m: RegExpExecArray | null
  const seen = new Set<string>()

  while ((m = pattern.exec(html)) !== null) {
    const rank = parseInt(m[1], 10)
    const title = decodeHtmlEntities(m[3].trim())
    if (!title || seen.has(title)) continue
    seen.add(title)

    const afterBlock = html.slice(m.index + m[0].length, m.index + m[0].length + 3000)

    // 提取统计: <span class="nl_stat destp">13.79M Views</span>
    const viewsM = afterBlock.match(/([\d,.]+[KMB]?)\s*Views<\/span>/i)
    const favsM = afterBlock.match(/([\d,.]+[KMB]?)\s*Favorites<\/span>/i)
    const chaptersM = afterBlock.match(/([\d,.]+[KMB]?)\s*Chapters<\/span>/i)
    const readersM = afterBlock.match(/([\d,.]+[KMB]?)\s*Readers<\/span>/i)
    const stats = [
      viewsM ? `${viewsM[1]} views` : '',
      favsM ? `${favsM[1]} favorites` : '',
      chaptersM ? `${chaptersM[1]} chapters` : '',
      readersM ? `${readersM[1]} readers` : '',
    ].filter(Boolean).join(' · ')

    // 提取类型: <a class="fic_genre search" ...>Action</a>
    const genrePattern = /class="fic_genre[^"]*"[^>]*>([^<]+)<\/a>/g
    const tags: string[] = []
    let gm: RegExpExecArray | null
    while ((gm = genrePattern.exec(afterBlock)) !== null) {
      tags.push(gm[1].trim())
      if (tags.length >= 5) break
    }

    novels.push({
      rank,
      title,
      titleZh: '',
      tags: tags.join(', '),
      stats,
      platform: 'ScribbleHub',
      url: m[2],
    })

    if (novels.length >= 25) break
  }

  return novels
}

// ─── 翻译 ───

async function translateTitles(
  novels: TrendingNovel[],
  llmChat: (messages: { role: string; content: string }[]) => Promise<string>
): Promise<void> {
  if (novels.length === 0) return
  const titlesStr = novels.map((n, i) => `${i + 1}. ${n.title}`).join('\n')

  const prompt = `请将以下英文小说标题翻译为中文。要求翻译信达雅、符合网文风格。
只输出编号和中文译名，每行一个，不要解释。格式：
1. 中文译名
2. 中文译名

英文标题：
${titlesStr}`

  try {
    const response = await llmChat([
      { role: 'system', content: '你是一位精通中英双语的网络小说翻译专家。' },
      { role: 'user', content: prompt }
    ])

    const lines = response.split('\n')
    for (const line of lines) {
      const m = line.match(/^\s*(\d+)\.\s*(.+)/)
      if (m) {
        const idx = parseInt(m[1], 10) - 1
        if (idx >= 0 && idx < novels.length) {
          novels[idx].titleZh = m[2].trim()
        }
      }
    }
  } catch {
    // 翻译失败不影响主流程
  }
}

// ─── 主入口 ───

export class TrendingAdapter {
  private llmChat: ((messages: { role: string; content: string }[]) => Promise<string>) | null = null

  setLLMChat(fn: (messages: { role: string; content: string }[]) => Promise<string>): void {
    this.llmChat = fn
  }

  getPlatforms(): { id: string; name: string; lists: { type: string; label: string }[] }[] {
    return PLATFORMS.map(p => ({
      id: p.id,
      name: p.name,
      lists: p.lists.map(l => ({ type: l.type, label: l.label }))
    }))
  }

  async fetchTrending(
    platformId: string,
    listType: string,
    translate: boolean = true
  ): Promise<TrendingResult> {
    const platform = PLATFORMS.find(p => p.id === platformId)
    if (!platform) throw new Error(`未知平台: ${platformId}`)
    const list = platform.lists.find(l => l.type === listType) ?? platform.lists[0]

    let novels: TrendingNovel[]

    if (platformId === 'royalroad') {
      novels = await fetchRoyalRoad(list.url, listType)
    } else if (platformId === 'scribblehub') {
      novels = await fetchScribbleHub(list.url)
    } else {
      novels = []
    }

    // 使用 LLM 翻译标题
    if (translate && this.llmChat && novels.length > 0) {
      await translateTitles(novels, this.llmChat)
    }

    return {
      platform: platform.name,
      listType: list.label,
      novels,
      fetchedAt: new Date().toISOString(),
    }
  }

  /** 基于已抓取的热榜数据，让 AI 推荐 10 个最佳选题 */
  async analyzeTrending(allNovels: TrendingNovel[]): Promise<string> {
    if (!this.llmChat) throw new Error('请先在设置中配置 LLM')
    if (allNovels.length === 0) throw new Error('没有热榜数据，请先抓取')

    const novelsSummary = allNovels.slice(0, 50).map((n, i) =>
      `${i + 1}. 「${n.title}」${n.titleZh ? `（${n.titleZh}）` : ''} [${n.tags}] ${n.stats} (${n.platform})`
    ).join('\n')

    const prompt = `你是一位深谙中英文网络小说市场的资深策划编辑和创意总监。以下是当前英文网络小说平台（Royal Road / ScribbleHub）上最热门的作品列表：

${novelsSummary}

请基于以上数据，综合分析当前英文网文市场的热门趋势，然后为一位准备在英文平台发布英文网络小说的中国作者推荐 **10 个最佳选题方向**。

重要：所有选题均面向英语读者和英文小说平台，书名必须同时提供中英文版本，但实际发布用英文书名。

每个选题必须包含以下完整信息（请严格按此格式）：

---
### 选题 N：《中文书名》/ English Title

**题材分类**：（从以下选择一个，优先选择英文市场常见分类：LitRPG/System Apocalypse/奇幻/科幻/悬疑/恐怖/灵异/游戏/玄幻/仙侠/武侠/都市/言情/历史/军事/体育/二次元/穿越/重生/末世/无限流/诸天/同人/短篇/系统流/种田文/规则怪谈/通用）

**建议平台**：（从以下选择，因为是英文市场选题请优先选英文平台：Royal Road/Kindle/KU/Patreon/番茄/起点/飞卢/其他，可多选）

**建议章数**：（根据题材和平台推荐合理的目标总章数，如200、300、500等）
**每章字数**：（根据平台推荐每章字数，中文平台建议2000-3000，英文平台建议1500-2500）

**核心卖点**：（2-3句话概括这本书最吸引读者的独特之处）

**故事核心创意**：
- **世界观设定**：（3-5句话描述独特的世界观架构）
- **主角设定**：（主角身份、性格特征、核心矛盾）
- **核心冲突**：（推动故事发展的主要矛盾和对抗力量）
- **关键金手指/系统**：（如有，描述主角的特殊能力或系统机制）
- **故事走向**：（前30章的大致节奏和爽点节奏安排）

**创作指导**：
- **开篇策略**：（前3章如何抓住读者，建议的开场场景）
- **爽点设计**：（每10章左右的爽点节奏规划）
- **差异化策略**：（相比同类作品，如何做出差异化）
- **文风建议**：（推荐的叙事风格和节奏控制）

**推荐标签**：（5-8个英文标签，如 LitRPG, Cultivation, Isekai 等）
**目标读者群**：（精确描述目标受众）
**预估热度**：（高/中高/中，并说明判断依据）
**市场空白分析**：（为什么这个方向有机会，竞品少在哪里）

---

要求：
1. 选题要结合当前榜单热门元素（如 LitRPG、修仙/Cultivation、Isekai、Progression 等），但要有差异化创新
2. 优先推荐中国作者有文化优势的方向（如东方修仙、武侠、玄幻与西方元素融合）
3. 考虑市场空白和蓝海机会，不要只跟风已有热门
4. 每个选题的"故事核心创意"和"创作指导"要足够具体、可直接用于开书
5. 10个选题要覆盖不同的题材和风格，避免同质化
6. 用中文回答，格式清晰`

    return this.llmChat([
      { role: 'system', content: '你是网络小说市场分析专家兼资深策划编辑，精通中英文网文市场趋势和读者偏好。你的选题建议要具体到可以直接开书的程度，包含完整的世界观、角色、冲突和创作策略。' },
      { role: 'user', content: prompt }
    ])
  }
}
