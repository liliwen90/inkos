/**
 * Agent Chat Handler — routes user messages to the appropriate agent,
 * manages conversation state, and streams responses back to the renderer.
 */

import type { BrowserWindow } from 'electron'
import type { LLMClient, SearchProviderConfig } from '@actalk/hintos-core'

interface SearchConfig {
  providers: SearchProviderConfig[]
  routing: { zh: string[]; en: string[] }
}

interface AgentChatConfig {
  mainWindow: BrowserWindow
  getClient: () => LLMClient | null
  getModel: () => string | null
  getProjectRoot: () => string | null
  getModelOverride: (agentName: string) => string | undefined
  getSearchConfig: () => SearchConfig | null
  appendLog: (type: 'ACTIVITY' | 'TOKEN' | 'ERROR', msg: string) => void
}

interface ConversationTurn {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/** Lightweight rule-based routing — determines which agent should handle a user message */
function routeMessage(text: string, currentAgent: string | null): string {
  const lower = text.toLowerCase()

  // Explicit @mentions
  if (lower.includes('@建筑师') || lower.includes('@architect')) return 'architect'
  if (lower.includes('@写手') || lower.includes('@writer')) return 'writer'
  if (lower.includes('@审计') || lower.includes('@auditor')) return 'continuity-auditor'
  if (lower.includes('@修订') || lower.includes('@reviser')) return 'reviser'
  if (lower.includes('@润色') || lower.includes('@polisher')) return 'polisher'
  if (lower.includes('@雷达') || lower.includes('@radar')) return 'radar'
  if (lower.includes('@深度') || lower.includes('@continuity-plus')) return 'continuity-plus'
  if (lower.includes('@实体') || lower.includes('@entity')) return 'entity-extractor'

  // Context-based routing — architect is the "大管事" (conductor) by default
  if (/题材|类型|世界观|设定|大纲|想写|genre|world.*build|outline|foundation|小说|创作|构思|灵感|风格/i.test(text)) return 'architect'
  if (/写第.{0,3}章|写下一章|写草稿|继续写|开始写作|draft|write.*chapter/i.test(text) && !currentAgent) return 'writer'
  if (/审计|审查|检查一下|audit|check|continuity/i.test(text) && !currentAgent) return 'continuity-auditor'
  if (/修订|修改|revise|fix/i.test(text) && !currentAgent) return 'reviser'
  if (/润色|polish|refine/i.test(text) && !currentAgent) return 'polisher'
  if (/热榜|trend|市场|radar/i.test(text)) return 'radar'

  // Default: architect as conductor — handles general conversation and dispatches work
  return currentAgent ?? 'architect'
}

// Conversation history per agent
const conversations = new Map<string, ConversationTurn[]>()
const MAX_HISTORY = 30 // max turns per agent

function getHistory(agent: string): ConversationTurn[] {
  if (!conversations.has(agent)) conversations.set(agent, [])
  return conversations.get(agent)!
}

function addTurn(agent: string, turn: ConversationTurn): void {
  const hist = getHistory(agent)
  hist.push(turn)
  // Trim to max history (keep system messages + recent turns)
  while (hist.length > MAX_HISTORY * 2) {
    const idx = hist.findIndex(t => t.role !== 'system')
    if (idx >= 0) hist.splice(idx, 1)
    else break
  }
}

/** Agent system prompts */
const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  architect: `你是HintOS的「建筑师」Agent，也是AI创作团队的「大管事」。
你是用户进入系统后的第一个接待人，负责：
- 了解用户想写什么（题材、语言、平台、目标读者）
- 给出专业建议和市场分析
- 帮助细化创意、确定世界观和大纲
- 在创作方向明确后，告诉用户可以@其他Agent执行具体任务（如@写手写章节、@雷达查市场）
你精通各种小说题材（玄幻、仙侠、都市、科幻、LitRPG、Progression Fantasy等）。
用简洁专业的口吻回答，每次回复不超过300字。`,

