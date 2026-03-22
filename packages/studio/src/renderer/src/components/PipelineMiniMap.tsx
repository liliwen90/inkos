import { useAgentChatStore, type PipelineStage } from '../stores/agent-chat-store'

function StageNode({ stage }: { stage: PipelineStage }): JSX.Element {
  const statusClass =
    stage.status === 'done' ? 'bg-emerald-500'
    : stage.status === 'running' ? 'bg-violet-400 animate-pulse'
    : stage.status === 'error' ? 'bg-amber-500'
    : 'bg-zinc-700'

  return (
    <div className="flex items-center gap-0.5 group relative" title={`${stage.icon} ${stage.agent}`}>
      <div className={`w-2 h-2 rounded-full ${statusClass} transition-colors`} />
      <span className="text-[10px] opacity-0 group-hover:opacity-100 absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 pointer-events-none transition-opacity">
        {stage.icon}
      </span>
    </div>
  )
}

export default function PipelineMiniMap(): JSX.Element | null {
  const stages = useAgentChatStore((s) => s.pipelineStages)

  if (stages.length === 0) return null

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-zinc-800/50">
      {stages.map((stage, i) => (
        <div key={stage.agent} className="flex items-center">
          <StageNode stage={stage} />
          {i < stages.length - 1 && (
            <div className={`w-3 h-px mx-0.5 ${
              stage.status === 'done' ? 'bg-emerald-700' : 'bg-zinc-800'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}
