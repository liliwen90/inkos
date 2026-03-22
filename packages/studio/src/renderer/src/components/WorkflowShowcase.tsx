import { useState, useRef, useEffect, useCallback } from 'react'
import {
  TrendingUp, Archive, BarChart3, Lightbulb, Sparkles,
  PenTool, BookOpen, ScrollText, ShieldAlert, Download,
  ChevronRight, Zap, User, Info
} from 'lucide-react'

/* ══════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════ */

interface FlowModule {
  id: string
  stageIdx: number
  icon: React.ReactNode
  name: string
  tagline: string
  detail: string
}

interface StageInfo {
  label: string
  emoji: string
  hex: string
  textColor: string
  gradient: string
  border: string
}

interface ConnPath {
  key: string
  d: string
  sameStage: boolean
  fromHex: string
  toHex: string
}

/* ══════════════════════════════════════════════
   Data — Pipeline
   ══════════════════════════════════════════════ */

const STAGES: StageInfo[] = [
  { label: '选题', emoji: '📊', hex: '#38bdf8', textColor: 'text-sky-400', gradient: 'from-sky-600/20 to-sky-900/10', border: 'border-sky-500/30' },
  { label: '配置', emoji: '⚙️', hex: '#a78bfa', textColor: 'text-violet-400', gradient: 'from-violet-600/20 to-violet-900/10', border: 'border-violet-500/30' },
  { label: '生产线', emoji: '🏭', hex: '#fbbf24', textColor: 'text-amber-400', gradient: 'from-amber-600/20 to-amber-900/10', border: 'border-amber-500/30' },
  { label: '交付', emoji: '📦', hex: '#34d399', textColor: 'text-emerald-400', gradient: 'from-emerald-600/20 to-emerald-900/10', border: 'border-emerald-500/30' },
]

const MODULES: FlowModule[] = [
  { id: 'trending',    stageIdx: 0, icon: <TrendingUp className="w-4 h-4" />,  name: '热榜雷达',   tagline: '抓取 RR / SH 热榜',        detail: '一键抓取海外热门小说排行榜，AI 自动分析读者偏好和题材趋势，生成差异化选题建议并保存到创意库。' },
  { id: 'vault',       stageIdx: 0, icon: <Archive className="w-4 h-4" />,     name: '创意库',     tagline: '保存灵感·一键开书',         detail: '选中创意 →「发送到创建新书」自动预填书名/题材/平台/字数。也可「创建新书」从零开始。' },
  { id: 'style',       stageIdx: 1, icon: <BarChart3 className="w-4 h-4" />,   name: '风格分析',   tagline: '三源导入·文风指纹',         detail: '热榜导入、在线 URL 采样、本地 .txt。运行文本统计 → AI 深度指纹 → 提取笔法基因注入写手 Agent。' },
  { id: 'suggestions', stageIdx: 1, icon: <Lightbulb className="w-4 h-4" />,   name: 'AI 建议',    tagline: '全套方案·一键应用',         detail: '生成 7 类建议：故事创意、创作规则、声音卡片、场景节拍、故事弧线、7 维风格设定（含 reason）。一键应用写入人性化引擎。' },
  { id: 'humanize',    stageIdx: 1, icon: <Sparkles className="w-4 h-4" />,    name: '人性化引擎', tagline: '7 维笔法·角色声音',         detail: '微调 POV/时态/节奏/基调/展示度/对话/描写密度。AI 建议预填值附理由。所有设定组装为 StyleGuidance prompt。' },
  { id: 'writing',     stageIdx: 2, icon: <PenTool className="w-4 h-4" />,     name: '写作控制台', tagline: '7 阶段全自动管线',           detail: '建筑师→写手→审计→深度审查→修订→润色。CyberFeed 终端实时滚动日志，活动面板记录状态。' },
  { id: 'chapters',    stageIdx: 2, icon: <BookOpen className="w-4 h-4" />,    name: '章节管理',   tagline: '阅读·审阅·通过/驳回',       detail: '逐章阅读 AI 生成内容，查看审计问题列表，一键通过或驳回。6 Agent 处理后质量通常可靠。' },
  { id: 'truth',       stageIdx: 2, icon: <ScrollText className="w-4 h-4" />,  name: '真相文件',   tagline: '10 文件+实体注册表',         detail: '世界状态、资源账本、伏笔池、角色交互矩阵等 10 文件 + 实体注册表。每章自动更新和快照。' },
  { id: 'detection',   stageIdx: 3, icon: <ShieldAlert className="w-4 h-4" />, name: 'AIGC 检测',  tagline: '4 维 AI 痕迹+敏感词',       detail: '段落均匀度、对冲词密度、公式化过渡、列表结构——综合评分 < 3 基本看不出 AI。同步敏感词扫描。' },
  { id: 'export',      stageIdx: 3, icon: <Download className="w-4 h-4" />,    name: '导出',       tagline: 'TXT/MD/EPUB+封面',           detail: '三格式适配不同平台。EPUB 按 KDP 标准，内置 8 款网文封面模板，Canvas 实时渲染。' },
]

