import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, PenTool, FolderOpen, ChevronRight, BookOpenCheck, Loader2, Settings2, Trash2, Archive } from 'lucide-react'
import HintOSLogo from '../components/icons/HintOSLogo'
import { useAppStore, type BookSummary } from '../stores/app-store'
import { isEnglishGenre } from '../utils/lang'

const GENRES_ZH: Record<string, string> = {
  xuanhuan: '玄幻', xianxia: '仙侠', wuxia: '武侠', qihuan: '奇幻',
  urban: '都市', yanqing: '言情', xianshi: '现实',
  lishi: '历史', junshi: '军事', kehuan: '科幻',
  xuanyi: '悬疑', horror: '恐怖', lingyi: '灵异',
  youxi: '游戏', tiyu: '体育', erciyuan: '二次元',
  chuanyue: '穿越', chongsheng: '重生', moshi: '末世',
  wuxianliu: '无限流', zhutian: '诸天',
  tongren: '同人', duanpian: '短篇',
  xitong: '系统流', zhongtian: '种田文', guize: '规则怪谈',
  other: '通用'
}
const GENRES_EN: Record<string, string> = {
  'progression-fantasy': 'Progression Fantasy', 'cultivation': 'Cultivation',
  'litrpg': 'LitRPG', 'gamelit': 'GameLit', 'isekai': 'Isekai',
  'dungeon-core': 'Dungeon Core', 'epic-fantasy': 'Epic Fantasy',
  'urban-fantasy': 'Urban Fantasy', 'cozy-fantasy': 'Cozy Fantasy',
  'scifi': 'Sci-Fi', 'en-horror': 'Horror', 'apocalypse': 'Post-Apocalyptic',
  'system-apocalypse': 'System Apocalypse',
  other: 'General'
}
const GENRES: Record<string, string> = { ...GENRES_ZH, ...GENRES_EN }
const PLATFORMS_ZH: Record<string, string> = { qimao: '七猫', tomato: '番茄', qidian: '起点', feilu: '飞卢', other: '其他' }
const PLATFORMS_EN: Record<string, string> = {
  royalroad: 'Royal Road', kindle: 'Kindle / KU', patreon: 'Patreon',
  scribblehub: 'ScribbleHub', wattpad: 'Wattpad', other: 'Other'
}
const PLATFORMS: Record<string, string> = { ...PLATFORMS_ZH, ...PLATFORMS_EN }

export default function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const projectPath = useAppStore((s) => s.projectPath)
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const books = useAppStore((s) => s.books)
  const currentBookId = useAppStore((s) => s.currentBookId)
  const setBooks = useAppStore((s) => s.setBooks)
  const setProjectPath = useAppStore((s) => s.setProjectPath)
  const setProjectLoaded = useAppStore((s) => s.setProjectLoaded)
  const setProjectName = useAppStore((s) => s.setProjectName)
  const setCurrentBookId = useAppStore((s) => s.setCurrentBookId)
  const pipelineReady = useAppStore((s) => s.pipelineReady)
  const setPipelineReady = useAppStore((s) => s.setPipelineReady)
  const setLLMConfig = useAppStore((s) => s.setLLMConfig)
  const addToast = useAppStore((s) => s.addToast)
  const [editBook, setEditBook] = useState<BookSummary | null>(null)
  const [autoLoading, setAutoLoading] = useState(true)

  // 启动时自动恢复上次项目 + 自动初始化管线
  useEffect(() => {
    ;(async () => {
      try {
        const lastPath = await window.hintos.getLastProject()
        if (lastPath) {
          setProjectPath(lastPath)
          setProjectLoaded(true)
          // 自动初始化管线
          const result = await window.hintos.autoInitPipeline()
          if (result.ok) {
            setPipelineReady(true)
            // 同步 LLM 配置到 store
            const config = await window.hintos.loadLLMConfig()
            if (config) setLLMConfig(config)
          }
        }
      } finally {
        setAutoLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (projectLoaded) {
      loadBooks()
      window.hintos.loadProjectInfo().then((info: { name: string } | null) => {
        if (info) setProjectName(info.name)
      })
    }
  }, [projectLoaded])

  const loadBooks = async (): Promise<void> => {
    const data = await window.hintos.listBooks()
    setBooks(data as BookSummary[])
  }

  const handleOpenProject = async (): Promise<void> => {
    try {
      const result = await window.hintos.selectProjectDir()
      if (!result) return
      if (result.isProject) {
        setProjectPath(result.path)
        setProjectLoaded(true)
      } else {
        if (confirm(`${result.path} 不是 HintOS 项目。\n是否在此目录初始化新项目？`)) {
          const name = prompt('项目名称:', result.path.split(/[\\/]/).pop() ?? 'my-novel') ?? 'my-novel'
          await window.hintos.initProject(result.path, name)
          setProjectPath(result.path)
          setProjectLoaded(true)
        }
      }
    } catch (e) {
      addToast('error', `打开项目失败: ${(e as Error).message}`)
    }
  }

  const handleSelectBook = (bookId: string): void => {
    setCurrentBookId(bookId)
    navigate('/writing')
  }

  const handleDeleteBook = async (bookId: string, title: string): Promise<void> => {
    if (!confirm(`确定要删除《${title}》吗？\n\n此操作将永久删除该书的所有章节、真相文件和配置，不可恢复！`)) return
    try {
      if (currentBookId === bookId) setCurrentBookId(null)
      await window.hintos.deleteBook(bookId)
      await loadBooks()
      addToast('success', `✓ 已删除《${title}》`)
    } catch (err) {
      addToast('error', `删除失败: ${(err as Error).message}`)
    }
  }

  // 未加载项目 — 欢迎画面
  if (!projectLoaded) {
    if (autoLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-zinc-400 text-sm">正在恢复上次项目...</p>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="flex items-center gap-3">
          <HintOSLogo className="w-12 h-12 text-violet-400" />
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">HintOS Studio</h1>
            <p className="text-zinc-500 text-sm">多Agent小说生产系统 · 桌面版</p>
          </div>
        </div>
        <div className="max-w-md text-center space-y-4 mt-4">
          <p className="text-zinc-400 text-sm leading-relaxed">
            HintOS 通过建筑师、写手、审计员、修订员四个AI Agent协作，
            自动完成小说的创作、审计与修订全流程。
          </p>
          <button onClick={handleOpenProject}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
            <FolderOpen className="w-4 h-4" /> 打开 HintOS 项目
          </button>
          <p className="text-zinc-600 text-xs">选择包含 HintOS.json 的项目目录，或选择空目录初始化新项目</p>
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
        <button onClick={() => navigate('/idea-vault')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Archive className="w-4 h-4" /> 从创意库新建
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
            <p className="text-zinc-600 text-xs mt-1">每本小说从「创意库」中诞生</p>
            <button onClick={() => navigate('/idea-vault')}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors">
              <Archive className="w-4 h-4" /> 前往创意库 →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <div key={book.bookId}
                className="relative text-left border border-zinc-800 rounded-lg p-4 hover:border-violet-600/50 hover:bg-zinc-900/50 transition-all group">
                <button onClick={() => handleSelectBook(book.bookId)} className="w-full text-left">
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
                <BookPlanBadge bookId={book.bookId} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setEditBook(book) }}
                  className="absolute top-3 right-12 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-700 transition-all"
                  title="编辑书籍设置">
                  <Settings2 className="w-3.5 h-3.5 text-zinc-400" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteBook(book.bookId, book.title) }}
                  className="absolute top-3 right-3 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-900/50 transition-all"
                  title="删除书籍">
                  <Trash2 className="w-3.5 h-3.5 text-zinc-400 hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editBook && <EditBookDialog book={editBook} onClose={() => { setEditBook(null); loadBooks() }} />}
    </div>
  )
}

