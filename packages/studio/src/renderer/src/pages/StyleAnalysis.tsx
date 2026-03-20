import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Upload, Trash2, BarChart3, Fingerprint, Loader2, Globe, Link, Play, CheckSquare, Square, Download } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { bookLang } from '../utils/lang'

interface StyleProfile {
  avgSentenceLength: number
  sentenceLengthStdDev: number
  avgParagraphLength: number
  paragraphLengthRange: { min: number; max: number }
  vocabularyDiversity: number
  topPatterns: string[]
  rhetoricalFeatures: string[]
  sourceName?: string
  analyzedAt?: string
}

interface FingerprintData {
  fingerprint: string
  enabled: boolean
  strength: number
  analyzedBooks: string[]
  analyzedAt: string
}

interface VaultNovel {
  rank: number
  title: string
  titleZh: string
  tags: string
  stats: string
  platform: string
  url: string
}

export default function StyleAnalysis(): JSX.Element {
  const bookId = useAppStore((s) => s.currentBookId)
  const books = useAppStore((s) => s.books)
  const addToast = useAppStore((s) => s.addToast)
  const startActivity = useAppStore((s) => s.startActivity)
  const finishActivity = useAppStore((s) => s.finishActivity)

  const [styleBooks, setStyleBooks] = useState<string[]>([])
  const [profile, setProfile] = useState<StyleProfile | null>(null)
  const [fingerprint, setFingerprint] = useState<FingerprintData | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzingFp, setAnalyzingFp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeStatus, setScrapeStatus] = useState('')

  // 热榜导入相关
  const [vaultNovels, setVaultNovels] = useState<VaultNovel[]>([])
  const [selectedNovels, setSelectedNovels] = useState<Set<string>>(new Set())
  const [batchScraping, setBatchScraping] = useState(false)
  const [batchProgress, setBatchProgress] = useState('')

  const currentBook = books.find((b) => b.bookId === bookId)
  const lang = bookLang(currentBook?.genre)
  const en = lang === 'en'

  const refresh = useCallback(async () => {
    if (!bookId) return
    try {
      const [books, prof, fp] = await Promise.all([
        window.hintos.listStyleBooks(bookId),
        window.hintos.loadStyleProfile(bookId),
        window.hintos.loadFingerprint(bookId)
      ])
      setStyleBooks(books)
      setProfile(prof)
      setFingerprint(fp)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [bookId])

  useEffect(() => { refresh() }, [refresh])

  // 加载创意库小说列表
  useEffect(() => {
    if (!currentBook) return
    const novelLang = en ? 'en' : 'zh'
    window.hintos.vaultAllNovels(novelLang).then(setVaultNovels).catch(() => {})
  }, [currentBook, en])

  const toggleNovel = (url: string): void => {
    setSelectedNovels(prev => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const handleBatchScrape = async (): Promise<void> => {
    if (!bookId || selectedNovels.size === 0) return
    const actId = startActivity(en ? 'Batch import from trending' : '从热榜批量导入')
    setBatchScraping(true)
    setError(null)
    const targets = vaultNovels.filter(n => selectedNovels.has(n.url))
    let done = 0

    const unsub = window.hintos.onProgress((evt: { stage: string }) => {
      setBatchProgress(evt.stage)
    })

    try {
      for (const novel of targets) {
        done++
        setBatchProgress(en ? `Scraping ${done}/${targets.length}: ${novel.title}` : `采样 ${done}/${targets.length}: 《${novel.title}》`)
        await window.hintos.scraperScrapeForAnalysis(bookId, novel.url, novel.title, 10)
      }
      const updated = await window.hintos.listStyleBooks(bookId)
      setStyleBooks(updated)
      setSelectedNovels(new Set())
      addToast('success', en ? `✓ Imported ${targets.length} novels` : `✓ 已导入 ${targets.length} 本小说`)
      finishActivity(actId)
    } catch (e) {
      setError((e as Error).message)
      addToast('error', en ? `Batch import failed: ${(e as Error).message}` : `批量导入失败: ${(e as Error).message}`)
      finishActivity(actId, (e as Error).message)
    } finally {
      unsub()
      setBatchScraping(false)
      setBatchProgress('')
    }
  }

  const handleImport = async (): Promise<void> => {
    if (!bookId) return
    try {
      const names = await window.hintos.importStyleBook(bookId)
      if (names) {
        setStyleBooks((prev) => [...prev, ...names])
        addToast('success', `✓ 已导入 ${names.length} 本参考书`)
      }
    } catch (e) {
      addToast('error', `导入失败: ${(e as Error).message}`)
    }
  }

  const handleRemove = async (fileName: string): Promise<void> => {
    if (!bookId) return
    try {
      await window.hintos.removeStyleBook(bookId, fileName)
      setStyleBooks((prev) => prev.filter((f) => f !== fileName))
      addToast('success', '✓ 已移除')
    } catch (e) {
      addToast('error', `移除失败: ${(e as Error).message}`)
    }
  }

  const handleAnalyze = async (): Promise<void> => {
    if (!bookId) return
    const actId = startActivity(en ? 'Text Statistics' : '文本统计分析')
    setAnalyzing(true)
    setError(null)
    try {
      const result = await window.hintos.analyzeStyleBooks(bookId)
      setProfile(result)
      addToast('success', en ? '✓ Analysis complete' : '✓ 统计分析完成')
      finishActivity(actId)
    } catch (e) {
      setError((e as Error).message)
      addToast('error', en ? `Analysis failed: ${(e as Error).message}` : `分析失败: ${(e as Error).message}`)
      finishActivity(actId, (e as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDeepFingerprint = async (): Promise<void> => {
    if (!bookId) return
    const actId = startActivity(en ? 'AI Deep Fingerprint' : 'AI深度指纹分析')
    setAnalyzingFp(true)
    setError(null)
    try {
      const result = await window.hintos.analyzeDeepFingerprint(bookId)
      setFingerprint(result)
      addToast('success', en ? '✓ Fingerprint generated' : '✓ AI指纹分析完成')
      finishActivity(actId)
    } catch (e) {
      setError((e as Error).message)
      addToast('error', en ? `Fingerprint failed: ${(e as Error).message}` : `指纹分析失败: ${(e as Error).message}`)
      finishActivity(actId, (e as Error).message)
    } finally {
      setAnalyzingFp(false)
    }
  }

  const handleStrengthChange = async (strength: number): Promise<void> => {
    if (!bookId || !fingerprint) return
    const updated = { ...fingerprint, strength }
    setFingerprint(updated)
    try {
      await window.hintos.saveFingerprint(bookId, updated)
      addToast('info', en ? 'Strength updated' : '指纹强度已更新')
    } catch (e) {
      addToast('error', `保存失败: ${(e as Error).message}`)
    }
  }

  const handleOnlineScrape = async (): Promise<void> => {
    if (!bookId || !scrapeUrl.trim()) return
    const actId = startActivity(en ? 'Online Scrape' : '在线采样')
    setScraping(true)
    setError(null)
    setScrapeStatus(en ? 'Connecting...' : '连接中...')

    // Listen for progress events
    const unsub = window.hintos.onProgress((evt: { stage: string }) => {
      setScrapeStatus(evt.stage)
    })

    try {
      // Extract title from URL for naming
      const urlTitle = scrapeUrl.replace(/https?:\/\//, '').split('/').filter(Boolean).slice(0, 3).join('-').slice(0, 40)
      const result = await window.hintos.scraperScrapeForAnalysis(bookId, scrapeUrl.trim(), urlTitle)
      setScrapeStatus('')
      setScrapeUrl('')
      // Refresh style books list
      const books = await window.hintos.listStyleBooks(bookId)
      setStyleBooks(books)
      const msg = en
        ? `Done! Sampled ${result.chaptersSampled}/${result.chaptersTotal} chapters from ${result.platform}`
        : `完成！从 ${result.platform} 采样了 ${result.chaptersSampled}/${result.chaptersTotal} 章节`
      setScrapeStatus(msg)
      addToast('success', `✓ ${msg}`)
      finishActivity(actId)
      setTimeout(() => setScrapeStatus(''), 3000)
    } catch (e) {
      setError((e as Error).message)
      addToast('error', en ? `Scrape failed: ${(e as Error).message}` : `采样失败: ${(e as Error).message}`)
      finishActivity(actId, (e as Error).message)
      setScrapeStatus('')
    } finally {
      unsub()
      setScraping(false)
    }
  }

  const handleToggleFp = async (): Promise<void> => {
    if (!bookId || !fingerprint) return
    const updated = { ...fingerprint, enabled: !fingerprint.enabled }
    setFingerprint(updated)
    try {
      await window.hintos.saveFingerprint(bookId, updated)
      addToast('info', updated.enabled ? (en ? 'Fingerprint enabled' : '指纹已启用') : (en ? 'Fingerprint disabled' : '指纹已禁用'))
    } catch (e) {
      addToast('error', `保存失败: ${(e as Error).message}`)
    }
  }

  if (!bookId) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <p>{en ? 'Select a book from the Dashboard first' : '请先在仪表盘选择一本书'}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            {en ? 'Style Analysis' : '风格分析'}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {en ? 'Import references → Text statistics → AI fingerprint' : '导入参考书 → 文本统计分析 → AI指纹提取'}
            {currentBook && <span className="text-violet-400 ml-2">· {currentBook.title}</span>}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* ===== 数据来源（三合一）===== */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Download className="w-4 h-4 text-emerald-400" />
          {en ? 'Data Sources' : '数据来源'}
        </h2>

        {/* 从热榜导入 */}
        {vaultNovels.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-amber-400">{en ? 'Import from Trending' : '从热榜导入'}</h3>
            <p className="text-xs text-zinc-500">
              {en ? 'Select novels from your Idea Vault trending data to batch-scrape as style references' : '从创意库热榜数据中选择小说，批量采样为风格参考书'}
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {vaultNovels.map((n) => (
                <label key={n.url} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer group">
                  <button onClick={() => toggleNovel(n.url)} className="shrink-0 text-zinc-500 group-hover:text-amber-400">
                    {selectedNovels.has(n.url) ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4" />}
                  </button>
                  <span className="text-sm text-zinc-300 truncate">{n.title}</span>
                  <span className="text-[10px] text-zinc-600 shrink-0">{n.platform}</span>
                </label>
              ))}
            </div>
            {selectedNovels.size > 0 && (
              <button onClick={handleBatchScrape} disabled={batchScraping}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs text-white transition-colors disabled:opacity-50">
                {batchScraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {batchScraping ? batchProgress : (en ? `Import ${selectedNovels.size} selected` : `导入 ${selectedNovels.size} 本已选`)}
              </button>
            )}
          </div>
        )}

        {/* 在线采样 */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-emerald-400">{en ? 'Online Sampling' : '在线采样'}</h3>
          <p className="text-xs text-zinc-500">
            {en
              ? 'Paste a Royal Road or ScribbleHub fiction URL to auto-sample chapters'
              : '粘贴小说链接，自动采样章节'}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="url"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder={en ? 'https://www.royalroad.com/fiction/...' : 'https://www.royalroad.com/fiction/...'}
                className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                disabled={scraping}
              />
            </div>
            <button onClick={handleOnlineScrape} disabled={scraping || !scrapeUrl.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white transition-colors disabled:opacity-50 shrink-0">
              {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {scraping ? (en ? 'Scraping...' : '采样中...') : (en ? 'Scrape & Import' : '采样导入')}
            </button>
          </div>
          {scrapeStatus && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              {scraping && <Loader2 className="w-3 h-3 animate-spin" />}
              {scrapeStatus}
            </div>
          )}
        </div>

        {/* 本地导入 */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-violet-400">{en ? 'Local Import' : '本地导入'}</h3>
          <button onClick={handleImport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs text-zinc-200 transition-colors">
            <Upload className="w-3.5 h-3.5" />{en ? 'Import .txt files' : '导入 .txt 文件'}
          </button>
        </div>
      </section>

      {/* ===== 已导入参考书列表 ===== */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-violet-400" />
          {en ? `Style Reference Books (${styleBooks.length})` : `风格参考书 (${styleBooks.length})`}
        </h2>
        {styleBooks.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">
            {en ? 'No reference books yet — use the data sources above to add some' : '暂无参考书 — 使用上方数据来源添加'}
          </p>
        ) : (
          <div className="space-y-2">
            {styleBooks.map((f) => (
              <div key={f} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
                <span className="text-sm text-zinc-300">{f}</span>
                <button onClick={() => handleRemove(f)}
                  className="text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== 运行文本统计（醒目按钮）===== */}
      {styleBooks.length > 0 && (
        <button onClick={handleAnalyze} disabled={analyzing}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-amber-600 hover:bg-amber-500 rounded-xl text-base font-bold text-white transition-colors disabled:opacity-50 shadow-lg shadow-amber-600/20">
          {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
          {analyzing ? (en ? 'Analyzing...' : '分析中...') : (en ? '▸ Run Text Statistics' : '▸ 运行文本统计')}
        </button>
      )}

      {/* Style Profile */}
      {profile && (
        <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">{en ? 'Statistical Profile' : '统计画像'}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label={en ? 'Avg Sentence Len' : '平均句长'} value={`${profile.avgSentenceLength.toFixed(1)} ${en ? 'words' : '字'}`} />
            <StatCard label={en ? 'Std Dev' : '句长标准差'} value={`${profile.sentenceLengthStdDev.toFixed(1)}`} />
            <StatCard label={en ? 'Avg Para Len' : '平均段长'} value={`${profile.avgParagraphLength.toFixed(1)} ${en ? 'sent' : '句'}`} />
            <StatCard label={en ? 'Para Range' : '段长范围'} value={`${profile.paragraphLengthRange.min}–${profile.paragraphLengthRange.max}`} />
            <StatCard label={en ? 'Vocab Diversity(TTR)' : '词汇多样性(TTR)'} value={`${(profile.vocabularyDiversity * 100).toFixed(1)}%`} />
          </div>
          {profile.topPatterns.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs text-zinc-500 mb-2">{en ? 'Frequent Patterns' : '高频句式模式'}</h3>
              <div className="flex flex-wrap gap-2">
                {profile.topPatterns.slice(0, 15).map((p, i) => (
                  <span key={i}
                    className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profile.rhetoricalFeatures.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs text-zinc-500 mb-2">{en ? 'Rhetorical Features' : '修辞手法'}</h3>
              <div className="flex flex-wrap gap-2">
                {profile.rhetoricalFeatures.map((f, i) => (
                  <span key={i}
                    className="px-2 py-0.5 bg-violet-900/30 border border-violet-700 rounded text-xs text-violet-300">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-zinc-600 mt-3">
            {en ? 'Source' : '来源'}: {profile.sourceName ?? (en ? 'Reference books' : '参考书')}{profile.analyzedAt ? ` · ${en ? 'Analyzed' : '分析于'} ${new Date(profile.analyzedAt).toLocaleString()}` : ''}
          </p>
        </section>
      )}

      {/* Deep Fingerprint */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-amber-400" />
            {en ? 'AI Style Fingerprint' : 'AI 风格指纹'}
          </h2>
          <button onClick={handleDeepFingerprint} disabled={analyzingFp || styleBooks.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs text-white transition-colors disabled:opacity-50">
            {analyzingFp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fingerprint className="w-3.5 h-3.5" />}
            {analyzingFp ? (en ? 'Analyzing...' : '分析中...') : (en ? 'Deep Fingerprint' : '深度指纹提取')}
          </button>
        </div>

        {fingerprint ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={fingerprint.enabled} onChange={handleToggleFp}
                  className="rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500" />
                {en ? 'Enable Fingerprint Injection' : '启用指纹注入'}
              </label>
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span>{en ? 'Strength' : '强度'}</span>
                <input type="range" min="1" max="10" value={fingerprint.strength}
                  onChange={(e) => handleStrengthChange(Number(e.target.value))}
                  className="w-24 accent-violet-500" />
                <span className="text-violet-400 font-mono w-4 text-center">{fingerprint.strength}</span>
              </div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{fingerprint.fingerprint}</pre>
            </div>
            <p className="text-[10px] text-zinc-600">
              {en ? 'Source' : '来源'}: {fingerprint.analyzedBooks.join(', ')} · {new Date(fingerprint.analyzedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 text-center py-4">
            {styleBooks.length === 0
              ? (en ? 'Import style reference books first' : '请先导入风格参考书')
              : (en ? 'Click "Deep Fingerprint" to let AI analyze unique writing style' : '点击“深度指纹提取”让 AI 分析作者独特文风')
            }
          </p>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="bg-zinc-800 rounded-lg p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold text-zinc-200 mt-0.5">{value}</div>
    </div>
  )
}
