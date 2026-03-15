import { useEffect, useState } from 'react'
import { Settings, Check, X, Loader2, Zap } from 'lucide-react'
import { useAppStore, type LLMConfig } from '../stores/app-store'

export default function LLMSettings(): JSX.Element {
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const setPipelineReady = useAppStore((s) => s.setPipelineReady)
  const setLLMConfig = useAppStore((s) => s.setLLMConfig)

  const [provider, setProvider] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(8192)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; latencyMs?: number } | null>(null)
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

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setSaved(false)
    try {
      await window.inkos.saveLLMConfig(getConfig())
      setLLMConfig(getConfig())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.inkos.testLLMConnection(getConfig())
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }

  const handleInitPipeline = async (): Promise<void> => {
    setInitializing(true)
    try {
      await window.inkos.saveLLMConfig(getConfig())
      await window.inkos.initPipeline(getConfig())
      setPipelineReady(true)
      setLLMConfig(getConfig())
    } catch (err) {
      setTestResult({ ok: false, error: (err as Error).message })
    } finally {
      setInitializing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">LLM 配置</h1>
        <p className="text-zinc-500 text-sm mt-1">管理 AI 模型连接，配置后需「初始化管线」才能写作</p>
      </div>

      <div className="max-w-xl space-y-4">
        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
            <option value="openai">OpenAI 兼容 (OpenAI/DeepSeek/中继)</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">API Base URL</label>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">API Key</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">模型</label>
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o / claude-sonnet-4 / deepseek-chat"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm text-zinc-300">Temperature</label>
            <input type="number" step="0.1" min="0" max="2" value={temperature}
              onChange={(e) => setTemperature(+e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-zinc-300">Max Tokens</label>
            <input type="number" step="1024" min="1024" value={maxTokens}
              onChange={(e) => setMaxTokens(+e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500" />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-2">
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
        {testResult && (
          <div className={`rounded-lg p-3 text-sm ${testResult.ok
            ? 'bg-emerald-950/40 border border-emerald-800/50'
            : 'bg-red-950/40 border border-red-800/50'}`}>
            {testResult.ok ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <Check className="w-4 h-4" />
                <span>连接成功{testResult.latencyMs ? ` (${testResult.latencyMs}ms)` : ''}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-red-400">
                <X className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{testResult.error}</span>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-zinc-800 pt-4 mt-4">
          <p className="text-zinc-600 text-xs leading-relaxed">
            配置保存到项目的 .env 文件（API Key）和 inkos.json（其他参数）。<br/>
            「初始化管线」会创建 LLM 客户端和 PipelineRunner，启用写作/审计/修订功能。
          </p>
        </div>
      </div>
    </div>
  )
}
