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
  LLMClient
} from '@actalk/inkos-core'

export interface ProgressEvent {
  stage: string
  detail: string
  timestamp: number
}

/**
 * 管线适配器 — 包装 PipelineRunner，添加进度拦截和错误规范化
 */
export class PipelineAdapter extends EventEmitter {
  private runner: PipelineRunnerType | null = null

  async initialize(client: LLMClient, model: string, projectRoot: string): Promise<void> {
    const { PipelineRunner } = await import('@actalk/inkos-core')
    this.runner = new PipelineRunner({ client, model, projectRoot })
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
      this.emitProgress('pipeline-start', '管线启动: 写→审→改')
      try {
        const result = await originalWriteNext(...args)
        this.emitProgress('pipeline-done', `完成: 第${result.chapterNumber}章「${result.title}」${result.wordCount}字`)
        return result
      } catch (err) {
        this.emitProgress('pipeline-error', `管线失败: ${(err as Error).message}`)
        throw err
      }
    }
  }

  async initBook(book: BookConfig): Promise<void> {
    this.emitProgress('architect', `建筑师Agent正在为「${book.title}」生成世界观...`)
    try {
      await this.getRunner().initBook(book)
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

  async readTruthFiles(bookId: string): Promise<TruthFiles> {
    return this.getRunner().readTruthFiles(bookId)
  }

  async getBookStatus(bookId: string): Promise<BookStatusInfo> {
    return this.getRunner().getBookStatus(bookId)
  }

  destroy(): void {
    this.removeAllListeners()
    this.runner = null
  }
}
