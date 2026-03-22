import { useState } from 'react'
import { TrendingUp, Loader2, Sparkles, Globe, FolderOpen, X, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../stores/app-store'
import { AnalysisRenderer, type ParsedIdea } from '../components/AnalysisRenderer'

interface TrendingNovel {
  rank: number
  title: string
  titleZh: string
  tags: string
  stats: string
  platform: string
  url: string
}

interface TrendingResult {
  platform: string
  listType: string
  novels: TrendingNovel[]
  fetchedAt: string
}

/** 导入的中文小说信息 */
interface ImportedZhNovel {
  fileName: string
  title: string
  charCount: number
  localPath: string
}

/** 英文平台榜单 */
const FETCH_TARGETS_EN = [
  { platformId: 'royalroad', listType: 'trending', label: 'Royal Road · Trending' },
  { platformId: 'royalroad', listType: 'rising-stars', label: 'Royal Road · Rising Stars' },
  { platformId: 'scribblehub', listType: 'trending', label: 'ScribbleHub · Weekly Trending' },
]

export default function TrendingPage(): JSX.Element {
  const navigate = useNavigate()
  const setPendingBookDraft = useAppStore((s) => s.setPendingBookDraft)
  const startActivity = useAppStore((s) => s.startActivity)
  const finishActivity = useAppStore((s) => s.finishActivity)
  const addToast = useAppStore((s) => s.addToast)
  const [lang, setLang] = useState<'en' | 'zh'>('en')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [novelCount, setNovelCount] = useState(0)

  // 中文导入相关
  const [zhImported, setZhImported] = useState<ImportedZhNovel[]>([])

  const targets = FETCH_TARGETS_EN

  /* ========== 英文: 一键抓取+AI分析 ========== */
  const handleOneClick = async (): Promise<void> => {
    const actId = startActivity('热榜AI选题分析')
    setLoading(true)
    setError(null)
    setAnalysis(null)

    const allNovels: TrendingNovel[] = []
    const seen = new Set<string>()
    const errors: string[] = []

    for (const target of targets) {
      setStatus(`正在抓取 ${target.label}…`)
      useAppStore.getState().updateActivity(actId, `抓取 ${target.label}`)
      try {
        const res: TrendingResult = await window.hintos.fetchTrending(target.platformId, target.listType, false)
        for (const n of res.novels) {
          if (!seen.has(n.title)) { seen.add(n.title); allNovels.push(n) }
        }
      } catch (e) {
        errors.push(`${target.label}: ${e instanceof Error ? e.message : '失败'}`)
      }
    }

    setNovelCount(allNovels.length)

    if (allNovels.length === 0) {
      setError('所有榜单抓取失败' + (errors.length > 0 ? '：' + errors.join('；') : ''))
      finishActivity(actId, '抓取失败')
      setLoading(false); setStatus(''); return
    }

    setStatus(`已抓取 ${allNovels.length} 部小说，AI 正在分析选题…`)
    useAppStore.getState().updateActivity(actId, `AI分析 ${allNovels.length} 部小说`)
    try {
      const text = await window.hintos.analyzeTrending(allNovels, 'en')
      setAnalysis(text)
      await window.hintos.vaultSave({ novelCount: allNovels.length, analysis: text, novels: allNovels, language: 'en' })
      setStatus('')
      addToast('success', `✓ 分析完成 · ${allNovels.length} 部小说 · 已保存到创意库`)
      finishActivity(actId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 分析失败')
      finishActivity(actId, e instanceof Error ? e.message : 'AI 分析失败')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  /* ========== 中文: 导入TXT ========== */
  const handleImportZh = async (): Promise<void> => {
    try {
      const result = await window.hintos.importZhNovels()
      if (!result || result.length === 0) return
      setZhImported(prev => {
        const existing = new Set(prev.map(n => n.localPath))
        const added = result.filter((n: ImportedZhNovel) => !existing.has(n.localPath))
        return [...prev, ...added]
      })
      addToast('success', `✓ 已导入 ${result.length} 本中文参考小说`)
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : '导入失败')
    }
  }

  const handleRemoveZhNovel = (localPath: string): void => {
    setZhImported(prev => prev.filter(n => n.localPath !== localPath))
  }

  /* ========== 中文: AI分析选题 ========== */
  const handleZhAnalyze = async (): Promise<void> => {
    if (zhImported.length === 0) return
    const actId = startActivity('中文小说AI选题分析')
    setLoading(true)
    setError(null)
    setAnalysis(null)
    setNovelCount(zhImported.length)

    setStatus(`正在提取 ${zhImported.length} 本小说摘要…`)
    useAppStore.getState().updateActivity(actId, `提取摘要`)
    try {
      // 后端提取摘要并调用AI分析
      const text = await window.hintos.analyzeZhNovels(zhImported.map(n => n.localPath))
      setAnalysis(text)
      // 构建 virtualNovels 用于 vault 存储
      const virtualNovels = zhImported.map((n, i) => ({
        rank: i + 1,
        title: n.title,
        titleZh: n.title,
        tags: '',
        stats: `${Math.round(n.charCount / 10000)}万字`,
        platform: '本地导入',
        url: '',
        localPath: n.localPath,
      }))
      await window.hintos.vaultSave({ novelCount: zhImported.length, analysis: text, novels: virtualNovels, language: 'zh' })
      setStatus('')
      addToast('success', `✓ 分析完成 · ${zhImported.length} 本中文小说 · 已保存到创意库`)
      finishActivity(actId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 分析失败')
      finishActivity(actId, e instanceof Error ? e.message : 'AI 分析失败')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  /* ========== 通用: 发送选题到创建新书 ========== */
  const handleSendIdea = (idea: ParsedIdea): void => {
    setPendingBookDraft({
      title: idea.title,
      genre: idea.genre,
      platform: idea.platform,
      targetChapters: idea.targetChapters,
      chapterWords: idea.chapterWords,
      context: idea.context,
      language: idea.language
    })
    navigate('/')
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center gap-3">
        <TrendingUp className="w-7 h-7 text-violet-400" />
        <h1 className="text-2xl font-bold text-zinc-100">热榜雷达</h1>
        <span className="text-sm text-zinc-500">
          {lang === 'en' ? '抓取海外热门小说，AI 推荐选题方向' : '导入中文参考小说，AI 推荐选题方向'}
        </span>
      </div>

      {/* 语言选择 */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-zinc-400" />
        <span className="text-sm text-zinc-400">目标市场</span>
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          <button onClick={() => { setLang('en'); setAnalysis(null); setError(null); setStatus('') }}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              lang === 'en' ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}>
            English
          </button>
          <button onClick={() => { setLang('zh'); setAnalysis(null); setError(null); setStatus('') }}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              lang === 'zh' ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}>
            中文
          </button>
        </div>
        {lang === 'en' && <span className="text-xs text-zinc-600">Royal Road · ScribbleHub</span>}
        {lang === 'zh' && <span className="text-xs text-zinc-600">导入 .txt 参考小说 → AI 分析</span>}
      </div>

      {/* ========== 中文: 导入参考中文小说面板 ========== */}
      {lang === 'zh' && (
        <div className="space-y-4">
          <div className="bg-zinc-800/60 rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={handleImportZh} disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                <FolderOpen className="w-4 h-4" />
                选择 TXT 中文小说
              </button>
              <span className="text-xs text-zinc-500">
                选择完整版中文小说 .txt 文件（可多选），AI 将基于内容分析选题方向
              </span>
            </div>

            {/* 已导入列表 */}
            {zhImported.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-zinc-400">已导入 {zhImported.length} 本参考小说：</div>
                <div className="grid gap-2">
                  {zhImported.map(novel => (
                    <div key={novel.localPath} className="flex items-center gap-3 bg-zinc-700/40 rounded-lg px-3 py-2">
                      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-sm text-zinc-200 truncate flex-1">《{novel.title}》</span>
                      <span className="text-xs text-zinc-500 shrink-0">{novel.charCount >= 10000 ? `${Math.round(novel.charCount / 10000)}万字` : `${Math.round(novel.charCount / 1000)}千字`}</span>
                      <button onClick={() => handleRemoveZhNovel(novel.localPath)}
                        className="text-zinc-500 hover:text-red-400 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={handleZhAnalyze} disabled={loading || zhImported.length === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors mt-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loading ? '分析中…' : `AI 分析选题（基于 ${zhImported.length} 本小说）`}
                </button>
              </div>
            )}

            {status && (
              <div className="flex items-center gap-2 text-sm text-violet-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {status}
              </div>
            )}
          </div>

          {/* 中文空状态 */}
          {zhImported.length === 0 && !analysis && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-3">
              <FolderOpen className="w-12 h-12 text-zinc-600" />
              <p>导入中文参考小说 .txt 文件，让 AI 分析并推荐选题方向</p>
              <p className="text-xs text-zinc-600">支持批量导入，建议选择同题材热门作品 3-10 本</p>
            </div>
          )}
        </div>
      )}

      {/* ========== 英文: 一键抓取操作面板 ========== */}
      {lang === 'en' && (
        <div className="bg-zinc-800/60 rounded-lg p-4 flex flex-wrap items-center gap-4">
          <button
            onClick={handleOneClick}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? '处理中…' : 'AI 选题推荐'}
          </button>

          <span className="text-xs text-zinc-500">
            自动抓取 Royal Road + ScribbleHub 后由 AI 综合分析，结果自动保存到创意库
          </span>

          {status && (
            <div className="flex items-center gap-2 text-sm text-violet-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {status}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">{error}</div>
      )}

      {/* AI 选题分析结果 */}
      {analysis && (
        <div className="bg-zinc-800/60 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-zinc-200">AI 选题推荐</h2>
            <span className="text-xs text-zinc-500 ml-auto">
              基于 {novelCount} 部{lang === 'zh' ? '中文参考' : '热门'}小说
            </span>
          </div>
          <AnalysisRenderer analysis={analysis} onSendIdea={handleSendIdea} language={lang} />
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => navigate('/idea-vault')}
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              前往创意库查看所有记录 →
            </button>
          </div>
        </div>
      )}

      {/* 英文空状态 */}
      {lang === 'en' && !analysis && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-3">
          <Sparkles className="w-12 h-12 text-zinc-600" />
          <p>点击「AI 选题推荐」，一键获取海外热门趋势分析</p>
          <p className="text-xs text-zinc-600">分析结果将自动保存到创意库</p>
        </div>
      )}
    </div>
  )
}
