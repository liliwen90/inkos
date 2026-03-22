import { useState } from 'react'
import {
  BookOpen, ChevronDown, ChevronRight, PenTool, ScrollText,
  Settings, Download, BarChart3, ShieldAlert, Sparkles, Lightbulb,
  FolderOpen, CheckCircle2,
  LayoutDashboard, Zap, HelpCircle, AlertTriangle, ArrowRight, Info, Route, Globe,
  TrendingUp, Archive, Palette
} from 'lucide-react'

import WorkflowShowcase from '../components/WorkflowShowcase'

// ===== 教程数据结构 =====

interface TutorialSection {
  id: string
  icon: React.ReactNode
  title: string
  badge?: string
  content: TutorialBlock[]
  customRender?: () => JSX.Element
}

type TutorialBlock =
  | { type: 'text'; content: string }
  | { type: 'heading'; content: string }
  | { type: 'tip'; content: string }
  | { type: 'warning'; content: string }
  | { type: 'steps'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'keyvalue'; items: { key: string; value: string }[] }
  | { type: 'divider' }

// ===== 所有教程内容 =====

const sections: TutorialSection[] = [
  // ─── 0. 软件工作流程总览 ───
  {
    id: 'workflow',
    icon: <Route className="w-4 h-4" />,
    title: '工作流程总览：从灵感到出版',
    badge: '必读',
    content: [],
    customRender: () => <WorkflowShowcase />,
  },

  // ─── 1. 快速开始 ───
  {
    id: 'quickstart',
    icon: <Zap className="w-4 h-4" />,
    title: '快速开始',
    content: [
      { type: 'text', content: '5 分钟从零到写出第一章：' },
      { type: 'steps', items: [
        '打开项目 — 首次启动时，仪表盘中央会显示欢迎页面，点击「打开 HintOS 项目」大按钮，选择一个空文件夹（系统会询问是否初始化为新项目并让你输入项目名），或选择已有的 hintos.json 所在目录。下次启动时会自动恢复上次打开的项目。',
        '配置 LLM — 进入左侧底部「LLM 配置」页面，填写 Provider、API 地址、密钥和模型名称。可选点击「测试连接」验证 API 可用性。然后点击「⚡ 初始化管线」按钮，等待左侧状态指示灯变绿即表示管线就绪。',
        '选题（可选）— 进入「热榜雷达」。英文模式一键抓取 Royal Road + ScribbleHub 热榜；中文模式导入本地参考小说 .txt 文件。AI 自动分析并推荐选题方向，结果保存到「创意库」。',
        '开书 — 进入「创意库」挑选保存的创意，点击「发送到创建新书」。创建书籍对话框会自动弹出，书名、题材、平台、字数等字段自动预填。你也可以在创意库页面点击「创建新书」从零开始。确认后点击「创建」，AI 建筑师会自动生成世界观和规则。',
        '风格配置（可选但强烈推荐）— 进入「风格分析」导入参考书（本地 .txt 或在线 URL，也可直接从热榜导入），运行文本统计 + AI 深度指纹。然后进入「AI 建议」生成完整创作方案（故事创意/角色声音/创作规则/故事弧线），点击「一键应用」自动填入「人性化引擎」。最后在「人性化引擎」微调笔法设定并保存。',
        '开始写作 — 进入「写作控制台」，选择书籍，设置字数和连续写章数，点击「写下一章」。7 阶段全自动完成，底部终端实时显示进度。',
        '审阅 — 在「章节管理」中逐章阅读，点击「通过」或「驳回」。',
        '导出 — 在「导出」页从已通过的章节生成 TXT / MD / EPUB 文件，配合内置封面模板发布到各平台。',
      ]},
      { type: 'tip', content: '如果不做选题和风格配置，也能直接创建书籍并开始写作——系统会使用默认设定。但配置步骤能显著提升写作质量和风格一致性，强烈推荐完整走一遍。' },
    ]
  },

  // ─── 2. 项目管理 ───
  {
    id: 'project',
    icon: <FolderOpen className="w-4 h-4" />,
    title: '项目管理',
    content: [
      { type: 'heading', content: '什么是 HintOS 项目' },
      { type: 'text', content: '一个 HintOS 项目就是一个文件夹，其中包含 hintos.json 配置文件。一个项目下可以有多本书，每本书有独立的章节、真相文件和规则。' },
      { type: 'heading', content: '项目结构' },
      { type: 'table', headers: ['路径', '说明'], rows: [
        ['hintos.json', '项目配置文件（项目名称等）'],
        ['.env', '项目级环境变量（LLM API 密钥等）'],
        ['task-routing.json', '任务路由配置（多模型协作）'],
        ['books/{书籍ID}/', '每本书的独立目录'],
        ['books/{书籍ID}/book.json', '书籍配置（题材/平台/字数等）'],
        ['books/{书籍ID}/chapters/', '章节文件（0001_xxx.md 格式）'],
        ['books/{书籍ID}/story/', '10 个真相文件 + 实体注册表 + 快照'],
      ]},
      { type: 'heading', content: '打开 / 初始化项目' },
      { type: 'steps', items: [
        '点击左下角「打开项目」或仪表盘欢迎页的「打开 HintOS 项目」按钮。',
        '如果选择的目录已包含 hintos.json，将直接加载。',
        '如果选择的是空目录，系统会询问是否初始化为新项目，并要求输入项目名称。',
        '上次打开的项目会自动记忆，下次启动时自动恢复。',
      ]},
      { type: 'heading', content: '切换项目' },
      { type: 'text', content: '直接再次点击左下角「切换项目」按钮，选择另一个项目目录即可。' },
    ]
  },

  // ─── 3. LLM 配置 ───
  {
    id: 'llm',
    icon: <Settings className="w-4 h-4" />,
    title: 'LLM 配置',
    badge: '关键',
    content: [
      { type: 'text', content: 'LLM（大语言模型）是整个系统的大脑。所有 Agent 的规划、创作、审计、修订都依赖 LLM API 调用。配置正确的 LLM 连接是使用 HintOS Studio 的前提。' },
      { type: 'heading', content: '配置项详解' },
      { type: 'keyvalue', items: [
        { key: 'Provider', value: '选择 OpenAI 兼容接口（支持大多数国产模型中转站）或 Anthropic 原生接口。如果使用 DeepSeek、通义千问、月之暗面等国产模型的 API，选择「OpenAI 兼容」。' },
        { key: 'API Base URL', value: 'API 服务器地址。OpenAI 官方为 https://api.openai.com/v1，各中转站有自己的地址（如 https://api.deepseek.com/v1）。注意必须包含 /v1 后缀。' },
        { key: 'API Key', value: '你的 API 密钥，以 sk- 开头。请从你的 LLM 服务商后台获取。密钥会保存在项目本地 .env 文件中，不会上传。' },
        { key: 'Model', value: '模型名称，如 deepseek-chat、gpt-4o、claude-sonnet-4-20250514 等。不同模型写作质量和成本差异很大。' },
        { key: 'Temperature', value: '创意度，0-2 之间。推荐 0.7-1.0。越高越有创意但可能跑题，越低越稳定但可能刻板。' },
        { key: 'Max Tokens', value: '每次 LLM 调用的最大输出长度。建议 8192 以上，避免长章节被截断。' },
      ]},
      { type: 'heading', content: '配置流程' },
      { type: 'steps', items: [
        '填写上述各项配置（Provider、API 地址、密钥、模型等）。',
        '点击「测试连接」验证 API 是否可用（可选，会显示响应延迟，支持逐个测试默认连接和各 Agent 独立连接）。',
        '点击紫色高亮的「⚡ 初始化管线」按钮。系统会自动保存配置并创建 LLM 客户端，左侧状态指示灯变绿表示管线就绪。',
      ]},
      { type: 'tip', content: '如果你之前已经配置过 LLM 并初始化管线，下次启动软件时系统会自动恢复项目并自动初始化管线，无需手动操作。只有首次配置或修改配置后才需要手动点击「初始化管线」。' },
      { type: 'heading', content: '推荐模型' },
      { type: 'table', headers: ['模型', '适用场景', '成本参考'], rows: [
        ['deepseek-chat', '性价比之王，中文写作质量好', '约 ¥1-2/万字'],
        ['gpt-4o', '综合能力强', '约 ¥5-10/万字'],
        ['claude-sonnet-4-20250514', '文学性强，长文连贯', '约 ¥8-15/万字'],
        ['gemini-2.5-flash', '分析能力强，适合审计', '约 ¥1-3/万字'],
        ['qwen-max', '通义千问，中文理解好', '约 ¥2-5/万字'],
      ]},
      { type: 'tip', content: '写一章 3000 字的小说，通常需要 6-8 次 LLM 调用（建筑师 + 写手 + 审计 + 深度审查 + 可能的修订 + 润色 + 实体提取），消耗约 3-8 万 token。使用 deepseek-chat 大约花费 ¥0.3-0.8/章。' },
    ]
  },

  // ─── 3.5 任务路由 ───
  {
    id: 'task-routing',
    icon: <Route className="w-4 h-4" />,
    title: '任务路由（多模型协作）',
    badge: '高级',
    content: [
      { type: 'text', content: 'HintOS 的写作管线包含 6 个 Agent（建筑师、写手、审计员、深度审查、修订者、润色师），各自擅长不同任务。任务路由功能允许你为每个 Agent 分配不同的 LLM 模型，实现成本和质量的最优配比。' },
      { type: 'heading', content: '为什么要用任务路由？' },
      { type: 'keyvalue', items: [
        { key: '省钱', value: '写手 Agent 调用量最大，用便宜的 DeepSeek 就够了；审计和润色对理解力要求高，用 Claude/Gemini 效果更好。' },
        { key: '扬长避短', value: '不同模型各有所长：DeepSeek 中文流畅、Gemini 分析能力强、Claude 文学性好。让它们各司其职。' },
        { key: '灵活切换', value: '随时调整某个 Agent 的模型，无需重新配置整个管线。' },
      ]},
      { type: 'heading', content: '6 个可配置 Agent' },
      { type: 'table', headers: ['Agent', '职责', '推荐模型', '理由'], rows: [
        ['🏗️ 建筑师', '规划大纲和世界观', 'deepseek-chat', '性价比高，规划能力够用'],
        ['✍️ 写手', '生成章节正文（最耗 token）', '默认模型', 'token 消耗大户，用最便宜的'],
        ['🔍 审计员', '27 维度质量审查', 'gemini-2.5-flash', '强推理能力，快速准确'],
        ['🔬 深度审查', '5 维度叙事连续性', 'gemini-2.5-flash', '需要跨章分析能力'],
        ['✏️ 修订者', '修复审计问题', 'claude-sonnet-4', '理解上下文并保持文学性'],
        ['💎 润色师', '文学级散文润色', 'claude-sonnet-4', '最强文学润色能力'],
      ]},
      { type: 'heading', content: '配置方法' },
      { type: 'steps', items: [
        '在 LLM 配置页面，先配好「默认模型」——这是所有未单独配置的 Agent 的兜底方案。',
        '打开「任务路由（多模型协作）」开关。',
        '为需要单独配置的 Agent 开启开关，填入模型名称。',
        'API Key 和 Base URL 留空表示继承默认配置（适合同一中转站多 Key 的场景）。',
        '点击「初始化管线」，系统会自动为每个模型创建独立的 LLM 客户端并按路由表分发请求。',
      ]},
      { type: 'tip', content: '可以点击「✨ 一键填入推荐配置」快速设置。鼠标悬停在 Agent 名称上会显示详细的职责描述。路由配置保存在项目的 task-routing.json 中，不同项目可以有不同的路由策略。' },
    ]
  },

  // ─── 4. 热榜雷达 ───
  {
    id: 'trending',
    icon: <TrendingUp className="w-4 h-4" />,
    title: '热榜雷达',
    badge: '选题',
    content: [
      { type: 'text', content: '热榜雷达帮你获取英文热榜数据或导入中文参考小说，结合 AI 分析生成选题建议，自动保存到创意库。是开始写书之前的第一步。' },
      { type: 'heading', content: '英文模式：抓取海外热榜' },
      { type: 'table', headers: ['平台', '榜单', '说明'], rows: [
        ['Royal Road', 'Trending', '当前热门连载'],
        ['Royal Road', 'Rising Stars', '新锐飙升作品'],
        ['ScribbleHub', 'Weekly Trending', '周热门（ACG向）'],
      ]},
      { type: 'steps', items: [
        '选择「English」标签，点击「AI 选题推荐」。',
        '系统自动抓取 Royal Road + ScribbleHub 热榜并去重。',
        'AI 分析题材趋势后生成 10 个选题方向，结果自动保存到创意库。',
      ]},
      { type: 'heading', content: '中文模式：导入参考小说' },
      { type: 'steps', items: [
        '选择「中文」标签，点击「选择 TXT 中文小说」按钮。',
        '在文件对话框中选择同题材的中文小说 .txt 文件（支持多选，建议 3-10 本同题材热门作品）。',
        '文件导入后显示在列表中（书名、字数），可逐个删除不需要的。',
        '点击「AI 分析选题」，系统提取每本小说的首/中/尾摘要，AI 综合分析后推荐 10 个选题方向。',
        '分析结果自动保存到创意库，可随时查阅和一键开书。',
      ]},
      { type: 'tip', content: '导入的 TXT 文件需要是 UTF-8 编码。如果文件编码不是 UTF-8（如 GBK），请先用记事本另存为 UTF-8 格式。单个文件不超过 50MB。' },
    ]
  },

  // ─── 5. 创意库 ───
  {
    id: 'idea-vault',
    icon: <Archive className="w-4 h-4" />,
    title: '创意库',
    content: [
      { type: 'text', content: '创意库保存所有 AI 选题分析结果，也是创建新书的入口。这里是将市场灵感转化为实际项目的中枢。' },
      { type: 'heading', content: '功能' },
      { type: 'keyvalue', items: [
        { key: '浏览', value: '按时间排列，显示创建日期、分析的小说数量和内容预览。' },
        { key: '详情', value: '点击卡片查看完整的 AI 分析文本（题材趋势、读者画像、差异化建议等）。' },
        { key: '编辑', value: '可以直接修改分析文本，加入你自己的想法和笔记。' },
        { key: '一键开书', value: '点击卡片上的「发送到创建新书」按钮，创建书籍对话框自动弹出并预填书名、题材、平台、字数和创作指导。' },
        { key: '创建新书', value: '页面顶部有「创建新书」按钮，无需任何创意数据也能直接开书。' },
        { key: '删除', value: '不需要的创意可以随时删除。' },
      ]},
      { type: 'tip', content: '推荐工作流：热榜雷达抓取 → AI 分析 → 保存到创意库 → 挑选最好的 → 一键开书。从市场数据到开始写作只需几分钟。如果不需要选题，也可以在创意库直接点「创建新书」从零开始。' },
    ]
  },

  // ─── 6. 仪表盘 & 书籍 ───
  {
    id: 'dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    title: '仪表盘 & 书籍管理',
    content: [
      { type: 'text', content: '仪表盘是你的主控台，展示当前项目下所有书籍的状态总览。创建书籍的入口已迁移到「创意库」页面——仪表盘专注于展示和管理。' },
      { type: 'heading', content: '如何创建书籍' },
      { type: 'text', content: '仪表盘不再直接提供创建书籍按钮。有两种方式开书：' },
      { type: 'steps', items: [
        '从创意库开书 — 进入「创意库」，选择一条创意后点击「发送到创建新书」，或直接点击「创建新书」。创建对话框会在创意库页面弹出。',
        '仪表盘跳转 — 如果仪表盘没有任何书籍，页面会显示一个琥珀色的「从创意库新建」按钮，点击即可跳转到创意库。',
      ]},
      { type: 'heading', content: '创建书籍对话框' },
      { type: 'keyvalue', items: [
        { key: '小说语言', value: '选择「中文」或「English」。切换语言后，题材和平台列表会自动切换到对应语言版本。' },
        { key: '书名', value: '必填。建议取一个有记忆点的名字，建筑师 Agent 会基于书名进行初始规划。' },
        { key: '题材', value: '中文 27 种、英文 14 种，共 41 种内置题材，每种自带完整的创作规则体系。' },
        { key: '平台', value: '中文：七猫/番茄/起点/飞卢/其他；英文：Royal Road/Kindle/Patreon/ScribbleHub/Wattpad/Other。' },
        { key: '目标章数', value: '计划写多少章，仅作参考。默认 200。' },
        { key: '每章字数', value: '每章目标字数。中文默认 3000，英文默认 2500。推荐 3000-5000 字。' },
        { key: '创作指导', value: '可选。描述故事方向、主角人设、世界观大纲等。建筑师 Agent 会参考这些信息生成初始规划。' },
        { key: '风格参考书', value: '可选。选择 .txt 格式的参考文本文件，建筑师会参考其风格。' },
      ]},
      { type: 'tip', content: '创建书籍时，建筑师 Agent 会自动生成世界观设定（story_bible.md）、卷纲（volume_outline.md）、本书规则（book_rules.md）等真相文件。这个过程需要几分钟。' },
      { type: 'heading', content: '书籍卡片' },
      { type: 'text', content: '每本书以卡片形式展示，显示题材标签、平台标签、章节数、总字数和状态。点击卡片可展开操作面板（查看详情、编辑配置、跳转写作、删除书籍）。' },
    ]
  },

  // ─── 7. 写作控制台 ───
  {
    id: 'writing',
    icon: <PenTool className="w-4 h-4" />,
    title: '写作控制台',
    badge: '核心',
    content: [
      { type: 'text', content: '写作控制台是 HintOS Studio 的核心页面。一键驱动「写→审→查→改→润」完整管线，底部赛博终端实时显示进度，右侧活动面板记录每步操作。' },
      { type: 'heading', content: '步骤守卫' },
      { type: 'text', content: '如果你还没有选择书籍，或管线未就绪，此页面会显示锁定画面（StepGate），列出待完成的前置条件和一键跳转按钮。只有所有前置条件满足后才能操作。' },
      { type: 'heading', content: '操作步骤' },
      { type: 'steps', items: [
        '从顶部下拉菜单选择要写作的书籍。',
        '设置「每章字数」（推荐 3000-5000）。',
        '设置「连续写」章数（1-50 章，系统会自动逐章完成）。',
        '点击「写下一章」按钮启动管线。每次写作操作会自动创建一条活动记录（类型 write-chapter），显示在右侧活动面板和底部终端中。',
      ]},
      { type: 'heading', content: '管线 7 阶段' },
      { type: 'text', content: '每一章的创作经过 7 个阶段：' },
      { type: 'table', headers: ['阶段', 'Agent', '说明'], rows: [
        ['1. 管线启动', '—', '加载书籍配置、真相文件、实体注册表、连续性上下文'],
        ['2. 建筑师', '🏗️ Architect', '规划本章大纲：场景节拍、节奏控制、关键事件'],
        ['3. 写手', '✍️ Writer', '根据大纲 + 世界状态 + 规则 + 风格指导 + 实体注册表生成正文'],
        ['4. 审计', '🔍 Auditor', '27 维度审查：OOC、时间线、设定冲突、AI 痕迹等'],
        ['5. 深度审查', '🔬 ContinuityPlus', '5 维度叙事连续性：因果链、角色弧光、伏笔回收等'],
        ['6. 修订', '✏️ Reviser', '修复审计发现的问题（仅在有关键问题时触发）'],
        ['7. 润色', '💎 Polisher', '文学级散文润色，消除 AI 痕迹，提升文学质感'],
      ]},
      { type: 'tip', content: '如果审计发现关键问题（critical），管线会自动进入「修订→再审计」循环，直到所有关键问题清零。你不需要手动干预。' },
      { type: 'heading', content: '实体注册表' },
      { type: 'text', content: '每章写完后，系统会自动提取章节中出现的所有命名实体（人物、地点、物品等），记录到 entity_registry.md。包括姓名、类型、性别、年龄、外貌、身份、能力等不可变属性。后续章节写作时会参考此注册表，避免第3章出生的女婴到第10章被错写成男孩。' },
      { type: 'heading', content: 'CyberFeed 终端 & 活动面板' },
      { type: 'text', content: '底部 CyberFeed 赛博终端以实时滚动的方式显示系统操作日志（管线阶段、LLM 调用、错误信息等），右侧活动面板记录每个操作的类型、状态和起止时间。这两个面板在整个应用中全局可见——无论你在哪个页面，都能看到系统当前的工作状态。' },
      { type: 'warning', content: '写作过程中请勿关闭软件或切换项目，否则可能导致数据不一致。连续写多章时每章之间会自动衔接。' },
    ]
  },

  // ─── 8. 章节管理 ───
  {
    id: 'chapters',
    icon: <BookOpen className="w-4 h-4" />,
    title: '章节管理',
    content: [
      { type: 'text', content: '管理所有已生成的章节，包括阅读、审阅和导出。' },
      { type: 'heading', content: '章节状态系统' },
      { type: 'table', headers: ['状态', '说明', '颜色'], rows: [
        ['draft', '草稿，刚生成', '灰色'],
        ['writing', '写作中', '蓝色'],
        ['auditing', '审计中', '紫色'],
        ['revising', '修订中', '橙色'],
        ['review', '待审阅（已通过自动审计，等人工确认）', '黄色'],
        ['approved', '已通过人工审阅', '绿色'],
        ['rejected', '已驳回', '红色'],
        ['published', '已发布', '青色'],
        ['archived', '已归档', '灰色'],
        ['error', '出错', '红色'],
      ]},
      { type: 'heading', content: '审阅操作' },
      { type: 'steps', items: [
        '点击章节列表中的眼睛图标，查看章节全文。',
        '阅读内容后，如果满意，点击绿色「通过」按钮。',
        '如果需要修改，点击红色「驳回」按钮，可以填写驳回理由。',
        '审计问题会在章节详情右侧以黄色警告列表展示，帮助你判断是否需要驳回。',
      ]},
      { type: 'tip', content: '经过 6 个 Agent 处理后，review 状态的章节质量一般可靠。建议重点关注审计问题列表中标记为「critical」的条目。' },
    ]
  },

  // ─── 9. 真相文件 ───
  {
    id: 'truth',
    icon: <ScrollText className="w-4 h-4" />,
    title: '真相文件系统',
    content: [
      { type: 'text', content: '真相文件是 HintOS 的核心创新。它们是小说世界的唯一事实来源，每章写完后自动更新，确保长篇小说的连续性。' },
      { type: 'heading', content: '10 个真相文件 + 实体注册表' },
      { type: 'table', headers: ['文件', '内容', '用途'], rows: [
        ['当前状态', '角色位置、关系网络、已知信息、情感弧线', '写手参考世界当前状态'],
        ['资源账本', '物品、金钱、物资数量及衰减追踪', '防止无限背包、物品凭空出现'],
        ['伏笔池', '未闭合伏笔、铺垫、对读者的承诺', '确保伏笔不遗忘、按时回收'],
        ['世界观', '世界设定、法则、势力、地理', '保持世界观一致性'],
        ['卷纲', '卷级结构规划', '控制整体节奏'],
        ['本书规则', '主角人设、数值上限、禁令', '每章都注入，不可违反'],
        ['章节摘要', '各章出场人物、关键事件、状态变化', '回顾已发生的事'],
        ['支线进度板', 'A/B/C 线状态追踪、停滞检测', '防止支线断裂或遗忘'],
        ['情感弧线', '按角色追踪情绪变化和成长', '控制角色弧线不平坦'],
        ['角色交互矩阵', '相遇记录、信息边界', '防止信息泄漏（角色不该知道的事）'],
        ['实体注册表', '所有命名实体的不可变属性表', '防止人物性别、外貌等前后矛盾'],
      ]},
      { type: 'heading', content: '如何使用' },
      { type: 'text', content: '在「真相文件」页面选择书籍后，左侧列出所有文件标签，点击即可查看内容。内容为 Markdown 格式，只读展示。' },
      { type: 'tip', content: '真相文件由系统自动维护，你通常不需要手动编辑。但如果发现信息错误，可以在项目目录的 books/{书籍ID}/story/ 下直接编辑对应的 .md 文件。' },
      { type: 'heading', content: '实体注册表（entity_registry.md）' },
      { type: 'text', content: '实体注册表是一张 10 列的 Markdown 表格，每行记录一个命名实体（人物、地点、物品等）。列包括：名称、类型、性别、年龄、外貌、身份、能力、首次出现、最近出现、关键事实。每章写完后 EntityExtractorAgent 自动提取新实体并合并到已有记录中（新增追加、已有更新非空字段）。' },
      { type: 'heading', content: '快照与回滚' },
      { type: 'text', content: '每完成一章，系统会自动对当前真相文件做快照（保存在 story/snapshots/{章节号}/ 下）。如果需要重写某一章，系统会自动回滚世界状态到该章之前的快照，避免数据污染。' },
    ]
  },

  // ─── 10. 27 维度审计 ───
  {
    id: 'audit',
    icon: <CheckCircle2 className="w-4 h-4" />,
    title: '27 维度审计系统',
    content: [
      { type: 'text', content: 'HintOS 独有的 27 维度审计系统，由审计员 Agent 在每章写完后自动执行。' },
      { type: 'heading', content: '审计维度一览' },
      { type: 'table', headers: ['维度', '检查内容'], rows: [
        ['OOC 检查', '角色是否做出不符合人设的行为'],
        ['时间线', '事件时间顺序是否逻辑自洽'],
        ['设定冲突', '是否与世界观/规则矛盾'],
        ['伏笔', '是否遗忘或错误使用伏笔'],
        ['节奏', '情节推进速度是否合理'],
        ['文风', '是否符合设定的文风'],
        ['信息越界', '角色是否知道了不该知道的事'],
        ['词汇疲劳', '过度使用某些词语（仿佛/忽然/竟然等）'],
        ['利益链断裂', '利益关系是否突然改变'],
        ['配角降智', '配角是否突然变傻'],
        ['配角工具人化', '配角是否只是推进剧情的工具'],
        ['爽点虚化', '爽点是否真正让读者爽了'],
        ['台词失真', '台词是否太书面化/不合人设'],
        ['流水账', '叙述是否变成了流水账'],
        ['知识库污染', '是否混入了不应出现的知识'],
        ['视角一致性', '叙事视角是否一致'],
        ['战力崩坏', '人物实力是否前后矛盾'],
        ['数值检查', '数值系统是否合理（如资源数量）'],
        ['年代考据', '年代背景细节是否准确'],
        ['段落等长*', 'AI 特征：段落是否太过均匀'],
        ['套话密度*', 'AI 特征：是否充斥常见 AI 套话'],
        ['公式化转折*', 'AI 特征：转折是否套路化'],
        ['列表式结构*', 'AI 特征：是否用列表铺陈'],
        ['支线停滞', '支线是否长期未推进'],
        ['弧线平坦', '角色成长弧线是否太平'],
        ['节奏单调', '全篇节奏是否缺乏变化'],
        ['实体一致性', '人物属性是否与实体注册表矛盾'],
      ]},
      { type: 'tip', content: '带 * 的 4 个维度由纯规则引擎检测，不消耗 LLM 调用。不同题材启用不同的子集。' },
      { type: 'heading', content: '深度审查（ContinuityPlus）' },
      { type: 'text', content: '在基础 27 维审计之后，ContinuityPlus Agent 会进行 5 维叙事连续性深度审查：因果链完整性、角色弧光连贯性、伏笔回收时机、世界规则一致性、时间线无矛盾。这是基础审计的补充，专注于跨章节的宏观连续性问题。' },
    ]
  },

  // ─── 11. 题材规则体系 ───
  {
    id: 'genre',
    icon: <BookOpen className="w-4 h-4" />,
    title: '题材 & 规则体系',
    content: [
      { type: 'text', content: 'HintOS 内置 41 种题材（中文 27 种 + 英文 14 种），每种自带完整的创作规则。规则体系分三层：通用规则 → 题材规则 → 单本书规则。' },
      { type: 'heading', content: '三层规则体系' },
      { type: 'table', headers: ['层级', '范围', '示例'], rows: [
        ['通用规则 (~25条)', '所有题材都执行', '人物塑造、叙事技法、逻辑自洽、去AI味'],
        ['题材规则', '特定题材执行', '玄幻：数值系统+战力体系；都市：年代考据；恐怖：氛围递进'],
        ['本书规则 (book_rules.md)', '单本书独有', '主角人设锁定、数值上限、自定义禁令、疲劳词覆盖'],
      ]},
      { type: 'heading', content: '中文题材（27种）' },
      { type: 'text', content: '玄幻、仙侠、武侠、奇幻、都市、言情、现实、历史、军事、科幻、悬疑、恐怖、灵异、游戏、体育、二次元、穿越、重生、末世、无限流、诸天、同人、短篇、系统流、种田文、规则怪谈、通用' },
      { type: 'heading', content: '英文题材（14种）' },
      { type: 'text', content: 'Progression Fantasy, Cultivation, LitRPG, GameLit, Isekai/Portal Fantasy, Dungeon Core, Epic Fantasy, Urban Fantasy, Cozy Fantasy, Sci-Fi/Space Opera, Horror/Cosmic Horror, Post-Apocalyptic, System Apocalypse, General' },
      { type: 'heading', content: '去 AI 味' },
      { type: 'text', content: '系统多管齐下降低 AI 文本特征：' },
      { type: 'steps', items: [
        'AI 标记词限频：仿佛/忽然/竟然/不禁/宛如/猛地，每 3000 字 ≤ 1 次。',
        '叙述者不替读者下结论，只写动作。',
        '禁止分析报告式语言（"核心动机""信息落差"不入正文）。',
        '词汇疲劳审计 + AI 痕迹审计（dim 20-23）双重检测。',
        '润色师 Agent 最终一轮文学级润色，进一步消除 AI 痕迹。',
        '文风指纹注入定制化降低 AI 文本特征。',
      ]},
      { type: 'tip', content: '创建书籍后可以在项目目录手动编辑 books/{书籍ID}/story/book_rules.md，添加自定义禁令、锁定主角人设等。改完下次写章自动生效。' },
    ]
  },

  // ─── 12. 风格分析 ───
  {
    id: 'style',
    icon: <BarChart3 className="w-4 h-4" />,
    title: '风格分析',
    content: [
      { type: 'text', content: '通过分析参考文本（你喜欢的作者/作品片段），提取文风指纹注入写手 Agent，让 AI 模仿特定写作风格。支持三种数据来源。' },
      { type: 'heading', content: '三种数据来源' },
      { type: 'table', headers: ['来源', '说明', '用法'], rows: [
        ['热榜导入', '直接将热榜雷达抓取的小说文本导入为参考书', '在热榜雷达页面选择小说，点击「导入到风格分析」'],
        ['在线采样', '输入 URL，系统自动抓取网页文本内容', '点击「在线采样」按钮填入 URL'],
        ['本地导入', '选择本地 .txt 文件导入', '点击「导入参考书」按钮选择文件'],
      ]},
      { type: 'heading', content: '分析流程' },
      { type: 'steps', items: [
        '通过上述三种方式之一导入参考文本（建议 5000 字以上效果更好）。',
        '导入成功后会显示在参考书列表中。',
        '点击醒目的琥珀色「运行文本统计」大按钮，系统会分析文本的基础统计特征：平均句长、段长范围、词汇多样性（TTR）、高频句式、修辞手法等。',
        '点击「深度指纹」按钮（需管线就绪），AI 会深度分析作者的独特文风特征，生成风格指纹文本。',
        '启用「注入」开关，调节强度（1-10），指纹将在后续写作时自动注入写手 Agent 的 prompt 中。',
      ]},
      { type: 'heading', content: '统计画像指标' },
      { type: 'keyvalue', items: [
        { key: '平均句长', value: '每句话的平均字数，体现文笔节奏感' },
        { key: '句长标准差', value: '句长的变化幅度，高 = 长短句交错多' },
        { key: '平均段长', value: '每段平均句数' },
        { key: '词汇多样性 (TTR)', value: 'Type-Token Ratio，唯一词汇/总词汇，高 = 用词丰富' },
        { key: '高频句式', value: '常见句式结构标签' },
        { key: '修辞手法', value: '文本中使用的修辞标签' },
      ]},
      { type: 'tip', content: '风格指纹注入强度建议 5-7。太高可能导致生硬模仿，太低则效果不明显。建议导入 1-3 本参考书（可混合三种来源），系统会综合分析。' },
    ]
  },

  // ─── 13. AIGC 检测 ───
  {
    id: 'detection',
    icon: <ShieldAlert className="w-4 h-4" />,
    title: 'AIGC 检测',
    content: [
      { type: 'text', content: 'AIGC 检测帮你评估每一章的「AI味」有多重，并标记潜在的敏感词问题。' },
      { type: 'heading', content: '检测方式' },
      { type: 'steps', items: [
        '选择书籍和章节。',
        '点击「检测」按钮对单章检测，或点击「全部检测」扫描所有章节。',
        '检测结果包含 AI 痕迹分析和敏感词扫描两部分。',
        '检测历史会自动保存，可以跟踪每章的风险变化趋势。',
      ]},
      { type: 'heading', content: 'AI 痕迹 4 维指标' },
      { type: 'table', headers: ['指标', '说明', '低分更好'], rows: [
        ['段落均匀度', '段落字数是否过于平均（AI 典型特征）', '✓'],
        ['对冲词密度', '使用"然而""不过""但是"等转折词的频率', '✓'],
        ['公式化过渡', '段落过渡是否套路化', '✓'],
        ['列表结构', '是否存在列表式铺陈（AI 爱用1、2、3）', '✓'],
      ]},
      { type: 'text', content: '综合评分 0-10 分，分数越低越好。低于 3 分基本看不出 AI 痕迹。' },
      { type: 'heading', content: '风险等级' },
      { type: 'keyvalue', items: [
        { key: '🟢 低风险', value: 'AI 痕迹评分 < 3，敏感词 0-2 个' },
        { key: '🟡 中风险', value: 'AI 痕迹评分 3-6，或敏感词 3-5 个' },
        { key: '🔴 高风险', value: 'AI 痕迹评分 > 6，或敏感词 > 5 个' },
      ]},
      { type: 'tip', content: '如果某章检测分数偏高，可配合「人性化引擎」的风格设定和风格指纹注入来降低 AI 痕迹。润色师 Agent 也会自动在写作管线中进行最终去 AI 痕迹处理。' },
    ]
  },

  // ─── 14. 人性化引擎 ───
  {
    id: 'humanize',
    icon: <Sparkles className="w-4 h-4" />,
    title: '人性化引擎',
    content: [
      { type: 'text', content: '人性化引擎通过精细的风格配置，让 AI 写出更有「人味」的文字。配置的所有参数会作为额外指令注入写手 Agent 的 prompt。如果你已在「AI 建议」中点击了一键应用，这里的风格设定、声音卡片和场景节拍会被自动预填——你只需要微调即可。' },
      { type: 'heading', content: '与 AI 建议的数据链路' },
      { type: 'text', content: 'AI 建议页面的「一键应用」会将以下数据写入人性化引擎：humanizeSettings → 7 维风格设定（POV/时态/节奏/基调/展示度/对话风格/描写密度）、voiceCards → 声音卡片、sceneBeats → 场景节拍、writingRules → 创作规则。每个预填值旁边会显示建议理由（如："基于参考书分析，三本参考书均使用第三人称有限视角"），帮你理解 AI 为什么推荐这个设定。' },
      { type: 'heading', content: '风格设定（7 维调节）' },
      { type: 'table', headers: ['维度', '选项', '说明'], rows: [
        ['视角', '第一人称 / 第三有限 / 第三全知', '叙事角度'],
        ['时态', '过去 / 现在', '叙事时态'],
        ['节奏', '快 / 均衡 / 慢', '情节推进速度'],
        ['基调', '中性/紧张/温馨/黑暗/幽默/史诗', '整体情绪氛围'],
        ['展示vs叙述', '低 / 中 / 高', '高=更多场景展示，少旁白解说'],
        ['对话风格', '正式 / 自然 / 口语化', '角色说话方式'],
        ['描写密度', '简洁 / 适中 / 丰富', '环境和细节描写量'],
      ]},
      { type: 'heading', content: '声音卡片' },
      { type: 'text', content: '为每个重要角色创建「声音卡片」，定义他们独特的说话方式：' },
      { type: 'keyvalue', items: [
        { key: '角色名', value: '如「林烬」' },
        { key: '说话风格', value: '如「简短有力，从不废话」' },
        { key: '语调', value: '如「冷淡，偶尔冷幽默」' },
        { key: '口癖/特点', value: '如「习惯性反问，爱用军事术语」' },
      ]},
      { type: 'heading', content: '场景节拍' },
      { type: 'text', content: '可以为特定章节预设场景节拍序列，精确控制该章发生的事件节奏。每个节拍是一句简短描述。' },
      { type: 'heading', content: 'Prompt 预览' },
      { type: 'text', content: '「Prompt 预览」标签可以查看所有人性化设定最终会被组装成什么样的指令文本注入给写手 Agent，便于调试。' },
      { type: 'tip', content: '声音卡片对提升台词质量效果显著，建议至少为 3-5 个核心角色创建声音卡片。场景节拍适合关键章节（高潮/转折）使用。' },
    ]
  },

  // ─── 15. AI 建议 ───
  {
    id: 'suggestions',
    icon: <Lightbulb className="w-4 h-4" />,
    title: 'AI 创作建议',
    content: [
      { type: 'text', content: 'AI 建议系统基于你的风格参考书和书籍设定，自动生成完整的创作方案——这是从"配置"到"生产"的关键桥梁。' },
      { type: 'heading', content: '生成的建议类型' },
      { type: 'table', headers: ['类型', '内容', '用途'], rows: [
        ['💡 故事创意', '多个故事方向标题 + 简介', '选题参考'],
        ['🎭 作者角色', '为你定义一个作者人格', '统一写作风格'],
        ['📏 创作规则', '一组写作纪律（writingRules）', '注入建筑师和写手 prompt'],
        ['🗣️ 声音卡片', '核心角色的说话风格建议（voiceCards）', '一键应用到人性化引擎'],
        ['🎬 场景节拍', '节拍模板（sceneBeats）', '一键应用到人性化引擎'],
        ['📈 故事弧线', '分阶段规划：名称/章节范围/目标（storyArc）', '写入 volume_outline.md'],
        ['⚙️ 风格设定', '7 维笔法建议 + 理由（humanizeSettings）', '一键应用到人性化引擎'],
      ]},
      { type: 'heading', content: '数据流向详解' },
      { type: 'text', content: '点击「一键应用」后，数据会自动分发到多个目标：' },
      { type: 'keyvalue', items: [
        { key: 'humanizeSettings', value: '写入人性化引擎 → 7 维风格设定。每个维度附带 reason 字段解释推荐理由。' },
        { key: 'voiceCards', value: '写入人性化引擎 → 声音卡片列表。定义核心角色的独特说话方式。' },
        { key: 'sceneBeats', value: '写入人性化引擎 → 场景节拍。为关键章节预设事件节奏。' },
        { key: 'writingRules', value: '写入书籍配置 → 注入每章建筑师和写手的 prompt。' },
        { key: 'storyArc', value: '写入 story/volume_outline.md → 建筑师规划大纲时参考。' },
      ]},
      { type: 'heading', content: '使用方法' },
      { type: 'steps', items: [
        '确保已在 LLM 配置页初始化管线。',
        '（推荐）先在「风格分析」中导入参考书并运行分析——AI 建议会读取这些数据。',
        '点击「生成建议」按钮，等待 AI 分析（可能需要 1-2 分钟）。',
        '展开各建议模块查看内容，检查 humanizeSettings 中每个维度的建议值和理由。',
        '点击「一键应用」将所有建议自动分发到人性化引擎和书籍配置。',
        '进入「人性化引擎」微调预填的值，然后进入「写作控制台」开始生产。',
      ]},
      { type: 'tip', content: 'AI 建议 → 人性化引擎 → 写作控制台 是设计好的三步链路。一键应用不会覆盖你之前手动设置的值——它只填充空的字段和追加新条目。' },
    ]
  },

  // ─── 16. 导出 ───
  {
    id: 'export',
    icon: <Download className="w-4 h-4" />,
    title: '导出',
    content: [
      { type: 'text', content: '将已完成的章节导出为文件，支持三种格式，适配不同发布需求。' },
      { type: 'heading', content: '支持格式' },
      { type: 'table', headers: ['格式', '说明', '适用场景'], rows: [
        ['Markdown (.md)', '保留标题格式和段落结构', '本地编辑或转换'],
        ['纯文本 (.txt)', '去除所有格式标记', '直接粘贴到网文平台'],
        ['EPUB3 (.epub)', '标准电子书格式，支持 KDP', 'Amazon Kindle 出版'],
      ]},
      { type: 'heading', content: 'EPUB 导出（KDP 级别）' },
      { type: 'text', content: 'EPUB 导出按照 Amazon KDP 标准生成，包含完整元数据。' },
      { type: 'keyvalue', items: [
        { key: '元数据', value: '作者名、语言（自动检测或手选）、内容简介、关键词' },
        { key: '目录', value: '自动生成 NCX 导航目录' },
        { key: '内页', value: '可选包含扉页、版权页' },
        { key: '章节格式', value: '三种风格：完整标题 / 仅编号 / 仅标题' },
      ]},
      { type: 'heading', content: '封面生成器' },
      { type: 'text', content: '内置 8 款网文封面模板，在 Canvas 上实时渲染，可保存为 PNG。模板覆盖：暗黑奇幻、科幻、LitRPG、言情、恐怖、武侠、都市、玄幻。分辨率 1600×2560px，满足 Amazon KDP 封面要求。' },
      { type: 'tip', content: 'EPUB 配合封面模板，可以直接上传到 Amazon KDP 发布电子书，无需额外工具。' },
    ]
  },

  // ─── 17. 发布平台 ───
  {
    id: 'platforms',
    icon: <Globe className="w-4 h-4" />,
    title: '发布平台',
    badge: '英文供稿',
    content: [
      { type: 'text', content: '使用 HintOS 生成英文小说后，推荐按以下路线发布到海外平台变现。核心策略是「三段火箭」：Royal Road 养粉 → Patreon 提前章节变现 → Amazon KDP 打包出书。' },
      { type: 'heading', content: '平台总览' },
      { type: 'table', headers: ['平台', '定位', 'AI 政策', '变现方式', '优先级'],
        rows: [
          ['[Royal Road](https://www.royalroad.com)', '西方网文第一站', '✅ 允许，需打标签', '打赏 + Stub→KDP + Patreon', '⭐⭐⭐ 首发'],
          ['[Amazon KDP](https://kdp.amazon.com)', '全球最大电子书', '✅ 允许，需声明', '70% 版税 + KU 页读', '⭐⭐⭐ 变现'],
          ['[Patreon](https://www.patreon.com)', '创作者订阅', '✅ 无限制', '月订阅，平台抽 8-12%', '⭐⭐⭐ 加速'],
          ['[ScribbleHub](https://www.scribblehub.com)', 'ACG 向轻小说', '✅ 建议标注', '无站内变现，引流用', '⭐⭐ 同步'],
        ]
      },
      { type: 'heading', content: '三段火箭执行策略' },
      { type: 'table', headers: ['阶段', '时间', '动作', '预期收入'],
        rows: [
          ['蓄力期', '第 1-3 月', 'HintOS 生产 → RR+SH 同步发，每周 3-5 章', '$0'],
          ['引爆期', '第 4-8 月', 'RR 500+ follower → 开 Patreon + KDP Stub', '$100-500/月'],
          ['规模化', '第 9 月+', '多书并行批量走管线，累积 KU 被动收入', '$500-3,000+/月'],
        ]
      },
      { type: 'warning', content: 'Royal Road 要求 AI 生成内容必须打标签且保证质量。HintOS 的 27 维审计 + 深度审查 + 润色师就是为此设计的，但仍需人工通读确认。' },
    ]
  },

  // ─── 18. 主题与界面 ───
  {
    id: 'themes',
    icon: <Palette className="w-4 h-4" />,
    title: '主题与界面',
    content: [
      { type: 'text', content: 'HintOS Studio 内置 5 种配色主题，可在侧边栏底部的色盘中一键切换。' },
      { type: 'heading', content: '可用主题' },
      { type: 'table', headers: ['主题', '配色', '适合场景'], rows: [
        ['暗夜紫 (默认)', '#8b5cf6 紫色调', '默认暗色，保护眼睛'],
        ['碧海蓝', '#60a5fa 蓝色调', '护眼浅蓝背景'],
        ['青峦绿', '#2dd4bf 绿色调', '护眼浅绿背景'],
        ['暖纸黄', '#fbbf24 黄色调', '暖色调，类纸张感'],
        ['薄荷夜', '#14b8a6 薄荷绿', '暗色低蓝光'],
      ]},
      { type: 'text', content: '主题设置会自动保存，下次启动时恢复。所有页面元素（侧边栏、按钮、图标、Logo）会跟随主题自动变色。' },
    ]
  },

  // ─── 19. 常见问题 ───
  {
    id: 'faq',
    icon: <HelpCircle className="w-4 h-4" />,
    title: '常见问题',
    content: [
      { type: 'heading', content: '管线状态一直显示"未连接"' },
      { type: 'text', content: '每次打开软件后需要手动前往「LLM 配置」页面点击「初始化管线」。确认配置正确后点击初始化即可。' },
      { type: 'divider' },
      { type: 'heading', content: '仪表盘没有创建书籍按钮' },
      { type: 'text', content: '创建书籍的入口已迁移到「创意库」页面。在创意库中可以选择一条创意后「发送到创建新书」，或直接点击「创建新书」。仪表盘没有书时会显示一个「从创意库新建」跳转按钮。' },
      { type: 'divider' },
      { type: 'heading', content: '写作过程中报错了怎么办' },
      { type: 'text', content: '最常见的原因是 API 调用失败（网络问题/额度用尽/模型不可用）。查看进度日志中的错误信息，解决 API 问题后重新点击写作即可。已经写成功的章节不会丢失。' },
      { type: 'divider' },
      { type: 'heading', content: '能不能手动编辑章节内容' },
      { type: 'text', content: '可以。章节文件保存在 books/{书籍ID}/chapters/ 目录下，格式为 Markdown。用任何文本编辑器打开即可修改。' },
      { type: 'divider' },
      { type: 'heading', content: '一章大概要花多少钱' },
      { type: 'text', content: '取决于模型和每章字数。以 deepseek-chat 写 3000 字/章为例，一章约 ¥0.3-0.8（含建筑师+写手+审计+深度审查+修订+润色+实体提取，总共 6-8 次 LLM 调用）。使用 GPT-4o 约 ¥3-8/章。用任务路由混合模型可以优化成本。' },
      { type: 'divider' },
      { type: 'heading', content: '支持哪些 LLM 模型' },
      { type: 'text', content: '支持所有 OpenAI 兼容接口（OpenAI、DeepSeek、通义千问、月之暗面、智谱、零一万物、硅基流动等）和 Anthropic 原生接口（Claude 系列）。本地模型（如 Ollama）只要提供兼容 API 也可使用。' },
      { type: 'divider' },
      { type: 'heading', content: '6 个 Agent 分别做什么' },
      { type: 'table', headers: ['Agent', '职责', '何时运行'], rows: [
        ['🏗️ 建筑师', '规划章节大纲、生成世界观设定', '每章开头 + 创建书籍时'],
        ['✍️ 写手', '根据大纲生成章节正文', '每章'],
        ['🔍 审计员', '27 维度质量检查', '每章写完后'],
        ['🔬 深度审查', '5 维度跨章连续性审查', '每章审计后'],
        ['✏️ 修订者', '修复审计发现的关键问题', '仅在有 critical 问题时'],
        ['💎 润色师', '文学级散文润色，去 AI 味', '每章最后'],
      ]},
      { type: 'divider' },
      { type: 'heading', content: '如何提升写作质量' },
      { type: 'steps', items: [
        '选择更强的模型（如 claude-sonnet-4 文学性最好）。',
        '填写详细的创作指导（创建书籍时）。',
        '导入风格参考书 → 启用风格指纹注入。',
        '创建核心角色的声音卡片。',
        '使用任务路由，让不同 Agent 用各自最擅长的模型。',
        '手动编辑 book_rules.md 添加更具体的人设和禁令。',
      ]},
      { type: 'divider' },
      { type: 'heading', content: '能同时写多本书吗' },
      { type: 'text', content: '可以。一个项目下可以创建多本书（中英文混合也可以），每本有独立的章节、真相文件和规则。但一次只能一本在跑管线。' },
    ]
  },
]
// ===== 教程页面组件 =====

