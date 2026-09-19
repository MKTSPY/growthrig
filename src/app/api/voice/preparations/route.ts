// POST /api/voice/preparations — create a durable voice preparation.
// GET  /api/voice/preparations — list preparations for an operator (safe, phone masked).
//
// Gates (all fail closed):
//  1. x-growthrig-operator-id header required → 401
//  2. Persistence available → 503
//  3. Input validated (display_name, phone, consent_granted, purpose) → 400
//  4. No provider fetch here — brief is built locally only.
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isVoicePersistenceAvailable, createContact, createThreadContext, createVoicePreparation, createConfirmationNonce, updateVoicePreparation } from "@/lib/db/voice-repository";
import { prepareVoiceBrief, getVoiceAgentStatus } from "@/lib/voice";
import { getVoicePolicy } from "@/lib/voice/policy";
import type { VoiceCallRequest } from "@/lib/voice";

export const dynamic = "force-dynamic";

function operatorId(req: NextRequest): string | null {
  return req.headers.get("x-growthrig-operator-id")?.trim() || null;
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  // Show last 4 digits only: +1-XXX-XXX-1234
  const clean = phone.replace(/[^0-9]/g, "");
  return "+" + clean.slice(0, -4).replace(/./g, "X") + clean.slice(-4);
}

export async function POST(req: NextRequest) {
  // Gate 1: operator auth
  const opId = operatorId(req);
  if (!opId) {
    return NextResponse.json({ error: "x-growthrig-operator-id header is required." }, { status: 401 });
  }

  // Gate 2: persistence
  if (!isVoicePersistenceAvailable()) {
    return NextResponse.json({
      error: "Persistence unavailable. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      status: "unavailable",
    }, { status: 503 });
  }

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

  // Gate 3: input validation
  const display_name = typeof b.display_name === "string" ? b.display_name.trim() : "";
  if (!display_name) return NextResponse.json({ error: "display_name is required." }, { status: 400 });

  const phone_number = typeof b.phone_number === "string" ? b.phone_number.trim() : "";
  if (!phone_number) return NextResponse.json({ error: "phone_number is required." }, { status: 400 });
  if (!/^\+[1-9]\d{6,14}$/.test(phone_number)) {
    return NextResponse.json({ error: "phone_number must be E.164 (e.g. +14155551234)." }, { status: 400 });
  }

  const consent_granted = b.consent_granted === true;
  if (!consent_granted) {
    return NextResponse.json({ error: "consent_granted must be true — explicit consent is required before creating a preparation." }, { status: 400 });
  }

  const purpose = typeof b.purpose === "string" ? b.purpose.trim() : "";
  if (!purpose) return NextResponse.json({ error: "purpose is required." }, { status: 400 });

  const reddit_handle = typeof b.reddit_handle === "string" ? b.reddit_handle.trim() : undefined;
  const timezone = typeof b.timezone === "string" ? b.timezone.trim() : undefined;

  // Optional thread context
  const tc = typeof b.thread_context === "object" && b.thread_context !== null
    ? b.thread_context as Record<string, unknown>
    : null;

  try {
    // Persist contact (phone stored encrypted by W1's createContact)
    const contact = await createContact({
      display_name,
      phone_number_encrypted: phone_number, // W1 encrypts on write
      reddit_handle: reddit_handle ?? null,
      timezone: timezone ?? null,
      consent_status: "granted",
      consent_source: "operator_declaration",
      consent_evidence: `Operator ${opId} declared explicit consent at ${new Date().toISOString()}`,
      consent_captured_at: new Date().toISOString(),
      consent_captured_by: opId,
    });

    // Persist thread context if supplied
    let threadCtx: { id: string; title?: string | null; thread_url?: string | null; source?: string | null; sent_reply?: string | null } | null = null;
    if (tc) {
      threadCtx = await createThreadContext({
        source: typeof tc.source === "string" ? tc.source : null,
        thread_url: typeof tc.url === "string" ? tc.url : null,
        title: typeof tc.title === "string" ? tc.title : null,
        body_excerpt: typeof tc.body_excerpt === "string" ? tc.body_excerpt : null,
        sent_reply: typeof tc.sent_reply === "string" ? tc.sent_reply : null,
      });
    }

    // Build VoiceContext for brief generation (local, no API)
    const voiceContext = {
      company_name: typeof b.company_name === "string" ? b.company_name.trim() : "GrowthRig",
      icp: typeof b.icp === "string" ? b.icp.trim() : "",
      goal: purpose,
      thread_title: threadCtx?.title ?? "",
      thread_url: threadCtx?.thread_url ?? "",
      source: threadCtx?.source ?? "",
      sent_reply: threadCtx?.sent_reply ?? "",
      conversation_history: [],
      facts: Array.isArray(b.facts) ? (b.facts as unknown[]).filter((f): f is string => typeof f === "string") : [],
      prohibited_claims: Array.isArray(b.prohibited_claims) ? (b.prohibited_claims as unknown[]).filter((f): f is string => typeof f === "string") : [],
    };

    const callRequest: VoiceCallRequest = {
      contact: {
        id: contact.id,
        display_name,
        phone_number,
        reddit_handle,
        consent_to_contact: true,
        timezone,
      },
      context: voiceContext,
      channel: "phone",
      purpose,
      confirmation_text: `CALL ${display_name}`,
    };

    const brief = prepareVoiceBrief(callRequest);

    // Generate one-time confirmation nonce
    const policy = getVoicePolicy();
    const { nonce, hash } = await createConfirmationNonce();
    const expiresAt = new Date(Date.now() + policy.confirmationTtlSeconds * 1000).toISOString();

    const agentStatus = getVoiceAgentStatus();

    // Persist preparation snapshot
    const prep = await createVoicePreparation({
      contact_id: contact.id,
      thread_context_id: threadCtx?.id ?? null,
      elevenlabs_agent_id: agentStatus.agent_id ?? null,
      purpose,
      context_snapshot: voiceContext as unknown as object,
      prompt_version: "v1",
      status: "draft",
      confirmation_nonce_hash: hash,
      confirmation_expires_at: expiresAt,
      confirmation_consumed_at: null,
      created_by: opId,
    });

    // Move to ready now that nonce is set
    await updateVoicePreparation(prep.id, { status: "ready" });

    return NextResponse.json({
      preparation_id: prep.id,
      contact_id: contact.id,
      status: "ready",
      confirmation_nonce: nonce,
      confirmation_expires_at: expiresAt,
      required_confirmation_text: `CALL ${display_name}`,
      brief: {
        system_prompt: brief.system_prompt,
        opening_line: brief.opening_line,
        context_summary: brief.context_summary,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const safe = msg.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]");
    return NextResponse.json({ error: `Preparation failed: ${safe}` }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const opId = operatorId(req);
  if (!opId) {
    return NextResponse.json({ error: "x-growthrig-operator-id header is required." }, { status: 401 });
  }
  if (!isVoicePersistenceAvailable()) {
    return NextResponse.json({ error: "Persistence unavailable." }, { status: 503 });
  }
  // Return minimal info — full detail available at /api/voice/preparations/[id]
  return NextResponse.json({
    message: "Use GET /api/voice/preparations/{id} for a specific preparation.",
  });
}
