/**
 * GrowthRig — ElevenLabs Agent Provisioning
 *
 * createGrowthRigAgent({ apiKey }) → Promise<CreateAgentResult>
 *
 * Creates exactly ONE generic, context-grounded "GrowthRig Voice" agent via:
 *   POST https://api.elevenlabs.io/v1/convai/agents/create
 *   Headers: xi-api-key: <apiKey>  Content-Type: application/json
 *
 * The agent is context-agnostic by design. Per-call context is injected at
 * call-time through ElevenLabs dynamic_variables so a single agent handles
 * every outbound call without being re-provisioned.
 *
 * Dynamic variables available in the agent's prompt (all string-typed):
 *   {{contact_name}}           – Display name of the person being called
 *   {{company_name}}           – Operator company name (e.g. "GrowthRig")
 *   {{thread_title}}           – Title of the Reddit/web thread that prompted contact
 *   {{thread_url}}             – Source URL for traceability
 *   {{source}}                 – Short platform label ("Reddit", "Web", etc.)
 *   {{sent_reply}}             – The reply the operator already sent in that thread
 *   {{conversation_history}}   – Serialised prior turns (role + timestamp + content)
 *   {{approved_facts}}         – Bullet list of facts the agent MAY cite
 *   {{prohibited_claims}}      – Claims the agent must NEVER make
 *   {{purpose}}                – One-line call purpose ("follow up on interest in X")
 *
 * Response on success (HTTP 200 or 201):
 *   { status: "created", agent_id: string, message: string }
 *
 * Response on missing key:
 *   { status: "disabled", message: string }
 *
 * Response on any provider / network error:
 *   { status: "failed", message: string }   (API key value redacted from message)
 *
 * Side-effects: creates ONE agent in the connected ElevenLabs workspace.
 * Safe to call at most once; the caller is responsible for persisting agent_id.
 */

const CREATE_AGENT_ENDPOINT =
  "https://api.elevenlabs.io/v1/convai/agents/create";

/** Milliseconds before we abort the create-agent request. */
const TIMEOUT_MS = 10_000;

export type CreateAgentResult =
  | { status: "created"; agent_id: string; message: string }
  | { status: "disabled"; message: string }
  | { status: "failed"; message: string };

// ---------------------------------------------------------------------------
// System prompt — context-agnostic, all per-call context via dynamic vars
// ---------------------------------------------------------------------------

/**
 * The grounded system prompt embedded in the agent at creation time.
 * Runtime context is injected via dynamic_variables; the prompt contains
 * {{placeholder}} tokens that ElevenLabs substitutes per-conversation.
 */
const GROUNDED_SYSTEM_PROMPT = `\
You are a voice AI assistant calling on behalf of {{company_name}}.

IDENTITY
- You are an AI, not a human. Identify yourself as an AI assistant on the very first turn and whenever asked.
- Never impersonate a specific named person. Never claim to be human.

CONSENT — MANDATORY FIRST STEP
- Before saying anything else beyond your opening greeting, ask:
    "Are you happy to continue speaking with an AI assistant?"
- If the person declines or sounds uncertain: thank them, apologise for the interruption, and end the call politely. Do not continue.
- Only proceed with the conversation after receiving an explicit affirmative.

CALL CONTEXT
- You are calling {{contact_name}}.
- Call purpose: {{purpose}}
- The conversation was prompted by a thread titled "{{thread_title}}" ({{source}}).
- Thread URL for your reference: {{thread_url}}
- The written reply already sent to them: {{sent_reply}}

PRIOR CONVERSATION HISTORY (ordered oldest → newest)
{{conversation_history}}
- Do NOT claim any prior interaction that does not appear above.
- If no history is listed, this is a cold first contact.

APPROVED FACTS YOU MAY CITE
{{approved_facts}}
- Speak only from the facts listed above and what the person tells you in this call.
- If you do not know something, say so clearly and offer to follow up in writing.
- Never invent statistics, pricing, timelines, rankings, or product capabilities.

PROHIBITED CLAIMS — NEVER SAY THESE
{{prohibited_claims}}

HARD RULES
1. No pricing commitments, legal guarantees, security certifications, or medical claims.
2. No superlatives like "best", "fastest", "#1", "guaranteed", or "risk-free".
3. If asked about anything outside the approved facts, say: "I don't have that information — I'll make sure someone follows up with you in writing."
4. If the person becomes angry, upset, or requests a human: apologise, offer to connect them with a human team member, and end the call gracefully.
5. Keep responses brief and conversational — this is a phone call, not an email.
6. Never read out the thread URL aloud unless explicitly asked.
`;

