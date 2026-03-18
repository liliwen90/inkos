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

## STYLE GUIDE (follow this)
${styleGuide}
${fatigueBlock}
## YOUR 7 POLISHING DIMENSIONS

### 1. Show Don't Tell Conversion
Transform abstract statements into visceral, concrete experience:
- KILL: "She was angry" → WRITE: "Her fingers whitened around the mug handle."
- KILL: "He felt nervous" → WRITE: "His thumb found the edge of his sleeve and worried it."
- KILL: "The room was beautiful" → WRITE: specific architectural detail, light quality, textures
- KILL: "She was scared" → WRITE: physiological response (dry mouth, cold hands, narrowed vision)
- EXCEPTION: Telling is correct for transitions, non-pivotal moments, and compression passages ("Three uneventful days passed.")
- Show emotions through: body language > environmental interaction > dialogue subtext > internal monologue (last resort)

### 2. Sentence Rhythm Variation (CRITICAL anti-AI)
AI writes uniform 15-20 word sentences. Human prose breathes:
- Mix deliberately: short punches (3-6 words) + medium flows (10-15) + long baroque sentences (25-40)
- Single-word paragraphs for emphasis. Occasionally. Sparingly.
- Fragment sentences for urgency: "No time. The door. Now."
- Vary sentence openers: NEVER start 3+ consecutive sentences with the same word (especially "He/She/The/It")
- Vary paragraph length: 1-line → 5-line → 2-line → 8-line → 1-line
- Use periodic sentences (delay the main clause) for tension: "After everything they'd been through, after the lies and the silence and the way her voice broke on the phone that night — he still came."
- Use cumulative sentences (main clause first, then details pile on) for immersion

### 3. Anti-AI Pattern Elimination (CRITICAL)
These patterns SCREAM "AI-generated" to experienced readers. Eliminate ruthlessly:

**Hedge Words & Qualifiers** (delete or replace with specific detail):
- "seemed to", "appeared to", "as if", "couldn't help but", "found himself/herself"
- "somewhat", "rather", "quite", "fairly", "slightly"
- "a sense of", "a wave of", "a pang of" (generic emotional containers)

**Filler Words** (delete entirely):
- "suddenly" (show the sudden thing happening instead)
- "very", "really", "truly", "incredibly", "absolutely"
- "just" (when used as filler, not temporal marker)
- "basically", "essentially", "literally" (unless literal)

**Formulaic Transitions** (replace with organic connectors or cut entirely):
- "However,", "Moreover,", "Furthermore,", "Nevertheless,", "In fact,"
- "It was worth noting that", "It was clear that", "It was evident that"
- "With that said,", "That being said,"

**Structural Tells**:
- LIST PATTERNS: "First... Second... Third..." / "Not only... but also..."
- PERFECT TRIPLETS: AI loves groups of three. Break them. Use 2 or 4 instead.
- MIRROR STRUCTURE: "X was Y, and Z was W" parallel constructions used repeatedly
- OVEREXPLANATION: delete sentences that explain what just happened or what a metaphor meant
- EMOTIONAL LABELING AFTER ACTION: "he slammed his fist on the table, showing his anger" → cut "showing his anger"

**AI Vocabulary Favorites** (replace with less common alternatives):
- "delve", "tapestry", "intricate", "nuanced", "landscape" (metaphorical)
- "testament to", "a beacon of", "echoed through", "resonated with"
- "couldn't help but smile/laugh/notice"
- "little did [they] know"
- "the weight of [abstract noun]"
- "a flicker of [emotion]"

### 4. Dialogue Craft
- MINIMIZE dialogue tags: replace "he said" / "she said" with action beats
  - "I don't believe you." She set down her cup. ← action beat, no "said"
  - Only use "said" (invisible tag) or nothing. NEVER: proclaimed, exclaimed, retorted, mused, opined
- Each character's dialogue should sound DIFFERENT (vocabulary, sentence length, grammar)
- Subtext: what characters DON'T say matters more. Let silence speak.
- Interruptions: "I was just trying to—" "Save it."
- Trailing off: "If we don't leave now..." She didn't finish.
- No on-the-nose dialogue: characters don't perfectly articulate their feelings in real life
- Avoid: "As you know, Bob..." (characters explaining things they both already know)

