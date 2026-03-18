/**
 * Structural AI-tell detection — pure rule-based analysis (no LLM).
 *
 * Detects patterns common in AI-generated Chinese text:
 * - dim 20: Paragraph length uniformity (low variance)
 * - dim 21: Filler/hedge word density
 * - dim 22: Formulaic transition patterns
 * - dim 23: List-like structure (consecutive same-prefix sentences)
 */

export interface AITellIssue {
  readonly severity: "warning" | "info";
  readonly category: string;
  readonly description: string;
  readonly suggestion: string;
}

export interface AITellResult {
  readonly issues: ReadonlyArray<AITellIssue>;
}

// Hedge/filler words common in AI Chinese text
const HEDGE_WORDS_ZH = ["似乎", "可能", "或许", "大概", "某种程度上", "一定程度上", "在某种意义上"];

// Hedge/filler words common in AI English text
const HEDGE_WORDS_EN = ["seemed to", "appeared to", "couldn't help but", "involuntarily", "as if", "perhaps", "in a sense", "to some extent", "it was as though"];

// Formulaic transition words (Chinese)
const TRANSITION_WORDS_ZH = ["然而", "不过", "与此同时", "另一方面", "尽管如此", "话虽如此", "但值得注意的是"];

// Formulaic transition words (English)
const TRANSITION_WORDS_EN = ["however", "nevertheless", "furthermore", "moreover", "on the other hand", "it is worth noting that", "despite this", "in contrast"];

/**
 * Analyze text content for structural AI-tell patterns.
 * Returns issues that can be merged into audit results.
 */
export function analyzeAITells(content: string, language?: "zh" | "en"): AITellResult {
  const en = language === "en";
  const issues: AITellIssue[] = [];

  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // dim 20: Paragraph length uniformity (needs ≥3 paragraphs)
  if (paragraphs.length >= 3) {
    const paragraphLengths = paragraphs.map((p) => p.length);
    const mean = paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length;
    if (mean > 0) {
      const variance = paragraphLengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / paragraphLengths.length;
      const stdDev = Math.sqrt(variance);
      const cv = stdDev / mean;
      if (cv < 0.15) {
        issues.push({
          severity: "warning",
          category: en ? "Uniform Paragraph Length" : "段落等长",
          description: en
            ? `Paragraph length CV is only ${cv.toFixed(3)} (threshold <0.15), uniformity suggests AI generation`
            : `段落长度变异系数仅${cv.toFixed(3)}（阈值<0.15），段落长度过于均匀，呈现AI生成特征`,
          suggestion: en
            ? "Vary paragraph length: short paragraphs for pacing/impact, long paragraphs for immersive description"
            : "增加段落长度差异：短段落用于节奏加速或冲击，长段落用于沉浸描写",
        });
      }
    }
  }

  // dim 21: Hedge word density
  const hedgeWords = en ? HEDGE_WORDS_EN : HEDGE_WORDS_ZH;
  const totalChars = content.length;
  if (totalChars > 0) {
    let hedgeCount = 0;
    for (const word of hedgeWords) {
      const regex = new RegExp(word, "gi");
      const matches = content.match(regex);
      hedgeCount += matches?.length ?? 0;
    }
    const hedgeDensity = hedgeCount / (totalChars / 1000);
    if (hedgeDensity > 3) {
      issues.push({
        severity: "warning",
        category: en ? "Cliché Density" : "套话密度",
        description: en
          ? `Hedge word density is ${hedgeDensity.toFixed(1)}/1000 chars (threshold >3), tone is overly vague and hesitant`
          : `套话词（似乎/可能/或许等）密度为${hedgeDensity.toFixed(1)}次/千字（阈值>3），语气过于模糊犹豫`,
        suggestion: en
          ? "Replace hedging with assertive narration: remove 'seemed to' and describe directly, replace 'perhaps' with concrete detail"
          : "用确定性叙述替代模糊表达：去掉「似乎」直接描述状态，用具体细节替代「可能」",
      });
    }
  }

  // dim 22: Formulaic transition repetition
  const transitionWords = en ? TRANSITION_WORDS_EN : TRANSITION_WORDS_ZH;
  const transitionCounts: Record<string, number> = {};
  for (const word of transitionWords) {
    const regex = new RegExp(word, "gi");
    const matches = content.match(regex);
    const count = matches?.length ?? 0;
    if (count > 0) {
      transitionCounts[word] = count;
    }
  }
  const repeatedTransitions = Object.entries(transitionCounts)
    .filter(([, count]) => count >= 3);
  if (repeatedTransitions.length > 0) {
    const detail = repeatedTransitions
      .map(([word, count]) => `"${word}"×${count}`)
      .join(en ? ", " : "、");
    issues.push({
      severity: "warning",
      category: en ? "Formulaic Transitions" : "公式化转折",
      description: en
        ? `Repeated transition words: ${detail}. Same transition pattern ≥3 times exposes AI generation`
        : `转折词重复使用：${detail}。同一转折模式≥3次暴露AI生成痕迹`,
      suggestion: en
        ? "Replace transition words with natural plot transitions: action cuts, time jumps, POV shifts"
        : "用情节自然转折替代转折词，或换用不同的过渡手法（动作切入、时间跳跃、视角切换）",
    });
  }

  // dim 23: List-like structure (consecutive sentences with same prefix pattern)
  const sentenceSplitter = en ? /[.!?\n]/ : /[。！？\n]/;
  const sentences = content
    .split(sentenceSplitter)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  if (sentences.length >= 3) {
    let consecutiveSamePrefix = 1;
    let maxConsecutive = 1;
    for (let i = 1; i < sentences.length; i++) {
      const prevPrefix = sentences[i - 1]!.slice(0, 2);
      const currPrefix = sentences[i]!.slice(0, 2);
      if (prevPrefix === currPrefix) {
        consecutiveSamePrefix++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveSamePrefix);
      } else {
        consecutiveSamePrefix = 1;
      }
    }
    if (maxConsecutive >= 3) {
      issues.push({
        severity: "info",
        category: en ? "List-Style Structure" : "列表式结构",
        description: en
          ? `Detected ${maxConsecutive} consecutive sentences with the same opening pattern, suggesting list-style AI generation`
          : `检测到${maxConsecutive}句连续以相同开头的句子，呈现列表式AI生成结构`,
        suggestion: en
          ? "Vary sentence openings: use different subjects, time markers, and action verbs to break the list pattern"
          : "变换句式开头：用不同主语、时间词、动作词开头，打破列表感",
      });
    }
  }

  return { issues };
}
