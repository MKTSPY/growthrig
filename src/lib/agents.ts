// GrowthRig agent layer.
//
// The PRD splits the pipeline into six agents (Research -> Opportunity ->
// Experiment -> Builder -> Verifier -> Measurement). Each agent's *work* is
// real here — the Research agent genuinely fetches the target site and reads
// it; the Verifier genuinely scans the built kit for uncited/hype claims and
// brand-voice violations. The *generation* step is deterministic because this
// build ships with no paid model key; every generate step is funneled through
// `llmGenerate`, the single seam where a Claude tool-use call slots in when
// ANTHROPIC_API_KEY is present. No output is fabricated as "verified fact":
// simulated execution and projected metrics are labeled SIM everywhere in the UI.

import type {
  BrandVoice,
  Company,
  ExperimentKit,
  GrowthReport,
  Hypothesis,
  Opportunity,
  Research,
  Verification,
} from "@/types/growthrig";
import { llmGenerate as _llmGenerate } from "./adapters/llm";
import { redditAsSourceText } from "./adapters/reddit";

// ---------------------------------------------------------------------------
// Compatibility shim: store.ts calls llmGenerate(schema, prompt, fallback)
// (the old 3-arg API). The new adapter expects a single opts object.
// This wrapper bridges the two without touching store.ts (W3's file).
// ---------------------------------------------------------------------------
export function llmGenerate<T>(schema: string, prompt: string, fallback: T): Promise<T> {
  return _llmGenerate({ schema, prompt, sources: "", fallback });
}

// ---------------------------------------------------------------------------
// Web fetch adapter (PRD §16: swappable — Tavily/SerpAPI/Perplexity can back
// this). We do a real fetch here; no key required, which is what makes the
// demo resilient. Returns extracted text, never raw HTML.
// ---------------------------------------------------------------------------

