import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquare, Minimize2, Maximize2, X, Send, Settings, Search, Paperclip, BarChart3 } from 'lucide-react'
import { useAgentChatStore, type InteractionMode } from '../stores/agent-chat-store'
import AgentMessage from './AgentMessage'
import PipelineMiniMap from './PipelineMiniMap'

// === Drag & Resize hook ===

function useDraggable(
  panelRef: React.RefObject<HTMLDivElement | null>,
  handleRef: React.RefObject<HTMLDivElement | null>,
  position: { x: number; y: number; w: number; h: number },
  setPosition: (pos: Partial<{ x: number; y: number; w: number; h: number }>) => void,
  panelState: string,
): void {
  useEffect(() => {
    const handle = handleRef.current
    if (!handle || panelState !== 'normal') return

    let dragging = false
    let startX = 0
    let startY = 0
    let startPosX = 0
    let startPosY = 0

    const onMouseDown = (e: MouseEvent): void => {
      dragging = true
      startX = e.clientX
      startY = e.clientY
      startPosX = position.x
      startPosY = position.y
      e.preventDefault()
    }

    const onMouseMove = (e: MouseEvent): void => {
      if (!dragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const newX = Math.max(20, Math.min(window.innerWidth - 100, startPosX + dx))
      const newY = Math.max(20, Math.min(window.innerHeight - 100, startPosY + dy))
      setPosition({ x: newX, y: newY })
    }

    const onMouseUp = (): void => { dragging = false }

    handle.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      handle.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [handleRef, position.x, position.y, setPosition, panelState])
}

// === Mode selector ===

const MODE_LABELS: Record<InteractionMode, string> = {
  'interactive': '交互模式',
  'auto-report': '自动汇报',
  'silent': '静默模式',
}

function ModeSelector(): JSX.Element {
  const mode = useAgentChatStore((s) => s.interactionMode)
  const setMode = useAgentChatStore((s) => s.setInteractionMode)
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-zinc-800 border border-zinc-700 rounded text-zinc-400 hover:text-zinc-200">
        <Settings className="w-3 h-3" />
        {MODE_LABELS[mode]}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-50 min-w-[140px]">
          {(Object.keys(MODE_LABELS) as InteractionMode[]).map((m) => (
            <button key={m} onClick={() => { setMode(m); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-700/50 ${m === mode ? 'text-violet-400' : 'text-zinc-300'}`}>
              {MODE_LABELS[m]}
              {m === 'interactive' && <span className="text-zinc-600 ml-1">每步确认</span>}
              {m === 'auto-report' && <span className="text-zinc-600 ml-1">推荐</span>}
              {m === 'silent' && <span className="text-zinc-600 ml-1">批量</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// === Main Panel ===

export default function AgentChatPanel(): JSX.Element {
  const messages = useAgentChatStore((s) => s.messages)
  const panelState = useAgentChatStore((s) => s.panelState)
  const position = useAgentChatStore((s) => s.panelPosition)
  const unreadCount = useAgentChatStore((s) => s.unreadCount)
  const currentAgent = useAgentChatStore((s) => s.currentAgent)
  const pendingGate = useAgentChatStore((s) => s.pendingGate)
  const setPanelState = useAgentChatStore((s) => s.setPanelState)
  const setPanelPosition = useAgentChatStore((s) => s.setPanelPosition)
  const resetPosition = useAgentChatStore((s) => s.resetPanelPosition)
  const addMessage = useAgentChatStore((s) => s.addMessage)
  const markRead = useAgentChatStore((s) => s.markRead)

  const [inputText, setInputText] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Compute initial position on first render
  useEffect(() => {
    if (position.x < 0) {
      const x = Math.max(20, window.innerWidth - position.w - 80)
      const y = Math.max(20, window.innerHeight - position.h - 80)
      setPanelPosition({ x, y })
    }
  }, [])

  useDraggable(panelRef, handleRef, position, setPanelPosition, panelState)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  // Open panel when markRead
  useEffect(() => {
    if (panelState !== 'minimized') markRead()
  }, [panelState])

  // Send user message
  const handleSend = useCallback(() => {
    const text = inputText.trim()
    if (!text) return
    const msgId = addMessage({ type: 'user-text', content: text })
    setInputText('')
    // Route through IPC → Agent Chat Handler → LLM
    window.hintos.sendAgentChat(text, msgId)
  }, [inputText, addMessage])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Toolbar actions
  const handleUploadStyleBook = useCallback(async () => {
    const files = await window.hintos.selectStyleBookFiles()
    if (!files || files.length === 0) return
    addMessage({
      type: 'data-card',
      content: `📎 已选择${files.length}本参考书`,
      richData: { files } as never,
    })
    // Inject file info into next agent context
    window.hintos.sendAgentChat(`[系统] 用户上传了${files.length}本参考书: ${files.map(f => f.split(/[/\\]/).pop()).join(', ')}`, `upload-${Date.now()}`)
  }, [addMessage])

  const handleTrending = useCallback(async () => {
    addMessage({ type: 'system-info', content: '📊 正在获取热榜数据...' })
    try {
      const platforms = await window.hintos.getTrendingPlatforms()
      if (platforms.length === 0) {
        addMessage({ type: 'system-info', content: '暂无可用热榜源' })
        return
      }
      // Auto-fetch from first platform, first list
      const p = platforms[0]
      const data = await window.hintos.fetchTrending(p.id, p.lists[0].type, false)
      addMessage({
        type: 'data-card',
        agentName: 'radar',
        content: `📊 ${p.name} · ${p.lists[0].label} 热榜数据已获取`,
        richData: data as never,
      })
    } catch (err) {
      addMessage({ type: 'system-info', content: `❌ 热榜获取失败: ${(err as Error).message}` })
    }
  }, [addMessage])

  const handleSearch = useCallback(() => {
    // Prompt user for search query via the input box
    setInputText('🔍 ')
  }, [])

  // Streaming check
  const isStreaming = messages.some((m) => m.isStreaming)

  // === Minimized badge ===
  if (panelState === 'minimized') {
    return (
      <button
        onClick={() => setPanelState('normal')}
        onDoubleClick={resetPosition}
        className="fixed bottom-16 right-4 z-[9997] flex items-center gap-1.5 px-3 py-2 bg-zinc-800/90 border border-zinc-700/60 rounded-full shadow-lg backdrop-blur-sm hover:bg-zinc-700/90 transition-colors"
      >
        <MessageSquare className="w-4 h-4 text-violet-400" />
        {unreadCount > 0 && (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
            <span className="text-xs text-zinc-300">{unreadCount}</span>
          </>
        )}
        {unreadCount === 0 && messages.length > 0 && (
          <span className="text-xs text-zinc-500">{messages.length}</span>
        )}
        {pendingGate && (
          <span className="text-[10px] text-amber-400 animate-pulse">等待</span>
        )}
      </button>
    )
  }

  // === Panel dimensions ===
  const isMaximized = panelState === 'maximized'
  const style: React.CSSProperties = isMaximized
    ? { top: 60, left: 60, right: 60, bottom: 60 }
    : { left: position.x, top: position.y, width: position.w, height: position.h }

  return (
    <div ref={panelRef}
      className={`fixed z-[9997] bg-zinc-900/95 border border-zinc-700/60 rounded-xl shadow-2xl backdrop-blur-sm flex flex-col ${isMaximized ? '' : ''}`}
      style={style}>

      {/* Title bar (draggable) */}
      <div ref={handleRef}
        className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 cursor-move select-none shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">Agent Chat</span>
          {currentAgent && (
            <span className="text-[10px] text-zinc-500">{currentAgent} 运行中...</span>
          )}
          {pendingGate && (
            <span className="text-[10px] text-amber-400 animate-pulse px-1.5 py-0.5 bg-amber-900/30 rounded">
              ⏸ 等待回复
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPanelState('minimized')}
            className="p-1 text-zinc-600 hover:text-zinc-400" title="最小化">
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setPanelState(isMaximized ? 'normal' : 'maximized')}
            className="p-1 text-zinc-600 hover:text-zinc-400" title={isMaximized ? '还原' : '最大化'}>
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setPanelState('minimized')}
            className="p-1 text-zinc-600 hover:text-zinc-400" title="关闭">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pipeline Mini Map */}
      <PipelineMiniMap />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 py-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
            <MessageSquare className="w-8 h-8" />
            <span className="text-xs">Agent Chat 就绪</span>
            <span className="text-[10px] text-zinc-700">开始写作后，AI 团队会在这里和你对话</span>
          </div>
        )}
        {messages.map((msg) => (
          <AgentMessage key={msg.id} message={msg} />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-zinc-800/50 shrink-0">
        <button onClick={handleUploadStyleBook} className="p-1 text-zinc-600 hover:text-zinc-300" title="上传参考书">
          <Paperclip className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleTrending} className="p-1 text-zinc-600 hover:text-zinc-300" title="热榜">
          <BarChart3 className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleSearch} className="p-1 text-zinc-600 hover:text-zinc-300" title="搜索">
          <Search className="w-3.5 h-3.5" />
        </button>
        <div className="ml-auto">
          <ModeSelector />
        </div>
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-3 py-2 border-t border-zinc-800 shrink-0">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={pendingGate ? '回复 Agent...' : '给 Agent 说点什么...'}
          rows={1}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-500 max-h-24 overflow-y-auto"
        />
        <button onClick={handleSend}
          disabled={!inputText.trim() || isStreaming}
          className="p-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors shrink-0">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
