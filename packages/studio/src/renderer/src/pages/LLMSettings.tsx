import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Settings, Check, X, Loader2, Zap, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Info, Search, ArrowUp, ArrowDown } from 'lucide-react'
import { useAppStore, type LLMConfig } from '../stores/app-store'

// ── 类型 ──

interface PoolEntry {
  id: string
  label: string
  provider: string
  baseUrl: string
  apiKey: string
  model: string
}

interface LangPreset {
  defaultLLM: string
  agentMap: Record<string, string>
}

interface SearchProviderUI {
  id: string
  label: string
  type: 'tavily' | 'deepseek-search' | 'web-agent'
  apiKey: string
  apiUrl: string
  username: string
  password: string
  enabled: boolean
  supportedLanguages: ('zh' | 'en')[]
}

const SEARCH_TYPE_LABELS: Record<string, string> = {
  'tavily': 'Tavily API',
  'deepseek-search': 'DeepSeek Search',
  'web-agent': 'Web Agent',
}

const SEARCH_TYPE_DEFAULTS: Record<string, string> = {
  'tavily': 'https://api.tavily.com',
  'deepseek-search': 'https://api.deepseek.com/v1',
  'web-agent': '',
}

// ── 常量 ──

const AGENT_LABELS: Record<string, { label: string; desc: string; emoji: string; detail: string }> = {
  architect: {
    label: '建筑师', desc: '规划大纲和世界观', emoji: '🏗️',
    detail: '📐 建筑师 (Architect)\n\n职责：创建整本书的基础架构\n\n• 生成世界观设定 (story_bible.md)\n• 规划卷级大纲 (volume_outline.md)\n• 初始化所有真相文件：状态卡、伏笔池、\n  数值账本、支线板、情感弧线、角色矩阵、\n  实体注册表等 12 个文件\n• 解析书籍规则中的主角人设锁定和行为约束\n• 应用"黄金三章"法则确保开篇吸引力\n\nToken 消耗：中等（仅创建书籍时调用一次）\n角色定位：规划 / 推理型',
  },
  writer: {
    label: '写手', desc: '生成章节正文（最耗 token）', emoji: '✍️',
    detail: '✍️ 写手 (Writer)\n\n职责：生成每章正文，管线核心环节\n\n• 加载 12 个上下文文件（世界观、大纲、状态卡、\n  伏笔池、账本、摘要、支线板、情感弧线、角色\n  矩阵、实体注册表、风格指南、风格画像）\n• 加载最近 3 章完整正文作为上下文\n• 输出：写作自检表 → 正文 → 更新状态卡/\n  伏笔池/账本/摘要/支线/弧线/矩阵\n• 提取角色对话指纹确保声纹一致性\n• 检索相关历史摘要补充远程上下文\n• 写完后自动触发实体提取器更新注册表\n• 应用题材专属的反 AI 写作铁律\n\nToken 消耗：最高（每章调用，输入+输出最大）\n角色定位：创作型 — 中文推荐 DeepSeek / 英文推荐 Claude',
  },
  auditor: {
    label: '审计员', desc: '27 维度质量审查', emoji: '🔍',
    detail: '🔍 审计员 (Continuity Auditor)\n\n职责：27 维度机械/结构性质量审查\n\n结构性（最高优先级）：\n① OOC检查 ② 时间线 ③ 设定冲突\n④ 战力崩坏 ⑤ 数值检查 ⑥ 伏笔检查\n\n质量检查：\n⑦ 节奏 ⑧ 文风 ⑨ 信息越界 ⑩ 词汇疲劳\n⑪ 利益链断裂 ⑫ 年代考据\n\n模式检查：\n⑬ 配角降智 ⑭ 工具人化 ⑮ 爽点虚化\n⑯ 台词失真 ⑰ 流水账 ⑱ 知识污染\n⑲ 视角一致性 ⑳ 段落等长 ㉑ 套话密度\n㉒ 公式化转折 ㉓ 列表式结构 ㉔ 支线停滞\n㉕ 弧线平坦 ㉖ 节奏单调 ㉗ 敏感词\n\n• 加载实体注册表交叉验证事实一致性\n• 输出 JSON: passed / issues / summary\n\nToken 消耗：中等\n角色定位：分析 / 推理型',
  },
  reviser: {
    label: '修订者', desc: '修复审计发现的问题', emoji: '✏️',
    detail: '✏️ 修订者 (Reviser)\n\n职责：修复审计员 + 深度审查发现的全部问题\n\n• 接收审计员 27 维度 + 深度审查 5 维度的\n  issues 列表，合并后逐条修复\n• 保持字数在原文 ±10% 范围内\n• 修复时不引入新的连续性问题\n• 保持原始文风和叙事节奏\n• 不改变剧情走向，只修复技术性问题\n\n修复范围：\n• OOC → 调整对话/行为回归人设\n• 时间线矛盾 → 修正时间描述\n• 设定冲突 → 与世界观对齐\n• 战力/数值错误 → 修正数据\n• 遗漏伏笔 → 补埋线索\n• 情绪急转 → 添加过渡铺垫\n• 声纹偏移 → 恢复角色语言风格\n\nToken 消耗：中高（输入=原文+问题，输出=修改后全文）\n角色定位：创作型 — 需要文学创作能力',
  },
  'continuity-plus': {
    label: '深度审查', desc: '5 维度叙事连续性审计', emoji: '🔬',
    detail: '🔬 深度审查 (ContinuityPlus)\n\n职责：深层叙事一致性审查（与审计员互补）\n\n审计员检查机械/结构问题，深度审查专注于\n"技术上没错但读起来别扭"的叙事层面：\n\n1️⃣ 角色声纹一致性\n  语域切换/词汇水平/口头禅/语言习惯\n  加载声音卡片 (voice-cards) 交叉验证\n\n2️⃣ 情绪脉络连贯\n  禁止情绪急转，情绪有惯性\n  升级须有节拍：酝酿→积累→爆发→余波\n\n3️⃣ 场景转换质量\n  时间/空间/视角锚点，转换手法多样化\n\n4️⃣ 感官环境连续性\n  天气/伤势/物品/光照是否持续存在\n\n5️⃣ 动机连续性与决策逻辑\n  目标转变需催化事件，牺牲须与利害成正比\n\n• 加载实体注册表验证不可变属性\n• 加载最近 2 章（各 2000 字）比较上下文\n\nToken 消耗：中等\n角色定位：分析 / 推理型',
  },
  polisher: {
    label: '润色师', desc: '文学级散文润色（反AI）', emoji: '💎',
    detail: '💎 润色师 (Polisher)\n\n职责：管线最终环节，文学级散文质感提升\n\n始终作为最后一个 Agent 运行，确保最终\n输出达到发表级别的文学水准：\n\n1️⃣ 反 AI 痕迹消除（最高优先级！）\n  消灭"仿佛/不禁/宛如/竟然"等 AI 标记词\n  打破 AI 的齐整段落结构\n  用具象替换抽象，用动作替换心理旁白\n\n2️⃣ Show Don\'t Tell\n  "她很害怕"→ 用身体语言、环境变化展示\n\n3️⃣ 句式节奏\n  长短句交替呼吸感，关键时刻短句加速\n\n4️⃣ 对话工艺\n  对话须推进剧情或揭示角色，避免信息投喂\n\n5️⃣ 感官分层 — 视/听/触/嗅/味立体化\n\n6️⃣ 散文质感\n  中文：声韵意识、四字格节奏\n  英文：多音节词控制、韵律变化\n\n7️⃣ 读者信任\n  用特征细节（而非形容词堆砌）建立可信度\n\nToken 消耗：中高（输入=全文，输出=润色后全文）\n角色定位：创作型 — 散文质感最关键',
  },
}

