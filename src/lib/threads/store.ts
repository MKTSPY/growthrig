import type { ThreadPost } from "./types";

export interface PostedReply {
  id: string;
  post: ThreadPost;
  content: string;
  citations: string[];
  drafted_at: string;
  posted_at: string | null;
  clicks: number;
}

export interface Workspace {
  keywords: string[];
  icp: string;
  companyName: string;
  goal: string;
  posts: ThreadPost[];
  errors: string[];
  replies: PostedReply[];
  last_searched: string | null;
}

const EMPTY: Workspace = {
  keywords: [],
  icp: "",
  companyName: "",
  goal: "",
  posts: [],
  errors: [],
  replies: [],
  last_searched: null,
};

interface StoreShape {
  workspace: Workspace;
}

const g = globalThis as unknown as { __growthrigThreads?: StoreShape };

function getStore(): StoreShape {
  if (!g.__growthrigThreads) {
    g.__growthrigThreads = { workspace: { ...EMPTY, replies: [] } };
  }
  return g.__growthrigThreads;
}

export function getWorkspace(): Workspace {
  return getStore().workspace;
}

export function updateWorkspace(patch: Partial<Workspace>): Workspace {
  const s = getStore();
  s.workspace = { ...s.workspace, ...patch };
  return s.workspace;
}

export function clearWorkspace(): Workspace {
  const s = getStore();
  s.workspace = { ...EMPTY, replies: [] };
  return s.workspace;
}

export function saveReply(content: string, citations: string[], post: ThreadPost): PostedReply {
  const s = getStore();
  const reply: PostedReply = {
    id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    post,
    content,
    citations,
    drafted_at: new Date().toISOString(),
    posted_at: null,
    clicks: 0,
  };
  s.workspace = { ...s.workspace, replies: [reply, ...s.workspace.replies] };
  return reply;
}

export function markReplyPosted(id: string): PostedReply | undefined {
  const s = getStore();
  const idx = s.workspace.replies.findIndex((r) => r.id === id);
  if (idx < 0) return undefined;
  const existing = s.workspace.replies[idx]!;
  const updated: PostedReply = {
    id: existing.id,
    post: existing.post,
    content: existing.content,
    citations: existing.citations,
    drafted_at: existing.drafted_at,
    posted_at: new Date().toISOString(),
    clicks: existing.clicks,
  };
  const replies = [...s.workspace.replies];
  replies[idx] = updated;
  s.workspace = { ...s.workspace, replies };
  return updated;
}

export function recordReplyClick(id: string): string | null {
  const s = getStore();
  const idx = s.workspace.replies.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const existing = s.workspace.replies[idx]!;
  const updated: PostedReply = {
    id: existing.id,
    post: existing.post,
    content: existing.content,
    citations: existing.citations,
    drafted_at: existing.drafted_at,
    posted_at: existing.posted_at,
    clicks: existing.clicks + 1,
  };
  const replies = [...s.workspace.replies];
  replies[idx] = updated;
  s.workspace = { ...s.workspace, replies };
  return updated.post.url;
}
