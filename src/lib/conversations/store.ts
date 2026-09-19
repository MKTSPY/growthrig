// GrowthRig — Conversation / consent in-memory store
//
// State lives on globalThis so Next.js hot-module reload between requests
// doesn't wipe it (same pattern as src/lib/threads/store.ts in this repo).
//
// Safety constraints enforced here:
//  - setContactConsent is the ONLY path to set consent_to_contact.
//  - Phone numbers are never interpolated into Error messages.
//  - No function makes any network call.

import type {
  BuildContextInput,
  ConversationContact,
  ConversationMessage,
  MessageChannel,
  MessageRole,
  PreparationStatus,
  VoiceContext,
  VoiceContextMessage,
  VoicePreparation,
} from "./types";

// ---------------------------------------------------------------------------
// Internal ID helpers
// ---------------------------------------------------------------------------

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// HTML-entity decoder (for Reddit / HN content arriving as HTML entities)
// No DOM dependency — pure string transforms.
// ---------------------------------------------------------------------------

// Named HTML entities commonly found in Reddit / HN content.
// Ordered so &amp; is decoded LAST (prevents double-decoding).
const NAMED_ENTITIES: [RegExp, string][] = [
  [/&nbsp;/g, " "],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&quot;/g, '"'],
  [/&#39;|&apos;/g, "'"],
  [/&mdash;/g, "—"],
  [/&ndash;/g, "–"],
  [/&lsquo;/g, "\u2018"],
  [/&rsquo;/g, "\u2019"],
  [/&ldquo;/g, "\u201C"],
  [/&rdquo;/g, "\u201D"],
  [/&hellip;/g, "…"],
  [/&rarr;/g, "→"],
  [/&larr;/g, "←"],
  [/&amp;/g, "&"], // must be last
];

function decodeHtmlEntities(text: string): string {
  let s = text;
  // Numeric character references first (both decimal and hex).
  s = s.replace(/&#(\d+);/g, (_m, dec: string) => String.fromCharCode(Number(dec)));
  s = s.replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  // Named entities.
  for (const [pattern, replacement] of NAMED_ENTITIES) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Store shape + globalThis singleton
// ---------------------------------------------------------------------------

interface ConversationsStoreShape {
  contacts: Map<string, ConversationContact>;
  messages: Map<string, ConversationMessage>; // keyed by message.id
  preparations: Map<string, VoicePreparation>;
}

// Using a unique key to avoid collisions with other globalThis state.
const STORE_KEY = "__growthrigConversations";

const g = globalThis as unknown as {
  [STORE_KEY]?: ConversationsStoreShape;
};

function getStore(): ConversationsStoreShape {
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      contacts: new Map(),
      messages: new Map(),
      preparations: new Map(),
    };
  }
  return g[STORE_KEY]!;
}

// ---------------------------------------------------------------------------
// Contact validation helpers
// ---------------------------------------------------------------------------