const STAGE_GROUPS = STAGES.map((_, si) => MODULES.filter(m => m.stageIdx === si))

/* ══════════════════════════════════════════════
   Data — Other sections
   ══════════════════════════════════════════════ */

interface AgentStep { emoji: string; name: string; role: string; color: string; hex: string }
const agentPipeline: AgentStep[] = [
  { emoji: '🚀', name: '启动',   role: '加载配置+真相文件', color: 'bg-zinc-600', hex: '#a1a1aa' },
  { emoji: '🏗️', name: '建筑师', role: '规划大纲·场景节拍', color: 'bg-sky-600', hex: '#38bdf8' },
  { emoji: '✍️', name: '写手',   role: '生成正文·风格注入', color: 'bg-violet-600', hex: '#a78bfa' },
  { emoji: '🔍', name: '审计员', role: '27 维度质量审查',   color: 'bg-amber-600', hex: '#fbbf24' },
  { emoji: '🔬', name: '深度审查', role: '5 维叙事连续性', color: 'bg-orange-600', hex: '#fb923c' },
  { emoji: '✏️', name: '修订者', role: '修复关键问题',     color: 'bg-rose-600', hex: '#fb7185' },
  { emoji: '💎', name: '润色师', role: '文学级润色·去AI味', color: 'bg-emerald-600', hex: '#34d399' },
]

interface SnowballStation {
  icon: string; name: string; hex: string
  actor: string; desc: string
  adds: string[]; total: number
}
const SNOWBALL_STATIONS: SnowballStation[] = [
  {
    icon: '📡', name: '热榜雷达', hex: '#38bdf8', actor: '🤖',
    desc: '抓取海外热榜趋势数据',
    adds: ['热门题材关键词', '读者偏好分析', 'AI 选题建议'], total: 3,
  },
  {
    icon: '💡', name: '创意库', hex: '#38bdf8', actor: '👤',
    desc: '人工筛选灵感 · 决定创作方向',
    adds: ['用户选定的创意构思', '书名 · 题材 · 平台 · 字数'], total: 5,
  },
  {
    icon: '📖', name: '创建书籍', hex: '#60a5fa', actor: '🤝',
    desc: '趋势 + 创意 → 凝结为项目文件',
    adds: ['book.json 项目配置', 'creative_context.md 创意上下文'], total: 7,
  },
  {
    icon: '🏗️', name: '建筑师 Agent', hex: '#a78bfa', actor: '🤖',
    desc: '基于所有前置数据规划全书蓝图',
    adds: ['世界观圣经', '角色档案', '全书大纲 + 章节节拍'], total: 10,
  },
  {
    icon: '🔬', name: '风格指纹', hex: '#a78bfa', actor: '🤖',
    desc: '分析参考文本 → 提取文风 DNA',
    adds: ['fingerprint.md 笔法基因', 'style_profile.json 量化指标'], total: 12,
  },
  {
    icon: '🎯', name: 'AI 建议', hex: '#c084fc', actor: '🤖',
    desc: '读取指纹 → 生成全套创作方案',
    adds: ['角色声音卡片', '场景节拍', '故事弧线', '故事方向建议', '创作纪律'], total: 17,
  },
  {
    icon: '✨', name: '人性化引擎', hex: '#c084fc', actor: '🤝',
    desc: '人工微调 AI 预填的 7 维笔法参数',
    adds: ['7 维人性化设置 (POV / 时态 / 节奏 / 基调 / 展示度 / 对话 / 描写密度)'], total: 18,
  },
  {
    icon: '⛄', name: 'Writer 总装', hex: '#fbbf24', actor: '✍️',
    desc: 'buildStyleGuidance() 合并全部散落文件 → 完整方案递交写手',
    adds: ['style_guide.md 全量风格引导', 'creative_context.md 上下文', '大纲 + 前文回顾'], total: 18,
  },
]
const SNOWBALL_MAX = 18

