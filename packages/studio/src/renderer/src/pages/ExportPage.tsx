import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Download, FileText, FileCode, CheckCircle2, BookOpen, Image,
  Package, ChevronDown, ChevronRight, Palette
} from 'lucide-react'
import { useAppStore, type BookSummary } from '../stores/app-store'

// ─── 封面模板 ───

interface CoverTemplate {
  id: string
  name: string
  bgGradient: [string, string]
  accentColor: string
  titleColor: string
  authorColor: string
  decorStyle: 'border' | 'line' | 'frame' | 'minimal'
}

const COVER_TEMPLATES: CoverTemplate[] = [
  { id: 'dark-fantasy', name: '暗黑奇幻', bgGradient: ['#1a0a2e', '#16213e'], accentColor: '#9b59b6', titleColor: '#e8d5f5', authorColor: '#a78bba', decorStyle: 'frame' },
  { id: 'scifi', name: '科幻', bgGradient: ['#0a0e27', '#1a1a3e'], accentColor: '#00d4ff', titleColor: '#e0f7ff', authorColor: '#7ec8e3', decorStyle: 'line' },
  { id: 'litrpg', name: 'LitRPG', bgGradient: ['#1a1a0a', '#2d2d1a'], accentColor: '#ffd700', titleColor: '#fff8dc', authorColor: '#d4a017', decorStyle: 'border' },
  { id: 'romance', name: '言情', bgGradient: ['#2d1a24', '#3d1a2a'], accentColor: '#ff6b9d', titleColor: '#ffe0eb', authorColor: '#d4718a', decorStyle: 'minimal' },
  { id: 'horror', name: '恐怖', bgGradient: ['#1a0000', '#2d0a0a'], accentColor: '#cc0000', titleColor: '#ffcccc', authorColor: '#aa6666', decorStyle: 'frame' },
  { id: 'wuxia', name: '武侠', bgGradient: ['#1a0f0a', '#2d1f14'], accentColor: '#c8956c', titleColor: '#f5e6d3', authorColor: '#b8956c', decorStyle: 'border' },
  { id: 'modern', name: '都市', bgGradient: ['#0f0f1a', '#1a1a2e'], accentColor: '#ffffff', titleColor: '#ffffff', authorColor: '#aaaaaa', decorStyle: 'minimal' },
  { id: 'xuanhuan', name: '玄幻', bgGradient: ['#0a1a2e', '#1a0a2e'], accentColor: '#ff8c00', titleColor: '#ffe0b2', authorColor: '#d4a06a', decorStyle: 'frame' },
]