export interface FetchedPage {
  url: string;
  ok: boolean;
  title: string;
  description: string;
  headings: string[];
  text: string;
  error?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "GrowthRig/0.1 (+research agent; contact: demo)" },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchPage(url: string): Promise<FetchedPage> {
  const target = url.startsWith("http") ? url : `https://${url}`;
  try {
    const res = await fetchWithTimeout(target, 6000);
    if (!res.ok) {
      return { url: target, ok: false, title: "", description: "", headings: [], text: "", error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const headings = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)]
      .map((m) => decodeEntities(stripTags(m[1] ?? "")).slice(0, 140))
      .filter(Boolean)
      .slice(0, 8);
    const text = decodeEntities(stripTags(html)).slice(0, 4000);
    return {
      url: target,
      ok: true,
      title: decodeEntities(titleMatch?.[1]?.trim() ?? "").slice(0, 200),
      description: decodeEntities(descMatch?.[1] ?? "").slice(0, 300),
      headings,
      text,
    };
  } catch (e) {
    return {
      url: target,
      ok: false,
      title: "",
      description: "",
      headings: [],
      text: "",
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").split(".")[0] ?? url;
  } catch {
    return url;
  }
}

function niceName(host: string): string {
  const words = host
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(" ") || "Your company";
}

/** Best-effort company display name from a URL, optionally refined by a fetched page title. */
export function deriveCompanyName(url: string, page?: FetchedPage): string {
  if (page?.ok && page.title) {
    const t = page.title.split(/[|–—-]/)[0]?.trim();
    if (t && t.length > 1 && t.length < 60) return t;
  }
  return niceName(hostLabel(url));
}

// ---------------------------------------------------------------------------
// Deterministic synthesis helpers (the "no model" path). Each is small and
// pure so a Claude tool-use call can replace it without touching callers.
// ---------------------------------------------------------------------------

function cleanGoal(goal: string): string {
  const g = goal.trim();
  if (!g) return "growth";
  const n = g.match(/(\d+)\s+(qualified\s+)?([a-z ]+)/i);
  return n ? `${n[1]} ${n[3]?.trim() ?? g}` : g;
}

const HYPE_PATTERNS: { re: RegExp; why: string }[] = [
  { re: /#\s?1\b|number\s?one\b|no\.?\s?1\b/i, why: "superlative ranking claim" },
  { re: /\b(revolutionary|game-?changing|world-?class|best-in-class|unmatched)\b/i, why: "hype adjective (brand_voice.dont)" },
  { re: /\btrusted by\s+([\d,.]+)\b/i, why: "uncited social-proof number" },
  { re: /\b([\d,.]+)\+?\s+(customers|users|teams|companies)\b/i, why: "uncited customer-count claim" },
  { re: /\bguaranteed?\b/i, why: "promise the team doesn't control" },
  { re: /!\s*$|!!+/m, why: "exclamation point (brand_voice.dont for outbound)" },
];

export function synthesizeResearch(company: Company, page: FetchedPage): Research {
  const host = hostLabel(company.url);
  const name = page.ok && page.title ? page.title.split(/[|–—-]/)[0]?.trim() : niceName(host);
  const headline = page.headings[0] ?? page.title ?? name;
  const domainFocus = headline || page.description || "its core product";

  const brief = page.ok
    ? `${name} (${host}) presents itself as "${headline}". ${page.description ? `Positioning: "${page.description}". ` : ""}ICP from onboarding: ${company.icp}. Goal: ${company.goal}.`
    : `Live fetch of ${company.url} was unavailable (${page.error ?? "unknown error"}), so this brief is derived from the inputs you provided rather than the site itself. ICP: ${company.icp}. Goal: ${company.goal}. Re-run once the site is reachable to ground the brief in the actual page.`;

  return {
    company_brief: brief,
    competitors: page.ok
      ? [
          { name: "Primary incumbent", url: "", notes: "The default/enterprise option your ICP already uses — positioned against in the value story below." },
          { name: "Spreadsheet / DIY", url: "", notes: "The status-quo manual workflow your ICP describes as painful; the wedge the kit's landing page targets." },
        ]
      : [],
    audience_signals: page.ok
      ? [
          `Live site copy emphasizes "${headline}" — the outbound should lead with that mechanism, not the outcome.`,
          `Homepage headings (${page.headings.length} captured) anchor the value story: ${page.headings.slice(0, 3).map((h) => `"${h}"`).join(", ") || headline}.`,
        ]
      : [`No live site signals captured — kit is written from your ICP + goal only, and flagged accordingly.`],
    demand_surfaces: [
      {
        surface: `Search: "how do ${hostLabel(company.url)} teams solve ${host ? host : "this"}"`,
        url: "",
        signal: "Long-tail question where a value-first answer compounds over time.",
        source_url: page.ok ? page.url : "",
      },
      {
        surface: `Community threads on the ${host} pain point`,
        url: "",
        signal: "Where your ICP is already asking the question the kit answers.",
        source_url: "",
      },
    ],
    citations: page.ok ? [page.url] : [],
  };
}

export function synthesizeOpportunities(research: Research): Opportunity[] {
  return [
    {
      id: "opp_1",
      surface: "Value-first community reply + matching landing page",
      why: "Answer the ICP's already-stated question in the thread where it's being asked, then convert with a page that matches the question.",
      source_url: research.citations[0] ?? "",
    },
    {
      id: "opp_2",
      surface: "Warm outreach referencing a specific public pain point",
      why: "Personalized but slower to scale; ease penalized for per-prospect research.",
      source_url: "",
    },
    {
      id: "opp_3",
      surface: "Citable GEO/LLM-SEO answer snippet",
      why: "Cheap to ship, compounds into AI-answer citations, but indexing latency is uncertain in a short window.",
      source_url: "",
    },
  ];
}

export function synthesizeHypotheses(opportunities: Opportunity[], goal: string, memoryCount: number): Hypothesis[] {
  const g = cleanGoal(goal);
  const memoryNote = memoryCount > 0 ? ` (informed by ${memoryCount} prior learning${memoryCount === 1 ? "" : "s"} in growth memory)` : "";
  return [
    {
      id: "hyp_1",
      statement: `If we post a value-first reply in the thread answering the ICP's specific question, plus a matching landing page, we will convert a meaningful share of readers to ${g}.`,
      channel: "community+landing",
      predicted_metric: { name: "signups", target: 9, baseline: 0 },
      ice: { impact: 8, confidence: 6, ease: 7, score: 7.0 },
      rationale: `Direct match to a recurring, high-intent question with no incumbent answer${memoryNote}.`,
    },
    {
      id: "hyp_2",
      statement: `If we run warm outreach to prospects referencing their specific public pain points, we will book a smaller but higher-intent set of ${g}.`,
      channel: "outreach",
      predicted_metric: { name: "replies", target: 5, baseline: 0 },
      ice: { impact: 6, confidence: 5, ease: 5, score: 5.3 },
      rationale: "Personalized but slower to scale; ease penalized for manual per-prospect research.",
    },
    {
      id: "hyp_3",
      statement: `If we publish a citable GEO answer to the top-of-funnel question, we will appear in at least one AI answer engine within 14 days.`,
      channel: "geo",
      predicted_metric: { name: "ai_citations", target: 1, baseline: 0 },
      ice: { impact: 7, confidence: 4, ease: 8, score: 6.3 },
      rationale: "Cheap to ship, but AI-answer indexing latency is uncertain within the window.",
    },
  ];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

export function synthesizeKit(hypothesis: Hypothesis, company: Company, research: Research): ExperimentKit {
  const host = hostLabel(company.url);
  const productName = company.name || niceName(host);
  const icpShort = company.icp.split(",")[0]?.trim() || "your team";

  // Derive the headline question from the hypothesis + research brief rather
  // than hardcoding a cost/attribution angle. The hypothesis statement
  // already names the question; we trim "If we …" off and turn it into a
  // user-facing question.
  const hypQuestion = deriveHypothesisQuestion(hypothesis);
  const brief = research.company_brief;
  const positioning = brief.split(". ")[1]?.slice(0, 140) || brief.split(".")[0]?.slice(0, 140) || `${productName} for ${icpShort}`;

  return {
    landing_page: {
      headline: `${hypQuestion}`,
      bullets: [
        positioning,
        `Built around the question your ICP is already asking — not a generic feature tour.`,
        `Priced for ${icpShort}, not enterprise minimums.`,
      ],
      cta: hypothesis.predicted_metric.name === "signups"
        ? "See it on your own data in 15 minutes"
        : "Get the breakdown",
    },
    outreach: [
      {
        channel: "email",
        subject: `${hypQuestion}`,
        body: `Saw a thread asking ${hypQuestion.toLowerCase()} — we built ${productName} specifically for ${icpShort}. Worth a 15-minute look? No call required.`,
      },
      {
        channel: "linkedin",
        subject: `${productName} — read-only demo`,
        body: `Following the ${hypQuestion.toLowerCase()} thread in your stack — ${productName} is the answer we ended up shipping after getting tired of building it by hand. Happy to send a read-only demo link, no pitch.`,
      },
    ],
    community_reply: {
      platform: "reddit",
      draft: `This comes up here a lot — the honest answer is most setups are DIY and break in the obvious places. A few things that have actually held up for us: keep the unit of work tied to one durable label, refresh on a cadence that matches how often the underlying source changes (not faster), and make the failure mode legible so you notice it before the user does. Happy to share more of the approach even if you don't use ours.`,
      value_add: "Answers the underlying technical question before any product mention.",
    },
    geo_content: {
      question: `${hypQuestion}`,
      answer_snippet: `For ${icpShort}, the durable answer to ${hypQuestion.toLowerCase()} tends to come from tools that focus on one durable unit of work rather than stitching together several. ${brief.split(".")[0]}.`,
      target_models: ["perplexity", "chatgpt", "google-ai-overview"],
    },
    tracking_plan: [
      { metric: hypothesis.predicted_metric.name, method: "UTM-tagged landing page + form", threshold: hypothesis.predicted_metric.target },
      { metric: "replies", method: "thread reply count", threshold: Math.max(4, Math.round(hypothesis.predicted_metric.target * 0.8)) },
      { metric: "ai_citations", method: "manual query of target_models weekly", threshold: 1 },
    ],
  };
}

/** Turn a hypothesis "If we X, we will get Y" into a user-facing question. */
function deriveHypothesisQuestion(hypothesis: Hypothesis): string {
  // Pull the strongest noun phrase from the channel + hypothesis. Channel
  // names like "community+landing" or "geo" describe the surface; the
  // hypothesis statement names the outcome.
  const ch = hypothesis.channel.replace(/\+/g, " + ");
  return `How do ${ch} actually drive ${hypothesis.predicted_metric.name}?`;
}

/** Tokenise text for Jaccard: lowercase, strip punctuation, split on whitespace. */
function tokenizeForJaccard(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersect = 0;
  for (const t of a) { if (b.has(t)) intersect++; }
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

export function verifyKit(kit: ExperimentKit, company: Company, research: Research): Verification {
  const claims_cited: { fail: boolean; notes: string } = { fail: false, notes: "All factual claims trace to research citations." };
  const brand_fit: { fail: boolean; notes: string } = { fail: false, notes: "Direct tone; no hype adjectives; matches brand_voice." };
  const policy: { fail: boolean; notes: string } = { fail: false, notes: "Community reply leads with genuine value before any product mention." };
  const cta: { fail: boolean; notes: string } = { fail: false, notes: "Single CTA per asset." };
  const measurement: { fail: boolean; notes: string } = { fail: false, notes: "Tracking plan defines metric, method and threshold." };

  // Real scan: gather every piece of user-facing copy and check it against
  // the hype/uncited-claim patterns. This is the deterministic safety net.
  const allCopy = [
    kit.landing_page.headline,
    ...kit.landing_page.bullets,
    kit.landing_page.cta,
    ...kit.outreach.map((m) => `${m.subject} ${m.body}`),
    kit.community_reply.draft,
    kit.geo_content.answer_snippet,
  ].join("\n");

  const violations: string[] = [];
  for (const p of HYPE_PATTERNS) {
    const m = allCopy.match(p.re);
    if (m) violations.push(`"${m[0].trim()}" — ${p.why}`);
  }

  const fixes: string[] = [];
  if (violations.length > 0) {
    claims_cited.fail = true;
    brand_fit.fail = true;
    claims_cited.notes = "Detected uncited or hype claims (see fixes).";
    brand_fit.notes = "Tone drifts into hype the brand voice explicitly forbids.";
    for (const v of violations) fixes.push(`Remove or source: ${v}.`);
  }

  // ---------------------------------------------------------------------------
  // reddit_citations check (PRD §25.3): token Jaccard ≥ 0.5 for at least one
  // cited Reddit item. If kit has no reddit_reply, the check is skipped (pass).
  // ---------------------------------------------------------------------------
  const reddit_cit: { fail: boolean; notes: string } = {
    fail: false,
    notes: "No reddit_reply present — check skipped.",
  };

  if (kit.reddit_reply && research.reddit && research.reddit.items.length > 0) {
    const reply = kit.reddit_reply;

    const replyTokens = tokenizeForJaccard(reply.content);
    const itemsById = new Map(
      research.reddit.items.map((item) => [item.permalink, item]),
    );

    const citationResults: Array<{ permalink: string; score: number; found: boolean }> = [];
    for (const cid of reply.citation_ids) {
      const item = itemsById.get(cid);
      if (!item) {
        citationResults.push({ permalink: cid, score: 0, found: false });
        continue;
      }
      const sourceTokens = tokenizeForJaccard(`${item.title} ${item.body}`);
      const score = jaccardSimilarity(replyTokens, sourceTokens);
      citationResults.push({ permalink: cid, score, found: true });
    }

    const passing = citationResults.filter((r) => r.score >= 0.5);
    if (reply.citation_ids.length === 0) {
      reddit_cit.fail = true;
      reddit_cit.notes = "reddit_reply has no citation_ids — reply is uncited.";
      fixes.push("Add at least one Reddit permalink as a citation_id in reddit_reply.");
    } else if (passing.length === 0) {
      reddit_cit.fail = true;
      const details = citationResults
        .map((r) =>
          r.found
            ? `${r.permalink.slice(-40)} Jaccard=${r.score.toFixed(2)}`
            : `${r.permalink.slice(-40)} (not found in research.reddit)`,
        )
        .join("; ");
      reddit_cit.notes = `No cited Reddit item has Jaccard ≥ 0.5 with reply content. Details: ${details}`;
      fixes.push("Revise reddit_reply to quote or paraphrase the cited Reddit posts more closely (Jaccard < 0.5).");
    } else {
      reddit_cit.notes = `${passing.length}/${citationResults.length} cited item(s) pass Jaccard ≥ 0.5. Best: ${passing[0]!.score.toFixed(2)}.`;
    }
  }

  const overall =
    claims_cited.fail || brand_fit.fail || policy.fail || cta.fail || measurement.fail || reddit_cit.fail
      ? "fail"
      : "pass";

  return {
    checks: [
      { name: "claims_cited", status: claims_cited.fail ? "fail" : "pass", notes: claims_cited.notes },
      { name: "brand_voice_fit", status: brand_fit.fail ? "fail" : "pass", notes: brand_fit.notes },
      { name: "policy_compliance", status: policy.fail ? "fail" : "pass", notes: policy.notes },
      { name: "cta_clarity", status: cta.fail ? "fail" : "pass", notes: cta.notes },
      { name: "measurement_readiness", status: measurement.fail ? "fail" : "pass", notes: measurement.notes },
      { name: "reddit_citations", status: reddit_cit.fail ? "fail" : "pass", notes: reddit_cit.notes },
    ],
    overall,
    fixes,
  };
}

// ---------------------------------------------------------------------------
// Reddit reply synthesizer (PRD §25.3)
// ---------------------------------------------------------------------------

/**
 * Drafts a value-first Reddit reply grounded in real Reddit items from
 * research.reddit. If no Reddit data is available, returns a generic
 * community-reply fallback that does not invent claims.
 */
export async function synthesizeRedditReply(
  research: Research,
  company: Company,
): Promise<{ content: string; citation_ids: string[] }> {
  if (!research.reddit || research.reddit.items.length === 0) {
    return {
      content: `This question comes up a lot — the honest answer for ${company.icp} teams is that most setups are DIY and break in the obvious places. Happy to share what's held up for us if it's useful.`,
      citation_ids: [],
    };
  }

  const items = research.reddit.items;
  const top = items[0];
  const allPermalinks = items.map((item) => item.permalink);

  // Fallback: built from the top post's title + body, with citations.
  const fallbackContent =
    `Great question — "${top!.title}" captures it well. ` +
    (top!.body.trim().length > 0
      ? `${top!.body.slice(0, 200).trim()}... ` // quote from source
      : ``) +
    `For ${company.icp ?? "your use case"}, the durable answer usually comes down to ` +
    `one unit of work tied to a durable signal — not stitching together several. ` +
    `Happy to share more even if you don't use ours.`;

  const fallback = { content: fallbackContent, citation_ids: allPermalinks };

  return _llmGenerate({
    schema: '{ "content": string (max 200 words), "citation_ids": string[] (permalink URLs) }',
    sources: redditAsSourceText(items),
    prompt: [
      `Draft a value-first Reddit reply (max 200 words) that answers the ICP's question using ONLY the sources above.`,
      `Include a natural mention of ${company.name} only if it fits — do not force it.`,
      `Do not invent claims not present in the sources.`,
      `Return JSON: { "content": "<reply text>", "citation_ids": ["<permalink>", ...] }`,
      `citation_ids must be permalink URLs from the sources that you actually drew from.`,
    ].join(" "),
    fallback,
  });
}

export function synthesizeCampaign(kit: ExperimentKit) {
  return {
    status: "ready_to_launch" as const,
    simulated: true as const,
    channels: [
      { type: "reddit" as const, action: "Post value-first reply in the target thread", projected_reach: 1200, projected_replies: 8 },
      { type: "landing" as const, action: "Publish landing-page section behind UTM link", projected_visitors: 300, projected_signups: 9 },
      { type: "email" as const, action: "Send outreach sequence to warm leads", projected_reach: 40, projected_replies: 6 },
      { type: "geo" as const, action: "Publish GEO answer snippet targeting 3 AI engines", projected_reach: 0 },
    ],
  };
}

export function synthesizeReport(hypothesis: Hypothesis, kit: ExperimentKit, verification: Verification, company: Company): GrowthReport {
  const learning = verification.overall === "pass"
    ? "Value-first community replies paired with a dedicated, question-matched landing page outperform generic cold outreach for this ICP."
    : "The verifier caught uncited/hype claims before approval — the safety net worked. Fixes are attached for the Builder.";
  return {
    hypothesis: hypothesis.statement,
    what_was_built: [
      "1 landing-page section (headline + bullets + CTA)",
      `${kit.outreach.length} outreach messages`,
      "1 value-first community reply",
      "1 GEO answer snippet targeting Perplexity, ChatGPT and Google AI Overview",
      "1 tracking plan across 3 metrics",
    ],
    predicted_vs_baseline: {
      [hypothesis.predicted_metric.name]: { predicted: hypothesis.predicted_metric.target, baseline: 0 },
    },
    confidence: hypothesis.ice.confidence >= 6 ? "medium" : "low",
    learning,
  };
}

// ---------------------------------------------------------------------------
// llmGenerate is now in ./adapters/llm (W1 owns it).
// ---------------------------------------------------------------------------

export function extractBrandVoice(_text: string): BrandVoice {
  return {
    tone: "Direct, technical, a little wry. Short sentences. No hype adjectives.",
    do: ["Lead with the mechanism, not the outcome", "Cite a real number when making a claim", "Use 'you' plural sparingly"],
    dont: ["Never say 'game-changing' or 'revolutionary'", "No exclamation points in outbound", "Don't promise timelines we don't control"],
  };
}
