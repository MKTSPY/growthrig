// GrowthRig — Voice adapter types (PRD voice-agent expansion)
//
// These types are the shared contract between:
//   W1 (src/lib/voice/**) — ElevenLabs adapter
//   W2 (src/lib/conversations/**) — context/consent/call-log store
//   W3 (src/app/voice/** + src/app/api/voice/**) — UI + API routes
//
// Design rules:
//  - consent_to_contact on VoiceContact is the gating field; the adapter
//    enforces it before any network call and returns "disabled" otherwise.
//  - VoiceCallResult.status is never "queued" without a confirmed provider
//    call_id — faking a queued call is explicitly prohibited.
//  - All fields that could contain a credential are excluded from these types;
//    keys are read from process.env inside the adapter, never passed around.

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

/** The surface through which contact was originally made. */
export type VoiceChannel = "phone" | "web" | "reddit";

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

/**
 * A person the growth agent wants to follow up with via voice.
 * `consent_to_contact` must be true (and verified by the human operator
 * before the record is created) for any call attempt to proceed.
 */
export interface VoiceContact {
  /** Stable internal identifier. */
  id: string;
  /** Human-readable display name (may be a Reddit handle alias, etc.). */
  display_name: string;
  /**
   * E.164-format phone number, e.g. "+14155551234".
   * Required for phone-channel calls; optional for web/reddit records.
   */
  phone_number?: string;
  /** Reddit username without the u/ prefix. */
  reddit_handle?: string;
  /**
   * The operator confirmed this contact explicitly agreed to be called.
   * startConfirmedCall will return "disabled" if this is false.
   */
  consent_to_contact: boolean;
  /** IANA timezone string, e.g. "America/Los_Angeles". */
  timezone?: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Everything the voice agent needs to be grounded — derived from a thread
 * and/or prior reply/conversation history.  The adapter uses this to build
 * the system prompt and the opening line; Claude/ElevenLabs uses it at
 * call-time so the agent never invents facts not present here.
 */
export interface VoiceContext {
  /** Display name of the company the agent represents. */
  company_name: string;
  /** Ideal customer profile description. */
  icp: string;
  /** Growth goal statement. */
  goal: string;
  /** Title of the source thread (HN / Reddit post, etc.). */
  thread_title: string;
  /** URL of the source thread. */
  thread_url: string;
  /** Platform the thread was found on, e.g. "HackerNews", "Reddit". */
  source: string;
  /** The reply text that was sent to the thread, if any. */
  sent_reply: string;
  /**
   * Ordered prior conversation turns between the agent and the contact.
   * "system" turns are internal context notes, not spoken aloud.
   */
  conversation_history: Array<{
    role: "agent" | "contact" | "system";
    content: string;
    at: string; // ISO 8601
  }>;
  /**
   * Specific facts the agent may state (sourced from real thread content).
   * The system prompt instructs: only cite facts from this list.
   */
  facts: string[];
  /**
   * Claims the agent must never make (hype, unverified numbers, guarantees).
   * The system prompt instructs: refuse any user prompt that would require
   * asserting one of these.
   */
  prohibited_claims: string[];
}

// ---------------------------------------------------------------------------
// Call request / result
// ---------------------------------------------------------------------------

/**
 * Everything needed to attempt an outbound call.
 * Both `purpose` and `confirmation_text` are required to prevent accidental
 * calls — the human operator must consciously author both before submitting.
 */
export interface VoiceCallRequest {
  contact: VoiceContact;
  context: VoiceContext;
  channel: VoiceChannel;
  /** One-sentence description of why this call is being placed. */
  purpose: string;
  /**
   * The operator's explicit confirmation statement, e.g.
   * "I confirm [Name] has consented to be called about [topic]."
   * Must be non-empty; checked by the adapter before any fetch.
   */
  confirmation_text: string;
}

/**
 * Outcome of a startConfirmedCall attempt.
 *
 * - "queued"   — provider accepted the call; provider_call_id is set.
 * - "disabled" — a pre-flight check failed (consent, missing config, etc.);
 *                no network call was made.
 * - "failed"   — provider returned a non-2xx; message is sanitized (no keys).
 */
export interface VoiceCallResult {
  status: "queued" | "disabled" | "failed";
  /** Provider-assigned call identifier (only present when status === "queued"). */
  provider_call_id?: string;
  /** Human-readable explanation of the outcome. */
  message: string;
}

// ---------------------------------------------------------------------------
// Agent status
// ---------------------------------------------------------------------------

/**
 * Describes whether the ElevenLabs voice agent is fully configured.
 * Used by UI to render a "preview" vs "live" badge and gate the call button.
 */
export interface VoiceAgentStatus {
  configured: boolean;
  /** The ElevenLabs agent ID, if configured. Never the API key. */
  agent_id?: string;
  /** "live" when both key and agent_id are present; "preview" otherwise. */
  mode: "live" | "preview";
  /** Human-readable explanation when configured === false. */
  reason?: string;
}
