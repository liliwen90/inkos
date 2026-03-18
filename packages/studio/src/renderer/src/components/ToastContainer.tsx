import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useAppStore } from '../stores/app-store'

const ICON_MAP = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
  error: <XCircle className="w-4 h-4 text-red-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-400 shrink-0" />
}

const BG_MAP = {
  success: 'bg-emerald-900/80 border-emerald-700/60',
  error: 'bg-red-900/80 border-red-700/60',
  info: 'bg-blue-900/80 border-blue-700/60'
}

export default function ToastContainer(): JSX.Element | null {
  const toasts = useAppStore((s) => s.toasts)
  const removeToast = useAppStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-zinc-200 shadow-lg backdrop-blur-sm animate-in slide-in-from-right ${BG_MAP[t.type]}`}
        >
          {ICON_MAP[t.type]}
          <span className="max-w-[280px] truncate">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="ml-1 text-zinc-500 hover:text-zinc-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
