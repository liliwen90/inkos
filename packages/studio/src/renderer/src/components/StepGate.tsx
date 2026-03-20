import { useNavigate } from 'react-router-dom'
import { Lock, ArrowRight } from 'lucide-react'

export interface GateRequirement {
  met: boolean
  label: string
  fixRoute?: string
  fixLabel?: string
}

interface StepGateProps {
  requirements: GateRequirement[]
  children: React.ReactNode
}

/**
 * 步骤守卫：当前置条件未满足时，显示锁定提示和引导按钮。
 * 如果所有 requirements.met === true，直接渲染 children。
 */
export default function StepGate({ requirements, children }: StepGateProps): JSX.Element {
  const navigate = useNavigate()
  const unmet = requirements.filter(r => !r.met)

  if (unmet.length === 0) return <>{children}</>

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-zinc-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-300">需要完成前置步骤</h2>
          <p className="text-sm text-zinc-500 mt-1">以下条件尚未满足：</p>
        </div>
        <div className="space-y-3 text-left">
          {unmet.map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
              <span className="text-sm text-zinc-400">{r.label}</span>
              {r.fixRoute && (
                <button onClick={() => navigate(r.fixRoute!)}
                  className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  {r.fixLabel ?? '前往'} <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
