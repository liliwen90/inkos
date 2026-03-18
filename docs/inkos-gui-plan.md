# InkOS Studio — GUI 桌面应用改造规划 (2026-03-14)

## ⚡ 战略决策（已确认）
- **目标**: 基于 InkOS (MIT) 的 `@actalk/inkos-core` 构建 Electron GUI 桌面应用
- **核心逻辑**: InkOS引擎级质量 + 我们的GUI易用性 + 独有增值功能 = **降维打击**
- **Fork仓库**: `https://github.com/liliwen90/inkos`
- **本地路径**: `F:\011 Projects\009-InkOS`
- **原工具路径**: `F:\011 Projects\008 Ai-Novelist` (v1.5.1, 继续保留作参考)

## 🔴 关键架构决策：Adapter Pattern（不改Core一行代码）

### 为什么不改Core
InkOS迭代极快（3天到v0.3.6），如果我们改了core代码，每次合并上游都会冲突。
**正确做法**：通过Adapter层包装core API，零侵入。

### 三层架构
```
上游 InkOS Core (@actalk/inkos-core) ← 不改一行，npm依赖或git submodule
        ↓
   Adapter Layer (我们的适配层, ~200行) ← 包装API + 进度拦截 + 错误规范化
        ↓
   Studio GUI (Electron + React) ← 纯我们的代码
```

### Git 双remote管理
```bash
git remote add upstream https://github.com/Narcooo/inkos.git
# 日常更新：
git fetch upstream
git merge upstream/master  # 因为不改core，永远0冲突
```

### 进度回调方案（不改Core）
用方法拦截替代修改源码：
```typescript
// packages/studio/src/main/adapters/pipeline-adapter.ts
const originalWriteDraft = runner.writeDraft.bind(runner);
runner.writeDraft = async (...args) => {
  emit('progress', 'writer', '写手Agent正在创作...');
  const result = await originalWriteDraft(...args);
  emit('progress', 'writer-done', `草稿完成 ${result.wordCount}字`);
  return result;
};
```

### 版本锁定策略
```json
{
  "dependencies": {
    "@actalk/inkos-core": "0.3.6"  // 锁定版本，不用 ^
  }
}
```
升级流程：`npm update @actalk/inkos-core` → 跑适配器测试 → 修适配器 → 发版

### 可选：给上游提PR
- 提 `PipelineRunner` 增加 `onProgress` 回调的PR
- 被接受 → adapter更简单；被拒 → adapter照样work
- 作为**礼物而非依赖**

## InkOS Core 深度技术分析

### 代码量统计
| 模块 | 行数 | 关键文件 |
|------|------|----------|
| pipeline/runner.ts | 598 | 核心管线运行器 |
| llm/provider.ts | 619 | LLM双SDK(OpenAI+Anthropic) |
| agents/writer.ts | 511 | 写手Agent |
| agents/writer-prompts.ts | 380 | Prompt模板 |
| pipeline/agent.ts | 323 | 自然语言Agent(tool-use) |
| pipeline/scheduler.ts | 300 | 守护进程调度 |
| agents/continuity.ts | 263 | 连续性审计(26维度) |
| agents/architect.ts | 216 | 建筑师Agent(大纲) |
| state/manager.ts | 172 | 状态管理器 |
| agents/reviser.ts | 165 | 修订Agent(4种模式) |
| 其余小文件 | ~1689 | 检测/雷达/通知/模型等 |
| **Core总计** | **~5236** | — |
| **CLI总计** | **~2179** | 21条命令 |

### PipelineRunner 核心API
```typescript
// 原子操作
initBook(book: BookConfig): Promise<void>
writeDraft(bookId, context?, wordCount?): Promise<DraftResult>
auditDraft(bookId, chapterNumber?): Promise<AuditResult>
reviseDraft(bookId, chapterNumber?, mode?): Promise<ReviseResult>
readTruthFiles(bookId): Promise<TruthFiles>
getBookStatus(bookId): Promise<BookStatusInfo>
runRadar(): Promise<RadarResult>

// 完整管线（一键写→审→改）
writeNextChapter(bookId, wordCount?, tempOverride?): Promise<ChapterPipelineResult>
```

