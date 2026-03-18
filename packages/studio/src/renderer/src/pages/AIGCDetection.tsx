import { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, Scan, History, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { bookLang } from '../utils/lang'

interface AITellResult {
  paragraphUniformity: { score: number; detail: string }
  hedgeDensity: { score: number; detail: string }
  formulaicTransitions: { score: number; detail: string }
  listStructure: { score: number; detail: string }
  overallScore: number
  verdict: string
}

interface SensitiveWordResult {
  hits: Array<{ word: string; category: string; count: number; severity: string }>
  totalHits: number
  categories: Record<string, number>
}

interface DetectionRecord {
  chapterNumber: number
  chapterTitle: string
  detectedAt: string
  aiTells: AITellResult
  sensitiveWords: SensitiveWordResult
  overallRisk: 'low' | 'medium' | 'high'
}

interface ChapterMeta {
  number: number
  title: string
  status: string
  wordCount: number
}

export default function AIGCDetection(): JSX.Element {
  const bookId = useAppStore((s) => s.currentBookId)
  const books = useAppStore((s) => s.books)

  const [chapters, setChapters] = useState<ChapterMeta[]>([])
  const [history, setHistory] = useState<DetectionRecord[]>([])
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [currentResult, setCurrentResult] = useState<DetectionRecord | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'detect' | 'history'>('detect')

  const currentBook = books.find((b) => b.bookId === bookId)
  const lang = bookLang(currentBook?.genre)
  const en = lang === 'en'

  const refresh = useCallback(async () => {
    if (!bookId) return
    try {
      const [chaps, hist] = await Promise.all([
        window.hintos.loadChapterIndex(bookId),
        window.hintos.loadDetectionHistory(bookId)
      ])
      setChapters(chaps ?? [])
      setHistory(hist)
      if (chaps?.length && !selectedChapter) setSelectedChapter(chaps[0].number)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [bookId, selectedChapter])

  useEffect(() => { refresh() }, [refresh])

  const handleDetect = async (): Promise<void> => {
    if (!bookId || selectedChapter == null) return
    const ch = chapters.find((c) => c.number === selectedChapter)
    if (!ch) return
    setDetecting(true)
    setError(null)
    try {
      const filename = await window.hintos.resolveChapterFilename(bookId, ch.number)
      if (!filename) throw new Error(`章节 ${ch.number} 文件未找到`)
      const content = await window.hintos.loadChapterContent(bookId, filename)
      const result = await window.hintos.detectChapter(bookId, ch.number, ch.title, content)
      setCurrentResult(result)
      setHistory((prev) => {
        const filtered = prev.filter((r) => r.chapterNumber !== ch.number)
        return [...filtered, result].sort((a, b) => a.chapterNumber - b.chapterNumber)
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDetecting(false)
    }
  }

  const handleDetectAll = async (): Promise<void> => {
    if (!bookId || chapters.length === 0) return
    setDetecting(true)
    setError(null)
    try {
      for (const ch of chapters) {
        const filename = await window.hintos.resolveChapterFilename(bookId, ch.number)
        if (!filename) continue
        const content = await window.hintos.loadChapterContent(bookId, filename)
        const result = await window.hintos.detectChapter(bookId, ch.number, ch.title, content)
        setHistory((prev) => {
          const filtered = prev.filter((r) => r.chapterNumber !== ch.number)
          return [...filtered, result].sort((a, b) => a.chapterNumber - b.chapterNumber)
        })
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDetecting(false)
    }
  }

  if (!bookId) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <p>{en ? 'Please select a book from the Dashboard first' : '请先在仪表盘选择一本书'}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          AI{en ? 'GC Detection' : 'GC 检测'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {en ? 'AI trace analysis + sensitive word scan — reduce platform detection risk' : 'AI痕迹分析 + 敏感词扫描 — 降低被平台检出风险'}
          {currentBook && <span className="text-violet-400 ml-2">· {currentBook.title}</span>}
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('detect')}
          className={`px-4 py-1.5 rounded-md text-sm ${tab === 'detect' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}>
          <Scan className="w-3.5 h-3.5 inline mr-1.5" />{en ? 'Detect' : '检测'}
        </button>
        <button onClick={() => setTab('history')}
          className={`px-4 py-1.5 rounded-md text-sm ${tab === 'history' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}>
          <History className="w-3.5 h-3.5 inline mr-1.5" />{en ? 'History' : '历史'} ({history.length})
        </button>
      </div>

      {tab === 'detect' && (
        <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <select value={selectedChapter ?? ''} onChange={(e) => setSelectedChapter(Number(e.target.value))}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none">
              {chapters.map((ch) => (
                <option key={ch.number} value={ch.number}>
                  {en ? `Ch.${ch.number} · ${ch.title} (${ch.wordCount} words)` : `第${ch.number}章 · ${ch.title} (${ch.wordCount}字)`}
                </option>
              ))}
            </select>
            <button onClick={handleDetect} disabled={detecting || !selectedChapter}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm text-white transition-colors disabled:opacity-50">
              {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
              {en ? 'Detect Chapter' : '检测本章'}
            </button>
            <button onClick={handleDetectAll} disabled={detecting || chapters.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm text-zinc-200 transition-colors disabled:opacity-50">
              {en ? 'Detect All' : '全部检测'}
            </button>
          </div>

          {/* Current result */}
          {currentResult && <DetectionReport record={currentResult} en={en} />}
        </section>
      )}

      {tab === 'history' && (
        <section className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">{en ? 'No detection records yet' : '暂无检测记录'}</p>
          ) : (
            history.map((r) => (
              <div key={r.chapterNumber}
                className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 cursor-pointer hover:border-zinc-700 transition-colors"
                onClick={() => { setCurrentResult(r); setTab('detect'); setSelectedChapter(r.chapterNumber) }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-200">
                    {en ? `Ch.${r.chapterNumber} · ${r.chapterTitle}` : `第${r.chapterNumber}章 · ${r.chapterTitle}`}
                  </span>
                  <RiskBadge risk={r.overallRisk} />
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                  <span>{en ? 'AI Traces' : 'AI痕迹'}: {r.aiTells.overallScore}/10</span>
                  <span>{en ? 'Sensitive Words' : '敏感词'}: {r.sensitiveWords.totalHits}{en ? ' hits' : '处'}</span>
                  <span>{new Date(r.detectedAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  )
}

function DetectionReport({ record, en }: { record: DetectionRecord; en: boolean }): JSX.Element {
  const tells = record.aiTells
  const sw = record.sensitiveWords

  return (
    <div className="space-y-4 mt-4">
      {/* Overall */}
      <div className="flex items-center gap-3">
        <RiskBadge risk={record.overallRisk} en={en} />
        <span className="text-sm text-zinc-400">{tells.verdict}</span>
      </div>

      {/* AI Tells */}
      <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase">{en ? 'AI TRACE INDICATORS' : 'AI 痕迹指标'}</h3>
        <TellBar label={en ? 'Paragraph Uniformity' : '段落均匀度'} score={tells.paragraphUniformity.score} detail={tells.paragraphUniformity.detail} />
        <TellBar label={en ? 'Hedge Word Density' : '对冲词密度'} score={tells.hedgeDensity.score} detail={tells.hedgeDensity.detail} />
        <TellBar label={en ? 'Formulaic Transitions' : '公式化过渡'} score={tells.formulaicTransitions.score} detail={tells.formulaicTransitions.detail} />
        <TellBar label={en ? 'List Structure' : '列表结构'} score={tells.listStructure.score} detail={tells.listStructure.detail} />
        <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
          <span className="text-sm font-semibold text-zinc-200">{en ? 'Overall Score' : '综合评分'}</span>
          <span className={`text-lg font-bold ${
            tells.overallScore >= 7 ? 'text-red-400' : tells.overallScore >= 4 ? 'text-amber-400' : 'text-emerald-400'
          }`}>{tells.overallScore}/10</span>
        </div>
      </div>

      {/* Sensitive Words */}
      {sw.totalHits > 0 && (
        <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase">
            {en ? 'SENSITIVE WORDS' : '敏感词'} ({sw.totalHits} {en ? 'hits' : '处'})
          </h3>
          <div className="flex flex-wrap gap-2 mb-2">
            {Object.entries(sw.categories).map(([cat, count]) => (
              <span key={cat} className="px-2 py-0.5 bg-red-900/30 border border-red-800 rounded text-xs text-red-300">
                {cat}: {count}
              </span>
            ))}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {sw.hits.map((h, i) => (
              <div key={i} className="text-xs text-zinc-400">
                <span className="text-red-400 font-mono">{h.word}</span>
                <span className="text-zinc-600 ml-2">({h.category})</span>
                <span className="text-zinc-500 ml-2">×{h.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TellBar({ label, score, detail }: { label: string; score: number; detail: string }): JSX.Element {
  const pct = Math.min(score * 10, 100)
  const color = score >= 7 ? 'bg-red-500' : score >= 4 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-300">{label}</span>
        <span className="text-zinc-500">{score}/10</span>
      </div>
      <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-zinc-600 mt-0.5">{detail}</p>
    </div>
  )
}

function RiskBadge({ risk, en = false }: { risk: 'low' | 'medium' | 'high'; en?: boolean }): JSX.Element {
  if (risk === 'low') return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-900/30 text-emerald-400 rounded text-xs">
      <CheckCircle className="w-3 h-3" />{en ? 'Low Risk' : '低风险'}
    </span>
  )
  if (risk === 'medium') return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-900/30 text-amber-400 rounded text-xs">
      <AlertTriangle className="w-3 h-3" />{en ? 'Medium Risk' : '中风险'}
    </span>
  )
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-red-900/30 text-red-400 rounded text-xs">
      <XCircle className="w-3 h-3" />{en ? 'High Risk' : '高风险'}
    </span>
  )
}