const STATUSES: Record<string, string> = {
  incubating: '孵化中', outlining: '大纲中', active: '连载中',
  paused: '暂停', completed: '完结', dropped: '弃坑'
}

function EditBookDialog({ book, onClose }: { book: BookSummary; onClose: () => void }): JSX.Element {
  const bookIsEnglish = isEnglishGenre(book.genre)
  const activeGenres = bookIsEnglish ? GENRES_EN : GENRES_ZH
  const activePlatforms = bookIsEnglish ? PLATFORMS_EN : PLATFORMS_ZH
  const [title, setTitle] = useState(book.title)
  const [genre, setGenre] = useState(book.genre)
  const [platform, setPlatform] = useState(book.platform)
  const [targetChapters, setTargetChapters] = useState(200)
  const [chapterWords, setChapterWords] = useState(3000)
  const [status, setStatus] = useState(book.status)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    window.hintos.loadBookConfig(book.bookId).then((cfg) => {
      const c = cfg as Record<string, unknown> | null
      if (c) {
        setTargetChapters((c.targetChapters as number) ?? 200)
        setChapterWords((c.chapterWordCount as number) ?? 3000)
      }
      setLoading(false)
    })
  }, [book.bookId])

  const addToast = useAppStore((s) => s.addToast)

  const handleSave = async (): Promise<void> => {
    if (!title.trim()) { setError('书名不能为空'); return }
    setSaving(true)
    setError('')
    try {
      await window.hintos.updateBookConfig(book.bookId, {
        title: title.trim(), genre, platform,
        targetChapters, chapterWordCount: chapterWords, status
      })
      addToast('success', '✓ 书籍设置已保存')
      onClose()
    } catch (err) {
      setError((err as Error).message)
      addToast('error', `保存失败: ${(err as Error).message}`)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-zinc-100">编辑书籍设置</h2>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">书名</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
            autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm text-zinc-300">{bookIsEnglish ? 'Genre' : '题材'}</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
              {Object.entries(activeGenres).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-zinc-300">{bookIsEnglish ? 'Platform' : '平台'}</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
              {Object.entries(activePlatforms).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm text-zinc-300">{bookIsEnglish ? 'Target Chapters' : '目标章数'}</label>
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
          <label className="block text-sm text-zinc-300">状态</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
            {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm transition-colors">
            取消
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? '保存中...' : loading ? '加载中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BookPlanBadge({ bookId }: { bookId: string }): JSX.Element | null {
  const [stats, setStats] = useState<{ pending: number; approved: number; written: number } | null>(null)
  useEffect(() => {
    window.hintos.planStats(bookId).then((s) => {
      const st = s as { pending: number; approved: number; written: number; total: number }
      if (st.total > 0) setStats(st)
    }).catch(() => {})
  }, [bookId])
  if (!stats) return null
  return (
    <div className="flex items-center gap-2 mt-2 text-[10px]">
      {stats.pending > 0 && <span className="text-amber-400">{stats.pending} 待审</span>}
      {stats.approved > 0 && <span className="text-emerald-400">{stats.approved} 可写</span>}
      {stats.written > 0 && <span className="text-blue-400">{stats.written} 已写</span>}
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
