import { NextRequest, NextResponse } from "next/server";
import { draftReply } from "@/lib/threads";
import { getWorkspace, saveReply } from "@/lib/threads/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const postId = typeof body?.postId === "string" ? body.postId : "";
    if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
    const ws = getWorkspace();
    const post = ws.posts.find((p) => p.id === postId);
    if (!post) return NextResponse.json({ error: "post not found in workspace — discover first" }, { status: 404 });
    const reply = await draftReply(post, { companyName: ws.companyName, icp: ws.icp, goal: ws.goal });
    saveReply(reply.content, reply.citations, post);
    return NextResponse.json(reply);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "draft failed" }, { status: 500 });
  }
}
