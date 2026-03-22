import type { LLMClient } from "../llm/provider.js";
import type { BookConfig } from "../models/book.js";
import type { ChapterMeta } from "../models/chapter.js";
import type { NotifyChannel } from "../models/project.js";
import type { GenreProfile } from "../models/genre-profile.js";
import type { PlanEntry, PlanIndex, PlanStats, PlanTruthFiles } from "../models/plan.js";
import { ArchitectAgent } from "../agents/architect.js";
import { WriterAgent } from "../agents/writer.js";
import { ContinuityAuditor } from "../agents/continuity.js";
import { ContinuityPlusAgent, type ContinuityPlusResult } from "../agents/continuity-plus.js";
import { PolisherAgent, type PolishResult } from "../agents/polisher.js";
import { EntityExtractorAgent } from "../agents/entity-extractor.js";
import { ReviserAgent, type ReviseMode } from "../agents/reviser.js";
import { RadarAgent } from "../agents/radar.js";
import type { RadarSource } from "../agents/radar-source.js";
import { readGenreProfile } from "../agents/rules-reader.js";
import { analyzeAITells } from "../agents/ai-tells.js";
import { analyzeSensitiveWords } from "../agents/sensitive-words.js";
import { StateManager } from "../state/manager.js";
import { dispatchNotification, dispatchWebhookEvent } from "../notify/dispatcher.js";
import type { WebhookEvent } from "../notify/webhook.js";
import type { AgentContext } from "../agents/base.js";
import type { AuditResult, AuditIssue } from "../agents/continuity.js";
import type { RadarResult } from "../agents/radar.js";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// Gate system — allows UI to pause pipeline and collect user decision
export interface GateAction {
  readonly id: string;
  readonly label: string;
  readonly variant: "primary" | "secondary" | "danger";
}

export interface GatePayload {
  readonly stage: string;
  readonly agentName: string;
  readonly summary: string;
  readonly data?: Record<string, unknown>;
  readonly actions: ReadonlyArray<GateAction>;
}

export interface GateDecision {
  readonly action: string;   // matches GateAction.id
  readonly feedback?: string;
}

// Chapter Landmark — emitted after each chapter completes the full pipeline
export interface ChapterLandmarkPayload {
  readonly chapterNum: number;
  readonly title: string;
  readonly wordCount: number;
  readonly characters: string[];
  readonly hooksAdded: ReadonlyArray<{ id: string; brief: string }>;
  readonly hooksResolved: ReadonlyArray<{ id: string; brief: string }>;
  readonly auditCritical: number;
  readonly chapterSummary: string;
}

export interface PipelineConfig {
  readonly client: LLMClient;
  readonly model: string;
  readonly projectRoot: string;
  readonly notifyChannels?: ReadonlyArray<NotifyChannel>;
  readonly radarSources?: ReadonlyArray<RadarSource>;
  readonly externalContext?: string;
  readonly modelOverrides?: Record<string, string>;
  /** Optional progress callback — called at each pipeline sub-stage */
  readonly onProgress?: (stage: string, detail: string) => void;
  /** Gate callback — when provided, pipeline can pause at key decision points */
  readonly onGate?: (payload: GatePayload) => Promise<GateDecision>;
  /** Agent report callback — agents emit structured reports for the chat panel */
  readonly onAgentReport?: (report: { agentName: string; content: string; richData?: Record<string, unknown> }) => void;
  /** Chapter landmark callback — emitted on pipeline completion */
  readonly onChapterLandmark?: (landmark: ChapterLandmarkPayload) => void;
}

export interface ChapterPipelineResult {
  readonly chapterNumber: number;
  readonly title: string;
  readonly wordCount: number;
  readonly auditResult: AuditResult;
  readonly revised: boolean;
  readonly status: "approved" | "needs-review";
}

// Atomic operation results
export interface DraftResult {
  readonly chapterNumber: number;
  readonly title: string;
  readonly wordCount: number;
  readonly filePath: string;
}

export interface ReviseResult {
  readonly chapterNumber: number;
  readonly wordCount: number;
  readonly fixedIssues: ReadonlyArray<string>;
}

export interface TruthFiles {
  readonly currentState: string;
  readonly particleLedger: string;
  readonly pendingHooks: string;
  readonly storyBible: string;
  readonly volumeOutline: string;
  readonly bookRules: string;
}

export interface BookStatusInfo {
  readonly bookId: string;
  readonly title: string;
  readonly genre: string;
  readonly platform: string;
  readonly status: string;
  readonly chaptersWritten: number;
  readonly totalWords: number;
  readonly nextChapter: number;
  readonly chapters: ReadonlyArray<ChapterMeta>;
}

