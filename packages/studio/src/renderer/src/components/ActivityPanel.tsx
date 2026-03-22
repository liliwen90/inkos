import { useState, useEffect, useRef } from 'react'
import { Activity, Minimize2, Maximize2, X, Loader2, CheckCircle2, XCircle, Trash2, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { useAppStore, type ActivityEntry } from '../stores/app-store'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m${Math.floor((ms % 60_000) / 1000)}s`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

function StatusIcon({ status }: { status: ActivityEntry['status'] }): JSX.Element {
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin shrink-0" />
  if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
  return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
}

function ActivityItem({ act, now }: { act: ActivityEntry; now: number }): JSX.Element {
  const elapsed = (act.finishedAt ?? now) - act.startedAt
  return (
    <div className={`flex items-start gap-2 px-3 py-1.5 text-xs ${act.status === 'running' ? 'bg-violet-950/30' : ''}`}>
      <StatusIcon status={act.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-zinc-600 shrink-0">{formatTime(act.startedAt)}</span>
          <span className="font-medium text-zinc-200 truncate">{act.operation}</span>
          <span className="text-zinc-600 ml-auto shrink-0">{formatDuration(elapsed)}</span>
        </div>
        {act.detail && <p className="text-zinc-500 truncate">{act.detail}</p>}
        {act.progress !== undefined && act.status === 'running' && (
          <div className="mt-0.5 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all duration-300" style={{ width: `${Math.min(act.progress, 100)}%` }} />
          </div>
        )}
        {act.error && <p className="text-red-400 truncate">{act.error}</p>}
      </div>
    </div>
  )
}

export default function ActivityPanel(): JSX.Element {
  const activities = useAppStore((s) => s.activities)
  const errorLog = useAppStore((s) => s.errorLog)
  const panelOpen = useAppStore((s) => s.panelOpen)
  const panelMinimized = useAppStore((s) => s.panelMinimized)
  const togglePanel = useAppStore((s) => s.togglePanel)
  const minimizePanel = useAppStore((s) => s.minimizePanel)
  const restorePanel = useAppStore((s) => s.restorePanel)
  const clearActivities = useAppStore((s) => s.clearActivities)

  const [now, setNow] = useState(Date.now())
  const [tab, setTab] = useState<'activities' | 'errors'>('activities')
  const [errorsOpen, setErrorsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const runningCount = activities.filter((a) => a.status === 'running').length

  // 实时更新时间（运行中时每秒刷新）
  useEffect(() => {
    if (runningCount === 0) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [runningCount])

  // === 最小化 Badge ===
  if (!panelOpen || panelMinimized) {
    return (
      <button
        onClick={restorePanel}
        className="fixed bottom-4 right-4 z-[9998] flex items-center gap-1.5 px-3 py-2 bg-zinc-800/90 border border-zinc-700/60 rounded-full shadow-lg backdrop-blur-sm hover:bg-zinc-700/90 transition-colors"
      >
        <Activity className="w-4 h-4 text-violet-400" />
        {runningCount > 0 && (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
            <span className="text-xs text-zinc-300">{runningCount}</span>
          </>
        )}
        {runningCount === 0 && activities.length > 0 && (
          <span className="text-xs text-zinc-500">{activities.filter((a) => a.status === 'done').length}✓</span>
        )}
      </button>
    )
  }

  // === 展开面板 ===
  return (
    <div className="fixed bottom-4 right-4 z-[9998] w-[380px] max-h-[500px] flex flex-col bg-zinc-900/95 border border-zinc-700/60 rounded-xl shadow-2xl backdrop-blur-sm">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <Activity className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-zinc-200">运行状态</span>
        {runningCount > 0 && (
          <span className="text-xs text-violet-400 animate-pulse">{runningCount} 进行中</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={clearActivities} className="p-1 text-zinc-600 hover:text-zinc-400" title="清除">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={minimizePanel} className="p-1 text-zinc-600 hover:text-zinc-400" title="最小化">
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={togglePanel} className="p-1 text-zinc-600 hover:text-zinc-400" title="关闭">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab 栏 */}
      <div className="flex border-b border-zinc-800 text-xs">
        <button onClick={() => setTab('activities')} className={`flex-1 py-1.5 text-center transition-colors ${tab === 'activities' ? 'text-violet-400 border-b border-violet-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
          活动 {activities.length > 0 && <span className="ml-1 text-zinc-600">({activities.length})</span>}
        </button>
        <button onClick={() => setTab('errors')} className={`flex-1 py-1.5 text-center transition-colors ${tab === 'errors' ? 'text-red-400 border-b border-red-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
          错误 {errorLog.length > 0 && <span className="text-red-500">({errorLog.length})</span>}
        </button>
      </div>

      {/* 内容区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-[60px] max-h-[380px]">
        {/* === 活动列表 === */}
        {tab === 'activities' && (
          <div className="divide-y divide-zinc-800/50">
            {activities.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-600">暂无活动</div>
            ) : (
              activities.map((act) => <ActivityItem key={act.id} act={act} now={now} />)
            )}
          </div>
        )}

        {/* === 错误日志 === */}
        {tab === 'errors' && (
          <div className="p-3 space-y-1">
            {errorLog.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-600">🎉 无错误</div>
            ) : (
              [...errorLog].reverse().map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs px-2 py-1.5 bg-red-950/20 rounded border border-red-900/30">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-600">{formatTime(e.timestamp)}</span>
                      {e.operation && <span className="text-zinc-500">· {e.operation}</span>}
                    </div>
                    <p className="text-red-300 break-words">{e.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-800 text-[10px] text-zinc-600">
        <span>{activities.filter((a) => a.status === 'done').length} 已完成 · {errorLog.length} 错误</span>
      </div>
    </div>
  )
}
