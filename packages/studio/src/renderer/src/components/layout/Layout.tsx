import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import CyberFeed from './CyberFeed'
import ActivityPanel from '../ActivityPanel'
import AgentChatPanel from '../AgentChatPanel'
import ToastContainer from '../ToastContainer'
import { useAppStore } from '../../stores/app-store'
import { useCyberFeedStore } from '../../stores/cyber-feed-store'
import { useAgentChatStore } from '../../stores/agent-chat-store'

export default function Layout(): JSX.Element {
  const theme = useAppStore((s) => s.theme)
  const addProgressEvent = useAppStore((s) => s.addProgressEvent)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // 订阅 pipeline-progress 并同步到活动面板 + CyberFeed
  useEffect(() => {
    const pushFeed = useCyberFeedStore.getState().push
    const unsub = window.hintos.onProgress((event: { stage?: string; detail?: string; timestamp?: number; tokenUsage?: { input: number; output: number; model: string; operation: string } }) => {
      // 标准进度事件
      if (event.stage) {
        addProgressEvent({ stage: event.stage, detail: event.detail ?? '', timestamp: event.timestamp ?? Date.now() })
        pushFeed({ source: 'pipeline', level: 'info', message: event.stage, detail: event.detail })
      }
      // Token 事件仅推送 CyberFeed（不再存入 Zustand store）
      if (event.tokenUsage) {
        pushFeed({
          source: 'llm',
          level: 'debug',
          message: `Token: ${event.tokenUsage.operation}`,
          detail: `in=${event.tokenUsage.input} out=${event.tokenUsage.output} model=${event.tokenUsage.model}`
        })
      }
    })
    return unsub
  }, [addProgressEvent])

  // 订阅 Agent Chat 流式事件 + 消息事件
  useEffect(() => {
    const store = useAgentChatStore.getState
    const unsubStream = window.hintos.onAgentChatStream((event) => {
      if (event.isComplete) {
        store().completeStreamingMessage(event.messageId)
      } else {
        store().updateStreamingMessage(event.messageId, event.chunkText, event.agentName)
      }
    })
    const unsubMsg = window.hintos.onAgentChatMessage((event: unknown) => {
      const msg = event as { type: string; agentName?: string; content?: string; actions?: unknown[]; richData?: unknown; landmark?: unknown }
      const def = msg.agentName ? useAgentChatStore.getState().pipelineStages.find(s => s.agent === msg.agentName) : null
      store().addMessage({
        type: msg.type as 'agent-text',
        agentName: msg.agentName,
        agentIcon: def?.icon,
        agentColor: def?.color,
        content: msg.content ?? '',
        actions: msg.actions as never,
        richData: msg.richData as never,
        landmark: msg.landmark as never,
      })
    })
    return () => { unsubStream(); unsubMsg() }
  }, [])

  return (
    <div className="flex w-full h-full bg-zinc-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
        <CyberFeed />
      </div>
      <ActivityPanel />
      <AgentChatPanel />
      <ToastContainer />
    </div>
  )
}
