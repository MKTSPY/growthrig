import { PageHead } from "@/components/ui/page-head";
import { ContentCard, CardSection } from "@/components/ui/content-card";
import { getVoiceAgentStatus } from "@/lib/voice";
import { isVoicePersistenceAvailable } from "@/lib/db/voice-repository";
import { getVoicePolicy } from "@/lib/voice/policy";
import { VoiceWorkspace } from "./voice-workspace";

export const dynamic = "force-dynamic";

export interface VoiceStatus {
  agentConfigured: boolean;
  agentMode: "live" | "preview";
  outboundEnabled: boolean;
  persistenceAvailable: boolean;
  operatorRequired: boolean;
  prepMode: "durable" | "preview";
  missing: string[];
  reason?: string;
}

export default function VoicePage() {
  // Server-side aggregation of the same flags exposed by GET /api/voice, so
  // the SSR'd page never mis-renders the live state.
  const agentStatus = getVoiceAgentStatus();
  const persistenceAvailable = isVoicePersistenceAvailable();
  const policy = getVoicePolicy();
  const missing: string[] = [];
  if (!agentStatus.configured)
    missing.push("ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID + ELEVENLABS_PHONE_NUMBER_ID");
  if (!persistenceAvailable)
    missing.push("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  if (!policy.outboundEnabled) missing.push("VOICE_OUTBOUND_ENABLED=true");
  const allGatesGreen =
    agentStatus.configured && persistenceAvailable && policy.outboundEnabled;

  const voiceStatus: VoiceStatus = {
    agentConfigured: agentStatus.configured,
    agentMode: agentStatus.mode,
    outboundEnabled: policy.outboundEnabled,
    persistenceAvailable,
    operatorRequired: policy.operatorAuthRequired,
    prepMode: allGatesGreen ? "durable" : "preview",
    missing,
    reason: !agentStatus.configured ? agentStatus.reason : undefined,
  };

  const bannerBg = voiceStatus.prepMode === "durable" ? "var(--ok-soft, #dcfce7)" : "var(--caution-soft, #fef9c3)";
  const bannerBorder = voiceStatus.prepMode === "durable" ? "var(--ok, #22c55e)" : "var(--caution, #f59e0b)";
  const badgeColor = voiceStatus.prepMode === "durable" ? "var(--ok, #22c55e)" : "var(--caution, #f59e0b)";

  return (
    <>
      <PageHead eyebrow="Human-in-the-loop" title="Voice">
        <div className="filters-row" style={{ alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--slate, #64748b)", flex: 1 }}>
            Turn a thread reply into a consent-gated conversation brief. Nothing calls without explicit confirmation.
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: badgeColor,
              background: bannerBg,
              borderRadius: 999,
              padding: "3px 10px",
              flexShrink: 0,
              border: `1px solid ${bannerBorder}`,
            }}
          >
            {voiceStatus.prepMode === "durable" ? "Live" : "Preview-only"}
          </span>
        </div>
      </PageHead>

      <div
        style={{
          margin: "0 0 16px",
          padding: "12px 16px",
          borderRadius: 10,
          border: `1px solid ${bannerBorder}`,
          background: bannerBg,
          fontSize: 13,
          color: "var(--ink, #0f172a)",
        }}
      >
        {voiceStatus.prepMode === "durable" ? (
          <>
            <strong>Live calling available.</strong> All gates green. The browser still requires you to type the
            confirmation phrase before any call is queued.
          </>
        ) : (
          <>
            <strong>Preview mode.</strong> The browser-local <em>Preview Brief</em> builder works, but durable live
            calling requires: {voiceStatus.missing.join(", ")}.
            {voiceStatus.reason && (
              <span style={{ color: "var(--slate, #64748b)", marginLeft: 8 }}>({voiceStatus.reason})</span>
            )}
          </>
        )}
      </div>

      <ContentCard>
        <CardSection>How it works</CardSection>
        <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--ink, #0f172a)", lineHeight: 1.7 }}>
            <li>
              <strong>A — Contact:</strong> Enter who you want to speak with — name, phone (optional), Reddit handle (optional). Tick the consent checkbox <em>only</em> when you have genuine opt-in. Draft is saved in your browser.
            </li>
            <li>
              <strong>B — Conversation context:</strong> Paste the thread title, URL, the reply your agent sent, and their response. These ground the voice agent — it will only state facts present here.
            </li>
            <li>
              <strong>C — Call preview &amp; confirm:</strong> Enter the call purpose and generate a brief. Review the system prompt and opening line. Then tick the consent checkbox <em>and</em> type the exact confirmation phrase to enable the call button.
            </li>
          </ol>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--slate, #64748b)" }}>
            When live calling is enabled, every request goes through the durable prep/confirm/call flow with
            server-side consent, single-use nonce, daily limit, and idempotency. A scripted request without all
            gates returns <code>disabled</code>, never <code>queued</code>.
          </p>
        </div>

        <CardSection>Workspace</CardSection>
        <div style={{ padding: "12px 20px 20px" }}>
          <VoiceWorkspace agentStatus={agentStatus} voiceStatus={voiceStatus} />
        </div>
      </ContentCard>
    </>
  );
}