### 完整管线流程
1. **写** — WriterAgent 加载10个真相文件 + 最近3章 + 题材Profile + BookRules → 生成结构化输出
2. **审** — ContinuityAuditor 27维LLM审查 + analyzeAITells(4维规则) + analyzeSensitiveWords(3词库) → 合并issues
3. **改**（条件触发）— 若存在critical issue → ReviserAgent修改 → **再次审计**循环
4. **存** — 写章节+更新10个真相文件+更新index.json+快照
5. **通知** — Webhook + Telegram/飞书/企微

### StateManager 文件结构
```
{projectRoot}/
├── inkos.json              ← 项目配置
└── books/{bookId}/
    ├── book.json            ← BookConfig
    ├── .write.lock          ← PID写锁
    ├── chapters/
    │   ├── index.json       ← ChapterMeta[]
    │   └── 0001_xxx.md      ← 章节正文
    └── story/
        ├── current_state.md       ← 状态卡
        ├── particle_ledger.md     ← 资源账本
        ├── pending_hooks.md       ← 伏笔池
        ├── story_bible.md         ← 世界观
        ├── volume_outline.md      ← 卷纲
        ├── book_rules.md          ← 本书规则
        ├── chapter_summaries.md   ← 章节摘要
        ├── subplot_board.md       ← 支线进度板
        ├── emotional_arcs.md      ← 情感弧线
        ├── character_matrix.md    ← 角色交互矩阵
        ├── style_guide.md         ← 文风指南
        ├── style_profile.json     ← 文风指纹
        ├── detection_history.json ← 检测历史
        └── snapshots/{N}/         ← 每章快照(7个文件)
```

### AgentContext
```typescript
interface AgentContext {
  readonly client: LLMClient;
  readonly model: string;
  readonly projectRoot: string;
  readonly bookId?: string;
}
```
Agent间数据通过**磁盘文件**中转（文件即消息总线），设计合理不需要改。

### LLM Provider
- 支持3种后端：OpenAI Chat API、OpenAI Responses API、Anthropic Messages API
- 全部streaming
- 支持Anthropic extended thinking (thinkingBudget)
- 接口：`chatCompletion(client, model, messages, options?) → LLMResponse`
- 工具调用：`chatWithTools(client, model, messages, tools, options?) → ChatWithToolsResult`

### GUI集成可行性评估
| 维度 | 状态 | 说明 |
|------|------|------|
| CLI依赖 | ✅ 零 | core中无stdin/readline/inquirer |
| process.exit | ✅ 零 | core中无process.exit调用 |
| I/O | ⚠️ 混合 | ~50处直接fs调用（Electron主进程可用，无需改） |
| 进度回调 | ❌ 无 | **用方法拦截解决，不改core** |
| 错误处理 | ⚠️ throw | adapter层try-catch包装 |
| 事件系统 | ⚠️ 只有Webhook | adapter层加EventEmitter |
| Agent模式回调 | ✅ 天生GUI就绪 | onToolCall/onToolResult/onMessage |
| 数据模型 | ✅ Zod schema | 表单校验直接复用 |

### CLI层需搬到Studio的业务逻辑（~700行）
| CLI来源 | 搬到Studio | 核心逻辑 |
|---------|-----------|---------|
| init.ts | project-init.ts (~60行) | 创建inkos.json+.env+目录 |
| config.ts | config-manager.ts (~100行) | 全局~/.inkos/.env + 项目.env + inkos.json加载合并 |
| book.ts | book-service.ts (~30行) | bookId生成(拼音/UUID) |
| write.ts (rewrite部分) | chapter-service.ts (~80行) | 章节删除+索引修剪+状态回滚 |
| export.ts | export-service.ts (~60行) | 章节拼合为单文件 |
| review.ts | review-service.ts (~50行) | 章节状态修改 |
| doctor.ts | doctor-service.ts (~100行) | 环境诊断检查 |
| analytics.ts | analytics-service.ts (~80行) | 统计计算 |
| genre.ts | genre-service.ts (~80行) | 题材CRUD |
| utils.ts | utils.ts (~60行) | resolveBookId等 |

