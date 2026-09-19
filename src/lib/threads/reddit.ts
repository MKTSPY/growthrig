import type { ThreadPost } from "./types";

// STUB: Reddit public JSON is gated from this network (verified 403 in
// session). Kept as a real adapter shape so post-deadline OAuth wiring is a
// one-file change — just replace the body of searchReddit with a real
// oauth.reddit.com call using REDDIT_CLIENT_ID/SECRET.
export async function searchReddit(_queries: string[]): Promise<ThreadPost[]> {
  return [];
}

export function redditStatus(): { status: "blocked-needs-oauth"; note: string } {
  return {
    status: "blocked-needs-oauth",
    note: "Reddit public JSON is gated from this network. Add REDDIT_CLIENT_ID/SECRET to .env.local post-deadline to enable.",
  };
}
