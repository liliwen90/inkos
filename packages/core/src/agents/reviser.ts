import { BaseAgent } from "./base.js";
import type { GenreProfile } from "../models/genre-profile.js";
import type { BookRules } from "../models/book-rules.js";
import type { AuditIssue } from "./continuity.js";
import { readGenreProfile, readBookRules } from "./rules-reader.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ReviseMode = "polish" | "rewrite" | "rework" | "anti-detect" | "spot-fix";

export interface ReviseOutput {
  readonly revisedContent: string;
  readonly wordCount: number;
  readonly fixedIssues: ReadonlyArray<string>;
  readonly updatedState: string;
  readonly updatedLedger: string;
  readonly updatedHooks: string;
}

const MODE_DESCRIPTIONS_ZH: Record<ReviseMode, string> = {
  polish: "润色：只改表达、节奏、段落呼吸，不改事实与剧情结论",
  rewrite: "改写：可改叙述顺序、画面、力度，但保留核心事实与人物动机",
  rework: "重写：可重构场景推进和冲突组织，但不改主设定和大事件结果",
  "anti-detect": "反检测改写：在保持剧情不变的前提下，降低AI生成可检测性。手法包括：增加段落长度差异、打破句式规律、用口语化/个性化表达替代书面套话、加入非对称修辞、随机化过渡方式",
  "spot-fix": "定点修复：只修改审稿意见指出的具体句子或段落，其余所有内容必须原封不动保留。修改范围限定在问题句子及其前后各一句。禁止改动无关段落",
};

const MODE_DESCRIPTIONS_EN: Record<ReviseMode, string> = {
  polish: "Polish: fix expression, rhythm, paragraph breathing only — no factual or plot changes",
  rewrite: "Rewrite: may alter narration order, imagery, intensity — but preserve core facts and character motivations",
  rework: "Rework: may restructure scene progression and conflict organization — but keep main settings and major event outcomes",
  "anti-detect": "Anti-detect rewrite: reduce AI-generation detectability while keeping plot intact. Techniques: vary paragraph length, break sentence patterns, replace formal clichés with colloquial/personal expression, add asymmetric rhetoric, randomize transitions",
  "spot-fix": "Spot fix: only modify specific sentences or paragraphs flagged by the audit. All other content must remain unchanged. Fix scope limited to the problem sentence plus one sentence before and after. Do not alter unrelated paragraphs",
};

export class ReviserAgent extends BaseAgent {
  get name(): string {
    return "reviser";
  }

