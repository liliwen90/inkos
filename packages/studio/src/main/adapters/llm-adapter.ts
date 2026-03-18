import type { LLMClient } from '@actalk/hintos-core'

export interface LLMConfigUI {
  provider: 'openai' | 'anthropic' | 'custom'
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
}

/** 每个 Agent 角色的 LLM 配置 */
export interface AgentLLMSlot {
  model: string
  apiKey: string
  baseUrl: string
  provider: 'openai' | 'anthropic' | 'custom'
}

/** 完整的多模型路由配置 */
export interface TaskRoutingConfig {
  /** 默认配置（用于未指定的 Agent） */
  default: LLMConfigUI
  /** 按 Agent 名称的覆盖配置 */
  agents?: {
    architect?: AgentLLMSlot | null
    writer?: AgentLLMSlot | null
    auditor?: AgentLLMSlot | null
    reviser?: AgentLLMSlot | null
    'continuity-plus'?: AgentLLMSlot | null
    polisher?: AgentLLMSlot | null
    radar?: AgentLLMSlot | null
  }
}

/**
 * LLM 适配器 — 管理 LLM client 创建、连接测试、多模型路由
 *
 * 升级安全说明：
 * - 不修改 Core 一行代码
 * - 利用 Core 内置的 PipelineConfig.modelOverrides 按 agent 名路由模型名
 * - 通过创建 Proxy LLMClient 按 model 名分发到不同的真实 SDK 实例
 * - 如果上游取消 modelOverrides，降级为全部使用 default 配置，功能不丢失
 */
export class LLMAdapter {
  private client: LLMClient | null = null
  private currentConfig: LLMConfigUI | null = null
  private routingConfig: TaskRoutingConfig | null = null

  /** 按 model 名缓存的真实 LLM client */
  private clientPool: Map<string, LLMClient> = new Map()

  async createClient(config: LLMConfigUI): Promise<LLMClient> {
    const { createLLMClient } = await import('@actalk/hintos-core')
    this.client = createLLMClient({
      provider: config.provider === 'custom' ? 'openai' : config.provider,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 8192
    })
    this.currentConfig = config
    return this.client
  }

  /**
   * 创建支持多模型路由的 Proxy LLMClient
   *
   * 原理: Core 的 chatCompletion(client, model, ...) 内部读 client._openai 做 API 调用。
   * 我们返回一个 Proxy client, 其 _openai 属性是一个 Proxy OpenAI 实例,
   * 当 Core 调 openai.chat.completions.create({ model, ... }) 时,
   * Proxy 从 params.model 判断该用哪个真实 client 的 SDK, 然后转发调用。
   */
  async createRoutingClient(routing: TaskRoutingConfig): Promise<{
    client: LLMClient
    modelOverrides: Record<string, string>
  }> {
    const { createLLMClient } = await import('@actalk/hintos-core')

    this.routingConfig = routing
    this.clientPool.clear()

    // 创建默认 client
    const defaultClient = createLLMClient({
      provider: routing.default.provider === 'custom' ? 'openai' : routing.default.provider,
      baseUrl: routing.default.baseUrl,
      apiKey: routing.default.apiKey,
      model: routing.default.model,
      temperature: routing.default.temperature ?? 0.7,
      maxTokens: routing.default.maxTokens ?? 8192
    })
    this.clientPool.set(routing.default.model, defaultClient)
    this.client = defaultClient
    this.currentConfig = routing.default

    // 为每个有独立配置的 Agent 创建专用 client
    const modelOverrides: Record<string, string> = {}
    if (routing.agents) {
      for (const [agentName, slot] of Object.entries(routing.agents)) {
        if (!slot) continue
        modelOverrides[agentName] = slot.model
        if (!this.clientPool.has(slot.model)) {
          const agentClient = createLLMClient({
            provider: slot.provider === 'custom' ? 'openai' : slot.provider,
            baseUrl: slot.baseUrl,
            apiKey: slot.apiKey,
            model: slot.model,
            temperature: routing.default.temperature ?? 0.7,
            maxTokens: routing.default.maxTokens ?? 8192
          })
          this.clientPool.set(slot.model, agentClient)
        }
      }
    }

    // --- 构建 Proxy LLMClient ---
    // Core 的 chatCompletion 最终调 client._openai.chat.completions.create({ model, ... })
    // 我们拦截 create 调用, 根据 params.model 路由到正确的真实 OpenAI SDK 实例
    const pool = this.clientPool

    // Proxy chain: proxyClient._openai.chat.completions.create({ model }) → 真实 client 的 SDK
    const proxyCompletions = new Proxy(defaultClient._openai!.chat.completions, {
      get(target, prop, receiver) {
        if (prop === 'create') {
          return function proxyCreate(params: Record<string, unknown>, ...rest: unknown[]) {
            const requestModel = params?.model as string
            const realClient = requestModel ? pool.get(requestModel) : undefined
            const realTarget = realClient?._openai?.chat?.completions ?? target
            return realTarget.create(params as never, ...rest as [never])
          }
        }
        return Reflect.get(target, prop, receiver)
      }
    })

    const proxyChat = new Proxy(defaultClient._openai!.chat, {
      get(target, prop, receiver) {
        if (prop === 'completions') return proxyCompletions
        return Reflect.get(target, prop, receiver)
      }
    })

    const proxyOpenAI = new Proxy(defaultClient._openai!, {
      get(target, prop, receiver) {
        if (prop === 'chat') return proxyChat
        return Reflect.get(target, prop, receiver)
      }
    })

    // 最终 Proxy client: 替换 _openai 为路由代理, 其他属性保持默认
    const proxyClient = new Proxy(defaultClient, {
      get(target, prop, receiver) {
        if (prop === '_openai') return proxyOpenAI
        return Reflect.get(target, prop, receiver)
      }
    }) as LLMClient

    return { client: proxyClient, modelOverrides }
  }

  getClient(): LLMClient | null {
    return this.client
  }

  getConfig(): LLMConfigUI | null {
    return this.currentConfig
  }

  getRoutingConfig(): TaskRoutingConfig | null {
    return this.routingConfig
  }

  async testConnection(config: LLMConfigUI): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
    try {
      const { createLLMClient, chatCompletion } = await import('@actalk/hintos-core')
      const testClient = createLLMClient({
        provider: config.provider === 'custom' ? 'openai' : config.provider,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? 8192
      })
      const start = Date.now()
      // 使用原始函数测试，避免路由干扰
      const { chatCompletion: origChat } = await import('@actalk/hintos-core')
      await origChat(testClient, config.model, [
        { role: 'user', content: '回复OK' }
      ], { maxTokens: 10 })
      return { ok: true, latencyMs: Date.now() - start }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  destroy(): void {
    this.client = null
    this.currentConfig = null
    this.routingConfig = null
    this.clientPool.clear()
  }
}
