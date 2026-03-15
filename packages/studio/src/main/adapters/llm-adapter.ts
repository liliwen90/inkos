import type { LLMClient } from '@actalk/inkos-core'

export interface LLMConfigUI {
  provider: 'openai' | 'anthropic'
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
}

/**
 * LLM 适配器 — 管理 LLM client 创建和连接测试
 */
export class LLMAdapter {
  private client: LLMClient | null = null
  private currentConfig: LLMConfigUI | null = null

  async createClient(config: LLMConfigUI): Promise<LLMClient> {
    const { createLLMClient } = await import('@actalk/inkos-core')
    this.client = createLLMClient({
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey
    })
    this.currentConfig = config
    return this.client
  }

  getClient(): LLMClient | null {
    return this.client
  }

  getConfig(): LLMConfigUI | null {
    return this.currentConfig
  }

  async testConnection(config: LLMConfigUI): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
    try {
      const { createLLMClient, chatCompletion } = await import('@actalk/inkos-core')
      const testClient = createLLMClient({
        provider: config.provider,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey
      })
      const start = Date.now()
      await chatCompletion(testClient, config.model, [
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
  }
}
