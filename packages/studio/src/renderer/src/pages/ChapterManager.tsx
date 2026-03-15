import { useEffect, useState } from 'react'
import { BookOpen, Check, X, Eye, Download, ChevronLeft } from 'lucide-react'
import { useAppStore, type BookSummary, type ChapterMeta } from '../stores/app-store'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  'drafted': { label: '草稿', color: 'bg-zinc-700 text-zinc-300' },
  'drafting': { label: '写作中', color: 'bg-violet-800/50 text-violet-300' },
  'auditing': { label: '审计中', color: 'bg-amber-800/50 text-amber-300' },
  'audit-passed': { label: '审计通过', color: 'bg-emerald-800/50 text-emerald-300' },
  'audit-failed': { label: '审计未通', color: 'bg-red-800/50 text-red-300' },
  'revising': { label: '修订中', color: 'bg-orange-800/50 text-orange-300' },
  'ready-for-review': { label: '待审阅', color: 'bg-blue-800/50 text-blue-300' },
  'approved': { label: '已通过', color: 'bg-emerald-700/50 text-emerald-200' },
  'rejected': { label: '驳回', color: 'bg-red-700/50 text-red-200' },
  'published': { label: '已发布', color: 'bg-indigo-800/50 text-indigo-300' }
}

export default function ChapterManager(): JSX.Element {
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const books = useAppStore((s) => s.books)
  const currentBookId = useAppStore((s) => s.currentBookId)
  const setCurrentBookId = useAppStore((s) => s.setCurrentBookId)
  const setBooks = useAppStore((s) => s.setBooks)

  const [chapters, setChapters] = useState<ChapterMeta[]>([])
  const [selectedChapter, setSelectedChapter] = useState<ChapterMeta | null>(null)
  const [chapterContent, setChapterContent] = useState('')
  const [loading, setLoading] = useState(false)

  // 加载书籍列表
  useEffect(() => {
    if (projectLoaded) {
      window.inkos.listBooks().then((data) => setBooks(data as BookSummary[]))
    }
  }, [projectLoaded, setBooks])

  // 加载章节列表
  useEffect(() => {
    if (currentBookId) {
      loadChapters()
    } else {
      setChapters([])
    }
  }, [currentBookId])

  const loadChapters = async (): Promise<void> => {
    if (!currentBookId) return
    const data = await window.inkos.loadChapterIndex(currentBookId)
    setChapters(data as ChapterMeta[])
  }

  const handleViewChapter = async (ch: ChapterMeta): Promise<void> => {
    if (!currentBookId) return
    setLoading(true)
    try {
      const filename = `${String(ch.number).padStart(4, '0')}_${ch.title?.replace(/[/\\:*?"<>|]/g, '_') ?? ''}.md`
      const content = await window.inkos.loadChapterContent(currentBookId, filename)
      setChapterContent(content)
      setSelectedChapter(ch)
    } catch {
      setChapterContent('（无法加载章节内容）')
      setSelectedChapter(ch)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (ch: ChapterMeta): Promise<void> => {
    if (!currentBookId) return
    await window.inkos.updateChapterStatus(currentBookId, ch.number, 'approved')
    loadChapters()
  }

  const handleReject = async (ch: ChapterMeta): Promise<void> => {
    if (!currentBookId) return
    const note = prompt('驳回理由（可选）:')
    await window.inkos.updateChapterStatus(currentBookId, ch.number, 'rejected', note ?? undefined)
    loadChapters()
  }

  const handleExport = async (): Promise<void> => {
    if (!currentBookId) return
    await window.inkos.exportBook(currentBookId, 'md')
  }

  if (!projectLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <BookOpen className="w-8 h-8 mb-2" />
        <p>请先打开 InkOS 项目</p>
      </div>
    )
  }

  // 章节详情视图
  if (selectedChapter) {
    const st = STATUS_LABELS[selectedChapter.status] ?? { label: selectedChapter.status, color: 'bg-zinc-700 text-zinc-300' }
    return (
      <div className="space-y-4 h-full flex flex-col">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedChapter(null)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-zinc-100">
              第{selectedChapter.number}章 {selectedChapter.title}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
              <span className={`px-2 py-0.5 rounded ${st.color}`}>{st.label}</span>
              <span>{selectedChapter.wordCount} 字</span>
              <span>{new Date(selectedChapter.updatedAt).toLocaleString()}</span>
            </div>
          </div>
          {(selectedChapter.status === 'ready-for-review' || selectedChapter.status === 'drafted') && (
            <div className="flex gap-2">
              <button onClick={() => handleApprove(selectedChapter)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs">
                <Check className="w-3 h-3" /> 通过
              </button>
              <button onClick={() => handleReject(selectedChapter)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs">
                <X className="w-3 h-3" /> 驳回
              </button>
            </div>
          )}
        </div>

        {selectedChapter.auditIssues?.length > 0 && (
          <div className="border border-amber-800/40 bg-amber-950/20 rounded-lg p-3">
            <p className="text-xs font-medium text-amber-400 mb-1">审计问题 ({selectedChapter.auditIssues.length})</p>
            <ul className="text-xs text-amber-300/70 space-y-0.5 list-disc list-inside">
              {selectedChapter.auditIssues.map((issue, i) => <li key={i}>{issue}</li>)}
            </ul>
          </div>
        )}

        <div className="flex-1 border border-zinc-800 rounded-lg p-5 overflow-y-auto">
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-zinc-300 leading-relaxed">
            {loading ? '加载中...' : chapterContent}
          </div>
        </div>
      </div>
    )
  }

  // 章节列表视图
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">章节管理</h1>
          <p className="text-zinc-500 text-sm mt-1">查看、审阅和管理所有章节</p>
        </div>
        {currentBookId && chapters.length > 0 && (
          <button onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" /> 导出
          </button>
        )}
      </div>

      {/* 书籍选择 */}
      <select value={currentBookId ?? ''} onChange={(e) => setCurrentBookId(e.target.value || null)}
        className="w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
        <option value="">— 请选择书籍 —</option>
        {books.map(b => <option key={b.bookId} value={b.bookId}>{b.title}</option>)}
      </select>

      {!currentBookId ? (
        <div className="border border-zinc-800 rounded-lg p-8 text-center">
          <BookOpen className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">选择一本书查看章节列表</p>
        </div>
      ) : chapters.length === 0 ? (
        <div className="border border-zinc-800 rounded-lg p-8 text-center">
          <BookOpen className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">这本书还没有章节</p>
          <p className="text-zinc-600 text-xs mt-1">前往「写作控制台」开始创作</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg divide-y divide-zinc-800">
          {chapters.map((ch) => {
            const st = STATUS_LABELS[ch.status] ?? { label: ch.status, color: 'bg-zinc-700 text-zinc-300' }
            return (
              <div key={ch.number}
                className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-900/50 transition-colors">
                <span className="text-zinc-600 text-sm w-8 text-right">{ch.number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{ch.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{ch.wordCount}字 · {new Date(ch.updatedAt).toLocaleDateString()}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] ${st.color}`}>{st.label}</span>
                <button onClick={() => handleViewChapter(ch)}
                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="查看">
                  <Eye className="w-4 h-4" />
                </button>
                {(ch.status === 'ready-for-review' || ch.status === 'drafted') && (
                  <>
                    <button onClick={() => handleApprove(ch)}
                      className="p-1.5 rounded hover:bg-emerald-900/50 text-zinc-500 hover:text-emerald-400 transition-colors"
                      title="通过">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleReject(ch)}
                      className="p-1.5 rounded hover:bg-red-900/50 text-zinc-500 hover:text-red-400 transition-colors"
                      title="驳回">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