interface JourneyStep {
  icon: string; title: string; hex: string
  feeling: string; story: string; tip: string
}
const novelistJourney: JourneyStep[] = [
  {
    icon: '🔭', title: '找到你的灵感', hex: '#38bdf8',
    feeling: '就像站在书店入口，眼前摆满了全世界的畅销书',
    story: '你打开热榜雷达，几秒钟就拉回了海外几十部热门小说的数据。AI 帮你分析了读者评论、热度走势、题材空白区——你只需要扫一眼，把感兴趣的灵感「收藏」到你的创意库里。',
    tip: '不用急着决定写什么，先多收集几个灵感放着，量变引发质变',
  },
  {
    icon: '✨', title: '让灵感变成一本书', hex: '#38bdf8',
    feeling: '就像给你的故事起一个名字，它就从此有了生命',
    story: '在创意库里挑一个最让你兴奋的点子，点「开始创作」。系统自动帮你填好了书名、题材、平台这些基础信息，你稍微调整一下创作方向的描述——比如"玄幻+轻松日常风"——然后一键开书。',
    tip: '创作方向写得越具体，后面 AI 给你的建议就越精准',
  },
  {
    icon: '🏗️', title: '搭建故事骨架', hex: '#818cf8',
    feeling: '就像建筑师拿到你的需求后画出了整栋大楼的蓝图',
    story: '建筑师 Agent 读完你的创意上下文，帮你规划世界观、设计主要角色、写出全书大纲。你可以看看它给的章节安排合不合胃口，不满意随时调整。',
    tip: '大纲不需要完美，后面写的时候随时可以修改',
  },
  {
    icon: '🎨', title: '定义你的文风', hex: '#a78bfa',
    feeling: '就像调色盘——你在挑选属于你这本书的独特"颜色"',
    story: '你可以导入几本你喜欢的参考小说，系统会分析它们的句子节奏、词汇习惯、修辞手法，提取出一份「文风指纹」。接着 AI 会基于指纹给你一套完整建议：角色该怎么说话、什么时候该快节奏、基调偏明亮还是暗黑……',
    tip: '如果不想导入参考书，也可以跳过直接手动调参数',
  },
  {
    icon: '🎛️', title: '微调到满意为止', hex: '#c084fc',
    feeling: '就像音响师在混音台前推滑块——每个旋钮都对应你的审美偏好',
    story: 'AI 已经帮你预填好了所有参数并附上了推荐理由，你只需要看看哪些需要改。比如你想让对话更口语化一点？拉一下滑块。想让描写更克制？调一下密度。最终这些设定会变成写手 Agent 的"性格"。',
    tip: '这一步花 5 分钟仔细调，能省下后面几十章的修改时间',
  },
  {
    icon: '✍️', title: '看着你的故事诞生', hex: '#fbbf24',
    feeling: '就像坐在监控室里看六个工匠接力打造你的作品',
    story: '点下「开始写作」，终端里会实时滚动日志——建筑师细化本章大纲、写手落笔生成正文、审计员检查逻辑漏洞、深度审查员确认前后一致性、修订者修补问题、润色师做最后打磨。你泡杯咖啡，看着进度条走完就行。',
    tip: '每章大约需要几分钟，你可以一次性排队多章，起身休息',
  },
  {
    icon: '📖', title: '用你的眼睛把关', hex: '#fb923c',
    feeling: '就像编辑收到稿子后的第一次通读',
    story: '打开章节管理，一章一章读过去。系统已经帮你标出了审计发现的问题（如果有的话），满意就点「通过」，觉得不对就「驳回」让 AI 重写。通常经过六轮 Agent 打磨后，问题已经很少了。',
    tip: '重点关注角色是否一致、情节是否连贯，细节文笔 AI 已经处理得很好了',
  },
  {
    icon: '🛡️', title: '确认安全过关', hex: '#34d399',
    feeling: '就像出版前的最后一道质检',
    story: '运行一下 AIGC 检测——系统会从段落均匀度、对冲词密度、公式化过渡等多个维度打分。分数低就放心发布，分数高就回去让润色师再磨一磨。敏感词扫描也会同步完成。',
    tip: '经过完整六 Agent 管线处理的章节，通常 AI 痕迹已经非常低',
  },
  {
    icon: '🚀', title: '把作品送到读者手中', hex: '#34d399',
    feeling: '就像在快递单上写好地址，按下寄出按钮的那一刻',
    story: '选择你需要的格式——TXT 适合网文平台、EPUB 适合 KDP——再从八款封面模板里挑一个合适的风格，实时预览，满意后一键导出。你的作品就可以发布到全世界了。',
    tip: '恭喜你！从灵感到成品，你始终是故事的主人，AI 只是你最得力的助手',
  },
]

