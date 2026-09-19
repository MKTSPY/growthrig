import { SupabaseAdmin, getSupabaseAdmin } from "./client";
import { encryptPhone, decryptPhone } from "./encryption";
import { hashConfirmationNonce, createRandomNonce } from "./confirmation";
import {
  Contact,
  ThreadContext,
  ConversationMessage,
  VoicePreparation,
  CallAttempt,
  VoiceEvent,
} from "./types";

const SUPABASE_ADMIN = getSupabaseAdmin();

export function isVoicePersistenceAvailable(): boolean {
  return !!SUPABASE_ADMIN;
}

// Generic helpers
async function tableInsert<T>(table: string, data: any): Promise<T> {
  if (!SUPABASE_ADMIN) throw new Error("Supabase client missing");
  const res = await SUPABASE_ADMIN.postgrest(table, {
    method: "POST",
    body: data,
  });
  if (!Array.isArray(res) || res.length === 0) throw new Error("Insert failed");
  return res[0] as T;
}

async function tableSelect<T>(table: string, filter: Record<string, any> = {}): Promise<T[]> {
  if (!SUPABASE_ADMIN) throw new Error("Supabase client missing");
  const query = Object.entries(filter)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(String(v))}`)
    .join("&");
  const path = query ? `${table}?${query}` : table;
  const res = await SUPABASE_ADMIN.postgrest(path, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return res as T[];
}

// CONTACTS
export async function createContact(contact: Omit<Contact, "id" | "created_at" | "updated_at">): Promise<Contact> {
  const payload: any = { ...contact };
  if (payload.phone_number_encrypted) {
    const enc = encryptPhone(payload.phone_number_encrypted);
    if (!enc) throw new Error("PII encryption key missing – cannot store phone");
    payload.phone_number_encrypted = enc;
  }
  return await tableInsert<Contact>("contacts", payload);
}

export async function getContactById(id: string): Promise<Contact | null> {
  const res = await tableSelect<Contact>("contacts", { id });
  if (res.length === 0) return null;
  const c = res[0] as Contact;
  if (c.phone_number_encrypted) {
    const plain = decryptPhone(c.phone_number_encrypted);
    if (plain) c.phone_number_encrypted = plain;
  }
  return c;
}

export async function updateContact(id: string, partial: Partial<Contact>): Promise<Contact> {
  if (!SUPABASE_ADMIN) throw new Error("Supabase client missing");
  const body: any = { ...partial };
  if (partial.phone_number_encrypted) {
    const enc = encryptPhone(partial.phone_number_encrypted);
    if (!enc) throw new Error("PII encryption key missing – cannot store phone");
    body.phone_number_encrypted = enc;
  }
  const res = await SUPABASE_ADMIN.postgrest(`contacts?id=eq.${id}`, {
    method: "PATCH",
    body,
  });
  if (!Array.isArray(res) || res.length === 0) throw new Error("Update failed");
  const upd = res[0] as Contact;
  if (upd.phone_number_encrypted) {
    const plain = decryptPhone(upd.phone_number_encrypted);
    if (plain) upd.phone_number_encrypted = plain;
  }
  return upd;
}

export async function grantConsent(id: string, source: string, evidence: string, capturedBy: string): Promise<void> {
  await updateContact(id, {
    consent_status: "granted" as any,
    consent_source: source,
    consent_evidence: evidence,
    consent_captured_at: new Date().toISOString(),
    consent_captured_by: capturedBy,
  });
}

export async function revokeConsent(id: string, revokedBy: string): Promise<void> {
  await updateContact(id, {
    consent_status: "revoked" as any,
    consent_revoked_at: new Date().toISOString(),
    consent_revoked_by: revokedBy,
  });
}

// THREAD_CONTEXTS
export async function createThreadContext(ctx: Omit<ThreadContext, "id" | "created_at" | "updated_at">): Promise<ThreadContext> {
  return await tableInsert<ThreadContext>("thread_contexts", ctx);
}

export async function getThreadContextById(id: string): Promise<ThreadContext | null> {
  const res = await tableSelect<ThreadContext>("thread_contexts", { id });
  if (res.length === 0) return null;
  return res[0] as ThreadContext;
}

// CONVERSATION_MESSAGES
export async function addConversationMessage(msg: Omit<ConversationMessage, "id" | "created_at" | "updated_at">): Promise<ConversationMessage> {
  return await tableInsert<ConversationMessage>("conversation_messages", msg);
}

export async function listConversationMessages(filter: Partial<ConversationMessage>): Promise<ConversationMessage[]> {
  return await tableSelect<ConversationMessage>("conversation_messages", filter as Record<string, any>);
}

// VOICE_PREPARATIONS
export async function createVoicePreparation(prep: Omit<VoicePreparation, "id" | "created_at" | "updated_at">): Promise<VoicePreparation> {
  return await tableInsert<VoicePreparation>("voice_preparations", prep);
}

export async function getVoicePreparationById(id: string): Promise<VoicePreparation | null> {
  const res = await tableSelect<VoicePreparation>("voice_preparations", { id });
  if (res.length === 0) return null;
  return res[0] as VoicePreparation;
}

export async function updateVoicePreparation(id: string, partial: Partial<VoicePreparation>): Promise<VoicePreparation> {
  if (!SUPABASE_ADMIN) throw new Error("Supabase client missing");
  const body: any = { ...partial };
  const res = await SUPABASE_ADMIN.postgrest(`voice_preparations?id=eq.${id}`, {
    method: "PATCH",
    body,
  });
  if (!Array.isArray(res) || res.length === 0) throw new Error("Update failed");
  return res[0] as VoicePreparation;
}

// CALL_ATTEMPTS
export async function createCallAttempt(attempt: Omit<CallAttempt, "id" | "created_at" | "updated_at">): Promise<CallAttempt> {
  return await tableInsert<CallAttempt>("call_attempts", attempt);
}

export async function markAttemptResult(id: string, status: string, response: any, error?: string): Promise<void> {
  if (!SUPABASE_ADMIN) throw new Error("Supabase client missing");
  const body: any = {
    provider_status: status,
    sanitized_response: response,
    failure_reason: error,
  };
  await SUPABASE_ADMIN.postgrest(`call_attempts?id=eq.${id}`, {
    method: "PATCH",
    body,
  });
}

// VOICE_EVENTS
export async function appendVoiceEvent(event: Omit<VoiceEvent, "id" | "created_at" | "updated_at">): Promise<VoiceEvent> {
  return await tableInsert<VoiceEvent>("voice_events", event);
}

// CONFIRMATION NONCE
export async function createConfirmationNonce(): Promise<{ nonce: string; hash: string }> {
  const nonce = await createRandomNonce();
  const hash = hashConfirmationNonce(nonce);
  return { nonce, hash };
}

export async function consumeConfirmationHash(prepId: string, hash: string): Promise<boolean> {
  if (!SUPABASE_ADMIN) return false;
  // atomic update
  const res = await SUPABASE_ADMIN.postgrest(`voice_preparations?id=eq.${prepId}&confirmation_nonce_hash=eq.${hash}`, {
    method: "PATCH",
    body: {
      confirmation_consumed_at: new Date().toISOString(),
    },
  });
  return !!res && res.length > 0;
}

// RATES
export async function checkVoiceDailyLimit(workspaceId: string, limit?: number): Promise<boolean> {
  if (!SUPABASE_ADMIN) return false;
  const effectiveLimit = limit ?? parseInt(process.env.VOICE_DAILY_CALL_LIMIT ?? "5", 10);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const res = await SUPABASE_ADMIN.postgrest(`call_attempts?workspace_id=eq.${encodeURIComponent(workspaceId)}&created_at=gte.${today.toISOString()}&created_at=lt.${tomorrow.toISOString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const count = Array.isArray(res) ? res.length : 0;
  return count < effectiveLimit;
}

// AGGREGATE PREP
export async function getPreparationAggregate(id: string): Promise<VoicePreparation | null> {
  return await getVoicePreparationById(id);
}
