import { BaseAgent } from "./base.js";
import type { BookConfig } from "../models/book.js";
import type { GenreProfile } from "../models/genre-profile.js";
import { readGenreProfile } from "./rules-reader.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface ArchitectOutput {
  readonly storyBible: string;
  readonly volumeOutline: string;
  readonly bookRules: string;
  readonly currentState: string;
  readonly pendingHooks: string;
}

export class ArchitectAgent extends BaseAgent {
  get name(): string {
    return "architect";
  }

  async generateFoundation(book: BookConfig, externalContext?: string): Promise<ArchitectOutput> {
    const { profile: gp, body: genreBody } =
      await readGenreProfile(this.ctx.projectRoot, book.genre);

    const en = gp.language === "en";

    const contextBlock = externalContext
      ? en
        ? `\n\n## External Directives\nThe following are creative directives from the author. Incorporate them into the world-building:\n\n${externalContext}\n`
        : `\n\n## 外部指令\n以下是来自外部系统的创作指令，请将其融入设定中：\n\n${externalContext}\n`
      : "";

    const numericalBlock = gp.numericalSystem
      ? en
        ? `- Has a trackable numerical/resource system
- Define numericalSystemOverrides in book_rules (hardCap, resourceTypes)`
        : `- 有明确的数值/资源体系可追踪
- 在 book_rules 中定义 numericalSystemOverrides（hardCap、resourceTypes）`
      : en
        ? "- This genre has no numerical system; no resource ledger needed"
        : "- 本题材无数值系统，不需要资源账本";

    const powerBlock = gp.powerScaling
      ? en ? "- Has a defined power-level hierarchy" : "- 有明确的战力等级体系"
      : "";

    const eraBlock = gp.eraResearch
      ? en
        ? "- Requires historical-era research (set eraConstraints in book_rules)"
        : "- 需要年代考据支撑（在 book_rules 中设置 eraConstraints）"
      : "";

    const eraTemplate = gp.eraResearch
      ? en
        ? `eraConstraints:
  enabled: true
  period: (specific historical period)
  region: (specific region)`
        : `eraConstraints:
  enabled: true
  period: (具体历史时期，如"明洪武年间")
  region: (具体地域，如"中国江南")`
      : "";

    const systemPrompt = en
      ? this.buildEnglishPrompt(book, gp, genreBody, contextBlock, numericalBlock, powerBlock, eraBlock, eraTemplate)
      : this.buildChinesePrompt(book, gp, genreBody, contextBlock, numericalBlock, powerBlock, eraBlock, eraTemplate);

    const userMessage = en
      ? `Generate the complete foundation for an ${gp.name} novel titled "${book.title}".`
      : `请为标题为"${book.title}"的${gp.name}小说生成完整基础设定。`;

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ], { maxTokens: 8192, temperature: 0.8 });

    return this.parseSections(response.content);
  }

  private buildEnglishPrompt(
    book: BookConfig, gp: GenreProfile, genreBody: string,
    contextBlock: string, numericalBlock: string, powerBlock: string,
    eraBlock: string, eraTemplate: string,
  ): string {
    return `You are a professional web fiction architect specializing in ${gp.name}. Your task is to generate a complete, production-ready foundation for a new novel.${contextBlock}

<requirements>
- Platform: ${book.platform}
- Genre: ${gp.name} (${book.genre})
- Target chapters: ${book.targetChapters}
- Words per chapter: ${book.chapterWordCount}
- Language: English (all output MUST be in English)
</requirements>

<golden_three_chapters_rule>
The first 3 chapters are make-or-break. 80% of readers decide to continue or drop a novel within the first 3 chapters. You MUST design the opening arc to:
- Ch.1: Drop the core conflict IMMEDIATELY (MC faces crisis/dilemma/threat). NO info-dumps, NO lengthy backstory, NO peaceful daily life.
- Ch.2: Reveal the MC's edge/power/cheat (show how they respond to Ch.1's crisis). Give readers a TASTE of the payoff they'll get by continuing.
- Ch.3: Establish a concrete short-term goal (MC commits to a specific, achievable objective). Give readers a clear reason to keep reading.
EVERY section you generate below must serve this 3-chapter opening.
</golden_three_chapters_rule>

## Genre Characteristics

${genreBody}

## Generation Instructions

Generate the following sections, separated by === SECTION: <name> ===:

=== SECTION: story_bible ===
Organize with structured H2 headings:
## 01_World-Building
World setting, core rules/systems, magic/technology framework

## 02_Protagonist
Protagonist profile (identity/special ability or cheat/personality core/behavioral boundaries)

## 03_Factions-and-Characters
Faction layout, key supporting characters (each: name, role, motivation, relationship with MC, independent goals)

## 04_Geography-and-Environment
Map/scene design, environmental features, key locations

## 05_Title-and-Synopsis
- Title suggestion: Use a hook-driven format that signals genre + core appeal. Avoid abstract literary titles.
- Synopsis (under 300 words): First sentence drops the conflict, second sentence reveals the MC's edge/ability, third sentence leaves a cliffhanger.

=== SECTION: volume_outline ===
Volume/arc planning. Each volume: arc name, chapter range, core conflict, key turning points, payoff goals.
The first volume MUST implement the Golden Three Chapters rule defined above.

=== SECTION: book_rules ===
Generate book_rules.md with YAML frontmatter + narrative guidance:
\`\`\`
---
version: "1.0"
protagonist:
  name: (MC name)
  personalityLock: [(3-5 personality keywords)]
  behavioralConstraints: [(3-5 behavioral rules)]
genreLock:
  primary: ${book.genre}
  forbidden: [(2-3 genres/styles to never mix in)]
${gp.numericalSystem ? `numericalSystemOverrides:
  hardCap: (determined by setting)
  resourceTypes: [(core resource types)]` : ""}
${eraTemplate}
prohibitions:
  - (3-5 story taboos for this book)
chapterTypesOverride: []
fatigueWordsOverride: []
additionalAuditDimensions: []
enableFullCastTracking: false
---

## Narrative Perspective
(Describe this book's POV and style)

## Core Conflict Driver
(Describe the book's central tension and driving force)
\`\`\`

=== SECTION: current_state ===
Initial state card (Chapter 0):
| Field | Value |
|-------|-------|
| Current Chapter | 0 |
| Current Location | (starting location) |
| MC Status | (initial status) |
| Current Goal | (first goal) |
| Current Limitations | (initial constraints) |
| Allies & Enemies | (initial relationships) |
| Active Conflict | (first conflict) |

=== SECTION: pending_hooks ===
Initial foreshadowing pool (Markdown table):
| hook_id | Origin Chapter | Type | Status | Last Advanced | Expected Payoff | Notes |

Generated content MUST:
1. Match ${book.platform} platform reader expectations and conventions
2. Align with ${gp.name} genre conventions
${numericalBlock}
${powerBlock}
${eraBlock}
3. MC must have a distinct personality with clear behavioral boundaries
4. Foreshadowing must connect — no dangling plot threads
5. Supporting characters must have independent motivations — no cardboard cutouts
6. ALL content must be written in natural, fluent English`;
  }

  private buildChinesePrompt(
    book: BookConfig, gp: GenreProfile, genreBody: string,
    contextBlock: string, numericalBlock: string, powerBlock: string,
    eraBlock: string, eraTemplate: string,
  ): string {
    return `你是一位专精${gp.name}题材的专业网络小说架构师。你的任务是为一本新小说生成完整的、可直接投入生产的基础设定。${contextBlock}

<要求>
- 平台：${book.platform}
- 题材：${gp.name}（${book.genre}）
- 目标章数：${book.targetChapters}章
- 每章字数：${book.chapterWordCount}字
</要求>

<黄金三章铁律>
前3章决定生死。80%的读者在前3章内决定追读还是弃书。你必须将开篇弧线设计为：
- 第1章：立即抛出核心冲突（主角面临危机/困境/威胁）。禁止大段背景灌输，禁止日常铺垫，禁止慢热开局。
- 第2章：展示金手指/核心能力（主角如何应对第1章的困境）。让读者尝到"继续读下去会爽到"的甜头。
- 第3章：明确短期目标（主角确立一个具体可达成的目标）。给读者一个清晰的追读理由。
你下面生成的每一个板块都必须服务于这个3章开局。
</黄金三章铁律>

## 题材特征

${genreBody}

## 生成要求

你需要生成以下内容，每个部分用 === SECTION: <name> === 分隔：

=== SECTION: story_bible ===
用结构化二级标题组织：
## 01_世界观
世界观设定、核心规则体系

## 02_主角
主角设定（身份/金手指/性格底色/行为边界）

## 03_势力与人物
势力分布、重要配角（每人：名字、身份、动机、与主角关系、独立目标）

## 04_地理与环境
地图/场景设定、环境特色

## 05_书名与简介
- 书名建议：采用"题材+核心爽点+主角行为"的长书名格式，避免文艺化
- 简介（300字内）：第一句抛困境，第二句亮金手指/核心能力，第三句留悬念

=== SECTION: volume_outline ===
卷纲规划，每卷包含：卷名、章节范围、核心冲突、关键转折、收益目标
第一卷必须实现上面定义的黄金三章铁律。

=== SECTION: book_rules ===
生成 book_rules.md 格式的 YAML frontmatter + 叙事指导，包含：
\`\`\`
---
version: "1.0"
protagonist:
  name: (主角名)
  personalityLock: [(3-5个性格关键词)]
  behavioralConstraints: [(3-5条行为约束)]
genreLock:
  primary: ${book.genre}
  forbidden: [(2-3种禁止混入的文风)]
${gp.numericalSystem ? `numericalSystemOverrides:
  hardCap: (根据设定确定)
  resourceTypes: [(核心资源类型列表)]` : ""}
${eraTemplate}
prohibitions:
  - (3-5条本书禁忌)
chapterTypesOverride: []
fatigueWordsOverride: []
additionalAuditDimensions: []
enableFullCastTracking: false
---

## 叙事视角
(描述本书叙事视角和风格)

## 核心冲突驱动
(描述本书的核心矛盾和驱动力)
\`\`\`

=== SECTION: current_state ===
初始状态卡（第0章），包含：
| 字段 | 值 |
|------|-----|
| 当前章节 | 0 |
| 当前位置 | (起始地点) |
| 主角状态 | (初始状态) |
| 当前目标 | (第一个目标) |
| 当前限制 | (初始限制) |
| 当前敌我 | (初始关系) |
| 当前冲突 | (第一个冲突) |

=== SECTION: pending_hooks ===
初始伏笔池（Markdown表格）：
| hook_id | 起始章节 | 类型 | 状态 | 最近推进 | 预期回收 | 备注 |

生成内容必须：
1. 符合${book.platform}平台口味
2. 符合${gp.name}题材特征
${numericalBlock}
${powerBlock}
${eraBlock}
3. 主角人设鲜明，有明确行为边界
4. 伏笔前后呼应，不留悬空线
5. 配角有独立动机，不是工具人`;
  }

  async writeFoundationFiles(
    bookDir: string,
    output: ArchitectOutput,
    numericalSystem: boolean = true,
  ): Promise<void> {
    const storyDir = join(bookDir, "story");
    await mkdir(storyDir, { recursive: true });

    const writes: Array<Promise<void>> = [
      writeFile(join(storyDir, "story_bible.md"), output.storyBible, "utf-8"),
      writeFile(join(storyDir, "volume_outline.md"), output.volumeOutline, "utf-8"),
      writeFile(join(storyDir, "book_rules.md"), output.bookRules, "utf-8"),
      writeFile(join(storyDir, "current_state.md"), output.currentState, "utf-8"),
      writeFile(join(storyDir, "pending_hooks.md"), output.pendingHooks, "utf-8"),
    ];

    if (numericalSystem) {
      writes.push(
        writeFile(
          join(storyDir, "particle_ledger.md"),
          "# 资源账本\n\n| 章节 | 期初值 | 来源 | 完整度 | 增量 | 期末值 | 依据 |\n|------|--------|------|--------|------|--------|------|\n| 0 | 0 | 初始化 | - | 0 | 0 | 开书初始 |\n",
          "utf-8",
        ),
      );
    }

    // Initialize new truth files
    writes.push(
      writeFile(
        join(storyDir, "subplot_board.md"),
        "# 支线进度板\n\n| 支线ID | 支线名 | 相关角色 | 起始章 | 最近活跃章 | 状态 | 进度概述 |\n|--------|--------|----------|--------|------------|------|----------|\n",
        "utf-8",
      ),
      writeFile(
        join(storyDir, "emotional_arcs.md"),
        "# 情感弧线\n\n| 角色 | 章节 | 情绪状态 | 触发事件 | 强度(1-10) | 弧线方向 |\n|------|------|----------|----------|------------|----------|\n",
        "utf-8",
      ),
      writeFile(
        join(storyDir, "character_matrix.md"),
        "# 角色交互矩阵\n\n### 相遇记录\n| 角色A | 角色B | 首次相遇章 | 最近交互章 | 关系性质 | 关系变化 |\n|-------|-------|------------|------------|----------|----------|\n\n### 信息边界\n| 角色 | 已知信息 | 未知信息 | 信息来源章 |\n|------|----------|----------|------------|\n",
        "utf-8",
      ),
      writeFile(
        join(storyDir, "entity_registry.md"),
        "# 实体注册表\n\n| 名称 | 类型 | 性别 | 年龄 | 外貌 | 身份 | 能力 | 首次出现 | 最近出现 | 关键事实 |\n|------|------|------|------|------|------|------|----------|----------|----------|\n",
        "utf-8",
      ),
    );

    await Promise.all(writes);
  }

  private parseSections(content: string): ArchitectOutput {
    const extract = (name: string): string => {
      const regex = new RegExp(
        `=== SECTION: ${name} ===\\s*([\\s\\S]*?)(?==== SECTION:|$)`,
      );
      const match = content.match(regex);
      return match?.[1]?.trim() ?? `[${name} 生成失败，需要重新生成]`;
    };

    return {
      storyBible: extract("story_bible"),
      volumeOutline: extract("volume_outline"),
      bookRules: extract("book_rules"),
      currentState: extract("current_state"),
      pendingHooks: extract("pending_hooks"),
    };
  }
}
