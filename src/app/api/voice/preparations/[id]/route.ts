// GET /api/voice/preparations/[id] — safe summary, phone masked.
// x-growthrig-operator-id required.
import { NextRequest, NextResponse } from "next/server";
import { isVoicePersistenceAvailable, getVoicePreparationById, getContactById } from "@/lib/db/voice-repository";

export const dynamic = "force-dynamic";

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const clean = phone.replace(/[^0-9]/g, "");
  return "+" + clean.slice(0, -4).replace(/./g, "X") + clean.slice(-4);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const opId = req.headers.get("x-growthrig-operator-id")?.trim();
  if (!opId) {
    return NextResponse.json({ error: "x-growthrig-operator-id header is required." }, { status: 401 });
  }
  if (!isVoicePersistenceAvailable()) {
    return NextResponse.json({ error: "Persistence unavailable." }, { status: 503 });
  }

  const prep = await getVoicePreparationById(params.id).catch(() => null);
  if (!prep) {
    return NextResponse.json({ error: "Preparation not found." }, { status: 404 });
  }

  const contact = prep.contact_id
    ? await getContactById(prep.contact_id).catch(() => null)
    : null;

  return NextResponse.json({
    id: prep.id,
    status: prep.status,
    purpose: prep.purpose,
    created_at: prep.created_at,
    updated_at: prep.updated_at,
    confirmation_expires_at: prep.confirmation_expires_at,
    confirmation_consumed: !!prep.confirmation_consumed_at,
    contact: contact
      ? {
          id: contact.id,
          display_name: contact.display_name,
          phone_number_masked: maskPhone(contact.phone_number_encrypted),
          consent_status: contact.consent_status,
        }
      : null,
  });
}
