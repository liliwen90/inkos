export interface RankingEntry {
  readonly title: string;
  readonly author: string;
  readonly category: string;
  readonly extra: string;
}

export interface PlatformRankings {
  readonly platform: string;
  readonly entries: ReadonlyArray<RankingEntry>;
}

/**
 * Pluggable data source for the Radar agent.
 * Implement this interface to feed custom ranking/trend data
 * (e.g. from OpenClaw, custom scrapers, paid APIs).
 */
export interface RadarSource {
  readonly name: string;
  fetch(): Promise<PlatformRankings>;
}

/**
 * Wraps raw natural language text as a radar source.
 * Use this to inject external analysis (e.g. from OpenClaw) into the radar pipeline.
 */
export class TextRadarSource implements RadarSource {
  readonly name: string;
  private readonly text: string;

  constructor(text: string, name = "external") {
    this.name = name;
    this.text = text;
  }

  async fetch(): Promise<PlatformRankings> {
    return {
      platform: this.name,
      entries: [{ title: this.text, author: "", category: "", extra: "[外部分析]" }],
    };
  }
}

// ---------------------------------------------------------------------------
// Built-in sources
// ---------------------------------------------------------------------------

const FANQIE_RANK_TYPES = [
  { sideType: 10, label: "热门榜" },
  { sideType: 13, label: "黑马榜" },
] as const;

export class FanqieRadarSource implements RadarSource {
  readonly name = "fanqie";

  async fetch(): Promise<PlatformRankings> {
    const entries: RankingEntry[] = [];

    for (const { sideType, label } of FANQIE_RANK_TYPES) {
      try {
        const url = `https://api-lf.fanqiesdk.com/api/novel/channel/homepage/rank/rank_list/v2/?aid=13&limit=15&offset=0&side_type=${sideType}`;
        const res = await globalThis.fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; InkOS/0.1)" },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as Record<string, unknown>;
        const list = (data as { data?: { result?: unknown[] } }).data?.result;
        if (!Array.isArray(list)) continue;

        for (const item of list) {
          const rec = item as Record<string, unknown>;
          entries.push({
            title: String(rec.book_name ?? ""),
            author: String(rec.author ?? ""),
            category: String(rec.category ?? ""),
            extra: `[${label}]`,
          });
        }
      } catch {
        // skip on network error
      }
    }

    return { platform: "番茄小说", entries };
  }
}

export class QidianRadarSource implements RadarSource {
  readonly name = "qidian";

  async fetch(): Promise<PlatformRankings> {
    const entries: RankingEntry[] = [];

    try {
      const url = "https://www.qidian.com/rank/";
      const res = await globalThis.fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) return { platform: "起点中文网", entries };
      const html = await res.text();

      const bookPattern =
        /<a[^>]*href="\/\/book\.qidian\.com\/info\/(\d+)"[^>]*>([^<]+)<\/a>/g;
      let match: RegExpExecArray | null;
      const seen = new Set<string>();
      while ((match = bookPattern.exec(html)) !== null) {
        const title = match[2].trim();
        if (title && !seen.has(title) && title.length > 1 && title.length < 30) {
          seen.add(title);
          entries.push({ title, author: "", category: "", extra: "[起点热榜]" });
        }
        if (entries.length >= 20) break;
      }
    } catch {
      // skip on network error
    }

    return { platform: "起点中文网", entries };
  }
}

// ---------------------------------------------------------------------------
// English platform sources (Royal Road, ScribbleHub)
// ---------------------------------------------------------------------------

export class RoyalRoadTrendingSource implements RadarSource {
  readonly name = "royalroad";
  private readonly listType: string;

  constructor(listType: "trending" | "best-rated" | "rising-stars" | "popular" = "trending") {
    this.listType = listType;
  }

