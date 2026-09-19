"use client";

import { useEffect, useRef, useState } from "react";
import { ContentCard } from "@/components/ui/content-card";
import type { DraftedReply, ThreadPost } from "@/lib/threads/types";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "0 12px",
  fontSize: 14,
  fontFamily: "var(--font-sans)",
  color: "var(--ink)",
  background: "var(--paper)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--slate)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 6,
  display: "block",
};

type DraftState = Record<string, { busy: boolean; reply: DraftedReply | null; error: string | null }>;

export function ThreadsClient({
  initialCompanyName,
  initialIcp,
  initialGoal,
  initialKeywords,
  initialPosts,
  initialErrors,
}: {
  initialCompanyName: string;
  initialIcp: string;
  initialGoal: string;
  initialKeywords: string;
  initialPosts: ThreadPost[];
  initialErrors: string[];
}) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [icp, setIcp] = useState(initialIcp);
  const [goal, setGoal] = useState(initialGoal);
  const [keywords, setKeywords] = useState(initialKeywords);

  const [posts, setPosts] = useState<ThreadPost[]>(initialPosts);
  const [errors, setErrors] = useState<string[]>(initialErrors);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [discovering, setDiscovering] = useState(false);
  const [searchingFor, setSearchingFor] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedRef = useRef({ companyName: initialCompanyName, icp: initialIcp, goal: initialGoal, keywords: initialKeywords });

  const values = { companyName, icp, goal, keywords };

  async function persist(quiet = true) {
    const prev = committedRef.current;
    if (prev.companyName === values.companyName && prev.icp === values.icp && prev.goal === values.goal && prev.keywords === values.keywords) {
      return;
    }
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-workspace", workspace: values }),
      });
      if (res.ok) {
        committedRef.current = values;
        setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    } catch {
      // Non-fatal: discover sends the inputs inline anyway.
    }
    void quiet;
  }

  // Debounced autosave so typed keywords are always committed server-side.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persist(), 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName, icp, goal, keywords]);

  function flush() {
    if (timerRef.current) clearTimeout(timerRef.current);
    void persist();
  }

  async function discover() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDiscovering(true);
    setErrors([]);
    // Send the inputs inline — the search must use exactly what's on screen,
    // never a stale server copy or a default query.
    const payload = { ...values };
    setSearchingFor(
      payload.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    );
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discover", workspace: payload }),
      });
      const data = await res.json();
      if (Array.isArray(data?.posts)) setPosts(data.posts);
      if (Array.isArray(data?.errors)) setErrors(data.errors);
      if (Array.isArray(data?.queries)) setSearchingFor(data.queries);
      committedRef.current = payload;
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "discover failed"]);
    } finally {
      setDiscovering(false);
    }
  }

  async function draft(postId: string) {
    setDrafts((d) => ({ ...d, [postId]: { busy: true, reply: d[postId]?.reply ?? null, error: null } }));
    try {
      const res = await fetch("/api/threads/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDrafts((d) => ({ ...d, [postId]: { busy: false, reply: null, error: data?.error ?? `HTTP ${res.status}` } }));
        return;
      }
      const reply = (await res.json()) as DraftedReply;
      setDrafts((d) => ({ ...d, [postId]: { busy: false, reply, error: null } }));
    } catch (e) {
      setDrafts((d) => ({ ...d, [postId]: { busy: false, reply: null, error: e instanceof Error ? e.message : "draft failed" } }));
    }
  }

  async function copy(postId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(postId);
      setTimeout(() => setCopied((c) => (c === postId ? null : c)), 1500);
    } catch {
      // Clipboard can be blocked; the textarea is selectable as a fallback.
    }
  }

  const hasKeywords = keywords.trim().length > 0;

  return (
    <>
      <ContentCard>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle} htmlFor="ws-company">Company name</label>
              <input id="ws-company" style={fieldStyle} value={companyName} onChange={(e) => setCompanyName(e.target.value)} onBlur={flush} placeholder="e.g. Lattice Labs" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="ws-goal">Goal</label>
              <input id="ws-goal" style={fieldStyle} value={goal} onChange={(e) => setGoal(e.target.value)} onBlur={flush} placeholder="e.g. 50 demo signups in 14 days" />
            </div>
          </div>
          <div>
            <label style={labelStyle} htmlFor="ws-icp">Ideal customer profile</label>
            <textarea
              id="ws-icp"
              style={{ ...fieldStyle, height: 64, padding: "10px 12px", resize: "vertical" }}
              value={icp}
              onChange={(e) => setIcp(e.target.value)}
              onBlur={flush}
              placeholder="One sentence describing who you sell to"
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ws-keywords">Keywords (comma-separated)</label>
            <input
              id="ws-keywords"
              style={fieldStyle}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onBlur={flush}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void discover();
                }
              }}
              placeholder="e.g. saas growth, founder marketing, kubernetes cost"
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={discover}
              disabled={discovering || !hasKeywords}
              title={hasKeywords ? "Search Hacker News for these keywords" : "Add at least one keyword first"}
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: discovering ? "wait" : hasKeywords ? "pointer" : "not-allowed",
                opacity: discovering || !hasKeywords ? 0.6 : 1,
              }}
            >
              {discovering ? "Searching…" : "Discover threads"}
            </button>
            <button
              onClick={() => void persist(false)}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--paper)",
                color: "var(--ink)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save inputs
            </button>
            {savedAt && <span style={{ fontSize: 12, color: "var(--slate)" }}>Saved {savedAt}</span>}
            {!hasKeywords && <span style={{ fontSize: 12, color: "var(--caution)" }}>Add keywords to enable search.</span>}
          </div>
        </div>
      </ContentCard>

      <div style={{ height: 16 }} />

      <ContentCard>
        <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            Respond
            {posts.length > 0 && <span style={{ color: "var(--slate)", fontWeight: 500 }}> · {posts.length} match{posts.length === 1 ? "" : "es"}</span>}
          </div>
          {searchingFor.length > 0 && (
            <div style={{ fontSize: 11.5, color: "var(--slate)" }}>
              searched for {searchingFor.map((q) => `"${q}"`).join(", ")}
            </div>
          )}
        </div>

        {errors.length > 0 && (
          <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 4 }}>
            {errors.map((e, i) => (
              <div key={i} style={{ fontSize: 12, color: "var(--caution)" }}>· {e}</div>
            ))}
          </div>
        )}

        {posts.length === 0 ? (
          <div style={{ padding: "32px 20px", fontSize: 13, color: "var(--slate)" }}>
            {hasKeywords
              ? <>Hit <strong>Discover threads</strong> to find matching Hacker News posts and draft a value-first reply for each.</>
              : <>Add comma-separated keywords above, then <strong>Discover threads</strong>.</>}
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {posts.map((p) => {
              const state = drafts[p.id];
              return (
                <li key={p.id} style={{ padding: "16px 20px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 999, padding: "2px 8px" }}>Hacker News</span>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", textDecoration: "none" }}>
                      {p.title}
                    </a>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--slate)" }}>{p.score}↑ · {p.comments} comments · {ageOf(p.created_utc)}</span>
                  </div>
                  {p.body && (
                    <div style={{ fontSize: 12.5, color: "var(--slate)", lineHeight: 1.5 }}>
                      {p.body.slice(0, 240)}{p.body.length > 240 ? "…" : ""}
                    </div>
                  )}
                  {state?.reply ? (
                    <div style={{ marginTop: 6, padding: 12, borderRadius: 10, border: "1px solid var(--accent)", background: "var(--accent-soft)" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                        Suggested reply — copy to post
                      </div>
                      <textarea
                        readOnly
                        value={state.reply.content}
                        style={{
                          width: "100%",
                          minHeight: 90,
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 13,
                          fontFamily: "var(--font-sans)",
                          color: "var(--ink)",
                          background: "var(--paper)",
                          resize: "vertical",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <button
                          onClick={() => copy(p.id, state.reply!.content)}
                          style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--paper)", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                        >
                          {copied === p.id ? "Copied ✓" : "Copy"}
                        </button>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12.5, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                        >
                          Open on HN →
                        </a>
                        <span style={{ fontSize: 11.5, color: "var(--slate)", marginLeft: 4 }}>
                          You&rsquo;ll paste this on Hacker News yourself — no auto-posting.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => draft(p.id)}
                        disabled={state?.busy}
                        style={{
                          height: 32,
                          padding: "0 12px",
                          borderRadius: 8,
                          border: "none",
                          background: "var(--accent)",
                          color: "#fff",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: state?.busy ? "wait" : "pointer",
                          opacity: state?.busy ? 0.6 : 1,
                        }}
                      >
                        {state?.busy ? "Drafting…" : "Draft a reply"}
                      </button>
                      {state?.error && <span style={{ fontSize: 11.5, color: "var(--critical)", marginLeft: 10 }}>{state.error}</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </ContentCard>
    </>
  );
}

function ageOf(utcSeconds: number): string {
  const seconds = Math.max(1, Math.floor(Date.now() / 1000) - utcSeconds);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
