import { BaseAgent } from "./base.js";
import { readGenreProfile } from "./rules-reader.js";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Entity Extractor — 实体注册表维护器
 *
 * 每章写完后自动提取命名实体的不可变属性（性别、年龄、外貌、身份、
 * 能力等），写入 entity_registry.md 作为持久化事实数据库。
 *
 * 解决的核心问题：第3章出生的女婴到第10章不会被错写成男孩。
 * 传统摘要表太压缩，无法确保"女婴"被录入；entity_registry 专门
 * 抓取所有命名实体的硬属性，做到全局可查。
 */
export class EntityExtractorAgent extends BaseAgent {
  get name(): string {
    return "entity-extractor";
  }

  /**
   * Extract entities from a chapter and merge into the registry.
   * Uses a fast, low-token LLM call (temperature=0, ~1K output).
   */
  async extractAndMerge(
    bookDir: string,
    chapterContent: string,
    chapterNumber: number,
    genre?: string,
  ): Promise<string> {
    const storyDir = join(bookDir, "story");
    const registryPath = join(storyDir, "entity_registry.md");

    // Load existing registry
    let existingRegistry = "";
    try {
      existingRegistry = await readFile(registryPath, "utf-8");
    } catch {
      existingRegistry = "";
    }

    const genreId = genre ?? "other";
    const { profile: gp } = await readGenreProfile(this.ctx.projectRoot, genreId);
    const en = gp.language === "en";

    const systemPrompt = en
      ? this.buildEnglishPrompt(existingRegistry)
      : this.buildChinesePrompt(existingRegistry);

    const userPrompt = en
      ? `Extract all named entities from Chapter ${chapterNumber}:\n\n${chapterContent}`
      : `从第${chapterNumber}章中提取所有命名实体：\n\n${chapterContent}`;

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0, maxTokens: 2048 },
    );

    const updatedRegistry = this.mergeRegistry(existingRegistry, response.content, en);

    // Write back
    await writeFile(registryPath, updatedRegistry, "utf-8");

    return updatedRegistry;
  }

  private buildEnglishPrompt(existingRegistry: string): string {
    const registryBlock = existingRegistry
      ? `\n## Existing Registry\n${existingRegistry}\n`
      : "";

    return `You are an entity extraction tool. Given a chapter of fiction, extract ALL named entities (characters, places, objects, organizations) and their IMMUTABLE or ESTABLISHED attributes.
${registryBlock}
<rules>
1. For EACH named entity that appears or is mentioned, output one row
2. If the entity already exists in the registry, output ONLY changed or NEW attributes (leave unchanged fields as "—")
3. If a NEW entity appears, output all observed attributes
4. Attributes to track: name, type (person/place/object/org), gender, age/age-range, physical-features, identity/role, abilities, first-appeared, last-seen, key-facts
5. "key-facts" captures any PERMANENT fact (e.g. "born female", "missing left hand", "allergic to silver")
6. Output ONLY rows, no headers, no explanations
</rules>

<output_format>
Output ONLY new/changed entity rows in this pipe-delimited format (one per line):
| Name | Type | Gender | Age | Physical | Identity | Abilities | First Ch. | Last Ch. | Key Facts |

- Use "—" for unknown or unchanged fields
- Do NOT repeat the header row
- If NO new entities or changes, output exactly: NO_CHANGES
</output_format>`;
  }

  private buildChinesePrompt(existingRegistry: string): string {
    const registryBlock = existingRegistry
      ? `\n## 现有注册表\n${existingRegistry}\n`
      : "";

    return `你是一个实体提取工具。给定小说的一章内容，提取所有命名实体（人物、地点、物品、组织）及其不可变或已确立的属性。
${registryBlock}
<规则>
1. 对每个出场或被提及的命名实体，输出一行
2. 如果实体已在注册表中，只输出变化或新增的属性（未变字段写"—"）
3. 如果是新实体，输出所有观察到的属性
4. 追踪的属性：名称、类型(人物/地点/物品/组织)、性别、年龄/年龄段、外貌特征、身份/角色、能力、首次出现章、最近出现章、关键事实
5. "关键事实"记录任何永久性事实（如"出生时为女婴""左手缺失""对银过敏"）
6. 只输出数据行，不要表头，不要解释
</规则>

<输出格式>
只输出新增/变化的实体行，管道符分隔（每行一个实体）：
| 名称 | 类型 | 性别 | 年龄 | 外貌 | 身份 | 能力 | 首次出现 | 最近出现 | 关键事实 |

- 未知或未变字段写"—"
- 不要重复表头行
- 如果没有新实体或变化，输出：无变化
</输出格式>`;
  }

  /**
   * Merge LLM output rows into the existing registry.
   * - New entities: append
   * - Existing entities: update non-"—" fields, always update last-seen chapter
   */
  private mergeRegistry(existing: string, llmOutput: string, en: boolean): string {
    const trimmed = llmOutput.trim();

    // No changes
    if (trimmed === "NO_CHANGES" || trimmed === "无变化") {
      return existing || this.emptyRegistry(en);
    }

    // Parse existing registry into Map<name, row-columns>
    const entityMap = new Map<string, string[]>();
    const existingLines = existing.split("\n").filter((l) => l.startsWith("|"));
    let headerLines: string[] = [];

    for (const line of existingLines) {
      const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cols.length < 2) continue;

      // Detect header
      const isHeader = en
        ? cols[0] === "Name" || cols[0].startsWith("---")
        : cols[0] === "名称" || cols[0].startsWith("---");
      const isSeparator = cols[0].startsWith("---");

      if (isHeader || isSeparator) {
        headerLines.push(line);
        continue;
      }

      entityMap.set(cols[0].toLowerCase(), cols);
    }

    // Parse new rows from LLM
    const newLines = trimmed.split("\n").filter((l) => l.includes("|"));
    for (const line of newLines) {
      const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cols.length < 2) continue;

      // Skip if it looks like a header
      const isHeader = en
        ? cols[0] === "Name" || cols[0].startsWith("---")
        : cols[0] === "名称" || cols[0].startsWith("---");
      if (isHeader || cols[0].startsWith("---")) continue;

      const key = cols[0].toLowerCase();
      const existingCols = entityMap.get(key);

      if (existingCols) {
        // Merge: update non-"—" fields
        for (let i = 1; i < cols.length && i < existingCols.length; i++) {
          if (cols[i] && cols[i] !== "—" && cols[i] !== "-") {
            existingCols[i] = cols[i];
          }
        }
        entityMap.set(key, existingCols);
      } else {
        // New entity — pad to 10 columns
        while (cols.length < 10) cols.push("—");
        entityMap.set(key, cols);
      }
    }

    // Rebuild registry
    if (headerLines.length === 0) {
      headerLines = en
        ? [
            "| Name | Type | Gender | Age | Physical | Identity | Abilities | First Ch. | Last Ch. | Key Facts |",
            "|------|------|--------|-----|----------|----------|-----------|-----------|----------|-----------|",
          ]
        : [
            "| 名称 | 类型 | 性别 | 年龄 | 外貌 | 身份 | 能力 | 首次出现 | 最近出现 | 关键事实 |",
            "|------|------|------|------|------|------|------|----------|----------|----------|",
          ];
    }

    const header = en ? "# Entity Registry\n\n" : "# 实体注册表\n\n";
    const rows = [...entityMap.values()].map((cols) => `| ${cols.join(" | ")} |`);

    return `${header}${headerLines.join("\n")}\n${rows.join("\n")}\n`;
  }

  private emptyRegistry(en: boolean): string {
    return en
      ? `# Entity Registry

| Name | Type | Gender | Age | Physical | Identity | Abilities | First Ch. | Last Ch. | Key Facts |
|------|------|--------|-----|----------|----------|-----------|-----------|----------|-----------|
`
      : `# 实体注册表

| 名称 | 类型 | 性别 | 年龄 | 外貌 | 身份 | 能力 | 首次出现 | 最近出现 | 关键事实 |
|------|------|------|------|------|------|------|----------|----------|----------|
`;
  }
}
