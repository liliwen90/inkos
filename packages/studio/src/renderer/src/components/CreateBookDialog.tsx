import { useState, useEffect } from 'react'
import { Loader2, BookOpenCheck, FileText, X } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { isEnglishGenre } from '../utils/lang'
import InfoTooltip from './InfoTooltip'

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
  'progression-fantasy': 'Progression Fantasy',
  'cultivation': 'Cultivation',
  'litrpg': 'LitRPG',
  'gamelit': 'GameLit',
  'isekai': 'Isekai / Portal Fantasy',
  'dungeon-core': 'Dungeon Core',
  'epic-fantasy': 'Epic Fantasy',
  'urban-fantasy': 'Urban Fantasy',
  'cozy-fantasy': 'Cozy Fantasy',
  'scifi': 'Sci-Fi / Space Opera',
  'en-horror': 'Horror / Cosmic Horror',
  'apocalypse': 'Post-Apocalyptic',
  'system-apocalypse': 'System Apocalypse',
  other: 'General'
}
const PLATFORMS_ZH: Record<string, string> = {
  qimao: '七猫', tomato: '番茄', qidian: '起点', feilu: '飞卢', other: '其他'
}
const PLATFORMS_EN: Record<string, string> = {
  royalroad: 'Royal Road', kindle: 'Kindle / KU', patreon: 'Patreon',
  scribblehub: 'ScribbleHub', wattpad: 'Wattpad', other: 'Other'
}

