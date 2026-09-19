// GrowthRig — Conversation / consent data layer types
//
// Design rules:
//  - No function in this module may perform any external or network call.
//  - Phone numbers are data: never include them in thrown Error messages.
//  - Consent is always explicit: nothing here auto-consents a contact.
//  - State is held on globalThis so Next.js hot-reload doesn't lose data.

// ---------------------------------------------------------------------------
// ConversationContact
// ---------------------------------------------------------------------------

/** A human discovered via a thread who may (or may not) have consented. */
export interface ConversationContact {
  id: string;
  display_name: string;
  /** E.164 or any phone string — treated as opaque data, never logged in errors. */
  phone_number?: string;
  reddit_handle?: string;
  /** Explicit opt-in gate. Never set to true automatically. */
  consent_to_contact: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// ConversationMessage
// ---------------------------------------------------------------------------

export type MessageRole = "agent" | "contact" | "system";
export type MessageChannel = "reddit" | "phone" | "web";

/** One turn in a conversation thread, keyed to a contact. */
export interface ConversationMessage {
  id: string;
  contact_id: string;
  /** Optional: the thread this message is associated with. */
  thread_id?: string;
  role: MessageRole;
  content: string;
  channel: MessageChannel;
  at: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// VoicePreparation
// ---------------------------------------------------------------------------

export type PreparationStatus =
  | "draft"
  | "ready"
  | "calling"
  | "complete"
  | "failed";

/**
 * A consent-gated call brief. Created as "draft"; only the human moves it
 * to "ready" after reviewing the confirmation_text and confirming consent.
 * The voice layer (W1/W3) reads this and the associated conversation context
 * before initiating any outreach.
 */
export interface VoicePreparation {
  id: string;
  contact_id: string;
  /** Optional: link back to the source thread. */
  thread_id?: string;
  purpose: string;
  status: PreparationStatus;
  /** Plain-English summary the human reads and confirms before any call. */
  confirmation_text: string;
  created_at: string;
  updated_at: string;
  /** Populated by the voice provider after a call is initiated. */
  provider_call_id?: string;
  /** Final outcome note written after the call completes or fails. */
  result_message?: string;
}

// ---------------------------------------------------------------------------
// VoiceContext — the object returned by buildConversationContext()
//
// Structurally identical to W1's VoiceContext so the voice layer can consume
// it without an adapter step.
// ---------------------------------------------------------------------------

export interface VoiceContextMessage {
  role: MessageRole;
  content: string;
  channel: MessageChannel;
  at: string;
}

export interface VoiceContext {
  company_name: string;
  icp: string;
  goal: string;
  thread_title: string;
  thread_url: string;
  source: string;
  sent_reply: string;
  /** Chronological, last 50 messages max. */
  conversation_history: VoiceContextMessage[];
  facts: string[];
  prohibited_claims: string[];
}

// ---------------------------------------------------------------------------
// buildConversationContext input
// ---------------------------------------------------------------------------

export interface BuildContextInput {
  preparation_id: string;
  company_name: string;
  icp: string;
  goal: string;
  thread?: {
    title: string;
    url: string;
    source: string;
  };
  sent_reply?: string;
  facts?: string[];
  prohibited_claims?: string[];
}
