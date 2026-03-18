import { BaseAgent } from "./base.js";
import type { AuditIssue } from "./continuity.js";
import { readGenreProfile } from "./rules-reader.js";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export interface ContinuityPlusResult {
  readonly issues: ReadonlyArray<AuditIssue>;
  readonly summary: string;
}

/**
 * ContinuityPlus Agent — 深度连续性 & 叙事质量审计
 *
 * 与已有的 ContinuityAuditor (27维度) 互补，专注于更微妙的叙事层面：
 * 1. 角色声纹一致性（对话风格跨章节追踪）
 * 2. 情绪脉络连贯（情绪转变需要铺垫，不能突变）
 * 3. 场景转换质量（每个场景切换需要锚点）
 * 4. 信息状态追踪（角色不该知道或忘记的信息）
 * 5. 文化/地理合理性（特定时代/国家行为是否匹配）
 * 6. 感官环境连续性（天气/伤势/物品应持续存在）
 * 7. 动机连续性（角色决策应有因果链条）
 */
export class ContinuityPlusAgent extends BaseAgent {
  get name(): string {
    return "continuity-plus";
  }

  async check(
    bookDir: string,
    chapterContent: string,
    chapterNumber: number,
    genre?: string,
  ): Promise<ContinuityPlusResult> {
    const storyDir = join(bookDir, "story");
    const chaptersDir = join(bookDir, "chapters");

    // Load context files in parallel
    const [
      currentState,
      storyBible,
      pendingHooks,
      chapterSummaries,
      emotionalArcs,
      characterMatrix,
      styleGuide,
      voiceCardsRaw,
      subplotBoard,
      entityRegistry,
    ] = await Promise.all([
      this.readFileSafe(join(storyDir, "current_state.md")),
      this.readFileSafe(join(storyDir, "story_bible.md")),
      this.readFileSafe(join(storyDir, "pending_hooks.md")),
      this.readFileSafe(join(storyDir, "chapter_summaries.md")),
      this.readFileSafe(join(storyDir, "emotional_arcs.md")),
      this.readFileSafe(join(storyDir, "character_matrix.md")),
      this.readFileSafe(join(storyDir, "style_guide.md")),
      this.readFileSafe(join(bookDir, "humanize", "voice-cards.json")),
      this.readFileSafe(join(storyDir, "subplot_board.md")),
      this.readFileSafe(join(storyDir, "entity_registry.md")),
    ]);

    // Load preceding chapter for context (last 1-2 chapters)
    const prevChapters = await this.loadRecentChapters(chaptersDir, chapterNumber, 2);

    // Load genre profile
    const genreId = genre ?? "other";
    const { profile: gp } = await readGenreProfile(this.ctx.projectRoot, genreId);
    const en = gp.language === "en";

    // Parse voice cards for voice fingerprint checking
    let voiceCardBlock = "";
    try {
      if (voiceCardsRaw !== "(文件不存在)") {
        const cards = JSON.parse(voiceCardsRaw);
        if (Array.isArray(cards) && cards.length > 0) {
          voiceCardBlock = cards.map(
            (c: { name: string; speech: string; tone: string; quirks: string }) =>
              `- ${c.name}: speech="${c.speech}", tone="${c.tone}", quirks="${c.quirks}"`
          ).join("\n");
        }
      }
    } catch { /* ignore parse errors */ }

    const systemPrompt = en
      ? this.buildEnglishSystemPrompt(voiceCardBlock, gp.name)
      : this.buildChineseSystemPrompt(voiceCardBlock, gp.name);

    const userPrompt = en
      ? this.buildEnglishUserPrompt(
          chapterNumber, chapterContent, currentState, storyBible,
          chapterSummaries, emotionalArcs, characterMatrix, prevChapters,
          pendingHooks, subplotBoard, entityRegistry,
        )
      : this.buildChineseUserPrompt(
          chapterNumber, chapterContent, currentState, storyBible,
          chapterSummaries, emotionalArcs, characterMatrix, prevChapters,
          pendingHooks, subplotBoard, entityRegistry,
        );

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 4096 },
    );

    return this.parseResult(response.content ?? "");
  }

  // ── English System Prompt ──────────────────────────────────────────────

  private buildEnglishSystemPrompt(voiceCards: string, genreName: string): string {
    return `You are an elite continuity editor for ${genreName} web fiction, specializing in DEEP narrative consistency that standard structural audits miss.

<your_role>
A separate 27-dimension audit already checks mechanical issues (OOC, timeline, setting conflicts, power scaling, hooks, pacing, word fatigue, information boundary, historical accuracy, etc.). You do NOT repeat those checks.
Your job is to catch NARRATIVE-LEVEL problems that mechanical audits cannot detect — you think like a reader who remembers EVERYTHING and notices when something feels "off" even if it's technically correct.
</your_role>

## YOUR 5 AUDIT DIMENSIONS

### 1. Voice Fingerprint Consistency
Compare each character's dialogue against their established speech pattern:
- Register shifts (formal ↔ casual) must have in-story justification
- Vocabulary level must stay consistent (a street kid doesn't suddenly use SAT words)
- Sentence length patterns: terse characters stay terse, verbose characters elaborate
- Catchphrases, verbal tics, dialect markers must persist (not appear/disappear randomly)
${voiceCards ? `\nEstablished voice cards:\n${voiceCards}\n` : ""}

### 2. Emotional Throughline
Track emotional states through the chapter like a waveform:
- NO mood whiplash: grief → laughter in one paragraph needs a catalyst
- Emotions LINGER: grief doesn't vanish after one scene, anger doesn't evaporate without resolution
- Emotional escalation must follow beats (simmer → build → peak → aftermath)
- Physical manifestations must match: adrenaline affects motor skills, exhaustion slows thought
- Post-traumatic behavior: after violence/danger, characters should show aftereffects

### 3. Scene Transition Quality
Every scene change needs anchors:
- Time anchors: contextual cues (sun position, meal times) or explicit markers
- Space anchors: characters can't teleport — account for travel between locations
- POV anchors: if POV shifts, make it clear immediately
- Transition variety: don't use the same mechanism twice in a chapter
- Exit momentum: end scenes with forward pull, enter scenes with grounding detail

### 4. Sensory Environment Continuity
Physical world details must persist:
- Weather established early persists (rain doesn't stop without mention)
- Physical injuries affect subsequent actions (a broken arm stays broken)
- Objects placed in a scene exist until moved
- Lighting conditions persist  
- Sounds established as background continue

### 5. Motivation Continuity & Decision Logic
Character decisions must flow from established motivations:
- Goals shouldn't shift without a catalyst event
- Alliances/rivalries need history-based justification
- Characters should resist going against their nature (when they do, it should cost them)
- Sacrifices must be proportional to established stakes

## OUTPUT FORMAT
Respond ONLY with valid JSON:
{
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "Voice Fingerprint | Emotional Throughline | Scene Transition | Sensory Environment | Motivation Continuity",
      "description": "Specific issue found with exact quote or paragraph reference",
      "suggestion": "Concrete fix suggestion"
    }
  ],
  "summary": "One-sentence overall continuity verdict"
}

Rules:
- "critical": breaks immersion or creates plot holes
- "warning": noticeable to attentive readers, should fix
- "info": minor polish opportunity
- If no issues found, return {"issues": [], "summary": "Deep continuity check passed."}
- Be SPECIFIC — quote the problematic text, name the character, cite the contradiction`;
  }

  // ── Chinese System Prompt ──────────────────────────────────────────────

  private buildChineseSystemPrompt(voiceCards: string, genreName: string): string {
    return `你是${genreName}网文的顶级连续性编辑，专门发现标准结构化审计遗漏的深层叙事一致性问题。

<你的定位>
另有一个27维度审查已经覆盖了机械/结构性问题（OOC、时间线、设定冲突、战力崩坏、伏笔、节奏、词汇疲劳、信息越界、年代考据等）。你不重复那些检查。
你的职责是发现机械审查无法检测的叙事层面问题——你像一个记住一切的读者一样思考，能感知"技术上没错但读起来别扭"的地方。
</你的定位>

## 5大审计维度

### 1. 角色声纹一致性
对比每个角色对话与其已建立的说话模式：
- 语域切换（正式↔随意）必须有剧情内理由
- 词汇水平保持一致（街头少年不会突然用文绉绉的词）
- 句长模式：寡言角色保持寡言，话痨角色持续话多
- 口头禅、语言习惯、方言标记必须持续（不能随机消失/出现）
${voiceCards ? `\n已建立的声音卡片:\n${voiceCards}\n` : ""}

### 2. 情绪脉络连贯
像波形一样追踪章节中的情绪状态：
- 禁止情绪急转：一段之内从大笑变痛哭需要触发事件
- 情绪有惯性：悲伤不会一场戏后消失，愤怒不会无理由蒸发
- 情绪升级须有节拍（酝酿→积累→爆发→余波）
- 身体反应匹配情绪：肾上腺素影响手脚，衰竭减缓思维

### 3. 场景转换质量
每个场景切换需要锚点：
- 时间锚：环境线索（太阳位置、饭点）或明确标记
- 空间锚：角色不能瞬移——需交代移动过程
- 视角锚：如果POV切换，必须立即明确
- 转换多样性：同一章不要用同一种转换手法

### 4. 感官环境连续性
- 天气持续存在（如果在下雨，除非交代否则持续下雨）
- 身体伤害影响后续行动（断臂不会自愈）
- 场景中放置的物品持续存在
- 光照条件持续（黑暗中看不到细节）

### 5. 动机连续性与决策逻辑
- 目标不应无故转变（需要催化事件）
- 联盟/对立需要基于历史的理由
- 角色应抵抗违反本性的行为（违反时应有代价）
- 牺牲须与已建立的利害关系成正比

## 输出格式
仅返回有效JSON:
{
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "声纹一致性 | 情绪脉络 | 场景转换 | 感官环境 | 动机连续性",
      "description": "具体问题描述，附带原文引用",
      "suggestion": "具体修改建议"
    }
  ],
  "summary": "一句话总结"
}`;
  }

  // ── User Prompts ───────────────────────────────────────────────────────

  private buildEnglishUserPrompt(
    chapterNumber: number, content: string, state: string, bible: string,
    summaries: string, arcs: string, matrix: string, prevChapters: string,
    hooks: string, subplotBoard: string, entityRegistry: string,
  ): string {
    let prompt = `Perform a DEEP continuity audit on Chapter ${chapterNumber}.\n\n`;
    prompt += `=== CHAPTER ${chapterNumber} CONTENT ===\n${content}\n\n`;
    if (prevChapters) prompt += `=== PREVIOUS CHAPTERS (for comparison) ===\n${prevChapters}\n\n`;
    if (state !== "(文件不存在)") prompt += `=== CURRENT STATE CARD ===\n${state}\n\n`;
    if (bible !== "(文件不存在)") prompt += `=== STORY BIBLE (excerpt) ===\n${bible.slice(0, 3000)}\n\n`;
    if (summaries !== "(文件不存在)") prompt += `=== CHAPTER SUMMARIES ===\n${summaries}\n\n`;
    if (arcs !== "(文件不存在)") prompt += `=== EMOTIONAL ARCS ===\n${arcs}\n\n`;
    if (matrix !== "(文件不存在)") prompt += `=== CHARACTER INTERACTION MATRIX ===\n${matrix}\n\n`;
    if (hooks !== "(文件不存在)") prompt += `=== PENDING HOOKS ===\n${hooks}\n\n`;
    if (subplotBoard !== "(文件不存在)") prompt += `=== SUBPLOT BOARD ===\n${subplotBoard}\n\n`;
    if (entityRegistry !== "(文件不存在)") prompt += `=== ENTITY REGISTRY (immutable facts — flag ANY contradiction) ===\n${entityRegistry}\n\n`;
    prompt += `Now analyze Chapter ${chapterNumber} for all 5 deep continuity dimensions. Be ruthlessly specific.`;
    return prompt;
  }

  private buildChineseUserPrompt(
    chapterNumber: number, content: string, state: string, bible: string,
    summaries: string, arcs: string, matrix: string, prevChapters: string,
    hooks: string, subplotBoard: string, entityRegistry: string,
  ): string {
    let prompt = `对第${chapterNumber}章执行深度连续性审计。\n\n`;
    prompt += `=== 第${chapterNumber}章正文 ===\n${content}\n\n`;
    if (prevChapters) prompt += `=== 前文（用于比较） ===\n${prevChapters}\n\n`;
    if (state !== "(文件不存在)") prompt += `=== 当前状态卡 ===\n${state}\n\n`;
    if (bible !== "(文件不存在)") prompt += `=== 世界观（节选） ===\n${bible.slice(0, 3000)}\n\n`;
    if (summaries !== "(文件不存在)") prompt += `=== 章节摘要 ===\n${summaries}\n\n`;
    if (arcs !== "(文件不存在)") prompt += `=== 情绪弧线 ===\n${arcs}\n\n`;
    if (matrix !== "(文件不存在)") prompt += `=== 角色互动矩阵 ===\n${matrix}\n\n`;
    if (hooks !== "(文件不存在)") prompt += `=== 未收伏笔 ===\n${hooks}\n\n`;
    if (subplotBoard !== "(文件不存在)") prompt += `=== 支线面板 ===\n${subplotBoard}\n\n`;
    if (entityRegistry !== "(文件不存在)") prompt += `=== 实体注册表（不可变事实——任何矛盾必须标记） ===\n${entityRegistry}\n\n`;
    prompt += `现在分析第${chapterNumber}章全部5个深度连续性维度，请务必具体到引用原文。`;
    return prompt;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private parseResult(raw: string): ContinuityPlusResult {
    // Extract JSON from markdown code blocks if wrapped
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        summary: parsed.summary ?? "Deep continuity check complete.",
      };
    } catch {
      // If JSON parse fails, return a single warning
      return {
        issues: [{
          severity: "info" as const,
          category: "Parse Error",
          description: "ContinuityPlus output could not be parsed as JSON",
          suggestion: "Re-run the check",
        }],
        summary: "Parse error — raw output preserved.",
      };
    }
  }

  private async loadRecentChapters(chaptersDir: string, currentNumber: number, count: number): Promise<string> {
    const parts: string[] = [];
    for (let n = Math.max(1, currentNumber - count); n < currentNumber; n++) {
      const paddedNum = String(n).padStart(4, "0");
      try {
        const files = await readdir(chaptersDir);
        const file = files.find((f) => f.startsWith(paddedNum) && f.endsWith(".md"));
        if (file) {
          const content = await readFile(join(chaptersDir, file), "utf-8");
          // Take last 2000 chars to avoid token explosion
          parts.push(`--- Chapter ${n} (excerpt) ---\n${content.slice(-2000)}`);
        }
      } catch { /* skip */ }
    }
    return parts.join("\n\n");
  }

  private async readFileSafe(path: string): Promise<string> {
    try {
      return await readFile(path, "utf-8");
    } catch {
      return "(文件不存在)";
    }
  }
}
