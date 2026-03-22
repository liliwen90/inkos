import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { type ChatMessage, type ChatAction, type ChapterLandmarkData, AGENT_DEFS, useAgentChatStore } from '../stores/agent-chat-store'

// === Landmark Tooltip ===

function LandmarkTooltip({ children, text }: { children: React.ReactNode; text: string }): JSX.Element {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 whitespace-pre-wrap shadow-xl pointer-events-none">
          {text}
        </span>
      )}
    </span>
  )
}

// === Chapter Landmark ===

function ChapterLandmark({ data }: { data: ChapterLandmarkData }): JSX.Element {
  const hooksAddedTip = data.hooksAdded.length > 0
    ? `🪝 新增伏笔:\n${data.hooksAdded.map((h, i) => `${i + 1}. ${h.brief}`).join('\n')}`
    : '无新增伏笔'
  const hooksResolvedTip = data.hooksResolved.length > 0
    ? `✅ 解密伏笔:\n${data.hooksResolved.map((h, i) => `${i + 1}. ${h.brief}`).join('\n')}`
    : '无解密伏笔'

  return (
    <div className="mx-2 my-1.5 px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-base">📌</span>
        <LandmarkTooltip text={`📖 第${data.chapterNum}章故事大意:\n${data.chapterSummary}`}>
          <span className="font-medium text-zinc-200 cursor-help border-b border-dashed border-zinc-600">
            第{data.chapterNum}章《{data.title}》已定稿
          </span>
        </LandmarkTooltip>
      </div>
      <div className="flex items-center gap-3 mt-1 text-zinc-500">
        <span>字数: {data.wordCount}</span>
        <span>人物: {data.characters.join('、')}</span>
        <span>
          伏笔:{' '}
          <LandmarkTooltip text={hooksAddedTip}>
            <span className="text-emerald-400 cursor-help border-b border-dashed border-emerald-800">+{data.hooksAdded.length}</span>
          </LandmarkTooltip>
          {' '}
          <LandmarkTooltip text={hooksResolvedTip}>
            <span className="text-amber-400 cursor-help border-b border-dashed border-amber-800">-{data.hooksResolved.length}</span>
          </LandmarkTooltip>
        </span>
        <span>审计: {data.auditCritical} Critical</span>
      </div>
    </div>
  )
}

// === Action Buttons ===

function ActionButtons({ actions, messageId }: { actions: ChatAction[]; messageId: string }): JSX.Element {
  const respondToGate = useAgentChatStore((s) => s.resolveGate)

  const variantClass = (v: ChatAction['variant']): string =>
    v === 'primary' ? 'bg-violet-600 hover:bg-violet-500 text-white'
    : v === 'danger' ? 'bg-red-900/50 hover:bg-red-800/50 text-red-300 border border-red-800/50'
    : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actions.map((a) => (
        <button key={a.id}
          onClick={() => {
            window.hintos.respondToGate(a.id, a.id, '')
            respondToGate()
          }}
          className={`px-2 py-1 text-[11px] rounded ${variantClass(a.variant)} transition-colors`}>
          {a.icon && <span className="mr-1">{a.icon}</span>}
          {a.label}
        </button>
      ))}
    </div>
  )
}

// === Rich Data Expander ===

function RichDataSection({ data }: { data: unknown }): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  if (!data) return null

  return (
    <div className="mt-1.5">
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300">
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        详情
      </button>
      {expanded && (
        <pre className="mt-1 text-[10px] text-zinc-500 bg-zinc-900/50 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
          {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

// === Main Component ===

export default function AgentMessage({ message }: { message: ChatMessage }): JSX.Element {
  // Chapter landmark
  if (message.type === 'chapter-landmark' && message.landmark) {
    return <ChapterLandmark data={message.landmark} />
  }

  // System info
  if (message.type === 'system-info') {
    return (
      <div className="mx-2 my-1 px-3 py-1.5 text-center text-[11px] text-zinc-600">
        {message.content}
      </div>
    )
  }

  // User message
  if (message.type === 'user-text' || message.type === 'user-action') {
    return (
      <div className="flex justify-end mx-2 my-1.5">
        <div className="max-w-[80%] bg-violet-600/20 border border-violet-500/30 rounded-lg px-3 py-2 text-sm text-zinc-200">
          {message.content}
        </div>
      </div>
    )
  }

  // Agent message
  const def = message.agentName ? AGENT_DEFS[message.agentName] : null
  const icon = message.agentIcon || def?.icon || '🤖'
  const colorClass = message.agentColor || def?.color || 'text-zinc-400'
  const displayName = def?.displayName || message.agentName || 'Agent'

  const isGate = message.type === 'agent-gate'

  return (
    <div className={`mx-2 my-1.5 ${isGate ? 'border-l-2 border-amber-500/50 pl-1' : ''}`}>
      {/* Agent header */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-sm">{icon}</span>
        <span className={`text-[11px] font-medium ${colorClass}`}>{displayName}</span>
        {message.isStreaming && (
          <span className="w-1.5 h-3 bg-violet-400 animate-pulse rounded-sm" />
        )}
      </div>
      {/* Content */}
      <div className="bg-zinc-800/80 rounded-lg px-3 py-2 text-sm text-zinc-200 whitespace-pre-wrap">
        {message.content}
        {message.isStreaming && !message.content && (
          <span className="text-zinc-600 animate-pulse">思考中...</span>
        )}
      </div>
      {/* Rich data */}
      <RichDataSection data={message.richData} />
      {/* Action buttons */}
      {message.actions && message.actions.length > 0 && (
        <ActionButtons actions={message.actions} messageId={message.id} />
      )}
    </div>
  )
}
