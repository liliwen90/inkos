import { useState } from 'react'
import {
  BookOpen, ChevronDown, ChevronRight, Feather, PenTool, ScrollText,
  Settings, Download, BarChart3, ShieldAlert, Sparkles, Lightbulb,
  FolderOpen, Plus, Play, Eye, CheckCircle2, Copy, Upload,
  LayoutDashboard, Zap, HelpCircle, AlertTriangle, ArrowRight, Info, Route, Globe
} from 'lucide-react'

// ===== 教程数据结构 =====

interface TutorialSection {
  id: string
  icon: React.ReactNode
  title: string
  badge?: string
  content: TutorialBlock[]
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
  // ─── 1. 快速开始 ───
  {
    id: 'quickstart',
    icon: <Zap className="w-4 h-4" />,
    title: '快速开始',
    badge: '必读',
    content: [
      { type: 'text', content: 'InkOS Studio 是一个多 Agent 协作的 AI 小说生产系统。四个 AI Agent（建筑师、写手、审计员、修订者）接力完成小说的创作、质量审核与自动修订，你只需要动动鼠标。' },
      { type: 'heading', content: '从零开始写第一章' },
      { type: 'steps', items: [
        '打开项目 — 点击左下角「打开项目」按钮，选择一个空文件夹（系统会自动初始化为 InkOS 项目），或选择已有的 inkos.json 所在目录。',
        '配置 LLM — 进入左侧「LLM 配置」页面，填写 API 地址、密钥和模型名称，点击「测试连接」确认可用，然后点击「初始化管线」。',
        '创建书籍 — 回到「仪表盘」，点击右上角「创建书籍」，填写书名、选择题材和平台，设置每章字数和目标章数，可选填创作指导。',
        '开始写作 — 进入「写作控制台」，选择刚创建的书籍，设置字数和连续写章数，点击「写下一章」。系统会依次经过：建筑师规划 → 写手创作 → 审计员审查 → 修订者修复，全自动完成。',
        '查看成果 — 在「章节管理」中查看生成的章节内容、审计问题，并执行通过/驳回审阅。'
      ]},
      { type: 'tip', content: '每一章完成后，系统会自动更新 10 个「真相文件」（世界状态、角色关系、伏笔、资源等），确保后续章节的连续性。' },
    ]
  },

  // ─── 2. 项目管理 ───
  {
    id: 'project',
    icon: <FolderOpen className="w-4 h-4" />,
    title: '项目管理',
    content: [
      { type: 'heading', content: '什么是 InkOS 项目' },
      { type: 'text', content: '一个 InkOS 项目就是一个文件夹，其中包含 inkos.json 配置文件。一个项目下可以有多本书，每本书有独立的章节、真相文件和规则。' },
      { type: 'heading', content: '项目结构' },
      { type: 'table', headers: ['路径', '说明'], rows: [
        ['inkos.json', '项目配置文件（项目名称等）'],
        ['.env', '项目级环境变量（LLM API 密钥等）'],
        ['books/{书籍ID}/', '每本书的独立目录'],
        ['books/{书籍ID}/book.json', '书籍配置（题材/平台/字数等）'],
        ['books/{书籍ID}/chapters/', '章节文件（0001_xxx.md 格式）'],
        ['books/{书籍ID}/story/', '10 个真相文件 + 快照'],
      ]},
      { type: 'heading', content: '打开 / 初始化项目' },
      { type: 'steps', items: [
        '点击左下角「打开项目」或仪表盘欢迎页的「打开 InkOS 项目」按钮。',
        '如果选择的目录已包含 inkos.json，将直接加载。',
        '如果选择的是空目录，系统会询问是否初始化为新项目，并要求输入项目名称。',
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
      { type: 'text', content: 'LLM（大语言模型）是整个系统的大脑。所有 Agent 的规划、创作、审计、修订都依赖 LLM API 调用。配置正确的 LLM 连接是使用 InkOS Studio 的前提。' },
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
        '填写上述各项配置。',
        '点击「保存」保存配置到项目。',
        '点击「测试连接」验证 API 是否可用（会显示响应延迟）。',
        '点击「初始化管线」创建 LLM 客户端并启动 PipelineRunner。左侧状态指示灯变绿表示管线就绪。',
      ]},
      { type: 'warning', content: '每次打开项目后都需要点击「初始化管线」才能使用写作和创建书籍功能。这是因为 LLM 客户端需要在内存中创建。' },
      { type: 'heading', content: '推荐模型' },
      { type: 'table', headers: ['模型', '适用场景', '成本参考'], rows: [
        ['deepseek-chat', '性价比之王，中文写作质量好', '约 ¥1-2/万字'],
        ['gpt-4o', '综合能力强', '约 ¥5-10/万字'],
        ['claude-sonnet-4-20250514', '文学性强，长文连贯', '约 ¥8-15/万字'],
        ['qwen-max', '通义千问，中文理解好', '约 ¥2-5/万字'],
      ]},
      { type: 'tip', content: '写一章 3000 字的小说，通常需要 4-6 次 LLM 调用（建筑师 + 写手 + 审计 + 可能的修订），消耗约 2-5 万 token。使用 deepseek-chat 大约花费 ¥0.3-0.5/章。' },
    ]
  },

