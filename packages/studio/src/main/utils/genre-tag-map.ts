/**
 * Genre → Tag 映射表
 *
 * 当用户创建新书并选择 genre 时，用此映射表去 vault 中匹配同题材小说。
 * 匹配算法：novel.tags 与 genre 对应的 keywords 取交集，按交集大小排序。
 *
 * tags 来自 TrendingNovel 的 tags 字段（英文逗号分隔的标签字符串，全小写）。
 */

/** 每个 genre 对应的关键词列表（全小写）。novel.tags 与这些关键词取交集。 */
export const GENRE_TAG_MAP: Record<string, string[]> = {
  // === 中文题材 ===
  xuanhuan: ['fantasy', 'xianxia', 'cultivation', 'martial arts', 'wuxia', 'xuanhuan', 'magic', 'adventure'],
  xianxia: ['xianxia', 'cultivation', 'immortal', 'dao', 'martial arts', 'fantasy'],
  wuxia: ['wuxia', 'martial arts', 'kung fu', 'cultivation', 'action'],
  qihuan: ['fantasy', 'magic', 'adventure', 'epic', 'sword', 'quest'],
  urban: ['urban', 'modern', 'city', 'contemporary', 'slice of life', 'realism'],
  yanqing: ['romance', 'love', 'drama', 'relationship', 'female lead'],
  xianshi: ['realistic', 'contemporary', 'drama', 'slice of life'],
  lishi: ['historical', 'history', 'dynasty', 'war', 'ancient', 'kingdom'],
  junshi: ['military', 'war', 'strategy', 'army', 'battle'],
  kehuan: ['sci-fi', 'science fiction', 'space', 'technology', 'cyberpunk', 'futuristic'],
  xuanyi: ['mystery', 'thriller', 'suspense', 'detective', 'crime'],
  horror: ['horror', 'dark', 'supernatural', 'survival horror', 'psychological'],
  lingyi: ['supernatural', 'ghost', 'paranormal', 'spiritual', 'horror'],
  youxi: ['gamelit', 'game', 'virtual reality', 'vr', 'mmorpg', 'litrpg'],
  tiyu: ['sports', 'competition', 'athlete', 'tournament'],
  erciyuan: ['anime', 'manga', 'light novel', 'isekai', 'otaku'],
  chuanyue: ['isekai', 'portal fantasy', 'transmigration', 'reincarnation', 'another world'],
  chongsheng: ['reincarnation', 'rebirth', 'second chance', 'regression', 'time travel'],
  moshi: ['apocalypse', 'post-apocalyptic', 'survival', 'zombie', 'dystopia'],
  wuxianliu: ['infinite', 'multiverse', 'world hopping', 'survival', 'system'],
  zhutian: ['multiverse', 'fan fiction', 'world hopping', 'crossover'],
  tongren: ['fan fiction', 'fanfic', 'crossover', 'tribute'],
  duanpian: ['short story', 'anthology', 'one-shot'],
  xitong: ['system', 'litrpg', 'gamelit', 'status screen', 'leveling'],
  zhongtian: ['farming', 'crafting', 'base building', 'kingdom building', 'management'],
  guize: ['rules', 'horror', 'survival', 'mystery', 'puzzle'],
  other: [],

  // === English 题材 ===
  'progression-fantasy': ['progression', 'progression fantasy', 'leveling', 'magic', 'fantasy', 'adventure', 'power fantasy'],
  cultivation: ['cultivation', 'xianxia', 'martial arts', 'qi', 'dao', 'immortal', 'fantasy'],
  litrpg: ['litrpg', 'gamelit', 'system', 'stats', 'leveling', 'rpg', 'adventure'],
  gamelit: ['gamelit', 'litrpg', 'game', 'virtual reality', 'vr', 'rpg'],
  isekai: ['isekai', 'portal fantasy', 'reincarnation', 'another world', 'transported', 'summoned'],
  'dungeon-core': ['dungeon', 'dungeon core', 'base building', 'monster', 'management'],
  'epic-fantasy': ['epic fantasy', 'fantasy', 'magic', 'quest', 'sword', 'war', 'kingdom'],
  'urban-fantasy': ['urban fantasy', 'modern', 'magic', 'supernatural', 'paranormal'],
  'cozy-fantasy': ['cozy', 'slice of life', 'low stakes', 'crafting', 'wholesome', 'fantasy'],
  scifi: ['sci-fi', 'science fiction', 'space', 'space opera', 'technology', 'cyberpunk', 'futuristic'],
  'en-horror': ['horror', 'cosmic horror', 'lovecraft', 'dark', 'supernatural', 'thriller'],
  apocalypse: ['apocalypse', 'post-apocalyptic', 'survival', 'dystopia', 'zombie'],
  'system-apocalypse': ['system apocalypse', 'apocalypse', 'system', 'litrpg', 'survival', 'leveling'],
}

export interface TagMatchResult {
  title: string
  url: string
  tags: string
  platform: string
  rank: number
  stats: string
  matchScore: number
}

/**
 * 从小说列表中按 genre 匹配，返回得分最高的 topN 本。
 * 匹配算法：novel.tags 拆分后与 genre keywords 取交集大小作为分数。
 */
export function matchNovelsByGenre(
  novels: Array<{ title: string; url: string; tags: string; platform: string; rank: number; stats: string }>,
  genre: string,
  topN: number = 5
): TagMatchResult[] {
  const keywords = GENRE_TAG_MAP[genre]
  if (!keywords || keywords.length === 0) return []

  const scored: TagMatchResult[] = novels.map(novel => {
    const novelTags = (novel.tags || '').toLowerCase().split(/[,;|]/).map(t => t.trim()).filter(Boolean)
    let matchScore = 0
    for (const kw of keywords) {
      if (novelTags.some(tag => tag.includes(kw) || kw.includes(tag))) {
        matchScore++
      }
    }
    return { ...novel, matchScore }
  })

  return scored
    .filter(n => n.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore || a.rank - b.rank)
    .slice(0, topN)
}