function validateContactInput(input: {
  display_name: string;
  phone_number?: string;
  reddit_handle?: string;
}): void {
  const name = input.display_name.trim();
  if (!name) {
    throw new Error("display_name is required and must not be blank.");
  }
  const hasPhone = typeof input.phone_number === "string" && input.phone_number.trim().length > 0;
  const hasReddit = typeof input.reddit_handle === "string" && input.reddit_handle.trim().length > 0;
  if (!hasPhone && !hasReddit) {
    // Phone number is NOT included in the error message per safety policy.
    throw new Error(
      "A contact must have at least one reachability field: phone_number or reddit_handle.",
    );
  }
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

/** Return all contacts, sorted by created_at ascending. */
export function listContacts(): ConversationContact[] {
  return [...getStore().contacts.values()].sort(
    (a, b) => a.created_at.localeCompare(b.created_at),
  );
}

export interface SaveContactInput {
  /** Omit to create; provide to update an existing contact. */
  id?: string;
  display_name: string;
  phone_number?: string;
  reddit_handle?: string;
  /** Consent must always be set explicitly via setContactConsent(). Ignored here. */
  consent_to_contact?: never;
}

/**
 * Create or update a contact.
 * - display_name is required and trimmed.
 * - At least one of phone_number or reddit_handle must be provided.
 * - Consent is never set here; use setContactConsent().
 * - On update the consent_to_contact value is preserved unchanged.
 */
export function saveContact(input: SaveContactInput): ConversationContact {
  validateContactInput(input);

  const s = getStore();
  const trimmedName = input.display_name.trim();
  const trimmedPhone =
    typeof input.phone_number === "string" && input.phone_number.trim()
      ? input.phone_number.trim()
      : undefined;
  const trimmedReddit =
    typeof input.reddit_handle === "string" && input.reddit_handle.trim()
      ? input.reddit_handle.trim()
      : undefined;

  if (input.id) {
    // Update path
    const existing = s.contacts.get(input.id);
    if (!existing) {
      throw new Error(`Contact not found: ${input.id}`);
    }
    const updated: ConversationContact = {
      ...existing,
      display_name: trimmedName,
      phone_number: trimmedPhone,
      reddit_handle: trimmedReddit,
      updated_at: now(),
    };
    s.contacts.set(input.id, updated);
    return updated;
  }

  // Create path
  const contact: ConversationContact = {
    id: newId("c"),
    display_name: trimmedName,
    phone_number: trimmedPhone,
    reddit_handle: trimmedReddit,
    consent_to_contact: false, // always starts false
    created_at: now(),
    updated_at: now(),
  };
  s.contacts.set(contact.id, contact);
  return contact;
}

/**
 * Explicitly set consent for a contact. This is the ONLY path to set
 * consent_to_contact — saveContact deliberately excludes it.
 */
export function setContactConsent(id: string, consented: boolean): ConversationContact {
  const s = getStore();
  const existing = s.contacts.get(id);
  if (!existing) {
    throw new Error(`Contact not found: ${id}`);
  }
  const updated: ConversationContact = {
    ...existing,
    consent_to_contact: consented,
    updated_at: now(),
  };
  s.contacts.set(id, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Return all messages for a contact, sorted chronologically (oldest first). */
export function listMessages(contactId: string): ConversationMessage[] {
  return [...getStore().messages.values()]
    .filter((m) => m.contact_id === contactId)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export interface AddMessageInput {
  contact_id: string;
  thread_id?: string;
  role: MessageRole;
  content: string;
  channel: MessageChannel;
  /** ISO 8601; defaults to now if omitted. */
  at?: string;
}

/** Add a message to a contact's conversation history. */
export function addMessage(input: AddMessageInput): ConversationMessage {
  const s = getStore();
  if (!s.contacts.has(input.contact_id)) {
    throw new Error(`Contact not found: ${input.contact_id}`);
  }
  const message: ConversationMessage = {
    id: newId("m"),
    contact_id: input.contact_id,
    thread_id: input.thread_id,
    role: input.role,
    content: input.content,
    channel: input.channel,
    at: input.at ?? now(),
  };
  s.messages.set(message.id, message);
  return message;
}

// ---------------------------------------------------------------------------
// Preparations
// ---------------------------------------------------------------------------

export interface CreatePreparationInput {
  contact_id: string;
  thread_id?: string;
  purpose: string;
  confirmation_text: string;
}

/**
 * Create a new VoicePreparation in "draft" status.
 * Returns undefined if the contact_id is not found.
 */
export function createPreparation(
  input: CreatePreparationInput,
): VoicePreparation | undefined {
  const s = getStore();
  if (!s.contacts.has(input.contact_id)) {
    return undefined;
  }
  const prep: VoicePreparation = {
    id: newId("p"),
    contact_id: input.contact_id,
    thread_id: input.thread_id,
    purpose: input.purpose,
    status: "draft",
    confirmation_text: input.confirmation_text,
    created_at: now(),
    updated_at: now(),
  };
  s.preparations.set(prep.id, prep);
  return prep;
}

/** Retrieve a single preparation by id, or undefined if not found. */
export function getPreparation(id: string): VoicePreparation | undefined {
  return getStore().preparations.get(id);
}

export type PreparationPatch = Partial<
  Pick<
    VoicePreparation,
    | "purpose"
    | "status"
    | "confirmation_text"
    | "provider_call_id"
    | "result_message"
  >
>;

/** Apply a partial update to a preparation. Returns the updated record, or undefined if not found. */
export function updatePreparation(
  id: string,
  patch: PreparationPatch,
): VoicePreparation | undefined {
  const s = getStore();
  const existing = s.preparations.get(id);
  if (!existing) return undefined;
  const updated: VoicePreparation = {
    ...existing,
    ...patch,
    id: existing.id, // id is immutable
    contact_id: existing.contact_id, // contact_id is immutable
    created_at: existing.created_at, // created_at is immutable
    updated_at: now(),
  };
  s.preparations.set(id, updated);
  return updated;
}

/** Return all preparations, sorted by created_at ascending. */
export function listPreparations(): VoicePreparation[] {
  return [...getStore().preparations.values()].sort(
    (a, b) => a.created_at.localeCompare(b.created_at),
  );
}

/**
 * Record the outcome of a call attempt. Sets status and writes result_message
 * and (optionally) provider_call_id. Returns the updated preparation or
 * undefined if not found.
 */
export function recordCallOutcome(
  preparationId: string,
  outcome: Extract<PreparationStatus, "complete" | "failed">,
  message: string,
  providerCallId?: string,
): VoicePreparation | undefined {
  return updatePreparation(preparationId, {
    status: outcome,
    result_message: message,
    ...(providerCallId !== undefined ? { provider_call_id: providerCallId } : {}),
  });
}

// ---------------------------------------------------------------------------
// buildConversationContext
// ---------------------------------------------------------------------------

const MAX_HISTORY = 50;

/**
 * Assemble a VoiceContext from a preparation + live conversation history.
 *
 * - Returns undefined if the preparation is not found.
 * - HTML entities in message content are decoded so Reddit / HN content
 *   reads cleanly (e.g. &amp; → &, &#39; → ').
 * - conversation_history is chronological, capped at the last MAX_HISTORY messages.
 */
export function buildConversationContext(
  input: BuildContextInput,
): VoiceContext | undefined {
  const s = getStore();
  const prep = s.preparations.get(input.preparation_id);
  if (!prep) return undefined;

  // Gather messages for this contact, chronological, capped.
  const allMessages = listMessages(prep.contact_id);
  const history: VoiceContextMessage[] = allMessages
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role,
      content: decodeHtmlEntities(m.content),
      channel: m.channel,
      at: m.at,
    }));

  return {
    company_name: input.company_name,
    icp: input.icp,
    goal: input.goal,
    thread_title: input.thread?.title ?? "",
    thread_url: input.thread?.url ?? "",
    source: input.thread?.source ?? "",
    sent_reply: input.sent_reply ?? "",
    conversation_history: history,
    facts: input.facts ?? [],
    prohibited_claims: input.prohibited_claims ?? [],
  };
}