  // ─── 3.5 任务路由 ───
  {
    id: 'task-routing',
    icon: <Route className="w-4 h-4" />,
    title: '任务路由（多模型协作）',
    badge: '高级',
    content: [
      { type: 'text', content: 'InkOS 的写作管线包含多个 Agent（建筑师、写手、审计员、修订者），各自擅长不同任务。任务路由功能允许你为每个 Agent 分配不同的 LLM 模型，实现成本和质量的最优配比。' },
      { type: 'heading', content: '为什么要用任务路由？' },
      { type: 'keyvalue', items: [
        { key: '省钱', value: '写手 Agent 调用量最大，用便宜的 DeepSeek 就够了；审计和修订对理解力要求高，用 Claude/Gemini 效果更好。' },
        { key: '扬长避短', value: '不同模型各有所长：DeepSeek 中文流畅、Gemini 分析能力强、Claude 文学性好。让它们各司其职。' },
        { key: '灵活切换', value: '随时调整某个 Agent 的模型，无需重新配置整个管线。' },
      ]},
      { type: 'heading', content: '配置方法' },
      { type: 'steps', items: [
        '在 LLM 配置页面，先配好「默认模型」——这是所有未单独配置的 Agent 的兜底方案。',
        '打开「任务路由（多模型协作）」开关。',
        '为需要单独配置的 Agent 开启开关，填入模型名称。',
        'API Key 和 Base URL 留空表示继承默认配置（适合同一中转站多 Key 的场景）。',
        '点击「初始化管线」，系统会自动为每个模型创建独立的 LLM 客户端并按路由表分发请求。',
      ]},
      { type: 'heading', content: '推荐搭配' },
      { type: 'table', headers: ['Agent', '推荐模型', '理由'], rows: [
        ['🏗️ 建筑师', 'deepseek-chat', '规划大纲对创意要求高但 token 量适中，DeepSeek 性价比最优'],
        ['✍️ 写手', '默认模型', '写手是 token 消耗大户，用最便宜的模型控制成本'],
        ['🔍 审计员', 'gemini-2.5-flash', '26 维度分析需要强推理能力，Gemini Flash 快速且准确'],
        ['✏️ 修订者', 'claude-sonnet-4', '修订需要理解上下文并保持文学性，Claude 表现最佳'],
      ]},
      { type: 'tip', content: '可以点击「✨ 一键填入推荐配置」快速设置。路由配置保存在项目的 task-routing.json 中，不同项目可以有不同的路由策略。' },
      { type: 'warning', content: '任务路由完全在 Adapter 层实现，不修改 InkOS Core。上游版本更新时路由功能不受影响。' },
    ]
  },

  // ─── 4. 仪表盘 & 书籍 ───
  {
    id: 'dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    title: '仪表盘 & 创建书籍',
    content: [
      { type: 'text', content: '仪表盘是你的主控台，展示当前项目下所有书籍的状态总览。' },
      { type: 'heading', content: '创建书籍' },
      { type: 'text', content: '点击右上角「创建书籍」按钮打开创建对话框。' },
      { type: 'keyvalue', items: [
        { key: '书名', value: '必填。建议取一个有记忆点的名字，建筑师 Agent 会基于书名进行初始规划。' },
        { key: '题材', value: '5 种内置题材，每种自带完整的创作规则体系：\n• 玄幻 — 数值系统、战力体系、升级节奏\n• 仙侠 — 修炼/悟道、法宝体系、天道规则\n• 都市 — 年代考据、商战社交、无数值系统\n• 恐怖 — 氛围递进、恐惧层级、克制叙事\n• 通用 — 最小化规则，适合自定义' },
        { key: '平台', value: '目标发布平台（番茄/起点/飞卢/其他），影响建筑师对选题和节奏的判断。' },
        { key: '目标章数', value: '计划写多少章，仅作参考。' },
        { key: '每章字数', value: '每章的目标字数，推荐 3000-5000 字。' },
        { key: '创作指导', value: '可选。你可以在这里描述故事方向、主角人设、世界观大纲等。建筑师 Agent 会参考这些信息生成初始规划。' },
      ]},
      { type: 'tip', content: '创建书籍时，建筑师 Agent 会自动生成世界观设定（story_bible.md）、卷纲（volume_outline.md）、本书规则（book_rules.md）等真相文件。这个过程需要几分钟。' },
      { type: 'heading', content: '书籍卡片' },
      { type: 'text', content: '每本书以卡片形式展示，显示题材标签、平台标签、章节数、总字数和状态（active/completed/paused）。点击卡片跳转到写作控制台。' },
    ]
  },

