// GET /api/voice — returns agent status only.
// Contacts and preparations are browser-owned (localStorage) to avoid
// cross-function-instance state loss on Vercel serverless. This endpoint
// never pretends server-side persistence exists.
import { NextResponse } from "next/server";
import { getVoiceAgentStatus } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agentStatus = getVoiceAgentStatus();
    return NextResponse.json({
      agentStatus,
      persistence: "browser-local — draft state lives in localStorage, not on the server.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