### CLI命令→GUI页面映射
| CLI命令 | GUI页面 | 优先级 |
|---------|---------|--------|
| inkos book create | 创建书籍表单 | P1 |
| inkos write next [--count N] | 写作控制台+进度 | P1 |
| inkos status | 仪表盘 | P1 |
| inkos review list/approve | 章节管理+审阅 | P1 |
| inkos export | 导出按钮 | P1 |
| inkos config set/set-global | LLM配置页 | P1 |
| inkos audit/revise | 写作控制台内（自动或手动） | P1 |
| inkos detect | AIGC检测面板 | P2 |
| inkos style analyze/import | 文风分析面板 | P2 |
| inkos genre list/show/copy/create | 题材编辑器 | P2 |
| inkos book update | 书籍设置面板 | P2 |
| inkos radar scan | 雷达面板 | P3 |
| inkos agent | 自然语言对话界面 | P3 |
| inkos up/down | 守护进程控制 | P3 |
| inkos doctor | 诊断页面 | P3 |
| inkos analytics | 统计面板 | P3 |
| inkos write rewrite | 章节重写（带回滚） | P2 |

## 项目结构规划

```
inkos/                          ← fork的仓库
├── packages/
│   ├── core/                   ← InkOS 原有 (不改!)
│   ├── cli/                    ← InkOS 原有 (保留, 高级用户可用CLI)
│   └── studio/                 ← 🆕 Electron GUI 应用
│       ├── src/
│       │   ├── main/           ← Electron 主进程
│       │   │   ├── main.ts     ← BrowserWindow + IPC handlers
│       │   │   ├── adapters/   ← 🔑 Adapter层 (core API包装+进度拦截)
│       │   │   │   ├── pipeline-adapter.ts
│       │   │   │   ├── state-adapter.ts
│       │   │   │   └── llm-adapter.ts
│       │   │   ├── ipc/        ← IPC bridge (adapter → renderer)
│       │   │   └── services/   ← 从CLI搬来的业务逻辑
│       │   ├── renderer/       ← 前端
│       │   │   ├── pages/      ← 各功能页面
│       │   │   ├── components/ ← UI组件
│       │   │   └── styles/     ← CSS/Tailwind
│       │   └── preload.ts      ← contextBridge
│       ├── package.json
│       └── electron-builder.yml
└── pnpm-workspace.yaml          ← 加入 studio
```

## GUI 页面规划

### P1 — MVP核心 (必须有)
1. **仪表盘** — 项目列表+书籍状态总览+最近活动
2. **创建书籍** — 表单: 书名/题材(下拉5种)/平台/每章字数/目标章数 + 创作指导textarea
3. **写作控制台** — 核心页面:
   - 一键写下一章 / 连续写N章
   - 实时进度: 雷达→建筑师→写手→审计→修订 阶段指示器（方法拦截实现）
   - 审计结果可视化: 26维度列表+严重度标注
   - 修订前后对比
4. **章节管理** — 列表+内容预览+状态(draft/review/approved)
   - 审阅通过/驳回
   - 章节重写(带状态回滚确认)
5. **真相文件查看器** — 多tab展示10个真相文件(世界状态/资源账本/伏笔/支线/情感/矩阵/摘要等)
6. **LLM配置** — provider/url/key/model + 温度/max_tokens
7. **导出** — TXT/MD格式

### P2 — 增值功能 (从原工具移植+InkOS已有)
8. **人性化引擎** — 声音卡片/场景节拍/创意度参数 → 注入Writer prompt
9. **AI建议系统** — 风格学习后生成9类建议chips → 一键填充
10. **文风分析/导入** — 分析参考文本 → 注入文风指纹(core已有analyzeStyle)
11. **AIGC检测面板** — 检测分数+历史趋势+一键反检测改写(core已有全套)
12. **题材编辑器** — 可视化编辑genre profile(禁忌/疲劳词/语言铁律)
13. **书籍规则编辑器** — 编辑book_rules.md(人设锁定/数值上限/禁令)
14. **章节重写** — 带状态回滚的重写功能

### P3 — 高级功能
15. **守护进程控制** — 定时写作开关+通知设置
16. **雷达面板** — 市场趋势可视化(番茄/起点)
17. **自然语言Agent** — 类ChatGPT对话界面, 底层调runAgentLoop
18. **统计分析** — 字数/节奏/审计通过率图表
19. **LLM任务路由** — 不同Agent用不同模型（省钱）—— 从原工具移植概念

