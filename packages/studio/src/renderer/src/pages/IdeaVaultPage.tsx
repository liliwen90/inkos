import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Clock, Trash2, Sparkles, Pencil, Save, X, Loader2, Plus } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { AnalysisRenderer, type ParsedIdea } from '../components/AnalysisRenderer'
import CreateBookDialog from '../components/CreateBookDialog'

interface VaultEntry {
  id: string
  createdAt: string
  novelCount: number
  language: 'en' | 'zh'
  preview: string
}

interface VaultDetail {
  id: string
  createdAt: string
  novelCount: number
  language: 'en' | 'zh'
  analysis: string
}

export default function IdeaVaultPage(): JSX.Element {
  const navigate = useNavigate()
  const setPendingBookDraft = useAppStore((s) => s.setPendingBookDraft)
  const addToast = useAppStore((s) => s.addToast)
  const pipelineReady = useAppStore((s) => s.pipelineReady)
  const projectLoaded = useAppStore((s) => s.projectLoaded)
  const [showCreate, setShowCreate] = useState(false)

  const [vault, setVault] = useState<VaultEntry[]>([])
  const [viewing, setViewing] = useState<VaultDetail | null>(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadVault = useCallback(async () => {
    try { setVault(await window.hintos.vaultList()) } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadVault() }, [loadVault])

  const handleView = async (id: string): Promise<void> => {
    try {
      setError(null)
      setLoadingDetail(true)
      const detail = await window.hintos.vaultGet(id)
      setViewing(detail)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('确定要删除这条创意记录吗？')) return
    try {
      await window.hintos.vaultDelete(id)
      if (viewing?.id === id) { setViewing(null); setEditing(false) }
      await loadVault()
      addToast('success', '✓ 已删除')
    } catch { /* ignore */ }
  }

  const handleStartEdit = (): void => {
    if (!viewing) return
    setEditText(viewing.analysis)
    setEditing(true)
  }

  const handleSaveEdit = async (): Promise<void> => {
    if (!viewing) return
    setSaving(true)
    try {
      await window.hintos.vaultUpdate(viewing.id, editText)
      setViewing({ ...viewing, analysis: editText })
      setEditing(false)
      addToast('success', '✓ 已保存')
      await loadVault()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
      addToast('error', `保存失败: ${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSendIdea = (idea: ParsedIdea): void => {
    setPendingBookDraft({
      title: idea.title,
      genre: idea.genre,
      platform: idea.platform,
      targetChapters: idea.targetChapters,
      chapterWords: idea.chapterWords,
      context: idea.context,
      language: idea.language
    })
    setShowCreate(true)
  }

  const handleCreateClose = (): void => {
    setShowCreate(false)
    // 创建完成后跳转到仪表盘查看新书
    navigate('/')
  }

  // 详情视图
  if (viewing) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setViewing(null); setEditing(false) }}
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ← 返回创意库
          </button>
          <div className="flex items-center gap-2">
            {!editing && (
              <>
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> 编辑
                </button>
                <button
                  onClick={() => handleDelete(viewing.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-red-900/50 text-zinc-300 hover:text-red-300 rounded-lg text-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 删除
                </button>
              </>
            )}
            {editing && (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Save className="w-3.5 h-3.5" /> {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> 取消
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-zinc-800/60 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-zinc-200">AI 选题推荐</h2>
            <span className="text-xs text-zinc-500 ml-auto">
              {new Date(viewing.createdAt).toLocaleString('zh-CN')} · 基于 {viewing.novelCount} 部热门小说
              <span className={`ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${
                viewing.language === 'en'
                  ? 'bg-blue-900/50 text-blue-400'
                  : 'bg-amber-900/50 text-amber-400'
              }`}>
                {viewing.language === 'en' ? 'EN 英文小说' : 'ZH 中文小说'}
              </span>
            </span>
          </div>

          {editing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full h-[calc(100vh-280px)] bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-300 font-mono leading-relaxed focus:outline-none focus:border-violet-500 resize-none"
            />
          ) : (
            <AnalysisRenderer analysis={viewing.analysis} onSendIdea={handleSendIdea} language={viewing.language} />
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">{error}</div>
        )}
      </div>
    )
  }

  // 列表视图
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Archive className="w-7 h-7 text-violet-400" />
          <h1 className="text-2xl font-bold text-zinc-100">创意库</h1>
          <span className="text-sm text-zinc-500">管理你的 AI 选题推荐记录</span>
        </div>
        <button onClick={() => setShowCreate(true)} disabled={!pipelineReady || !projectLoaded}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          title={!pipelineReady ? '请先配置 LLM 连接' : ''}>
          <Plus className="w-4 h-4" /> 新建空白书籍
        </button>
      </div>

      {showCreate && <CreateBookDialog onClose={handleCreateClose} />}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">{error}</div>
      )}

      {vault.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-3">
          <Archive className="w-12 h-12 text-zinc-600" />
          <p>创意库为空</p>
          <p className="text-xs text-zinc-600">前往「热榜雷达」生成 AI 选题推荐，结果会自动保存到这里</p>
          <button
            onClick={() => navigate('/trending')}
            className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            前往热榜雷达
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {vault.map((entry) => (
            <div
              key={entry.id}
              className="bg-zinc-800/40 hover:bg-zinc-800/70 rounded-lg p-4 flex items-start gap-3 cursor-pointer transition-colors group"
              onClick={() => handleView(entry.id)}
            >
              <Clock className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-zinc-300 font-medium">
                    {new Date(entry.createdAt).toLocaleString('zh-CN')}
                  </span>
                  <span className="text-xs text-zinc-500">{entry.novelCount} 部小说</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    entry.language === 'en'
                      ? 'bg-blue-900/50 text-blue-400'
                      : 'bg-amber-900/50 text-amber-400'
                  }`}>
                    {entry.language === 'en' ? 'EN 英文' : 'ZH 中文'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate">{entry.preview}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(entry.id) }}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
