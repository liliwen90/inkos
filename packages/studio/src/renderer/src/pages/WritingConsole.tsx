import { useEffect, useState, useCallback } from 'react'
import { PenTool, Play, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { useAppStore, type ProgressEvent, type BookSummary } from '../stores/app-store'

const STAGES = [
  { key: 'pipeline', label: '管线' },
  { key: 'architect', label: '建筑师' },
  { key: 'writer', label: '写手' },
  { key: 'auditor', label: '审计' },
  { key: 'continuity-plus', label: '深度审查' },
  { key: 'reviser', label: '修订' },
  { key: 'polisher', label: '润色' }
]

type StageStatus = 'idle' | 'running' | 'done' | 'error'

function getStageStatuses(events: ProgressEvent[]): Record<string, StageStatus> {
  const statuses: Record<string, StageStatus> = {}
  for (const e of events) {
    const base = e.stage.replace(/-done$/, '').replace(/-error$/, '')
    if (e.stage.endsWith('-done')) statuses[base] = 'done'
    else if (e.stage.endsWith('-error')) statuses[base] = 'error'
    else statuses[base] = 'running'
  }
  return statuses
}

export default function WritingConsole(): JSX.Element {
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const books = useAppStore((s) => s.books)
  const currentBookId = useAppStore((s) => s.currentBookId)
  const setCurrentBookId = useAppStore((s) => s.setCurrentBookId)
  const pipelineReady = useAppStore((s) => s.pipelineReady)
  const progressEvents = useAppStore((s) => s.progressEvents)
  const addProgressEvent = useAppStore((s) => s.addProgressEvent)
  const clearProgress = useAppStore((s) => s.clearProgress)
  const isWriting = useAppStore((s) => s.isWriting)
  const setIsWriting = useAppStore((s) => s.setIsWriting)
  const setBooks = useAppStore((s) => s.setBooks)

  const [wordCount, setWordCount] = useState(3000)
  const [batchCount, setBatchCount] = useState(1)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [completedChapters, setCompletedChapters] = useState(0)

  // 监听进度事件
  useEffect(() => {
    const unsub = window.hintos.onProgress((evt: unknown) => {
      addProgressEvent(evt as ProgressEvent)
    })
    return unsub
  }, [addProgressEvent])

  // 加载书籍列表
  useEffect(() => {
    if (projectLoaded) {
      window.hintos.listBooks().then((data) => setBooks(data as BookSummary[]))
    }
  }, [projectLoaded, setBooks])

  const handleWriteNext = useCallback(async () => {
    if (!currentBookId || !pipelineReady) return
    setIsWriting(true)
    clearProgress()
    setResult(null)
    setError('')
    setCompletedChapters(0)

    try {
      for (let i = 0; i < batchCount; i++) {
        try {
          const res = await window.hintos.writeNext(currentBookId, wordCount)
          setResult(res)
          setCompletedChapters(i + 1)
        } catch (chapterErr) {
          setError(`第${i + 1}章失败: ${(chapterErr as Error).message}${i > 0 ? `（已成功${i}章）` : ''}`)
          break
        }
      }
      // 刷新书籍列表
      window.hintos.listBooks().then((data) => setBooks(data as BookSummary[]))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsWriting(false)
    }
  }, [currentBookId, pipelineReady, wordCount, batchCount])

  if (!projectLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <PenTool className="w-8 h-8 mb-2" />
        <p>请先打开 HintOS 项目</p>
      </div>
    )
  }

  const stageStatuses = getStageStatuses(progressEvents)
  const currentBook = books.find(b => b.bookId === currentBookId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">写作控制台</h1>
        <p className="text-zinc-500 text-sm mt-1">一键驱动完整管线: 写→审→查→改→润</p>
      </div>

      {/* 书籍选择 */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-1">当前书籍</label>
          <select value={currentBookId ?? ''} onChange={(e) => setCurrentBookId(e.target.value || null)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
            <option value="">— 请选择书籍 —</option>
            {books.map(b => (
              <option key={b.bookId} value={b.bookId}>
                {b.title} ({b.chapterCount}章 / {b.totalWords.toLocaleString()}字)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">每章字数</label>
          <input type="number" value={wordCount} onChange={(e) => setWordCount(+e.target.value)}
            min={1000} step={500}
            className="w-28 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">连续写</label>
          <input type="number" value={batchCount} onChange={(e) => setBatchCount(Math.max(1, +e.target.value))}
            min={1} max={50}
            className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500" />
        </div>
      </div>

      {/* 管线阶段指示器 */}
      <div className="border border-zinc-800 rounded-lg p-5">
        <div className="flex items-center gap-3 mb-4">
          {STAGES.map((stage, i) => (
            <div key={stage.key} className="flex items-center gap-3">
              {i > 0 && <div className="w-8 h-px bg-zinc-700" />}
              <StageIndicator label={stage.label} status={stageStatuses[stage.key] ?? 'idle'} />
            </div>
          ))}
        </div>

        {/* 写作按钮 */}
        <div className="flex items-center gap-4">
          <button onClick={handleWriteNext}
            disabled={!currentBookId || !pipelineReady || isWriting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
            {isWriting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 写作中{batchCount > 1 ? ` (${completedChapters}/${batchCount})` : ''}...</>
            ) : (
              <><Play className="w-4 h-4" /> 写下{batchCount > 1 ? `${batchCount}章` : '一章'}</>
            )}
          </button>
          {currentBook && (
            <span className="text-zinc-500 text-sm">
              下一章: 第{currentBook.chapterCount + 1}章
            </span>
          )}
        </div>
      </div>

      {/* 进度日志 */}
      {progressEvents.length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">进度日志</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {progressEvents.map((e, i) => {
              const base = e.stage.replace(/-done$/, '').replace(/-error$/, '')
              const resolvedStatus = stageStatuses[base] ?? 'running'
              const isDoneEvent = e.stage.endsWith('-done')
              const isErrorEvent = e.stage.endsWith('-error')
              const isStartEvent = !isDoneEvent && !isErrorEvent
              // 起始事件的图标跟随最终状态（done/error），完成/错误事件保持自己的图标
              const showDone = isDoneEvent || (isStartEvent && resolvedStatus === 'done')
              const showError = isErrorEvent || (isStartEvent && resolvedStatus === 'error')
              return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-zinc-600 w-20 shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
                {showDone ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> :
                 showError ? <XCircle className="w-3 h-3 text-red-500 shrink-0" /> :
                 <Loader2 className="w-3 h-3 text-violet-400 animate-spin shrink-0" />}
                <span className={showError ? 'text-red-400' : 'text-zinc-400'}>{e.detail}</span>
              </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 结果 */}
      {result && !isWriting && (
        <div className="border border-emerald-800/50 bg-emerald-950/20 rounded-lg p-4">
          <h3 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> 写作完成
          </h3>
          <pre className="text-xs text-zinc-400 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="border border-red-800/50 bg-red-950/20 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-400 mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> 错误
          </h3>
          <p className="text-xs text-red-300/80">{error}</p>
        </div>
      )}
    </div>
  )
}

function StageIndicator({ label, status }: { label: string; status: StageStatus }): JSX.Element {
  const styles = {
    idle: 'bg-zinc-800 text-zinc-500 border-zinc-700',
    running: 'bg-violet-600/20 text-violet-300 border-violet-500 animate-pulse',
    done: 'bg-emerald-600/20 text-emerald-400 border-emerald-600',
    error: 'bg-red-600/20 text-red-400 border-red-600'
  }
  return (
    <span className={`px-3 py-1.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {status === 'running' && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
      {label}
    </span>
  )
}
