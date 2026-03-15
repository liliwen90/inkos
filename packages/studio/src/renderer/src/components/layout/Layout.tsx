import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout(): JSX.Element {
  return (
    <div className="flex w-full h-full bg-zinc-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
