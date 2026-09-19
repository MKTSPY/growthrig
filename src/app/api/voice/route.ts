// GET /api/voice — health + capability flags for the Voice tab.
//
// The UI reads this on every page load and gates the "Durable live calling"
// panel on ALL of: agentConfigured && persistenceAvailable && outboundEnabled
// && operatorRequired.  When any flag is false the real-call button is
// replaced by a checklist of what is missing — no misleadingly-enabled UI.
//
// No secrets are returned.
import { NextResponse } from "next/server";
import { getVoiceAgentStatus } from "@/lib/voice";
import { isVoicePersistenceAvailable } from "@/lib/db/voice-repository";
import { getVoicePolicy } from "@/lib/voice/policy";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agentStatus = getVoiceAgentStatus();
    const persistenceAvailable = isVoicePersistenceAvailable();
    const policy = getVoicePolicy();

    const missing: string[] = [];
    if (!agentStatus.configured)
      missing.push("ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID + ELEVENLABS_PHONE_NUMBER_ID");
    if (!persistenceAvailable)
      missing.push("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    if (!policy.outboundEnabled)
      missing.push("VOICE_OUTBOUND_ENABLED=true");

    const allGatesGreen =
      agentStatus.configured && persistenceAvailable && policy.outboundEnabled;

    return NextResponse.json({
      agentConfigured: agentStatus.configured,
      agentMode: agentStatus.mode,
      outboundEnabled: policy.outboundEnabled,
      persistenceAvailable,
      operatorRequired: policy.operatorAuthRequired,
      prepMode: allGatesGreen ? "durable" : "preview",
      missing,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
