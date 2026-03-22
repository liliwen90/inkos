import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import CyberFeed from './CyberFeed'
import ActivityPanel from '../ActivityPanel'
import ToastContainer from '../ToastContainer'
import { useAppStore } from '../../stores/app-store'
import { useCyberFeedStore } from '../../stores/cyber-feed-store'

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
      <ToastContainer />
    </div>
  )
}
