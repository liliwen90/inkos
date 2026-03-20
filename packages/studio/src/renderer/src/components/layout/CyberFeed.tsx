import { useEffect, useRef, useState } from 'react'
import { Terminal, Pause, Play, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useCyberFeedStore, type CyberFeedEntry } from '../../stores/cyber-feed-store'

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-cyan-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
  success: 'text-emerald-400',
  debug: 'text-zinc-500'
}

const SOURCE_COLORS: Record<string, string> = {
  pipeline: 'text-violet-400',
  scraper: 'text-emerald-400',
  llm: 'text-amber-400',
  system: 'text-cyan-400',
  activity: 'text-blue-400'
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`
}

export default function CyberFeed(): JSX.Element {
  const { entries, paused, togglePause, clear } = useCyberFeedStore()
  const [expanded, setExpanded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // auto-scroll to bottom
  useEffect(() => {
    if (!paused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [entries.length, paused])

  // 监听后端 cyber-feed 事件
  useEffect(() => {
    const push = useCyberFeedStore.getState().push
    const unsub = window.hintos.onCyberFeed?.((evt: { source: string; level: string; message: string; detail?: string }) => {
      push({
        source: evt.source,
        level: (evt.level as CyberFeedEntry['level']) || 'info',
        message: evt.message,
        detail: evt.detail
      })
    })
    return () => { unsub?.() }
  }, [])

  if (!expanded) {
    return (
      <div className="border-t border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 py-1.5">
        <button onClick={() => setExpanded(true)}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          <Terminal className="w-3.5 h-3.5" />
          <span className="font-mono">CYBER FEED</span>
          {entries.length > 0 && (
            <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] text-cyan-400 font-mono">
              {entries.length}
            </span>
          )}
          <ChevronUp className="w-3 h-3" />
        </button>
        {entries.length > 0 && (
          <span className="text-[10px] font-mono text-zinc-600 truncate max-w-md">
            {entries[entries.length - 1].message}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="border-t border-cyan-900/50 bg-zinc-950 flex flex-col" style={{ height: '240px' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-zinc-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-mono text-cyan-400 tracking-wider">CYBER FEED</span>
          <span className="text-[10px] font-mono text-zinc-600">{entries.length} entries</span>
          {paused && <span className="text-[10px] font-mono text-amber-400 animate-pulse">PAUSED</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={togglePause}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            title={paused ? 'Resume' : 'Pause'}>
            {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>
          <button onClick={clear}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Clear">
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={() => setExpanded(false)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed px-4 py-2 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700">
        {entries.length === 0 && (
          <div className="text-zinc-700 text-center py-8">
            <span className="animate-pulse">▌</span> Waiting for events...
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="flex gap-2 hover:bg-zinc-900/50 py-0.5">
            <span className="text-zinc-700 shrink-0">{formatTime(e.timestamp)}</span>
            <span className={`shrink-0 w-14 text-right ${SOURCE_COLORS[e.source] ?? 'text-zinc-500'}`}>
              [{e.source}]
            </span>
            <span className={LEVEL_COLORS[e.level] ?? 'text-zinc-400'}>
              {e.message}
              {e.detail && <span className="text-zinc-600 ml-2">— {e.detail}</span>}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