export default function CreateBookDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const pendingDraft = useAppStore((s) => s.pendingBookDraft)
  const setPendingBookDraft = useAppStore((s) => s.setPendingBookDraft)
  const initLang = pendingDraft?.language ?? (pendingDraft?.genre && isEnglishGenre(pendingDraft.genre) ? 'en' : 'zh')
  const [lang, setLang] = useState<'zh' | 'en'>(initLang)
  const [title, setTitle] = useState(pendingDraft?.title ?? '')
  const [genre, setGenre] = useState(pendingDraft?.genre ?? (initLang === 'en' ? 'progression-fantasy' : 'xuanhuan'))
  const [platform, setPlatform] = useState(pendingDraft?.platform ?? (initLang === 'en' ? 'royalroad' : 'tomato'))
  const [targetChapters, setTargetChapters] = useState(pendingDraft?.targetChapters ?? 200)
  const [chapterWords, setChapterWords] = useState(pendingDraft?.chapterWords ?? (initLang === 'en' ? 2500 : 3000))
  const [context, setContext] = useState(pendingDraft?.context ?? '')
  const [styleBookPaths, setStyleBookPaths] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [progressSteps, setProgressSteps] = useState<string[]>([])
  const startActivity = useAppStore((s) => s.startActivity)
  const finishActivity = useAppStore((s) => s.finishActivity)
  const addToast = useAppStore((s) => s.addToast)
  const activeGenres = lang === 'en' ? GENRES_EN : GENRES_ZH
  const activePlatforms = lang === 'en' ? PLATFORMS_EN : PLATFORMS_ZH

  // 来自创意库的草稿自动填入后清除
  useEffect(() => {
    if (pendingDraft) {
      setPendingBookDraft(null)
    }
  }, [])

  const handleLangChange = (newLang: 'zh' | 'en'): void => {
    setLang(newLang)
    setGenre(Object.keys(newLang === 'en' ? GENRES_EN : GENRES_ZH)[0])
    setPlatform(Object.keys(newLang === 'en' ? PLATFORMS_EN : PLATFORMS_ZH)[0])
    setChapterWords(newLang === 'en' ? 2500 : 3000)
  }

  const handleCreate = async (): Promise<void> => {
    if (!title.trim()) { setError('请输入书名'); return }
    const actId = startActivity(`创建《${title.trim()}》`)
    setCreating(true)
    setError('')
    setProgressSteps([])
    try {
      // 进度事件已由 Layout.tsx 全局 addProgressEvent，此处只做活动状态更新+进度步骤
      const unsub = window.hintos.onProgress((evt: unknown) => {
        const e = evt as { stage: string; detail: string; timestamp: number }
        if (!e.stage) return // 过滤 token 事件（stage 为空）
        useAppStore.getState().updateActivity(actId, e.stage)
        setProgressSteps(prev => {
          const last = prev[prev.length - 1]
          if (last && e.stage === last) return prev
          return [...prev.slice(-9), e.stage]
        })
      })
      await window.hintos.createBook({
        title: title.trim(), genre, platform,
        targetChapters, chapterWordCount: chapterWords,
        context: context.trim() || undefined,
        styleBookPaths: styleBookPaths.length > 0 ? styleBookPaths : undefined
      })
      unsub()
      addToast('success', `✓ 《${title.trim()}》创建完成`)
      finishActivity(actId)
      onClose()
    } catch (err) {
      setError((err as Error).message)
      addToast('error', `创建失败: ${(err as Error).message}`)
      finishActivity(actId, (err as Error).message)
      setCreating(false)
    }
  }

  const handleSelectStyleBooks = async (): Promise<void> => {
    const paths = await window.hintos.selectStyleBookFiles()
    if (paths) setStyleBookPaths(prev => [...prev, ...paths])
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-zinc-100">创建新书</h2>

        {/* 小说语言切换 */}
        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">小说语言</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleLangChange('zh')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                lang === 'zh'
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}>
              中文小说
            </button>
            <button type="button" onClick={() => handleLangChange('en')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                lang === 'en'
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}>
              英文小说
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">{lang === 'en' ? '书名 *（英文标题）' : '书名 *'}</label>
          <p className="text-zinc-600 text-xs">取一个有记忆点的名字。AI 建筑师会综合书名、题材、创作指导和参考书风格来生成世界观和故事规则</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
            placeholder={lang === 'en' ? 'My Novel Title' : '我的小说'} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <label className="block text-sm text-zinc-300">题材 / Genre</label>
              <InfoTooltip text={"选择小说的核心题材。每种题材内置完整的创作规则体系，\nAI 建筑师会根据题材调整世界观、角色和情节节奏。\n\n中文 27 种（玄幻/仙侠/都市/科幻/火工等）\n英文 14 种（LitRPG/Cultivation/Isekai 等）\n\n选错不会报错，但会影响 AI 生成的规则和风格。"} />
            </div>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
              {Object.entries(activeGenres).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <label className="block text-sm text-zinc-300">平台 / Platform</label>
              <InfoTooltip text={"目标发布平台。影响 AI 生成的创作策略。\n\n中文平台：\n• 七猫 — 免费+广告模式，4000字/天，开头强钩子\n• 番茄 — 免费阅读，节奏快、爽点密集\n• 起点 — 付费订阅，可慢热铺垫、叙事厚重\n• 飞卢 — 同人/系统流，节奏极快\n\n英文平台：\n• Royal Road — Progression Fantasy 主流\n• Kindle/KU — 出版化、责编要求高\n• Patreon — 提前解锁模式\n• ScribbleHub — ACG 向"} />
            </div>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
              {Object.entries(activePlatforms).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <label className="block text-sm text-zinc-300">目标章数</label>
              <InfoTooltip text={"计划写多少章，仅作为规划参考。\n建筑师会根据此分配卷纲和章节节奏。\n\n参考值：\n• 100-200 章 = 中短篇（约 30-60 万字）\n• 200-500 章 = 标准连载（约 60-150 万字）\n• 500+ 章 = 超长篇（日更型）\n\n实际可以随时在书籍配置中调整。"} />
            </div>
            <input type="number" value={targetChapters} onChange={(e) => setTargetChapters(+e.target.value)}
              min={1} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <label className="block text-sm text-zinc-300">每章字数</label>
              <InfoTooltip text={`每章目标字数。与写作控制台的"每章字数"相同含义。\n\n建议：\n• 中文: 2000-4000 字/章（推荐 3000）\n• 英文: 1500-3000 words/chapter（推荐 2500）\n\n此值作为初始默认值，写作时可在控制台调整。`} />
            </div>
            <input type="number" value={chapterWords} onChange={(e) => setChapterWords(+e.target.value)}
              min={1000} step={500} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <label className="block text-sm text-zinc-300">创作指导（可选）</label>
            <InfoTooltip text={"向 AI 建筑师描述你想要的故事方向。\n\n可以包括：\n• 故事背景和世界观设定\n• 主角身份、性格、金手指\n• 想要的风格和节奏\n• 参考作品或特定要求\n\n建筑师会综合这些信息生成世界观、卷纲、\n写作规则。写得越具体，生成质量越高。\n留空则 AI 自由发挥。"} />
          </div>
          <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={context.length > 200 ? 8 : 3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
            placeholder={lang === 'en' ? '描述你想要的故事方向、角色、世界观等（可用英文或中文）...' : '描述你想要的故事方向、角色、世界观等...'} />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">风格参考书 (可选)</label>
          <p className="text-zinc-600 text-xs">导入参考书后，AI建筑师会分析其文风特征并融入世界观和写作规则中</p>
          <button type="button" onClick={handleSelectStyleBooks} disabled={creating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 rounded text-sm border border-zinc-700 transition-colors">
            <FileText className="w-3.5 h-3.5" /> 选择 .txt 文件
          </button>
          {styleBookPaths.length > 0 && (
            <div className="space-y-1 mt-2">
              {styleBookPaths.map((fp, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-zinc-800/50 rounded px-2 py-1">
                  <FileText className="w-3 h-3 text-violet-400 shrink-0" />
                  <span className="text-zinc-300 truncate">{fp.split(/[\\/]/).pop()}</span>
                  <button onClick={() => setStyleBookPaths(prev => prev.filter((_, j) => j !== i))}
                    className="ml-auto text-zinc-500 hover:text-red-400 shrink-0" title="移除">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {creating && progressSteps.length > 0 && (
          <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
            {progressSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {i === progressSteps.length - 1
                  ? <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin shrink-0 mt-0.5" />
                  : <BookOpenCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                <span className={i === progressSteps.length - 1 ? 'text-zinc-200' : 'text-zinc-500'}>{step}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} disabled={creating}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm transition-colors">
            取消
          </button>
          <button onClick={handleCreate} disabled={creating}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {creating ? '创建中（AI正在生成世界观）...' : styleBookPaths.length > 0 ? `创建（含${styleBookPaths.length}本参考书）` : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
