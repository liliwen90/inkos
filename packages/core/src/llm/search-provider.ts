/**
 * 搜索抽象层 — 为 Agent Chat 提供在线搜索能力
 *
 * 搜索路由策略：
 *   中文 → DeepSeek web_search (主) + Tavily (备)
 *   英文 → Tavily (主) + DeepSeek (备)
 *
 * 配置可在 LLM Settings 中管理，支持未来扩展更多 provider。
 */

// === Types ===

export interface SearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly source: string;
}

export interface SearchProviderConfig {
  readonly id: string;
  readonly label: string;
  readonly type: "tavily" | "brave-search" | "deepseek-search" | "web-agent";
  readonly apiKey?: string;
  readonly apiUrl?: string;
  /** web-agent 登录用户名（未来浏览器自动化搜索代理） */
  readonly username?: string;
  /** web-agent 登录密码 */
  readonly password?: string;
  readonly enabled: boolean;
  readonly supportedLanguages: readonly ("zh" | "en")[];
}

export interface SearchRouting {
  readonly providers: readonly SearchProviderConfig[];
  readonly zh: readonly string[];
  readonly en: readonly string[];
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, options?: { language?: "zh" | "en"; maxResults?: number }): Promise<SearchResult[]>;
}

// === Tavily Search ===

export class TavilySearchProvider implements SearchProvider {
  readonly name = "tavily";
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(config: SearchProviderConfig) {
    this.apiKey = config.apiKey ?? "";
    this.apiUrl = config.apiUrl ?? "https://api.tavily.com";
  }

  async search(query: string, options?: { language?: "zh" | "en"; maxResults?: number }): Promise<SearchResult[]> {
    const resp = await fetch(`${this.apiUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: options?.maxResults ?? 5,
        include_answer: false,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Tavily search failed: ${resp.status} ${resp.statusText}`);
    }

    const data = (await resp.json()) as {
      results?: Array<{ title: string; url: string; content: string }>;
    };

    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      source: "tavily",
    }));
  }
}

// === Brave Search ===

export class BraveSearchProvider implements SearchProvider {
  readonly name = "brave-search";
  private readonly apiKey: string;

  constructor(config: SearchProviderConfig) {
    this.apiKey = config.apiKey ?? "";
  }

  async search(query: string, options?: { language?: "zh" | "en"; maxResults?: number }): Promise<SearchResult[]> {
    const maxResults = options?.maxResults ?? 5;
    const params = new URLSearchParams({
      q: query,
      count: String(maxResults),
    });
    // Improve Chinese search results
    if (options?.language === "zh") {
      params.set("search_lang", "zh-hans");
      params.set("ui_lang", "zh-hans");
    }

    const resp = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": this.apiKey,
      },
    });

    if (!resp.ok) {
      throw new Error(`Brave search failed: ${resp.status} ${resp.statusText}`);
    }

    const data = (await resp.json()) as {
      web?: { results?: Array<{ title: string; url: string; description: string }> };
    };

    return (data.web?.results ?? []).slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
      source: "brave",
    }));
  }
}

// === DeepSeek Search (via chat API with web_search tool) ===

export class DeepSeekSearchProvider implements SearchProvider {
  readonly name = "deepseek-search";
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: SearchProviderConfig) {
    this.apiKey = config.apiKey ?? "";
    this.baseUrl = config.apiUrl ?? "https://api.deepseek.com/v1";
  }

  async search(query: string, options?: { language?: "zh" | "en"; maxResults?: number }): Promise<SearchResult[]> {
    const { createLLMClient, chatCompletion } = await import("./provider.js");

    const client = createLLMClient({
      provider: "openai",
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      model: "deepseek-chat",
      temperature: 0.1,
      maxTokens: 4096,
      thinkingBudget: 0,
      apiFormat: "chat" as const,
    });

    const maxResults = options?.maxResults ?? 5;
    const langHint = options?.language === "en" ? "Search in English." : "用中文搜索。";

    const response = await chatCompletion(client, "deepseek-chat", [
      {
        role: "system",
        content:
          `You are a search assistant. ${langHint} ` +
          `Return results as a JSON array: [{"title":"...","url":"...","snippet":"..."}]. ` +
          `Maximum ${maxResults} results. Only output the JSON array, nothing else.`,
      },
      { role: "user", content: query },
    ], { temperature: 0.1 });

    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const results = JSON.parse(jsonMatch[0]) as Array<{
        title: string;
        url: string;
        snippet: string;
      }>;
      return results.slice(0, maxResults).map((r) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        snippet: r.snippet ?? "",
        source: "deepseek-search",
      }));
    } catch {
      return [];
    }
  }
}

// === Search Router — fallback chain by language ===

export class SearchRouter {
  private readonly providers: Map<string, SearchProvider> = new Map();
  private readonly routing: { zh: string[]; en: string[] };

  constructor(config: SearchRouting) {
    this.routing = { zh: [...config.zh], en: [...config.en] };

    for (const pc of config.providers) {
      if (!pc.enabled) continue;
      switch (pc.type) {
        case "tavily":
          this.providers.set(pc.id, new TavilySearchProvider(pc));
          break;
        case "brave-search":
          this.providers.set(pc.id, new BraveSearchProvider(pc));
          break;
        case "deepseek-search":
          this.providers.set(pc.id, new DeepSeekSearchProvider(pc));
          break;
        // 'web-agent' type reserved for future browser-based search agents
        // Will need username/password + browser automation (Playwright/OpenCLI)
      }
    }
  }

  /** 按语言路由搜索，自动在提供商链中 fallback */
  async search(query: string, language: "zh" | "en", maxResults?: number): Promise<SearchResult[]> {
    const chain = this.routing[language];

    for (const pid of chain) {
      const provider = this.providers.get(pid);
      if (!provider) continue;
      try {
        return await provider.search(query, { language, maxResults });
      } catch (error) {
        console.warn(`Search provider ${pid} failed, trying next:`, error);
        continue;
      }
    }

    return [];
  }

  /** 检查是否有任何可用的搜索提供商 */
  hasProviders(language: "zh" | "en"): boolean {
    return this.routing[language].some((id) => this.providers.has(id));
  }
}
