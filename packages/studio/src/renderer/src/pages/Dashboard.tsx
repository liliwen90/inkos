import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, PenTool, Feather, FolderOpen, Plus, ChevronRight, BookOpenCheck } from 'lucide-react'
import { useAppStore, type BookSummary } from '../stores/app-store'

const GENRES: Record<string, string> = {
  xuanhuan: '玄幻', xianxia: '仙侠', urban: '都市', horror: '恐怖', other: '通用'
}
const PLATFORMS: Record<string, string> = {
  tomato: '番茄', qidian: '起点', feilu: '飞卢', other: '其他'
}

export default function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const projectPath = useAppStore((s) => s.projectPath)
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const books = useAppStore((s) => s.books)
  const setBooks = useAppStore((s) => s.setBooks)
  const setProjectPath = useAppStore((s) => s.setProjectPath)
  const setProjectLoaded = useAppStore((s) => s.setProjectLoaded)
  const setProjectName = useAppStore((s) => s.setProjectName)
  const setCurrentBookId = useAppStore((s) => s.setCurrentBookId)
  const pipelineReady = useAppStore((s) => s.pipelineReady)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (projectLoaded) {
      loadBooks()
      window.inkos.loadProjectInfo().then((info: { name: string } | null) => {
        if (info) setProjectName(info.name)
      })
    }
  }, [projectLoaded])

  const loadBooks = async (): Promise<void> => {
    const data = await window.inkos.listBooks()
    setBooks(data as BookSummary[])
  }

  const handleOpenProject = async (): Promise<void> => {
    const result = await window.inkos.selectProjectDir()
    if (!result) return
    if (result.isProject) {
      setProjectPath(result.path)
      setProjectLoaded(true)
    } else {
      if (confirm(`${result.path} 不是 InkOS 项目。\n是否在此目录初始化新项目？`)) {
        const name = prompt('项目名称:', result.path.split(/[\\/]/).pop() ?? 'my-novel') ?? 'my-novel'
        await window.inkos.initProject(result.path, name)
        setProjectPath(result.path)
        setProjectLoaded(true)
      }
    }
  }

  const handleSelectBook = (bookId: string): void => {
    setCurrentBookId(bookId)
    navigate('/writing')
  }

  // 未加载项目 — 欢迎画面
  if (!projectLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="flex items-center gap-3">
          <Feather className="w-12 h-12 text-violet-400" />
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">InkOS Studio</h1>
            <p className="text-zinc-500 text-sm">多Agent小说生产系统 · 桌面版</p>
          </div>
        </div>
        <div className="max-w-md text-center space-y-4 mt-4">
          <p className="text-zinc-400 text-sm leading-relaxed">
            InkOS 通过建筑师、写手、审计员、修订员四个AI Agent协作，
            自动完成小说的创作、审计与修订全流程。
          </p>
          <button onClick={handleOpenProject}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
            <FolderOpen className="w-4 h-4" /> 打开 InkOS 项目
          </button>
          <p className="text-zinc-600 text-xs">选择包含 inkos.json 的项目目录，或选择空目录初始化新项目</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-8 max-w-lg">
          <StatCard icon={<PenTool className="w-5 h-5" />} label="写→审→改" desc="全自动管线" />
          <StatCard icon={<BookOpen className="w-5 h-5" />} label="10项真相" desc="连续性保障" />
          <StatCard icon={<BookOpenCheck className="w-5 h-5" />} label="26维审计" desc="质量把关" />
        </div>
      </div>
    )
  }

  // 已加载项目 — 仪表盘
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">仪表盘</h1>
          <p className="text-zinc-500 text-sm mt-1">{projectPath}</p>
        </div>
        <button onClick={() => setShowCreate(true)} disabled={!pipelineReady}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          title={!pipelineReady ? '请先在LLM配置页配置并初始化连接' : ''}>
          <Plus className="w-4 h-4" /> 创建书籍
        </button>
      </div>

      {!pipelineReady && (
        <div className="border border-amber-800/50 bg-amber-950/30 rounded-lg p-4 text-sm">
          <p className="text-amber-400">⚠ LLM 管线未初始化</p>
          <p className="text-amber-500/70 mt-1">
            请先前往 <button onClick={() => navigate('/settings')} className="text-violet-400 underline">LLM 配置</button> 页面配置API连接，才能创建书籍和执行写作。
          </p>
        </div>
      )}

      {/* 书籍列表 */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-200 mb-3">书籍 ({books.length})</h2>
        {books.length === 0 ? (
          <div className="border border-zinc-800 rounded-lg p-8 text-center">
            <BookOpen className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">还没有书籍</p>
            <p className="text-zinc-600 text-xs mt-1">点击右上角「创建书籍」开始</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <button key={book.bookId} onClick={() => handleSelectBook(book.bookId)}
                className="text-left border border-zinc-800 rounded-lg p-4 hover:border-violet-600/50 hover:bg-zinc-900/50 transition-all group">
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-zinc-200 group-hover:text-violet-300">{book.title}</h3>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-violet-400 mt-0.5" />
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                  <span className="px-2 py-0.5 bg-zinc-800 rounded">{GENRES[book.genre] ?? book.genre}</span>
                  <span className="px-2 py-0.5 bg-zinc-800 rounded">{PLATFORMS[book.platform] ?? book.platform}</span>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                  <span>{book.chapterCount} 章</span>
                  <span>{book.totalWords.toLocaleString()} 字</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    book.status === 'active' ? 'bg-emerald-900/50 text-emerald-400' :
                    book.status === 'completed' ? 'bg-blue-900/50 text-blue-400' :
                    'bg-zinc-800 text-zinc-400'
                  }`}>{book.status}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateBookDialog onClose={() => { setShowCreate(false); loadBooks() }} />}
    </div>
  )
}

// ===== 创建书籍对话框 =====

function CreateBookDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('xuanhuan')
  const [platform, setPlatform] = useState('tomato')
  const [targetChapters, setTargetChapters] = useState(200)
  const [chapterWords, setChapterWords] = useState(3000)
  const [context, setContext] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const addProgressEvent = useAppStore((s) => s.addProgressEvent)

  const handleCreate = async (): Promise<void> => {
    if (!title.trim()) { setError('请输入书名'); return }
    setCreating(true)
    setError('')
    try {
      const unsub = window.inkos.onProgress((evt: unknown) => {
        addProgressEvent(evt as { stage: string; detail: string; timestamp: number })
      })
      await window.inkos.createBook({
        title: title.trim(), genre, platform,
        targetChapters, chapterWordCount: chapterWords,
        context: context.trim() || undefined
      })
      unsub()
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-zinc-100">创建新书</h2>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">书名 *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
            placeholder="我的小说" autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm text-zinc-300">题材</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
              {Object.entries(GENRES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-zinc-300">平台</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
              {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm text-zinc-300">目标章数</label>
            <input type="number" value={targetChapters} onChange={(e) => setTargetChapters(+e.target.value)}
              min={1} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-zinc-300">每章字数</label>
            <input type="number" value={chapterWords} onChange={(e) => setChapterWords(+e.target.value)}
              min={1000} step={500} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">创作指导 (可选)</label>
          <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
            placeholder="描述你想要的故事方向、角色、世界观等..." />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} disabled={creating}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm transition-colors">
            取消
          </button>
          <button onClick={handleCreate} disabled={creating}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {creating ? '创建中（AI正在生成世界观）...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-zinc-800 text-center">
      <div className="text-violet-400">{icon}</div>
      <span className="text-sm font-medium text-zinc-200">{label}</span>
      <span className="text-xs text-zinc-500">{desc}</span>
    </div>
  )
}
