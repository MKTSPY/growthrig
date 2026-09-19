// POST /api/voice/prepare — fully stateless, no server-side store reads.
//
// Accepts the complete payload from the browser (contact data, thread context,
// conversation history), builds a VoiceContext and VoiceCallRequest inline,
// calls prepareVoiceBrief (pure, no network), and returns the brief + request
// so the browser can drive the confirmation step without another server round-trip.
//
// This design is correct on Vercel serverless: each invocation is
// self-contained; no prior /api/voice/contact or /api/voice/message call is
// required or assumed.
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prepareVoiceBrief } from "@/lib/voice";
import type { VoiceCallRequest, VoiceContact, VoiceContext } from "@/lib/voice";

export const dynamic = "force-dynamic";

const COMPANY_NAME = process.env.COMPANY_NAME ?? "GrowthRig";
const COMPANY_ICP =
  process.env.COMPANY_ICP ?? "B2B SaaS founders doing their own growth marketing";
const COMPANY_GOAL =
  process.env.COMPANY_GOAL ?? "qualified demo calls with interested prospects";

// ---------------------------------------------------------------------------
// Input shape helpers
// ---------------------------------------------------------------------------

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function bool(v: unknown): boolean {
  return v === true;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // ── 1. Validate contact fields (supplied by browser, not looked up in store)
  const contactRaw = typeof b.contact === "object" && b.contact !== null
    ? (b.contact as Record<string, unknown>)
    : b; // allow flat payload for backwards-compat

  const display_name = str(contactRaw.display_name);
  if (!display_name) {
    return NextResponse.json({ error: "contact.display_name is required." }, { status: 400 });
  }

  const phone_number = str(contactRaw.phone_number) || undefined;
  const reddit_handle = str(contactRaw.reddit_handle) || undefined;

  if (!phone_number && !reddit_handle) {
    return NextResponse.json(
      { error: "Provide at least contact.phone_number or contact.reddit_handle." },
      { status: 400 },
    );
  }

  const consent_to_contact = bool(contactRaw.consent_to_contact);
  const contact_id = str(contactRaw.id) || `c_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const contact: VoiceContact = {
    id: contact_id,
    display_name,
    phone_number,
    reddit_handle,
    consent_to_contact,
  };

  // ── 2. Validate purpose
  const purpose = str(b.purpose);
  if (!purpose) {
    return NextResponse.json({ error: "purpose is required." }, { status: 400 });
  }

  // ── 3. Thread metadata (optional but enriches the brief)
  const threadRaw = typeof b.thread === "object" && b.thread !== null
    ? (b.thread as Record<string, unknown>)
    : {};
  const thread_title = str(threadRaw.title) || str(b.thread_title);
  const thread_url   = str(threadRaw.url)   || str(b.thread_url);
  const source       = str(threadRaw.source) || str(b.source) || "Web";

  // ── 4. Build conversation history from supplied messages (no store read)
  //     The browser sends the current history as an array, or we fall back
  //     to constructing turns from sent_reply + response fields.
  const sent_reply = str(b.sent_reply);
  const response   = str(b.response);

  type HistoryTurn = { role: "agent" | "contact" | "system"; content: string; at: string };

  const history: HistoryTurn[] = [];
  const historyRaw = Array.isArray(b.conversation_history) ? b.conversation_history : [];
  for (const turn of historyRaw) {
    if (typeof turn === "object" && turn !== null) {
      const t = turn as Record<string, unknown>;
      const role = str(t.role);
      const content = str(t.content);
      const at = str(t.at) || new Date().toISOString();
      if ((role === "agent" || role === "contact" || role === "system") && content) {
        history.push({ role, content, at });
      }
    }
  }

  // If no history array was supplied, synthesise from the free-text fields.
  if (history.length === 0) {
    const now = new Date().toISOString();
    if (sent_reply) history.push({ role: "agent",   content: sent_reply, at: now });
    if (response)   history.push({ role: "contact", content: response,   at: now });
  }

  const facts = Array.isArray(b.facts)
    ? (b.facts as unknown[]).filter((f): f is string => typeof f === "string")
    : [];
  const prohibited_claims = Array.isArray(b.prohibited_claims)
    ? (b.prohibited_claims as unknown[]).filter((f): f is string => typeof f === "string")
    : [];

  // ── 5. Build VoiceContext inline (no store, no async)
  const voiceContext: VoiceContext = {
    company_name: COMPANY_NAME,
    icp: COMPANY_ICP,
    goal: COMPANY_GOAL,
    thread_title,
    thread_url,
    source,
    sent_reply,
    conversation_history: history,
    facts,
    prohibited_claims,
  };

  // ── 6. Build VoiceCallRequest
  const confirmation_text = `CALL ${display_name}`;
  const callRequest: VoiceCallRequest = {
    contact,
    context: voiceContext,
    channel: "phone",
    purpose,
    confirmation_text,
  };

  // ── 7. Generate brief (pure function, no network call)
  const brief = prepareVoiceBrief(callRequest);

  // ── 8. Return a structural preparation descriptor (not persisted server-side)
  const preparation = {
    id: `p_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    contact_id,
    purpose,
    status: "draft" as const,
    confirmation_text,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return NextResponse.json({ preparation, brief, request: callRequest });
}
