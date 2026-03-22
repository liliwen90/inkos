import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

/** 通用信息 Tooltip：hover ⓘ 图标显示说明文字 */
export default function InfoTooltip({ text }: { text: string }): JSX.Element {
  const [show, setShow] = useState(false)
  const [style, setStyle] = useState<React.CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)

  const handleEnter = (): void => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const goUp = rect.bottom + 380 > window.innerHeight
      const left = Math.min(Math.max(rect.left - 140, 8), window.innerWidth - 340)
      setStyle(goUp
        ? { position: 'fixed', left, bottom: window.innerHeight - rect.top + 6 }
        : { position: 'fixed', left, top: rect.bottom + 6 })
    }
    setShow(true)
  }

  return (
    <div className="relative inline-flex" ref={ref}
      onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      <Info className="w-3.5 h-3.5 text-zinc-600 hover:text-violet-400 cursor-help transition-colors" />
      {show && createPortal(
        <div style={style}
          className="z-[9999] w-80 px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-900/95 backdrop-blur shadow-2xl text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap pointer-events-none">
          {text}
        </div>,
        document.body,
      )}
    </div>
  )
}
