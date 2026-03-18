# AI小说生成器 — 开发规范 & 注意事项

## 编码规范
- **Utils**: CommonJS 类导出 `module.exports = ClassName` 或单例 `module.exports = new ClassName()`
- **Components**: IIFE 模式 `(function() { ... })()`
- **IPC**: 窗口控制用 `ipcMain.on` + `ipcRenderer.send()`；文件对话框用 `ipcMain.handle` + `ipcRenderer.invoke()`
- **禁止使用** `@electron/remote`
- **所有代码注释用中文**

## 构建注意事项
- **必须单实例运行** `node build-obfuscate.js`，切勿并行启动
- 构建前确认 `src/main.js` 不含 `_0x` 混淆模式
- 如果 `.build-lock` 残留，确认无构建进程后手动删除
- `llm-config.json` 含真实API密钥，**绝不能提交到Git**
- 构建产物在 `dist/` 目录

## Git 推送规范
- **重要修改后主动 `git add . && git commit && git push`**
- commit message 使用中文，格式：`v{版本}: {概述}`
- 确保 `.gitignore` 生效（特别是 `llm-config.json`、`node_modules/`、`dist/`）

## 页面结构（index.html 约1300行）
- 5个侧边栏页面: prompt（提示词管理）、generate（小说生成）、tools（工具箱）、llm（LLM配置）、tutorial（使用教程）
- page-generate 内嵌: 故事弧线卡片 → 人性化设置details(默认展开) → 大纲生成卡片 → 章节生成卡片 → 高级设置details → AI审稿 → 场景节拍
- page-humanize 已删除（v1.3.0合并入generate）

## 调试运行
```bash
# AI小说生成器 (旧工具)
cd "f:\011 Projects\008 Ai-Novelist"
npm start        # 或 npx electron .

# HintOS Studio (新工具)
cd "F:\011 Projects\009-HintOS\packages\studio"
pnpm dev         # electron-vite dev
pnpm build       # 构建 (main+preload+renderer)
```

## HintOS Studio 开发规范
- **路径**: `F:\011 Projects\009-HintOS\packages\studio/`
- **技术栈**: Electron 31 + React 18 + TypeScript + Tailwind 3 + Vite 7 + Zustand + electron-vite
- **安全模型**: `contextIsolation:true` + `nodeIntegration:false` + preload contextBridge
- **架构**: Adapter层(不改core) → IPC handlers → Preload bridge → React Renderer
- **页面**: 仪表盘 / 写作控制台 / 章节管理 / 真相文件 / 导出 / 风格分析 / AIGC检测 / 人性化引擎 / AI建议 / LLM配置
- **Adapter层**: pipeline-adapter(EventEmitter进度) / state-adapter(文件CRUD) / llm-adapter(创建+测试) / humanize-adapter(风格/指纹/AI建议) / detection-adapter(AI痕迹/敏感词)
- **Store**: Zustand `useAppStore` — 项目/书籍/LLM/进度/UI 状态
- **IPC通道**: 43个handle + progress事件转发
- **构建验证**: `pnpm build` 成功后再提交

## 常见坑
1. Electron 28 + nodeIntegration:true 环境下 require() 可直接在renderer中使用
2. `novel-manager.js` 章节文件regex: `/第(\d+)章\.txt$/`
3. `style-manager.js` creativityToTemperature: 1→0.3, 10→1.2
4. `novel-generator.js` 前文加载上限6000字符，摘要最多5章
5. `llm-manager.js` callOpenAI超时5分钟，callOllama超时10分钟，自动重试2次间隔10秒