function drawCover(
  canvas: HTMLCanvasElement,
  template: CoverTemplate,
  title: string,
  author: string
): void {
  const W = 1600, H = 2560
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // 背景渐变
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, template.bgGradient[0])
  grad.addColorStop(1, template.bgGradient[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  const accent = template.accentColor

  // 装饰
  if (template.decorStyle === 'frame') {
    ctx.strokeStyle = accent
    ctx.lineWidth = 6
    ctx.strokeRect(60, 60, W - 120, H - 120)
    ctx.lineWidth = 2
    ctx.strokeRect(80, 80, W - 160, H - 160)
  } else if (template.decorStyle === 'border') {
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, W, 12)
    ctx.fillRect(0, H - 12, W, 12)
    ctx.fillRect(0, 0, 12, H)
    ctx.fillRect(W - 12, 0, 12, H)
  } else if (template.decorStyle === 'line') {
    ctx.strokeStyle = accent
    ctx.lineWidth = 3
    const cy = H * 0.48
    ctx.beginPath(); ctx.moveTo(200, cy); ctx.lineTo(W - 200, cy); ctx.stroke()
    const cy2 = H * 0.63
    ctx.beginPath(); ctx.moveTo(200, cy2); ctx.lineTo(W - 200, cy2); ctx.stroke()
  }

  // 标题（自动换行）
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const titleY = H * 0.42
  const maxWidth = W - 240
  const titleSize = title.length > 20 ? 100 : title.length > 10 ? 120 : 140
  ctx.font = `bold ${titleSize}px Georgia, "Noto Serif SC", serif`
  ctx.fillStyle = template.titleColor

  // 简易自动换行
  const words = title.length > 6 ? wrapText(ctx, title, maxWidth) : [title]
  const lineH = titleSize * 1.3
  const startY = titleY - ((words.length - 1) * lineH) / 2
  for (let i = 0; i < words.length; i++) {
    ctx.fillText(words[i], W / 2, startY + i * lineH, maxWidth)
  }

  // 装饰线（标题与作者之间）
  if (template.decorStyle !== 'line') {
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(W * 0.3, H * 0.58)
    ctx.lineTo(W * 0.7, H * 0.58)
    ctx.stroke()
  }

  // 作者名
  const authorSize = 56
  ctx.font = `${authorSize}px Georgia, "Noto Serif SC", serif`
  ctx.fillStyle = template.authorColor
  ctx.fillText(author || '', W / 2, H * 0.68, maxWidth)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const char of text) {
    const test = current + char
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = char
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

// ─── 可折叠区段 ───

function Section({ icon, title, badge, defaultOpen, children }: {
  icon: React.ReactNode
  title: string
  badge?: string
  defaultOpen?: boolean
  children: React.ReactNode
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors text-left">
        {open ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
        <span className="text-zinc-400">{icon}</span>
        <span className="text-sm font-medium text-zinc-200">{title}</span>
        {badge && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 border border-violet-600/30">{badge}</span>}
      </button>
      {open && <div className="px-4 py-4 space-y-4">{children}</div>}
    </div>
  )
}

// ─── 主页面 ───

export default function ExportPage(): JSX.Element {
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const books = useAppStore((s) => s.books)
  const currentBookId = useAppStore((s) => s.currentBookId)
  const setCurrentBookId = useAppStore((s) => s.setCurrentBookId)
  const setBooks = useAppStore((s) => s.setBooks)

  const [exporting, setExporting] = useState(false)
  const [exportedPath, setExportedPath] = useState<string | null>(null)

  // EPUB 元数据状态
  const [epubAuthor, setEpubAuthor] = useState('')
  const [epubDesc, setEpubDesc] = useState('')
  const [epubKeywords, setEpubKeywords] = useState('')
  const [epubLang, setEpubLang] = useState<'zh' | 'en' | 'auto'>('auto')
  const [headingStyle, setHeadingStyle] = useState<'chapter-number' | 'title-only' | 'full'>('full')
  const [includeToC, setIncludeToC] = useState(true)
  const [includeTitlePage, setIncludeTitlePage] = useState(true)
  const [includeCopyright, setIncludeCopyright] = useState(true)

  // 封面状态
  const [coverTemplate, setCoverTemplate] = useState<string>('dark-fantasy')
  const [coverTitle, setCoverTitle] = useState('')
  const [coverAuthor, setCoverAuthor] = useState('')
  const coverCanvasRef = useRef<HTMLCanvasElement>(null)
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (projectLoaded) {
      window.hintos.listBooks().then((data) => setBooks(data as BookSummary[]))
    }
  }, [projectLoaded, setBooks])

  // 选中书籍时自动解析语言并填充封面标题
  const currentBook = books.find(b => b.bookId === currentBookId)
  const canExport = currentBookId && currentBook && currentBook.chapterCount > 0

  useEffect(() => {
    if (currentBookId && currentBook) {
      setCoverTitle(currentBook.title.replace(/[《》]/g, ''))
      if (epubLang === 'auto') {
        window.hintos.resolveBookLanguage(currentBookId).then(() => {})
      }
    }
  }, [currentBookId, currentBook])

  // 封面预览
  const redrawCover = useCallback(() => {
    const canvas = coverCanvasRef.current
    if (!canvas) return
    const tpl = COVER_TEMPLATES.find(t => t.id === coverTemplate) ?? COVER_TEMPLATES[0]
    drawCover(canvas, tpl, coverTitle || '书名', coverAuthor || '作者')
    setCoverDataUrl(canvas.toDataURL('image/png'))
  }, [coverTemplate, coverTitle, coverAuthor])

  useEffect(() => { redrawCover() }, [redrawCover])

  // 基础导出
  const handleExport = async (format: 'txt' | 'md'): Promise<void> => {
    if (!currentBookId) return
    setExporting(true)
    setExportedPath(null)
    try {
      const path = await window.hintos.exportBook(currentBookId, format)
      if (path) setExportedPath(path)
    } finally {
      setExporting(false)
    }
  }

  // EPUB 导出
  const handleExportEpub = async (): Promise<void> => {
    if (!currentBookId) return
    setExporting(true)
    setExportedPath(null)
    try {
      const lang = epubLang === 'auto'
        ? await window.hintos.resolveBookLanguage(currentBookId)
        : epubLang
      const metadata = {
        title: currentBook?.title,
        author: epubAuthor,
        language: lang,
        description: epubDesc || undefined,
        keywords: epubKeywords ? epubKeywords.split(/[,，]/).map(s => s.trim()).filter(Boolean) : undefined,
        coverImageBase64: coverDataUrl ?? undefined,
      }
      const options = {
        includeToC,
        includeTitlePage,
        includeCopyrightPage: includeCopyright,
        chapterHeadingStyle: headingStyle,
      }
      const path = await window.hintos.exportEpub(currentBookId, metadata, options)
      if (path) setExportedPath(path)
    } finally {
      setExporting(false)
    }
  }

  // 保存封面
  const handleSaveCover = async (): Promise<void> => {
    if (!coverDataUrl) return
    const path = await window.hintos.saveCoverImage(coverDataUrl)
    if (path) setExportedPath(path)
  }

  if (!projectLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <Download className="w-8 h-8 mb-2" />
        <p>请先打开 HintOS 项目</p>
      </div>
    )
  }

  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500'
  const selectCls = inputCls
  const btnPrimary = 'px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2'
  const cbxLabel = 'flex items-center gap-2 text-sm text-zinc-300 cursor-pointer'

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">导出</h1>
        <p className="text-zinc-500 text-sm mt-1">将书籍导出为文件、EPUB 电子书或生成封面</p>
      </div>

      {/* 书籍选择 */}
      <select value={currentBookId ?? ''} onChange={(e) => { setCurrentBookId(e.target.value || null); setExportedPath(null) }}
        className={selectCls + ' max-w-md'}>
        <option value="">— 请选择书籍 —</option>
        {books.map(b => <option key={b.bookId} value={b.bookId}>{b.title} ({b.chapterCount}章 · {b.totalWords.toLocaleString()}字)</option>)}
      </select>

      {currentBookId && !canExport && (
        <p className="text-amber-400 text-sm">该书籍暂无章节，无法导出</p>
      )}

      {/* ─── 基础导出 ─── */}
      <Section icon={<FileText className="w-4 h-4" />} title="基础导出" badge="TXT / MD" defaultOpen>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <button onClick={() => handleExport('md')} disabled={exporting || !canExport}
            className="flex flex-col items-center gap-3 p-5 border border-zinc-800 rounded-lg hover:border-violet-600/50 hover:bg-zinc-900/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <FileCode className="w-7 h-7 text-violet-400" />
            <span className="text-sm text-zinc-200 font-medium">Markdown</span>
          </button>
          <button onClick={() => handleExport('txt')} disabled={exporting || !canExport}
            className="flex flex-col items-center gap-3 p-5 border border-zinc-800 rounded-lg hover:border-violet-600/50 hover:bg-zinc-900/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <FileText className="w-7 h-7 text-violet-400" />
            <span className="text-sm text-zinc-200 font-medium">纯文本</span>
          </button>
        </div>
      </Section>

      {/* ─── EPUB 导出 (KDP) ─── */}
      <Section icon={<Package className="w-4 h-4" />} title="EPUB 导出" badge="KDP 标准">
        <p className="text-xs text-zinc-500 -mt-1">生成符合 Amazon KDP 标准的 EPUB3 电子书，包含目录、扉页、版权页。</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">作者名 *</label>
            <input value={epubAuthor} onChange={e => setEpubAuthor(e.target.value)}
              placeholder="笔名 / Pen Name" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">语言</label>
            <select value={epubLang} onChange={e => setEpubLang(e.target.value as 'zh' | 'en' | 'auto')} className={selectCls}>
              <option value="auto">自动检测（按题材）</option>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">内容简介</label>
          <textarea value={epubDesc} onChange={e => setEpubDesc(e.target.value)}
            rows={2} placeholder="一两句话描述你的故事…" className={inputCls + ' resize-none'} />
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">关键词（逗号分隔，最多 7 个）</label>
          <input value={epubKeywords} onChange={e => setEpubKeywords(e.target.value)}
            placeholder="LitRPG, Progression Fantasy, Cultivation" className={inputCls} />
        </div>

        {/* KDP 格式化选项 */}
        <div className="border border-zinc-800 rounded-lg p-3 space-y-3 bg-zinc-900/30">
          <p className="text-xs font-medium text-zinc-400">KDP 格式化选项</p>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">章节标题格式</label>
            <select value={headingStyle} onChange={e => setHeadingStyle(e.target.value as typeof headingStyle)} className={selectCls}>
              <option value="full">完整（Chapter 1: 标题 / 第1章 标题）</option>
              <option value="chapter-number">仅编号（Chapter 1 / 第1章）</option>
              <option value="title-only">仅标题</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className={cbxLabel}>
              <input type="checkbox" checked={includeTitlePage} onChange={e => setIncludeTitlePage(e.target.checked)}
                className="rounded border-zinc-600 text-violet-500 focus:ring-violet-500" />
              包含扉页
            </label>
            <label className={cbxLabel}>
              <input type="checkbox" checked={includeCopyright} onChange={e => setIncludeCopyright(e.target.checked)}
                className="rounded border-zinc-600 text-violet-500 focus:ring-violet-500" />
              包含版权页
            </label>
            <label className={cbxLabel}>
              <input type="checkbox" checked={includeToC} onChange={e => setIncludeToC(e.target.checked)}
                className="rounded border-zinc-600 text-violet-500 focus:ring-violet-500" />
              包含目录
            </label>
          </div>
        </div>

        <button onClick={handleExportEpub} disabled={exporting || !canExport || !epubAuthor.trim()}
          className={btnPrimary}>
          <Package className="w-4 h-4" />
          {exporting ? '生成中…' : '生成 EPUB'}
        </button>
        {!epubAuthor.trim() && <p className="text-xs text-amber-400">请填写作者名</p>}
      </Section>

      {/* ─── 封面模板 ─── */}
      <Section icon={<Palette className="w-4 h-4" />} title="封面模板" badge="1600×2560">
        <p className="text-xs text-zinc-500 -mt-1">生成 KDP 标准尺寸封面（1600×2560px），也可用于 Royal Road。</p>

        {/* 模板选择 */}
        <div className="grid grid-cols-4 gap-2">
          {COVER_TEMPLATES.map(tpl => (
            <button key={tpl.id} onClick={() => setCoverTemplate(tpl.id)}
              className={`p-2 rounded-lg border text-xs text-center transition-all ${
                coverTemplate === tpl.id
                  ? 'border-violet-500 bg-violet-600/10 text-violet-300'
                  : 'border-zinc-700 hover:border-zinc-600 text-zinc-400'
              }`}
              style={{ background: coverTemplate === tpl.id ? undefined : `linear-gradient(135deg, ${tpl.bgGradient[0]}, ${tpl.bgGradient[1]})` }}>
              <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: tpl.accentColor }} />
              {tpl.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">封面标题</label>
            <input value={coverTitle} onChange={e => setCoverTitle(e.target.value)}
              placeholder="书名" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">封面作者名</label>
            <input value={coverAuthor} onChange={e => setCoverAuthor(e.target.value)}
              placeholder="作者" className={inputCls} />
          </div>
        </div>

        {/* 预览 */}
        <div className="flex gap-4 items-start">
          <div className="border border-zinc-700 rounded-lg overflow-hidden shadow-lg flex-shrink-0">
            <canvas ref={coverCanvasRef} style={{ width: 200, height: 320 }}
              className="block" />
          </div>
          <div className="space-y-2 text-xs text-zinc-500 pt-2">
            <p>• 实际尺寸 1600×2560px</p>
            <p>• 符合 KDP 封面规格要求</p>
            <p>• 导出 EPUB 时自动嵌入</p>
            <p>• 可单独保存为 PNG 上传到 RR</p>
            <button onClick={handleSaveCover} className={btnPrimary + ' mt-3'}>
              <Image className="w-4 h-4" />
              保存封面 PNG
            </button>
          </div>
        </div>
      </Section>

      {/* 导出结果 */}
      {exportedPath && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 border border-emerald-800/50 bg-emerald-950/20 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="break-all">已导出到: {exportedPath}</span>
        </div>
      )}
    </div>
  )
}
