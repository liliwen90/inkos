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

  // ── 1. Explicit @mentions — highest priority ──
  if (lower.includes('@建筑师') || lower.includes('@architect'))       return 'architect'
  if (lower.includes('@写手') || lower.includes('@writer'))             return 'writer'
  if (lower.includes('@审计') || lower.includes('@auditor'))            return 'continuity-auditor'
  if (lower.includes('@修订') || lower.includes('@reviser'))            return 'reviser'
  if (lower.includes('@润色') || lower.includes('@polisher'))           return 'polisher'
  if (lower.includes('@雷达') || lower.includes('@radar'))              return 'radar'
  if (lower.includes('@深度') || lower.includes('@continuity-plus'))    return 'continuity-plus'
  if (lower.includes('@实体') || lower.includes('@entity'))             return 'entity-extractor'

  // ── 2. Slash commands — map to specific agents ──
  if (/^\/写下一章|^\/写/.test(text))    return 'writer'
  if (/^\/审计/.test(text))               return 'continuity-auditor'
  if (/^\/润色/.test(text))               return 'polisher'
  if (/^\/热榜/.test(text))               return 'radar'

  // ── 3. Context-based routing — keyword matching ──

  // 建筑师 (Architect / Conductor)：创意构思、世界观、大纲、题材、设定
  if (/题材|类型|世界观|设定|大纲|纲要|想写|开新书|新项目|起点|故事|背景|主角|配角|人设|能力体系|金手指|开局|升级路线|genre|world.*build|outline|foundation|小说|创作|构思|灵感|风格|目标读者|平台|受众|定位|卖点|节奏|结构|篇幅|字数规划|完结|开坑|立项/i.test(text)) return 'architect'

  // 雷达 (Radar)：市场、趋势、热榜、搜索、竞品
  if (/热榜|trend|市场|radar|排行|榜单|热度|流行|竞品|竞争|数据|分析一下市场|搜索|search|查一下|帮我查|什么.*火|哪些.*热|趋势|爆款|畅销|点击|收藏|月票|推荐票/i.test(text)) return 'radar'

  // 写手 (Writer)：明确的写作执行指令
  if (/写第.{0,4}章|写下一章|写草稿|继续写|开始写作|开始创作|动笔|下笔|draft|write.*chapter|续写|接着写|写开头|写结尾|写高潮|写打斗|写对话|写场景/i.test(text)) return 'writer'

  // 审计官 (Continuity Auditor)：连续性、一致性、bug 检查
  if (/审计|审查|检查一下|检查.*连续|检查.*一致|有没有.*矛盾|有没有.*bug|前后.*矛盾|逻辑.*问题|audit|check|continuity|不一致|对不上|漏洞|穿帮/i.test(text)) return 'continuity-auditor'

  // 深度检查员 (Continuity Plus)：七维度深度审查
  if (/深度.*检查|深度.*审查|七维|时间线.*检查|伏笔.*检查|性格.*一致|阵营.*变化|功法.*矛盾|全面.*审查|深审|thoroughcheck|deep.*audit/i.test(text)) return 'continuity-plus'

  // 修订师 (Reviser)：修改、修订、修复
  if (/修订|修改.*章|修复|改一下|改.*问题|按.*意见.*改|revise|fix|rewrite|重写|改写|调整.*章|优化.*剧情/i.test(text)) return 'reviser'

  // 润色师 (Polisher)：文学品质提升
  if (/润色|打磨|文笔|文学性|语言.*优化|polish|refine|更.*优美|更.*生动|修辞|比喻|描写|细腻|质感|文采|提升.*品质|提升.*文笔/i.test(text)) return 'polisher'

  // 实体提取师 (Entity Extractor)：人物关系、实体库
  if (/实体|人物关系|角色.*关系|人物.*库|角色.*列表|势力.*关系|地图|道具.*列表|entity|character.*list|关系图|谱系|族谱|帮派|门派|宗门/i.test(text)) return 'entity-extractor'

  // ── 4. Default: stay with current agent, or architect as conductor ──
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