const AGENT_NAMES = ['architect', 'writer', 'auditor', 'reviser', 'continuity-plus', 'polisher'] as const

// ── 工具函数 ──

function generateId(label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'llm'
  return `${base}-${Date.now().toString(36)}`
}

/** 从 pools + presets 按语言解析出标准路由格式 */
function resolveForLanguage(
  pools: { zh: PoolEntry[]; en: PoolEntry[] },
  presets: { zh: LangPreset; en: LangPreset },
  lang: 'zh' | 'en',
  temperature: number,
  maxTokens: number
): { default: LLMConfig; agents: Record<string, { model: string; apiKey: string; baseUrl: string; provider: string }> } {
  const pool = pools[lang] || []
  const preset = presets[lang]
  const byId = new Map(pool.map(e => [e.id, e]))

  const defaultEntry = byId.get(preset?.defaultLLM || '') || pool[0]
  if (!defaultEntry) {
    throw new Error(`${lang === 'zh' ? '中文' : 'English'} LLM 池为空，请先添加至少一个模型`)
  }

  const defaultConfig: LLMConfig = {
    provider: defaultEntry.provider,
    baseUrl: defaultEntry.baseUrl,
    apiKey: defaultEntry.apiKey,
    model: defaultEntry.model,
    temperature,
    maxTokens,
  }

  const agents: Record<string, { model: string; apiKey: string; baseUrl: string; provider: string }> = {}
  if (preset?.agentMap) {
    for (const [agent, llmId] of Object.entries(preset.agentMap)) {
      const entry = byId.get(llmId)
      if (!entry) continue
      // 与默认相同则跳过（路由会 fallthrough 到 default）
      if (entry.id === defaultEntry.id) continue
      agents[agent] = {
        model: entry.model,
        apiKey: entry.apiKey,
        baseUrl: entry.baseUrl,
        provider: entry.provider,
      }
    }
  }

  return { default: defaultConfig, agents }
}

/** 智能推荐 Agent 分配预设 */
function buildRecommendedPreset(pool: PoolEntry[], lang: 'zh' | 'en'): LangPreset {
  if (pool.length === 0) return { defaultLLM: '', agentMap: {} }

  // 找到创作型模型（写手/修订/润色）和分析型模型（建筑师/审计/深度审查）
  let writerModel = pool[0]
  let analystModel = pool.length > 1 ? pool[1] : pool[0]

  if (lang === 'zh') {
    const deepseek = pool.find(e => e.model.toLowerCase().includes('deepseek'))
    const mimo = pool.find(e => e.model.toLowerCase().includes('mimo'))
    if (deepseek) writerModel = deepseek
    if (mimo) analystModel = mimo
  } else {
    const claude = pool.find(e => e.model.toLowerCase().includes('claude'))
    const gemini = pool.find(e => e.model.toLowerCase().includes('gemini'))
    if (claude) writerModel = claude
    if (gemini) analystModel = gemini
  }

  return {
    defaultLLM: writerModel.id,
    agentMap: {
      architect: analystModel.id,
      writer: writerModel.id,
      auditor: analystModel.id,
      reviser: writerModel.id,
      'continuity-plus': analystModel.id,
      polisher: writerModel.id,
    }
  }
}

// ── Tooltip 组件 ──

function AgentTooltip({ text }: { text: string }): JSX.Element {
  const [show, setShow] = useState(false)
  const [style, setStyle] = useState<React.CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)

  const handleEnter = (): void => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const goUp = rect.bottom + 380 > window.innerHeight
      const left = Math.min(Math.max(rect.left - 140, 8), window.innerWidth - 340)
      setStyle(goUp
        ? { position: 'fixed', left, bottom: window.innerHeight - rect.top + 6 }
        : { position: 'fixed', left, top: rect.bottom + 6 })
    }
    setShow(true)
  }

  return (
    <div className="relative inline-flex" ref={ref}
      onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      <Info className="w-3.5 h-3.5 text-zinc-600 hover:text-violet-400 cursor-help transition-colors" />
      {show && createPortal(
        <div style={style}
          className="z-[9999] w-80 px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-900/95 backdrop-blur shadow-2xl text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap pointer-events-none">
          {text}
        </div>,
        document.body,
      )}
    </div>
  )
}

