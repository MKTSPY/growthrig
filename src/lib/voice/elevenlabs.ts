// GrowthRig — ElevenLabs voice-agent adapter
//
// Confirmed official endpoint (from elevenlabs.io/docs, 2025-09):
//   POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call
//   Headers: xi-api-key, Content-Type: application/json
//   Body: { agent_id, agent_phone_number_id, to_number, ... }
//   Response: { success, message, conversation_id, callSid }
//
// The ElevenLabs MCP server (connected) exposes ONLY TTS/sounds/voices/
// subscription tools — it has NO outbound-call tool. The REST endpoint
// above was confirmed directly from the official docs and is used via
// raw fetch only. No SDK dependency.
//
// Safety contract (enforced in this file, not delegated to callers):
//   1. consent_to_contact must be true            → "disabled" (no fetch)
//   2. channel must be "phone"                    → "disabled" (no fetch)
//   3. phone_number must be present + E.164-ish   → "disabled" (no fetch)
//   4. purpose and confirmation_text non-empty     → "disabled" (no fetch)
//   5. ELEVENLABS_API_KEY must be set              → "disabled" (no fetch)
//   6. ELEVENLABS_AGENT_ID / ELEVENLABS_CONVERSATIONAL_AI_AGENT_ID present
//                                                  → "disabled" (no fetch)
//   7. ELEVENLABS_PHONE_NUMBER_ID must be set      → "disabled" (no fetch)
//      (the Twilio phone-number ID imported into ElevenLabs; required by the
//       outbound-call API — sending an empty string would reach the network
//       and return an opaque provider error, so we gate it here instead)
//   Any non-2xx from provider                     → "failed" (sanitized msg)
//   Never fake a "queued" result.
//
// getVoiceAgentStatus returns configured:true / mode:"live" ONLY when ALL
// THREE of ELEVENLABS_API_KEY, agent ID, and ELEVENLABS_PHONE_NUMBER_ID are
// non-empty. Missing any one → configured:false / mode:"preview".

import type {
  VoiceAgentStatus,
  VoiceCallRequest,
  VoiceCallResult,
  VoiceContext,
} from "./types";

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const ELEVENLABS_OUTBOUND_ENDPOINT =
  "https://api.elevenlabs.io/v1/convai/twilio/outbound-call";

/** Regex for a plausible E.164 phone number: + followed by 7–15 digits. */
const E164_RE = /^\+[1-9]\d{6,14}$/;

