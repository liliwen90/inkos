import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, PenTool, BookOpen, ScrollText, Settings,
  PanelLeftClose, PanelLeftOpen, FolderOpen, Feather, Download,
  BarChart3, ShieldAlert, Sparkles, Lightbulb, GraduationCap, Palette, TrendingUp, Archive
} from 'lucide-react'
import { useAppStore } from '../../stores/app-store'

const THEMES = [
  { id: 'twilight', name: '暗夜紫', dot: '#8b5cf6' },
  { id: 'ocean', name: '碧海蓝', dot: '#60a5fa' },
  { id: 'forest', name: '青峦绿', dot: '#2dd4bf' },
  { id: 'parchment', name: '暖纸黄', dot: '#fbbf24' },
  { id: 'mint', name: '薄荷夜', dot: '#14b8a6' },
]

const navItems = [
  // ── Book Inception Pipeline ──
  { to: '/trending', icon: TrendingUp, label: '热榜雷达', section: 'inception' },
  { to: '/idea-vault', icon: Archive, label: '创意库' },
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/style-analysis', icon: BarChart3, label: '风格分析' },
  { to: '/suggestions', icon: Lightbulb, label: 'AI 建议' },
  { to: '/humanize', icon: Sparkles, label: '人性化引擎' },
  // ── Chapter Production Pipeline ──
  { to: '/writing', icon: PenTool, label: '写作控制台', section: 'production' },
  { to: '/chapters', icon: BookOpen, label: '章节管理' },
  { to: '/detection', icon: ShieldAlert, label: 'AIGC 检测' },
  { to: '/truth-files', icon: ScrollText, label: '真相文件' },
  { to: '/export', icon: Download, label: '导出' },
]

const bottomItems = [
  { to: '/tutorial', icon: GraduationCap, label: '使用教程' },
  { to: '/settings', icon: Settings, label: 'LLM 配置' }
]

export default function Sidebar(): JSX.Element {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const projectPath = useAppStore((s) => s.projectPath)
  const pipelineReady = useAppStore((s) => s.pipelineReady)
  const setProjectPath = useAppStore((s) => s.setProjectPath)
  const setProjectLoaded = useAppStore((s) => s.setProjectLoaded)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
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
      <nav className="flex-1 py-1 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to
          const sectionLabel = 'section' in item
            ? (item as { section: string }).section === 'production' ? '生产线' : '选题'
            : null
          return (
            <div key={item.to}>
              {sectionLabel && (
                <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                  <div className="flex-1 border-t border-zinc-800" />
                  {!collapsed && (
                    <span className="text-[9px] text-zinc-600 uppercase tracking-widest shrink-0">
                      {sectionLabel}
                    </span>
                  )}
                  <div className="flex-1 border-t border-zinc-800" />
                </div>
              )}
              <NavLink to={item.to}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-zinc-800 text-violet-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
                title={collapsed ? item.label : undefined}>
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </div>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-1 space-y-0.5 border-t border-zinc-800">
        <button onClick={handleOpenProject}
          className="flex items-center gap-3 w-full px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors"
          title={collapsed ? '打开项目' : undefined}>
          <FolderOpen className="w-4 h-4 shrink-0" />
          {!collapsed && <span>{projectPath ? '切换项目' : '打开项目'}</span>}
        </button>

        {bottomItems.map((item) => {
          const isActive = location.pathname === item.to
          return (
            <NavLink key={item.to} to={item.to}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-zinc-800 text-violet-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
              title={collapsed ? item.label : undefined}>
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}

        {/* 主题切换 */}
        {!collapsed ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <Palette className="w-4 h-4 text-zinc-500 shrink-0" />
            <div className="flex gap-1.5">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => setTheme(t.id)}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    theme === t.id ? 'border-zinc-300 scale-125' : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: t.dot }}
                  title={t.name} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-2">
            {THEMES.map((t) => (
              <button key={t.id} onClick={() => setTheme(t.id)}
                className={`w-3 h-3 rounded-full border transition-all ${
                  theme === t.id ? 'border-zinc-300 scale-125' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: t.dot }}
                title={t.name} />
            ))}
          </div>
        )}

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
