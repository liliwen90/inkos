import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Save, Plus, Trash2, Music, Loader2 } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { bookLang } from '../utils/lang'


interface HumanizeSettings {
  pov: 'first' | 'third-limited' | 'third-omniscient'
  tense: 'past' | 'present'
  creativity: number
  pacing: 'fast' | 'balanced' | 'slow'
  mood: 'neutral' | 'tense' | 'warm' | 'dark' | 'humorous' | 'epic'
  showDontTell: 'low' | 'medium' | 'high'
  dialogue: 'formal' | 'natural' | 'colloquial'
  density: 'sparse' | 'medium' | 'rich'
}

interface VoiceCard {
  name: string
  speech: string
  tone: string
  quirks: string
}

/** 选项标签 — 始终双语显示（中文在前） */
const OPT_LABELS = {
  pov: [
    { value: 'first', label: '第一人称 (First Person)' },
    { value: 'third-limited', label: '第三人称·有限 (3rd Limited)' },
    { value: 'third-omniscient', label: '第三人称·全知 (3rd Omniscient)' }
  ],
  tense: [
    { value: 'past', label: '过去时 (Past Tense)' },
    { value: 'present', label: '现在时 (Present Tense)' }
  ],
  pacing: [
    { value: 'fast', label: '快节奏 (Fast)' },
    { value: 'balanced', label: '均衡 (Balanced)' },
    { value: 'slow', label: '慢节奏 (Slow-burn)' }
  ],
  mood: [
    { value: 'neutral', label: '中性 (Neutral)' },
    { value: 'tense', label: '紧张 (Tense)' },
    { value: 'warm', label: '温馨 (Warm)' },
    { value: 'dark', label: '黑暗 (Dark)' },
    { value: 'humorous', label: '幽默 (Humorous)' },
    { value: 'epic', label: '史诗 (Epic)' }
  ],
  showDontTell: [
    { value: 'low', label: '低 (Low)' },
    { value: 'medium', label: '中 (Medium)' },
    { value: 'high', label: '高 (High)' }
  ],
  dialogue: [
    { value: 'formal', label: '正式 (Formal)' },
    { value: 'natural', label: '自然 (Natural)' },
    { value: 'colloquial', label: '口语化 (Colloquial)' }
  ],
  density: [
    { value: 'sparse', label: '简洁 (Sparse)' },
    { value: 'medium', label: '适中 (Medium)' },
    { value: 'rich', label: '丰富 (Rich)' }
  ]
}

/** 每个设定项的中文标题 + 说明 */
const FIELD_INFO: Record<string, { title: string; desc: string }> = {
  pov: { title: '视角 POV', desc: '叙事视角决定读者"通过谁的眼睛"看故事。第一人称沉浸感强，第三人称有限跟随单个角色，全知视角可展现多方信息。' },
  tense: { title: '时态 Tense', desc: '过去时是经典叙事语态，沉稳流畅；现在时带来即时感和紧迫感，常用于惊悚/悬疑类。' },
  pacing: { title: '节奏 Pacing', desc: '快节奏适合动作密集的桥段；均衡适合大多数场景；慢节奏适合情感烘托和世界观铺陈。' },
  mood: { title: '基调 Mood', desc: '整体氛围色彩。中性=平铺、紧张=高压悬念、温馨=治愈日常、黑暗=压抑残酷、幽默=轻松搞笑、史诗=宏大壮阔。' },
  showDontTell: { title: '展示vs叙述', desc: '控制"用画面展示"与"直接告诉读者"的比例。高=更多感官细节和行为暗示，让读者自行体会；低=更直白高效的叙述。' },
  dialogue: { title: '对话风格 Dialogue', desc: '角色对话的语气基调。正式=书面化严肃，自然=日常对话流，口语化=含俚语和不完整句式，更接地气。' },
  density: { title: '描写密度 Density', desc: '环境/动作/心理描写的丰富程度。简洁=留白多、节奏快；适中=平衡；丰富=细腻沉浸，适合慢节奏和文学风格。' },
}