/** Max characters kept from any free-text field before inserting into the prompt. */
const MAX_FIELD = 400;
const MAX_FACTS = 10;
const MAX_HISTORY = 8; // turns

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(s: string, max: number): string {
  const trimmed = s.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function readAgentId(): string | undefined {
  return (
    process.env.ELEVENLABS_AGENT_ID ||
    process.env.ELEVENLABS_CONVERSATIONAL_AI_AGENT_ID ||
    undefined
  );
}

function readApiKey(): string | undefined {
  return process.env.ELEVENLABS_API_KEY || undefined;
}

function readPhoneNumberId(): string | undefined {
  return process.env.ELEVENLABS_PHONE_NUMBER_ID || undefined;
}

// ---------------------------------------------------------------------------
// getVoiceAgentStatus
// ---------------------------------------------------------------------------

/**
 * Reads env vars at call time (never from a file) and returns the current
 * configuration state of the ElevenLabs voice agent.
 *
 * Returns configured:true / mode:"live" ONLY when ALL THREE are non-empty:
 *   - ELEVENLABS_API_KEY
 *   - ELEVENLABS_AGENT_ID (or ELEVENLABS_CONVERSATIONAL_AI_AGENT_ID)
 *   - ELEVENLABS_PHONE_NUMBER_ID  ← the Twilio phone-number ID imported into
 *                                    ElevenLabs; required by the outbound API
 *
 * Never prints or exposes the API key value.
 */
export function getVoiceAgentStatus(): VoiceAgentStatus {
  const apiKey = readApiKey();
  const agentId = readAgentId();
  const phoneNumberId = readPhoneNumberId();

  if (!apiKey && !agentId && !phoneNumberId) {
    return {
      configured: false,
      mode: "preview",
      reason:
        "ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, and ELEVENLABS_PHONE_NUMBER_ID are not set. " +
        "Voice features run in preview mode — call briefs are generated locally " +
        "but no outbound calls will be placed.",
    };
  }

  if (!apiKey) {
    return {
      configured: false,
      mode: "preview",
      reason:
        "ELEVENLABS_API_KEY is not set. " +
        "Set it (along with ELEVENLABS_AGENT_ID and ELEVENLABS_PHONE_NUMBER_ID) to enable live outbound calls.",
    };
  }

  if (!agentId) {
    return {
      configured: false,
      mode: "preview",
      reason:
        "ELEVENLABS_AGENT_ID (or ELEVENLABS_CONVERSATIONAL_AI_AGENT_ID) is not set. " +
        "Create a Conversational AI agent in the ElevenLabs dashboard and paste its ID here.",
    };
  }

  if (!phoneNumberId) {
    return {
      configured: false,
      mode: "preview",
      reason:
        "ELEVENLABS_PHONE_NUMBER_ID is not set. " +
        "This is the ID of a Twilio phone number imported into ElevenLabs (not the raw phone number itself). " +
        "Import a number in the ElevenLabs dashboard → Phone Numbers, then paste its ID here.",
    };
  }

  return {
    configured: true,
    agent_id: agentId,
    mode: "live",
  };
}

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

/**
 * Builds a context-grounded system prompt for the ElevenLabs voice agent.
 * Works with no API key — pure string construction.
 *
 * Rules enforced in the prompt:
 *  - Speak only from provided context/facts; never invent.
 *  - Never claim a message/call happened unless present in history.
 *  - Identify as an AI assistant for the company.
 *  - Obtain consent before continuing.
 *  - No pricing, legal, medical, or security guarantees.
 *  - No hype language.
 *  - Clear opening + hand-off rules.
 */
export function buildSystemPrompt(context: VoiceContext): string {
  const companyName = clamp(context.company_name, 80);
  const icp = clamp(context.icp, MAX_FIELD);
  const goal = clamp(context.goal, MAX_FIELD);
  const threadTitle = clamp(context.thread_title, MAX_FIELD);
  const threadUrl = clamp(context.thread_url, 200);
  const source = clamp(context.source, 60);
  const sentReply = clamp(context.sent_reply, MAX_FIELD);

  const factsBlock =
    context.facts.length > 0
      ? context.facts
          .slice(0, MAX_FACTS)
          .map((f, i) => `  ${i + 1}. ${clamp(f, 200)}`)
          .join("\n")
      : "  (none provided — do not state any specific facts)";

  const prohibitedBlock =
    context.prohibited_claims.length > 0
      ? context.prohibited_claims
          .slice(0, MAX_FACTS)
          .map((c, i) => `  ${i + 1}. ${clamp(c, 200)}`)
          .join("\n")
      : "  (none listed — apply general good-faith standards)";

  const historyBlock =
    context.conversation_history.length > 0
      ? context.conversation_history
          .slice(-MAX_HISTORY)
          .map((t) => `  [${t.role} @ ${t.at}] ${clamp(t.content, 300)}`)
          .join("\n")
      : "  (no prior history — this is a cold first contact)";

  return `You are a voice AI assistant calling on behalf of ${companyName}.

## Your role
- You represent ${companyName} in a brief, respectful follow-up call.
- You are an AI assistant, NOT a human. You MUST identify yourself as an AI at the start of the call and whenever asked.
- Your goal: ${goal}
- The person you are speaking with fits this profile: ${icp}

## Source context
- Original thread: "${threadTitle}" (${source})
- Thread URL: ${threadUrl}
- Reply that was sent to the thread: ${sentReply || "(none sent yet)"}

## Conversation history
${historyBlock}

## Facts you may state (ONLY these — no others)
${factsBlock}

## Claims you must NEVER make
${prohibitedBlock}

## Rules you must follow — no exceptions
1. IDENTIFY as an AI immediately: "Hi, I'm an AI assistant calling on behalf of ${companyName}."
2. GET CONSENT before continuing: "Is now a good time, and are you happy to speak with an AI?" If they say no or seem uncertain, end the call politely.
3. ONLY cite facts from the list above. If you do not know something, say so — do not invent figures, timelines, or outcomes.
4. NEVER claim a prior message or call happened unless it appears in the conversation history above.
5. NEVER make pricing, legal, medical, or security guarantees of any kind.
6. AVOID hype language: no "game-changing", "revolutionary", "best-in-class", or similar.
7. KEEP it brief: aim for under 3 minutes. Offer to follow up via email for anything complex.
8. HAND-OFF: if the contact asks to speak to a human, say "Absolutely — I'll flag this for a human team member to follow up with you directly" and end the call.
9. RECORDING notice: if required by the contact's jurisdiction, inform them the call may be recorded.
10. If you are unsure whether a statement is accurate, do not make it. Say "I don't have that information with me, but I can have someone follow up."

## Closing
Thank the contact for their time. Offer a specific next step (email, demo booking) only if grounded in the facts above.`.trim();
}

// ---------------------------------------------------------------------------
// prepareVoiceBrief
// ---------------------------------------------------------------------------

/**
 * Builds a ready-to-use voice brief: system prompt, suggested opening line,
 * and a plain-English context summary for display in the UI.
 *
 * This function requires NO API key — it is purely local string construction.
 * Call it before presenting the "Confirm & call" button so the operator can
 * review what the agent will say.
 */
export function prepareVoiceBrief(request: VoiceCallRequest): {
  system_prompt: string;
  opening_line: string;
  context_summary: string;
} {
  const system_prompt = buildSystemPrompt(request.context);

  const companyName = clamp(request.context.company_name, 80);
  const contactName = clamp(request.contact.display_name, 60);
  const threadTitle = clamp(request.context.thread_title, 120);
  const purpose = clamp(request.purpose, 200);

  const opening_line =
    `Hi, this is an AI assistant calling on behalf of ${companyName}. ` +
    `Am I speaking with ${contactName}? ` +
    `I'm following up on your interest in "${threadTitle}" — ` +
    `${purpose}. Is now a good time, and are you happy to speak with an AI?`;

  const historyCount = request.context.conversation_history.length;
  const factCount = request.context.facts.length;

  const context_summary =
    `Contact: ${contactName}` +
    (request.contact.phone_number ? ` · ${request.contact.phone_number}` : "") +
    `\nChannel: ${request.channel}` +
    `\nSource: ${request.context.source} — "${threadTitle}"` +
    `\nPurpose: ${purpose}` +
    `\nConversation history: ${historyCount} turn${historyCount !== 1 ? "s" : ""}` +
    `\nFacts loaded: ${factCount}` +
    `\nConsent on file: ${request.contact.consent_to_contact ? "yes" : "NO — call blocked"}`;

  return { system_prompt, opening_line, context_summary };
}

// ---------------------------------------------------------------------------
// startConfirmedCall
// ---------------------------------------------------------------------------

/**
 * Attempts to place an outbound call via ElevenLabs + Twilio.
 *
 * Pre-flight checks (all return "disabled", NO fetch on failure):
 *  1. contact.consent_to_contact must be true
 *  2. channel must be "phone"
 *  3. phone_number must be present and match E.164 pattern
 *  4. purpose must be non-empty
 *  5. confirmation_text must be non-empty
 *  6. ELEVENLABS_API_KEY must be set
 *  7. ELEVENLABS_AGENT_ID / ELEVENLABS_CONVERSATIONAL_AI_AGENT_ID must be set
 *  8. ELEVENLABS_PHONE_NUMBER_ID must be set (Twilio number ID imported into ElevenLabs)
 *
 * If all checks pass: POSTs to the confirmed official endpoint
 *   POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call
 * with a 10-second AbortController timeout.
 *
 * Never throws — any error returns { status: "failed", message: <sanitized> }.
 */
export async function startConfirmedCall(
  request: VoiceCallRequest,
): Promise<VoiceCallResult> {
  // ── Pre-flight 1: consent ─────────────────────────────────────────────────
  if (!request.contact.consent_to_contact) {
    return {
      status: "disabled",
      message:
        `No call placed. contact.consent_to_contact is false for "${request.contact.display_name}". ` +
        "Obtain explicit consent before creating this record.",
    };
  }

  // ── Pre-flight 2: channel ─────────────────────────────────────────────────
  if (request.channel !== "phone") {
    return {
      status: "disabled",
      message:
        `No call placed. Outbound voice calls require channel="phone"; ` +
        `received "${request.channel}". Web and Reddit channels use async messaging instead.`,
    };
  }

  // ── Pre-flight 3: phone number ────────────────────────────────────────────
  const phone = request.contact.phone_number?.trim() ?? "";
  if (!phone) {
    return {
      status: "disabled",
      message:
        "No call placed. contact.phone_number is missing. " +
        "Provide an E.164 phone number (e.g. +14155551234) to place a call.",
    };
  }
  if (!E164_RE.test(phone)) {
    return {
      status: "disabled",
      message:
        `No call placed. contact.phone_number "${phone}" does not match E.164 format ` +
        "(must start with + followed by 7–15 digits, e.g. +14155551234).",
    };
  }

  // ── Pre-flight 4: purpose ─────────────────────────────────────────────────
  if (!request.purpose.trim()) {
    return {
      status: "disabled",
      message:
        "No call placed. purpose is empty. " +
        "Provide a one-sentence description of why this call is being placed.",
    };
  }

  // ── Pre-flight 5: confirmation_text ───────────────────────────────────────
  if (!request.confirmation_text.trim()) {
    return {
      status: "disabled",
      message:
        "No call placed. confirmation_text is empty. " +
        "The operator must provide an explicit confirmation statement before a call is placed.",
    };
  }

  // ── Pre-flight 6 & 7: API key + agent ID ─────────────────────────────────
  const apiKey = readApiKey();
  const agentId = readAgentId();

  if (!apiKey || !agentId) {
    const missing = [
      !apiKey && "ELEVENLABS_API_KEY",
      !agentId && "ELEVENLABS_AGENT_ID (or ELEVENLABS_CONVERSATIONAL_AI_AGENT_ID)",
    ]
      .filter(Boolean)
      .join(" and ");

    return {
      status: "disabled",
      message:
        `No call placed. ${missing} ${!apiKey && !agentId ? "are" : "is"} not set. ` +
        "Voice features are running in preview mode. " +
        "Set ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, and ELEVENLABS_PHONE_NUMBER_ID to enable live outbound calls.",
    };
  }

  // ── Pre-flight 8: Twilio phone-number ID ──────────────────────────────────
  // ELEVENLABS_PHONE_NUMBER_ID is the ID of a Twilio number imported into
  // ElevenLabs — it is a required field in the outbound-call API body.
  // Sending an empty string reaches the network and returns an opaque 422;
  // we gate it here to give a clear, actionable message instead.
  const phoneNumberId = readPhoneNumberId();
  if (!phoneNumberId) {
    return {
      status: "disabled",
      message:
        "No call placed. ELEVENLABS_PHONE_NUMBER_ID is not set. " +
        "This is the ID of a Twilio phone number you have imported into ElevenLabs " +
        "(ElevenLabs dashboard → Phone Numbers → import → copy the ID). " +
        "It is required by the outbound-call API and is distinct from the raw phone number.",
    };
  }

  // ── All checks passed — attempt the provider call ────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const body = {
      agent_id: agentId,
      agent_phone_number_id: phoneNumberId,
      to_number: phone,
      conversation_initiation_client_data: {
        // Pass the grounded context so the agent starts with full thread context.
        metadata: {
          company_name: clamp(request.context.company_name, 80),
          purpose: clamp(request.purpose, 200),
          thread_url: clamp(request.context.thread_url, 200),
        },
        // Dynamic variables that can be interpolated into the agent's prompt
        // if the ElevenLabs agent template uses {{variable}} syntax.
        dynamic_variables: {
          contact_name: clamp(request.contact.display_name, 60),
          company_name: clamp(request.context.company_name, 80),
          thread_title: clamp(request.context.thread_title, 120),
          purpose: clamp(request.purpose, 200),
        },
      },
    };

    const res = await fetch(ELEVENLABS_OUTBOUND_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Sanitize: never echo back headers (which might contain auth context).
      // The response body from ElevenLabs is safe to surface (it's their error message).
      let errMsg = `ElevenLabs returned HTTP ${res.status}`;
      try {
        const errBody = await res.json() as { detail?: string; message?: string };
        const detail = errBody.detail ?? errBody.message ?? "";
        if (detail) errMsg += `: ${String(detail).slice(0, 200)}`;
      } catch {
        // Ignore parse errors — keep the status-code-only message.
      }
      return { status: "failed", message: errMsg };
    }

    const json = await res.json() as {
      success?: boolean;
      message?: string;
      conversation_id?: string;
      callSid?: string;
    };

    if (!json.success) {
      return {
        status: "failed",
        message:
          `ElevenLabs reported failure: ${json.message ?? "no message returned"}`,
      };
    }

    // Real queued call — use conversation_id as the stable provider reference.
    const provider_call_id = json.conversation_id ?? json.callSid ?? undefined;
    return {
      status: "queued",
      provider_call_id,
      message:
        `Call queued successfully. ` +
        (provider_call_id ? `Provider ID: ${provider_call_id}` : "No provider ID returned."),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Sanitize: strip anything that looks like a key or token.
    const safe = msg.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]");
    return { status: "failed", message: `Call attempt failed: ${safe}` };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Agent provisioning — thin re-export from create-agent.ts
// ---------------------------------------------------------------------------

export { createGrowthRigAgent, buildCreateAgentBody } from "./create-agent";
export type { CreateAgentResult } from "./create-agent";
