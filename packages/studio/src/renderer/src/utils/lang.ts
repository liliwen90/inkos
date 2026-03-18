/** English genre IDs — must match genre markdown files with language: en */
const EN_GENRES = new Set([
  'litrpg', 'system-apocalypse', 'progression-fantasy', 'cultivation',
  'isekai', 'dungeon-core', 'urban-fantasy', 'epic-fantasy',
  'scifi', 'cozy-fantasy', 'en-horror', 'gamelit', 'apocalypse'
])

export function isEnglishGenre(genre: string): boolean {
  return EN_GENRES.has(genre)
}

export function bookLang(genre?: string): 'zh' | 'en' {
  return genre && isEnglishGenre(genre) ? 'en' : 'zh'
}
