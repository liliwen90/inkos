import { useEffect, useState, useCallback } from 'react'
import { FileCheck, Loader2, Check, X, Edit3, Play, RefreshCw, ChevronRight } from 'lucide-react'
import { useAppStore, type BookSummary, type ProgressEvent } from '../stores/app-store'

type PlanStatus = 'unplanned' | 'pending' | 'approved' | 'rejected' | 'written'

interface PlanEntry {
  chapter: number
  status: PlanStatus
  version: number
  createdAt?: string
  approvedAt?: string
  rejectedAt?: string
  writtenAt?: string
  feedback?: string
}

interface PlanIndex {
  plans: PlanEntry[]
}

interface PlanStats {
  total: number
  pending: number
  approved: number
  rejected: number
  written: number
}

const STATUS_CONFIG: Record<PlanStatus, { label: string; color: string; bg: string }> = {
  unplanned: { label: '未规划', color: 'text-zinc-500', bg: 'bg-zinc-800' },
  pending: { label: '待审核', color: 'text-amber-400', bg: 'bg-amber-900/30' },
  approved: { label: '已通过', color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
  rejected: { label: '已驳回', color: 'text-red-400', bg: 'bg-red-900/30' },
  written: { label: '已写作', color: 'text-blue-400', bg: 'bg-blue-900/30' },
}

export default function PlanReview(): JSX.Element {
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const books = useAppStore((s) => s.books)
  const currentBookId = useAppStore((s) => s.currentBookId)
  const setCurrentBookId = useAppStore((s) => s.setCurrentBookId)
  const pipelineReady = useAppStore((s) => s.pipelineReady)
  const setBooks = useAppStore((s) => s.setBooks)
  const addProgressEvent = useAppStore((s) => s.addProgressEvent)

  const [planIndex, setPlanIndex] = useState<PlanIndex>({ plans: [] })
  const [stats, setStats] = useState<PlanStats | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [planContent, setPlanContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [feedbackText, setFeedbackText] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingAction, setLoadingAction] = useState('')

  // Listen to progress events
  useEffect(() => {
    const unsub = window.hintos.onProgress((evt: unknown) => {
      addProgressEvent(evt as ProgressEvent)
    })
    return unsub
  }, [addProgressEvent])

  // Load books
  useEffect(() => {
    if (projectLoaded) {
      window.hintos.listBooks().then((data) => setBooks(data as BookSummary[]))
    }
  }, [projectLoaded, setBooks])

  // Load plan index when book changes
  const loadPlans = useCallback(async () => {
    if (!currentBookId) return
    const [idx, st] = await Promise.all([
      window.hintos.planList(currentBookId),
      window.hintos.planStats(currentBookId),
    ])
    setPlanIndex(idx as PlanIndex)
    setStats(st as PlanStats)
  }, [currentBookId])

  useEffect(() => {
    loadPlans()
    setSelectedChapter(null)
    setPlanContent('')
  }, [currentBookId, loadPlans])

  // Load selected chapter plan
  useEffect(() => {
    if (!currentBookId || selectedChapter === null) {
      setPlanContent('')
      return
    }
    window.hintos.planGet(currentBookId, selectedChapter).then(setPlanContent)
  }, [currentBookId, selectedChapter])

  const selectedEntry = planIndex.plans.find((p) => p.chapter === selectedChapter)

  // Actions
  const handlePlanNext = async (): Promise<void> => {
    if (!currentBookId || !pipelineReady) return
    setLoading(true)
    setLoadingAction('生成大纲中...')
    try {
      const entry = await window.hintos.planNext(currentBookId) as PlanEntry
      await loadPlans()
      setSelectedChapter(entry.chapter)
    } catch (err) {
      alert(`大纲生成失败: ${(err as Error).message}`)
    } finally {
      setLoading(false)
      setLoadingAction('')
    }
  }

  const handleApprove = async (): Promise<void> => {
    if (!currentBookId || selectedChapter === null) return
    await window.hintos.planApprove(currentBookId, selectedChapter)
    await loadPlans()
  }

  const handleReject = async (): Promise<void> => {
    if (!currentBookId || selectedChapter === null || !feedbackText.trim()) return
    const feedback = feedbackText.trim()
    setLoading(true)
    setLoadingAction('驳回并重新规划中...')
    try {
      await window.hintos.planReject(currentBookId, selectedChapter, feedback)
      setShowRejectModal(false)
      setFeedbackText('')
      // Auto-replan
      if (pipelineReady) {
        const entry = await window.hintos.planReplan(currentBookId, selectedChapter, feedback) as PlanEntry
        void entry
      }
      await loadPlans()
      // Reload plan content
      const newContent = await window.hintos.planGet(currentBookId, selectedChapter)
      setPlanContent(newContent)
    } catch (err) {
      alert(`重新规划失败: ${(err as Error).message}`)
    } finally {
      setLoading(false)
      setLoadingAction('')
    }
  }

  const handleSaveEdit = async (): Promise<void> => {
    if (!currentBookId || selectedChapter === null) return
    await window.hintos.planUpdate(currentBookId, selectedChapter, editContent)
    setPlanContent(editContent)
    setIsEditing(false)
    await loadPlans()
  }

  const handleStartEdit = (): void => {
    setEditContent(planContent)
    setIsEditing(true)
  }

  const handleBatchWrite = async (): Promise<void> => {
    if (!currentBookId || !pipelineReady) return
    const approved = planIndex.plans.filter((p) => p.status === 'approved')
    if (approved.length === 0) {
      alert('没有已审核的章节大纲可以写作')
      return
    }
    setLoading(true)
    setLoadingAction(`写作 ${approved.length} 章...`)
    try {
      for (const plan of approved) {
        setLoadingAction(`写作第${plan.chapter}章...`)
        await window.hintos.writeNext(currentBookId)
      }
      await loadPlans()
      window.hintos.listBooks().then((data) => setBooks(data as BookSummary[]))
    } catch (err) {
      alert(`写作失败: ${(err as Error).message}`)
    } finally {
      setLoading(false)
      setLoadingAction('')
    }
  }

  if (!projectLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <FileCheck className="w-8 h-8 mb-2" />
        <p>请先打开 HintOS 项目</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">章节企划</h1>
          <p className="text-zinc-500 text-sm mt-1">逐章规划大纲 → 审核 → 批量写作</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePlanNext}
            disabled={!currentBookId || !pipelineReady || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors">
            {loading && loadingAction.includes('大纲') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            生成下一章大纲
          </button>
          <button onClick={handleBatchWrite}
            disabled={!currentBookId || !pipelineReady || loading || !stats?.approved}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors">
            {loading && loadingAction.includes('写作') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            写作已审核章节{stats?.approved ? ` (${stats.approved})` : ''}
          </button>
        </div>
      </div>

      {/* Book selector + stats */}
      <div className="flex items-center gap-4">
        <select value={currentBookId ?? ''} onChange={(e) => setCurrentBookId(e.target.value || null)}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
          <option value="">— 请选择书籍 —</option>
          {books.map(b => <option key={b.bookId} value={b.bookId}>{b.title}</option>)}
        </select>
        {stats && stats.total > 0 && (
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="text-amber-400">{stats.pending} 待审</span>
            <span className="text-emerald-400">{stats.approved} 已通过</span>
            <span className="text-blue-400">{stats.written} 已写作</span>
            {stats.rejected > 0 && <span className="text-red-400">{stats.rejected} 驳回</span>}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-violet-400 px-1">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{loadingAction}</span>
        </div>
      )}

      {!currentBookId ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          <p>请选择一本书籍开始规划</p>
        </div>
      ) : planIndex.plans.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
          <FileCheck className="w-8 h-8 text-zinc-600" />
          <p>还没有章节大纲</p>
          <p className="text-xs text-zinc-600">点击「生成下一章大纲」开始规划</p>
        </div>
      ) : (
        /* Split panel: left = chapter list, right = plan detail */
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left: Chapter list */}
          <div className="w-64 shrink-0 border border-zinc-800 rounded-lg overflow-y-auto">
            {planIndex.plans.map((plan) => {
              const cfg = STATUS_CONFIG[plan.status]
              const isSelected = selectedChapter === plan.chapter
              return (
                <button key={plan.chapter}
                  onClick={() => setSelectedChapter(plan.chapter)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm border-b border-zinc-800/50 transition-colors ${
                    isSelected ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50'
                  }`}>
                  <span>第{plan.chapter}章</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    {plan.version > 1 && <span className="text-[10px] text-zinc-600">v{plan.version}</span>}
                    {isSelected && <ChevronRight className="w-3 h-3 text-zinc-500" />}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Right: Plan detail */}
          <div className="flex-1 border border-zinc-800 rounded-lg p-4 overflow-y-auto">
            {selectedChapter === null ? (
              <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                ← 选择一个章节查看大纲
              </div>
            ) : !planContent ? (
              <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载中...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Action bar */}
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                  <span className="text-sm font-medium text-zinc-300">第{selectedChapter}章大纲</span>
                  {selectedEntry && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_CONFIG[selectedEntry.status].bg} ${STATUS_CONFIG[selectedEntry.status].color}`}>
                      {STATUS_CONFIG[selectedEntry.status].label}
                      {selectedEntry.version > 1 && ` v${selectedEntry.version}`}
                    </span>
                  )}
                  <div className="flex-1" />

                  {selectedEntry?.status === 'pending' && (
                    <>
                      <button onClick={handleApprove} disabled={loading}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded text-xs font-medium">
                        <Check className="w-3 h-3" /> 通过
                      </button>
                      <button onClick={() => setShowRejectModal(true)} disabled={loading}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded text-xs font-medium">
                        <X className="w-3 h-3" /> 驳回
                      </button>
                    </>
                  )}

                  {selectedEntry?.status === 'approved' && !isEditing && (
                    <button onClick={handleStartEdit}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded text-xs font-medium">
                      <Edit3 className="w-3 h-3" /> 微调
                    </button>
                  )}
                </div>

                {/* Rejected feedback display */}
                {selectedEntry?.status === 'rejected' && selectedEntry.feedback && (
                  <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3 text-sm">
                    <span className="text-red-400 font-medium">驳回原因：</span>
                    <span className="text-zinc-300">{selectedEntry.feedback}</span>
                  </div>
                )}

                {/* Plan content */}
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-96 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 font-mono focus:outline-none focus:border-violet-500 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs font-medium">保存</button>
                      <button onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded text-xs font-medium">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed font-sans">
                      {planContent}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowRejectModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-[480px] space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-zinc-100">驳回大纲</h3>
            <p className="text-sm text-zinc-400">请说明驳回原因，Architect 将根据反馈重新规划。</p>
            <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="例如：节奏太慢，需要在本章引入更多冲突..."
              className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-violet-500 resize-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowRejectModal(false); setFeedbackText('') }}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm">取消</button>
              <button onClick={handleReject}
                disabled={!feedbackText.trim() || loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '驳回并重新规划'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