  // ─── 5. 写作控制台 ───
  {
    id: 'writing',
    icon: <PenTool className="w-4 h-4" />,
    title: '写作控制台',
    badge: '核心',
    content: [
      { type: 'text', content: '写作控制台是 InkOS Studio 的核心页面。一键驱动「写→审→改」完整管线。' },
      { type: 'heading', content: '操作步骤' },
      { type: 'steps', items: [
        '从顶部下拉菜单选择要写作的书籍。',
        '设置「每章字数」（推荐 3000-5000）。',
        '设置「连续写」章数（1-50 章，系统会自动逐章完成）。',
        '点击「写下一章」按钮启动管线。',
      ]},
      { type: 'heading', content: '管线 5 阶段' },
      { type: 'text', content: '每一章的创作经过 5 个阶段，顶部进度条会实时显示当前所在阶段：' },
      { type: 'table', headers: ['阶段', 'Agent', '说明'], rows: [
        ['1. 管线启动', '—', '加载书籍配置、真相文件、连续性上下文'],
        ['2. 建筑师', 'Architect', '规划本章大纲：场景节拍、节奏控制、关键事件'],
        ['3. 写手', 'Writer', '根据大纲 + 世界状态 + 规则生成正文'],
        ['4. 审计', 'Auditor', '26 维度审查：OOC、时间线、设定冲突、AI 痕迹等'],
        ['5. 修订', 'Reviser', '修复审计发现的问题（仅在有关键问题时触发）'],
      ]},
      { type: 'tip', content: '如果审计发现关键问题（critical），管线会自动进入「修订→再审计」循环，直到所有关键问题清零。你不需要手动干预。' },
      { type: 'heading', content: '进度日志' },
      { type: 'text', content: '页面下方的进度日志实时显示每个阶段的详细信息，包括时间戳、状态（运行中/完成/错误）和具体描述。' },
      { type: 'heading', content: '写作完成后' },
      { type: 'text', content: '写作完成后，系统自动更新 10 个真相文件（世界状态、资源账本、伏笔池等），生成章节摘要，保存快照。你可以在「章节管理」中查看和审阅新章节。' },
      { type: 'warning', content: '写作过程中请勿关闭软件或切换项目，否则可能导致数据不一致。连续写多章时每章之间会自动衔接。' },
    ]
  },

