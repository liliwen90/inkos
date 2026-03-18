# AI小说生成器 (Ai-Novelist) — 项目总览

## 基本信息
- **路径**: `F:\011 Projects\008 Ai-Novelist`
- **GitHub**: `https://github.com/liliwen90/ai-novelist` (Private)
- **版本**: v1.5.1
- **技术栈**: Electron 28.x + Vanilla JS (IIFE + CommonJS)
- **构建**: `node build-obfuscate.js` → 混淆 → electron-builder → 恢复源码 → 清理
- **包管理**: npm, 依赖 axios(runtime), electron 28.3.3, electron-builder 24.9.1, javascript-obfuscator 4.1.0

## 核心功能
AI辅助中文小说创作桌面工具：
1. 提示词管理 — 14种分类模板，项目级提示词保存
2. 小说生成 — 章节大纲 → 逐章生成 → 自动扩写 → 质量检查 → 摘要生成
3. 人性化写作 — 风格指纹(多书分析)、声音卡片、场景节拍、创意度/情感/叙事参数
4. 工具箱 — 6种改写模式、章节管理器、TXT/HTML导出
5. LLM配置 — 任务路由(generation/expansion/rewrite/analysis)，支持10+提供商

## 架构要点
- **BrowserWindow**: `frame:false, nodeIntegration:true, contextIsolation:false`
- **IPC**: `ipcMain.on` → window-minimize/maximize/close; `ipcMain.handle` → dialog-open/dialog-save
- **无 @electron/remote**
- **组件加载顺序**: app-init → modal → window-controls → menu-handler → prompt-handler → outline-handler → generate-handler → settings-handler → llm-handler → humanize-handler → suggestion-handler → tools-handler
- **Utils 均为 CommonJS**: `module.exports = ClassName` 或 `module.exports = new ClassName()` (单例)
- **Components 均为 IIFE**: `(function() { ... })()`

## 文件结构 (26个JS文件)
### src/main.js — Electron主进程
### src/utils/ (13个)
| 文件 | 职责 | 导出方式 |
|------|------|----------|
| app-state.js | 全局状态(_novel, _category) | new AppState() 单例 |
| app-settings.js | 持久化设置(userdata/app-settings.json) | new AppSettings() 单例 |
| novel-manager.js | 项目CRUD、章节管理 | class |
| prompt-manager.js | 提示词加载/保存 | class |
| story-idea-manager.js | 故事创意加载/保存 | class |
| template-loader.js | 加载prompt-templates.json/default-settings.json | 单例 |
| prompt-template-loader.js | 加载generation-prompts.json/outline-templates.json | 单例 |
| llm-manager.js | LLM API调用、任务路由、重试 | class |
| style-manager.js | 人性化引擎(~260行) | class |
| novel-generator.js | 核心生成引擎(~300行) | class |
| outline-generator.js | 大纲生成 | class |
| rewrite-tool.js | 6种改写模式 | class |
| export-manager.js | TXT/HTML导出 | class |

### src/components/ (11个, about-handler.js已删除)
| 文件 | 职责 | 移植到HintOS Studio |
|------|------|-------------------|
| app-init.js | 版本号显示 | 不需要(React自带) |
| modal.js | showModal/showAlert/showConfirm/showEditModal | 不需要(用shadcn/ui Dialog) |
| window-controls.js | 窗口最小化/最大化/关闭 | 需要移植(自定义标题栏) |
| menu-handler.js | 侧边栏导航 | 不需要(React Router) |
| prompt-handler.js | 分类/项目CRUD、仪表盘 | 部分(仪表盘概念) |
| outline-handler.js | 大纲生成/列表/编辑/删除 | 不需要(HintOS建筑师Agent) |
| generate-handler.js | 章节生成、进度、质量检查、状态更新 | 不需要(HintOS管线) |
| settings-handler.js | 角色状态 & 世界设定管理 | 不需要(HintOS真相文件) |
| llm-handler.js | 任务路由配置UI、健康检查 | ⭐需要移植(任务路由概念) |
| humanize-handler.js | 人性化设置、多书导入、风格指纹、声音卡片 | ⭐需要移植(核心增值) |
| tools-handler.js | 改写工具、章节管理器、导出 | 部分(导出逻辑) |
| suggestion-handler.js | AI建议系统：加载建议、填充chips、推荐标记 | ⭐需要移植(核心增值) |

## 数据存储
- 项目数据: `userdata/projects/{项目名}/`
  - `configs/` — prompts.json, story-idea.json, humanize-settings.json, voice-cards.json, ai-suggestions.json 等
  - `data/` — state.json(角色状态), world.json(世界设定), arc.json(故事弧线), summaries/
  - `chapters/` — 第1章.txt, 第2章.txt ...
  - `storylines/` — outlines
  - `style-books/` — 导入的风格参考书