## IPC Bridge 设计
```typescript
// preload.ts — contextBridge 暴露的安全API
interface InkOSAPI {
  // 项目管理
  initProject(path: string): Promise<void>
  loadConfig(): Promise<ProjectConfig>
  saveConfig(config: Partial<ProjectConfig>): Promise<void>
  
  // 书籍管理
  createBook(config: BookConfig): Promise<{ bookId: string }>
  updateBook(bookId: string, updates: Partial<BookConfig>): Promise<void>
  listBooks(): Promise<BookSummary[]>
  
  // 写作
  writeNext(bookId: string, options?: WriteOptions): Promise<ChapterPipelineResult>
  rewriteChapter(bookId: string, chapterNumber: number): Promise<ChapterPipelineResult>
  
  // 审阅
  auditChapter(bookId: string, chapterNumber: number): Promise<AuditResult>
  reviseChapter(bookId: string, chapterNumber: number, mode: ReviseMode): Promise<ReviseResult>
  approveChapter(bookId: string, chapterNumber: number): Promise<void>
  
  // 状态
  loadTruthFiles(bookId: string): Promise<TruthFiles>
  loadChapterIndex(bookId: string): Promise<ChapterMeta[]>
  loadChapter(bookId: string, chapterNumber: number): Promise<string>
  
  // AIGC检测
  detectChapter(bookId: string, chapterNumber: number): Promise<DetectResult>
  
  // 文风
  analyzeStyle(text: string): Promise<StyleProfile>
  importStyle(bookId: string, profile: StyleProfile): Promise<void>
  
  // Agent对话
  runAgent(instruction: string, callbacks: AgentCallbacks): Promise<string>
  
  // 导出
  exportBook(bookId: string, format: 'txt' | 'md'): Promise<string>
  
  // 进度事件监听
  onProgress(callback: (stage: string, detail: string) => void): () => void
}
```

## 技术选型
| 决策 | 选择 | 理由 |
|------|------|------|
| 前端框架 | **React + TypeScript** | InkOS也是TS, 类型共享 |
| UI库 | **Tailwind + shadcn/ui** | 快速, 暗色主题好 |
| 构建 | **Vite** | 比webpack快 |
| Electron | **31.x** (最新) | ESM支持好 |
| 安全模型 | **contextIsolation:true** | 比老工具的false更安全 |
| 状态管理 | **zustand** | 轻量 |

## 开发路线

### Phase 1: 骨架搭建 (Day 1-2)
- [ ] packages/studio 初始化 (Electron + Vite + React + TS)
- [ ] pnpm-workspace.yaml 加入studio
- [ ] Adapter层基础框架 (pipeline-adapter.ts)
- [ ] IPC bridge 基础
- [ ] 基础布局: 侧边栏 + 主内容区
- [ ] 主题: 暗色优先

### Phase 2: MVP 核心 (Day 3-7)
- [ ] 仪表盘 + 书籍列表
- [ ] 创建书籍表单 (题材下拉: 玄幻/仙侠/都市/恐怖/通用)
- [ ] LLM配置页 (provider/url/key/model)
- [ ] 写作控制台 (writeNext + 进度阶段指示器)
- [ ] 章节管理 (列表 + 内容查看 + 审阅通过/驳回)
- [ ] 真相文件查看器 (10个tab)
- [ ] 导出功能 (TXT/MD)

### Phase 3: 增值功能 (Day 8-10) ✅ 完成 (2026-03-16, commit 79f4a46)
- [x] 人性化引擎移植 (声音卡片/场景节拍/8维设定 → 注入writer prompt)
- [x] AI建议系统移植 (故事创意/作者角色/创作规则/声音卡片/场景节拍/故事弧线)
- [x] 文风分析/导入面板 (参考书管理+文本统计+AI深度指纹)
- [x] AIGC检测面板 (AI痕迹4维分析+敏感词扫描+风险等级+历史记录)

### Phase 4: 高级功能 (Day 11-14)
- [ ] 题材编辑器 (YAML frontmatter可视化编辑)
- [ ] 书籍规则编辑器
- [ ] 自然语言Agent对话界面
- [ ] 守护进程控制
- [ ] 雷达面板

### Phase 5: 打磨发布 (Day 15-17)
- [ ] electron-builder 安装包
- [ ] 自动更新 (electron-updater)
- [ ] 暗色/亮色主题切换
- [ ] i18n (中文为主, 预留英文)
- [ ] 性能优化 + bug修复