  // ─── 6. 章节管理 ───
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
      { type: 'tip', content: '通常建筑师+写手+审计员已经处理了大部分问题，review 状态的章节质量一般可靠。建议重点关注审计问题列表中标记为「critical」的条目。' },
    ]
  },

  // ─── 7. 真相文件 ───
  {
    id: 'truth',
    icon: <ScrollText className="w-4 h-4" />,
    title: '真相文件系统',
    content: [
      { type: 'text', content: '真相文件是 InkOS 的核心创新。它们是小说世界的唯一事实来源，每章写完后自动更新，确保长篇小说的连续性。' },
      { type: 'heading', content: '10 个真相文件' },
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
      ]},
      { type: 'heading', content: '如何使用' },
      { type: 'text', content: '在「真相文件」页面选择书籍后，左侧列出 10 个文件标签，点击即可查看内容。内容为 Markdown 格式，只读展示。' },
      { type: 'tip', content: '真相文件由系统自动维护，你通常不需要手动编辑。但如果发现信息错误，可以在项目目录的 books/{书籍ID}/story/ 下直接编辑对应的 .md 文件。' },
      { type: 'heading', content: '快照与回滚' },
      { type: 'text', content: '每完成一章，系统会自动对当前真相文件做快照（保存在 story/snapshots/{章节号}/ 下）。如果需要重写某一章，系统会自动回滚世界状态到该章之前的快照，避免数据污染。' },
    ]
  },

  // ─── 8. 26 维度审计 ───
  {
    id: 'audit',
    icon: <CheckCircle2 className="w-4 h-4" />,
    title: '26 维度审计系统',
    content: [
      { type: 'text', content: 'InkOS 独有的 26 维度审计系统，由连续性审计员 Agent 在每章写完后自动执行。这是保证长篇小说质量的关键。' },
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
        ['套话密度*', 'AI 特征：是否充斥常见AI套话'],
        ['公式化转折*', 'AI 特征：转折是否套路化'],
        ['列表式结构*', 'AI 特征：是否用列表铺陈'],
        ['支线停滞', '支线是否长期未推进'],
        ['弧线平坦', '角色成长弧线是否太平'],
        ['节奏单调', '全篇节奏是否缺乏变化'],
      ]},
      { type: 'tip', content: '带 * 的 4 个维度（dim 20-23）由纯规则引擎检测，不消耗 LLM 调用。不同题材启用不同的子集：玄幻/仙侠 26 维度、都市 24 维度、恐怖 22 维度。' },
    ]
  },

  // ─── 9. 题材规则体系 ───
  {
    id: 'genre',
    icon: <BookOpen className="w-4 h-4" />,
    title: '题材 & 规则体系',
    content: [
      { type: 'text', content: 'InkOS 内置 5 种题材，每种自带完整的创作规则。规则体系分三层：通用规则 → 题材规则 → 单本书规则。' },
      { type: 'heading', content: '三层规则体系' },
      { type: 'table', headers: ['层级', '范围', '示例'], rows: [
        ['通用规则 (~25条)', '所有题材都执行', '人物塑造、叙事技法、逻辑自洽、去AI味'],
        ['题材规则', '特定题材执行', '玄幻：数值系统+战力体系；都市：年代考据；恐怖：氛围递进'],
        ['本书规则 (book_rules.md)', '单本书独有', '主角人设锁定、数值上限、自定义禁令、疲劳词覆盖'],
      ]},
      { type: 'heading', content: '题材专属语言铁律示例' },
      { type: 'keyvalue', items: [
        { key: '玄幻', value: '✗ "火元从12缕增加到24缕" → ✓ "手臂比先前有力了，握拳时指骨发紧"' },
        { key: '都市', value: '✗ "迅速分析了当前的债务状况" → ✓ "把那叠皱巴巴的白条翻了三遍"' },
        { key: '恐怖', value: '✗ "感到一阵恐惧" → ✓ "后颈的汗毛一根根立起来"' },
      ]},
      { type: 'heading', content: '去 AI 味' },
      { type: 'text', content: '系统多管齐下降低 AI 文本特征：' },
      { type: 'steps', items: [
        'AI 标记词限频：仿佛/忽然/竟然/不禁/宛如/猛地，每 3000 字 ≤ 1 次。',
        '叙述者不替读者下结论，只写动作。',
        '禁止分析报告式语言（"核心动机""信息落差"不入正文）。',
        '同一意象渲染不超过两轮。',
        '词汇疲劳审计 + AI 痕迹审计（dim 20-23）双重检测。',
        '文风指纹注入进一步降低 AI 文本特征。',
      ]},
      { type: 'tip', content: '创建书籍后可以在项目目录手动编辑 books/{书籍ID}/story/book_rules.md，添加自定义禁令、锁定主角人设等。改完下次写章自动生效。' },
    ]
  },

  // ─── 10. 风格分析 ───
  {
    id: 'style',
    icon: <BarChart3 className="w-4 h-4" />,
    title: '风格分析',
    content: [
      { type: 'text', content: '通过分析参考文本（你喜欢的作者/作品片段），提取文风指纹注入写手 Agent，让 AI 模仿特定写作风格。' },
      { type: 'heading', content: '使用流程' },
      { type: 'steps', items: [
        '点击「导入参考书」按钮，选择 .txt 格式的参考文本文件。建议选择你想模仿的作者的作品片段（5000 字以上效果更好）。',
        '导入成功后会显示在参考书列表中。',
        '点击「文本统计」按钮，系统会分析文本的基础统计特征：平均句长、段长范围、词汇多样性（TTR）、高频句式、修辞手法等。',
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
      { type: 'tip', content: '风格指纹注入强度建议 5-7。太高可能导致生硬模仿，太低则效果不明显。建议导入 1-3 本参考书，系统会综合分析。' },
    ]
  },

  // ─── 11. AIGC 检测 ───
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
      ]},
      { type: 'heading', content: 'AI 痕迹 4 维指标' },
      { type: 'table', headers: ['指标', '说明', '低分更好'], rows: [
        ['段落均匀度', '段落字数是否过于平均（AI 典型特征）', '✓'],
        ['对冲词密度', '使用"然而""不过""但是"等转折词的频率', '✓'],
        ['公式化过渡', '段落过渡是否套路化', '✓'],
        ['列表结构', '是否存在列表式铺陈（AI 爱用1、2、3）', '✓'],
      ]},
      { type: 'text', content: '综合评分 0-10 分，分数越低越好。低于 3 分基本看不出 AI 痕迹。' },
      { type: 'heading', content: '敏感词扫描' },
      { type: 'text', content: '系统内置多类敏感词库，扫描结果会展示每个命中词、所属类别和出现次数。常见于网文发布平台的审核需求。' },
      { type: 'heading', content: '风险等级' },
      { type: 'keyvalue', items: [
        { key: '🟢 低风险', value: 'AI 痕迹评分 < 3，敏感词 0-2 个' },
        { key: '🟡 中风险', value: 'AI 痕迹评分 3-6，或敏感词 3-5 个' },
        { key: '🔴 高风险', value: 'AI 痕迹评分 > 6，或敏感词 > 5 个' },
      ]},
      { type: 'tip', content: '如果某章检测分数偏高，可配合「人性化引擎」的风格设定和风格指纹注入来降低 AI 痕迹。系统的审计阶段也会自动检测 AI 痕迹（dim 20-23）。' },
    ]
  },

  // ─── 12. 人性化引擎 ───
  {
    id: 'humanize',
    icon: <Sparkles className="w-4 h-4" />,
    title: '人性化引擎',
    content: [
      { type: 'text', content: '人性化引擎通过精细的风格配置，让 AI 写出更有「人味」的文字。配置的所有参数会作为额外指令注入写手 Agent 的 prompt。' },
      { type: 'heading', content: '风格设定（8 维调节）' },
      { type: 'table', headers: ['维度', '选项', '说明'], rows: [
        ['视角', '第一人称 / 第三有限 / 第三全知', '叙事角度'],
        ['时态', '过去 / 现在', '叙事时态'],
        ['节奏', '快 / 均衡 / 慢', '情节推进速度'],
        ['基调', '中性/紧张/温馨/黑暗/幽默/史诗', '整体情绪氛围'],
        ['展示vs叙述', '低 / 中 / 高', '高=更多场景展示，少旁白解说'],
        ['对话风格', '正式 / 自然 / 口语化', '角色说话方式'],
        ['描写密度', '简洁 / 适中 / 丰富', '环境和细节描写量'],
        ['创意度', '1-10 滑块', '影响温度和遣词造句的大胆程度'],
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
      { type: 'text', content: '可以为特定章节预设场景节拍序列，精确控制该章发生的事件节奏。每个节拍是一句简短描述。例如：' },
      { type: 'steps', items: [
        '林烬在废墟中醒来，伤势严重',
        '发现身边有一本古书，翻开后触发传承',
        '传承带来剧痛，同时获得第一缕火元力',
        '外面传来打斗声，必须决定躲还是闯',
      ]},
      { type: 'heading', content: 'Prompt 预览' },
      { type: 'text', content: '「Prompt 预览」标签可以查看所有人性化设定最终会被组装成什么样的指令文本注入给写手 Agent，便于调试。' },
      { type: 'tip', content: '声音卡片对提升台词质量效果显著，建议至少为 3-5 个核心角色创建声音卡片。场景节拍适合关键章节（高潮/转折）使用，日常章节可以不设。' },
    ]
  },

  // ─── 13. AI 建议 ───
  {
    id: 'suggestions',
    icon: <Lightbulb className="w-4 h-4" />,
    title: 'AI 创作建议',
    content: [
      { type: 'text', content: 'AI 建议系统可以基于你的风格参考书和书籍设定，自动生成完整的创作方案。' },
      { type: 'heading', content: '生成的建议类型' },
      { type: 'table', headers: ['类型', '内容', '用途'], rows: [
        ['💡 故事创意', '多个故事方向标题 + 简介', '选题参考'],
        ['🎭 作者角色', '为你定义一个作者人格', '统一写作风格'],
        ['📏 创作规则', '一组写作纪律', '注入 prompt 约束质量'],
        ['🗣️ 声音卡片', '核心角色的说话风格建议', '直接填入人性化引擎'],
        ['🎬 场景节拍', '节拍模板', '直接填入人性化引擎'],
        ['📈 故事弧线', '分阶段规划（名称/章节范围/目标）', '全局节奏参考'],
      ]},
      { type: 'heading', content: '使用方法' },
      { type: 'steps', items: [
        '确保已在 LLM 配置页初始化管线。',
        '点击「生成建议」按钮，等待 AI 分析（可能需要 1-2 分钟）。',
        '展开各建议模块查看内容。',
        '点击复制按钮将建议内容复制到剪贴板，自行粘贴到对应功能中。',
      ]},
      { type: 'tip', content: '建议在创建书籍之前先导入一些参考书到「风格分析」，然后生成 AI 建议。这样 AI 会综合参考你的风格偏好给出更贴合的建议。' },
    ]
  },

  // ─── 14. 导出 ───
  {
    id: 'export',
    icon: <Download className="w-4 h-4" />,
    title: '导出',
    content: [
      { type: 'text', content: '将已完成的章节导出为单个文件，方便发布或本地备份。' },
      { type: 'heading', content: '支持格式' },
      { type: 'keyvalue', items: [
        { key: 'Markdown (.md)', value: '保留标题格式和段落结构，适合进一步编辑或转换。' },
        { key: '纯文本 (.txt)', value: '去除所有格式标记，适合直接粘贴到网文平台。' },
      ]},
      { type: 'heading', content: '导出流程' },
      { type: 'steps', items: [
        '在「导出」页面选择书籍。',
        '点击 Markdown 或纯文本卡片按钮。',
        '导出成功后会显示输出文件路径。',
      ]},
      { type: 'tip', content: '导出的文件会保存在项目目录的 books/{书籍ID}/ 下。也可以在「章节管理」页面一键导出。' },
    ]
  },

  // ─── 15. 发布平台 ───
  {
    id: 'platforms',
    icon: <Globe className="w-4 h-4" />,
    title: '发布平台',
    badge: '英文供稿',
    content: [
      { type: 'text', content: '使用 InkOS 生成英文小说后，推荐按以下路线发布到海外平台变现。核心策略是「三段火箭」：Royal Road 养粉 → Patreon 提前章节变现 → Amazon KDP 打包出书。' },

      { type: 'heading', content: '平台总览' },
      { type: 'table', headers: ['平台', '定位', 'AI 政策', '变现方式', '优先级'],
        rows: [
          ['Royal Road', '西方网文第一站 (LitRPG/Progression)', '✅ 允许，需打 AI-Generated 标签', '读者打赏 + Stub→KDP + Patreon 提前章', '⭐⭐⭐ 首发'],
          ['Amazon KDP', '全球最大电子书市场', '✅ 允许，需声明', '70% 版税 ($2.99-$9.99) + KU 页读', '⭐⭐⭐ 变现'],
          ['Patreon', '创作者订阅平台', '✅ 无限制', '月订阅分级，平台抽 8-12%', '⭐⭐⭐ 加速'],
          ['ScribbleHub', 'ACG/日系向英文轻小说站', '✅ 建议标注', '无站内变现，引流到 Patreon', '⭐⭐ 同步'],
          ['Kindle Vella', '亚马逊连载小说', '✅ 允许', '50% Token 收入', '❌ 仅限美国居民'],
          ['Webnovel', '阅文国际站', '⚠️ 模糊，签约可能拒', '解锁章节分成 50-50', '⭐ 观望，版权风险'],
        ]
      },

      { type: 'divider' },
      { type: 'heading', content: 'Royal Road 发布流程' },
      { type: 'steps', items: [
        '注册：royalroad.com → Create an account（邮箱+用户名+密码，无国籍限制）。',
        '发布：Author Dashboard → Add New → 填写标题/简介(≥50字)/封面(400x600px)/Genre/Tags → 附带第一章内容 → 提交。',
        '审核：人工审核 12-24 小时，检查抄袭/标签合规/AI 标注。约 10% 投稿被拒（主要是抄袭/标签问题）。',
        'AI 标注：AI 生成内容必须打「AI-Generated」标签。RR 明确不因 AI 标签歧视排名，但要求质量过关。',
        '如果在其他平台也发过同一作品，需在源站描述加一行 "I will be posting this on RoyalRoad" 做所有权验证。',
        '审核通过后持续上传新章节，无需再审。建议每周更新 3-5 章保持活跃。',
      ]},
      { type: 'tip', content: '可选升级 Author Premium ($59.99/年)：详细数据分析、EPUB 导出、章节导入、自动草稿保存等功能。' },

      { type: 'divider' },
      { type: 'heading', content: 'Royal Road 变现三条路' },
      { type: 'keyvalue', items: [
        { key: '读者打赏 (Reader Support)', value: '读者通过 BlueSnap 打赏。作者需注册 Tipalti 账户接收付款（需税表 W-8BEN）。每月发放，最低起付约 $25-50。支持 PayPal / 银行转账。' },
        { key: 'Stub + Amazon KDP', value: '前 50-80 章在 RR 免费连载养粉 → 打包成 Volume 1 上 Kindle → 删除 RR 对应章节（称为 Stub）。这是 RR 顶流作者的主要收入来源。' },
        { key: 'Patreon 提前章节', value: '在 RR 免费连载 → Patreon 上提前 10-20 章。读者为「抢先看」付费。经典联动模式，头部作者月入 $5,000-$20,000+。' },
      ]},

      { type: 'divider' },
      { type: 'heading', content: 'Amazon KDP 发布流程' },
      { type: 'steps', items: [
        '注册：kdp.amazon.com → 需要 Amazon 账户 + 真实姓名地址 + 税务信息（W-8BEN for 非美国人）+ 银行账户。',
        '创建电子书：填写语言(English)/书名/作者(笔名)/简介/7个关键词/2个分类 → 上传封面(2560x1600px) → 上传正文(EPUB 或 .docx)。',
        '定价：$2.99-$9.99 享 70% 版税（建议 Volume 1 定 $4.99）。其他价位 35% 版税。',
        'KDP Select (可选)：加入 Kindle Unlimited → 获得 KU 页读分成（约 $0.004-0.005/页）。但该书只能在 Amazon 独家销售。',
        '审核：自动审核，通常 72 小时内上架。',
      ]},
      { type: 'tip', content: 'KDP 提现：每月自动打款（月结后 60 天），最低 $100。支持银行电汇到中国银行账户。中美税收协定可将预扣税从 30% 降至 10%。' },

      { type: 'divider' },
      { type: 'heading', content: 'Patreon 设置' },
      { type: 'steps', items: [
        '注册：patreon.com → Create on Patreon → 创建 Creator 页面。',
        '设置层级：$3/月（提前5章）、$5/月（提前10章+作者笔记）、$10/月（提前20章+大纲投票+Discord VIP）。',
        '连接 Stripe 或 PayPal 收款。即时生效无审核。',
        '平台抽成 8-12% + 支付处理费 ~3%，实际到手约 85-88%。',
        '最低提现 $1。每月初自动打款到 Stripe/PayPal → 银行账户。',
      ]},

      { type: 'divider' },
      { type: 'heading', content: '三段火箭执行策略' },
      { type: 'table', headers: ['阶段', '时间', '动作', '预期收入'],
        rows: [
          ['蓄力期', '第 1-3 个月', 'InkOS 生产 → RR + ScribbleHub 同步发，每周 3-5 章', '$0'],
          ['引爆期', '第 4-8 个月', 'RR 500+ follower → 开 Patreon 提前章 + Vol.1 上 KDP Stub', '$100-500/月'],
          ['规模化', '第 9 个月+', '多书并行批量走管线，累积 KU 被动收入', '$500-3,000+/月'],
        ]
      },

      { type: 'divider' },
      { type: 'heading', content: '提现方式详解（中国公民）' },
      { type: 'table', headers: ['平台', '提现方式', '最低金额', '到账周期', '手续费'],
        rows: [
          ['Royal Road', 'PayPal / 银行电汇 / eCheck（经 Tipalti）', '$25-50', '每月发放（次月月底）', 'PayPal ≈2.5%；电汇约 $15-25/笔；eCheck 免费'],
          ['Amazon KDP', '银行电汇 (EFT) / 电汇 (Wire) / 支票', '$100', '月结后 60 天（例如 1 月收入 → 3 月底到账）', 'EFT 免费；Wire $15/笔；支票邮寄慢且不推荐'],
          ['Patreon', 'PayPal / Payoneer / Stripe 直连银行', '$1 (PayPal) / $25 (Payoneer)', '每月初自动打款（当月 1-5 日处理）', 'PayPal ≈2.5%；Payoneer ≈2%；Stripe 视地区'],
        ]
      },
      { type: 'keyvalue', items: [
        { key: 'Royal Road (Tipalti)', value: '注册 Reader Support 后，RR 邀请你注册 Tipalti 账户。在 Tipalti 中选择付款方式：① PayPal（填 PayPal 邮箱，最常用）；② 银行电汇/Wire（填 SWIFT 代码 + 银行账号，适合大额 $500+）；③ eCheck（仅美国银行）。中国作者推荐 PayPal。' },
        { key: 'Amazon KDP', value: '在 KDP 后台 → 账户设置 → 付款方式中添加。① EFT 银行转账（推荐）：填中国银行的 SWIFT Code + 银行账号，KDP 直接汇到你的人民币/美元账户，免手续费，速度最快（3-5 工作日）。② Wire 国际电汇：$15/笔手续费，适合无 EFT 的地区。③ 支票：邮寄实体支票，慢数周，不推荐。注：中国地区支持 EFT。' },
        { key: 'Patreon', value: '在 Creator 设置 → Payouts 中选择。① PayPal（推荐，最简单）：绑定 PayPal 账户，$1 起提，到 PayPal 后再提到银行卡。② Payoneer：注册 Payoneer 账户绑定，$25 起提，支持提到中国银行卡（人民币到账）。③ Stripe 直连：部分国家可直连银行账户（中国暂不直接支持 Stripe 连接，用 PayPal/Payoneer）。' },
        { key: '中国作者最优路线', value: 'RR 用 PayPal 收 → KDP 用 EFT 电汇到中国银行卡 → Patreon 用 PayPal 或 Payoneer 收。PayPal 余额可绑中国银行卡提现（手续费 ≈35 元/笔），Payoneer 可直接提到中国银行卡（费率 ≈1.2%）。' },
      ]},
      { type: 'warning', content: '注意：所有平台收入均需在中国按「稿酬所得」申报个税。PayPal / Payoneer 提现到境内银行账户时，银行可能要求提供收入来源证明（平台 earning report 截图即可）。单笔超 $5,000 需要向外管局申报。' },

      { type: 'divider' },
      { type: 'heading', content: '税务备忘（中国公民）' },
      { type: 'keyvalue', items: [
        { key: 'W-8BEN', value: '非美国人税务身份声明表，在各平台税务面谈中在线填写。填 Foreign TIN（中国身份证号）。' },
        { key: 'KDP 预扣税', value: '有中美税收协定，版税预扣从 30% 降至 10%。' },
        { key: 'Patreon 预扣税', value: '按服务收入算，预扣可能为 0%。' },
        { key: '中国端报税', value: '按「稿酬所得」申报。建议正规申报。' },
      ]},

      { type: 'divider' },
      { type: 'heading', content: 'InkOS 已就绪 vs 待补齐' },
      { type: 'table', headers: ['能力', '状态', '说明'],
        rows: [
          ['英文题材 (litrpg / system-apocalypse)', '✅', '已配置完整 genre 文件'],
          ['英文 writer-prompts 双语', '✅', '14个函数通过 isEnglish() 切换'],
          ['英文 26 维审计', '✅', 'continuity.ts EN 维度映射'],
          ['英文 AIGC 检测', '✅', 'ai-tells.ts EN 词表 + 分句规则'],
          ['英文修订器 5 模式', '✅', 'reviser.ts EN 模式描述'],
          ['导出 EPUB (KDP 上传需要)', '✅', 'EPUB3 + NCX 目录，导出页可用'],
          ['封面模板', '✅', '8 款模板，1600×2560px，导出页可用'],
          ['批量 KDP 格式化', '✅', '章节编号/扉页/版权页/目录自动生成'],
        ]
      },
      { type: 'warning', content: 'Royal Road 要求 AI 生成的内容必须打标签且保证质量。InkOS 的 26 维审计 + AIGC 检测 + 5 模式修订就是为此设计的，但你仍需人工通读确认质量，低质量 AI 内容会被举报删除。' },
    ]
  },

  // ─── 16. 常见问题 ───
  {
    id: 'faq',
    icon: <HelpCircle className="w-4 h-4" />,
    title: '常见问题',
    content: [
      { type: 'heading', content: '管线状态一直显示"未连接"' },
      { type: 'text', content: '每次打开软件后需要手动前往「LLM 配置」页面点击「初始化管线」。这是设计决策——避免启动时自动消耗 API 额度。确认配置正确后点击初始化即可。' },
      { type: 'divider' },
      { type: 'heading', content: '创建书籍按钮是灰色的' },
      { type: 'text', content: '需要先初始化管线。确认左侧状态指示灯为绿色（管线就绪）后，创建按钮才可用。' },
      { type: 'divider' },
      { type: 'heading', content: '写作过程中报错了怎么办' },
      { type: 'text', content: '最常见的原因是 API 调用失败（网络问题/额度用尽/模型不可用）。查看进度日志中的错误信息，解决 API 问题后重新点击写作即可。已经写成功的章节不会丢失。' },
      { type: 'divider' },
      { type: 'heading', content: '能不能手动编辑章节内容' },
      { type: 'text', content: '可以。章节文件保存在 books/{书籍ID}/chapters/ 目录下，格式为 Markdown（如 0001_第一章.md）。用任何文本编辑器打开即可修改。修改后在 Studio 中刷新列表即可看到最新内容。' },
      { type: 'divider' },
      { type: 'heading', content: '一章大概要花多少钱' },
      { type: 'text', content: '取决于模型和每章字数。以 deepseek-chat 写 3000 字/章为例，一章约 ¥0.3-0.5（含建筑师+写手+审计+可能的修订，总共 4-6 次 LLM 调用）。使用 GPT-4o 约 ¥2-5/章。批量连续写时成本更可预测。' },
      { type: 'divider' },
      { type: 'heading', content: '支持哪些 LLM 模型' },
      { type: 'text', content: '支持所有 OpenAI 兼容接口（OpenAI、DeepSeek、通义千问、月之暗面、智谱、零一万物、硅基流动等）和 Anthropic 原生接口（Claude 系列）。本地模型（如 Ollama）只要提供兼容 API 也可使用，但写作质量取决于模型能力。' },
      { type: 'divider' },
      { type: 'heading', content: '真相文件内容出错了怎么办' },
      { type: 'text', content: '直接在项目目录 books/{书籍ID}/story/ 下编辑对应的 .md 文件即可。改完后下一章写作会使用更新后的内容。此外，每章都有快照（story/snapshots/），如需回到某章之前的状态，可以手动恢复。' },
      { type: 'divider' },
      { type: 'heading', content: '能同时写多本书吗' },
      { type: 'text', content: '可以。一个项目下可以创建多本书，每本有独立的章节、真相文件和规则。在写作控制台顶部下拉菜单切换书籍即可。但不建议同时对多本书并发写作（一次只能一本在跑管线）。' },
      { type: 'divider' },
      { type: 'heading', content: '如何提升写作质量' },
      { type: 'steps', items: [
        '选择更强的模型（如 claude-sonnet-4-20250514 文学性最好）。',
        '填写详细的创作指导（创建书籍时）。',
        '导入风格参考书 → 启用风格指纹注入。',
        '创建核心角色的声音卡片。',
        '适当调高温度（0.8-1.0）增加创意。',
        '手动编辑 book_rules.md 添加更具体的人设和禁令。',
      ]},
    ]
  },
]

// ===== 教程页面组件 =====

export default function Tutorial(): JSX.Element {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['quickstart']))

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
            从零开始掌握 InkOS Studio 的全部功能
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
                  {section.content.map((block, i) => (
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
          InkOS Studio v0.1.0 · 基于 InkOS v0.3.6 · MIT License
        </p>
      </div>
    </div>
  )
}

// ===== Block 渲染器 =====

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
                      {cell}
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