export default function Tutorial(): JSX.Element {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['workflow']))

  const toggleSection = (id: string): void => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = (): void => {
    setExpandedSections(new Set(sections.map(s => s.id)))
  }
  const collapseAll = (): void => {
    setExpandedSections(new Set())
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 页头 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-violet-400" />
            使用教程
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            从零开始掌握 HintOS Studio 的全部功能
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={expandAll}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors">
            全部展开
          </button>
          <button onClick={collapseAll}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors">
            全部折叠
          </button>
        </div>
      </div>

      {/* 快速导航 */}
      <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50">
        <p className="text-xs text-zinc-500 mb-2 font-medium">快速导航</p>
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <button key={s.id} onClick={() => {
              setExpandedSections(prev => new Set(prev).add(s.id))
              document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
              {s.icon} {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* 教程内容 */}
      <div className="space-y-3">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id)
          return (
            <div key={section.id} id={`section-${section.id}`}
              className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/30">
              <button onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-zinc-800/30 transition-colors">
                <span className="text-violet-400 shrink-0">{section.icon}</span>
                <span className="text-sm font-semibold text-zinc-200 flex-1">{section.title}</span>
                {section.badge && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-violet-600/20 text-violet-300 border border-violet-600/30">
                    {section.badge}
                  </span>
                )}
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 space-y-4">
                  {section.customRender
                    ? section.customRender()
                    : section.content.map((block, i) => (
                        <TutorialBlockRenderer key={i} block={block} />
                      ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 页脚 */}
      <div className="border-t border-zinc-800 pt-6 pb-8 text-center">
        <p className="text-zinc-600 text-xs">
          HintOS Studio v0.1.0 · 基于 HintOS v0.3.6 · MIT License
        </p>
      </div>
    </div>
  )
}

// ===== Block 渲染器 =====

/** 解析表格单元格中的 [text](url) 链接，点击时在默认浏览器打开 */
function CellContent({ text }: { text: string }): JSX.Element {
  const linkPattern = /\[([^\]]+)\]\((https:\/\/[^)]+)\)/
  const match = text.match(linkPattern)
  if (!match) return <>{text}</>
  return (
    <button
      onClick={() => window.hintos?.openExternal?.(match[2])}
      className="text-violet-400 hover:text-violet-300 underline underline-offset-2 cursor-pointer"
      title={`在浏览器中打开 ${match[2]}`}
    >
      {match[1]}
    </button>
  )
}

