import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Save, Plus, Trash2, Music, Loader2 } from 'lucide-react'
import { useAppStore } from '../stores/app-store'

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

const povOptions = [
  { value: 'first', label: '第一人称' },
  { value: 'third-limited', label: '第三人称·有限' },
  { value: 'third-omniscient', label: '第三人称·全知' }
]

const tenseOptions = [
  { value: 'past', label: '过去时' },
  { value: 'present', label: '现在时' }
]

const pacingOptions = [
  { value: 'fast', label: '快节奏' },
  { value: 'balanced', label: '均衡' },
  { value: 'slow', label: '慢节奏' }
]

const moodOptions = [
  { value: 'neutral', label: '中性' },
  { value: 'tense', label: '紧张' },
  { value: 'warm', label: '温馨' },
  { value: 'dark', label: '黑暗' },
  { value: 'humorous', label: '幽默' },
  { value: 'epic', label: '史诗' }
]

const showDontTellOptions = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' }
]

const dialogueOptions = [
  { value: 'formal', label: '正式' },
  { value: 'natural', label: '自然' },
  { value: 'colloquial', label: '口语化' }
]

const densityOptions = [
  { value: 'sparse', label: '简洁' },
  { value: 'medium', label: '适中' },
  { value: 'rich', label: '丰富' }
]

export default function HumanizeEngine(): JSX.Element {
  const bookId = useAppStore((s) => s.currentBookId)
  const books = useAppStore((s) => s.books)

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
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'settings' | 'voice' | 'beats' | 'preview'>('settings')

  const currentBook = books.find((b) => b.bookId === bookId)

  const loadAll = useCallback(async () => {
    if (!bookId) return
    try {
      const [s, vc] = await Promise.all([
        window.inkos.loadHumanizeSettings(bookId),
        window.inkos.loadVoiceCards(bookId)
      ])
      setSettings(s)
      setVoiceCards(vc)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [bookId])

  useEffect(() => { loadAll() }, [loadAll])

  const loadBeats = useCallback(async () => {
    if (!bookId) return
    const beats = await window.inkos.loadSceneBeats(bookId, editingChapter)
    setSceneBeats(beats ?? [])
  }, [bookId, editingChapter])

  useEffect(() => { loadBeats() }, [loadBeats])

  const handleSave = async (): Promise<void> => {
    if (!bookId) return
    setSaving(true)
    try {
      await Promise.all([
        window.inkos.saveHumanizeSettings(bookId, settings),
        window.inkos.saveVoiceCards(bookId, voiceCards),
        window.inkos.saveSceneBeats(bookId, editingChapter, sceneBeats)
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async (): Promise<void> => {
    if (!bookId) return
    try {
      const text = await window.inkos.buildStyleGuidance(bookId, editingChapter)
      setPreview(text)
      setTab('preview')
    } catch (e) {
      setError((e as Error).message)
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
            人性化引擎
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            配置写作风格 · 角色声音 · 场景节拍
            {currentBook && <span className="text-violet-400 ml-2">· {currentBook.title}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePreview}
            className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs text-zinc-300 transition-colors">
            预览注入文本
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SelectField label="视角" value={settings.pov} options={povOptions}
              onChange={(v) => setSettings((s) => ({ ...s, pov: v as HumanizeSettings['pov'] }))} />
            <SelectField label="时态" value={settings.tense} options={tenseOptions}
              onChange={(v) => setSettings((s) => ({ ...s, tense: v as HumanizeSettings['tense'] }))} />
            <SelectField label="节奏" value={settings.pacing} options={pacingOptions}
              onChange={(v) => setSettings((s) => ({ ...s, pacing: v as HumanizeSettings['pacing'] }))} />
            <SelectField label="基调" value={settings.mood} options={moodOptions}
              onChange={(v) => setSettings((s) => ({ ...s, mood: v as HumanizeSettings['mood'] }))} />
            <SelectField label="展示vs叙述" value={settings.showDontTell} options={showDontTellOptions}
              onChange={(v) => setSettings((s) => ({ ...s, showDontTell: v as HumanizeSettings['showDontTell'] }))} />
            <SelectField label="对话风格" value={settings.dialogue} options={dialogueOptions}
              onChange={(v) => setSettings((s) => ({ ...s, dialogue: v as HumanizeSettings['dialogue'] }))} />
            <SelectField label="描写密度" value={settings.density} options={densityOptions}
              onChange={(v) => setSettings((s) => ({ ...s, density: v as HumanizeSettings['density'] }))} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">创意度 ({settings.creativity}/10)</label>
            <input type="range" min="1" max="10" value={settings.creativity}
              onChange={(e) => setSettings((s) => ({ ...s, creativity: Number(e.target.value) }))}
              className="w-full max-w-xs accent-violet-500" />
            <p className="text-[10px] text-zinc-600 mt-1">低=忠于大纲，高=更多即兴发挥</p>
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
            <p className="text-sm text-zinc-500 text-center py-4">点击"预览注入文本"查看将注入给写手的完整风格指令</p>
          )}
        </section>
      )}
    </div>
  )
}

function SelectField({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
