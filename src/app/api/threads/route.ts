import { NextRequest, NextResponse } from "next/server";
import { discoverThreads, sourceStatus } from "@/lib/threads";
import { getWorkspace, updateWorkspace } from "@/lib/threads/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ workspace: getWorkspace(), sourceStatus: sourceStatus() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "save-workspace") {
      const w = body?.workspace ?? {};
      const updated = updateWorkspace({
        companyName: typeof w.companyName === "string" ? w.companyName : "",
        icp: typeof w.icp === "string" ? w.icp : "",
        goal: typeof w.goal === "string" ? w.goal : "",
        keywords: keywordsFrom(w.keywords),
      });
      return NextResponse.json({ workspace: updated });
    }

    if (action === "discover") {
      // Accept the workspace inline so a discover never depends on a previous
      // save round-trip having landed on the same serverless instance.
      // When a `workspace` object is present it is AUTHORITATIVE — including
      // when its keywords are empty. Falling back to stale server state here
      // would silently search a previous user's keywords.
      const hasInline = body?.workspace !== null && typeof body?.workspace === "object";
      if (hasInline) {
        const w = body.workspace;
        updateWorkspace({
          companyName: typeof w.companyName === "string" ? w.companyName : getWorkspace().companyName,
          icp: typeof w.icp === "string" ? w.icp : getWorkspace().icp,
          goal: typeof w.goal === "string" ? w.goal : getWorkspace().goal,
          keywords: keywordsFrom(w.keywords),
        });
      }

      const ws = getWorkspace();
      const queries = ws.keywords.length > 0 ? ws.keywords : ws.icp ? [ws.icp] : [];

      // No silent fallback: searching an unrelated default query and presenting
      // it as a keyword match is worse than telling the user to add keywords.
      if (queries.length === 0) {
        const errors = ["No keywords yet — add comma-separated keywords above, then Discover."];
        updateWorkspace({ posts: [], errors, last_searched: new Date().toISOString() });
        return NextResponse.json({ posts: [], errors, queries: [] });
      }

      const result = await discoverThreads(queries);
      const updated = updateWorkspace({
        posts: result.posts,
        errors: result.errors,
        last_searched: new Date().toISOString(),
      });
      return NextResponse.json({ posts: updated.posts, errors: updated.errors, queries });
    }

    if (action === "status") {
      return NextResponse.json({ sourceStatus: sourceStatus() });
    }

    return NextResponse.json({ error: `unknown action: ${String(action)}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "request failed" }, { status: 500 });
  }
}

/** Accepts a comma-separated string or an already-split array. */
function keywordsFrom(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((k) => String(k).trim()).filter((k) => k.length > 0);
  }
  if (typeof v === "string") {
    return v
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }
  return [];
}