function TutorialBlockRenderer({ block }: { block: TutorialBlock }): JSX.Element {
  switch (block.type) {
    case 'text':
      return <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{block.content}</p>

    case 'heading':
      return <h3 className="text-sm font-semibold text-zinc-200 pt-2 flex items-center gap-2">
        <ArrowRight className="w-3 h-3 text-violet-400" />
        {block.content}
      </h3>

    case 'tip':
      return (
        <div className="flex gap-3 rounded-lg bg-violet-950/20 border border-violet-800/30 px-4 py-3">
          <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
          <p className="text-xs text-violet-300/80 leading-relaxed">{block.content}</p>
        </div>
      )

    case 'warning':
      return (
        <div className="flex gap-3 rounded-lg bg-amber-950/20 border border-amber-800/30 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">{block.content}</p>
        </div>
      )

    case 'steps':
      return (
        <ol className="space-y-2 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-zinc-400 leading-relaxed">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-600/20 text-violet-300 text-[10px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="flex-1">{item}</span>
            </li>
          ))}
        </ol>
      )

    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-800/50">
                {block.headers.map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 text-zinc-300 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-zinc-800/50 hover:bg-zinc-800/20">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-3 py-2 ${ci === 0 ? 'text-zinc-300 font-medium' : 'text-zinc-500'}`}>
                      <CellContent text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'keyvalue':
      return (
        <div className="space-y-2">
          {block.items.map((item, i) => (
            <div key={i} className="rounded-lg bg-zinc-800/30 px-4 py-3">
              <span className="text-xs font-semibold text-violet-300">{item.key}</span>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed whitespace-pre-line">{item.value}</p>
            </div>
          ))}
        </div>
      )

    case 'divider':
      return <hr className="border-zinc-800" />

    default:
      return <></>
  }
}