  async reviseChapter(
    bookDir: string,
    chapterContent: string,
    chapterNumber: number,
    issues: ReadonlyArray<AuditIssue>,
    mode: ReviseMode = "rewrite",
    genre?: string,
  ): Promise<ReviseOutput> {
    const [currentState, ledger, hooks, styleGuideRaw] = await Promise.all([
      this.readFileSafe(join(bookDir, "story/current_state.md")),
      this.readFileSafe(join(bookDir, "story/particle_ledger.md")),
      this.readFileSafe(join(bookDir, "story/pending_hooks.md")),
      this.readFileSafe(join(bookDir, "story/style_guide.md")),
    ]);

    // Load genre profile and book rules
    const genreId = genre ?? "other";
    const { profile: gp } = await readGenreProfile(this.ctx.projectRoot, genreId);
    const parsedRules = await readBookRules(bookDir);
    const bookRules = parsedRules?.rules ?? null;

    const en = gp.language === "en";

    // Fallback: use book_rules body when style_guide.md doesn't exist
    const noFile = "(文件不存在)";
    const styleGuide = styleGuideRaw !== noFile
      ? styleGuideRaw
      : (parsedRules?.body ?? (en ? "(No style guide)" : "(无文风指南)"));

    const issueList = issues
      .map((i) => en
        ? `- [${i.severity}] ${i.category}: ${i.description}\n  Suggestion: ${i.suggestion}`
        : `- [${i.severity}] ${i.category}: ${i.description}\n  建议: ${i.suggestion}`)
      .join("\n");

    const modeDesc = en ? MODE_DESCRIPTIONS_EN[mode] : MODE_DESCRIPTIONS_ZH[mode];
    const numericalRule = gp.numericalSystem
      ? en ? "\n3. Numerical errors must be precisely corrected with full reconciliation" : "\n3. 数值错误必须精确修正，前后对账"
      : "";
    const protagonistBlock = bookRules?.protagonist
      ? en
        ? `\n\nProtagonist lock: ${bookRules.protagonist.name}, ${bookRules.protagonist.personalityLock.join(", ")}. Revisions must not violate character profile.`
        : `\n\n主角人设锁定：${bookRules.protagonist.name}，${bookRules.protagonist.personalityLock.join("、")}。修改不得违反人设。`
      : "";

    const systemPrompt = en
      ? `You are a professional ${gp.name} web fiction revision editor. Your task is to revise chapters according to audit feedback.${protagonistBlock}

Revision mode: ${modeDesc}

Revision principles:
1. Control revision scope according to mode
2. Fix root causes, not surface symptoms${numericalRule}
4. Hook status must sync with hook pool
5. Do not alter plot direction or core conflicts
6. Preserve the original language style and rhythm
7. After revision, update state card${gp.numericalSystem ? ", ledger" : ""}, and hook pool

Output format:

=== FIXED_ISSUES ===
(List each fix, one per line)

=== REVISED_CONTENT ===
(Complete revised prose)

=== UPDATED_STATE ===
(Complete updated state card)
${gp.numericalSystem ? "\n=== UPDATED_LEDGER ===\n(Complete updated resource ledger)" : ""}
=== UPDATED_HOOKS ===
(Complete updated hook pool)`
      : `你是一位专业的${gp.name}网络小说修稿编辑。你的任务是根据审稿意见对章节进行修正。${protagonistBlock}

修稿模式：${modeDesc}

修稿原则：
1. 按模式控制修改幅度
2. 修根因，不做表面润色${numericalRule}
4. 伏笔状态必须与伏笔池同步
5. 不改变剧情走向和核心冲突
6. 保持原文的语言风格和节奏
7. 修改后同步更新状态卡${gp.numericalSystem ? "、账本" : ""}、伏笔池

输出格式：

=== FIXED_ISSUES ===
(逐条说明修正了什么，一行一条)

=== REVISED_CONTENT ===
(修正后的完整正文)

=== UPDATED_STATE ===
(更新后的完整状态卡)
${gp.numericalSystem ? "\n=== UPDATED_LEDGER ===\n(更新后的完整资源账本)" : ""}
=== UPDATED_HOOKS ===
(更新后的完整伏笔池)`;

    const ledgerBlock = gp.numericalSystem
      ? en ? `\n## Resource Ledger\n${ledger}` : `\n## 资源账本\n${ledger}`
      : "";

    const userPrompt = en
      ? `Please revise Chapter ${chapterNumber}.

## Audit Issues
${issueList}

## Current State Card
${currentState}
${ledgerBlock}
## Hook Pool
${hooks}

## Style Guide
${styleGuide}

## Chapter to Revise
${chapterContent}`
      : `请修正第${chapterNumber}章。

## 审稿问题
${issueList}

## 当前状态卡
${currentState}
${ledgerBlock}
## 伏笔池
${hooks}

## 文风指南
${styleGuide}

## 待修正章节
${chapterContent}`;

    const maxTokens = mode === "spot-fix" ? 4096 : 8192;

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3, maxTokens },
    );

    return this.parseOutput(response.content, gp);
  }

  private parseOutput(content: string, gp: GenreProfile): ReviseOutput {
    const extract = (tag: string): string => {
      const regex = new RegExp(
        `=== ${tag} ===\\s*([\\s\\S]*?)(?==== [A-Z_]+ ===|$)`,
      );
      const match = content.match(regex);
      return match?.[1]?.trim() ?? "";
    };

    const revisedContent = extract("REVISED_CONTENT");
    const fixedRaw = extract("FIXED_ISSUES");

    return {
      revisedContent,
      wordCount: revisedContent.length,
      fixedIssues: fixedRaw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
      updatedState: extract("UPDATED_STATE") || (gp.language === "en" ? "(State card not updated)" : "(状态卡未更新)"),
      updatedLedger: gp.numericalSystem
        ? (extract("UPDATED_LEDGER") || (gp.language === "en" ? "(Ledger not updated)" : "(账本未更新)"))
        : "",
      updatedHooks: extract("UPDATED_HOOKS") || (gp.language === "en" ? "(Hook pool not updated)" : "(伏笔池未更新)"),
    };
  }

  private async readFileSafe(path: string): Promise<string> {
    try {
      return await readFile(path, "utf-8");
    } catch {
      return "(文件不存在)";
    }
  }
}
