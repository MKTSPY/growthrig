// POST /api/voice/call — fully stateless, no server-side store reads.
//
// Accepts { request: VoiceCallRequest, confirmation_text } from the browser.
// The server independently re-validates all safety gates before any call
// attempt — never trusting client-side consent state alone.
//
// Pre-flight checks (all return "disabled", no network on failure):
//   1. request.contact.consent_to_contact === true
//   2. request.contact.phone_number present
//   3. confirmation_text === `CALL ${request.contact.display_name}` exactly
//   4. request.channel === "phone"
//   ... then W1's startConfirmedCall enforces key/agent-id checks too.
import { NextRequest, NextResponse } from "next/server";
import { startConfirmedCall } from "@/lib/voice";
import type { VoiceCallRequest } from "@/lib/voice";

export const dynamic = "force-dynamic";

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

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

  // ── Unpack the call request sent by the browser ──────────────────────────
  if (typeof b.request !== "object" || b.request === null) {
    return NextResponse.json({ error: "request (VoiceCallRequest) is required." }, { status: 400 });
  }

  const requestRaw = b.request as Record<string, unknown>;
  const contactRaw =
    typeof requestRaw.contact === "object" && requestRaw.contact !== null
      ? (requestRaw.contact as Record<string, unknown>)
      : {};

  const display_name = str(contactRaw.display_name);
  if (!display_name) {
    return NextResponse.json({ error: "request.contact.display_name is required." }, { status: 400 });
  }

  const clientConfirmation = str(b.confirmation_text);
  if (!clientConfirmation) {
    return NextResponse.json({ error: "confirmation_text is required." }, { status: 400 });
  }

  // Reconstitute VoiceCallRequest from the browser payload.
  // We do minimal coercion and let the adapter's own pre-flights do the rest.
  const callRequest = requestRaw as unknown as VoiceCallRequest;

  // ── Server-side gate 1: consent (never trust client checkbox alone) ───────
  if (!callRequest.contact?.consent_to_contact) {
    return NextResponse.json({
      result: {
        status: "disabled",
        message:
          `No call placed. "${display_name}" has not consented to be contacted by phone. ` +
          "Record explicit consent before attempting a call.",
      },
    });
  }

  // ── Server-side gate 2: phone number present ──────────────────────────────
  if (!callRequest.contact?.phone_number?.trim()) {
    return NextResponse.json({
      result: {
        status: "disabled",
        message:
          `No call placed. "${display_name}" has no phone number on record. ` +
          "Add an E.164 phone number (e.g. +14155551234) before placing a call.",
      },
    });
  }

  // ── Server-side gate 3: exact confirmation phrase ─────────────────────────
  const expectedConfirmation = `CALL ${display_name}`;
  if (clientConfirmation !== expectedConfirmation) {
    return NextResponse.json({
      result: {
        status: "disabled",
        message:
          `Confirmation text mismatch. Expected exactly: "${expectedConfirmation}". ` +
          `Received: "${clientConfirmation}". No call placed.`,
      },
    });
  }

  // ── Server-side gate 4: channel must be phone ─────────────────────────────
  if (callRequest.channel !== "phone") {
    return NextResponse.json({
      result: {
        status: "disabled",
        message:
          `No call placed. Outbound voice calls require channel="phone"; ` +
          `received "${String(callRequest.channel)}".`,
      },
    });
  }

  // ── Inject the verified confirmation_text (use server-derived, not client) ─
  callRequest.confirmation_text = clientConfirmation;

  // ── Attempt the call (W1 enforces key/agent-id checks) ───────────────────
  let result;
  try {
    result = await startConfirmedCall(callRequest);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const safe = msg.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]");
    return NextResponse.json({ error: `Call attempt threw: ${safe}` }, { status: 500 });
  }

  return NextResponse.json({ result });
}