### 5. Sensory Layering
AI over-relies on VISUAL description. Human writers engage all senses:
- SOUND: not just "it was loud" — the specific quality (scraping, hissing, rhythmic thudding)
- TOUCH/TEXTURE: fabric against skin, temperature, roughness vs smoothness, vibration
- SMELL: the most memory-linked sense. Trigger nostalgia, disgust, comfort.
- TASTE: metallic taste of fear, sweetness, bitterness (even when not eating)
- PROPRIOCEPTION: how the body feels in space — weight, balance, vertigo, muscle tension
- KEY SCENES: engage minimum 2-3 senses
- Synesthetic descriptions for heightened moments: "the silence tasted like copper"

### 6. Prose Texture (English-Specific Craft)
- **Anglo-Saxon vs Latinate**: prefer visceral monosyllables for action scenes:
  - ACTION: "hit, grab, rip, shove, slam, crack" NOT "impact, acquire, eviscerate, propel"
  - EMOTION: "grief, rage, dread, bliss" NOT "melancholy, indignation, apprehension, euphoria"
  - Use Latinate for formality, distance, intellectual passages
- **Concrete nouns**: "oak" not "tree", "bourbon" not "drink", "Glock" not "gun"
- **Active voice dominant**: passive only for intentional power dynamics ("He was dragged from the room" — the agency is deliberately removed)
- **Sound of prose**: in climactic passages, consider consonance (hard k/t/d for violence) and assonance (long vowels for beauty/sorrow)
- **Contractions**: use in dialogue and close-POV narration for naturalness. Formal narration can avoid them.

### 7. Reader Trust & Subtext
The HALLMARK of human writing is trusting the reader:
- DELETE "As if" explanations after metaphors (the metaphor IS the explanation)
- DELETE "because" after character actions when the reason is obvious from context
- DELETE redundant emotional tags: if the dialogue conveys anger, don't add "she said angrily"
- DELETE "little did [they] know" foreshadowing (let events surprise readers)
- DELETE "It was as though" / "It was almost as if" hedging on metaphors
- LEAVE ROOM for interpretation in morally complex moments (don't tell readers who's right)
- IMPLIED emotion > stated emotion: "She didn't look at him for the rest of the meal." > "She was hurt by what he said."

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

## 文风指南（遵循）
${styleGuide}
${fatigueBlock}
## 7大润色维度

### 1. 展示而非叙述转换
将抽象陈述转化为具体感受：
- 消灭："她很生气" → 改写："她指节收紧，茶杯在桌面上磕出一声脆响。"
- 消灭："他觉得紧张" → 改写："他的拇指反复摩挲袖口的毛边。"
- 例外：过渡句、非关键时刻可以用叙述概括

### 2. 句式节奏变化（关键反AI）
AI 写出均匀的15-20字句子，人类散文有呼吸：
- 混合使用：短句（3-6字）+ 中句 + 长句（25-40字）
- 偶尔用一个词成段
- 禁止连续3句以同一个字/词开头
- 段落长度变奏：1行→5行→2行→8行

### 3. Anti-AI 模式消除（关键）
消灭AI写作痕迹：
- 删除：不禁、忍不住、仿佛…一般、似乎、不由得
- 删除：突然（用动作本身表达突然性）
- 删除解释性后缀："他一拳砸在桌上，表现出他的愤怒" → 删掉后半句
- 打破列表结构：首先…其次…最后…
- 打破完美三连：用2个或4个替代3个

### 4. 对话工艺
- 减少"他说/她说"——用动作节拍替代
- 每个角色对话应有辨识度
- 潜台词：角色不说的比说的重要
- 打断、省略号、答非所问

### 5. 感官分层
- 关键场景至少覆盖2-3种感官
- 优先非视觉感官（声音、触感、气味）
- 本体感觉：身体在空间中的感受

### 6. 散文质感（中文特有）
- 多用动词少用形容词
- 具象名词比抽象名词好（"青石板"比"地面"好）
- 关键段落注意声韵（齿音紧张、鼻音舒缓）
- 长短段交替

### 7. 信任读者与留白
- 删除比喻后面的解释
- 删除动作后面的原因（让读者自己推断）
- 道德复杂时刻留下解读空间

## 绝对规则
1. 保留所有情节事件、角色行为和信息
2. 字数控制在原文±10%以内
3. 原文散文已经优秀的段落不动
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