export default function HumanizeEngine(): JSX.Element {
  const bookId = useAppStore((s) => s.currentBookId)
  const books = useAppStore((s) => s.books)
  const addToast = useAppStore((s) => s.addToast)
  const startActivity = useAppStore((s) => s.startActivity)
  const finishActivity = useAppStore((s) => s.finishActivity)

  const [settings, setSettings] = useState<HumanizeSettings>({
    pov: 'third-limited', tense: 'past', creativity: 5,
    pacing: 'balanced', mood: 'neutral', showDontTell: 'medium',
    dialogue: 'natural', density: 'medium'
  })
  const [voiceCards, setVoiceCards] = useState<VoiceCard[]>([])
  const [sceneBeats, setSceneBeats] = useState<string[]>([])
  const [editingChapter, setEditingChapter] = useState<number>(1)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'settings' | 'voice' | 'beats' | 'preview'>('settings')

  const currentBook = books.find((b) => b.bookId === bookId)
  const lang = bookLang(currentBook?.genre)

  const loadAll = useCallback(async () => {
    if (!bookId) return
    try {
      const [s, vc] = await Promise.all([
        window.hintos.loadHumanizeSettings(bookId),
        window.hintos.loadVoiceCards(bookId)
      ])
      if (s) setSettings(s)
      if (vc) setVoiceCards(vc)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [bookId])

  useEffect(() => { loadAll() }, [loadAll])

  const loadBeats = useCallback(async () => {
    if (!bookId) return
    const beats = await window.hintos.loadSceneBeats(bookId, editingChapter)
    setSceneBeats(beats ?? [])
  }, [bookId, editingChapter])

  useEffect(() => { loadBeats() }, [loadBeats])

  const handleSave = async (): Promise<void> => {
    if (!bookId) return
    const actId = startActivity('保存人性化设置')
    setSaving(true)
    try {
      await Promise.all([
        window.hintos.saveHumanizeSettings(bookId, settings),
        window.hintos.saveVoiceCards(bookId, voiceCards),
        window.hintos.saveSceneBeats(bookId, editingChapter, sceneBeats)
      ])
      setSaved(true)
      addToast('success', '✓ 人性化设置已保存')
      finishActivity(actId)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError((e as Error).message)
      addToast('error', `保存失败: ${(e as Error).message}`)
      finishActivity(actId, (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async (): Promise<void> => {
    if (!bookId) return
    setPreviewLoading(true)
    try {
      const text = await window.hintos.buildStyleGuidance(bookId, editingChapter)
      setPreview(text)
      setTab('preview')
    } catch (e) {
      setError((e as Error).message)
      addToast('error', `预览生成失败: ${(e as Error).message}`)
    } finally {
      setPreviewLoading(false)
    }
  }

  // Voice card CRUD
  const addVoiceCard = (): void => {
    setVoiceCards((prev) => [...prev, { name: '', speech: '', tone: '', quirks: '' }])
  }
  const updateVoiceCard = (i: number, field: keyof VoiceCard, value: string): void => {
    setVoiceCards((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }
  const removeVoiceCard = (i: number): void => {
    setVoiceCards((prev) => prev.filter((_, idx) => idx !== i))
  }

  // Scene beats CRUD
  const addBeat = (): void => { setSceneBeats((prev) => [...prev, '']) }
  const updateBeat = (i: number, value: string): void => {
    setSceneBeats((prev) => prev.map((b, idx) => idx === i ? value : b))
  }
  const removeBeat = (i: number): void => {
    setSceneBeats((prev) => prev.filter((_, idx) => idx !== i))
  }

  if (!bookId) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <p>请先在仪表盘选择一本书</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            人性化引擎 Humanize Engine
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            配置写作风格 · 角色声音 · 场景节拍
            {currentBook && <span className="text-violet-400 ml-2">· {currentBook.title}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePreview} disabled={previewLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs text-zinc-300 transition-colors disabled:opacity-50">
            {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {previewLoading ? '生成中…' : '预览注入文本'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? '已保存 ✓' : '保存全部'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg w-fit">
        {(['settings', 'voice', 'beats', 'preview'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm ${tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}>
            {t === 'settings' ? '风格设定' : t === 'voice' ? '声音卡片' : t === 'beats' ? '场景节拍' : '预览'}
          </button>
        ))}
      </div>

      {/* Settings Tab */}
      {tab === 'settings' && (
        <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectFieldWithDesc field="pov" value={settings.pov} options={OPT_LABELS.pov}
              onChange={(v) => setSettings((s) => ({ ...s, pov: v as HumanizeSettings['pov'] }))} />
            <SelectFieldWithDesc field="tense" value={settings.tense} options={OPT_LABELS.tense}
              onChange={(v) => setSettings((s) => ({ ...s, tense: v as HumanizeSettings['tense'] }))} />
            <SelectFieldWithDesc field="pacing" value={settings.pacing} options={OPT_LABELS.pacing}
              onChange={(v) => setSettings((s) => ({ ...s, pacing: v as HumanizeSettings['pacing'] }))} />
            <SelectFieldWithDesc field="mood" value={settings.mood} options={OPT_LABELS.mood}
              onChange={(v) => setSettings((s) => ({ ...s, mood: v as HumanizeSettings['mood'] }))} />
            <SelectFieldWithDesc field="showDontTell" value={settings.showDontTell} options={OPT_LABELS.showDontTell}
              onChange={(v) => setSettings((s) => ({ ...s, showDontTell: v as HumanizeSettings['showDontTell'] }))} />
            <SelectFieldWithDesc field="dialogue" value={settings.dialogue} options={OPT_LABELS.dialogue}
              onChange={(v) => setSettings((s) => ({ ...s, dialogue: v as HumanizeSettings['dialogue'] }))} />
            <SelectFieldWithDesc field="density" value={settings.density} options={OPT_LABELS.density}
              onChange={(v) => setSettings((s) => ({ ...s, density: v as HumanizeSettings['density'] }))} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">创意度 Creativity ({settings.creativity}/10)</label>
            <input type="range" min="1" max="10" value={settings.creativity}
              onChange={(e) => setSettings((s) => ({ ...s, creativity: Number(e.target.value) }))}
              className="w-full max-w-xs accent-violet-500" />
            <p className="text-[10px] text-zinc-600 mt-1">低=忠于大纲，高=更多即兴发挥。数值越高，AI 的创作自由度越大。</p>
          </div>
        </section>
      )}

      {/* Voice Cards Tab */}
      {tab === 'voice' && (
        <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Music className="w-4 h-4 text-violet-400" />
              角色声音卡片 ({voiceCards.length})
            </h2>
            <button onClick={addVoiceCard}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors">
              <Plus className="w-3.5 h-3.5" />添加角色
            </button>
          </div>
          {voiceCards.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-4">添加角色声音卡片，让每个角色有独特的说话方式</p>
          ) : (
            <div className="space-y-3">
              {voiceCards.map((card, i) => (
                <div key={i} className="bg-zinc-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <input value={card.name} onChange={(e) => updateVoiceCard(i, 'name', e.target.value)} placeholder="角色名"
                      className="bg-transparent text-sm font-semibold text-zinc-200 focus:outline-none border-b border-transparent focus:border-violet-500 w-40" />
                    <button onClick={() => removeVoiceCard(i)} className="text-zinc-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={card.speech} onChange={(e) => updateVoiceCard(i, 'speech', e.target.value)} placeholder="说话风格"
                      className="bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none" />
                    <input value={card.tone} onChange={(e) => updateVoiceCard(i, 'tone', e.target.value)} placeholder="语调"
                      className="bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none" />
                    <input value={card.quirks} onChange={(e) => updateVoiceCard(i, 'quirks', e.target.value)} placeholder="口癖/特点"
                      className="bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Scene Beats Tab */}
      {tab === 'beats' && (
        <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-zinc-400">章节:</label>
            <input type="number" value={editingChapter} min={1}
              onChange={(e) => setEditingChapter(Number(e.target.value))}
              className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none" />
            <button onClick={addBeat}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors ml-auto">
              <Plus className="w-3.5 h-3.5" />添加节拍
            </button>
          </div>
          {sceneBeats.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-4">为本章添加场景节拍，控制故事推进节奏</p>
          ) : (
            <div className="space-y-2">
              {sceneBeats.map((beat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600 w-6 text-right">{i + 1}.</span>
                  <input value={beat} onChange={(e) => updateBeat(i, e.target.value)} placeholder={`节拍 ${i + 1}`}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300 focus:border-violet-500 focus:outline-none" />
                  <button onClick={() => removeBeat(i)} className="text-zinc-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Preview Tab */}
      {tab === 'preview' && (
        <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3">写手 Prompt 注入预览</h2>
          {preview ? (
            <pre className="bg-zinc-800 rounded-lg p-4 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">{preview}</pre>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-4">点击「预览注入文本」查看将注入给写手的完整风格指令</p>
          )}
        </section>
      )}
    </div>
  )
}

function SelectFieldWithDesc({ field, value, options, onChange }: {
  field: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}): JSX.Element {
  const info = FIELD_INFO[field]
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-300 mb-1">{info?.title ?? field}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {info?.desc && <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">{info.desc}</p>}
    </div>
  )
}
