import { EventEmitter } from 'events'
import type {
  PipelineRunner as PipelineRunnerType,
  ChapterPipelineResult,
  DraftResult,
  AuditResult,
  ReviseResult,
  ReviseMode,
  TruthFiles,
  BookStatusInfo,
  BookConfig,
  LLMClient,
  ContinuityPlusResult,
  PolishResult,
  PlanEntry,
  GatePayload,
  GateDecision,
  ChapterLandmarkPayload,
} from '@actalk/hintos-core'

export interface ProgressEvent {
  stage: string
  detail: string
  timestamp: number
}

/**
 * 管线适配器 — 包装 PipelineRunner，添加进度拦截、Gate、Agent Report 和 Chapter Landmark
 */
export class PipelineAdapter extends EventEmitter {
  private runner: PipelineRunnerType | null = null
  // Gate promise management: when a gate fires, we store the resolver here
  private pendingGateResolvers = new Map<string, (decision: GateDecision) => void>()
  // Interaction mode (synced from frontend)
  private interactionMode: 'interactive' | 'auto-report' | 'silent' = 'auto-report'

  setInteractionMode(mode: 'interactive' | 'auto-report' | 'silent'): void {
    this.interactionMode = mode
  }

  async initialize(client: LLMClient, model: string, projectRoot: string, modelOverrides?: Record<string, string>): Promise<void> {
    const { PipelineRunner } = await import('@actalk/hintos-core')
    this.runner = new PipelineRunner({
      client, model, projectRoot, modelOverrides,
      onProgress: (stage, detail) => this.emitProgress(stage, detail),
      onGate: (payload) => this.handleGate(payload),
      onAgentReport: (report) => this.emit('agent-report', report),
      onChapterLandmark: (landmark) => this.emit('chapter-landmark', landmark),
    })
    this.interceptMethods()
  }

  isInitialized(): boolean {
    return this.runner !== null
  }

  private getRunner(): PipelineRunnerType {
    if (!this.runner) throw new Error('管线未初始化，请先配置LLM并打开项目')
    return this.runner
  }

  private emitProgress(stage: string, detail: string): void {
    this.emit('progress', { stage, detail, timestamp: Date.now() } satisfies ProgressEvent)
  }

  /** Handle a gate request from the runner — creates a pending promise and emits the gate payload */
  private handleGate(payload: GatePayload): Promise<GateDecision> {
    // Silent mode: auto-approve everything
    if (this.interactionMode === 'silent') {
      this.emit('agent-report', { agentName: payload.agentName, content: payload.summary, richData: payload.data })
      return Promise.resolve({ action: 'approve' })
    }

    // Auto-report mode: emit report but auto-approve (no blocking)
    if (this.interactionMode === 'auto-report') {
      this.emit('gate', payload) // Still show in UI, but...
      // Auto-resolve after 3 seconds (just enough for user to see)
      return new Promise<GateDecision>((resolve) => {
        this.pendingGateResolvers.set(payload.stage, resolve)
        setTimeout(() => {
          if (this.pendingGateResolvers.has(payload.stage)) {
            this.pendingGateResolvers.delete(payload.stage)
            resolve({ action: 'approve' })
          }
        }, 3000)
      })
    }

    // Interactive mode: block until user responds
    return new Promise<GateDecision>((resolve) => {
      this.pendingGateResolvers.set(payload.stage, resolve)
      this.emit('gate', payload)
      // Safety timeout: 10 minutes for interactive mode
      setTimeout(() => {
        if (this.pendingGateResolvers.has(payload.stage)) {
          this.pendingGateResolvers.delete(payload.stage)
          resolve({ action: 'approve' })
        }
      }, 10 * 60 * 1000)
    })
  }

  /** Called when user responds to a gate via IPC */
  resolveGate(stage: string, action: string, feedback?: string): boolean {
    const resolver = this.pendingGateResolvers.get(stage)
    if (!resolver) return false
    this.pendingGateResolvers.delete(stage)
    resolver({ action, feedback })
    return true
  }

