import { useEffect, useState } from 'react'
import { Settings, Check, X, Loader2, Zap, Route, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore, type LLMConfig } from '../stores/app-store'

interface AgentSlot {
  model: string
  apiKey: string
  baseUrl: string
  provider: string
  enabled: boolean
}

const AGENT_LABELS: Record<string, { label: string; desc: string; emoji: string; recommend: string; modelHint: string }> = {
  architect: { label: '建筑师', desc: '规划大纲和世界观', emoji: '🏗️', recommend: '推荐 DeepSeek — 规划能力足够，便宜', modelHint: 'deepseek-chat' },
  writer: { label: '写手', desc: '生成章节正文（最耗 token）', emoji: '✍️', recommend: '推荐 DeepSeek 写中文 / Claude 写英文', modelHint: 'deepseek-chat' },
  auditor: { label: '审计员', desc: '26 维度质量审查', emoji: '🔍', recommend: '推荐 Gemini Flash — 分析型任务强项，超便宜', modelHint: 'gemini-2.5-flash' },
  reviser: { label: '修订者', desc: '修复审计发现的问题', emoji: '✏️', recommend: '推荐 Claude Sonnet — 文学润色最强', modelHint: 'claude-sonnet-4-20250514' },
  'continuity-plus': { label: '深度审查', desc: '7维度叙事连续性审计', emoji: '🔬', recommend: '推荐 Gemini Flash — 分析逻辑型任务', modelHint: 'gemini-2.5-flash' },
  polisher: { label: '润色师', desc: '文学级散文润色（反AI）', emoji: '💎', recommend: '推荐 Claude Sonnet — 散文质感最佳', modelHint: 'claude-sonnet-4-20250514' }
}

const AGENT_NAMES = ['architect', 'writer', 'auditor', 'reviser', 'continuity-plus', 'polisher'] as const

const DEFAULT_SLOT: AgentSlot = { model: '', apiKey: '', baseUrl: '', provider: 'openai', enabled: false }