## 风险与缓解
| 风险 | 缓解 |
|------|------|
| Core ESM vs Electron CJS冲突 | Electron 31原生支持ESM; 或esbuild打包 |
| 上游快速迭代 | Adapter隔离, 版本锁定, git双remote |
| 人性化引擎(VanillaJS)移植 | 先原样包装, 后续TS重构 |
| LLM流式在IPC中的延迟 | webContents.send推送chunks |

## 当前状态 (2026-03-16)
- ✅ fork完成: https://github.com/liliwen90/inkos
- ✅ clone到本地: F:\011 Projects\009-InkOS
- ✅ core深度代码审计完成（29个源文件全读）
- ✅ CLI命令结构分析完成（21条命令全分析）
- ✅ 架构方案确定: Adapter Pattern (不改core)
- ✅ 规划文档完成
- ✅ **Phase 1 骨架搭建完成** (2026-03-15)
  - packages/studio/ 完整创建
  - electron-vite 5.0.0 + Vite 7 + React 18 + Tailwind 3 + zustand
  - 三层架构: Adapter(pipeline/state/llm) → IPC → React Renderer
  - 暗色主题 (zinc色板 + violet高亮)
  - 可折叠侧边栏 (lucide-react图标)
- ✅ **Phase 2 MVP核心完成** (2026-03-15) — commit db73054
  - 6个完整功能页面 + 3个Adapter + 25个IPC通道 + Zustand store
  - 构建: main 21KB + preload 2.7KB + renderer 364KB + 26KB CSS
- ✅ **Phase 3 增值功能完成** (2026-03-16) — commit 79f4a46 (+1953行)
  - **2个新适配器**: humanize-adapter(风格设定/声音卡片/场景节拍/指纹/建议), detection-adapter(AI痕迹/敏感词/历史)
  - **4个新页面**:
    1. 风格分析(StyleAnalysis): 参考书导入/删除 + 文本统计画像(句长/段长/词汇/可读性) + AI深度指纹提取(LLM) + 指纹启用/强度控制
    2. AIGC检测(AIGCDetection): 逐章检测 + 全部检测 + 4维AI痕迹(段落均匀/对冲词/公式过渡/列表) + 敏感词分类 + 风险徽章(低/中/高) + 历史记录
    3. 人性化引擎(HumanizeEngine): 8维风格设定(视角/时态/创意/节奏/基调/展示/对话/密度) + 声音卡片CRUD + 场景节拍CRUD + prompt注入预览
    4. AI建议(AISuggestions): LLM全方位建议(故事创意/作者角色/创作规则/声音卡片/场景节拍/故事弧线) + 可折叠sections + 复制按钮
  - **IPC扩展**: +18个handle通道(共43个) + 进度事件转发
  - **导航更新**: 侧边栏9项导航 + 10条路由
  - 构建: main 40KB + preload 5KB + renderer 427KB + 31KB CSS
- ✅ **Core API 兼容性审计** (2026-03-15) — commit 4008b94 (+145行 / -39行)
  - **发现 4 个 P0 级数据流断裂并全部修复**:
    1. `createLLMClient()` 缺少 `model` 字段 → 传入完整 LLMConfig (model+temperature+maxTokens)
    2. `analyzeAITells()` 返回 `{issues[]}` 与 Studio 期望的 `{score, detail}` 不匹配 → detection-adapter 加转换层
    3. `analyzeSensitiveWords()` 返回 `{found[]}` 与 Studio 期望的 `{hits, totalHits}` 不匹配 → detection-adapter 加转换层
    4. `StyleProfile` 类型完全不同 → humanize-adapter 加显式映射 + 前端适配 Core 字段
  - provider 类型扩展: 添加 `'custom'`
  - 前端 StyleAnalysis/AIGCDetection 渲染代码同步更新
  - **upstream remote 已添加**: `git remote add upstream https://github.com/Narcooo/inkos.git`
  - **上游同步方法**: `git fetch upstream && git merge upstream/master` (因不改core, 应0冲突)
- ⏳ Phase 4 高级功能 待启动 (题材编辑器/书籍规则/Agent对话/守护进程/雷达)
