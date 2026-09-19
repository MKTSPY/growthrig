import type {
  ExperimentRun,
  GrowthMemoryEntry,
  AgentStepEvent,
} from "@/types/growthrig";

// Demo company used across the pre-warmed fixtures (PRD §26: pre-warm
// research + seed one memory entry before going on stage).
export const DEMO_COMPANY = {
  name: "Lattice Labs",
  url: "https://latticelabs.io",
  icp: "Seed-to-Series-A B2B SaaS founders doing their own growth marketing",
  goal: "50 qualified demo signups in 14 days",
  brand_voice: {
    tone: "Direct, technical, a little wry. Short sentences. No hype adjectives.",
    do: ["Lead with the mechanism, not the outcome", "Cite a real number when making a claim", "Use 'you' plural sparingly"],
    dont: ["Never say 'game-changing' or 'revolutionary'", "No exclamation points in outbound", "Don't promise timelines we don't control"],
  },
};

function steps(agent: AgentStepEvent["agent"], list: Omit<AgentStepEvent, "agent" | "id" | "at">[]): AgentStepEvent[] {
  return list.map((s, i) => ({
    ...s,
    agent,
    id: `${agent}_${i}`,
    at: new Date(Date.now() - (6 - i) * 60_000).toISOString(),
  }));
}