/* ══════════════════════════════════════════════
   FlowPipeline — 4-column grid + SVG connectors
   ══════════════════════════════════════════════ */

function ModuleFlowCard({ mod, hex, open }: {
  mod: FlowModule; hex: string; open: boolean
}): JSX.Element {
  return (
    <div className="group relative rounded-lg border border-zinc-700/60 bg-zinc-900/80 hover:bg-zinc-800/90
                 transition-all duration-300 cursor-default overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
           style={{ background: `linear-gradient(90deg, transparent, ${hex}, transparent)` }} />
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <span style={{ color: hex }}>{mod.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: hex }}>{mod.name}</p>
          <p className="text-[10px] text-zinc-500 truncate">{mod.tagline}</p>
        </div>
        <ChevronRight className={`w-3 h-3 text-zinc-600 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
      </div>
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-3 pb-3 pt-0">
          <div className="border-t border-zinc-700/40 pt-2">
            <p className="text-[11px] text-zinc-400 leading-relaxed">{mod.detail}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function FlowPipeline(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [allExpanded, setAllExpanded] = useState(false)
  const [paths, setPaths] = useState<ConnPath[]>([])
  const [dims, setDims] = useState({ w: 0, h: 0 })

  const recalc = useCallback(() => {
    const c = containerRef.current
    if (!c) return
    const cr = c.getBoundingClientRect()
    if (cr.width === 0) return
    setDims({ w: cr.width, h: cr.height })

    const result: ConnPath[] = []
    for (let i = 0; i < MODULES.length - 1; i++) {
      const src = nodeRefs.current[MODULES[i].id]
      const dst = nodeRefs.current[MODULES[i + 1].id]
      if (!src || !dst) continue

      const sr = src.getBoundingClientRect()
      const dr = dst.getBoundingClientRect()
      const same = MODULES[i].stageIdx === MODULES[i + 1].stageIdx

      let d: string
      if (same) {
        const x = Math.round(sr.left + sr.width / 2 - cr.left)
        const y1 = Math.round(sr.bottom - cr.top + 1)
        const y2 = Math.round(dr.top - cr.top - 1)
        d = `M${x},${y1} L${x},${y2}`
      } else {
        const x1 = Math.round(sr.right - cr.left + 2)
        const y1 = Math.round(sr.top + sr.height / 2 - cr.top)
        const x2 = Math.round(dr.left - cr.left - 2)
        const y2 = Math.round(dr.top + dr.height / 2 - cr.top)
        const dx = x2 - x1
        const cx1 = Math.round(x1 + dx * 0.45)
        const cx2 = Math.round(x2 - dx * 0.45)
        d = `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`
      }

      result.push({
        key: `c-${i}`,
        d,
        sameStage: same,
        fromHex: STAGES[MODULES[i].stageIdx].hex,
        toHex: STAGES[MODULES[i + 1].stageIdx].hex,
      })
    }
    setPaths(result)
  }, [])

  // Recalc during card expand/collapse CSS transition
  useEffect(() => {
    let active = true
    const t0 = performance.now()
    function tick(): void {
      if (!active) return
      recalc()
      if (performance.now() - t0 < 400) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return (): void => { active = false }
  }, [allExpanded, recalc])

  // Recalc on container resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => recalc())
    ro.observe(el)
    return (): void => ro.disconnect()
  }, [recalc])

  return (
    <div ref={containerRef} className="relative"
         onMouseEnter={() => setAllExpanded(true)}
         onMouseLeave={() => setAllExpanded(false)}>
      {/* SVG connectors — behind cards */}
      {dims.w > 0 && (
        <svg width={dims.w} height={dims.h}
             className="absolute top-0 left-0 pointer-events-none"
             style={{ zIndex: 0, overflow: 'visible' }}>
          <defs>
            <filter id="conn-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {paths.filter(p => !p.sameStage).map(p => {
              const nums = p.d.match(/-?[\d.]+/g)?.map(Number) || []
              return (
                <linearGradient key={`g-${p.key}`} id={`g-${p.key}`} gradientUnits="userSpaceOnUse"
                  x1={nums[0] || 0} y1={nums[1] || 0}
                  x2={nums[nums.length - 2] || 0} y2={nums[nums.length - 1] || 0}>
                  <stop offset="0%" stopColor={p.fromHex} />
                  <stop offset="100%" stopColor={p.toHex} />
                </linearGradient>
              )
            })}
          </defs>
          {paths.map(p => {
            const stroke = p.sameStage ? p.fromHex : `url(#g-${p.key})`
            return (
              <g key={p.key}>
                <path d={p.d} stroke={stroke} strokeWidth="2" fill="none"
                      opacity="0.15" strokeLinecap="round" />
                <path d={p.d} stroke={stroke} strokeWidth="2" fill="none"
                      opacity="0.7" strokeLinecap="round"
                      strokeDasharray="6 30" filter="url(#conn-glow)"
                      className="wf-dash-anim" />
                {/* Directional particles on vertical (same-stage) connectors */}
                {p.sameStage && [0, 1, 2].map(pi => (
                  <circle key={`${p.key}-p${pi}`} r={pi === 1 ? 3 : 2}
                          fill={p.fromHex} opacity={pi === 1 ? 0.9 : 0.55}
                          filter="url(#conn-glow)">
                    <animateMotion dur="1.2s" repeatCount="indefinite"
                                   begin={`${pi * 0.4}s`} path={p.d} />
                  </circle>
                ))}
              </g>
            )
          })}
        </svg>
      )}

      {/* 4-column card grid — on top */}
      <div className="flex gap-10 items-start relative" style={{ zIndex: 10 }}>
        {STAGE_GROUPS.map((group, si) => (
          <div key={si} className="flex-1 min-w-0 flex flex-col gap-5">
            <div className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${STAGES[si].gradient} border ${STAGES[si].border} shadow-lg`}>
              <span className="text-sm">{STAGES[si].emoji}</span>
              <span className={`text-xs font-bold ${STAGES[si].textColor}`}>{STAGES[si].label}</span>
              <span className="text-[10px] text-zinc-500">({si + 1}/4)</span>
            </div>
            {group.map(mod => (
              <div key={mod.id} ref={el => { nodeRefs.current[mod.id] = el }}>
                <ModuleFlowCard mod={mod} hex={STAGES[si].hex} open={allExpanded} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   AgentPipelineStepper
   ══════════════════════════════════════════════ */

function AgentPipelineStepper(): JSX.Element {
  const [hov, setHov] = useState<number | null>(null)
  return (
    <div className="flex items-start justify-between w-full pb-2">
      {agentPipeline.map((a, i) => (
        <div key={i} className="flex items-start flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5 cursor-default"
               onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <div className={`w-9 h-9 rounded-full ${a.color} flex items-center justify-center text-sm shadow-lg
                            transition-transform duration-200 ${hov === i ? 'scale-110 ring-2 ring-white/20' : ''}`}>{a.emoji}</div>
            <p className="text-[10px] font-semibold text-center leading-tight transition-colors duration-200"
                          style={{ color: hov === i ? a.hex : '#a1a1aa' }}>{a.name}</p>
            <div className={`transition-all duration-200 overflow-hidden text-center
                            ${hov === i ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0'}`}>
              <p className="text-[9px] text-zinc-500 leading-tight whitespace-nowrap">{a.role}</p>
            </div>
          </div>
          {i < agentPipeline.length - 1 && (
            <div className="flex items-center pt-4 flex-1 mx-1">
              <div className="flex-1 h-[2px] bg-zinc-700 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-400/60 to-transparent wf-shimmer-anim" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════
   DataFlowDiagram — Snowball Visualization
   ══════════════════════════════════════════════ */

function DataFlowDiagram(): JSX.Element {
  const [allOpen, setAllOpen] = useState(false)

  return (
    <div className="relative"
         onMouseEnter={() => setAllOpen(true)}
         onMouseLeave={() => setAllOpen(false)}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-lg">⛄</span>
        <div>
          <p className="text-xs font-extrabold bg-gradient-to-r from-sky-400 via-violet-400 to-amber-400 bg-clip-text text-transparent">数据雪球 · 逐站积累</p>
          <p className="text-[10px] text-zinc-600">每一站的产出都传递给下一站，越滚越大，直到完整方案递交 Writer</p>
        </div>
      </div>

      <div className="space-y-0">
        {SNOWBALL_STATIONS.map((st, i) => {
          const isLast = i === SNOWBALL_STATIONS.length - 1
          const pct = Math.round((st.total / SNOWBALL_MAX) * 100)
          const ballSize = 22 + Math.round((i / (SNOWBALL_STATIONS.length - 1)) * 30)

          return (
            <div key={i} className="flex gap-3 items-stretch">
              {/* Left: snowball + vertical connector */}
              <div className="flex flex-col items-center shrink-0" style={{ width: 56 }}>
                {/* Snowball */}
                <div className="flex items-center justify-center" style={{ minHeight: ballSize + 12 }}>
                  <div className="relative flex items-center justify-center">
                    {/* Pulse ring */}
                    <div className="absolute rounded-full wf-snowball-pulse"
                         style={{
                           width: ballSize + 10, height: ballSize + 10,
                           backgroundColor: `${st.hex}10`,
                           border: `1px solid ${st.hex}18`,
                         }} />
                    {/* Core ball */}
                    <div className="rounded-full flex items-center justify-center font-bold text-white relative z-10"
                         style={{
                           width: ballSize, height: ballSize,
                           fontSize: isLast ? 16 : ballSize < 32 ? 9 : 11,
                           background: `radial-gradient(circle at 35% 35%, ${st.hex}60, ${st.hex}25)`,
                           border: `2px solid ${st.hex}90`,
                           boxShadow: isLast
                             ? `0 0 20px ${st.hex}50, 0 0 40px ${st.hex}25`
                             : `0 0 ${Math.round(ballSize * 0.35)}px ${st.hex}30`,
                         }}>
                      {isLast ? '⛄' : st.total}
                    </div>
                  </div>
                </div>

                {/* Vertical connector */}
                {!isLast && (
                  <div className="flex-1 relative overflow-hidden" style={{ width: 2, minHeight: 8 }}>
                    <div className="absolute inset-0" style={{ backgroundColor: `${st.hex}20` }} />
                    <div className="absolute w-full wf-flow-down-anim"
                         style={{
                           height: '60%',
                           background: `linear-gradient(180deg, ${st.hex}90, transparent)`,
                         }} />
                  </div>
                )}
              </div>

              {/* Right: station card */}
              <div className="flex-1 min-w-0 pb-1.5">
                <div className={`group relative rounded-lg border bg-zinc-900/80 hover:bg-zinc-800/90
                               transition-all duration-300 overflow-hidden
                               ${isLast ? 'border-amber-500/40 ring-1 ring-amber-500/20' : 'border-zinc-700/60'}`}>
                  {/* Accent line */}
                  <div className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300
                                  ${allOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                       style={{ background: `linear-gradient(90deg, transparent, ${st.hex}, transparent)` }} />

                  {/* Header */}
                  <div className="px-3 py-2 flex items-center gap-2">
                    <span className="text-sm">{st.icon}</span>
                    <span className="text-xs font-bold" style={{ color: st.hex }}>{st.name}</span>
                    <span className="text-[10px]" title={
                      st.actor === '🤖' ? 'AI 自动' : st.actor === '👤' ? '人工决策'
                      : st.actor === '🤝' ? 'AI + 人工协作' : '写手执行'
                    }>{st.actor}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[10px] font-semibold" style={{ color: st.hex }}>
                        {isLast ? '全量注入' : `+${st.adds.length}`}
                      </span>
                      {/* Mini progress bar */}
                      <div className="w-14 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                             style={{ width: `${pct}%`, backgroundColor: st.hex }} />
                      </div>
                      <span className="text-[9px] text-zinc-600 tabular-nums">{st.total}/{SNOWBALL_MAX}</span>
                    </div>
                  </div>

                  {/* Expandable detail */}
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden
                                  ${allOpen ? 'max-h-52 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-3 pb-2.5">
                      <div className="border-t border-zinc-700/40 pt-2 space-y-2">
                        <p className="text-[11px] text-zinc-500">{st.desc}</p>
                        <div className="flex flex-wrap gap-1">
                          {st.adds.map((a, ai) => (
                            <span key={ai}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{
                                backgroundColor: `${st.hex}12`,
                                color: st.hex,
                                border: `1px solid ${st.hex}25`,
                              }}>
                              + {a}
                            </span>
                          ))}
                        </div>
                        {i > 0 && !isLast && (
                          <p className="text-[10px]" style={{ color: `${st.hex}88` }}>
                            ↗ 同时承接前 {i} 站全部数据
                          </p>
                        )}
                        {isLast && (
                          <p className="text-[10px] text-amber-500/70 font-medium">
                            ⛄ 站 1–7 全部 {SNOWBALL_MAX} 项数据在此汇合，组装为完整写作方案
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-2 px-1">
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        <span className="text-[10px] text-zinc-600 shrink-0">站 1 → 站 8：数据只增不减，Writer 收到完整雪球</span>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   NovelistTimeline
   ══════════════════════════════════════════════ */

function NovelistTimeline(): JSX.Element {
  const [allOpen, setAllOpen] = useState(false)

  return (
    <div className="relative"
         onMouseEnter={() => setAllOpen(true)}
         onMouseLeave={() => setAllOpen(false)}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-lg">📝</span>
        <div>
          <p className="text-xs font-extrabold bg-gradient-to-r from-sky-400 via-amber-400 to-emerald-400 bg-clip-text text-transparent">一位作家的真实创作旅程</p>
          <p className="text-[10px] text-zinc-600">从脑海中的第一丝灵感，到读者手中的完整作品——每一步你都是导演</p>
        </div>
      </div>

      <div className="space-y-0">
        {novelistJourney.map((j, i) => {
          const isLast = i === novelistJourney.length - 1
          const ballSize = 24 + Math.round((i / (novelistJourney.length - 1)) * 22)

          return (
            <div key={i} className="flex gap-3 items-stretch">
              {/* Left: numbered circle + vertical connector */}
              <div className="flex flex-col items-center shrink-0" style={{ width: 48 }}>
                {/* Circle */}
                <div className="flex items-center justify-center" style={{ minHeight: ballSize + 10 }}>
                  <div className="relative flex items-center justify-center">
                    <div className="absolute rounded-full wf-snowball-pulse"
                         style={{
                           width: ballSize + 8, height: ballSize + 8,
                           backgroundColor: `${j.hex}10`,
                           border: `1px solid ${j.hex}18`,
                         }} />
                    <div className="rounded-full flex items-center justify-center relative z-10"
                         style={{
                           width: ballSize, height: ballSize,
                           fontSize: isLast ? 14 : 12,
                           background: `radial-gradient(circle at 35% 35%, ${j.hex}60, ${j.hex}25)`,
                           border: `2px solid ${j.hex}90`,
                           boxShadow: isLast
                             ? `0 0 16px ${j.hex}50, 0 0 32px ${j.hex}20`
                             : `0 0 ${Math.round(ballSize * 0.3)}px ${j.hex}30`,
                         }}>
                      <span>{j.icon}</span>
                    </div>
                  </div>
                </div>

                {/* Vertical connector */}
                {!isLast && (
                  <div className="flex-1 relative overflow-hidden" style={{ width: 2, minHeight: 8 }}>
                    <div className="absolute inset-0" style={{ backgroundColor: `${j.hex}20` }} />
                    <div className="absolute w-full wf-flow-down-anim"
                         style={{
                           height: '60%',
                           background: `linear-gradient(180deg, ${j.hex}90, transparent)`,
                         }} />
                  </div>
                )}
              </div>

              {/* Right: station card */}
              <div className="flex-1 min-w-0 pb-1.5">
                <div className={`group relative rounded-lg border bg-zinc-900/80 hover:bg-zinc-800/90
                               transition-all duration-300 overflow-hidden
                               ${isLast ? 'border-emerald-500/40 ring-1 ring-emerald-500/20' : 'border-zinc-700/60'}`}>
                  {/* Accent line */}
                  <div className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300
                                  ${allOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                       style={{ background: `linear-gradient(90deg, transparent, ${j.hex}, transparent)` }} />

                  {/* Header */}
                  <div className="px-3 py-2 flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: j.hex }}>{j.title}</span>
                    <span className="text-[10px] text-zinc-600 ml-auto">步骤 {i + 1}/{novelistJourney.length}</span>
                  </div>

                  {/* Feeling quote — always visible */}
                  <div className="px-3 pb-2">
                    <p className="text-[11px] italic leading-relaxed" style={{ color: `${j.hex}cc` }}>
                      「{j.feeling}」
                    </p>
                  </div>

                  {/* Expandable detail */}
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden
                                  ${allOpen ? 'max-h-56 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-3 pb-2.5">
                      <div className="border-t border-zinc-700/40 pt-2 space-y-2">
                        <p className="text-[11px] text-zinc-400 leading-relaxed">{j.story}</p>
                        <div className="flex items-start gap-1.5 rounded px-2 py-1.5"
                             style={{ backgroundColor: `${j.hex}08`, border: `1px solid ${j.hex}15` }}>
                          <span className="text-[10px] shrink-0 mt-px">💡</span>
                          <p className="text-[10px] leading-relaxed" style={{ color: `${j.hex}bb` }}>{j.tip}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-2 px-1">
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        <span className="text-[10px] text-zinc-600 shrink-0">从灵感到出版，你始终掌控方向，AI 负责执行细节</span>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Main export
   ══════════════════════════════════════════════ */

export default function WorkflowShowcase(): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-lg font-bold bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
          选题 → 配置 → 生产 → 交付
        </p>
        <p className="text-xs text-zinc-500 max-w-md mx-auto">
          全球首款完整覆盖四阶段的 AI 小说工业化生产系统。六个 AI Agent 接力，你只需像导演一样审阅结果。
        </p>
      </div>

      <div>
        <SectionLabel label="四阶段流水线" sub="鼠标悬停模块查看详情 · 动画箭头连接完整工作流" gradient="from-sky-400 to-violet-400" />
        <div className="mt-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <FlowPipeline />
        </div>
      </div>

      <div>
        <SectionLabel label="7 阶段全自动管线" sub="每章自动经过 7 个 Agent 接力处理" gradient="from-violet-400 to-amber-400" />
        <div className="mt-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 flex justify-center">
          <AgentPipelineStepper />
        </div>
      </div>

      <div>
        <SectionLabel label="数据雪球链路" sub="18 项数据逐站累积，像滚雪球一样越来越丰富 · 悬停展开详情" gradient="from-sky-400 via-violet-400 to-amber-400" />
        <div className="mt-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
          <DataFlowDiagram />
        </div>
      </div>

      <div>
        <SectionLabel label="作家视角：一本书的诞生" sub="悬停展开完整故事 · 每一步都有比喻帮你理解" gradient="from-amber-400 to-emerald-400" />
        <div className="mt-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
          <NovelistTimeline />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FeatureCallout icon={<Zap className="w-4 h-4 text-amber-400" />}
          title="步骤守卫 (StepGate)"
          desc="跳过前置步骤？系统显示锁定画面 + 一键跳转。永远不会在错误步骤浪费时间。"
          borderColor="border-amber-500/20" titleColor="text-amber-400" />
        <FeatureCallout icon={<User className="w-4 h-4 text-emerald-400" />}
          title="CyberFeed 终端"
          desc="底部赛博终端实时滚动日志 + 右侧活动面板。无论哪个页面，都能看到系统工作状态。"
          borderColor="border-emerald-500/20" titleColor="text-emerald-400" />
      </div>

      <div className="flex gap-3 rounded-lg bg-violet-950/20 border border-violet-800/30 px-4 py-3">
        <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        <p className="text-xs text-violet-300/80 leading-relaxed">
          你不需要记住数据链——只需按侧边栏从上到下走，系统自动把正确的数据传到正确的地方。但了解数据流能帮你理解为什么配置顺序很重要。
        </p>
      </div>

      <style>{`
        @keyframes wfDashFlow {
          from { stroke-dashoffset: 36; }
          to   { stroke-dashoffset: 0; }
        }
        .wf-dash-anim {
          animation: wfDashFlow 1.2s linear infinite;
        }
        @keyframes wfShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .wf-shimmer-anim {
          animation: wfShimmer 3s ease-in-out infinite;
        }
        @keyframes wfFlowDown {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(300%); }
        }
        .wf-flow-down-anim {
          animation: wfFlowDown 1.5s linear infinite;
        }
        @keyframes wfSnowballPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.12); opacity: 0.9; }
        }
        .wf-snowball-pulse {
          animation: wfSnowballPulse 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

/* ── Helpers ── */

function SectionLabel({ label, sub, gradient }: { label: string; sub: string; gradient?: string }): JSX.Element {
  const grad = gradient || 'from-zinc-200 to-zinc-400'
  return (
    <div className="flex items-baseline gap-2.5">
      <h3 className={`text-sm font-extrabold bg-gradient-to-r ${grad} bg-clip-text text-transparent`}>{label}</h3>
      <span className="text-[10px] text-zinc-600">{sub}</span>
    </div>
  )
}

function FeatureCallout({ icon, title, desc, borderColor, titleColor }: {
  icon: React.ReactNode; title: string; desc: string; borderColor: string; titleColor?: string
}): JSX.Element {
  return (
    <div className={`rounded-xl border ${borderColor} bg-zinc-900/50 p-3 space-y-1.5`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className={`text-xs font-semibold ${titleColor || 'text-zinc-200'}`}>{title}</span>
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">{desc}</p>
    </div>
  )
}