  private interceptMethods(): void {
    const runner = this.getRunner()

    const originalWriteDraft = runner.writeDraft.bind(runner)
    runner.writeDraft = async (...args: Parameters<typeof runner.writeDraft>) => {
      this.emitProgress('writer', '写手Agent正在创作...')
      try {
        const result = await originalWriteDraft(...args)
        this.emitProgress('writer-done', `草稿完成 ${result.wordCount}字`)
        return result
      } catch (err) {
        this.emitProgress('writer-error', `写作失败: ${(err as Error).message}`)
        throw err
      }
    }

    const originalAuditDraft = runner.auditDraft.bind(runner)
    runner.auditDraft = async (...args: Parameters<typeof runner.auditDraft>) => {
      this.emitProgress('auditor', '连续性审计中...')
      try {
        const result = await originalAuditDraft(...args)
        this.emitProgress('auditor-done', `审计完成，${result.issues?.length ?? 0}个问题`)
        return result
      } catch (err) {
        this.emitProgress('auditor-error', `审计失败: ${(err as Error).message}`)
        throw err
      }
    }

    const originalReviseDraft = runner.reviseDraft.bind(runner)
    runner.reviseDraft = async (...args: Parameters<typeof runner.reviseDraft>) => {
      this.emitProgress('reviser', '修订Agent修改中...')
      try {
        const result = await originalReviseDraft(...args)
        this.emitProgress('reviser-done', '修订完成')
        return result
      } catch (err) {
        this.emitProgress('reviser-error', `修订失败: ${(err as Error).message}`)
        throw err
      }
    }

    const originalWriteNext = runner.writeNextChapter.bind(runner)
    runner.writeNextChapter = async (...args: Parameters<typeof runner.writeNextChapter>) => {
      this.emitProgress('pipeline', '管线启动: 写→审→查→改→润')
      try {
        const result = await originalWriteNext(...args)
        this.emitProgress('pipeline-done', `完成: 第${result.chapterNumber}章「${result.title}」${result.wordCount}字`)
        return result
      } catch (err) {
        this.emitProgress('pipeline-error', `管线失败: ${(err as Error).message}`)
        throw err
      }
    }

    const originalCheckCP = runner.checkContinuityPlus.bind(runner)
    runner.checkContinuityPlus = async (...args: Parameters<typeof runner.checkContinuityPlus>) => {
      this.emitProgress('continuity-plus', '深度连续性审查中(7维度)...')
      try {
        const result = await originalCheckCP(...args)
        this.emitProgress('continuity-plus-done', `审查完成，${result.issues?.length ?? 0}个问题`)
        return result
      } catch (err) {
        this.emitProgress('continuity-plus-error', `深度审查失败: ${(err as Error).message}`)
        throw err
      }
    }

    const originalPolish = runner.polishDraft.bind(runner)
    runner.polishDraft = async (...args: Parameters<typeof runner.polishDraft>) => {
      this.emitProgress('polisher', '文学润色中(7维度)...')
      try {
        const result = await originalPolish(...args)
        this.emitProgress('polisher-done', `润色完成，${result.changes?.length ?? 0}处修改`)
        return result
      } catch (err) {
        this.emitProgress('polisher-error', `润色失败: ${(err as Error).message}`)
        throw err
      }
    }
  }

  async initBook(book: BookConfig, externalContext?: string): Promise<void> {
    this.emitProgress('architect', `建筑师Agent正在为「${book.title}」生成世界观...`)
    try {
      await this.getRunner().initBook(book, externalContext)
      this.emitProgress('architect-done', `「${book.title}」创建完成`)
    } catch (err) {
      this.emitProgress('architect-error', `创建失败: ${(err as Error).message}`)
      throw err
    }
  }

  async writeNext(bookId: string, wordCount?: number, tempOverride?: number): Promise<ChapterPipelineResult> {
    return this.getRunner().writeNextChapter(bookId, wordCount, tempOverride)
  }

  async auditDraft(bookId: string, chapterNumber?: number): Promise<AuditResult> {
    return this.getRunner().auditDraft(bookId, chapterNumber)
  }

  async reviseDraft(bookId: string, chapterNumber?: number, mode?: ReviseMode): Promise<ReviseResult> {
    return this.getRunner().reviseDraft(bookId, chapterNumber, mode)
  }

  async checkContinuityPlus(bookId: string, chapterNumber?: number): Promise<ContinuityPlusResult & { chapterNumber: number }> {
    return this.getRunner().checkContinuityPlus(bookId, chapterNumber)
  }

  async polishDraft(bookId: string, chapterNumber?: number): Promise<PolishResult & { chapterNumber: number }> {
    return this.getRunner().polishDraft(bookId, chapterNumber)
  }

  async readTruthFiles(bookId: string): Promise<TruthFiles> {
    return this.getRunner().readTruthFiles(bookId)
  }

  async getBookStatus(bookId: string): Promise<BookStatusInfo> {
    return this.getRunner().getBookStatus(bookId)
  }

  // ===== 章节大纲规划 (需 LLM) =====

  async planNextChapter(bookId: string): Promise<PlanEntry> {
    // Core runner 内部已通过 onProgress 回调发射 architect/architect-done 事件
    try {
      return await this.getRunner().planNextChapter(bookId)
    } catch (err) {
      this.emitProgress('architect-error', `大纲规划失败: ${(err as Error).message}`)
      throw err
    }
  }

  async replanChapter(bookId: string, chapterNumber: number, feedback: string): Promise<PlanEntry> {
    // Core runner 内部已通过 onProgress 回调发射 architect/architect-done 事件
    try {
      return await this.getRunner().replanChapter(bookId, chapterNumber, feedback)
    } catch (err) {
      this.emitProgress('architect-error', `大纲重新规划失败: ${(err as Error).message}`)
      throw err
    }
  }

  destroy(): void {
    // Resolve any pending gates before destroying
    for (const [, resolver] of this.pendingGateResolvers) {
      resolver({ action: 'approve' })
    }
    this.pendingGateResolvers.clear()
    this.removeAllListeners()
    this.runner = null
  }
}