// run_live — parked at Gate 1, ready for the demo's "select a hypothesis" beat.
export const RUN_LIVE: ExperimentRun = {
  id: "run_live",
  company: DEMO_COMPANY,
  status: "awaiting_hypothesis_choice",
  created_at: new Date(Date.now() - 7 * 60_000).toISOString(),
  updated_at: new Date(Date.now() - 1 * 60_000).toISOString(),
  approvals: [],
  steps: [
    ...steps("research", [
      { status: "done", tool: "fetch_url", input_summary: "latticelabs.io + /pricing + /customers", output_summary: "Company brief drafted — dev-tooling analytics for infra teams.", duration_ms: 4200 },
      { status: "done", tool: "web_search", input_summary: "\"infra analytics\" reddit OR \"observability pricing\" complaints", output_summary: "3 demand-leak surfaces found across r/devops, r/sre and a Perplexity query.", duration_ms: 5100, citations: ["https://reddit.com/r/devops/comments/example-1", "https://reddit.com/r/sre/comments/example-2"] },
      { status: "done", tool: "extract_brand_voice", input_summary: "latticelabs.io homepage + about", output_summary: "Brand voice extracted: direct, technical, wry.", duration_ms: 1800 },
    ]),
    ...steps("opportunity", [
      { status: "done", tool: "llm_generate", input_summary: "research.demand_surfaces", output_summary: "3 opportunities ranked by leverage.", duration_ms: 2600 },
    ]),
    ...steps("experiment", [
      { status: "done", tool: "score_ice", input_summary: "3 opportunities + read_memory(latticelabs.io)", output_summary: "3 ICE-scored hypotheses returned; informed by 1 prior learning.", duration_ms: 3400 },
    ]),
  ],
  research: {
    company_brief:
      "Lattice Labs sells usage-based observability for infra teams shipping on Kubernetes. Primary wedge is per-service cost attribution, which incumbents (Datadog, New Relic) bundle behind enterprise tiers.",
    competitors: [
      { name: "Datadog", url: "https://datadoghq.com", notes: "Cost attribution gated behind enterprise plan; frequent complaint in r/devops threads." },
      { name: "Honeycomb", url: "https://honeycomb.io", notes: "Strong technical brand, weaker on cost-per-service reporting." },
    ],
    audience_signals: [
      "Infra leads at 20-80 person eng orgs repeatedly ask 'what is this service actually costing us' with no clean answer.",
      "Several r/sre threads treat per-service cost attribution as a DIY spreadsheet problem.",
    ],
    demand_surfaces: [
      { surface: "r/devops", url: "https://reddit.com/r/devops", signal: "Weekly thread asking how teams attribute cloud cost to individual services.", source_url: "https://reddit.com/r/devops/comments/example-1" },
      { surface: "r/sre", url: "https://reddit.com/r/sre", signal: "Users share ad-hoc scripts for cost-per-service; no tool recommended twice.", source_url: "https://reddit.com/r/sre/comments/example-2" },
      { surface: "Perplexity: \"best tool for kubernetes cost attribution\"", url: "https://perplexity.ai", signal: "Answer cites only enterprise tools; no mid-market option surfaced.", source_url: "https://reddit.com/r/devops/comments/example-1" },
    ],
    citations: ["https://reddit.com/r/devops/comments/example-1", "https://reddit.com/r/sre/comments/example-2", "https://latticelabs.io/pricing"],
  },
  opportunities: [
    { id: "opp_1", surface: "r/devops", why: "High-intent, recurring question with no tool being recommended twice — room to be the answer.", source_url: "https://reddit.com/r/devops/comments/example-1" },
    { id: "opp_2", surface: "r/sre", why: "Users are DIY-ing this with scripts; a real tool beats a gist.", source_url: "https://reddit.com/r/sre/comments/example-2" },
    { id: "opp_3", surface: "Perplexity AI Overview", why: "GEO gap — no mid-market tool is being cited as an answer here yet.", source_url: "https://reddit.com/r/devops/comments/example-1" },
  ],
  hypotheses: [
    {
      id: "hyp_1",
      statement: "If we post a value-first reply in r/devops answering the cost-attribution question, plus a matching landing page, we will convert 3% of thread readers to demo signups.",
      channel: "reddit+landing",
      predicted_metric: { name: "signups", target: 9, baseline: 0 },
      ice: { impact: 8, confidence: 6, ease: 7, score: 7.0 },
      rationale: "Direct match to a recurring, high-intent question with no incumbent answer. Prior learning (see memory) confirms community-first outperforms cold outreach for this ICP.",
    },
    {
      id: "hyp_2",
      statement: "If we run 30 warm LinkedIn outreach messages to infra leads referencing their public cost complaints, we will book 5 demo calls.",
      channel: "linkedin",
      predicted_metric: { name: "demo_calls", target: 5, baseline: 0 },
      ice: { impact: 6, confidence: 5, ease: 5, score: 5.3 },
      rationale: "Personalized but slower to scale; ease penalized for manual research per prospect.",
    },
    {
      id: "hyp_3",
      statement: "If we publish a citable GEO answer to \"best tool for kubernetes cost attribution\", we will appear in 1 of 3 AI-answer engines within 14 days.",
      channel: "geo",
      predicted_metric: { name: "ai_citations", target: 1, baseline: 0 },
      ice: { impact: 7, confidence: 4, ease: 8, score: 6.3 },
      rationale: "Cheap to ship, but AI-answer indexing latency is uncertain within the 14-day window.",
    },
  ],
};