  writer: `你是HintOS的「写手」Agent。你负责章节创作。
与用户对话时：
- 讨论剧情走向、人物发展
- 回答关于已写章节的问题
- 提供写作建议
保持对话简洁，每次回复不超过300字。`,

  'continuity-auditor': `你是HintOS的「审计官」Agent。你负责连续性审查和质量把关。
与用户对话时：
- 解释审计发现的问题
- 讨论修改方案
- 提供改进建议
保持对话简洁，每次回复不超过300字。`,

  reviser: `你是HintOS的「修订师」Agent。你负责根据审计结果修订章节。
保持对话简洁，每次回复不超过300字。`,

  polisher: `你是HintOS的「润色师」Agent。你负责文学品质提升。
保持对话简洁，每次回复不超过300字。`,

  radar: `你是HintOS的「雷达」Agent。你负责市场趋势分析、热榜监测和在线搜索。
当用户询问市场趋势、竞品分析、题材热度等问题时，你可能会收到搜索引擎的实时结果。
请基于搜索结果给出有数据支撑的分析和建议。如果没有搜索结果，则基于你的知识回答。
保持对话简洁，每次回复不超过500字。`,

  'continuity-plus': `你是HintOS的「深度检查员」Agent。你负责七维度深度连续性审查（时间线、空间、性格、伏笔、功法、阵营、核心逻辑）。
与用户对话时：
- 解释深度审查发现的问题
- 讨论修改优先级
- 提供具体修复建议
保持对话简洁，每次回复不超过300字。`,

  'entity-extractor': `你是HintOS的「实体提取师」Agent。你负责从章节中提取人物、地点、道具、势力等实体并维护实体库。
与用户对话时：
- 解释实体提取结果
- 讨论实体关系
- 回答关于实体库的问题
保持对话简洁，每次回复不超过300字。`,
}

let _config: AgentChatConfig | null = null
let _currentAgent: string | null = null

export function initAgentChatHandler(config: AgentChatConfig): void {
  _config = config
}

/** Detect language from text — simple heuristic */
function detectLanguage(text: string): 'zh' | 'en' {
  const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)
  return (cjk && cjk.length > text.length * 0.15) ? 'zh' : 'en'
}

/** Strip @mentions, slashes, and emoji prefixes to extract search query */
function extractSearchQuery(text: string): string {
  return text
    .replace(/@[\u4e00-\u9fff\w-]+/g, '')
    .replace(/^\/\u641c\u7d22\s*/i, '')
    .replace(/^\ud83d\udd0d\s*/, '')
    .trim()
}

/** Perform a search using the configured SearchRouter, return formatted context string */
async function performSearch(text: string): Promise<string> {
  if (!_config) return ''
  const searchConfig = _config.getSearchConfig()
  if (!searchConfig || searchConfig.providers.length === 0) return ''

  try {
    const { SearchRouter } = await import('@actalk/hintos-core')
    const router = new SearchRouter({
      providers: searchConfig.providers,
      zh: searchConfig.routing.zh,
      en: searchConfig.routing.en,
    })

    const lang = detectLanguage(text)
    if (!router.hasProviders(lang)) return ''

    const query = extractSearchQuery(text)
    if (!query) return ''

    _config.appendLog('ACTIVITY', `Search: querying "${query}" (${lang})`)

    // Emit searching indicator to frontend
    _config.mainWindow.webContents.send('agent-chat-message', {
      type: 'system-info',
      content: `🔍 正在搜索: ${query}`,
    })

    const results = await router.search(query, lang, 5)
    if (results.length === 0) {
      _config.appendLog('ACTIVITY', 'Search: no results found')
      return ''
    }

    _config.appendLog('ACTIVITY', `Search: found ${results.length} results`)

    // Send search results as a data-card to chat
    _config.mainWindow.webContents.send('agent-chat-message', {
      type: 'search-result',
      agentName: 'radar',
      content: `🔍 找到 ${results.length} 条搜索结果`,
      richData: results,
    })

    // Format for LLM context injection
    return results.map((r, i) =>
      `[${i + 1}] ${r.title}\n来源: ${r.source}\n${r.snippet}`
    ).join('\n\n')
  } catch (err) {
    _config.appendLog('ERROR', `Search failed: ${(err as Error).message}`)
    return ''
  }
}

