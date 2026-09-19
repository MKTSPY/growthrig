import { PageHead } from "@/components/ui/page-head";
import { sourceStatus } from "@/lib/threads";
import { getWorkspace } from "@/lib/threads/store";
import { ThreadsClient } from "./threads-client";

export const dynamic = "force-dynamic";

export default function ThreadsPage() {
  const workspace = getWorkspace();
  const status = sourceStatus();

  return (
    <>
      <PageHead eyebrow="Growth hacking" title="Threads" accent="respond">
        <div className="filters-row">
          <span style={{ fontSize: 13, color: "var(--slate)" }}>
            Enter keywords + ICP, discover matching threads, and draft a value-first reply for each. You copy and post it yourself — no auto-posting.
          </span>
        </div>
      </PageHead>

      <div style={{ padding: "12px 24px 0", display: "flex", gap: 24, flexWrap: "wrap" }}>
        <SourceBadge label="Hacker News" ok={status.hackernews.ok} note="live · keyless via Algolia" />
        <SourceBadge label="Reddit" ok={false} note="gated on this network — OAuth post-deadline" />
      </div>

      <div style={{ height: 12 }} />

      <ThreadsClient
        initialCompanyName={workspace.companyName}
        initialIcp={workspace.icp}
        initialGoal={workspace.goal}
        initialKeywords={workspace.keywords.join(", ")}
        initialPosts={workspace.posts}
        initialErrors={workspace.errors}
      />
    </>
  );
}

function SourceBadge({ label, ok, note }: { label: string; ok: boolean; note: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className={`dot ${ok ? "up" : "warn"}`} aria-hidden="true" />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
      <span style={{ fontSize: 11.5, color: "var(--slate)" }}>{note}</span>
    </div>
  );
}
