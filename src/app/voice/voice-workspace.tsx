"use client";

import { useEffect, useRef, useState } from "react";
import type { VoiceAgentStatus, VoiceCallRequest } from "@/lib/voice";

// ---------------------------------------------------------------------------
// Draft shape — everything the browser owns in localStorage
// ---------------------------------------------------------------------------

const DRAFT_KEY = "growthrig-voice-draft-v1";

interface ConversationTurn {
  role: "agent" | "contact";
  content: string;
  at: string;
}

interface VoiceDraft {
  // Section A — contact
  displayName: string;
  phone: string;
  reddit: string;
  consentedToContact: boolean;
  contactId: string;

  // Section B — thread context
  threadTitle: string;
  threadUrl: string;
  source: string;
  sentReply: string;
  theirResponse: string;
  history: ConversationTurn[];

  // Section C — call
  purpose: string;
}

const EMPTY_DRAFT: VoiceDraft = {
  displayName: "",
  phone: "",
  reddit: "",
  consentedToContact: false,
  contactId: "",
  threadTitle: "",
  threadUrl: "",
  source: "Reddit",
  sentReply: "",
  theirResponse: "",
  history: [],
  purpose: "",
};

function loadDraft(): VoiceDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<VoiceDraft>) };
  } catch {
    return EMPTY_DRAFT;
  }
}

function saveDraft(draft: VoiceDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // localStorage may be blocked in some environments — ignore silently.
  }
}

// ---------------------------------------------------------------------------
// Types for API responses
// ---------------------------------------------------------------------------

interface Brief {
  system_prompt: string;
  opening_line: string;
  context_summary: string;
}

interface PrepareResponse {
  preparation: { id: string; purpose: string; status: string; confirmation_text: string };
  brief: Brief;
  request: VoiceCallRequest;
}

