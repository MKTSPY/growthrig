// GrowthRig — LLM seam (Claude via raw fetch, no SDK dependency)
//
// This is the SINGLE generate entrypoint the whole app funnels through.
//
// Two paths:
//  1. KEYLESS (default): if ANTHROPIC_API_KEY is not set, return opts.fallback
//     immediately and log a one-time warning. The run still completes with
//     deterministic, template-driven content.
//  2. CLAUDE PATH: when ANTHROPIC_API_KEY is present, POST to Anthropic's
//     Messages API, parse the response JSON, return the first text block's
//     content parsed as T. On ANY error, return opts.fallback — never throw.
//
// Design constraints (PRD §16, §18, §20):
//  - DO NOT install @anthropic-ai/sdk — use raw fetch only.
//  - DO NOT read any env file — read process.env at call time.
//  - Every claim must trace to fetched sources; the system prompt enforces this.

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Ensures the keyless-path warning is emitted at most once per process. */
let warned = false;

// ---------------------------------------------------------------------------
// llmGenerate
// ---------------------------------------------------------------------------

/**
 * The single generate entrypoint for all GrowthRig agents.
 *
 * @template T  The shape of the structured output expected (e.g. Hypothesis[]).
 *
 * @param opts.schema   Human-readable description of the expected JSON shape.
 *                      Used in the prompt so Claude knows what to emit.
 * @param opts.prompt   The agent's instruction (what to draft / generate).
 * @param opts.sources  Source material from redditAsSourceText() or fetchPage().
 *                      Claude MUST cite from this; the system prompt enforces it.
 * @param opts.fallback Value returned on any error OR when no API key is set.
 *
 * @returns Parsed T on success, opts.fallback otherwise.
 */
export async function llmGenerate<T>(opts: {
  schema: string;
  prompt: string;
  sources: string;
  fallback: T;
}): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ------------------------------------------------------------------
  // KEYLESS PATH
  // ------------------------------------------------------------------
  if (!apiKey) {
    if (!warned) {
      console.warn(
        "[growthrig] llmGenerate: ANTHROPIC_API_KEY not set — using deterministic fallback. Kit content will be templated, not model-generated.",
      );
      warned = true;
    }
    return opts.fallback;
  }

  // ------------------------------------------------------------------
  // CLAUDE PATH
  // ------------------------------------------------------------------
  const baseUrl =
    process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  const model =
    process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

  const systemPrompt = [
    "You are drafting growth content. Use ONLY the sources provided below.",
    "Do not invent facts, numbers, or claims not present in the sources.",
    "If you cannot draft from the sources, return the fallback.",
    "",
    "Expected output schema:",
    opts.schema,
    "",
    "Source material (the ONLY facts you may cite):",
    opts.sources,
  ].join("\n");

  const requestBody = {
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: opts.prompt,
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000); // 30 s for LLM

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "<unreadable>");
      console.warn(
        `[growthrig] llmGenerate: Anthropic API returned HTTP ${res.status} — ${errText.slice(0, 200)}`,
      );
      return opts.fallback;
    }

    // Anthropic Messages response shape:
    // { content: [{ type: "text", text: "..." }, ...], ... }
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const textBlock = json?.content?.find((b) => b.type === "text");
    if (!textBlock?.text) {
      console.warn("[growthrig] llmGenerate: no text block in Anthropic response");
      return opts.fallback;
    }

    // Claude should emit valid JSON matching opts.schema.
    // We attempt a parse; on failure we return the fallback.
    try {
      // Strip markdown code fences if present (Claude often wraps JSON in ```).
      const raw = textBlock.text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      return JSON.parse(raw) as T;
    } catch {
      console.warn(
        "[growthrig] llmGenerate: failed to parse Claude response as JSON — returning fallback. " +
          `Raw (first 300 chars): ${textBlock.text.slice(0, 300)}`,
      );
      return opts.fallback;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[growthrig] llmGenerate: fetch error — ${msg}`);
    return opts.fallback;
  } finally {
    clearTimeout(timer);
  }
}
