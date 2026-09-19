import { PageHead } from "@/components/ui/page-head";
import { ContentCard } from "@/components/ui/content-card";
import { sourceStatus } from "@/lib/threads";
import { getWorkspace } from "@/lib/threads/store";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const ws = getWorkspace();
  const status = sourceStatus();
  const replies = ws.replies;

  const drafted = replies.length;
  const posted = replies.filter((r) => r.posted_at).length;
  const totalClicks = replies.reduce((acc, r) => acc + r.clicks, 0);

  return (
    <>
      <PageHead eyebrow="Outcomes" title="Analytics" accent="respond">
        <div className="filters-row">
          <span style={{ fontSize: 13, color: "var(--slate)" }}>
            Track what you've drafted and what you've actually posted. Real engagement only — no auto-posting.
          </span>
        </div>
      </PageHead>

      <ContentCard>
        <div style={{ padding: "12px 20px 4px", display: "flex", gap: 24, flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
          <SourceBadge label="Hacker News" ok={status.hackernews.ok} note={status.hackernews.note} />
          <SourceBadge label="Reddit" ok={false} note="Gated on this network — OAuth post-deadline" />
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
          <Stat label="Drafted replies" value={drafted} />
          <Stat label="Marked posted" value={posted} />
          <Stat label="Total tracked clicks" value={totalClicks} />
        </div>
      </ContentCard>

      <div style={{ height: 16 }} />

      <ContentCard>
        <div style={{ padding: "12px 20px", fontSize: 13, fontWeight: 600, color: "var(--ink)", borderBottom: "1px solid var(--line)" }}>
          Reply ledger
        </div>
        {replies.length === 0 ? (
          <div style={{ padding: "32px 20px", fontSize: 13, color: "var(--slate)" }}>
            Draft your first reply in <a href="/threads" style={{ color: "var(--accent)" }}>Threads</a> — it'll show up here.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--slate)", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "10px 20px" }}>Thread</th>
                <th style={{ padding: "10px 20px" }}>Drafted</th>
                <th style={{ padding: "10px 20px" }}>Posted?</th>
                <th style={{ padding: "10px 20px" }}>Tracked clicks</th>
                <th style={{ padding: "10px 20px" }}>Tracked link</th>
              </tr>
            </thead>
            <tbody>
              {replies.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 20px", maxWidth: 360 }}>
                    <a href={r.post.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>
                      {r.post.title}
                    </a>
                  </td>
                  <td style={{ padding: "10px 20px", color: "var(--slate)" }}>{new Date(r.drafted_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</td>
                  <td style={{ padding: "10px 20px" }}>
                    {r.posted_at ? (
                      <span style={{ color: "var(--accent)", fontWeight: 600 }}>{new Date(r.posted_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                    ) : (
                      <span style={{ color: "var(--slate)" }}>draft only</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 20px", color: "var(--ink)" }}>{r.clicks}</td>
                  <td style={{ padding: "10px 20px" }}>
                    <code style={{ fontSize: 11, color: "var(--accent)" }}>{`/api/t/${r.id}`}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ContentCard>
    </>
  );
}

function SourceBadge({ label, ok, note }: { label: string; ok: boolean; note: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className={`dot ${ok ? "up" : "warn"}`} aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999 }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
      <span style={{ fontSize: 11.5, color: "var(--slate)" }}>{note}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, border: "1px solid var(--line)", background: "var(--paper)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: "var(--ink)", marginTop: 6 }}>{value}</div>
    </div>
  );
}
