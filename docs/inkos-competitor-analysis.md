# InkOS 竞品调研 (2026-03-14)

## 基本信息
- **GitHub**: https://github.com/Narcooo/inkos
- **版本**: v0.3.6 (首次提交仅3天前，迭代极快)
- **技术栈**: TypeScript 单仓库, pnpm workspaces, Commander.js CLI
- **包名**: @actalk/inkos (npm)
- **许可证**: MIT 开源
- **Stars**: 391 | Forks: 72 | 贡献者: 1 (Narcooo / Junxian Ma)
- **形态**: 纯CLI命令行 + 自然语言Agent模式 (Web UI 标注"规划中")

## 核心架构：5 Agent管线
| Agent | 职责 |
|-------|------|
| 雷达 Radar | 扫描平台趋势(番茄/起点)，指导故事方向，可跳过 |
| 建筑师 Architect | 规划章节结构：大纲、场景节拍、节奏控制 |
| 写手 Writer | 根据大纲+世界状态生成正文，写前自检+写后结算 |
| 连续性审计员 Auditor | 对照7个真相文件验证草稿，26维度审计 |
| 修订者 Reviser | 修复审计问题，支持polish/rewrite/rework/anti-detect四种模式 |

审计不通过 → 自动"修订→再审计"循环，直到关键问题清零。

## 7个真相文件（长期记忆系统）
| 文件 | 内容 |
|------|------|
| current_state.md | 世界状态：角色位置、关系网络、已知信息、情感弧线 |
| particle_ledger.md | 资源账本：物品/金钱/物资数量+衰减追踪 |
| pending_hooks.md | 未闭合伏笔：铺垫、承诺、未解决冲突 |
| chapter_summaries.md | 各章摘要：出场人物、关键事件、状态变化 |
| subplot_board.md | 支线进度板：A/B/C线状态+停滞检测 |
| emotional_arcs.md | 情感弧线：按角色追踪情绪变化和成长 |
| character_matrix.md | 角色交互矩阵：相遇记录、信息边界 |

## 26维度审计系统
OOC检查、时间线、设定冲突、伏笔、节奏、文风、信息越界、词汇疲劳、利益链断裂、
配角降智、配角工具人化、爽点虚化、台词失真、流水账、知识库污染、视角一致性、
战力崩坏、数值检查、年代考据、段落等长、套话密度、公式化转折、列表式结构、
支线停滞、弧线平坦、节奏单调
- 其中dim 20-23(AI痕迹)由纯规则引擎检测，不消耗LLM
- 按题材启用不同子集：玄幻26维度、都市24维度、恐怖22维度

## AIGC检测闭环
- 纯规则检测：段落等长、套话密度、公式化转折、列表式结构
- 外部API集成：GPTZero / Originality / 自定义端点
- 文风指纹学习：从参考文本提取StyleProfile注入prompt
- 反检测改写：ReviserAgent anti-detect模式，检测→改写→重检测循环
- 检测历史：detection_history.json + inkos detect --stats

## 题材规则体系
内置5题材：玄幻、仙侠、都市、恐怖、通用
每个题材含：章节类型、禁忌清单、疲劳词、语言铁律(✗→✓示例)、审计维度子集
- 可 `inkos genre copy` 复制到项目中自定义
- 可 `inkos genre create` 从零创建新题材
- 每本书有独立 `book_rules.md`(主角人设锁定/数值上限/自定义禁令/疲劳词覆盖)

## 去AI味
- 5条通用规则 + 每题材专属语言规则
- AI标记词限频：仿佛/忽然/竟然/不禁/宛如/猛地，每3000字≤1次
- 词汇疲劳审计 + AI痕迹审计(dim 20-23)双重检测

## 其他核心特性
- **状态快照+章节重写**: 每章自动快照，重写时世界状态/资源/伏笔全部回滚
- **写入锁**: 文件锁防并发写入
- **守护进程**: `inkos up` 后台按计划写章
- **通知推送**: Telegram/飞书/企微/Webhook (HMAC-SHA256签名)
- **外部Agent集成**: 原子命令+--json输出，可被OpenClaw等调用
- **自然语言Agent模式**: `inkos agent "写下一章"` — 内置9个tool-use工具
- **LLM支持**: OpenAI + Anthropic原生SDK + 所有兼容接口
- **诊断**: `inkos doctor` 含API连通性测试

## 三种使用模式
1. 完整管线：`inkos write next 书名 --count 5`
2. 原子命令：`inkos draft/audit/revise` 单独执行+--json
3. 自然语言Agent：`inkos agent "帮我写一本都市修仙"`

## 实测数据
- 31章《吞天魔帝》(玄幻)，452,191字
- 平均章字数 ~14,500字
- 审计通过率100%，48个资源追踪项，20条活跃伏笔，10条已回收伏笔

## 项目结构
```
inkos/
├── packages/
│   ├── core/           # Agent运行时、管线、状态管理
│   │   ├── agents/     # architect, writer, continuity, reviser, radar, ai-tells, detector, style-analyzer
│   │   ├── pipeline/   # runner, agent(tool-use), scheduler, detection-runner
│   │   ├── state/      # 文件状态管理器(7真相文件+快照)
│   │   ├── llm/        # OpenAI+Anthropic双SDK(流式)
│   │   ├── notify/     # Telegram, 飞书, 企微, Webhook
│   │   └── models/     # Zod schema校验
│   └── cli/            # Commander.js(18条命令)
└── (规划中) studio/     # Web审阅编辑界面
```

## 与AI小说生成器对比结论
### InkOS领先
- 5Agent管线(vs单生成器) — 差距极大
- 7真相文件长期记忆(vs 4个) — 缺资源账本/伏笔/支线/角色矩阵
- 26维度审计(vs 3-4维度) — 数量级差距
- AIGC检测闭环(规则+API+改写循环 vs 提示词注入)
- 题材规则体系(5题材专属规则 vs 无题材分化)
- 状态快照+重写回滚(vs 无快照)
- 守护进程+通知

### AI小说生成器领先
- GUI桌面应用(vs 纯CLI) — 用户门槛碾压
- 人性化引擎(声音卡片/场景节拍/创意度参数)
- AI建议系统(9类建议chip一键填充)
- LLM任务路由(4种任务用不同模型)
- 即开即用(下载exe双击 vs npm+配置+命令行)

### 战略建议（已执行）
InkOS是MIT开源，核心质量保障体系远超我们。
✅ 已决策：Fork InkOS → 在其上构建Electron GUI → 移植我们的独有优势 = 降维打击。
✅ 已Fork: https://github.com/liliwen90/inkos
✅ 已Clone到本地: F:\011 Projects\009-InkOS
✅ 深度代码审计完成
✅ 架构方案确定: Adapter Pattern (不改core一行代码)
详细规划 → `/memories/repo/inkos-gui-plan.md`
