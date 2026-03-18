import { useState } from 'react'
import { TrendingUp, Loader2, Sparkles, Globe, Construction } from 'lucide-react'
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

/** 英文平台榜单 */
const FETCH_TARGETS_EN = [
  { platformId: 'royalroad', listType: 'trending', label: 'Royal Road · Trending' },
  { platformId: 'royalroad', listType: 'rising-stars', label: 'Royal Road · Rising Stars' },
  { platformId: 'scribblehub', listType: 'trending', label: 'ScribbleHub · Weekly Trending' },
]

/** 中文平台榜单 — Coming Soon */
const FETCH_TARGETS_ZH: typeof FETCH_TARGETS_EN = [
  // TODO: 番茄小说、起点中文网等
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

  const targets = lang === 'en' ? FETCH_TARGETS_EN : FETCH_TARGETS_ZH
  const isZhComingSoon = lang === 'zh'

  const handleOneClick = async (): Promise<void> => {
    if (isZhComingSoon) return
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
      const text = await window.hintos.analyzeTrending(allNovels)
      setAnalysis(text)
      // 自动保存到创意库
      await window.hintos.vaultSave({ novelCount: allNovels.length, analysis: text, novels: allNovels, language: lang })
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

  const handleSendIdea = (idea: ParsedIdea): void => {
    setPendingBookDraft({
      title: idea.title,
      genre: idea.genre,
      platform: idea.platform,
      targetChapters: idea.targetChapters,
      chapterWords: idea.chapterWords,
      context: idea.context
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
          {lang === 'en' ? '抓取海外热门小说，AI 推荐选题方向' : '抓取中文热门小说，AI 推荐选题方向'}
        </span>
      </div>

      {/* 语言选择 */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-zinc-400" />
        <span className="text-sm text-zinc-400">目标市场</span>
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          <button onClick={() => { setLang('en'); setAnalysis(null); setError(null) }}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              lang === 'en' ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}>
            English
          </button>
          <button onClick={() => { setLang('zh'); setAnalysis(null); setError(null) }}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              lang === 'zh' ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}>
            中文
          </button>
        </div>
        {lang === 'en' && <span className="text-xs text-zinc-600">Royal Road · ScribbleHub</span>}
        {lang === 'zh' && <span className="text-xs text-amber-500/70">番茄 · 起点 · 飞卢（开发中）</span>}
      </div>

      {/* 中文 Coming Soon */}
      {isZhComingSoon && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-4">
          <Construction className="w-14 h-14 text-amber-500/50" />
          <h2 className="text-lg font-semibold text-zinc-300">中文平台支持开发中</h2>
          <p className="text-sm text-zinc-500 max-w-md text-center">
            番茄小说、起点中文网、飞卢小说等中文平台的热榜抓取和 AI 选题分析功能正在开发中。
            目前可直接在仪表盘创建中文小说。
          </p>
          <button onClick={() => navigate('/')}
            className="mt-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
            去仪表盘创建中文小说 →
          </button>
        </div>
      )}

      {/* 英文操作面板 */}
      {!isZhComingSoon && (
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
              基于 {novelCount} 部热门小说
            </span>
          </div>
          <AnalysisRenderer analysis={analysis} onSendIdea={handleSendIdea} />
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

      {/* 空状态 */}
      {!isZhComingSoon && !analysis && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-3">
          <Sparkles className="w-12 h-12 text-zinc-600" />
          <p>点击「AI 选题推荐」，一键获取海外热门趋势分析</p>
          <p className="text-xs text-zinc-600">分析结果将自动保存到创意库</p>
        </div>
      )}
    </div>
  )
}