  async fetch(): Promise<PlatformRankings> {
    const entries: RankingEntry[] = [];
    const labelMap: Record<string, string> = {
      "trending": "Trending",
      "best-rated": "Best Rated",
      "rising-stars": "Rising Stars",
      "popular": "Popular This Week",
    };

    try {
      const url = `https://www.royalroad.com/fictions/${this.listType}`;
      const res = await globalThis.fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "text/html",
        },
      });
      if (!res.ok) return { platform: "Royal Road", entries };
      const html = await res.text();

      // Actual HTML: <h2 class="fiction-title"><a href="/fiction/132904/slug" class="...">Title</a></h2>
      const titlePattern = /<h2[^>]*class="fiction-title"[^>]*>\s*<a\s+href="(\/fiction\/\d+\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
      let m: RegExpExecArray | null;
      const seen = new Set<string>();

      while ((m = titlePattern.exec(html)) !== null) {
        const rawTitle = m[2].trim();
        const title = rawTitle.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
        if (!title || seen.has(title) || title.length < 2) continue;
        seen.add(title);

        // Extract tags: <a class="...fiction-tag" href="...">LitRPG</a>
        const afterTitle = html.slice(m.index + m[0].length, m.index + m[0].length + 3000);
        const tagPattern = /fiction-tag"[^>]*>([^<]+)<\/a>/g;
        const tags: string[] = [];
        let tm: RegExpExecArray | null;
        while ((tm = tagPattern.exec(afterTitle)) !== null) {
          tags.push(tm[1].trim());
          if (tags.length >= 5) break;
        }

        // Extract stats: <span>162 Followers</span>
        const followersMatch = afterTitle.match(/<span>(\d[\d,]*)\s*Followers<\/span>/i);
        const viewsMatch = afterTitle.match(/<span>([\d,.]+[KMB]?)\s*Views<\/span>/i);
        const statsStr = [
          followersMatch ? `${followersMatch[1]} followers` : "",
          viewsMatch ? `${viewsMatch[1]} views` : "",
        ].filter(Boolean).join(", ");

        entries.push({
          title,
          author: "",
          category: tags.slice(0, 3).join(", "),
          extra: `[${labelMap[this.listType] ?? this.listType}] ${statsStr}`.trim(),
        });

        if (entries.length >= 30) break;
      }
    } catch {
      // skip on network error
    }

    return { platform: "Royal Road", entries };
  }
}

export class ScribbleHubTrendingSource implements RadarSource {
  readonly name = "scribblehub";

  async fetch(): Promise<PlatformRankings> {
    const entries: RankingEntry[] = [];

    try {
      const url = "https://www.scribblehub.com/series-ranking/?sort=1&order=4";
      const res = await globalThis.fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "text/html",
        },
      });
      if (!res.ok) return { platform: "ScribbleHub", entries };
      const html = await res.text();

      // Actual HTML: <span class="genre_rank">#1</span><a href="URL">Title</a>
      const pattern = /class="genre_rank">#(\d+)<\/span><a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      let m: RegExpExecArray | null;
      const seen = new Set<string>();

      while ((m = pattern.exec(html)) !== null) {
        const title = m[3].trim();
        if (!title || seen.has(title)) continue;
        seen.add(title);

        // Extract genre: <a class="fic_genre search" ...>Action</a>
        const after = html.slice(m.index, m.index + 3000);
        const genrePattern = /class="fic_genre[^"]*"[^>]*>([^<]+)<\/a>/g;
        const genreTags: string[] = [];
        let gm: RegExpExecArray | null;
        while ((gm = genrePattern.exec(after)) !== null) {
          genreTags.push(gm[1].trim());
          if (genreTags.length >= 3) break;
        }
        const genre = genreTags.join(", ");

        entries.push({
          title,
          author: "",
          category: genre,
          extra: "[Weekly Trending]",
        });

        if (entries.length >= 20) break;
      }
    } catch {
      // skip on network error
    }

    return { platform: "ScribbleHub", entries };
  }
}
