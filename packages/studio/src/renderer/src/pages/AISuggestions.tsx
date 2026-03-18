import { useState, useEffect, useCallback } from 'react'
import { Lightbulb, Wand2, Loader2, ChevronDown, ChevronUp, Copy, Check, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { bookLang } from '../utils/lang'

interface AISuggestions {
  storyIdeas?: Array<{ title: string; content: string }>
  writerRole?: string
  writingRules?: string
  humanizeSettings?: Record<string, unknown> & { reasons?: Record<string, string> }
  voiceCards?: Array<{ name: string; speech: string; tone: string; quirks: string }>
  sceneBeats?: Array<{ title: string; beats: string[] }>
  storyArc?: { phases: Array<{ name: string; chapters: string; goal: string }> }
  generatedAt?: string
  fromBooks?: string[]
  parseError?: boolean
  raw?: string
}

export default function AISuggestionsPage(): JSX.Element {
  const bookId = useAppStore((s) => s.currentBookId)
  const books = useAppStore((s) => s.books)
  const pipelineReady = useAppStore((s) => s.pipelineReady)

  const [suggestions, setSuggestions] = useState<AISuggestions | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['storyIdeas', 'writerRole', 'writingRules', 'voiceCards', 'sceneBeats', 'storyArc']))
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const startActivity = useAppStore((s) => s.startActivity)
  const finishActivity = useAppStore((s) => s.finishActivity)
  const addToast = useAppStore((s) => s.addToast)

  const currentBook = books.find((b) => b.bookId === bookId)
  const lang = bookLang(currentBook?.genre)
  const en = lang === 'en'

  const load = useCallback(async () => {
    if (!bookId) return
    try {
      const data = await window.hintos.loadSuggestions(bookId)
      setSuggestions(data)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [bookId])

  useEffect(() => { load() }, [load])

  const handleGenerate = async (): Promise<void> => {
    if (!bookId) return
    const actId = startActivity(en ? 'Generate AI Suggestions' : '生成AI创作建议')
    setGenerating(true)
    setError(null)
    setApplied(false)
    try {
      const result = await window.hintos.generateSuggestions(bookId)
      setSuggestions(result)
      addToast('success', en ? '✓ Suggestions generated' : '✓ 建议已生成')
      finishActivity(actId)
    } catch (e) {
      setError((e as Error).message)
      finishActivity(actId, (e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const handleApplyAll = async (): Promise<void> => {
    if (!bookId || !suggestions) return
    const actId = startActivity(en ? 'Apply all suggestions' : '应用全部建议')
    setApplying(true)
    setError(null)
    try {
      await window.hintos.applySuggestions(bookId)
      setApplied(true)
      addToast('success', en ? '✓ All suggestions applied' : '✓ 所有建议已应用')
      finishActivity(actId)
      setTimeout(() => setApplied(false), 3000)
    } catch (e) {
      setError((e as Error).message)
      finishActivity(actId, (e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  const toggleSection = (key: string): void => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const copyToClipboard = async (text: string, field: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            {en ? 'AI Writing Suggestions' : 'AI 创作建议'}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {en ? 'Auto-generate a complete writing plan from style books' : '基于参考书自动生成完整创作方案'}
            {currentBook && <span className="text-violet-400 ml-2">· {currentBook.title}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {suggestions && !suggestions.parseError && (
            <button onClick={handleApplyAll} disabled={applying || generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white transition-colors disabled:opacity-50">
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : applied ? <CheckCircle2 className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {applying ? (en ? 'Applying...' : '应用中...') : applied ? (en ? 'Applied!' : '已应用!') : (en ? 'Apply All' : '一键应用')}
            </button>
          )}
          <button onClick={handleGenerate} disabled={generating || !pipelineReady}
            className="flex items-center gap-1.5 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm text-white transition-colors disabled:opacity-50">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {generating ? (en ? 'Generating...' : '生成中...') : (en ? 'Generate' : '生成建议')}
          </button>
        </div>
      </div>

      {!pipelineReady && (
        <div className="bg-amber-900/20 border border-amber-800 text-amber-300 px-4 py-2 rounded-lg text-sm">
          {en ? 'Please complete LLM configuration before generating suggestions' : '请先在 LLM 配置页面完成连接，才能生成 AI 建议'}
        </div>
      )}

      {applied && (
        <div className="bg-emerald-900/20 border border-emerald-800 text-emerald-300 px-4 py-2 rounded-lg text-sm">
          {en ? '✓ All suggestions applied to Humanize Engine and synced to style_guide.md' : '✓ 所有建议已应用到人性化引擎，并同步到 style_guide.md'}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {suggestions?.parseError && suggestions.raw && (
        <section className="bg-zinc-900 rounded-xl border border-amber-800 p-5">
          <h2 className="text-sm font-semibold text-amber-300 mb-2">{en ? 'Parse Failed — Raw Output' : '解析失败 — 原始输出'}</h2>
          <pre className="bg-zinc-800 rounded-lg p-4 text-xs text-zinc-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
            {suggestions.raw}
          </pre>
        </section>
      )}

      {suggestions && !suggestions.parseError && (
        <div className="space-y-4">
          {/* Meta */}
          {suggestions.generatedAt && (
            <p className="text-xs text-zinc-600">
              生成于 {new Date(suggestions.generatedAt).toLocaleString()}
              {suggestions.fromBooks?.length ? ` · ${en ? 'Source' : '来源'}: ${suggestions.fromBooks.join(', ')}` : ''}
            </p>
          )}

          {/* Story Ideas */}
          {suggestions.storyIdeas?.length && (
            <CollapsibleSection title={en ? 'Story Ideas' : '故事创意'} icon="💡" expanded={expandedSections.has('storyIdeas')} onToggle={() => toggleSection('storyIdeas')}>
              <div className="space-y-3">
                {suggestions.storyIdeas.map((idea, i) => (
                  <div key={i} className="bg-zinc-800 rounded-lg p-3">
                    <h4 className="text-sm font-semibold text-zinc-200">{idea.title}</h4>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{idea.content}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Writer Role */}
          {suggestions.writerRole && (
            <CollapsibleSection title={en ? 'Writer Role' : '作者角色定义'} icon="🎭" expanded={expandedSections.has('writerRole')} onToggle={() => toggleSection('writerRole')}>
              <div className="bg-zinc-800 rounded-lg p-4 relative">
                <p className="text-sm text-zinc-300 leading-relaxed pr-8">{suggestions.writerRole}</p>
                <CopyBtn field="writerRole" copied={copiedField === 'writerRole'} onClick={() => copyToClipboard(suggestions.writerRole!, 'writerRole')} />
              </div>
            </CollapsibleSection>
          )}

          {/* Writing Rules */}
          {suggestions.writingRules && (
            <CollapsibleSection title={en ? 'Writing Rules' : '创作规则'} icon="📏" expanded={expandedSections.has('writingRules')} onToggle={() => toggleSection('writingRules')}>
              <div className="bg-zinc-800 rounded-lg p-4 relative">
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap pr-8">{suggestions.writingRules}</p>
                <CopyBtn field="writingRules" copied={copiedField === 'writingRules'} onClick={() => copyToClipboard(suggestions.writingRules!, 'writingRules')} />
              </div>
            </CollapsibleSection>
          )}

          {/* Voice Cards */}
          {suggestions.voiceCards?.length && (
            <CollapsibleSection title={en ? 'Voice Cards' : '声音卡片建议'} icon="🗣️" expanded={expandedSections.has('voiceCards')} onToggle={() => toggleSection('voiceCards')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestions.voiceCards.map((c, i) => (
                  <div key={i} className="bg-zinc-800 rounded-lg p-3">
                    <h4 className="text-sm font-semibold text-violet-300">{c.name}</h4>
                    <div className="mt-1 space-y-0.5 text-xs text-zinc-400">
                      <p>{en ? 'Speech' : '说话风格'}: {c.speech}</p>
                      <p>{en ? 'Tone' : '语调'}: {c.tone}</p>
                      {c.quirks && <p>{en ? 'Quirks' : '口癖'}: {c.quirks}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Scene Beats */}
          {suggestions.sceneBeats?.length && (
            <CollapsibleSection title={en ? 'Scene Beat Templates' : '场景节拍模板'} icon="🎬" expanded={expandedSections.has('sceneBeats')} onToggle={() => toggleSection('sceneBeats')}>
              <div className="space-y-3">
                {suggestions.sceneBeats.map((sb, i) => (
                  <div key={i} className="bg-zinc-800 rounded-lg p-3">
                    <h4 className="text-sm font-semibold text-zinc-200">{sb.title}</h4>
                    <ol className="mt-1 space-y-0.5">
                      {sb.beats.map((b, j) => (
                        <li key={j} className="text-xs text-zinc-400 pl-4">
                          <span className="text-zinc-600">{j + 1}.</span> {b}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Story Arc */}
          {suggestions.storyArc?.phases?.length && (
            <CollapsibleSection title={en ? 'Story Arc' : '故事弧线'} icon="📈" expanded={expandedSections.has('storyArc')} onToggle={() => toggleSection('storyArc')}>
              <div className="space-y-2">
                {suggestions.storyArc.phases.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 bg-zinc-800 rounded-lg p-3">
                    <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center text-xs text-white font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-200">{p.name}</h4>
                      <p className="text-xs text-zinc-500">{en ? 'Chapters' : '章节'}: {p.chapters}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{p.goal}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}

      {!suggestions && !generating && (
        <div className="text-center py-16">
          <Lightbulb className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-sm text-zinc-500">
            {en
              ? 'Import style reference books then click "Generate" — AI will analyze and create a complete writing plan'
              : '导入风格参考书后点击"生成建议"，AI 将分析参考书并给出完整创作方案'}
          </p>
        </div>
      )}
    </div>
  )
}

function CollapsibleSection({ title, icon, expanded, onToggle, children }: {
  title: string; icon: string; expanded: boolean; onToggle: () => void; children: React.ReactNode
}): JSX.Element {
  return (
    <section className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <button onClick={onToggle}
        className="flex items-center justify-between w-full px-5 py-3 hover:bg-zinc-800/50 transition-colors">
        <span className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <span>{icon}</span>{title}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      {expanded && <div className="px-5 pb-4">{children}</div>}
    </section>
  )
}

function CopyBtn({ field, copied, onClick }: { field: string; copied: boolean; onClick: () => void }): JSX.Element {
  return (
    <button onClick={onClick}
      className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
      title={`复制${field}`}>
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}
