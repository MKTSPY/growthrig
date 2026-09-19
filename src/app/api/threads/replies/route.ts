import { NextRequest, NextResponse } from "next/server";
import { getWorkspace, markReplyPosted } from "@/lib/threads/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ replies: getWorkspace().replies });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action === "mark-posted") {
      const id = typeof body?.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const updated = markReplyPosted(id);
      if (!updated) return NextResponse.json({ error: "reply not found" }, { status: 404 });
      return NextResponse.json({ reply: updated });
    }
    return NextResponse.json({ error: `unknown action: ${String(action)}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "request failed" }, { status: 500 });
  }
}