import InfoTooltip from '../components/InfoTooltip'

// ── 主组件 ──

export default function LLMSettings(): JSX.Element {
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const currentBookId = useAppStore((s) => s.currentBookId)
  const setPipelineReady = useAppStore((s) => s.setPipelineReady)
  const setLLMConfig = useAppStore((s) => s.setLLMConfig)
  const addToast = useAppStore((s) => s.addToast)
  const startActivity = useAppStore((s) => s.startActivity)
  const finishActivity = useAppStore((s) => s.finishActivity)

  // ── 语言池状态 ──
  const [pools, setPools] = useState<{ zh: PoolEntry[]; en: PoolEntry[] }>({ zh: [], en: [] })
  const [presets, setPresets] = useState<{ zh: LangPreset; en: LangPreset }>({
    zh: { defaultLLM: '', agentMap: {} },
    en: { defaultLLM: '', agentMap: {} },
  })

  // 编辑条目状态：`${lang}-new` 或 `${lang}-${id}`
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<PoolEntry>({ id: '', label: '', provider: 'openai', baseUrl: '', apiKey: '', model: '' })

  // Agent 分配 tab
  const [presetTab, setPresetTab] = useState<'zh' | 'en'>('zh')

  // 高级设置
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(8192)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 搜索提供商
  const [searchProviders, setSearchProviders] = useState<SearchProviderUI[]>([])
  const [searchRouting, setSearchRouting] = useState<{ zh: string[]; en: string[] }>({ zh: [], en: [] })
  const [showSearchProviders, setShowSearchProviders] = useState(false)
  const [editingSearchKey, setEditingSearchKey] = useState<string | null>(null)
  const [searchForm, setSearchForm] = useState<SearchProviderUI>({
    id: '', label: '', type: 'tavily', apiKey: '', apiUrl: 'https://api.tavily.com',
    username: '', password: '', enabled: true, supportedLanguages: ['zh', 'en']
  })

  // UI 状态
  const [testResults, setTestResults] = useState<{ label: string; ok: boolean; error?: string; latencyMs?: number }[]>([])
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initializing, setInitializing] = useState(false)

  // ── 初始化加载 ──
  useEffect(() => {
    if (!projectLoaded) return
    window.hintos.loadTaskRouting().then((routing: unknown) => {
      if (!routing || typeof routing !== 'object') return
      const r = routing as Record<string, unknown>
      if (r.pools) {
        // 新格式：语言池
        setPools(r.pools as { zh: PoolEntry[]; en: PoolEntry[] })
        setPresets((r.presets as { zh: LangPreset; en: LangPreset }) || {
          zh: { defaultLLM: '', agentMap: {} },
          en: { defaultLLM: '', agentMap: {} },
        })
        const def = r.default as Record<string, unknown> | undefined
        if (def?.temperature) setTemperature(Number(def.temperature) || 0.7)
        if (def?.maxTokens) setMaxTokens(Number(def.maxTokens) || 8192)
        // 搜索提供商
        if (r.searchProviders) {
          const sp = r.searchProviders as { providers?: SearchProviderUI[]; routing?: { zh?: string[]; en?: string[] } }
          if (sp.providers) setSearchProviders(sp.providers)
          if (sp.routing) setSearchRouting({ zh: sp.routing.zh || [], en: sp.routing.en || [] })
        }
      } else if (r.default) {
        // 旧格式：迁移到语言池
        migrateOldRouting(r)
      }
    })
  }, [projectLoaded])

  /** 从旧 default+agents 格式迁移到语言池 */
  const migrateOldRouting = (r: Record<string, unknown>): void => {
    const def = r.default as LLMConfig
    const agents = r.agents as Record<string, { model: string; apiKey: string; baseUrl: string; provider: string }> | undefined
    // 以 model 名去重
    const byModel: Map<string, PoolEntry> = new Map()
    const defId = generateId(def.model)
    byModel.set(def.model, {
      id: defId, label: def.model,
      provider: def.provider, baseUrl: def.baseUrl, apiKey: def.apiKey, model: def.model,
    })
    const agentMap: Record<string, string> = {}
    if (agents) {
      for (const [name, slot] of Object.entries(agents)) {
        if (!slot) continue
        let entry = byModel.get(slot.model)
        if (!entry) {
          entry = {
            id: generateId(slot.model), label: slot.model,
            provider: slot.provider, baseUrl: slot.baseUrl, apiKey: slot.apiKey, model: slot.model,
          }
          byModel.set(slot.model, entry)
        }
        agentMap[name] = entry.id
      }
    }
    const pool = Array.from(byModel.values())
    setPools({ zh: pool, en: [] })
    setPresets({
      zh: { defaultLLM: defId, agentMap },
      en: { defaultLLM: '', agentMap: {} },
    })
    setTemperature(def.temperature || 0.7)
    setMaxTokens(def.maxTokens || 8192)
  }

  // ── 池条目操作 ──

  const startAddEntry = (lang: 'zh' | 'en'): void => {
    setEditingKey(`${lang}:__new__`)
    setEditForm({ id: '', label: '', provider: 'openai', baseUrl: '', apiKey: '', model: '' })
  }

  const startEditEntry = (lang: 'zh' | 'en', entry: PoolEntry): void => {
    setEditingKey(`${lang}:${entry.id}`)
    setEditForm({ ...entry })
  }

  const confirmEditEntry = (): void => {
    if (!editingKey || !editForm.label.trim() || !editForm.model.trim() || !editForm.apiKey.trim()) return
    const lang = editingKey.startsWith('zh') ? 'zh' as const : 'en' as const
    const isNew = editingKey.endsWith(':__new__')
    const newEntry: PoolEntry = { ...editForm, id: isNew ? generateId(editForm.label) : editForm.id }

    setPools(prev => {
      const pool = [...prev[lang]]
      if (isNew) {
        pool.push(newEntry)
      } else {
        const idx = pool.findIndex(e => e.id === editForm.id)
        if (idx >= 0) pool[idx] = newEntry
      }
      return { ...prev, [lang]: pool }
    })
    // 第一个条目自动设为默认
    if (isNew) {
      setPresets(prev => {
        if (!prev[lang].defaultLLM) {
          return { ...prev, [lang]: { ...prev[lang], defaultLLM: newEntry.id } }
        }
        return prev
      })
    }
    setEditingKey(null)
  }

  const deleteEntry = (lang: 'zh' | 'en', id: string): void => {
    const newPool = pools[lang].filter(e => e.id !== id)
    setPools(prev => ({ ...prev, [lang]: newPool }))
    setPresets(prev => {
      const preset = { ...prev[lang] }
      const newMap = { ...preset.agentMap }
      for (const [k, v] of Object.entries(newMap)) {
        if (v === id) delete newMap[k]
      }
      if (preset.defaultLLM === id) preset.defaultLLM = newPool[0]?.id || ''
      return { ...prev, [lang]: { ...preset, agentMap: newMap } }
    })
    if (editingKey?.includes(id)) setEditingKey(null)
  }

  // ── Agent 分配 ──

  const getAgentLLM = (agent: string): string => {
    const preset = presets[presetTab]
    const pool = pools[presetTab]
    const mapped = preset.agentMap[agent]
    if (mapped && pool.some(e => e.id === mapped)) return mapped
    if (preset.defaultLLM && pool.some(e => e.id === preset.defaultLLM)) return preset.defaultLLM
    return pool[0]?.id || ''
  }

  const setAgentLLM = (agent: string, llmId: string): void => {
    setPresets(prev => ({
      ...prev,
      [presetTab]: {
        ...prev[presetTab],
        agentMap: { ...prev[presetTab].agentMap, [agent]: llmId },
      }
    }))
  }

  const applyRecommend = (): void => {
    const pool = pools[presetTab]
    if (pool.length === 0) return
    const rec = buildRecommendedPreset(pool, presetTab)
    setPresets(prev => ({ ...prev, [presetTab]: rec }))
  }

  // ── 检查是否有可用池 ──
  const hasAnyPool = pools.zh.length > 0 || pools.en.length > 0

  // ── 保存 ──
  const handleSave = async (): Promise<void> => {
    setSaving(true); setSaved(false)
    try {
      // 确定当前活跃语言
      let lang: 'zh' | 'en' = presetTab
      if (currentBookId) {
        try { lang = await window.hintos.resolveBookLanguage(currentBookId) } catch { /* use tab */ }
      }
      // 如果当前语言池为空，尝试另一种语言
      const otherLang = lang === 'zh' ? 'en' : 'zh'
      const effectiveLang = pools[lang].length > 0 ? lang : pools[otherLang].length > 0 ? otherLang : null

      if (effectiveLang) {
        const resolved = resolveForLanguage(pools, presets, effectiveLang, temperature, maxTokens)
        await window.hintos.saveLLMConfig(resolved.default)
        setLLMConfig(resolved.default)
        await window.hintos.saveTaskRouting({ default: resolved.default, agents: resolved.agents, pools, presets, searchProviders: { providers: searchProviders, routing: searchRouting } })
      } else {
        // 两个池都为空，只保存空池配置
        await window.hintos.saveTaskRouting({ pools, presets, searchProviders: { providers: searchProviders, routing: searchRouting } })
      }
      setSaved(true)
      addToast('success', '✓ LLM 配置已保存')
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  // ── 测试所有连接 ──
  const handleTest = async (): Promise<void> => {
    const actId = startActivity('测试LLM连接')
    setTesting(true); setTestResults([])
    try {
      const results: typeof testResults = []
      for (const lang of ['zh', 'en'] as const) {
        for (const entry of pools[lang]) {
          const config = {
            provider: entry.provider, baseUrl: entry.baseUrl, apiKey: entry.apiKey,
            model: entry.model, temperature, maxTokens,
          }
          const r = await window.hintos.testLLMConnection(config)
          const langLabel = lang === 'zh' ? '中' : '英'
          results.push({ label: `[${langLabel}] ${entry.label} (${entry.model})`, ...r })
        }
      }
      setTestResults(results)
      const allOk = results.every(r => r.ok)
      addToast(allOk ? 'success' : 'error',
        results.length === 0
          ? '⚠ 没有可测试的模型'
          : allOk
            ? `✓ 全部 ${results.length} 个连接测试通过`
            : `⚠ ${results.filter(r => !r.ok).length}/${results.length} 个连接失败`)
      finishActivity(actId, allOk ? undefined : '部分连接失败')
    } catch (err) {
      addToast('error', `测试异常: ${(err as Error).message}`)
      finishActivity(actId, (err as Error).message)
    } finally { setTesting(false) }
  }

  // ── 初始化管线 ──
  const handleInitPipeline = async (): Promise<void> => {
    const actId = startActivity('初始化管线')
    setInitializing(true)
    try {
      // 确定语言
      let lang: 'zh' | 'en' = presetTab
      if (currentBookId) {
        try { lang = await window.hintos.resolveBookLanguage(currentBookId) } catch { /* use tab */ }
      }
      const pool = pools[lang]
      if (pool.length === 0) throw new Error(`${lang === 'zh' ? '中文' : 'English'} LLM 池为空，请先添加模型`)

      const resolved = resolveForLanguage(pools, presets, lang, temperature, maxTokens)
      const routing = { default: resolved.default, agents: resolved.agents }

      // 保存 + 初始化
      await window.hintos.saveLLMConfig(resolved.default)
      setLLMConfig(resolved.default)
      await window.hintos.saveTaskRouting({ ...routing, pools, presets, searchProviders: { providers: searchProviders, routing: searchRouting } })

      if (Object.keys(resolved.agents).length > 0) {
        await window.hintos.initPipelineRouting(routing)
      } else {
        await window.hintos.initPipeline(resolved.default)
      }
      setPipelineReady(true)

      const langLabel = lang === 'zh' ? '中文' : 'English'
      const agentSummary = AGENT_NAMES.map(n => {
        const llmId = presets[lang]?.agentMap[n] || presets[lang]?.defaultLLM || pool[0]?.id
        const entry = pool.find(e => e.id === llmId)
        return `${AGENT_LABELS[n].emoji}${entry?.label || '默认'}`
      }).join(' ')

      setTestResults([{ label: `管线初始化成功 — ${langLabel} 模式 | ${agentSummary}`, ok: true }])
      addToast('success', `✓ 管线初始化成功（${langLabel} 模式）`)
      finishActivity(actId)
    } catch (err) {
      setTestResults([{ label: '初始化管线', ok: false, error: (err as Error).message }])
      addToast('error', `管线初始化失败: ${(err as Error).message}`)
      finishActivity(actId, (err as Error).message)
    } finally { setInitializing(false) }
  }

  // ── 渲染入口条目的编辑表单 ──
  const renderEntryForm = (): JSX.Element => (
    <div className="px-4 py-3 space-y-3 bg-zinc-900/50">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <label className="block text-xs text-zinc-500">名称 *</label>
          <InfoTooltip text={"给这个 LLM 连接取一个好记的名字。\n\n例如：DeepSeek V3、Claude Sonnet、Gemini Pro 等。\n名称仅用于展示，不影响 API 调用。"} />
        </div>
        <input type="text" value={editForm.label}
          onChange={(e) => setEditForm(f => ({ ...f, label: e.target.value }))}
          placeholder="例：DeepSeek V3"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <label className="block text-xs text-zinc-500">Provider</label>
          <InfoTooltip text={"LLM 服务提供商协议类型。\n\n• OpenAI 兼容 — 适用于 OpenAI、DeepSeek、通义千问、智谱、中转 API 等所有兼容 OpenAI 格式的服务\n• Anthropic — 仅用于 Claude 系列模型（官方 API 或官方代理）\n\n如果不确定，选 OpenAI 兼容即可。"} />
        </div>
        <select value={editForm.provider}
          onChange={(e) => setEditForm(f => ({ ...f, provider: e.target.value }))}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500">
          <option value="openai">OpenAI 兼容 (OpenAI/DeepSeek/中转)</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <label className="block text-xs text-zinc-500">API Base URL *</label>
          <InfoTooltip text={"LLM 服务的 API 基础地址，必须以 https:// 开头。\n\n常见地址：\n• DeepSeek: https://api.deepseek.com/v1\n• OpenAI: https://api.openai.com/v1\n• Anthropic: https://api.anthropic.com\n• 通义千问: https://dashscope.aliyuncs.com/compatible-mode/v1\n• 智谱 GLM: https://open.bigmodel.cn/api/paas/v4\n\n如果你用中转 API（如 OneAPI、NewAPI），填中转服务的地址。"} />
        </div>
        <input type="text" value={editForm.baseUrl}
          onChange={(e) => setEditForm(f => ({ ...f, baseUrl: e.target.value }))}
          placeholder="https://api.deepseek.com/v1"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <label className="block text-xs text-zinc-500">API Key *</label>
          <InfoTooltip text={"API 密钥，用于验证你的身份。以 sk- 开头。\n\n获取方式：\n• DeepSeek: platform.deepseek.com → API Keys\n• OpenAI: platform.openai.com → API Keys\n• Anthropic: console.anthropic.com → API Keys\n\n密钥仅存储在本地，不会上传到任何服务器。\n建议不要在多人共用的电脑上保存密钥。"} />
        </div>
        <input type="password" value={editForm.apiKey}
          onChange={(e) => setEditForm(f => ({ ...f, apiKey: e.target.value }))}
          placeholder="sk-..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <label className="block text-xs text-zinc-500">模型名称 *（API 精确名称）</label>
          <InfoTooltip text={"调用 API 时使用的精确模型名称。必须与服务商文档一致。\n\n常见模型：\n• DeepSeek: deepseek-chat / deepseek-reasoner\n• OpenAI: gpt-4o / gpt-4o-mini\n• Claude: claude-sonnet-4-20250514\n• Gemini: gemini-2.5-pro\n• 通义: qwen-max / qwen-plus\n• 智谱: glm-4-plus\n\n填错会导致 API 调用失败。\n不确定时可点「测试连接」验证。"} />
        </div>
        <input type="text" value={editForm.model}
          onChange={(e) => setEditForm(f => ({ ...f, model: e.target.value }))}
          placeholder="deepseek-chat / claude-sonnet-4-20250514"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={confirmEditEntry}
          disabled={!editForm.label.trim() || !editForm.model.trim() || !editForm.apiKey.trim()}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded text-xs font-medium transition-colors">
          确认
        </button>
        <button onClick={() => setEditingKey(null)}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs transition-colors">
          取消
        </button>
      </div>
    </div>
  )

  // ── 渲染一个语言池 section ──
  const renderPoolSection = (lang: 'zh' | 'en'): JSX.Element => {
    const isZh = lang === 'zh'
    const pool = pools[lang]
    const headerClass = isZh ? 'text-sky-400' : 'text-emerald-400'
    const badgeClass = isZh ? 'bg-sky-600/20 text-sky-300' : 'bg-emerald-600/20 text-emerald-300'
    const addHoverClass = isZh ? 'hover:text-sky-400' : 'hover:text-emerald-400'

    return (
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        {/* 池头部 */}
        <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800/30">
          <span className={`text-sm font-semibold ${headerClass}`}>
            {isZh ? '🇨🇳 中文强势 LLM' : '🇬🇧 英文强势 LLM'}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeClass}`}>{pool.length} 个</span>
        </div>

        {/* 空提示 */}
        {pool.length === 0 && editingKey !== `${lang}:__new__` && (
          <div className="px-4 py-6 text-center text-zinc-600 text-sm">
            {isZh ? '暂无模型，点击下方按钮添加中文强势 LLM（如 DeepSeek、MiMo）' : 'No models yet. Add English-capable LLMs below (e.g. Claude, Gemini)'}
          </div>
        )}

        {/* 条目列表 */}
        <div className="divide-y divide-zinc-800/50">
          {pool.map(entry => {
            const isEditing = editingKey === `${lang}:${entry.id}`
            return (
              <div key={entry.id}>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isZh ? 'bg-sky-500' : 'bg-emerald-500'}`} />
                  <span className="text-sm font-medium text-zinc-200 flex-1 truncate">{entry.label}</span>
                  <span className="text-xs text-zinc-500 truncate max-w-[160px]">{entry.model}</span>
                  <button onClick={() => startEditEntry(lang, entry)}
                    className="p-1 text-zinc-500 hover:text-violet-400 transition-colors" title="编辑">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteEntry(lang, entry.id)}
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors" title="删除">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {isEditing && <div className="border-t border-zinc-800/50">{renderEntryForm()}</div>}
              </div>
            )
          })}

          {/* 新增表单 */}
          {editingKey === `${lang}:__new__` && (
            <div>{renderEntryForm()}</div>
          )}
        </div>

        {/* 添加按钮 */}
        {editingKey !== `${lang}:__new__` && (
          <div className="border-t border-zinc-800/50 px-4 py-2.5">
            <button onClick={() => startAddEntry(lang)}
              className={`flex items-center gap-1.5 text-xs text-zinc-500 ${addHoverClass} transition-colors`}>
              <Plus className="w-3.5 h-3.5" />
              {isZh ? '添加中文 LLM' : '添加英文 LLM'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── 未加载项目 ──
  if (!projectLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <Settings className="w-8 h-8 mb-2" />
        <p>请先打开 HintOS 项目</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">LLM 配置</h1>
        <p className="text-zinc-500 text-sm mt-1">按语言分组管理 AI 模型，自动匹配书籍语言</p>
      </div>

      {/* ══ 中文 LLM 池 ══ */}
      {renderPoolSection('zh')}

      {/* ══ 英文 LLM 池 ══ */}
      {renderPoolSection('en')}

      {/* ══ Agent 角色分配 ══ */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        {/* Tab 栏 */}
        <div className="flex border-b border-zinc-800">
          <button onClick={() => setPresetTab('zh')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              presetTab === 'zh'
                ? 'text-sky-400 border-b-2 border-sky-400 bg-zinc-800/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            📖 中文小说 Agent 分配
            {pools.zh.length > 0 && <span className="ml-1.5 text-[10px] text-zinc-600">({pools.zh.length} 个模型)</span>}
          </button>
          <button onClick={() => setPresetTab('en')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              presetTab === 'en'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-zinc-800/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            📗 English Novel Agent 分配
            {pools.en.length > 0 && <span className="ml-1.5 text-[10px] text-zinc-600">({pools.en.length} models)</span>}
          </button>
        </div>

        <div className="p-4 space-y-2">
          {pools[presetTab].length === 0 ? (
            <div className="py-6 text-center text-zinc-600 text-sm">
              请先在上方添加{presetTab === 'zh' ? '中文' : '英文'}强势 LLM，然后在此分配 Agent 角色
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-500 mb-3">
                为每个 Agent 指定使用哪个 LLM。{presetTab === 'zh' ? '创作型 Agent（写手/修订/润色）推荐选择中文创作能力强的模型，分析型 Agent（审计/建筑师/深度审查）推荐推理能力强的模型。' : 'Creative agents (Writer/Reviser/Polisher) should use the best creative model; analytical agents (Auditor/Architect/ContinuityPlus) can use a cheaper reasoning model.'}
              </p>

              {AGENT_NAMES.map(name => {
                const info = AGENT_LABELS[name]
                const pool = pools[presetTab]
                const selected = getAgentLLM(name)
                return (
                  <div key={name} className="flex items-center gap-3 py-1.5">
                    <span className="text-base w-6 text-center shrink-0">{info.emoji}</span>
                    <div className="flex items-center gap-1.5 w-24 shrink-0">
                      <span className="text-sm text-zinc-200">{info.label}</span>
                      <AgentTooltip text={info.detail} />
                    </div>
                    <span className="text-xs text-zinc-600 w-36 truncate shrink-0 hidden sm:block">{info.desc}</span>
                    <select value={selected} onChange={(e) => setAgentLLM(name, e.target.value)}
                      className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500">
                      {pool.map(entry => (
                        <option key={entry.id} value={entry.id}>
                          {entry.label}{entry.id === presets[presetTab].defaultLLM ? ' (默认)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}

              <div className="pt-2">
                <button onClick={applyRecommend}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  ✨ 一键智能推荐（创作型→{presetTab === 'zh' ? '中文创作' : 'creative'}模型 / 分析型→{presetTab === 'zh' ? '推理' : 'reasoning'}模型）
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ 高级设置 ══ */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <button onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-zinc-800/30 transition-colors">
          {showAdvanced ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
          <span className="text-sm text-zinc-400">高级设置</span>
        </button>
        {showAdvanced && (
          <div className="border-t border-zinc-800 px-4 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <label className="block text-xs text-zinc-500">Temperature</label>
                  <InfoTooltip text={"控制 AI 输出的随机性/创造性。范围 0.0 - 2.0。\n\n• 0.0-0.3 = 严谨准确，适合审计、修订等需要确定性的任务\n• 0.5-0.8 = 均衡创意与连贯性，写小说的甜点值（推荐）\n• 1.0-1.5 = 更多变化和惊喜，但可能偏离主题\n• 1.5-2.0 = 最大发散，容易产生不连贯内容\n\n默认 0.7，对写作两相宜。"} />
                </div>
                <input type="number" step="0.1" min="0" max="2" value={temperature}
                  onChange={(e) => setTemperature(+e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <label className="block text-xs text-zinc-500">Max Tokens</label>
                  <InfoTooltip text={`AI 单次响应的最大 Token 数。Token ≈ 中文 0.5-1 个字。\n\n• 4096 = 约 2000-3000 字，适合短任务（审计、修订）\n• 8192 = 约 4000-6000 字，适合单章写作（推荐）\n• 16384 = 约 8000-12000 字，适合长章加建筑师规划\n• 32768 = 最大，适合复杂分析任务\n\n注意：值越大→API 费用越高 + 响应越慢。\nAI 不一定用满，这是"上限"而非"目标"。\n默认 8192 对单章写作足够。`} />
                </div>
                <input type="number" step="1024" min="1024" value={maxTokens}
                  onChange={(e) => setMaxTokens(+e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ 搜索提供商 ══ */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <button onClick={() => setShowSearchProviders(!showSearchProviders)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-zinc-800/30 transition-colors">
          {showSearchProviders ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
          <Search className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-zinc-400">搜索提供商</span>
          <InfoTooltip text={"配置 Agent Chat 对话中使用的在线搜索提供商。\n建筑师在创作对话中可以主动搜索市场数据、竞品和趋势。\n\n• Tavily: 通用搜索 API，1000 次/月免费\n• DeepSeek Search: 中文搜索最佳，随 API 计费\n• Web Agent: 未来支持浏览器自动化登录搜索"} />
          {searchProviders.length > 0 && (
            <span className="ml-auto text-xs text-zinc-600">{searchProviders.filter(p => p.enabled).length} 个启用</span>
          )}
        </button>
        {showSearchProviders && (
          <div className="border-t border-zinc-800 px-4 py-3 space-y-3">
            {/* 提供商列表 */}
            {searchProviders.map(sp => (
              <div key={sp.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${sp.enabled ? 'border-zinc-700 bg-zinc-800/40' : 'border-zinc-800 bg-zinc-900/40 opacity-60'}`}>
                <span className="text-xs font-medium text-zinc-300 min-w-0 truncate flex-1">{sp.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 shrink-0">{SEARCH_TYPE_LABELS[sp.type] || sp.type}</span>
                {sp.supportedLanguages.includes('zh') && <span className="text-[10px] text-sky-400">中</span>}
                {sp.supportedLanguages.includes('en') && <span className="text-[10px] text-emerald-400">EN</span>}
                <button onClick={() => { setEditingSearchKey(sp.id); setSearchForm({ ...sp }) }}
                  className="p-1 text-zinc-500 hover:text-zinc-300"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => {
                  setSearchProviders(prev => prev.filter(p => p.id !== sp.id))
                  setSearchRouting(prev => ({ zh: prev.zh.filter(id => id !== sp.id), en: prev.en.filter(id => id !== sp.id) }))
                }}
                  className="p-1 text-zinc-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}

            {/* 添加 / 编辑表单 */}
            {editingSearchKey !== null ? (
              <div className="border border-violet-800/40 rounded-lg p-3 space-y-2 bg-zinc-900/60">
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="名称" value={searchForm.label} onChange={e => setSearchForm(f => ({ ...f, label: e.target.value }))}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500" />
                  <select value={searchForm.type} onChange={e => {
                    const t = e.target.value as SearchProviderUI['type']
                    setSearchForm(f => ({ ...f, type: t, apiUrl: SEARCH_TYPE_DEFAULTS[t] || f.apiUrl }))
                  }} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200">
                    <option value="tavily">Tavily API</option>
                    <option value="deepseek-search">DeepSeek Search</option>
                    <option value="web-agent">Web Agent</option>
                  </select>
                </div>
                <input placeholder="API Key" value={searchForm.apiKey} onChange={e => setSearchForm(f => ({ ...f, apiKey: e.target.value }))}
                  type="password" className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500" />
                <input placeholder="API URL" value={searchForm.apiUrl} onChange={e => setSearchForm(f => ({ ...f, apiUrl: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500" />
                {searchForm.type === 'web-agent' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="用户名" value={searchForm.username} onChange={e => setSearchForm(f => ({ ...f, username: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500" />
                    <input placeholder="密码" type="password" value={searchForm.password} onChange={e => setSearchForm(f => ({ ...f, password: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500" />
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <input type="checkbox" checked={searchForm.supportedLanguages.includes('zh')}
                      onChange={e => setSearchForm(f => ({ ...f, supportedLanguages: e.target.checked ? [...f.supportedLanguages.filter(l => l !== 'zh'), 'zh'] : f.supportedLanguages.filter(l => l !== 'zh') }))} />
                    中文
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <input type="checkbox" checked={searchForm.supportedLanguages.includes('en')}
                      onChange={e => setSearchForm(f => ({ ...f, supportedLanguages: e.target.checked ? [...f.supportedLanguages.filter(l => l !== 'en'), 'en'] : f.supportedLanguages.filter(l => l !== 'en') }))} />
                    English
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400 ml-auto">
                    <input type="checkbox" checked={searchForm.enabled}
                      onChange={e => setSearchForm(f => ({ ...f, enabled: e.target.checked }))} />
                    启用
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingSearchKey(null)}
                    className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200">取消</button>
                  <button onClick={() => {
                    if (!searchForm.label.trim()) return
                    const isNew = editingSearchKey === '__new__'
                    const entry = { ...searchForm, id: isNew ? generateId(searchForm.label) : searchForm.id }
                    setSearchProviders(prev => {
                      if (isNew) return [...prev, entry]
                      return prev.map(p => p.id === entry.id ? entry : p)
                    })
                    // 自动加入路由
                    if (isNew && entry.enabled) {
                      setSearchRouting(prev => ({
                        zh: entry.supportedLanguages.includes('zh') ? [...prev.zh, entry.id] : prev.zh,
                        en: entry.supportedLanguages.includes('en') ? [...prev.en, entry.id] : prev.en,
                      }))
                    }
                    setEditingSearchKey(null)
                  }} className="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded">
                    {editingSearchKey === '__new__' ? '添加' : '保存'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => {
                setEditingSearchKey('__new__')
                setSearchForm({ id: '', label: '', type: 'tavily', apiKey: '', apiUrl: 'https://api.tavily.com', username: '', password: '', enabled: true, supportedLanguages: ['zh', 'en'] })
              }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-dashed border-zinc-700 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors">
                <Plus className="w-3 h-3" /> 添加搜索提供商
              </button>
            )}

            {/* 搜索路由 */}
            {searchProviders.length > 0 && (
              <div className="border-t border-zinc-800 pt-3 space-y-2">
                <p className="text-xs text-zinc-500 font-medium">搜索 Fallback 链（按优先级从高到低排列）</p>
                {(['zh', 'en'] as const).map(lang => {
                  const chain = searchRouting[lang]
                  const available = searchProviders.filter(p => p.enabled && p.supportedLanguages.includes(lang))
                  if (available.length === 0) return null
                  return (
                    <div key={lang} className="space-y-1">
                      <p className="text-[10px] text-zinc-500">{lang === 'zh' ? '🇨🇳 中文搜索' : '🇬🇧 英文搜索'}</p>
                      {chain.map((pid, idx) => {
                        const sp = searchProviders.find(p => p.id === pid)
                        if (!sp) return null
                        return (
                          <div key={pid} className="flex items-center gap-1.5 pl-2">
                            <span className="text-[10px] text-zinc-600 w-4">{idx + 1}.</span>
                            <span className="text-xs text-zinc-300 flex-1">{sp.label}</span>
                            <button disabled={idx === 0} onClick={() => setSearchRouting(prev => {
                              const arr = [...prev[lang]]; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
                              return { ...prev, [lang]: arr }
                            })} className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                            <button disabled={idx === chain.length - 1} onClick={() => setSearchRouting(prev => {
                              const arr = [...prev[lang]]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
                              return { ...prev, [lang]: arr }
                            })} className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                            <button onClick={() => setSearchRouting(prev => ({ ...prev, [lang]: prev[lang].filter(id => id !== pid) }))}
                              className="p-0.5 text-zinc-600 hover:text-red-400"><X className="w-3 h-3" /></button>
                          </div>
                        )
                      })}
                      {available.filter(p => !chain.includes(p.id)).length > 0 && (
                        <select value="" onChange={e => {
                          if (!e.target.value) return
                          setSearchRouting(prev => ({ ...prev, [lang]: [...prev[lang], e.target.value] }))
                          e.target.value = ''
                        }} className="ml-6 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-zinc-400">
                          <option value="">+ 添加到链...</option>
                          {available.filter(p => !chain.includes(p.id)).map(p => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ 操作按钮 ══ */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm font-medium transition-colors">
          {saved ? <><Check className="w-4 h-4 text-emerald-400" /> 已保存</> : saving ? '保存中...' : '保存配置'}
        </button>
        <button onClick={handleTest} disabled={testing || !hasAnyPool}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 rounded-lg text-sm font-medium transition-colors">
          {testing ? <><Loader2 className="w-4 h-4 animate-spin" /> 测试中...</> : '测试连接'}
        </button>
        <button onClick={handleInitPipeline} disabled={initializing || !hasAnyPool}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
          {initializing ? <><Loader2 className="w-4 h-4 animate-spin" /> 初始化中...</> : <><Zap className="w-4 h-4" /> 初始化管线</>}
        </button>
      </div>

      {/* 测试结果 */}
      {testResults.length > 0 && (
        <div className="space-y-1.5">
          {testResults.map((r, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 text-sm ${r.ok
              ? 'bg-emerald-950/40 border border-emerald-800/50'
              : 'bg-red-950/40 border border-red-800/50'}`}>
              {r.ok ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-4 h-4 shrink-0" />
                  <span className="truncate">{r.label}{r.latencyMs ? ` (${r.latencyMs}ms)` : ''}</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-red-400">
                  <X className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{r.label} — {r.error}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 路由概览 */}
      {hasAnyPool && (
        <div className="border border-violet-800/30 bg-violet-950/20 rounded-lg p-4 text-xs space-y-2">
          {['zh', 'en'].map(lang => {
            const l = lang as 'zh' | 'en'
            const pool = pools[l]
            if (pool.length === 0) return null
            const preset = presets[l]
            const byId = new Map(pool.map(e => [e.id, e]))
            const isZh = l === 'zh'
            return (
              <div key={l}>
                <p className={`font-medium ${isZh ? 'text-sky-300' : 'text-emerald-300'}`}>
                  {isZh ? '🇨🇳 中文小说路由：' : '🇬🇧 English Novel 路由：'}
                </p>
                {AGENT_NAMES.map(name => {
                  const info = AGENT_LABELS[name]
                  const llmId = preset.agentMap[name] || preset.defaultLLM || pool[0]?.id
                  const entry = byId.get(llmId || '')
                  return (
                    <p key={name} className="text-violet-300/80 pl-4">
                      {info.emoji} {info.label}: <span className="text-violet-400">{entry?.label || '未配置'}</span>
                    </p>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      <div className="border-t border-zinc-800 pt-4">
        <p className="text-zinc-600 text-xs leading-relaxed">
          LLM 按语言分组管理：中文小说自动使用中文强势池，英文小说自动使用英文强势池。<br />
          配置保存到项目的 .env（密钥）和 task-routing.json（路由规则 + 语言池）。<br />
          「初始化管线」会根据当前书籍的语言自动选择正确的 LLM 组合。
        </p>
      </div>
    </div>
  )
}