export default function LLMSettings(): JSX.Element {
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const setPipelineReady = useAppStore((s) => s.setPipelineReady)
  const setLLMConfig = useAppStore((s) => s.setLLMConfig)

  // 默认配置
  const [provider, setProvider] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(8192)

  // 任务路由
  const [routingEnabled, setRoutingEnabled] = useState(false)
  const [agentSlots, setAgentSlots] = useState<Record<string, AgentSlot>>({
    architect: { ...DEFAULT_SLOT },
    writer: { ...DEFAULT_SLOT },
    auditor: { ...DEFAULT_SLOT },
    reviser: { ...DEFAULT_SLOT },
    'continuity-plus': { ...DEFAULT_SLOT },
    polisher: { ...DEFAULT_SLOT }
  })
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  // UI 状态
  const [testResults, setTestResults] = useState<{ label: string; ok: boolean; error?: string; latencyMs?: number }[]>([])
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initializing, setInitializing] = useState(false)

  useEffect(() => {
    if (projectLoaded) {
      window.inkos.loadLLMConfig().then((config: LLMConfig | null) => {
        if (config) {
          setProvider(config.provider)
          setBaseUrl(config.baseUrl)
          setApiKey(config.apiKey)
          setModel(config.model)
          setTemperature(config.temperature)
          setMaxTokens(config.maxTokens)
        }
      })
      window.inkos.loadTaskRouting().then((routing: unknown) => {
        if (routing && typeof routing === 'object') {
          const r = routing as { agents?: Record<string, AgentSlot> }
          if (r.agents && Object.keys(r.agents).length > 0) {
            setRoutingEnabled(true)
            const newSlots: Record<string, AgentSlot> = {
              architect: { ...DEFAULT_SLOT },
              writer: { ...DEFAULT_SLOT },
              auditor: { ...DEFAULT_SLOT },
              reviser: { ...DEFAULT_SLOT }
            }
            for (const [name, slot] of Object.entries(r.agents)) {
              if (slot && newSlots[name]) {
                newSlots[name] = { ...slot, enabled: true }
              }
            }
            setAgentSlots(newSlots)
          }
        }
      })
    }
  }, [projectLoaded])

  if (!projectLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <Settings className="w-8 h-8 mb-2" />
        <p>请先打开 InkOS 项目</p>
      </div>
    )
  }

  const getConfig = (): LLMConfig => ({
    provider, baseUrl, apiKey, model, temperature, maxTokens
  })

  const updateSlot = (agent: string, field: string, value: string | boolean): void => {
    setAgentSlots((prev) => ({
      ...prev,
      [agent]: { ...prev[agent], [field]: value }
    }))
  }

  const buildRoutingPayload = (): { default: LLMConfig; agents: Record<string, unknown> } => {
    const agents: Record<string, unknown> = {}
    for (const name of AGENT_NAMES) {
      const slot = agentSlots[name]
      if (slot.enabled && slot.model.trim()) {
        agents[name] = {
          model: slot.model.trim(),
          apiKey: slot.apiKey || apiKey,
          baseUrl: slot.baseUrl || baseUrl,
          provider: slot.provider || provider
        }
      }
    }
    return { default: getConfig(), agents }
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setSaved(false)
    try {
      await window.inkos.saveLLMConfig(getConfig())
      setLLMConfig(getConfig())
      if (routingEnabled) {
        await window.inkos.saveTaskRouting(buildRoutingPayload())
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setTestResults([])
    try {
      const results: { label: string; ok: boolean; error?: string; latencyMs?: number }[] = []
      // 测试默认连接
      const defaultResult = await window.inkos.testLLMConnection(getConfig())
      results.push({ label: `默认 (${model})`, ...defaultResult })
      // 测试已启用的 Agent 独立连接
      if (routingEnabled) {
        for (const name of AGENT_NAMES) {
          const slot = agentSlots[name]
          if (slot.enabled && slot.model) {
            const agentConfig = {
              provider: slot.provider || provider,
              baseUrl: slot.baseUrl || baseUrl,
              apiKey: slot.apiKey || apiKey,
              model: slot.model,
              temperature,
              maxTokens
            }
            const r = await window.inkos.testLLMConnection(agentConfig)
            results.push({ label: `${AGENT_LABELS[name].emoji} ${AGENT_LABELS[name].label} (${slot.model})`, ...r })
          }
        }
      }
      setTestResults(results)
    } finally {
      setTesting(false)
    }
  }

  const handleInitPipeline = async (): Promise<void> => {
    setInitializing(true)
    try {
      await window.inkos.saveLLMConfig(getConfig())
      setLLMConfig(getConfig())

      const hasRouting = routingEnabled && AGENT_NAMES.some((n) => agentSlots[n].enabled && agentSlots[n].model)
      if (hasRouting) {
        const routing = buildRoutingPayload()
        await window.inkos.saveTaskRouting(routing)
        await window.inkos.initPipelineRouting(routing)
      } else {
        await window.inkos.initPipeline(getConfig())
      }
      setPipelineReady(true)
      const routedAgents = hasRouting
        ? AGENT_NAMES.filter((n) => agentSlots[n].enabled && agentSlots[n].model.trim())
            .map((n) => `${AGENT_LABELS[n].emoji}${AGENT_LABELS[n].label}→${agentSlots[n].model}`)
            .join('  ')
        : ''
      setTestResults([{
        label: '管线初始化成功' + (routedAgents ? ` | 路由: ${routedAgents}` : ''),
        ok: true
      }])
    } catch (err) {
      setTestResults([{ label: '初始化管线', ok: false, error: (err as Error).message }])
    } finally {
      setInitializing(false)
    }
  }

  const enabledCount = AGENT_NAMES.filter((n) => agentSlots[n].enabled).length

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">LLM 配置</h1>
        <p className="text-zinc-500 text-sm mt-1">配置 AI 模型连接，支持多模型任务路由</p>
      </div>

      {/* ── 默认模型 ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">默认模型（所有 Agent 的兜底配置）</h2>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-400">Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
            <option value="openai">OpenAI 兼容 (OpenAI/DeepSeek/中继)</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-400">API Base URL</label>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-400">API Key</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-400">模型</label>
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o / claude-sonnet-4 / deepseek-chat"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm text-zinc-400">Temperature</label>
            <input type="number" step="0.1" min="0" max="2" value={temperature}
              onChange={(e) => setTemperature(+e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-zinc-400">Max Tokens</label>
            <input type="number" step="1024" min="1024" value={maxTokens}
              onChange={(e) => setMaxTokens(+e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500" />
          </div>
        </div>
      </div>

      {/* ── 任务路由 ── */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <button onClick={() => setRoutingEnabled(!routingEnabled)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/30 transition-colors">
          <Route className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-zinc-200 flex-1">
            任务路由（多模型协作）
          </span>
          {routingEnabled && enabledCount > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-violet-600/20 text-violet-300 border border-violet-600/30">
              {enabledCount} 个 Agent 已配置
            </span>
          )}
          <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={routingEnabled} onChange={(e) => setRoutingEnabled(e.target.checked)}
              className="sr-only peer" />
            <div className="w-9 h-5 bg-zinc-700 peer-checked:bg-violet-600 rounded-full
              peer-focus:ring-2 peer-focus:ring-violet-500/20 after:content-['']
              after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full
              after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </button>

        {routingEnabled && (
          <div className="border-t border-zinc-800 p-4 space-y-2">
            <p className="text-xs text-zinc-500 mb-3">
              为不同的 AI Agent 分配不同的模型。未配置的 Agent 使用上方的默认模型。留空 API Key / URL 表示继承默认配置。
            </p>

            {AGENT_NAMES.map((name) => {
              const slot = agentSlots[name]
              const info = AGENT_LABELS[name]
              const isExpanded = expandedAgent === name

              return (
                <div key={name} className={`border rounded-lg overflow-hidden transition-colors ${
                  slot.enabled ? 'border-violet-600/30 bg-violet-950/10' : 'border-zinc-800'
                }`}>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base">{info.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-zinc-200">{info.label}</span>
                      <span className="text-xs text-zinc-500 ml-2">{info.desc}</span>
                      {!slot.enabled && (
                        <div className="text-[10px] text-zinc-600 mt-0.5">💡 {info.recommend}</div>
                      )}
                    </div>

                    {slot.enabled && slot.model && (
                      <span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded truncate max-w-[140px]">
                        {slot.model}
                      </span>
                    )}

                    <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={slot.enabled}
                        onChange={(e) => {
                          updateSlot(name, 'enabled', e.target.checked)
                          if (e.target.checked) setExpandedAgent(name)
                        }}
                        className="sr-only peer" />
                      <div className="w-8 h-4 bg-zinc-700 peer-checked:bg-violet-600 rounded-full
                        after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                        after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all
                        peer-checked:after:translate-x-4" />
                    </label>

                    {slot.enabled && (
                      <button onClick={() => setExpandedAgent(isExpanded ? null : name)}
                        className="text-zinc-500 hover:text-zinc-300">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  {slot.enabled && isExpanded && (
                    <div className="border-t border-zinc-800/50 px-4 py-3 space-y-3 bg-zinc-900/50">
                      <div className="text-[10px] text-violet-400/70 mb-1">💡 {info.recommend}</div>
                      <div className="space-y-1">
                        <label className="block text-xs text-zinc-500">Provider</label>
                        <select value={slot.provider || 'openai'}
                          onChange={(e) => updateSlot(name, 'provider', e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500">
                          <option value="openai">OpenAI 兼容 (OpenAI/DeepSeek/中转)</option>
                          <option value="anthropic">Anthropic</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs text-zinc-500">模型名称 *（必须填 API 精确名称）</label>
                        <input type="text" value={slot.model}
                          onChange={(e) => updateSlot(name, 'model', e.target.value)}
                          placeholder={info.modelHint}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs text-zinc-500">API Key（留空继承默认）</label>
                        <input type="password" value={slot.apiKey}
                          onChange={(e) => updateSlot(name, 'apiKey', e.target.value)}
                          placeholder="继承默认 Key"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs text-zinc-500">API Base URL（留空继承默认）</label>
                        <input type="text" value={slot.baseUrl}
                          onChange={(e) => updateSlot(name, 'baseUrl', e.target.value)}
                          placeholder={baseUrl}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            <div className="pt-2">
              <button onClick={() => {
                setAgentSlots({
                  architect: { model: 'deepseek-chat', apiKey: '', baseUrl: '', provider: 'openai', enabled: true },
                  writer: { model: 'deepseek-chat', apiKey: '', baseUrl: '', provider: 'openai', enabled: false },
                  auditor: { model: 'gemini-2.5-flash', apiKey: '', baseUrl: '', provider: 'openai', enabled: true },
                  reviser: { model: 'claude-sonnet-4-20250514', apiKey: '', baseUrl: '', provider: 'openai', enabled: true }
                })
              }}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                ✨ 一键填入推荐配置（建筑师: DeepSeek / 审计: Gemini Flash / 修订: Claude Sonnet）
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 操作按钮 ── */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm font-medium transition-colors">
          {saved ? <><Check className="w-4 h-4 text-emerald-400" /> 已保存</> : saving ? '保存中...' : '保存配置'}
        </button>
        <button onClick={handleTest} disabled={testing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm font-medium transition-colors">
          {testing ? <><Loader2 className="w-4 h-4 animate-spin" /> 测试中...</> : '测试连接'}
        </button>
        <button onClick={handleInitPipeline} disabled={initializing || !apiKey}
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
                  <span className="truncate">{r.label} — 连接成功{r.latencyMs ? ` (${r.latencyMs}ms)` : ''}</span>
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
      {routingEnabled && enabledCount > 0 && (
        <div className="border border-violet-800/30 bg-violet-950/20 rounded-lg p-4 text-xs text-violet-300/80 space-y-1">
          <p className="font-medium text-violet-300">当前路由配置：</p>
          {AGENT_NAMES.map((name) => {
            const slot = agentSlots[name]
            const info = AGENT_LABELS[name]
            return (
              <p key={name}>
                {info.emoji} {info.label}:{' '}
                {slot.enabled && slot.model ? (
                  <span className="text-violet-400">{slot.model}</span>
                ) : (
                  <span className="text-zinc-500">使用默认 ({model})</span>
                )}
              </p>
            )
          })}
        </div>
      )}

      <div className="border-t border-zinc-800 pt-4">
        <p className="text-zinc-600 text-xs leading-relaxed">
          配置保存到项目的 .env（密钥）和 task-routing.json（路由规则）。<br />
          「初始化管线」会创建 LLM 客户端并启动写作功能。多模型路由完全在 Adapter 层实现，不修改 InkOS Core。<br />
          上游升级时路由功能不受影响。
        </p>
      </div>
    </div>
  )
}
