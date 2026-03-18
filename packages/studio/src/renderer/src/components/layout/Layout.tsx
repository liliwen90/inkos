import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ActivityPanel from '../ActivityPanel'
import ToastContainer from '../ToastContainer'
import { useAppStore } from '../../stores/app-store'

export default function Layout(): JSX.Element {
  const theme = useAppStore((s) => s.theme)
  const addProgressEvent = useAppStore((s) => s.addProgressEvent)
  const logTokenUsage = useAppStore((s) => s.logTokenUsage)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // 订阅 pipeline-progress 并同步到活动面板
  useEffect(() => {
    const unsub = window.hintos.onProgress((event: { stage?: string; detail?: string; timestamp?: number; tokenUsage?: { input: number; output: number; model: string; operation: string } }) => {
      // 标准进度事件
      if (event.stage) {
        addProgressEvent({ stage: event.stage, detail: event.detail ?? '', timestamp: event.timestamp ?? Date.now() })
      }
      // Token 消耗事件
      if (event.tokenUsage) {
        logTokenUsage({
          operation: event.tokenUsage.operation,
          inputTokens: event.tokenUsage.input,
          outputTokens: event.tokenUsage.output,
          model: event.tokenUsage.model
        })
      }
    })
    return unsub
  }, [addProgressEvent, logTokenUsage])

  return (
    <div className="flex w-full h-full bg-zinc-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
      <ActivityPanel />
      <ToastContainer />
    </div>
  )
}
