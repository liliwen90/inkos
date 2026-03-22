import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// === Types ===

export type InteractionMode = 'interactive' | 'auto-report' | 'silent'

export type ChatMessageType =
  | 'agent-text'
  | 'agent-report'
  | 'agent-streaming'
  | 'agent-gate'
  | 'user-text'
  | 'user-action'
  | 'system-info'
  | 'search-result'
  | 'data-card'
  | 'chapter-landmark'

export interface ChatAction {
  id: string
  label: string
  icon?: string
  variant: 'primary' | 'secondary' | 'danger'
  payload?: unknown
}

export interface ChapterLandmarkData {
  chapterNum: number
  title: string
  wordCount: number
  characters: string[]
  hooksAdded: { id: string; brief: string }[]
  hooksResolved: { id: string; brief: string }[]
  auditCritical: number
  chapterSummary: string
}

export interface ChatMessage {
  id: string
  type: ChatMessageType
  agentName?: string
  agentIcon?: string
  agentColor?: string
  content: string
  richData?: unknown
  actions?: ChatAction[]
  timestamp: number
  isStreaming?: boolean
  isComplete?: boolean
  landmark?: ChapterLandmarkData
  /** Gate stage identifier — used for resolving gate decisions */
  stage?: string
}

export type PanelState = 'minimized' | 'normal' | 'maximized'

export interface PipelineStage {
  agent: string
  icon: string
  color: string
  status: 'pending' | 'running' | 'done' | 'error'
}

// === Agent Definitions ===

export const AGENT_DEFS: Record<string, { displayName: string; icon: string; color: string }> = {
  architect:         { displayName: '建筑师',     icon: '🏗️', color: 'text-violet-400' },
  writer:            { displayName: '写手',       icon: '✍️', color: 'text-green-400' },
  'continuity-auditor': { displayName: '审计官', icon: '🔍', color: 'text-amber-400' },
  'continuity-plus':    { displayName: '深度检查员', icon: '🔬', color: 'text-orange-400' },
  reviser:           { displayName: '修订师',     icon: '🔧', color: 'text-blue-400' },
  polisher:          { displayName: '润色师',     icon: '💎', color: 'text-pink-400' },
  radar:             { displayName: '雷达',       icon: '🔭', color: 'text-cyan-400' },
  'entity-extractor':   { displayName: '实体提取师', icon: '📐', color: 'text-teal-400' },
}

// === Store ===

interface AgentChatState {
  messages: ChatMessage[]
  interactionMode: InteractionMode
  currentAgent: string | null
  pendingGate: { stage: string; agentName: string; messageId: string } | null
  panelState: PanelState
  panelPosition: { x: number; y: number; w: number; h: number }
  unreadCount: number
  pipelineStages: PipelineStage[]
  currentBookId: string | null

  // Actions
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateStreamingMessage: (id: string, chunkText: string, agentName?: string) => void
  completeStreamingMessage: (id: string) => void
  setCurrentAgent: (agent: string | null) => void
  setPendingGate: (gate: AgentChatState['pendingGate']) => void
  resolveGate: () => void
  setInteractionMode: (mode: InteractionMode) => void
  setPanelState: (state: PanelState) => void
  setPanelPosition: (pos: Partial<AgentChatState['panelPosition']>) => void
  resetPanelPosition: () => void
  clearMessages: () => void
  markRead: () => void
  setPipelineStages: (stages: PipelineStage[]) => void
  updatePipelineStage: (agent: string, status: PipelineStage['status']) => void
  setCurrentBookId: (id: string | null) => void
}

const DEFAULT_POSITION = { x: -1, y: -1, w: 420, h: 520 }

let _msgSeq = 0

export const useAgentChatStore = create<AgentChatState>()(
  persist(
    (set, get) => ({
  messages: [],
  interactionMode: 'auto-report',
  currentAgent: null,
  pendingGate: null,
  panelState: 'minimized',
  panelPosition: { ...DEFAULT_POSITION },
  unreadCount: 0,
  pipelineStages: [],
  currentBookId: null,

  addMessage: (msg) => {
    const id = `chat-${++_msgSeq}-${Date.now()}`
    const full: ChatMessage = { ...msg, id, timestamp: Date.now() }
    set((s) => {
      const msgs = [...s.messages, full]
      if (msgs.length > 500) msgs.splice(0, msgs.length - 500)
      return {
        messages: msgs,
        unreadCount: s.panelState === 'minimized' ? s.unreadCount + 1 : s.unreadCount,
      }
    })
    return id
  },

  updateStreamingMessage: (id, chunkText, agentName) => {
    set((s) => {
      const exists = s.messages.find((m) => m.id === id)
      if (exists) {
        return {
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, content: m.content + chunkText, isStreaming: true } : m
          ),
        }
      }
      // First chunk — create the streaming message
      const def = agentName ? AGENT_DEFS[agentName] : undefined
      const msg: ChatMessage = {
        id, type: 'agent-streaming', agentName,
        agentIcon: def?.icon, agentColor: def?.color,
        content: chunkText, timestamp: Date.now(), isStreaming: true,
      }
      const msgs = [...s.messages, msg]
      if (msgs.length > 500) msgs.splice(0, msgs.length - 500)
      return {
        messages: msgs,
        unreadCount: s.panelState === 'minimized' ? s.unreadCount + 1 : s.unreadCount,
      }
    })
  },

  completeStreamingMessage: (id) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false, isComplete: true } : m
      ),
    }))
  },

  setCurrentAgent: (agent) => set({ currentAgent: agent }),

  setPendingGate: (gate) => set({ pendingGate: gate }),

  resolveGate: () => set({ pendingGate: null }),

  setInteractionMode: (mode) => set({ interactionMode: mode }),

  setPanelState: (state) => {
    set({ panelState: state })
    if (state !== 'minimized') set({ unreadCount: 0 })
  },

  setPanelPosition: (pos) => {
    set((s) => ({ panelPosition: { ...s.panelPosition, ...pos } }))
  },

  resetPanelPosition: () => set({ panelPosition: { ...DEFAULT_POSITION } }),

  clearMessages: () => set({ messages: [], unreadCount: 0 }),

  markRead: () => set({ unreadCount: 0 }),

  setPipelineStages: (stages) => set({ pipelineStages: stages }),

  updatePipelineStage: (agent, status) => {
    set((s) => ({
      pipelineStages: s.pipelineStages.map((st) =>
        st.agent === agent ? { ...st, status } : st
      ),
    }))
  },

  setCurrentBookId: (id) => set({ currentBookId: id }),
}),
    {
      name: 'hintos-agent-chat',
      partialize: (state) => ({
        messages: state.messages.slice(-100), // Only persist last 100 messages
        interactionMode: state.interactionMode,
        panelPosition: state.panelPosition,
        currentBookId: state.currentBookId,
      }),
    },
  ),
)