/**
 * Handle a user message from the chat panel.
 * Routes to the correct agent, streams response back via IPC.
 */
export async function handleUserChatMessage(
  text: string,
  messageId: string,
): Promise<void> {
  if (!_config) throw new Error('Agent chat handler not initialized')

  const client = _config.getClient()
  const model = _config.getModel()
  if (!client || !model) {
    _config.mainWindow.webContents.send('agent-chat-message', {
      type: 'system-info',
      content: '⚠️ 请先配置LLM连接（设置 → LLM配置）',
    })
    return
  }

  // Route to agent
  const targetAgent = routeMessage(text, _currentAgent)
  _currentAgent = targetAgent
  const agentModel = _config.getModelOverride(targetAgent) ?? model

  // === Search augmentation ===
  // Trigger search when: routed to radar, or explicit 🔍 prefix, or /搜索 command
  const needsSearch = targetAgent === 'radar'
    || text.startsWith('🔍')
    || text.startsWith('/搜索')
    || /搜索|search|查一下|帮我查/i.test(text)
  let searchContext = ''
  if (needsSearch) {
    searchContext = await performSearch(text)
  }

  // Build conversation
  const systemPrompt = AGENT_SYSTEM_PROMPTS[targetAgent] ?? AGENT_SYSTEM_PROMPTS.architect
  const history = getHistory(targetAgent)

  // Ensure system prompt is at the start
  if (history.length === 0 || history[0].role !== 'system') {
    history.unshift({ role: 'system', content: systemPrompt })
  }

  // Add user message (with search context injected if available)
  const userContent = searchContext
    ? `${text}\n\n<search_results>\n${searchContext}\n</search_results>`
    : text
  addTurn(targetAgent, { role: 'user', content: userContent })

  // Build messages for LLM
  const messages = history.map(t => ({ role: t.role as 'user' | 'assistant' | 'system', content: t.content }))

  // Stream response
  const responseId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  try {
    const { chatCompletionStreaming } = await import('@actalk/hintos-core')

    _config.appendLog('ACTIVITY', `Agent chat: ${targetAgent} processing user message`)

    // Notify which agent is responding
    _config.mainWindow.webContents.send('agent-chat-message', {
      type: 'system-info',
      content: `🎯 ${targetAgent} 正在思考...`,
      agentName: targetAgent,
    })

    const response = await chatCompletionStreaming(
      client,
      agentModel,
      messages,
      (chunk: string) => {
        _config!.mainWindow.webContents.send('agent-chat-stream', {
          agentName: targetAgent,
          chunkText: chunk,
          messageId: responseId,
          isComplete: false,
        })
      },
      { temperature: 0.7, maxTokens: 2048 },
    )

    // Complete the stream
    _config.mainWindow.webContents.send('agent-chat-stream', {
      agentName: targetAgent,
      chunkText: '',
      messageId: responseId,
      isComplete: true,
    })

    // Save to conversation history
    addTurn(targetAgent, { role: 'assistant', content: response.content })

    _config.appendLog('ACTIVITY', `Agent chat: ${targetAgent} responded (${response.content.length} chars)`)
  } catch (err) {
    _config.mainWindow.webContents.send('agent-chat-message', {
      type: 'system-info',
      content: `❌ ${targetAgent} 响应失败: ${(err as Error).message}`,
    })
    _config.appendLog('ERROR', `Agent chat error: ${(err as Error).message}`)
  }
}

/** Clear conversation history for an agent or all agents */
export function clearAgentHistory(agentName?: string): void {
  if (agentName) {
    conversations.delete(agentName)
  } else {
    conversations.clear()
  }
  _currentAgent = null
}