/** Agent system prompts — each agent has clear role, capabilities, and boundaries */
const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  architect: `你是HintOS的「建筑师」🏗️，也是AI创作团队的「大管事」。
你是用户进入系统后的第一个接待人。你的核心职责：

【接待与需求理解】
- 友好问候用户，主动了解创作意图（题材偏好、目标平台、语言、受众、篇幅）
- 初次交流时不要一次问太多，循序渐进引导

【创意规划（你的核心工作）】
- 题材分析：根据用户偏好给出专业建议（热度、竞争、差异化卖点）
- 世界观设计：能力体系、地理设定、势力格局、历史背景
- 大纲规划：主线、支线、高潮分布、伏笔布局、篇幅节奏
- 人设设计：主角成长路线、配角功能、反派层次
- 这些全是你的工作，不要推给其他Agent

【何时引导用户找其他Agent】
- 大纲确定后 → 引导"可以@写手开始写第一章了"
- 想了解市场数据 → 引导"可以@雷达帮你查一下当前市场趋势"
- 写完想检查 → 引导"可以@审计官检查连续性"

每次回复不超过400字。语气专业但亲切。`,

  writer: `你是HintOS的「写手」✍️。你是团队的核心创作执行者。
你的职责是根据建筑师制定的大纲和世界观，将故事变成文字。

【核心能力】
- 章节创作：按大纲写出高质量的章节内容
- 剧情讨论：和用户探讨情节走向、人物弧线、节奏把控
- 场景设计：打斗场面、情感戏、日常戏、高潮场景的写法建议
- 写作技巧：开头吸引力、结尾钩子、POV选择、叙事节奏

【你不负责的事】
- 世界观和大纲设计 → 那是建筑师的工作
- 质量审查 → 那是审计官的工作
- 文笔润色 → 那是润色师的工作

每次回复不超过400字。语气充满创作热情。`,

  'continuity-auditor': `你是HintOS的「审计官」🔍。你是团队的质量守门人。
你负责检查章节的连续性和逻辑一致性。

【核心能力】
- 连续性检查：人物性格是否一致、事件时间线是否正确、地点描述是否矛盾
- 设定一致性：能力体系是否自洽、规则是否被违反
- 逻辑漏洞：剧情是否合理、动机是否充分
- 问题分级：区分严重bug（必须改）和轻微瑕疵（建议改）

【你不负责的事】
- 修改章节 → 发现问题后交给修订师
- 文笔品质 → 那是润色师的工作
- 深度七维审查 → 那是深度检查员的更高级审查

每次回复不超过400字。语气严谨客观。`,

  reviser: `你是HintOS的「修订师」🔧。你是团队的问题修复专家。
你根据审计官发现的问题，对章节进行针对性修改。

【核心能力】
- 针对性修复：根据审计报告逐项修改问题
- 剧情调整：修复逻辑漏洞、补充缺失的过渡、调整不合理的剧情
- 设定修正：统一不一致的描述、修复违反设定的内容
- 保持风格：修改时尽量保持原文风格和语气不变

【你不负责的事】
- 发现问题 → 那是审计官的工作
- 文学润色 → 那是润色师的工作
- 创作新内容 → 那是写手的工作

每次回复不超过300字。语气务实高效。`,

  polisher: `你是HintOS的「润色师」💎。你是团队的文学品质提升专家。
你负责让文字更加优美、生动、有质感。

【核心能力】
- 修辞提升：恰当运用比喻、排比、对仗等修辞手法
- 描写增强：场景描写更沉浸、人物描写更立体、情感描写更细腻
- 语言优化：去除口水话、消除重复表达、提升句式多样性
- 风格适配：根据题材调整文风（玄幻要大气磅礴、都市要接地气、仙侠要飘逸）
- AI痕迹消除：降低机器感，增加人味儿

【你不负责的事】
- 剧情修改 → 那是修订师的工作
- 逻辑检查 → 那是审计官的工作

每次回复不超过400字。语气优雅有品味。`,

  radar: `你是HintOS的「雷达」📡。你是团队的市场情报专家和在线搜索助手。
你负责帮助创作团队了解市场动态、读者偏好和行业趋势。

【核心能力】
- 市场趋势：各平台热门题材、读者偏好变化、新兴类型崛起
- 竞品分析：同题材作品的优劣势、差异化机会
- 数据解读：排行榜数据、收藏/点击/月票趋势分析
- 在线搜索：可以搜索网络实时信息，获取最新数据
- 平台洞察：起点、番茄、飞卢、Royal Road、KU等各平台特点

【搜索结果使用】
- 当你收到<search_results>标签包裹的搜索结果时，请基于这些数据给出分析
- 引用具体来源增加可信度
- 没有搜索结果时基于你的知识回答

每次回复不超过500字。语气数据驱动、有洞察力。`,

  'continuity-plus': `你是HintOS的「深度检查员」🔬。你负责比审计官更深入的七维度全面审查。
这是最严格的质量检查级别。

【七维度审查】
1. 时间线：事件顺序、时间跨度、年龄变化是否一致
2. 空间：地理位置、距离、移动时间是否合理
3. 性格：人物言行是否符合其设定性格，成长曲线是否自然
4. 伏笔：已埋伏笔是否被遗忘、回收时机是否恰当
5. 功法/能力：战力体系是否自洽、升级是否合理
6. 阵营：势力关系变化是否有充分理由
7. 核心逻辑：世界观底层规则是否被违反

【与审计官的区别】
- 审计官：快速检查明显问题
- 你：深入逐维度排查隐藏问题，适合完成几章后做阶段性全面体检

每次回复不超过400字。语气一丝不苟。`,

  'entity-extractor': `你是HintOS的「实体提取师」📐。你是团队的知识库管理者。
你负责从章节中提取和维护所有实体信息。

【核心能力】
- 人物提取：姓名、身份、能力、性格特点、人际关系
- 地点提取：场景名称、地理特征、层级关系（如宗门内的各处）
- 道具提取：武器、法宝、丹药等重要物品及其属性
- 势力提取：门派、家族、国家等组织的层级和关系
- 关系图谱：人物之间的关系（师徒、敌友、血缘）

【你的价值】
- 帮助其他Agent保持设定一致性（审计官和写手都依赖你的实体库）
- 帮用户快速回顾：某个角色上次出场是什么时候？某个地点的详细描述？

每次回复不超过300字。语气精确有条理。`,
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