export class PipelineRunner {
  private readonly state: StateManager;
  private readonly config: PipelineConfig;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.state = new StateManager(config.projectRoot);
  }

  private agentCtx(bookId?: string): AgentContext {
    return {
      client: this.config.client,
      model: this.config.model,
      projectRoot: this.config.projectRoot,
      bookId,
    };
  }

  private modelFor(agentName: string): string {
    return this.config.modelOverrides?.[agentName] ?? this.config.model;
  }

  private agentCtxFor(agent: string, bookId?: string): AgentContext {
    return {
      client: this.config.client,
      model: this.modelFor(agent),
      projectRoot: this.config.projectRoot,
      bookId,
    };
  }

  private progress(stage: string, detail: string): void {
    this.config.onProgress?.(stage, detail);
  }

  /** Pause the pipeline at a gate point and wait for user decision.
   *  Returns 'approve' action if no gate callback is registered (auto-continue). */
  private async gate(payload: GatePayload): Promise<GateDecision> {
    if (!this.config.onGate) return { action: "approve" };
    return this.config.onGate(payload);
  }

  /** Emit an agent report to the chat panel. */
  private report(agentName: string, content: string, richData?: Record<string, unknown>): void {
    this.config.onAgentReport?.({ agentName, content, richData });
  }

  /** Emit a chapter landmark after pipeline completion. */
  private emitLandmark(landmark: ChapterLandmarkPayload): void {
    this.config.onChapterLandmark?.(landmark);
  }

  private async loadGenreProfile(genre: string): Promise<{ profile: GenreProfile }> {
    const parsed = await readGenreProfile(this.config.projectRoot, genre);
    return { profile: parsed.profile };
  }

  // ---------------------------------------------------------------------------
  // Atomic operations (composable by OpenClaw or agent mode)
  // ---------------------------------------------------------------------------

  async runRadar(): Promise<RadarResult> {
    const radar = new RadarAgent(this.agentCtxFor("radar"), this.config.radarSources);
    return radar.scan();
  }

  async initBook(book: BookConfig, externalContext?: string): Promise<void> {
    const architect = new ArchitectAgent(this.agentCtxFor("architect", book.id));
    const bookDir = this.state.bookDir(book.id);

    await this.state.saveBookConfig(book.id, book);

    const { profile: gp } = await this.loadGenreProfile(book.genre);
    const foundation = await architect.generateFoundation(book, externalContext ?? this.config.externalContext);

    // 验证所有核心 section 都被成功生成（非占位符）
    const sections = ['storyBible', 'volumeOutline', 'bookRules', 'currentState', 'pendingHooks'] as const;
    for (const s of sections) {
      if (foundation[s].startsWith('[') && foundation[s].includes('生成失败')) {
        throw new Error(`建筑师生成 ${s} 失败，请重试。可能是 LLM 返回格式异常。`);
      }
    }

    await architect.writeFoundationFiles(bookDir, foundation, gp.numericalSystem);
    await this.state.saveChapterIndex(book.id, []);
  }

  /** Write a single draft chapter. Saves chapter file + truth files + index + snapshot. */
  async writeDraft(bookId: string, context?: string, wordCount?: number): Promise<DraftResult> {
    const releaseLock = await this.state.acquireBookLock(bookId);
    try {
      const book = await this.state.loadBookConfig(bookId);
      const bookDir = this.state.bookDir(bookId);
      const chapterNumber = await this.state.getNextChapterNumber(bookId);

      const { profile: gp } = await this.loadGenreProfile(book.genre);

      // Load persisted creative context as fallback
      let effectiveContext = context ?? this.config.externalContext;
      if (!effectiveContext) {
        try {
          const cc = await readFile(join(bookDir, "story", "creative_context.md"), "utf-8");
          if (cc.trim()) effectiveContext = cc.trim();
        } catch { /* file may not exist */ }
      }

      const writer = new WriterAgent(this.agentCtxFor("writer", bookId));
      const output = await writer.writeChapter({
        book,
        bookDir,
        chapterNumber,
        externalContext: effectiveContext,
        ...(wordCount ? { wordCountOverride: wordCount } : {}),
      });

      // Save chapter file
      const chaptersDir = join(bookDir, "chapters");
      const paddedNum = String(chapterNumber).padStart(4, "0");
      const sanitized = output.title.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_").slice(0, 50);
      const filename = `${paddedNum}_${sanitized}.md`;
      const filePath = join(chaptersDir, filename);

      const en = gp.language === "en";
      const chapterHeader = en
        ? `# Chapter ${chapterNumber}: ${output.title}`
        : `# 第${chapterNumber}章 ${output.title}`;

      await writeFile(filePath, `${chapterHeader}\n\n${output.content}`, "utf-8");

      // Save truth files
      await writer.saveChapter(bookDir, output, gp.numericalSystem, en);
      await writer.saveNewTruthFiles(bookDir, output);

      // Extract entities for long-term memory
      try {
        const extractor = new EntityExtractorAgent(this.agentCtxFor("writer", bookId));
        await extractor.extractAndMerge(bookDir, output.content, chapterNumber, book.genre);
      } catch { /* non-critical */ }

      // Update index
      const existingIndex = await this.state.loadChapterIndex(bookId);
      const now = new Date().toISOString();
      const newEntry: ChapterMeta = {
        number: chapterNumber,
        title: output.title,
        status: "drafted",
        wordCount: output.wordCount,
        createdAt: now,
        updatedAt: now,
        auditIssues: [],
      };
      await this.state.saveChapterIndex(bookId, [...existingIndex, newEntry]);

      // Snapshot
      await this.state.snapshotState(bookId, chapterNumber);

      await this.emitWebhook("chapter-complete", bookId, chapterNumber, {
        title: output.title,
        wordCount: output.wordCount,
      });

      return { chapterNumber, title: output.title, wordCount: output.wordCount, filePath };
    } finally {
      await releaseLock();
    }
  }

  /** Audit the latest (or specified) chapter. Read-only, no lock needed. */
  async auditDraft(bookId: string, chapterNumber?: number): Promise<AuditResult & { readonly chapterNumber: number }> {
    const book = await this.state.loadBookConfig(bookId);
    const bookDir = this.state.bookDir(bookId);
    const targetChapter = chapterNumber ?? (await this.state.getNextChapterNumber(bookId)) - 1;
    if (targetChapter < 1) {
      throw new Error(`No chapters to audit for "${bookId}"`);
    }

    const content = await this.readChapterContent(bookDir, targetChapter);
    const auditor = new ContinuityAuditor(this.agentCtxFor("auditor", bookId));
    const llmResult = await auditor.auditChapter(bookDir, content, targetChapter, book.genre);

    // Merge rule-based AI-tell detection (language-aware)
    const { profile: gpForTells } = await this.loadGenreProfile(book.genre);
    const aiTells = analyzeAITells(content, gpForTells.language);
    // Merge sensitive word detection
    const sensitiveResult = analyzeSensitiveWords(content);
    const hasBlockedWords = sensitiveResult.found.some((f) => f.severity === "block");
    const mergedIssues: ReadonlyArray<AuditIssue> = [
      ...llmResult.issues,
      ...aiTells.issues,
      ...sensitiveResult.issues,
    ];
    const result: AuditResult = {
      passed: hasBlockedWords ? false : llmResult.passed,
      issues: mergedIssues,
      summary: llmResult.summary,
    };

    // Update index with audit result
    const index = await this.state.loadChapterIndex(bookId);
    const updated = index.map((ch) =>
      ch.number === targetChapter
        ? {
            ...ch,
            status: (result.passed ? "ready-for-review" : "audit-failed") as ChapterMeta["status"],
            updatedAt: new Date().toISOString(),
            auditIssues: result.issues.map((i) => `[${i.severity}] ${i.description}`),
          }
        : ch,
    );
    await this.state.saveChapterIndex(bookId, updated);

    await this.emitWebhook(
      result.passed ? "audit-passed" : "audit-failed",
      bookId,
      targetChapter,
      { summary: result.summary, issueCount: result.issues.length },
    );

    return { ...result, chapterNumber: targetChapter };
  }

  /** Revise the latest (or specified) chapter based on audit issues. */
  async reviseDraft(bookId: string, chapterNumber?: number, mode: ReviseMode = "rewrite"): Promise<ReviseResult> {
    const releaseLock = await this.state.acquireBookLock(bookId);
    try {
      const book = await this.state.loadBookConfig(bookId);
      const bookDir = this.state.bookDir(bookId);
      const targetChapter = chapterNumber ?? (await this.state.getNextChapterNumber(bookId)) - 1;
      if (targetChapter < 1) {
        throw new Error(`No chapters to revise for "${bookId}"`);
      }

      // Read the current audit issues from index
      const index = await this.state.loadChapterIndex(bookId);
      const chapterMeta = index.find((ch) => ch.number === targetChapter);
      if (!chapterMeta) {
        throw new Error(`Chapter ${targetChapter} not found in index`);
      }

      // Re-audit to get structured issues (index only stores strings)
      const content = await this.readChapterContent(bookDir, targetChapter);
      const auditor = new ContinuityAuditor(this.agentCtxFor("auditor", bookId));
      const auditResult = await auditor.auditChapter(bookDir, content, targetChapter, book.genre);

      if (auditResult.passed) {
        return { chapterNumber: targetChapter, wordCount: content.length, fixedIssues: ["No issues to fix"] };
      }

      const { profile: gp } = await this.loadGenreProfile(book.genre);

      const reviser = new ReviserAgent(this.agentCtxFor("reviser", bookId));
      const reviseOutput = await reviser.reviseChapter(
        bookDir, content, targetChapter, auditResult.issues, mode, book.genre,
      );

      if (reviseOutput.revisedContent.length === 0) {
        throw new Error("Reviser returned empty content");
      }

      // Save revised chapter file
      const chaptersDir = join(bookDir, "chapters");
      const files = await readdir(chaptersDir);
      const paddedNum = String(targetChapter).padStart(4, "0");
      const existingFile = files.find((f) => f.startsWith(paddedNum) && f.endsWith(".md"));
      if (existingFile) {
        const en = gp.language === "en";
        const revHeader = en
          ? `# Chapter ${targetChapter}: ${chapterMeta.title}`
          : `# 第${targetChapter}章 ${chapterMeta.title}`;
        await writeFile(
          join(chaptersDir, existingFile),
          `${revHeader}\n\n${reviseOutput.revisedContent}`,
          "utf-8",
        );
      }

      // Update truth files
      const storyDir = join(bookDir, "story");
      if (reviseOutput.updatedState !== "(状态卡未更新)") {
        await writeFile(join(storyDir, "current_state.md"), reviseOutput.updatedState, "utf-8");
      }
      if (gp.numericalSystem && reviseOutput.updatedLedger && reviseOutput.updatedLedger !== "(账本未更新)") {
        await writeFile(join(storyDir, "particle_ledger.md"), reviseOutput.updatedLedger, "utf-8");
      }
      if (reviseOutput.updatedHooks !== "(伏笔池未更新)") {
        await writeFile(join(storyDir, "pending_hooks.md"), reviseOutput.updatedHooks, "utf-8");
      }

      // Update index
      const updatedIndex = index.map((ch) =>
        ch.number === targetChapter
          ? {
              ...ch,
              status: "ready-for-review" as ChapterMeta["status"],
              wordCount: reviseOutput.wordCount,
              updatedAt: new Date().toISOString(),
            }
          : ch,
      );
      await this.state.saveChapterIndex(bookId, updatedIndex);

      // Re-snapshot
      await this.state.snapshotState(bookId, targetChapter);

      await this.emitWebhook("revision-complete", bookId, targetChapter, {
        wordCount: reviseOutput.wordCount,
        fixedCount: reviseOutput.fixedIssues.length,
      });

      return {
        chapterNumber: targetChapter,
        wordCount: reviseOutput.wordCount,
        fixedIssues: reviseOutput.fixedIssues,
      };
    } finally {
      await releaseLock();
    }
  }

  /** Deep continuity audit (ContinuityPlus) — 7 narrative dimensions. Read-only. */
  async checkContinuityPlus(bookId: string, chapterNumber?: number): Promise<ContinuityPlusResult & { readonly chapterNumber: number }> {
    const book = await this.state.loadBookConfig(bookId);
    const bookDir = this.state.bookDir(bookId);
    const targetChapter = chapterNumber ?? (await this.state.getNextChapterNumber(bookId)) - 1;
    if (targetChapter < 1) throw new Error(`No chapters to check for "${bookId}"`);

    const content = await this.readChapterContent(bookDir, targetChapter);
    const agent = new ContinuityPlusAgent(this.agentCtxFor("continuity-plus", bookId));
    const result = await agent.check(bookDir, content, targetChapter, book.genre);
    return { ...result, chapterNumber: targetChapter };
  }

  /** Polish the latest (or specified) chapter for literary quality. Saves polished content. */
  async polishDraft(bookId: string, chapterNumber?: number): Promise<PolishResult & { readonly chapterNumber: number }> {
    const releaseLock = await this.state.acquireBookLock(bookId);
    try {
      const book = await this.state.loadBookConfig(bookId);
      const bookDir = this.state.bookDir(bookId);
      const targetChapter = chapterNumber ?? (await this.state.getNextChapterNumber(bookId)) - 1;
      if (targetChapter < 1) throw new Error(`No chapters to polish for "${bookId}"`);

      const content = await this.readChapterContent(bookDir, targetChapter);
      const agent = new PolisherAgent(this.agentCtxFor("polisher", bookId));
      const result = await agent.polish(bookDir, content, targetChapter, book.genre);

      // Save polished content back
      const chaptersDir = join(bookDir, "chapters");
      const files = await readdir(chaptersDir);
      const paddedNum = String(targetChapter).padStart(4, "0");
      const existingFile = files.find((f) => f.startsWith(paddedNum) && f.endsWith(".md"));
      if (existingFile) {
        const { profile: gp } = await this.loadGenreProfile(book.genre);
        const index = await this.state.loadChapterIndex(bookId);
        const chapterMeta = index.find((ch) => ch.number === targetChapter);
        const title = chapterMeta?.title ?? `Chapter ${targetChapter}`;
        const en = gp.language === "en";
        const header = en
          ? `# Chapter ${targetChapter}: ${title}`
          : `# 第${targetChapter}章 ${title}`;
        await writeFile(join(chaptersDir, existingFile), `${header}\n\n${result.polishedContent}`, "utf-8");

        // Update index word count
        const updatedIndex = index.map((ch) =>
          ch.number === targetChapter
            ? { ...ch, wordCount: result.wordCount, updatedAt: new Date().toISOString() }
            : ch,
        );
        await this.state.saveChapterIndex(bookId, updatedIndex);
      }

      return { ...result, chapterNumber: targetChapter };
    } finally {
      await releaseLock();
    }
  }

  /** Read all truth files for a book. */
  async readTruthFiles(bookId: string): Promise<TruthFiles> {
    const bookDir = this.state.bookDir(bookId);
    const storyDir = join(bookDir, "story");
    const readSafe = async (path: string): Promise<string> => {
      try {
        return await readFile(path, "utf-8");
      } catch {
        return "(文件不存在)";
      }
    };

    const [currentState, particleLedger, pendingHooks, storyBible, volumeOutline, bookRules] =
      await Promise.all([
        readSafe(join(storyDir, "current_state.md")),
        readSafe(join(storyDir, "particle_ledger.md")),
        readSafe(join(storyDir, "pending_hooks.md")),
        readSafe(join(storyDir, "story_bible.md")),
        readSafe(join(storyDir, "volume_outline.md")),
        readSafe(join(storyDir, "book_rules.md")),
      ]);

    return { currentState, particleLedger, pendingHooks, storyBible, volumeOutline, bookRules };
  }

  /** Get book status overview. */
  async getBookStatus(bookId: string): Promise<BookStatusInfo> {
    const book = await this.state.loadBookConfig(bookId);
    const chapters = await this.state.loadChapterIndex(bookId);
    const nextChapter = await this.state.getNextChapterNumber(bookId);
    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

    return {
      bookId,
      title: book.title,
      genre: book.genre,
      platform: book.platform,
      status: book.status,
      chaptersWritten: chapters.length,
      totalWords,
      nextChapter,
      chapters: [...chapters],
    };
  }

  // ---------------------------------------------------------------------------
  // Chapter planning (Architect generates per-chapter plans for user review)
  // ---------------------------------------------------------------------------

  /** Load the plan index for a book. Returns empty index if file doesn't exist. */
  async loadPlanIndex(bookId: string): Promise<PlanIndex> {
    const indexPath = join(this.state.bookDir(bookId), "plans", "plan_index.json");
    try {
      const raw = await readFile(indexPath, "utf-8");
      return JSON.parse(raw) as PlanIndex;
    } catch {
      return { plans: [] };
    }
  }

  /** Save the plan index for a book. */
  async savePlanIndex(bookId: string, index: PlanIndex): Promise<void> {
    const plansDir = join(this.state.bookDir(bookId), "plans");
    await mkdir(plansDir, { recursive: true });
    await writeFile(join(plansDir, "plan_index.json"), JSON.stringify(index, null, 2), "utf-8");
  }

  /** Read a chapter plan file. Returns empty string if not found. */
  async loadChapterPlan(bookId: string, chapter: number): Promise<string> {
    const padded = String(chapter).padStart(3, "0");
    const planPath = join(this.state.bookDir(bookId), "plans", `chapter_plan_${padded}.md`);
    try {
      return await readFile(planPath, "utf-8");
    } catch {
      return "";
    }
  }

  /** Save a chapter plan file. */
  async saveChapterPlan(bookId: string, chapter: number, content: string): Promise<void> {
    const plansDir = join(this.state.bookDir(bookId), "plans");
    await mkdir(plansDir, { recursive: true });
    const padded = String(chapter).padStart(3, "0");
    await writeFile(join(plansDir, `chapter_plan_${padded}.md`), content, "utf-8");
  }

  /** Load all truth files needed for planning context. */
  private async loadPlanTruthFiles(bookId: string): Promise<PlanTruthFiles> {
    const bookDir = this.state.bookDir(bookId);
    const storyDir = join(bookDir, "story");
    const readSafe = async (path: string): Promise<string> => {
      try { return await readFile(path, "utf-8"); } catch { return "(文件尚未创建)"; }
    };

    const [storyBible, volumeOutline, bookRules, currentState, pendingHooks,
      subplotBoard, emotionalArcs, entityRegistry, chapterSummaries, characterMatrix,
    ] = await Promise.all([
      readSafe(join(storyDir, "story_bible.md")),
      readSafe(join(storyDir, "volume_outline.md")),
      readSafe(join(storyDir, "book_rules.md")),
      readSafe(join(storyDir, "current_state.md")),
      readSafe(join(storyDir, "pending_hooks.md")),
      readSafe(join(storyDir, "subplot_board.md")),
      readSafe(join(storyDir, "emotional_arcs.md")),
      readSafe(join(storyDir, "entity_registry.md")),
      readSafe(join(storyDir, "chapter_summaries.md")),
      readSafe(join(storyDir, "character_matrix.md")),
    ]);

    return {
      storyBible, volumeOutline, bookRules, currentState, pendingHooks,
      subplotBoard, emotionalArcs, entityRegistry, chapterSummaries, characterMatrix,
    };
  }

  /** Generate a plan for the next unplanned chapter. */
  async planNextChapter(bookId: string): Promise<PlanEntry> {
    const book = await this.state.loadBookConfig(bookId);
    const planIndex = await this.loadPlanIndex(bookId);

    // Find the next chapter to plan: max(planned chapters) + 1, or 1 if none
    const maxPlanned = planIndex.plans.reduce((max, p) => Math.max(max, p.chapter), 0);
    const chapterNumber = maxPlanned + 1;

    this.progress("architect", `规划第${chapterNumber}章大纲...`);

    const truthFiles = await this.loadPlanTruthFiles(bookId);

    // Load previous chapter's plan for context
    let prevPlan: string | undefined;
    if (chapterNumber > 1) {
      prevPlan = await this.loadChapterPlan(bookId, chapterNumber - 1);
      if (!prevPlan) prevPlan = undefined;
    }

    const architect = new ArchitectAgent(this.agentCtxFor("architect", bookId));
    const planContent = await architect.planChapter(book, chapterNumber, truthFiles, prevPlan);

    // Save plan file
    await this.saveChapterPlan(bookId, chapterNumber, planContent);

    // Update plan index
    const now = new Date().toISOString();
    const newEntry: PlanEntry = {
      chapter: chapterNumber,
      status: "pending",
      version: 1,
      createdAt: now,
    };
    const updatedPlans = [...planIndex.plans, newEntry];
    await this.savePlanIndex(bookId, { plans: updatedPlans });

    this.progress("architect-done", `第${chapterNumber}章大纲已生成，待审核`);

    return newEntry;
  }

  /** Re-plan a rejected chapter with user feedback. */
  async replanChapter(bookId: string, chapterNumber: number, feedback: string): Promise<PlanEntry> {
    const book = await this.state.loadBookConfig(bookId);
    const planIndex = await this.loadPlanIndex(bookId);

    const existing = planIndex.plans.find((p) => p.chapter === chapterNumber);
    if (!existing) {
      throw new Error(`No plan found for chapter ${chapterNumber}`);
    }

    this.progress("architect", `重新规划第${chapterNumber}章大纲...`);

    const truthFiles = await this.loadPlanTruthFiles(bookId);
    const rejectedPlan = await this.loadChapterPlan(bookId, chapterNumber);

    const architect = new ArchitectAgent(this.agentCtxFor("architect", bookId));
    const planContent = await architect.replanChapter(book, chapterNumber, truthFiles, rejectedPlan, feedback);

    // Save new plan file (overwrites old version)
    await this.saveChapterPlan(bookId, chapterNumber, planContent);

    // Update plan index — increment version, reset to pending
    const now = new Date().toISOString();
    const updatedEntry: PlanEntry = {
      chapter: chapterNumber,
      status: "pending",
      version: (existing.version ?? 1) + 1,
      createdAt: now,
    };
    const updatedPlans = planIndex.plans.map((p) =>
      p.chapter === chapterNumber ? updatedEntry : p,
    );
    await this.savePlanIndex(bookId, { plans: updatedPlans });

    this.progress("architect-done", `第${chapterNumber}章大纲v${updatedEntry.version}已重新生成，待审核`);

    return updatedEntry;
  }

  /** Approve a chapter plan. */
  async approvePlan(bookId: string, chapterNumber: number): Promise<void> {
    const planIndex = await this.loadPlanIndex(bookId);
    const entry = planIndex.plans.find((p) => p.chapter === chapterNumber);
    if (!entry) throw new Error(`No plan found for chapter ${chapterNumber}`);

    const now = new Date().toISOString();
    const updatedPlans = planIndex.plans.map((p) =>
      p.chapter === chapterNumber
        ? { ...p, status: "approved" as const, approvedAt: now }
        : p,
    );
    await this.savePlanIndex(bookId, { plans: updatedPlans });
  }

  /** Reject a chapter plan with feedback. */
  async rejectPlan(bookId: string, chapterNumber: number, feedback: string): Promise<void> {
    const planIndex = await this.loadPlanIndex(bookId);
    const entry = planIndex.plans.find((p) => p.chapter === chapterNumber);
    if (!entry) throw new Error(`No plan found for chapter ${chapterNumber}`);

    const now = new Date().toISOString();
    const updatedPlans = planIndex.plans.map((p) =>
      p.chapter === chapterNumber
        ? { ...p, status: "rejected" as const, rejectedAt: now, feedback }
        : p,
    );
    await this.savePlanIndex(bookId, { plans: updatedPlans });
  }

  /** Update plan content (user micro-edit). Only allowed for pending/approved plans. */
  async updatePlanContent(bookId: string, chapterNumber: number, content: string): Promise<void> {
    const planIndex = await this.loadPlanIndex(bookId);
    const entry = planIndex.plans.find((p) => p.chapter === chapterNumber);
    if (!entry) throw new Error(`No plan found for chapter ${chapterNumber}`);
    if (entry.status === "written") throw new Error(`Chapter ${chapterNumber} plan is already written — cannot edit`);

    await this.saveChapterPlan(bookId, chapterNumber, content);
  }

  /** Get plan progress statistics. */
  getPlanStats(planIndex: PlanIndex): PlanStats {
    const plans = planIndex.plans;
    return {
      total: plans.length,
      unplanned: 0, // unplanned chapters aren't in the index
      pending: plans.filter((p) => p.status === "pending").length,
      approved: plans.filter((p) => p.status === "approved").length,
      rejected: plans.filter((p) => p.status === "rejected").length,
      written: plans.filter((p) => p.status === "written").length,
    };
  }

  // ---------------------------------------------------------------------------
  // Full pipeline (convenience — runs draft + audit + revise in one shot)
  // ---------------------------------------------------------------------------

  async writeNextChapter(bookId: string, wordCount?: number, temperatureOverride?: number): Promise<ChapterPipelineResult> {
    const releaseLock = await this.state.acquireBookLock(bookId);
    try {
      return await this._writeNextChapterLocked(bookId, wordCount, temperatureOverride);
    } finally {
      await releaseLock();
    }
  }

  private async _writeNextChapterLocked(bookId: string, wordCount?: number, temperatureOverride?: number): Promise<ChapterPipelineResult> {
    const book = await this.state.loadBookConfig(bookId);
    const bookDir = this.state.bookDir(bookId);
    const chapterNumber = await this.state.getNextChapterNumber(bookId);
    const { profile: gp } = await this.loadGenreProfile(book.genre);

    // 0. Load chapter plan if available (inject into writer context)
    let chapterPlan: string | undefined;
    const planIndex = await this.loadPlanIndex(bookId);
    const planEntry = planIndex.plans.find((p) => p.chapter === chapterNumber);
    if (planEntry?.status === "approved") {
      chapterPlan = await this.loadChapterPlan(bookId, chapterNumber);
      if (!chapterPlan) chapterPlan = undefined;
    }

    // 0b. Load persisted creative context (user's original creative guidance)
    let creativeContext = this.config.externalContext;
    try {
      const ccPath = join(bookDir, "story", "creative_context.md");
      const cc = await readFile(ccPath, "utf-8");
      if (cc.trim()) creativeContext = cc.trim();
    } catch { /* file may not exist for older books */ }

    // 1. Write chapter
    this.progress("writer", "写手Agent正在创作...");
    const writer = new WriterAgent(this.agentCtxFor("writer", bookId));
    const output = await writer.writeChapter({
      book,
      bookDir,
      chapterNumber,
      externalContext: creativeContext,
      chapterPlan,
      ...(wordCount ? { wordCountOverride: wordCount } : {}),
      ...(temperatureOverride ? { temperatureOverride } : {}),
    });

    this.progress("writer-done", `草稿完成: ${output.title} ${output.wordCount}字`);

    // Gate 1: Post-draft — let user review before audit
    this.report("writer", `第${chapterNumber}章「${output.title}」草稿完成，${output.wordCount}字`, {
      chapterNumber, title: output.title, wordCount: output.wordCount,
    });
    const draftGate = await this.gate({
      stage: "post-draft", agentName: "writer",
      summary: `草稿完成: 第${chapterNumber}章「${output.title}」${output.wordCount}字`,
      data: { chapterNumber, title: output.title, wordCount: output.wordCount },
      actions: [
        { id: "approve", label: "继续审计", variant: "primary" },
        { id: "skip-audit", label: "跳过审计直接保存", variant: "secondary" },
      ],
    });

    // 2. Audit chapter (skipped if user chose skip-audit at gate 1)
    let auditResult: AuditResult = { passed: true, issues: [], summary: "" };
    let finalContent = output.content;
    let finalWordCount = output.wordCount;
    let revised = false;
    let hasCritical = false;
    let auditGate: GateDecision = { action: "approve" };

    if (draftGate.action !== "skip-audit") {
      this.progress("auditor", "连续性审计中...");
      const auditor = new ContinuityAuditor(this.agentCtxFor("auditor", bookId));
      const llmAudit = await auditor.auditChapter(bookDir, output.content, chapterNumber, book.genre);
      const aiTellsResult = analyzeAITells(output.content, gp.language);
      const sensitiveWriteResult = analyzeSensitiveWords(output.content);
      const hasBlockedWriteWords = sensitiveWriteResult.found.some((f) => f.severity === "block");
      auditResult = {
        passed: hasBlockedWriteWords ? false : llmAudit.passed,
        issues: [...llmAudit.issues, ...aiTellsResult.issues, ...sensitiveWriteResult.issues],
        summary: llmAudit.summary,
      };
      this.progress("auditor-done", `审计完成，${auditResult.issues.length}个问题`);

      // 3. Deep continuity check (ContinuityPlus — 7 narrative dimensions)
      this.progress("continuity-plus", "深度连续性审查中(7维度)...");
      const cpAgent = new ContinuityPlusAgent(this.agentCtxFor("continuity-plus", bookId));
      const cpResult = await cpAgent.check(bookDir, finalContent, chapterNumber, book.genre);
      const allIssues: AuditIssue[] = [...auditResult.issues, ...cpResult.issues];
      hasCritical = allIssues.some((i) => i.severity === "critical");
      auditResult = {
        passed: auditResult.passed && cpResult.issues.length === 0,
        issues: allIssues,
        summary: auditResult.summary + (cpResult.summary ? `\n[ContinuityPlus] ${cpResult.summary}` : ""),
      };
      this.progress("continuity-plus-done", `深度审查完成，${cpResult.issues.length}个问题`);

      // Gate 2: Post-audit — let user review issues before revise
      this.report("continuity-auditor", `审计完成: ${allIssues.length}个问题, ${allIssues.filter(i => i.severity === "critical").length}个严重`, {
        issueCount: allIssues.length,
        criticalCount: allIssues.filter(i => i.severity === "critical").length,
        passed: auditResult.passed,
        summary: auditResult.summary,
      });
      if (hasCritical) {
        auditGate = await this.gate({
          stage: "post-audit", agentName: "continuity-auditor",
          summary: `发现${allIssues.length}个问题（${allIssues.filter(i => i.severity === "critical").length}个严重）`,
          data: { issueCount: allIssues.length, passed: auditResult.passed },
          actions: [
            { id: "approve", label: "自动修订", variant: "primary" },
            { id: "skip-revise", label: "跳过修订", variant: "secondary" },
          ],
        });
      }
    } // end skip-audit check

    // 4. If audit fails, try auto-revise once (with merged issues)
    if (!auditResult.passed && hasCritical && auditGate.action !== "skip-revise" && draftGate.action !== "skip-audit") {
      this.progress("reviser", "修订Agent修改中...");
      const reviser = new ReviserAgent(this.agentCtxFor("reviser", bookId));
      const reviseOutput = await reviser.reviseChapter(
        bookDir,
        output.content,
        chapterNumber,
        auditResult.issues,
        "rewrite",
        book.genre,
      );

      if (reviseOutput.revisedContent.length > 0) {
        finalContent = reviseOutput.revisedContent;
        finalWordCount = reviseOutput.wordCount;
        revised = true;

        // Re-audit the revised content
        const reAuditor = new ContinuityAuditor(this.agentCtxFor("auditor", bookId));
        const reAudit = await reAuditor.auditChapter(
          bookDir,
          finalContent,
          chapterNumber,
          book.genre,
        );
        const reAITells = analyzeAITells(finalContent, gp.language);
        const reSensitive = analyzeSensitiveWords(finalContent);
        const reHasBlocked = reSensitive.found.some((f) => f.severity === "block");
        auditResult = {
          passed: reHasBlocked ? false : reAudit.passed,
          issues: [...reAudit.issues, ...reAITells.issues, ...reSensitive.issues],
          summary: reAudit.summary,
        };

        // Update state files from revision
        const storyDir = join(bookDir, "story");
        if (reviseOutput.updatedState !== "(状态卡未更新)") {
          await writeFile(join(storyDir, "current_state.md"), reviseOutput.updatedState, "utf-8");
        }
        if (gp.numericalSystem && reviseOutput.updatedLedger && reviseOutput.updatedLedger !== "(账本未更新)") {
          await writeFile(join(storyDir, "particle_ledger.md"), reviseOutput.updatedLedger, "utf-8");
        }
        if (reviseOutput.updatedHooks !== "(伏笔池未更新)") {
          await writeFile(join(storyDir, "pending_hooks.md"), reviseOutput.updatedHooks, "utf-8");
        }
      }
    }

    if (!auditResult.passed && hasCritical) {
      this.progress("reviser-done", revised ? "修订完成" : "修订无变更");
    }

    // 5. Polish for literary quality (always runs — final pass)
    this.progress("polisher", "文学润色中(7维度)...");
    const polisher = new PolisherAgent(this.agentCtxFor("polisher", bookId));
    const polishResult = await polisher.polish(bookDir, finalContent, chapterNumber, book.genre);
    if (polishResult.polishedContent.length > 0 && polishResult.polishedContent !== finalContent) {
      finalContent = polishResult.polishedContent;
      finalWordCount = polishResult.wordCount;
    }

    this.progress("polisher-done", `润色完成，${polishResult.changes.length}处修改`);
    this.report("polisher", `润色完成: ${polishResult.changes.length}处修改`, {
      changesCount: polishResult.changes.length,
      changes: polishResult.changes.slice(0, 5),
    });

    // 6. Save chapter (original / revised / polished)
    const chaptersDir = join(bookDir, "chapters");
    const paddedNum = String(chapterNumber).padStart(4, "0");
    const title = output.title;
    const filename = `${paddedNum}_${title.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, "_").slice(0, 50)}.md`;

    const en2 = gp.language === "en";
    const chHeader = en2
      ? `# Chapter ${chapterNumber}: ${title}`
      : `# 第${chapterNumber}章 ${title}`;

    await writeFile(
      join(chaptersDir, filename),
      `${chHeader}\n\n${finalContent}`,
      "utf-8",
    );

    // Save original state files if not revised
    if (!revised) {
      await writer.saveChapter(bookDir, output, gp.numericalSystem, en2);
    }

    // Save new truth files (summaries, subplots, emotional arcs, character matrix)
    await writer.saveNewTruthFiles(bookDir, output);

    // 7a. Extract entities to keep entity_registry.md up to date
    try {
      const extractor = new EntityExtractorAgent(this.agentCtxFor("writer", bookId));
      await extractor.extractAndMerge(bookDir, finalContent, chapterNumber, book.genre);
    } catch {
      // Entity extraction is non-critical — don't fail the pipeline
    }

    // 7. Update chapter index
    const existingIndex = await this.state.loadChapterIndex(bookId);
    const now = new Date().toISOString();
    const newEntry: ChapterMeta = {
      number: chapterNumber,
      title: output.title,
      status: auditResult.passed ? "ready-for-review" : "audit-failed",
      wordCount: finalWordCount,
      createdAt: now,
      updatedAt: now,
      auditIssues: auditResult.issues.map(
        (i) => `[${i.severity}] ${i.description}`,
      ),
    };
    await this.state.saveChapterIndex(bookId, [...existingIndex, newEntry]);

    // 7.5 Snapshot state for rollback support
    await this.state.snapshotState(bookId, chapterNumber);

    // 7.6 Mark plan as written (if plan-based writing)
    if (planEntry?.status === "approved") {
      const now2 = new Date().toISOString();
      const latestPlanIndex = await this.loadPlanIndex(bookId);
      const writtenPlans = latestPlanIndex.plans.map((p) =>
        p.chapter === chapterNumber
          ? { ...p, status: "written" as const, writtenAt: now2 }
          : p,
      );
      await this.savePlanIndex(bookId, { plans: writtenPlans });
    }

    // 7.7 Accumulate audit lessons for Writer self-improvement
    try {
      const actionable = auditResult.issues.filter(
        (i) => i.severity === "critical" || i.severity === "warning",
      );
      if (actionable.length > 0) {
        const lessonsPath = join(bookDir, "story", "writing_lessons.md");
        const header = gp.language === "en"
          ? `### Chapter ${chapterNumber} audit lessons`
          : `### 第${chapterNumber}章审计教训`;
        const bullet = actionable
          .map((i) => `- [${i.severity}] ${i.description}`)
          .join("\n");
        const entry = `${header}\n${bullet}\n\n`;

        let existing = "";
        try { existing = await readFile(lessonsPath, "utf-8"); } catch { /* first time */ }

        // Keep only the most recent 5 chapters' lessons to avoid prompt bloat
        const sections = existing.split(/(?=^### )/m).filter(Boolean);
        sections.push(entry);
        const trimmed = sections.slice(-5).join("");
        await writeFile(lessonsPath, trimmed, "utf-8");
      }
    } catch { /* non-critical */ }

    // 8. Send notification
    if (this.config.notifyChannels && this.config.notifyChannels.length > 0) {
      const statusEmoji = auditResult.passed ? "✅" : "⚠️";
      await dispatchNotification(this.config.notifyChannels, {
        title: `${statusEmoji} ${book.title} 第${chapterNumber}章`,
        body: [
          `**${output.title}** | ${finalWordCount}字`,
          revised ? "📝 已自动修正" : "",
          `审稿: ${auditResult.passed ? "通过" : "需人工审核"}`,
          ...auditResult.issues
            .filter((i) => i.severity !== "info")
            .map((i) => `- [${i.severity}] ${i.description}`),
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }

    await this.emitWebhook("pipeline-complete", bookId, chapterNumber, {
      title: output.title,
      wordCount: finalWordCount,
      passed: auditResult.passed,
      revised,
    });

    // 9. Emit Chapter Landmark for Agent Chat
    // Parse hooks from updatedHooks text (best-effort extraction)
    const hooksText = output.updatedHooks ?? "";
    const hookLines = hooksText.split("\n").filter(l => l.trim().startsWith("-") || l.trim().startsWith("*"));
    this.emitLandmark({
      chapterNum: chapterNumber,
      title: output.title,
      wordCount: finalWordCount,
      characters: [],   // will be populated by entity extractor in future
      hooksAdded: hookLines.slice(0, 5).map((l, i) => ({ id: `h-${chapterNumber}-${i}`, brief: l.replace(/^[-*]\s*/, "").trim().slice(0, 80) })),
      hooksResolved: [],
      auditCritical: auditResult.issues.filter(i => i.severity === "critical").length,
      chapterSummary: output.chapterSummary || `第${chapterNumber}章完成，${finalWordCount}字`,
    });

    return {
      chapterNumber,
      title: output.title,
      wordCount: finalWordCount,
      auditResult,
      revised,
      status: auditResult.passed ? "approved" : "needs-review",
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async emitWebhook(
    event: WebhookEvent,
    bookId: string,
    chapterNumber?: number,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.config.notifyChannels || this.config.notifyChannels.length === 0) return;
    await dispatchWebhookEvent(this.config.notifyChannels, {
      event,
      bookId,
      chapterNumber,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  private async readChapterContent(bookDir: string, chapterNumber: number): Promise<string> {
    const chaptersDir = join(bookDir, "chapters");
    const files = await readdir(chaptersDir);
    const paddedNum = String(chapterNumber).padStart(4, "0");
    const chapterFile = files.find((f) => f.startsWith(paddedNum) && f.endsWith(".md"));
    if (!chapterFile) {
      throw new Error(`Chapter ${chapterNumber} file not found in ${chaptersDir}`);
    }
    const raw = await readFile(join(chaptersDir, chapterFile), "utf-8");
    // Strip the title line
    const lines = raw.split("\n");
    const contentStart = lines.findIndex((l, i) => i > 0 && l.trim().length > 0);
    return contentStart >= 0 ? lines.slice(contentStart).join("\n") : raw;
  }
}
