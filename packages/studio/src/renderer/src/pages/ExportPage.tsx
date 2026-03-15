import { useState } from 'react'
import { Download, FileText, FileCode, CheckCircle2 } from 'lucide-react'
import { useAppStore, type BookSummary } from '../stores/app-store'
import { useEffect } from 'react'

export default function ExportPage(): JSX.Element {
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const books = useAppStore((s) => s.books)
  const currentBookId = useAppStore((s) => s.currentBookId)
  const setCurrentBookId = useAppStore((s) => s.setCurrentBookId)
  const setBooks = useAppStore((s) => s.setBooks)

  const [exporting, setExporting] = useState(false)
  const [exportedPath, setExportedPath] = useState<string | null>(null)

  useEffect(() => {
    if (projectLoaded) {
      window.inkos.listBooks().then((data) => setBooks(data as BookSummary[]))
    }
  }, [projectLoaded, setBooks])

  const handleExport = async (format: 'txt' | 'md'): Promise<void> => {
    if (!currentBookId) return
    setExporting(true)
    setExportedPath(null)
    try {
      const path = await window.inkos.exportBook(currentBookId, format)
      if (path) setExportedPath(path)
    } finally {
      setExporting(false)
    }
  }

  if (!projectLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <Download className="w-8 h-8 mb-2" />
        <p>请先打开 InkOS 项目</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">导出</h1>
        <p className="text-zinc-500 text-sm mt-1">将书籍导出为文件</p>
      </div>

      <select value={currentBookId ?? ''} onChange={(e) => { setCurrentBookId(e.target.value || null); setExportedPath(null) }}
        className="w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500">
        <option value="">— 请选择书籍 —</option>
        {books.map(b => <option key={b.bookId} value={b.bookId}>{b.title} ({b.chapterCount}章)</option>)}
      </select>

      {currentBookId && (
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <button onClick={() => handleExport('md')} disabled={exporting}
            className="flex flex-col items-center gap-3 p-6 border border-zinc-800 rounded-lg hover:border-violet-600/50 hover:bg-zinc-900/50 transition-all">
            <FileCode className="w-8 h-8 text-violet-400" />
            <span className="text-sm text-zinc-200 font-medium">Markdown</span>
            <span className="text-xs text-zinc-500">.md 格式</span>
          </button>
          <button onClick={() => handleExport('txt')} disabled={exporting}
            className="flex flex-col items-center gap-3 p-6 border border-zinc-800 rounded-lg hover:border-violet-600/50 hover:bg-zinc-900/50 transition-all">
            <FileText className="w-8 h-8 text-violet-400" />
            <span className="text-sm text-zinc-200 font-medium">纯文本</span>
            <span className="text-xs text-zinc-500">.txt 格式</span>
          </button>
        </div>
      )}

      {exportedPath && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 border border-emerald-800/50 bg-emerald-950/20 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4" />
          <span>已导出到: {exportedPath}</span>
        </div>
      )}
    </div>
  )
}
