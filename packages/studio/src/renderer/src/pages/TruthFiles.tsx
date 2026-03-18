import { useEffect, useState } from 'react'
import { ScrollText, Loader2 } from 'lucide-react'
import { useAppStore, type BookSummary } from '../stores/app-store'

const TRUTH_FILES = [
  { file: 'current_state.md', label: '当前状态', desc: '角色位置/状态/情绪' },
  { file: 'particle_ledger.md', label: '资源账本', desc: '道具/货币/能力值' },
  { file: 'pending_hooks.md', label: '伏笔池', desc: '未解伏笔追踪' },
  { file: 'story_bible.md', label: '世界观', desc: '世界设定百科' },
  { file: 'volume_outline.md', label: '卷纲', desc: '剧情大纲' },
  { file: 'book_rules.md', label: '本书规则', desc: '人设锁定/禁令' },
  { file: 'chapter_summaries.md', label: '章节摘要', desc: '各章简述' },
  { file: 'subplot_board.md', label: '支线进度板', desc: '支线状态' },
  { file: 'emotional_arcs.md', label: '情感弧线', desc: '角色情感走势' },
  { file: 'character_matrix.md', label: '角色交互矩阵', desc: '人物关系' }
]

export default function TruthFiles(): JSX.Element {
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const books = useAppStore((s) => s.books)
  const currentBookId = useAppStore((s) => s.currentBookId)
  const setCurrentBookId = useAppStore((s) => s.setCurrentBookId)
  const setBooks = useAppStore((s) => s.setBooks)

  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (projectLoaded) {
      window.hintos.listBooks().then((data) => setBooks(data as BookSummary[]))
    }
  }, [projectLoaded, setBooks])

  const handleSelectFile = async (filename: string): Promise<void> => {
    if (!currentBookId) return
    setActiveFile(filename)
    setLoading(true)
    try {
      const text = await window.hintos.loadTruthFile(currentBookId, filename)
      setContent(text || '（文件尚未创建，请先在仪表盘创建书籍或写一章后自动生成）')
    } catch {
      setContent('（加载失败）')
    } finally {
      setLoading(false)
    }
  }

  if (!projectLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <ScrollText className="w-8 h-8 mb-2" />
        <p>请先打开 HintOS 项目</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">真相文件</h1>
        <p className="text-zinc-500 text-sm mt-1">10个真相文件维护小说世界的一致性和连续性</p>
      </div>

      {/* 书籍选择 */}
      <select value={currentBookId ?? ''} onChange={(e) => { setCurrentBookId(e.target.value || null); setActiveFile(null); setContent('') }}
        className="w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
        <option value="">— 请选择书籍 —</option>
        {books.map(b => <option key={b.bookId} value={b.bookId}>{b.title}</option>)}
      </select>

      {!currentBookId ? (
        <div className="border border-zinc-800 rounded-lg p-8 text-center">
          <ScrollText className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">选择一本书查看真相文件</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* 文件标签列表 */}
          <div className="w-44 shrink-0 space-y-1 overflow-y-auto">
            {TRUTH_FILES.map((tf) => (
              <button key={tf.file} onClick={() => handleSelectFile(tf.file)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeFile === tf.file
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-600/40'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent'
                }`}>
                <div className="font-medium text-xs">{tf.label}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{tf.desc}</div>
              </button>
            ))}
          </div>

          {/* 内容区 */}
          <div className="flex-1 border border-zinc-800 rounded-lg overflow-hidden">
            {!activeFile ? (
              <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                ← 选择一个真相文件查看
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-full text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-5">
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-zinc-300 leading-relaxed">
                  {content}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
