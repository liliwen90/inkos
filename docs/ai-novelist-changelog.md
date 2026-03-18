# AI小说生成器 — 版本历史 & 进度

## ⚠️ 项目状态说明 (2026-03-16)
本项目 (AI小说生成器 v1.5.1) 已功能完整，继续作为**参考实现**保留。
新一代产品 HintOS Studio 已完成 Phase 3 → 详见 `/memories/repo/hintos-gui-plan.md`
Phase 3 commit: 79f4a46 (1953行新增) | 构建: main 40KB + preload 5KB + renderer 427KB + CSS 31KB
✅ 人性化引擎、风格分析、AIGC检测、AI建议系统 — 全部移植完成到 HintOS Studio。

## v1.5.1 (2026-03-14) — 最终版本 [53项测试全通过]
- ✅ 项目删除功能: NovelManager.deleteProject() + 双重确认UI
- ✅ 风格样本截断扩容: 3000→6000字
- ✅ LLMManager单例化: 5个消费者共享一个实例
- ✅ 章节一致性校验: 生成后自动检查角色名/设定/前文矛盾
- ✅ 生成流程5阶段: 大纲→生成→一致性校验→摘要→状态更新
- ✅ EXE构建: `AI小说生成器 Setup 1.5.1.exe`
- ✅ 垃圾文件清理: 旧版exe(~392MB)+空文件+乱码日志已删除
- ✅ 已推送到 https://github.com/liliwen90/New-Ai-Novelist.git

## v1.5.0 (2026-03-14) — 生产就绪修复
- [P0] TemplateLoader全面修复: categories嵌套+字段名修正
- [P0] 反AI规则注入: 15条规则终于注入system prompt
- [P0] 大纲模板系统修复
- [P0] max_tokens 4096→8192
- [P1] AI味检测增强: 词库30+、句式/节奏分析、deAiRewrite
- [P1] 温度封顶1.0
- [P1] 上下文翻倍: 前文12000字，摘要10章

## v1.4.0 (2026-03-14) — 全自动化
- [CRITICAL] saveChapter传文件名→传章节索引
- window-controls DOM null检查
- HTML导出XSS转义

## v1.3.3 (2026-03-14)
- AI建议自动保存、一键应用全部、大纲使用弧线、向导设category

## v1.3.1 (2026-03-14)
- AI建议系统: 风格学习→9类建议→chips一键填充
- suggestion-handler.js新组件

## v1.3.0 (2026-03-14)
- 人性化页面合并入生成页、混淆灾难重建、防并发锁

## v1.2.0 — 人性化引擎、风格指纹、声音卡片、场景节拍
## v1.1.0 — LLM任务路由、改写工具、章节管理器、导出
## v1.0.0 — 基础框架、提示词管理、大纲生成、章节生成
