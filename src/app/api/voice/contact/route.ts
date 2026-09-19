// POST /api/voice/contact — validation-only, stateless.
//
// On Vercel serverless each function instance has its own memory; we cannot
// rely on a server-side store being reachable from the next request. This
// route validates the contact fields and echoes back a normalised contact
// object. The browser owns the canonical copy in localStorage.
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

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

  // Both "save" and "validate" actions — just validate and echo back.
  const display_name = typeof b.display_name === "string" ? b.display_name.trim() : "";
  if (!display_name) {
    return NextResponse.json({ error: "display_name is required." }, { status: 400 });
  }

  const phone_number = typeof b.phone_number === "string" && b.phone_number.trim()
    ? b.phone_number.trim()
    : undefined;
  const reddit_handle = typeof b.reddit_handle === "string" && b.reddit_handle.trim()
    ? b.reddit_handle.trim()
    : undefined;

  if (!phone_number && !reddit_handle) {
    return NextResponse.json(
      { error: "Provide at least phone_number or reddit_handle." },
      { status: 400 },
    );
  }

  const consent_to_contact = b.consent_to_contact === true;
  const id = typeof b.id === "string" && b.id.trim()
    ? b.id.trim()
    : `c_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date().toISOString();

  // Return the validated, normalised contact. The browser stores this.
  const contact = {
    id,
    display_name,
    phone_number,
    reddit_handle,
    consent_to_contact,
    created_at: typeof b.created_at === "string" ? b.created_at : now,
    updated_at: now,
  };

  return NextResponse.json({
    contact,
    note: "Validation only — this contact is not persisted server-side. Store it in the browser.",
  });
}
