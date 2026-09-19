// src/app/voice/page.tsx — Voice tab (server component)
//
// Human-in-the-loop: turn a thread reply into a consent-gated conversation
// brief. Nothing dials itself. The operator must explicitly confirm consent
// AND type a confirmation phrase before "Place confirmed call" enables.
//
// All contact / message state lives in the browser (localStorage) — not on
// the server — so this component never calls listContacts() or listPreparations().
// This is the correct design for Vercel serverless: in-memory globalThis state
// is not shared across function instances.
import { PageHead } from "@/components/ui/page-head";
import { ContentCard, CardSection } from "@/components/ui/content-card";
import { getVoiceAgentStatus } from "@/lib/voice";
import { VoiceWorkspace } from "./voice-workspace";

export const dynamic = "force-dynamic";

export default function VoicePage() {
  const agentStatus = getVoiceAgentStatus();

  const modeBadgeColor = agentStatus.mode === "live" ? "var(--ok, #22c55e)" : "var(--caution, #f59e0b)";
  const modeBadgeBg = agentStatus.mode === "live" ? "var(--ok-soft, #dcfce7)" : "var(--caution-soft, #fef9c3)";

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
              color: modeBadgeColor,
              background: modeBadgeBg,
              borderRadius: 999,
              padding: "3px 10px",
              flexShrink: 0,
            }}
          >
            {agentStatus.mode === "live" ? "Live" : "Preview-only"}
          </span>
        </div>
      </PageHead>

      {/* Agent status card — shown honestly, never implied as configured when it isn't */}
      {!agentStatus.configured && (
        <div
          style={{
            margin: "0 0 16px",
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid var(--caution, #f59e0b)",
            background: "var(--caution-soft, #fef9c3)",
            fontSize: 13,
            color: "var(--ink, #0f172a)",
          }}
        >
          <strong>Preview mode</strong> — {agentStatus.reason ?? "Voice agent not fully configured."}{" "}
          Call briefs are generated locally but no outbound calls will be placed.
        </div>
      )}

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
            The server independently verifies consent and the confirmation phrase on every call request — a scripted
            request without both returns <code>disabled</code>, never <code>queued</code>. All contact and context
            data is browser-owned (localStorage); nothing is persisted server-side in this demo.
          </p>
        </div>

        <CardSection>Workspace</CardSection>
        <div style={{ padding: "12px 20px 20px" }}>
          <VoiceWorkspace agentStatus={agentStatus} />
        </div>
      </ContentCard>
    </>
  );
}