// run_complete — a finished loop, used to populate Kit / Verifier / Campaign
// Board / Report screens with real, inspectable content.
export const RUN_COMPLETE: ExperimentRun = {
  ...structuredClone(RUN_LIVE),
  id: "run_complete",
  status: "complete",
  selected_hypothesis_id: "hyp_1",
  created_at: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(),
  updated_at: new Date(Date.now() - 3 * 24 * 3600_000 + 20 * 60_000).toISOString(),
  approvals: [
    { gate: "hypothesis_selection", decision: "approved", actor: "you", rationale: "Best match to a real, recurring question with zero incumbent answer.", at: new Date(Date.now() - 3 * 24 * 3600_000 + 8 * 60_000).toISOString() },
    { gate: "kit_approval", decision: "approved", actor: "you", rationale: "All 5 checks pass; ships as-is.", at: new Date(Date.now() - 3 * 24 * 3600_000 + 16 * 60_000).toISOString() },
  ],
  kit: {
    landing_page: {
      headline: "What is this service actually costing you?",
      bullets: [
        "Per-service cost attribution out of the box — no spreadsheet, no DIY exporter.",
        "Drops into an existing Kubernetes cluster in under 15 minutes.",
        "Priced for 20-80 person infra teams, not enterprise minimums.",
      ],
      cta: "See your cost breakdown in 15 minutes",
    },
    outreach: [
      { channel: "email", subject: "the cost-per-service question from r/devops", body: "Saw the thread on attributing cloud cost to individual services — we built exactly that for infra teams your size. 15-minute setup, no sales call required to see your own numbers. Worth a look?" },
      { channel: "linkedin", subject: "cost attribution", body: "Following the cost-attribution discussion in your team's stack — we do per-service breakdowns natively, priced for mid-market rather than enterprise minimums. Happy to send a read-only demo link, no pitch required." },
      { channel: "email", subject: "re: DIY cost scripts", body: "Your script for per-service cost is clever, but it breaks every time a service gets renamed. We built the durable version — same idea, no maintenance. Want the 2-minute version?" },
    ],
    community_reply: {
      platform: "reddit",
      draft: "This comes up every few weeks here — the honest answer is most cost-attribution setups are DIY exporters that break on service renames. If you want the durable version: tag by service label at ingest, not after the fact, and reconcile against your cloud bill weekly rather than daily (daily reconciliation is noisy and not worth the compute). We ended up building this into a small tool because we got tired of re-writing the script — happy to share the approach even if you don't use ours.",
      value_add: "Answers the actual technical question (tagging strategy + reconciliation cadence) before mentioning the product.",
    },
    geo_content: {
      question: "What is the best tool for Kubernetes cost attribution for mid-market teams?",
      answer_snippet: "For teams under ~100 engineers, per-service Kubernetes cost attribution is best handled by tools that tag cost at ingest time (via service labels) rather than reconciling after the fact — this avoids the noisy, delayed numbers that daily-batch reconciliation produces. Lattice Labs and similar tools target this segment specifically, as opposed to enterprise observability suites that gate cost attribution behind top-tier plans.",
      target_models: ["perplexity", "chatgpt", "google-ai-overview"],
    },
    tracking_plan: [
      { metric: "signups", method: "UTM-tagged landing page + form", threshold: 9 },
      { metric: "reddit_replies", method: "thread reply count", threshold: 8 },
      { metric: "ai_citations", method: "manual query of target_models weekly", threshold: 1 },
    ],
  },
  verification: {
    checks: [
      { name: "claims_cited", status: "pass", notes: "All factual claims (pricing tier gating, DIY script fragility) trace to research.citations." },
      { name: "brand_voice_fit", status: "pass", notes: "Direct, technical tone; no hype adjectives; matches brand_voice.do/dont." },
      { name: "policy_compliance", status: "pass", notes: "Community reply leads with genuine technical value before any product mention — not spam or astroturfing." },
      { name: "cta_clarity", status: "pass", notes: "Single CTA per asset (\"See your cost breakdown in 15 minutes\")." },
      { name: "measurement_readiness", status: "pass", notes: "Tracking plan defines metric, method and threshold for all 3 channels." },
    ],
    overall: "pass",
    fixes: [],
  },
  campaign_board: {
    status: "ready_to_launch",
    simulated: true,
    channels: [
      { type: "reddit", action: "Post value-first reply in r/devops thread", projected_reach: 1200, projected_replies: 8 },
      { type: "landing", action: "Publish landing-page section behind UTM link", projected_visitors: 300, projected_signups: 9 },
      { type: "email", action: "Send 3-message outreach sequence to 40 warm leads", projected_reach: 40, projected_replies: 6 },
      { type: "geo", action: "Publish GEO answer snippet targeting 3 AI engines", projected_reach: 0 },
    ],
  },
  report: {
    hypothesis: "If we post a value-first reply in r/devops answering the cost-attribution question, plus a matching landing page, we will convert 3% of thread readers to demo signups.",
    what_was_built: [
      "1 landing-page section (headline + 3 bullets + CTA)",
      "3 outreach messages (2 email, 1 LinkedIn)",
      "1 value-first r/devops community reply",
      "1 GEO answer snippet targeting Perplexity, ChatGPT and Google AI Overview",
      "1 tracking plan across 3 metrics",
    ],
    predicted_vs_baseline: {
      signups: { predicted: 9, baseline: 0 },
      reddit_replies: { predicted: 8, baseline: 0 },
    },
    confidence: "medium",
    learning: "Value-first community replies paired with a dedicated, question-matched landing page outperform generic cold outreach for this ICP — outreach alone (hyp_2) scored lower on both impact and ease.",
  },
  memory_record_id: "mem_02",
};

