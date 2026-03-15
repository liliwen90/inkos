import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, PenTool, BookOpen, ScrollText, Settings,
  PanelLeftClose, PanelLeftOpen, FolderOpen, Feather, Download,
  BarChart3, ShieldAlert, Sparkles, Lightbulb
} from 'lucide-react'
import { useAppStore } from '../../stores/app-store'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/writing', icon: PenTool, label: '写作控制台' },
  { to: '/chapters', icon: BookOpen, label: '章节管理' },
  { to: '/truth-files', icon: ScrollText, label: '真相文件' },
  { to: '/export', icon: Download, label: '导出' },
  { to: '/style-analysis', icon: BarChart3, label: '风格分析' },
  { to: '/detection', icon: ShieldAlert, label: 'AIGC 检测' },
  { to: '/humanize', icon: Sparkles, label: '人性化引擎' },
  { to: '/suggestions', icon: Lightbulb, label: 'AI 建议' }
]

const bottomItems = [
  { to: '/settings', icon: Settings, label: 'LLM 配置' }
]

export default function Sidebar(): JSX.Element {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const projectPath = useAppStore((s) => s.projectPath)
  const pipelineReady = useAppStore((s) => s.pipelineReady)
  const setProjectPath = useAppStore((s) => s.setProjectPath)
  const setProjectLoaded = useAppStore((s) => s.setProjectLoaded)
  const location = useLocation()

  const handleOpenProject = async (): Promise<void> => {
    const result = await window.inkos.selectProjectDir()
    if (result?.isProject) {
      setProjectPath(result.path)
      setProjectLoaded(true)
    }
  }

  return (
    <aside className={`flex flex-col h-full bg-zinc-900 border-r border-zinc-800 transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-zinc-800 shrink-0">
        <Feather className="w-6 h-6 text-violet-400 shrink-0" />
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-zinc-100">InkOS</span>
            <span className="text-[10px] text-zinc-500 tracking-wider">STUDIO</span>
          </div>
        )}
      </div>

      {/* Status indicator */}
      {!collapsed && projectPath && (
        <div className="px-4 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${pipelineReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-[10px] text-zinc-500 truncate">
              {pipelineReady ? '管线就绪' : '管线未连接'}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to
          return (
            <NavLink key={item.to} to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-zinc-800 text-violet-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
              title={collapsed ? item.label : undefined}>
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-2 space-y-1 border-t border-zinc-800">
        <button onClick={handleOpenProject}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors"
          title={collapsed ? '打开项目' : undefined}>
          <FolderOpen className="w-4 h-4 shrink-0" />
          {!collapsed && <span>{projectPath ? '切换项目' : '打开项目'}</span>}
        </button>

        {bottomItems.map((item) => {
          const isActive = location.pathname === item.to
          return (
            <NavLink key={item.to} to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-zinc-800 text-violet-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
              title={collapsed ? item.label : undefined}>
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}

        <button onClick={toggleSidebar}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300 transition-colors"
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}>
          {collapsed ? <PanelLeftOpen className="w-4 h-4 shrink-0" /> : (
            <><PanelLeftClose className="w-4 h-4 shrink-0" /><span>收起</span></>
          )}
        </button>
      </div>
    </aside>
  )
}
