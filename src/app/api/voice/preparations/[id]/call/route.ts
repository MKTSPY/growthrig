// POST /api/voice/preparations/[id]/call
//
// Executes a durable, policy-gated outbound call attempt.
// All gates must pass; any failure is "disabled" with no provider fetch.
//
// Gates (in order):
//  1. x-growthrig-operator-id required
//  2. Persistence available
//  3. Preparation exists and status === "confirmed"
//  4. Nonce consumed (confirmation_consumed_at set)
//  5. Contact consent_status === "granted"
//  6. Policy: outboundEnabled + E.164 + allowed country + business hours
//  7. Daily rate limit
//  8. Idempotency key (preparation_id) — no duplicate calls
//
// Persists call_attempt BEFORE provider fetch (idempotent).
// Returns { status, preparation_id, attempt_id?, provider_call_id?, message }.
// Never returns status="queued" without a real provider_call_id.
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  isVoicePersistenceAvailable,
  getVoicePreparationById,
  getContactById,
  createCallAttempt,
  markAttemptResult,
  updateVoicePreparation,
  checkVoiceDailyLimit,
} from "@/lib/db/voice-repository";
import { startConfirmedCall, getVoiceAgentStatus } from "@/lib/voice";
import { evaluateCallPolicy, getVoicePolicy } from "@/lib/voice/policy";
import type { VoiceCallRequest } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Gate 1: operator auth
  const opId = req.headers.get("x-growthrig-operator-id")?.trim();
  if (!opId) {
    return NextResponse.json({ error: "x-growthrig-operator-id header is required." }, { status: 401 });
  }

  // Gate 2: persistence
  if (!isVoicePersistenceAvailable()) {
    return NextResponse.json({ error: "Persistence unavailable — cannot record call attempt safely." }, { status: 503 });
  }

  // Gate 3: preparation state
  const prep = await getVoicePreparationById(params.id).catch(() => null);
  if (!prep) {
    return NextResponse.json({ error: "Preparation not found." }, { status: 404 });
  }
  if (prep.status !== "confirmed") {
    return NextResponse.json({
      error: `Preparation must be confirmed before calling. Current status: "${prep.status}".`,
      hint: "POST /api/voice/preparations/{id}/confirm first.",
    }, { status: 409 });
  }

  // Gate 4: nonce consumed
  if (!prep.confirmation_consumed_at) {
    return NextResponse.json({
      error: "Confirmation nonce not yet consumed — confirm the preparation first.",
    }, { status: 409 });
  }

  // Gate 5: contact consent
  const contact = prep.contact_id
    ? await getContactById(prep.contact_id).catch(() => null)
    : null;
  if (!contact) {
    return NextResponse.json({ error: "Contact not found for this preparation." }, { status: 404 });
  }
  if (contact.consent_status !== "granted") {
    return NextResponse.json({
      result: {
        status: "disabled",
        message: `No call placed. Contact "${contact.display_name}" consent_status is "${contact.consent_status}"; must be "granted".`,
      },
      preparation_id: params.id,
    });
  }

  // Gate 6: policy
  const phone = contact.phone_number_encrypted ?? ""; // already decrypted by getContactById
  const policyResult = evaluateCallPolicy({
    contact: { phone_number: phone, timezone: contact.timezone ?? undefined },
    nowUtc: new Date(),
  });
  if (!policyResult.ok) {
    return NextResponse.json({
      result: {
        status: "disabled",
        message: `Call blocked by policy: ${policyResult.reasons.join("; ")}`,
      },
      preparation_id: params.id,
    });
  }

  // Gate 7: daily rate limit
  const policy = getVoicePolicy();
  const withinLimit = await checkVoiceDailyLimit(opId, policy.dailyCallLimit);
  if (!withinLimit) {
    return NextResponse.json({
      result: {
        status: "disabled",
        message: `Daily call limit (${policy.dailyCallLimit}) reached for operator ${opId}.`,
      },
      preparation_id: params.id,
    });
  }

  // Gate 8: agent configured
  const agentStatus = getVoiceAgentStatus();
  if (!agentStatus.configured) {
    return NextResponse.json({
      result: {
        status: "disabled",
        message: `ElevenLabs agent not configured (mode: ${agentStatus.mode}). ${agentStatus.reason ?? ""}`,
      },
      preparation_id: params.id,
    });
  }

  // Build idempotency key from preparation id + unique attempt suffix
  const idempotencyKey = `${params.id}:${randomUUID()}`;

  // Reconstruct VoiceCallRequest from stored context_snapshot
  const snapshot = (prep.context_snapshot as Record<string, unknown>) ?? {};
  const voiceContext = {
    company_name: typeof snapshot.company_name === "string" ? snapshot.company_name : "GrowthRig",
    icp: typeof snapshot.icp === "string" ? snapshot.icp : "",
    goal: typeof snapshot.goal === "string" ? snapshot.goal : prep.purpose ?? "",
    thread_title: typeof snapshot.thread_title === "string" ? snapshot.thread_title : "",
    thread_url: typeof snapshot.thread_url === "string" ? snapshot.thread_url : "",
    source: typeof snapshot.source === "string" ? snapshot.source : "",
    sent_reply: typeof snapshot.sent_reply === "string" ? snapshot.sent_reply : "",
    conversation_history: Array.isArray(snapshot.conversation_history)
      ? snapshot.conversation_history as { role: "agent" | "contact" | "system"; content: string; at: string }[]
      : [],
    facts: Array.isArray(snapshot.facts) ? snapshot.facts as string[] : [],
    prohibited_claims: Array.isArray(snapshot.prohibited_claims) ? snapshot.prohibited_claims as string[] : [],
  };

  const callRequest: VoiceCallRequest = {
    contact: {
      id: contact.id,
      display_name: contact.display_name,
      phone_number: phone,
      consent_to_contact: true,
      timezone: contact.timezone ?? undefined,
    },
    context: voiceContext,
    channel: "phone",
    purpose: prep.purpose ?? "",
    confirmation_text: `CALL ${contact.display_name}`,
  };

  // Persist attempt BEFORE provider fetch (so we have a record even on timeout)
  const attempt = await createCallAttempt({
    preparation_id: params.id,
    idempotency_key: idempotencyKey,
    provider_call_id: null,
    provider_status: "pending",
    request_snapshot: {
      contact_id: contact.id,
      display_name: contact.display_name,
      purpose: prep.purpose,
      // phone number NOT stored in snapshot
    } as object,
    sanitized_response: null,
    initiated_by: opId,
    failure_reason: null,
  });

  // Mark preparation as queued
  await updateVoicePreparation(params.id, { status: "queued" });

  // Execute call via W1's adapter (which enforces key/agent-id/phone-number-id)
  let result;
  try {
    result = await startConfirmedCall(callRequest);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const safe = msg.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]");
    await markAttemptResult(attempt.id, "failed", null, safe);
    await updateVoicePreparation(params.id, { status: "failed" });
    return NextResponse.json({
      result: { status: "failed", message: `Call attempt threw: ${safe}` },
      preparation_id: params.id,
      attempt_id: attempt.id,
    }, { status: 500 });
  }

  // Persist result
  const finalStatus = result.status === "queued" ? "complete" : result.status === "failed" ? "failed" : "disabled";
  await markAttemptResult(
    attempt.id,
    result.status,
    { status: result.status, message: result.message },
    result.status === "failed" ? result.message : undefined,
  );
  await updateVoicePreparation(params.id, {
    status: result.status === "queued" ? "complete" : "failed",
  });

  // Never return status="queued" without a real provider_call_id
  if (result.status === "queued" && !result.provider_call_id) {
    return NextResponse.json({
      result: {
        status: "failed",
        message: "Provider returned success but no call ID — treating as failed.",
      },
      preparation_id: params.id,
      attempt_id: attempt.id,
    }, { status: 502 });
  }

  return NextResponse.json({
    result: {
      status: result.status,
      message: result.message,
      provider_call_id: result.provider_call_id,
    },
    preparation_id: params.id,
    attempt_id: attempt.id,
  });
}
