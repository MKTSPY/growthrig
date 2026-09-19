// POST /api/voice/preparations/[id]/confirm
//
// Atomically verifies and consumes the one-time nonce. Sets status="confirmed".
// No provider fetch.
//
// Returns:
//   200 { preparation_id, status: "confirmed" }
//   400 — missing confirmation_text
//   401 — missing operator header
//   409 — preparation not in ready state
//   410 — nonce expired or already consumed
//   404 — preparation not found
//   503 — persistence unavailable
import { NextRequest, NextResponse } from "next/server";
import { hashConfirmationNonce } from "@/lib/db/confirmation";
import {
  isVoicePersistenceAvailable,
  getVoicePreparationById,
  consumeConfirmationHash,
  updateVoicePreparation,
  getContactById,
} from "@/lib/db/voice-repository";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Gate: operator auth
  const opId = req.headers.get("x-growthrig-operator-id")?.trim();
  if (!opId) {
    return NextResponse.json({ error: "x-growthrig-operator-id header is required." }, { status: 401 });
  }

  // Gate: persistence
  if (!isVoicePersistenceAvailable()) {
    return NextResponse.json({ error: "Persistence unavailable." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const b = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};

  const confirmation_text = typeof b.confirmation_text === "string" ? b.confirmation_text.trim() : "";
  if (!confirmation_text) {
    return NextResponse.json({ error: "confirmation_text is required." }, { status: 400 });
  }

  // Load preparation
  const prep = await getVoicePreparationById(params.id).catch(() => null);
  if (!prep) {
    return NextResponse.json({ error: "Preparation not found." }, { status: 404 });
  }

  // State check
  if (prep.status !== "ready" && prep.status !== "draft") {
    return NextResponse.json({
      error: `Preparation is in status "${prep.status}" — only ready/draft preparations can be confirmed.`,
    }, { status: 409 });
  }

  // Already consumed?
  if (prep.confirmation_consumed_at) {
    return NextResponse.json({
      error: "Confirmation nonce has already been consumed. Each preparation can only be confirmed once.",
    }, { status: 410 });
  }

  // TTL check
  if (prep.confirmation_expires_at && new Date(prep.confirmation_expires_at) < new Date()) {
    return NextResponse.json({
      error: "Confirmation nonce has expired. Create a new preparation.",
    }, { status: 410 });
  }

  // Verify exact phrase "CALL <display_name>"
  const contact = prep.contact_id ? await getContactById(prep.contact_id).catch(() => null) : null;
  const expectedText = `CALL ${contact?.display_name ?? ""}`;
  if (confirmation_text !== expectedText) {
    return NextResponse.json({
      error: `confirmation_text must be exactly: "${expectedText}"`,
    }, { status: 400 });
  }

  // Atomically consume the nonce
  const nonce_hash = prep.confirmation_nonce_hash ?? "";
  // We must verify the nonce matches the stored hash. The body may supply a nonce for re-verification.
  const supplied_nonce = typeof b.nonce === "string" ? b.nonce.trim() : "";
  if (supplied_nonce) {
    const suppliedHash = hashConfirmationNonce(supplied_nonce);
    if (suppliedHash !== nonce_hash) {
      return NextResponse.json({ error: "Nonce mismatch." }, { status: 410 });
    }
  }

  const consumed = await consumeConfirmationHash(params.id, nonce_hash);
  if (!consumed) {
    return NextResponse.json({
      error: "Failed to consume nonce — it may have already been used.",
    }, { status: 410 });
  }

  await updateVoicePreparation(params.id, { status: "confirmed" });

  return NextResponse.json({
    preparation_id: params.id,
    status: "confirmed",
  });
}
