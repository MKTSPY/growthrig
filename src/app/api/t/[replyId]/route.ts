import { NextRequest, NextResponse } from "next/server";
import { recordReplyClick } from "@/lib/threads/store";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { replyId: string } }) {
  const dest = recordReplyClick(params.replyId);
  if (!dest) return NextResponse.json({ error: "reply not found" }, { status: 404 });
  return NextResponse.redirect(dest, { status: 302 });
}
