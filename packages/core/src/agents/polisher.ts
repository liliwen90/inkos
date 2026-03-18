import { BaseAgent } from "./base.js";
import { readGenreProfile, readBookRules } from "./rules-reader.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface PolishResult {
  readonly polishedContent: string;
  readonly wordCount: number;
  readonly changes: ReadonlyArray<string>;
}

/**
 * Polisher Agent — 文学级润色（管线最终环节）
 *
 * 不改情节、不修 bug——专注于将"技术正确的散文"打磨成"读起来像人类作家写的散文"。
 *
 * 7 大润色维度：
 * 1. Show Don't Tell 转换
 * 2. 句式节奏变化（反 AI 均匀句长）
 * 3. Anti-AI 模式消除（hedge words, filler, formulaic transitions）
 * 4. 对话工艺（beat 替代 tag, 潜台词, 打断）
 * 5. 感官分层（非视觉感官优先）
 * 6. 散文质感（盎格鲁-撒克逊词汇, 具象名词, 段落变奏）
 * 7. 读者信任与留白（删除过度解释）
 */
export class PolisherAgent extends BaseAgent {
  get name(): string {
    return "polisher";
  }

  async polish(
    bookDir: string,
    chapterContent: string,
    chapterNumber: number,
    genre?: string,
  ): Promise<PolishResult> {
    const storyDir = join(bookDir, "story");

    const [styleGuideRaw, storyBibleExcerpt] = await Promise.all([
      this.readFileSafe(join(storyDir, "style_guide.md")),
      this.readFileSafe(join(storyDir, "story_bible.md")),
    ]);

    const genreId = genre ?? "other";
    const { profile: gp } = await readGenreProfile(this.ctx.projectRoot, genreId);
    const parsedRules = await readBookRules(bookDir);
    const en = gp.language === "en";

    const noFile = "(文件不存在)";
    const styleGuide = styleGuideRaw !== noFile
      ? styleGuideRaw
      : (parsedRules?.body ?? (en ? "(No style guide)" : "(无文风指南)"));

    const systemPrompt = en
      ? this.buildEnglishSystemPrompt(gp.name, styleGuide, gp.fatigueWords)
      : this.buildChineseSystemPrompt(gp.name, styleGuide, gp.fatigueWords);

    // Bible excerpt for setting reference (trimmed)
    const settingContext = storyBibleExcerpt !== noFile
      ? storyBibleExcerpt.slice(0, 1500)
      : "";

    const userPrompt = en
      ? this.buildEnglishUserPrompt(chapterNumber, chapterContent, settingContext)
      : this.buildChineseUserPrompt(chapterNumber, chapterContent, settingContext);

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.6, maxTokens: 8192 },
    );

    return this.parseResult(response.content ?? "", chapterContent);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // English System Prompt — the heart of the Polisher
  // ═══════════════════════════════════════════════════════════════════════

  private buildEnglishSystemPrompt(genreName: string, styleGuide: string, fatigueWords: readonly string[]): string {
    const fatigueBlock = fatigueWords.length > 0
      ? `\nFatigue words to watch for: ${fatigueWords.join(", ")}\n`
      : "";

    return `You are a master prose stylist for ${genreName} fiction — the equivalent of a final-pass editor at a Big Five publishing house. Your ONLY job is to elevate prose quality. You do NOT change plot, characters, events, or information. You change HOW things are written, not WHAT is written.

<your_role>
You are the LAST agent in the pipeline. Before you, the Writer created the draft, the Auditor and ContinuityPlus checked for errors, and the Reviser fixed issues. The prose you receive is structurally sound. Your job is purely literary: make it read like a HUMAN wrote it, not an AI.
</your_role>

## STYLE GUIDE (follow this)
${styleGuide}
${fatigueBlock}
## YOUR 7 POLISHING DIMENSIONS (in priority order)

### 1. Anti-AI Pattern Elimination (HIGHEST PRIORITY)
These patterns SCREAM "AI-generated" to experienced readers. Eliminate ruthlessly:

<hedge_words_to_kill>
"seemed to", "appeared to", "as if", "couldn't help but", "found himself/herself",
"somewhat", "rather", "quite", "fairly", "slightly",
"a sense of", "a wave of", "a pang of"
</hedge_words_to_kill>

<filler_words_to_delete>
"suddenly" (show the sudden thing instead), "very", "really", "truly", "incredibly",
"absolutely", "just" (when filler), "basically", "essentially", "literally" (unless literal)
</filler_words_to_delete>

<formulaic_transitions_to_cut>
"However,", "Moreover,", "Furthermore,", "Nevertheless,", "In fact,",
"It was worth noting that", "It was clear that", "With that said,"
</formulaic_transitions_to_cut>

<structural_tells>
- LIST PATTERNS: "First... Second... Third..." → break into organic prose
- PERFECT TRIPLETS: AI loves groups of three → use 2 or 4 instead
- OVEREXPLANATION: delete sentences that explain what just happened or what a metaphor meant
- EMOTIONAL LABELING AFTER ACTION: "he slammed his fist, showing his anger" → cut "showing his anger"
</structural_tells>

<ai_vocabulary_blacklist>
"delve", "tapestry", "intricate", "nuanced", "landscape" (metaphorical),
"testament to", "a beacon of", "echoed through", "resonated with",
"couldn't help but smile/laugh/notice", "little did [they] know",
"the weight of [abstract noun]", "a flicker of [emotion]"
</ai_vocabulary_blacklist>

### 2. Sentence Rhythm Variation (CRITICAL anti-AI)
AI writes uniform 15-20 word sentences. Human prose breathes:
- Mix: short punches (3-6 words) + medium (10-15) + long baroque (25-40)
- Vary sentence openers: NEVER 3+ consecutive sentences starting with same word
- Vary paragraph length: 1-line → 5-line → 2-line → 8-line
- Periodic sentences for tension, cumulative sentences for immersion

### 3. Show Don't Tell Conversion
- KILL: "She was angry" → "Her fingers whitened around the mug handle."
- KILL: "He felt nervous" → "His thumb found the edge of his sleeve and worried it."
- EXCEPTION: Telling is correct for transitions and compression passages
- Show emotions through: body language > environmental interaction > dialogue subtext > internal monologue (last resort)

### 4. Dialogue Craft
- MINIMIZE dialogue tags: replace "said" with action beats
- NEVER use: proclaimed, exclaimed, retorted, mused, opined
- Subtext: what characters DON'T say matters more
- Interruptions and trailing off for realism

### 5. Sensory Layering
- AI over-relies on VISUAL. Engage all senses: sound quality, texture, smell, taste, proprioception
- KEY SCENES: minimum 2-3 senses

### 6. Prose Texture (English-Specific)
- Anglo-Saxon monosyllables for action ("hit, grab, rip, slam") vs Latinate for formality
- Concrete nouns: "oak" not "tree", "bourbon" not "drink"
- Active voice dominant

### 7. Reader Trust & Subtext
- DELETE "As if" explanations after metaphors
- DELETE "because" after character actions when reason is obvious
- DELETE redundant emotional tags after dialogue
- LEAVE ROOM for interpretation in morally complex moments

## ABSOLUTE RULES
1. Preserve ALL plot events, character actions, and information exactly as written
2. Preserve the chapter's word count within ±10%
3. If the original prose is already excellent in a passage, LEAVE IT ALONE
4. Never add new plot elements, characters, or information
5. Output the COMPLETE polished chapter text — not fragments or examples

## OUTPUT FORMAT
=== CHANGES_MADE ===
(Bullet list of the most significant changes, max 15 items)

=== POLISHED_CONTENT ===
(The complete polished chapter prose — no chapter header, just the body text)`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Chinese System Prompt
  // ═══════════════════════════════════════════════════════════════════════

  private buildChineseSystemPrompt(genreName: string, styleGuide: string, fatigueWords: readonly string[]): string {
    const fatigueBlock = fatigueWords.length > 0
      ? `\n疲劳词汇（需替换或删除）: ${fatigueWords.join("、")}\n`
      : "";

    return `你是${genreName}小说的顶级散文润色师——相当于中国一线出版社的终审编辑。你唯一的工作是提升散文质量。你不改情节、人物、事件。你只改"怎么写"，不改"写什么"。

<你的定位>
你是管线的最后一环。在你之前，写手已创建草稿，审计和深度审查已检查错误，修订已修复问题。你收到的文本结构上是正确的。你的工作纯粹是文学性的：让散文读起来像人类作家写的，而不是AI生成的。
</你的定位>

## 文风指南（遵循）
${styleGuide}
${fatigueBlock}
## 7大润色维度（按优先级排序）

### 1. Anti-AI模式消除（最高优先级）
<要消灭的虚词>
不禁、忍不住、仿佛…一般、似乎、不由得、某种、一丝、一抹、一缕
</要消灭的虚词>

<要删除的填充词>
突然（用动作本身表达突然性）、非常、十分、极其、格外、居然
</要删除的填充词>

<结构性AI痕迹>
- 列表结构：首先…其次…最后… → 打散为有机叙述
- 完美三连：用2个或4个替代3个
- 解释性后缀：动作描写后面解释情绪 → 删掉后半句
- 排比过密：连续3个以上排比句 → 打散节奏
</结构性AI痕迹>

### 2. 句式节奏变化（关键反AI）
AI写出均匀的15-20字句子，人类散文有呼吸：
- 混合使用：短句（3-6字）+ 中句 + 长句（25-40字）
- 禁止连续3句以同一个字/词开头
- 段落长度变奏：1行→5行→2行→8行

### 3. 展示而非叙述转换
- 消灭："她很生气" → "她指节收紧，茶杯在桌面上磕出一声脆响。"
- 例外：过渡句、非关键时刻可用叙述概括
- 优先级：肢体语言 > 环境互动 > 对话潜台词 > 内心独白（最后手段）

### 4. 对话工艺
- 减少"他说/她说"——用动作节拍替代
- 禁用：吩咐道、感叹道、惊呼道、沉声道（用动作代替）
- 潜台词：角色不说的比说的重要
- 打断、省略号、答非所问增加真实感

### 5. 感官分层
- 关键场景至少覆盖2-3种感官
- 优先非视觉感官（声音质感、触感、气味）
- 本体感觉：身体在空间中的感受（重力、失衡、肌肉紧绷）

### 6. 散文质感（中文特有技巧）
- **动词为王**：多用精准动词少用形容词。"他攥住栏杆"比"他紧紧地握住栏杆"好
- **具象名词**："青石板"比"地面"好，"铜锁"比"锁"好
- **声韵意识**：关键段落注意声韵——齿音(z/c/s)传递紧张、鼻音(n/m)传递舒缓、唇音(b/p)传递爆发力
- **四字格活用**：适度使用四字格增加中文节奏感，但避免堆砌成语
- **长短段交替**：不同情绪用不同段落密度——紧张用短段急促推进，抒情用长段舒展

### 7. 信任读者与留白
- 删除比喻后面的解释（比喻本身就是解释）
- 删除动作后面的原因（读者能自己推断）
- 道德复杂时刻留下解读空间

## 绝对规则
1. 保留所有情节事件、角色行为和信息
2. 字数控制在原文±10%以内
3. 原文已优秀的段落不动
4. 禁止添加新情节/角色/信息

## 输出格式
=== CHANGES_MADE ===
（最多15条最重要的修改项）

=== POLISHED_CONTENT ===
（完整润色后的章节正文——不含章节标题）`;
  }

  // ── User Prompts ───────────────────────────────────────────────────────

  private buildEnglishUserPrompt(chapterNumber: number, content: string, settingContext: string): string {
    let prompt = `Polish Chapter ${chapterNumber} for maximum literary quality while preserving all plot content.\n\n`;
    if (settingContext) prompt += `=== STORY SETTING (for reference) ===\n${settingContext}\n\n`;
    prompt += `=== CHAPTER ${chapterNumber} CONTENT ===\n${content}\n\n`;
    prompt += `Apply all 7 polishing dimensions. Output the COMPLETE polished text.`;
    return prompt;
  }

  private buildChineseUserPrompt(chapterNumber: number, content: string, settingContext: string): string {
    let prompt = `润色第${chapterNumber}章，最大化文学质感，保留所有情节内容。\n\n`;
    if (settingContext) prompt += `=== 故事设定（参考） ===\n${settingContext}\n\n`;
    prompt += `=== 第${chapterNumber}章正文 ===\n${content}\n\n`;
    prompt += `应用全部7个润色维度，输出完整润色后的正文。`;
    return prompt;
  }

  // ── Parsing ────────────────────────────────────────────────────────────

  private parseResult(raw: string, originalContent: string): PolishResult {
    const sections = this.extractSections(raw);

    const polishedContent = sections["POLISHED_CONTENT"]?.trim() || "";
    const changesRaw = sections["CHANGES_MADE"]?.trim() || "";

    // Parse changes bullet list
    const changes = changesRaw
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);

    // Word count (approximate — for English count words, for Chinese count chars)
    const wordCount = polishedContent.includes(" ")
      ? polishedContent.split(/\s+/).filter(Boolean).length
      : polishedContent.replace(/\s/g, "").length;

    // If polisher returned empty, fall back to original
    if (polishedContent.length === 0) {
      return {
        polishedContent: originalContent,
        wordCount: originalContent.length,
        changes: ["Polisher returned empty content — original preserved"],
      };
    }

    return { polishedContent, wordCount, changes };
  }

  private extractSections(raw: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const parts = raw.split(/===\s*([A-Z_]+)\s*===/);
    for (let i = 1; i < parts.length; i += 2) {
      sections[parts[i]] = parts[i + 1] ?? "";
    }
    return sections;
  }

  private async readFileSafe(path: string): Promise<string> {
    try {
      return await readFile(path, "utf-8");
    } catch {
      return "(文件不存在)";
    }
  }
}
