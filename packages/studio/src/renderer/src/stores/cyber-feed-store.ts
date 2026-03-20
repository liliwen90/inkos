import { create } from 'zustand'

export interface CyberFeedEntry {
  id: string
  timestamp: number
  source: string   // e.g. 'pipeline', 'scraper', 'llm', 'system'
  level: 'info' | 'warn' | 'error' | 'success' | 'debug'
  message: string
  detail?: string
}

interface CyberFeedState {
  entries: CyberFeedEntry[]
  maxEntries: number
  paused: boolean
  push: (entry: Omit<CyberFeedEntry, 'id' | 'timestamp'>) => void
  clear: () => void
  togglePause: () => void
}

export const useCyberFeedStore = create<CyberFeedState>((set) => ({
  entries: [],
  maxEntries: 500,
  paused: false,
  push: (entry) => set((state) => {
    if (state.paused) return state
    const full: CyberFeedEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now()
    }
    const next = [...state.entries, full]
    if (next.length > state.maxEntries) next.splice(0, next.length - state.maxEntries)
    return { entries: next }
  }),
  clear: () => set({ entries: [] }),
  togglePause: () => set((s) => ({ paused: !s.paused }))
}))