- 全局设置: `userdata/app-settings.json`
- LLM配置: `src/config/llm-config.json` (⚠️ 已gitignore，含API密钥)

## LLM任务路由
| 任务 | 默认模型 | 中继地址 |
|------|----------|----------|
| generation | deepseek-chat | https://yinli.one/v1 |
| expansion | deepseek-chat | https://yinli.one/v1 |
| rewrite | claude-sonnet-4 | https://yinli.one/v1 |
| analysis | gemini-2.5-flash | https://yinli.one/v1 |

## 构建流程
1. `node build-obfuscate.js`
2. 检查 `.build-lock`（防并发）
3. 检查源码未混淆（防二次混淆）
4. 备份 src/ → src_backup/
5. 混淆所有JS
6. electron-builder --win → dist/
7. 从 src_backup/ 恢复源码
8. verifyRestore() 验证
9. 清理 src_backup/
10. 释放锁

## 重要经验教训
- **2026-03-12 灾难**: 两个并发 `node build-obfuscate.js` 导致源码和备份都被混淆覆盖。已通过 `.build-lock` 锁文件和备份前源码检查修复。
- `llm-config.json` 包含真实API密钥，已通过 `.gitignore` 排除，用 `llm-config.example.json` 替代

## Git信息
- 远程: `origin` → `https://github.com/liliwen90/New-Ai-Novelist.git`
- 默认分支: `main`
- credential helper: `manager` (Windows Credential Manager)
- 最新提交: v1.5.1 P2优化 (2026-03-14)

## v1.5.1 P2优化 (2026-03-14) [53项测试全通过]
- **项目删除功能**: NovelManager.deleteProject() + 双重确认UI (仪表盘右下角)
- **风格样本截断扩容**: 3000→6000字，风格模仿更精准
- **LLMManager单例化**: 5个消费者(novel-gen/outline-gen/style-mgr/rewrite/llm-handler)共享一个实例
- **章节一致性校验**: 生成后自动检查角色名/设定/前文矛盾，JSON格式输出{consistent, issues[]}
- **生成流程新增阶段3**: 大纲→生成→**一致性校验**→摘要→状态更新（5阶段）

## v1.5.0 生产就绪修复 (2026-03-14)
- **[P0] TemplateLoader全面修复**: categories嵌套层级+字段名mismatch (character_state_template/world_bible_template)
- **[P0] 反AI规则注入**: 15条anti_ai_taste_rules终于注入主生成system prompt (此前完全orphaned)
- **[P0] 大纲模板系统修复**: system_prompt_template字段名 + 分类不在categories子对象
- **[P0] max_tokens 4096→8192**: 防止3000字中文章节被截断
- **[P1] AI味检测增强**: 词库8→30+, 新增句式/开头/节奏分析, 新增deAiRewrite自动去味
- **[P1] 温度封顶1.0**: 原1.2超过大多数模型稳定阈值
- **[P1] 上下文翻倍**: 前文6000→12000字, 摘要5→10章
- **settings-handler.js**: default模板字段名匹配修复

## v1.4.0 全自动化改造 (2026-03-14)
- **[CRITICAL] tools-handler.js**: saveChapter传文件名改为传章节索引(之前会生成重复文件名)
- **window-controls.js**: 添加DOM null检查
- **export-manager.js**: HTML导出添加XSS转义
- **ver.json**: 更新版本号到1.3.4

## v1.3.3 修复清单 (2026-03-14)
- **AI建议自动保存**: chip点击后自动持久化(角色状态/世界设定/弧线/提示词/故事创意/人性化设置/声音卡片)
- **一键应用全部**: 状态栏新增"🚀 一键应用全部建议"按钮，批量填充+保存9类数据
- **大纲使用弧线**: outline-generator.js注入故事弧线上下文
- **向导设category**: 新建项目向导同步设置category到AppState
- **监听补全**: prompt-novel-select加入suggestion-handler监听列表

## AI建议系统 (v1.3.1新增)
- **触发时机**: 用户完成风格学习（点击"🧠 开始学习风格"按钮）后自动触发
- **流程**: 指纹分析(50%) → 内容建议生成(50%) → 自动通知 suggestion-handler 刷新
- **建议内容**: storyIdeas(3个), writerRole, writingRules, humanizeSettings(含推荐理由), voiceCards, characterState, worldBible, sceneBeats(3种), storyArc
- **存储**: `configs/ai-suggestions.json`
- **UI形式**: 紫色chips面板(ai-suggest-panel)，点击一键填充目标textarea，支持"✏️ 自定义输入"
- **全局API**: `window.AISuggestions.reload(name)` / `window.AISuggestions.getCurrent()`