interface CallResult {
  status: "queued" | "disabled" | "failed";
  provider_call_id?: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function colorFor(mode: VoiceAgentStatus["mode"]): string {
  return mode === "live" ? "var(--ok, #22c55e)" : "var(--caution, #f59e0b)";
}

// ---------------------------------------------------------------------------
// Main VoiceWorkspace (single unified component with tabbed sections)
// ---------------------------------------------------------------------------

export function VoiceWorkspace({ agentStatus }: { agentStatus: VoiceAgentStatus }) {
  // ── Draft state — hydrated from localStorage on mount ──────────────────
  const [draft, setDraftRaw] = useState<VoiceDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDraftRaw(loadDraft());
    setHydrated(true);
  }, []);

  function setDraft(updater: Partial<VoiceDraft> | ((prev: VoiceDraft) => VoiceDraft)) {
    setDraftRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      saveDraft(next);
      return next;
    });
  }

  // ── Section A state ─────────────────────────────────────────────────────
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSaved, setContactSaved] = useState(false);

  // ── Section B state ─────────────────────────────────────────────────────
  const [contextSaved, setContextSaved] = useState(false);

  // ── Section C state ─────────────────────────────────────────────────────
  const [prepResult, setPrepResult] = useState<PrepareResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);

  const [consentChecked, setConsentChecked] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [calling, setCalling] = useState(false);
  const [callResult, setCallResult] = useState<CallResult | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const expectedConfirm = draft.displayName ? `CALL ${draft.displayName}` : "";
  const canCall =
    consentChecked &&
    confirmInput === expectedConfirm &&
    !!prepResult &&
    !calling &&
    !!draft.displayName;

  // ── Section A: save contact (validation + echo, browser keeps canonical) ─
  async function handleSaveContact() {
    setContactError(null);
    setContactSaving(true);
    setContactSaved(false);
    try {
      const res = await fetch("/api/voice/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          id: draft.contactId || undefined,
          display_name: draft.displayName,
          phone_number: draft.phone || undefined,
          reddit_handle: draft.reddit || undefined,
          consent_to_contact: draft.consentedToContact,
        }),
      });
      const data = await res.json() as { contact?: { id: string }; error?: string };
      if (!res.ok || !data.contact) {
        setContactError(data.error ?? "Validation failed.");
        return;
      }
      // Update contactId in draft (server may have generated one).
      setDraft({ contactId: data.contact.id });
      setContactSaved(true);
    } catch (e) {
      setContactError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setContactSaving(false);
    }
  }

  // ── Section B: save context messages ────────────────────────────────────
  function handleSaveContext() {
    const newHistory: ConversationTurn[] = [];
    const now = new Date().toISOString();
    if (draft.sentReply.trim()) {
      newHistory.push({ role: "agent", content: draft.sentReply.trim(), at: now });
    }
    if (draft.theirResponse.trim()) {
      newHistory.push({ role: "contact", content: draft.theirResponse.trim(), at: now });
    }
    setDraft({ history: newHistory });
    setContextSaved(true);
    setTimeout(() => setContextSaved(false), 2000);
  }

  // ── Section C: generate brief ────────────────────────────────────────────
  async function handleGenerateBrief() {
    if (!draft.displayName.trim() || !draft.purpose.trim()) return;
    setGenerating(true);
    setPrepError(null);
    setPrepResult(null);
    setCallResult(null);

    // Build conversation_history from draft.history, or synthesise from fields.
    const history =
      draft.history.length > 0
        ? draft.history
        : [
            draft.sentReply.trim()
              ? { role: "agent" as const, content: draft.sentReply.trim(), at: new Date().toISOString() }
              : null,
            draft.theirResponse.trim()
              ? { role: "contact" as const, content: draft.theirResponse.trim(), at: new Date().toISOString() }
              : null,
          ].filter(Boolean);

    const payload = {
      contact: {
        id: draft.contactId || undefined,
        display_name: draft.displayName,
        phone_number: draft.phone || undefined,
        reddit_handle: draft.reddit || undefined,
        consent_to_contact: draft.consentedToContact,
      },
      thread: {
        title: draft.threadTitle,
        url: draft.threadUrl,
        source: draft.source,
      },
      sent_reply: draft.sentReply,
      response: draft.theirResponse,
      conversation_history: history,
      purpose: draft.purpose,
    };

    try {
      const res = await fetch("/api/voice/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as PrepareResponse & { error?: string };
      if (!res.ok) {
        setPrepError(data.error ?? "Failed to generate brief.");
        return;
      }
      setPrepResult(data);
    } catch (e) {
      setPrepError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setGenerating(false);
    }
  }

  // ── Section C: place call ────────────────────────────────────────────────
  async function handlePlaceCall() {
    if (!prepResult || !canCall) return;
    setCalling(true);
    setCallResult(null);
    setCallError(null);
    try {
      const res = await fetch("/api/voice/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: prepResult.request,
          confirmation_text: confirmInput,
        }),
      });
      const data = await res.json() as { result?: CallResult; error?: string };
      if (!res.ok) {
        setCallError(data.error ?? "Server error.");
        return;
      }
      if (data.result) setCallResult(data.result);
    } catch (e) {
      setCallError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setCalling(false);
    }
  }

  // ── Persistence notice ref (avoid re-rendering) ──────────────────────────
  const noticeRef = useRef<HTMLParagraphElement>(null);

  if (!hydrated) {
    return <div style={{ padding: "20px", fontSize: 13, color: "var(--slate, #64748b)" }}>Loading…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Persistence notice */}
      <p
        ref={noticeRef}
        style={{
          fontSize: 12,
          color: "var(--slate, #64748b)",
          background: "var(--pill, #f1f5f9)",
          borderRadius: 6,
          padding: "8px 12px",
          marginBottom: 20,
          marginTop: 0,
        }}
      >
        📋 Voice call briefs are saved in <strong>this browser</strong> for this session
        (localStorage key: <code>growthrig-voice-draft-v1</code>). They are not stored
        server-side — refresh to reload your draft.
      </p>

      {/* ── Section A: Contact ────────────────────────────────────────────── */}
      <section style={{ marginBottom: 28 }}>
        <SectionHead label="A — Contact" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Display name *">
            <input
              value={draft.displayName}
              onChange={(e) => setDraft({ displayName: e.target.value })}
              placeholder="e.g. Alice Smith or u/alice_smith"
              style={inputStyle}
            />
          </Field>
          <Field label="Phone number (E.164)">
            <input
              value={draft.phone}
              onChange={(e) => setDraft({ phone: e.target.value })}
              placeholder="+14155551234"
              style={inputStyle}
            />
          </Field>
          <Field label="Reddit handle (without u/)">
            <input
              value={draft.reddit}
              onChange={(e) => setDraft({ reddit: e.target.value })}
              placeholder="alice_smith"
              style={inputStyle}
            />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink, #0f172a)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={draft.consentedToContact}
              onChange={(e) => setDraft({ consentedToContact: e.target.checked })}
            />
            They consented to be contacted by phone.
          </label>
          {contactError && <p style={errorStyle}>{contactError}</p>}
          {contactSaved && (
            <p style={{ fontSize: 12, color: "var(--ok, #22c55e)", margin: 0 }}>
              ✓ Contact validated and saved to browser draft.
            </p>
          )}
          <button
            onClick={handleSaveContact}
            disabled={contactSaving || !draft.displayName.trim() || (!draft.phone.trim() && !draft.reddit.trim())}
            style={btnStyle(contactSaving || !draft.displayName.trim() || (!draft.phone.trim() && !draft.reddit.trim()))}
          >
            {contactSaving ? "Validating…" : "Validate & save contact"}
          </button>
        </div>
      </section>

      <Divider />

      {/* ── Section B: Context ────────────────────────────────────────────── */}
      <section style={{ marginBottom: 28 }}>
        <SectionHead label="B — Conversation context" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Thread title">
            <input
              value={draft.threadTitle}
              onChange={(e) => setDraft({ threadTitle: e.target.value })}
              placeholder="e.g. Ask HN: How do you track per-service Kubernetes costs?"
              style={inputStyle}
            />
          </Field>
          <Field label="Thread URL">
            <input
              value={draft.threadUrl}
              onChange={(e) => setDraft({ threadUrl: e.target.value })}
              placeholder="https://news.ycombinator.com/item?id=..."
              style={inputStyle}
            />
          </Field>
          <Field label="Source">
            <select
              value={draft.source}
              onChange={(e) => setDraft({ source: e.target.value })}
              style={inputStyle}
            >
              <option>Reddit</option>
              <option>Hacker News</option>
              <option>Web</option>
            </select>
          </Field>
          <Field label="The reply we sent">
            <textarea
              value={draft.sentReply}
              onChange={(e) => setDraft({ sentReply: e.target.value })}
              rows={4}
              placeholder="Paste the reply or comment your agent posted…"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
          <Field label="Their response">
            <textarea
              value={draft.theirResponse}
              onChange={(e) => setDraft({ theirResponse: e.target.value })}
              rows={4}
              placeholder="Paste what they replied back…"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
          {draft.history.length > 0 && (
            <p style={{ fontSize: 12, color: "var(--slate, #64748b)", margin: 0 }}>
              {draft.history.length} context message{draft.history.length !== 1 ? "s" : ""} saved in browser draft.
            </p>
          )}
          {contextSaved && (
            <p style={{ fontSize: 12, color: "var(--ok, #22c55e)", margin: 0 }}>✓ Context saved to browser draft.</p>
          )}
          <button
            onClick={handleSaveContext}
            disabled={!draft.sentReply.trim() && !draft.theirResponse.trim()}
            style={btnStyle(!draft.sentReply.trim() && !draft.theirResponse.trim())}
          >
            Save context to draft
          </button>
        </div>
      </section>

      <Divider />

      {/* ── Section C: Call preview + confirm ───────────────────────────── */}
      <section>
        <SectionHead label="C — Call preview & confirm" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Purpose of this call">
            <input
              value={draft.purpose}
              onChange={(e) => setDraft({ purpose: e.target.value })}
              placeholder="e.g. Follow up on their reply about cost attribution tooling"
              style={inputStyle}
            />
          </Field>
          <button
            onClick={handleGenerateBrief}
            disabled={generating || !draft.displayName.trim() || !draft.purpose.trim()}
            style={btnStyle(generating || !draft.displayName.trim() || !draft.purpose.trim())}
          >
            {generating ? "Generating…" : "Generate call brief"}
          </button>
          {prepError && <p style={errorStyle}>{prepError}</p>}

          {prepResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ReadOnly label="Opening line" value={prepResult.brief.opening_line} rows={3} />
              <ReadOnly label="Context summary" value={prepResult.brief.context_summary} mono rows={6} />
              <ReadOnly label="System prompt (agent instructions)" value={prepResult.brief.system_prompt} mono rows={10} />

              {/* Strict confirmation block */}
              <div style={{ border: "1px solid var(--caution, #f59e0b)", borderRadius: 8, padding: 14, marginTop: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink, #0f172a)", marginTop: 0, marginBottom: 8 }}>
                  Strict confirmation required before placing any call.
                </p>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--ink, #0f172a)", cursor: "pointer", marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  I confirm this contact consented and I want to place this call.
                </label>
                <Field label={`Type exactly to enable: ${expectedConfirm}`}>
                  <input
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={expectedConfirm}
                    style={{
                      ...inputStyle,
                      borderColor:
                        confirmInput && confirmInput !== expectedConfirm
                          ? "var(--critical, #ef4444)"
                          : undefined,
                    }}
                  />
                </Field>
                <button
                  onClick={handlePlaceCall}
                  disabled={!canCall}
                  style={{
                    ...btnStyle(!canCall),
                    marginTop: 10,
                    background: canCall ? "var(--critical, #ef4444)" : undefined,
                  }}
                >
                  {calling ? "Placing call…" : "Place confirmed call"}
                </button>
              </div>

              {callError && <p style={errorStyle}>{callError}</p>}

              {callResult && (
                <div
                  style={{
                    borderRadius: 8,
                    padding: 14,
                    background:
                      callResult.status === "queued"
                        ? "var(--ok-soft, #dcfce7)"
                        : callResult.status === "disabled"
                          ? "var(--caution-soft, #fef9c3)"
                          : "var(--critical-soft, #fee2e2)",
                    border:
                      callResult.status === "queued"
                        ? "1px solid var(--ok, #22c55e)"
                        : callResult.status === "disabled"
                          ? "1px solid var(--caution, #f59e0b)"
                          : "1px solid var(--critical, #ef4444)",
                  }}
                >
                  <strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {callResult.status}
                  </strong>
                  {callResult.provider_call_id && (
                    <span style={{ fontSize: 12, color: "var(--slate, #64748b)", marginLeft: 10 }}>
                      Provider ID: {callResult.provider_call_id}
                    </span>
                  )}
                  <p style={{ fontSize: 13, margin: "6px 0 0", color: "var(--ink, #0f172a)", lineHeight: 1.5 }}>
                    {callResult.message}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Agent status note */}
        <div
          style={{
            marginTop: 20,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--pill, #f1f5f9)",
            fontSize: 12,
            color: "var(--slate, #64748b)",
          }}
        >
          <strong>Voice agent:</strong>{" "}
          <span style={{ color: colorFor(agentStatus.mode), fontWeight: 600 }}>
            {agentStatus.mode === "live" ? "Live" : "Preview-only"}
          </span>
          {agentStatus.reason && <span> — {agentStatus.reason}</span>}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared sub-components
// ---------------------------------------------------------------------------

function SectionHead({ label }: { label: string }) {
  return (
    <h3
      style={{
        fontSize: 13,
        fontWeight: 700,
        textTransform: "uppercase",
        color: "var(--slate, #64748b)",
        letterSpacing: "0.06em",
        marginBottom: 12,
        marginTop: 0,
      }}
    >
      {label}
    </h3>
  );
}

function Divider() {
  return (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid var(--line, #e2e8f0)",
        margin: "4px 0 24px",
      }}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--slate, #64748b)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ReadOnly({
  label,
  value,
  mono,
  rows,
}: {
  label: string;
  value: string;
  mono?: boolean;
  rows?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--slate, #64748b)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </label>
      <textarea
        readOnly
        value={value}
        rows={rows ?? 3}
        style={{
          ...inputStyle,
          fontFamily: mono ? "var(--font-mono, monospace)" : undefined,
          fontSize: 12,
          background: "var(--surface-2, #f8fafc)",
          color: "var(--slate, #64748b)",
          resize: "vertical",
        }}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid var(--line, #e2e8f0)",
  borderRadius: 6,
  color: "var(--ink, #0f172a)",
  background: "var(--surface, #fff)",
  boxSizing: "border-box",
};

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    alignSelf: "flex-start",
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 6,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "var(--line, #e2e8f0)" : "var(--accent, #6366f1)",
    color: disabled ? "var(--slate, #64748b)" : "#fff",
    transition: "background 0.15s",
  };
}

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--critical, #ef4444)",
  margin: 0,
};
