// GrowthRig — Reddit research adapter
//
// Keyless: uses Reddit's public JSON search endpoint (no auth required).
// Endpoint: https://www.reddit.com/search.json?q=<query>&sort=relevance&t=year
//
// Rules:
//  - NEVER throw — degrade gracefully on any network / parse error (return []).
//  - Always include a User-Agent header (Reddit will 429 anonymous requests
//    that omit it).
//  - 6 s hard timeout via AbortController.
//  - redditAsSourceText() is the ONLY source material Claude is allowed to use.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RedditItem {
  id: string;
  title: string;
  /** Post selftext (body), or "" for link-only posts. */
  body: string;
  subreddit: string;
  upvotes: number;
  permalink: string;
  created_utc: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const REDDIT_UA = "GrowthRig/0.1 (+https://growthrig.io; research agent; contact: demo@growthrig.io)";
const DEFAULT_LIMIT = 10;

/** Shape of a single child returned by Reddit's listing JSON. */
interface RedditChild {
  kind: string;
  data: {
    id: string;
    title: string;
    selftext: string;
    subreddit: string;
    score: number;
    permalink: string;
    created_utc: number;
  };
}

interface RedditResponse {
  data?: {
    children?: RedditChild[];
  };
}

// ---------------------------------------------------------------------------
// searchReddit
// ---------------------------------------------------------------------------

/**
 * Searches Reddit's public JSON API for posts matching `query`.
 *
 * @param query  Search string (URL-encoded automatically).
 * @param limit  Max items to return (default 10, capped at 25 by Reddit anyway).
 * @returns      Array of RedditItems, or [] on any error.
 */
export async function searchReddit(
  query: string,
  limit: number = DEFAULT_LIMIT,
): Promise<RedditItem[]> {
  const url =
    `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=year&limit=${Math.min(limit, 25)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": REDDIT_UA,
        // Accept JSON explicitly; some Reddit CDN nodes differ on content
        // negotiation when UA looks non-browser.
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`[growthrig] searchReddit: HTTP ${res.status} for query "${query}"`);
      return [];
    }

    const json = (await res.json()) as RedditResponse;

    const children = json?.data?.children;
    if (!Array.isArray(children)) {
      console.warn(`[growthrig] searchReddit: unexpected JSON shape for query "${query}"`);
      return [];
    }

    return children
      .filter((c): c is RedditChild => c.kind === "t3" && !!c.data)
      .slice(0, limit)
      .map((c) => ({
        id: c.data.id,
        title: c.data.title,
        body: c.data.selftext ?? "",
        subreddit: c.data.subreddit,
        upvotes: c.data.score,
        permalink: `https://reddit.com${c.data.permalink}`,
        created_utc: c.data.created_utc,
      }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[growthrig] searchReddit: error for query "${query}" — ${msg}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// searchRedditMulti
// ---------------------------------------------------------------------------

/**
 * Runs searchReddit for each query in parallel, deduplicates by post id,
 * sorts by upvotes descending, and slices to `limit`.
 *
 * @param queries  One or more search strings.
 * @param limit    Max total items returned (default 10).
 * @returns        Deduplicated, sorted RedditItems.
 */
export async function searchRedditMulti(
  queries: string[],
  limit: number = DEFAULT_LIMIT,
): Promise<RedditItem[]> {
  if (queries.length === 0) return [];

  // Fire all searches concurrently; individual failures already return [].
  const results = await Promise.all(queries.map((q) => searchReddit(q, limit)));

  // Flatten, deduplicate by id, sort by upvotes desc, slice.
  const seen = new Set<string>();
  const merged: RedditItem[] = [];
  for (const batch of results) {
    for (const item of batch) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }
  }

  merged.sort((a, b) => b.upvotes - a.upvotes);
  return merged.slice(0, limit);
}

// ---------------------------------------------------------------------------
// redditAsSourceText
// ---------------------------------------------------------------------------

/**
 * Serialises RedditItems into a single plain-text block that becomes the
 * ONLY source material Claude is allowed to reference.
 *
 * Format per item:
 *   [r/{subreddit} {upvotes}↑] {title}
 *   {body}
 *   [{permalink}](permalink)
 */
export function redditAsSourceText(items: RedditItem[]): string {
  return items
    .map(
      (item) =>
        `[r/${item.subreddit} ${item.upvotes}↑] ${item.title}\n${item.body}\n[${item.permalink}](permalink)`,
    )
    .join("\n\n");
}
