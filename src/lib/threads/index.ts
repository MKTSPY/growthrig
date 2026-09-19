import { llmGenerate } from "@/lib/adapters/llm";
import { redditStatus, searchReddit } from "./reddit";
import { searchHN } from "./hackernews";
import type { DiscoverResult, DraftedReply, ThreadPost } from "./types";

export type { DraftedReply, DiscoverResult, ThreadPost } from "./types";

export async function discoverThreads(queries: string[]): Promise<DiscoverResult> {
  const errors: string[] = [];
  let posts: ThreadPost[] = [];
  try {
    posts = await searchHN(queries);
  } catch (e) {
    errors.push(`hackernews: ${e instanceof Error ? e.message : "fetch failed"}`);
  }
  // Reddit path returns [] today (post-deadline OAuth); capture its status as an error so UI can show it.
  const redditStatusValue = redditStatus();
  if (redditStatusValue.status === "blocked-needs-oauth") {
    errors.push(redditStatusValue.note);
  }
  return { posts, errors };
}

export async function draftReply(
  post: ThreadPost,
  context: { companyName: string; icp: string; goal: string },
): Promise<DraftedReply> {
  const sources = `${post.title}\n${post.body}`.trim();
  const fallbackContent = `${post.title.slice(0, 80)} — here's one concrete mechanism: tag by service label at ingest (not after the fact) and reconcile against your cloud bill weekly. Happy to share more.`;
  const prompt = `Write a value-first Hacker News reply (max 180 words) that genuinely answers the post's question. Mention ${context.companyName || "our tool"} only if it naturally fits and only with a concrete mechanism (no hype). No exclamation marks, no superlatives, no '#1' / 'game-changing'. Quote a specific detail from the sources.`;
  const result = await llmGenerate<{ content: string }>({
    schema: "{ content: string }",
    prompt,
    sources,
    fallback: { content: fallbackContent },
  });
  const content = typeof result?.content === "string" && result.content.trim().length > 0
    ? result.content
    : fallbackContent;
  return { content, source_post: post, citations: [post.url] };
}

export function sourceStatus() {
  return {
    hackernews: { ok: true, note: "Live — keyless via Algolia" },
    reddit: redditStatus(),
  };
}