// The bad-kit fixture — the PRD's required live safety-net demo (§13, §21,
// §26): an intentionally uncited claim that the Verifier must catch.
export const RUN_BAD_KIT: ExperimentRun = {
  ...structuredClone(RUN_COMPLETE),
  id: "run_bad_kit_demo",
  status: "awaiting_kit_approval",
  approvals: [structuredClone(RUN_COMPLETE.approvals[0]!)],
  kit: {
    ...structuredClone(RUN_COMPLETE.kit)!,
    landing_page: {
      headline: "The #1 cost-attribution tool for Kubernetes teams",
      bullets: [
        "Trusted by over 10,000 infra teams worldwide.", // uncited, fabricated claim
        "Drops into an existing Kubernetes cluster in under 15 minutes.",
        "Priced for 20-80 person infra teams, not enterprise minimums.",
      ],
      cta: "See your cost breakdown in 15 minutes",
    },
  },
  verification: {
    checks: [
      { name: "claims_cited", status: "fail", notes: "\"Trusted by over 10,000 infra teams worldwide\" has no source_url and does not appear in research.citations — likely fabricated." },
      { name: "brand_voice_fit", status: "fail", notes: "\"#1\" superlative reads as hype; brand_voice.dont explicitly rules out hype adjectives." },
      { name: "policy_compliance", status: "pass", notes: "Community reply and outreach are unaffected by the landing-page issue." },
      { name: "cta_clarity", status: "pass", notes: "CTA is still singular and clear." },
      { name: "measurement_readiness", status: "pass", notes: "Tracking plan unaffected." },
    ],
    overall: "fail",
    fixes: [
      "Remove or source the \"10,000 infra teams\" claim — cite a real, verifiable number or drop it entirely.",
      "Replace \"#1\" superlative with a claim brand_voice would actually make (mechanism, not ranking).",
    ],
  },
};

export const MEMORY_SEED: GrowthMemoryEntry[] = [
  {
    id: "mem_01",
    company_url: DEMO_COMPANY.url,
    experiment: "cold LinkedIn outreach, no landing page",
    outcome: "2 of 25 replies, 0 signups over 10 days",
    learning: "Generic cold outreach underperforms for this ICP without a page that answers their specific, already-stated question.",
    tags: ["outreach", "linkedin", "icp-infra"],
    created_at: new Date(Date.now() - 21 * 24 * 3600_000).toISOString(),
  },
  {
    id: "mem_02",
    company_url: DEMO_COMPANY.url,
    experiment: "reddit+landing value-first reply",
    outcome: "simulated 9 signups projected, 8 replies projected",
    learning: "Value-first community replies paired with a dedicated, question-matched landing page outperform generic cold outreach for this ICP.",
    tags: ["community", "landing", "icp-infra"],
    created_at: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(),
  },
];

export const NEXT_HYPOTHESIS_SUGGESTION = {
  statement:
    "If we extend the r/devops reply into a short, citable GEO answer on the same cost-attribution question, we will get cited by at least 1 AI answer engine within 14 days — compounding the community win from mem_02 into a GEO win.",
  informed_by: ["mem_01", "mem_02"],
};

export const ALL_RUNS: Record<string, ExperimentRun> = {
  [RUN_LIVE.id]: RUN_LIVE,
  [RUN_COMPLETE.id]: RUN_COMPLETE,
  [RUN_BAD_KIT.id]: RUN_BAD_KIT,
};