// ---------------------------------------------------------------------------
// Request body factory
// ---------------------------------------------------------------------------

/**
 * Returns the minimal JSON body for POST /v1/convai/agents/create.
 * Exported for unit-testing without a network call.
 *
 * @example
 * const body = buildCreateAgentBody();
 * // body.name === "GrowthRig Voice — Context-Grounded"
 * // body.conversation_config.agent.prompt.prompt contains {{contact_name}} etc.
 */
export function buildCreateAgentBody(): Record<string, unknown> {
  return {
    name: "GrowthRig Voice — Context-Grounded",
    tags: ["growthrig", "human-in-the-loop", "preview-safe"],
    conversation_config: {
      agent: {
        first_message:
          "Hi, this is an AI assistant calling on behalf of {{company_name}}. " +
          "Am I speaking with {{contact_name}}? " +
          "I'm following up on your interest in {{thread_title}} — {{purpose}}. " +
          "Is now a good time, and are you happy to speak with an AI?",
        language: "en",
        prompt: {
          prompt: GROUNDED_SYSTEM_PROMPT,
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// createGrowthRigAgent
// ---------------------------------------------------------------------------

/**
 * Provisions a single GrowthRig Voice agent in the ElevenLabs workspace.
 *
 * @param opts.apiKey  – ElevenLabs API key (xi-api-key header).
 *                       If omitted / falsy, returns status:"disabled".
 *
 * @returns CreateAgentResult
 *   "created"  – Agent was created; agent_id contains the stable ElevenLabs ID.
 *   "disabled" – apiKey was missing; no network call made.
 *   "failed"   – Provider returned non-2xx, network error, or unexpected shape.
 *                message is sanitised (no raw key values).
 *
 * @example
 * const result = await createGrowthRigAgent({ apiKey: process.env.ELEVENLABS_API_KEY });
 * if (result.status === "created") {
 *   console.log("Set ELEVENLABS_AGENT_ID =", result.agent_id);
 * }
 */
export async function createGrowthRigAgent(opts: {
  apiKey: string | undefined;
}): Promise<CreateAgentResult> {
  const { apiKey } = opts;

  // Gate 1: key must be present
  if (!apiKey || apiKey.trim() === "") {
    return {
      status: "disabled",
      message:
        "ELEVENLABS_API_KEY is not set. " +
        "Provide the key to provision the GrowthRig Voice agent. " +
        "No network call was made.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = buildCreateAgentBody();

    const res = await fetch(CREATE_AGENT_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    // Non-2xx → failed (sanitise message so key never leaks)
    if (!res.ok) {
      let detail = "";
      try {
        const errJson = (await res.json()) as { detail?: unknown; message?: unknown };
        detail = String(errJson.detail ?? errJson.message ?? "").slice(0, 300);
      } catch {
        try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      }
      const safeDetail = detail.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]");
      return {
        status: "failed",
        message: `ElevenLabs returned HTTP ${res.status}${safeDetail ? `: ${safeDetail}` : ""}`,
      };
    }

    // Parse success response — expect { agent_id: string }
    const json = (await res.json()) as { agent_id?: string };
    const agentId = json.agent_id;

    if (!agentId || typeof agentId !== "string" || agentId.trim() === "") {
      return {
        status: "failed",
        message:
          "ElevenLabs returned HTTP 2xx but the response did not contain a valid agent_id. " +
          "Check the ElevenLabs dashboard for the created agent.",
      };
    }

    return {
      status: "created",
      agent_id: agentId.trim(),
      message:
        `GrowthRig Voice agent created successfully. ` +
        `Set ELEVENLABS_AGENT_ID=${agentId.trim()} in your deployment environment.`,
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // Abort = timeout
    if (raw.includes("abort") || raw.toLowerCase().includes("aborted")) {
      return {
        status: "failed",
        message: `Agent creation timed out after ${TIMEOUT_MS / 1000}s. The ElevenLabs API did not respond in time.`,
      };
    }
    const safe = raw.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]");
    return { status: "failed", message: `Agent creation error: ${safe}` };
  } finally {
    clearTimeout(timer);
  }
}
