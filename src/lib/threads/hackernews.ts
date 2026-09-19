import type { ThreadPost } from "./types";

interface HNAlgoliaHit {
  objectID: string;
  title?: string | null;
  story_title?: string | null;
  story_text?: string | null;
  author: string;
  url?: string | null;
  points?: number | null;
  num_comments?: number | null;
  created_at?: string | null;
  created_at_i?: number | null;
}

const HN_ENDPOINT = "https://hn.algolia.com/api/v1/search";

function titleOf(h: HNAlgoliaHit): string | null {
  const t = (h.story_title || h.title || "").trim();
  return t.length > 0 ? t : null;
}

function createdUtcOf(h: HNAlgoliaHit): number {
  if (typeof h.created_at_i === "number") return h.created_at_i;
  if (h.created_at) return Math.floor(new Date(h.created_at).getTime() / 1000);
  return Math.floor(Date.now() / 1000);
}

export async function searchHN(queries: string[], limit = 15): Promise<ThreadPost[]> {
  const byId = new Map<string, ThreadPost>();
  const fetchedAt = new Date().toISOString();
  for (const q of queries) {
    const url = `${HN_ENDPOINT}?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=${limit}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "growthrig-demo/0.1" } });
      if (!res.ok) continue;
      const json = await res.json();
      const hits: HNAlgoliaHit[] = Array.isArray(json?.hits) ? json.hits : [];
      for (const h of hits) {
        const title = titleOf(h);
        if (!title) continue;
        const id = String(h.objectID);
        if (byId.has(id)) continue;
        byId.set(id, {
          id,
          source: "hackernews",
          title,
          body: (h.story_text || "").toString(),
          url: `https://news.ycombinator.com/item?id=${id}`,
          author: h.author || "anonymous",
          community: "Hacker News",
          score: typeof h.points === "number" ? h.points : 0,
          comments: typeof h.num_comments === "number" ? h.num_comments : 0,
          created_utc: createdUtcOf(h),
          fetched_at: fetchedAt,
        });
      }
    } catch {
      // ignore this query, try the next
    } finally {
      clearTimeout(t);
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
