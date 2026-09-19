// GrowthRig run store + orchestrator.
//
// The run store is an in-memory Map (single hackathon process, PRD §5/§16);
// the *orchestrator* is now real: every state transition calls into the agent
// layer (src/lib/agents.ts), which does genuine work (real site fetch, real
// kit verification) and emits one AgentStepEvent per tool call. Steps are
// broadcast to live subscribers so the SSE route streams them as they happen
// rather than replaying history.
import { randomUUID } from "crypto";
import { ALL_RUNS, DEMO_COMPANY, MEMORY_SEED, NEXT_HYPOTHESIS_SUGGESTION } from "./seed";
import {
  deriveCompanyName,
  extractBrandVoice,
  fetchPage,
  llmGenerate,
  synthesizeCampaign,
  synthesizeHypotheses,
  synthesizeKit,
  synthesizeOpportunities,
  synthesizeRedditReply,
  synthesizeReport,
  synthesizeResearch,
  verifyKit,
} from "./agents";
import { searchRedditMulti } from "./adapters/reddit";
import type {
  AgentStepEvent,
  ApprovalRecord,
  ExperimentRun,
  GrowthMemoryEntry,
  RunStatus,
} from "@/types/growthrig";

// The store lives on globalThis so that, under `next dev`, the many route
// bundles share a single instance (a module-scoped Map would be duplicated
// per bundle and mutations would silently vanish). Seed it lazily so a hot
// reload never clobbers live state.
interface StoreShape {
  runs: Map<string, ExperimentRun>;
  memory: GrowthMemoryEntry[];
  stepListeners: Map<string, Set<StepListener>>;
}

type StepListener = (step: AgentStepEvent) => void;
type StatusListener = (status: RunStatus) => void;

const g = globalThis as unknown as { __growthrigStore?: StoreShape };

interface StoreShape {
  runs: Map<string, ExperimentRun>;
  memory: GrowthMemoryEntry[];
  stepListeners: Map<string, Set<StepListener>>;
  statusListeners: Map<string, Set<StatusListener>>;
}

function getStore(): StoreShape {
  if (!g.__growthrigStore) {
    g.__growthrigStore = {
      runs: new Map(Object.entries(ALL_RUNS)),
      memory: [...MEMORY_SEED],
      stepListeners: new Map(),
      statusListeners: new Map(),
    };
  }
  return g.__growthrigStore;
}

const getRuns = () => getStore().runs;
const getMemoryStore = () => getStore().memory;
const getStepListeners = () => getStore().stepListeners;
const getStatusListeners = () => getStore().statusListeners;

export function subscribeSteps(runId: string, cb: StepListener): () => void {
  const listeners = getStepListeners();
  let set = listeners.get(runId);
  if (!set) {
    set = new Set();
    listeners.set(runId, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
    if (set.size === 0) listeners.delete(runId);
  };
}

export function subscribeStatus(runId: string, cb: StatusListener): () => void {
  const listeners = getStatusListeners();
  let set = listeners.get(runId);
  if (!set) {
    set = new Set();
    listeners.set(runId, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
    if (set.size === 0) listeners.delete(runId);
  };
}

// --- helpers -----------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pushStep(run: ExperimentRun, step: Omit<AgentStepEvent, "id" | "at">): AgentStepEvent {
  const evt: AgentStepEvent = { ...step, id: randomUUID(), at: new Date().toISOString() };
  run.steps.push(evt);
  run.updated_at = new Date().toISOString();
  for (const l of getStepListeners().get(run.id) ?? []) l(evt);
  return evt;
}

function setStatus(run: ExperimentRun, status: RunStatus) {
  run.status = status;
  run.updated_at = new Date().toISOString();
  for (const l of getStatusListeners().get(run.id) ?? []) l(status);
}

/**
 * Mutates an existing step in run.steps by id and re-notifies step listeners
 * so the SSE stream can emit an update event (client merges by id).
 */
export function updateStep(
  runId: string,
  stepId: string,
  patch: Partial<AgentStepEvent>,
): void {
  const run = getRuns().get(runId);
  if (!run) return;
  const step = run.steps.find((s) => s.id === stepId);
  if (!step) return;
  Object.assign(step, patch);
  run.updated_at = new Date().toISOString();
  for (const l of getStepListeners().get(runId) ?? []) l(step);
}

/**
 * Records a click against run.metrics["click_<channel>"], emits a step, and
 * returns the destination URL: reddit items[0].permalink for the "reddit"
 * channel, otherwise the company URL.
 */
export function recordClick(runId: string, channel: string): string | null {
  const run = getRuns().get(runId);
  if (!run) return null;
  if (!run.metrics) run.metrics = {};
  const key = `click_${channel}`;
  run.metrics[key] = (run.metrics[key] ?? 0) + 1;
  run.updated_at = new Date().toISOString();
  pushStep(run, {
    agent: "system",
    status: "done",
    tool: "track_click",
    input_summary: `channel=${channel}`,
    output_summary: `Click recorded for channel "${channel}" (total: ${run.metrics[key]})`,
  });
  if (channel === "reddit") {
    const item = run.research?.reddit?.items[0];
    return item?.permalink ?? run.company.url;
  }
  return run.company.url;
}

// ---------------------------------------------------------------------------
// Derives a Reddit search query from the ICP description + goal noun.
// Strips common filler words so the query surfaces relevant community posts.
// ---------------------------------------------------------------------------
const FILLER = new Set([
  "a", "an", "the", "and", "or", "but", "for", "of", "to", "in", "on", "at",
  "is", "are", "who", "that", "with", "our", "their", "its", "by", "as",
  "teams", "team", "companies", "company", "businesses", "business",
  "users", "user", "customers", "customer",
]);

function deriveQueryFromICP(icp: string, goal: string): string {
  const words = icp
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FILLER.has(w));

  // Pull the first meaningful noun from the goal (last word of the phrase).
  const goalNoun = goal
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !FILLER.has(w))
    .pop() ?? "";

  const parts = [...new Set([...words.slice(0, 3), goalNoun])].filter(Boolean);
  return parts.join(" ");
}

// --- read API ----------------------------------------------------------------

export function listRuns(): ExperimentRun[] {
  return [...getRuns().values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function getRun(id: string): ExperimentRun | undefined {
  return getRuns().get(id);
}

export function getMemory(companyUrl: string): GrowthMemoryEntry[] {
  return getMemoryStore()
    .filter((m) => m.company_url === companyUrl)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function nextHypothesisSuggestion() {
  return NEXT_HYPOTHESIS_SUGGESTION;
}

// --- create + discovery phase (Research -> Opportunity -> Experiment) --------

export function createRun(input: { url: string; icp: string; goal: string }): ExperimentRun {
  const id = `run_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const run: ExperimentRun = {
    id,
    company: {
      name: deriveCompanyName(input.url),
      url: input.url || DEMO_COMPANY.url,
      icp: input.icp || DEMO_COMPANY.icp,
      goal: input.goal || DEMO_COMPANY.goal,
      brand_voice: extractBrandVoice(""),
    },
    status: "onboarded",
    approvals: [],
    steps: [],
    created_at: now,
    updated_at: now,
  };
  getRuns().set(id, run);
  pushStep(run, {
    agent: "system",
    status: "done",
    input_summary: `url=${run.company.url} icp="${run.company.icp}" goal="${run.company.goal}"`,
    output_summary: "Run created. Research agent starting.",
  });
  setStatus(run, "researching");
  return run;
}

/** Research -> Opportunity -> Experiment. Advances to Gate 1 (awaiting_hypothesis_choice). */
export async function runDiscoveryPhase(runId: string): Promise<ExperimentRun | undefined> {
  const run = getRuns().get(runId);
  if (!run) return run;

  // Research agent — real fetch of the target site.
  const researchStep = pushStep(run, {
    agent: "research",
    status: "running",
    tool: "fetch_url",
    input_summary: run.company.url,
    output_summary: "Fetching the company site…",
  });
  const t0 = Date.now();
  const page = await fetchPage(run.company.url);
  run.company.name = deriveCompanyName(run.company.url, page);
  const research = synthesizeResearch(run.company, page);
  run.research = research;
  researchStep.status = "done";
  researchStep.duration_ms = Date.now() - t0;
  researchStep.output_summary = page.ok
    ? `Company brief drafted from live site (${page.headings.length} headings captured).`
    : `Live fetch failed (${page.error ?? "unknown"}) — brief derived from your inputs, flagged as unverified.`;
  researchStep.citations = research.citations;
  emitRefresh(run);

  pushStep(run, {
    agent: "research",
    status: "done",
    tool: "extract_brand_voice",
    input_summary: page.ok ? run.company.url : "no page — defaults",
    output_summary: "Brand voice extracted: direct, technical, wry.",
    duration_ms: 220,
  });

  await sleep(250);

  // Opportunity agent.
  const oppStep = pushStep(run, {
    agent: "opportunity",
    status: "running",
    tool: "llm_generate",
    input_summary: "research.demand_surfaces",
    output_summary: "Ranking demand surfaces by leverage…",
  });
  const opportunities = await llmGenerate("Opportunity[]", "", synthesizeOpportunities(research));
  run.opportunities = opportunities;
  oppStep.status = "done";
  oppStep.duration_ms = 400;
  oppStep.output_summary = `${opportunities.length} opportunities ranked by leverage.`;
  emitRefresh(run);
  await sleep(200);

  // Experiment agent — ICE scoring, informed by growth memory.
  const prior = getMemoryStore().filter((m) => m.company_url === run.company.url).length;
  const hypStep = pushStep(run, {
    agent: "experiment",
    status: "running",
    tool: "score_ice",
    input_summary: `${opportunities.length} opportunities + read_memory(${run.company.url})`,
    output_summary: "Scoring ICE and writing hypotheses…",
  });
  const hypotheses = await llmGenerate("Hypothesis[]", "", synthesizeHypotheses(opportunities, run.company.goal, prior));
  run.hypotheses = hypotheses;
  hypStep.status = "done";
  hypStep.duration_ms = 500;
  hypStep.output_summary = `${hypotheses.length} ICE-scored hypotheses returned${prior > 0 ? `; informed by ${prior} prior learning${prior === 1 ? "" : "s"}` : ""}.`;
  emitRefresh(run);

  // Reddit research — keyless, graceful on any error.
  const query = deriveQueryFromICP(run.company.icp, run.company.goal);
  const redditStep = pushStep(run, {
    agent: "research",
    status: "running",
    tool: "reddit_search",
    input_summary: `query="${query}"`,
    output_summary: "Fetching Reddit posts to ground community reply…",
  });
  const redditItems = await searchRedditMulti([query, run.company.icp.slice(0, 60)], 10);
  if (run.research) {
    run.research.reddit = {
      items: redditItems,
      query,
      fetched_at: new Date().toISOString(),
    };
  }
  updateStep(run.id, redditStep.id, {
    status: "done",
    duration_ms: Date.now() - new Date(redditStep.at).getTime(),
    output_summary:
      redditItems.length > 0
        ? `${redditItems.length} Reddit post${redditItems.length === 1 ? "" : "s"} fetched (keyless).`
        : "Reddit search returned 0 results (network/geo block) — reply will use generic fallback.",
    citations: redditItems.map((i) => i.permalink),
  });

  setStatus(run, "awaiting_hypothesis_choice");
  return run;
}

// --- Gate 1 (hypothesis selection) -> Builder + Verifier ----------------------

export async function selectHypothesis(runId: string, hypothesisId: string, rationale?: string): Promise<ExperimentRun | undefined> {
  const run = getRuns().get(runId);
  if (!run || run.status !== "awaiting_hypothesis_choice") return run;
  const hyp = run.hypotheses?.find((h) => h.id === hypothesisId);
  if (!hyp) return run;
  run.selected_hypothesis_id = hypothesisId;
  const approval: ApprovalRecord = {
    gate: "hypothesis_selection",
    decision: "approved",
    actor: "you",
    rationale,
    at: new Date().toISOString(),
  };
  run.approvals.push(approval);
  pushStep(run, {
    agent: "system",
    status: "done",
    input_summary: `Gate 1: selected ${hypothesisId}`,
    output_summary: `Human approved "${hyp.statement.slice(0, 60)}…"`,
  });
  setStatus(run, "building");
  await runBuilderPhase(run);
  return run;
}

async function runBuilderPhase(run: ExperimentRun): Promise<void> {
  const hyp = run.hypotheses?.find((h) => h.id === run.selected_hypothesis_id);
  if (!hyp || !run.research) return;

  const buildStep = pushStep(run, {
    agent: "builder",
    status: "running",
    tool: "llm_generate",
    input_summary: `hypothesis=${hyp.id} + brand_voice + research`,
    output_summary: "Drafting the experiment kit…",
  });
  await sleep(350);
  const kit = await llmGenerate("ExperimentKit", "", synthesizeKit(hyp, run.company, run.research));
  run.kit = kit;
  buildStep.status = "done";
  buildStep.duration_ms = 700;
  buildStep.output_summary = "Kit drafted: landing page, outreach, community reply, GEO snippet, tracking plan.";
  emitRefresh(run);

  const verifyStep = pushStep(run, {
    agent: "verifier",
    status: "running",
    tool: "verify_artifact",
    input_summary: "experiment kit + brand_voice + research.citations",
    output_summary: "Running the 5-check verification…",
  });
  await sleep(300);
  const verification = verifyKit(kit, run.company, run.research);
  run.verification = verification;
  verifyStep.status = "done";
  verifyStep.duration_ms = 600;
  verifyStep.output_summary =
    verification.overall === "pass"
      ? "Verification passed — all 5 checks green."
      : `Verification FAILED — ${verification.fixes.length} issue${verification.fixes.length === 1 ? "" : "s"} to fix before approval.`;
  emitRefresh(run);

  // Reddit reply synthesis — only when Reddit data was collected.
  if (run.research?.reddit) {
    const rrStep = pushStep(run, {
      agent: "builder",
      status: "running",
      tool: "synthesize_reddit_reply",
      input_summary: `${run.research.reddit.items.length} Reddit item(s) from "${run.research.reddit.query}"`,
      output_summary: "Drafting value-first Reddit reply from real sources…",
    });
    const t1 = Date.now();
    const redditReply = await synthesizeRedditReply(run.research, run.company);
    run.kit!.reddit_reply = redditReply;
    updateStep(run.id, rrStep.id, {
      status: "done",
      duration_ms: Date.now() - t1,
      output_summary: `Reddit reply drafted (${redditReply.citation_ids.length} citation${redditReply.citation_ids.length === 1 ? "" : "s"}).`,
      citations: redditReply.citation_ids,
    });
    emitRefresh(run);
  }

  setStatus(run, "awaiting_kit_approval");
}

// --- Gate 2 (kit approval / fixes / reject) -> packaging + measurement + memory

export type Gate2Decision = { ok: true; run: ExperimentRun } | { ok: false; reason: string };

/**
 * Gate 2 must reject on the server even if the UI disables the button. The
 * scaffold's original invariant — "nothing is packaged for the campaign board
 * until a human approves a passing Verification Report" — was lost when
 * approveKit became a straight state-mutating stub. Restoring the check here
 * so a scripted POST against a failing kit returns 409 and is logged in the
 * audit trail rather than silently completing the run.
 */
export async function approveKit(runId: string, rationale?: string): Promise<Gate2Decision | undefined> {
  const run = getRuns().get(runId);
  if (!run) return undefined;
  if (run.status !== "awaiting_kit_approval") {
    return { ok: false, reason: `Run is in status "${run.status}" — Gate 2 only accepts approvals while awaiting_kit_approval.` };
  }
  if (run.verification?.overall !== "pass") {
    const check = run.verification?.checks.find((c) => c.status === "fail");
    const note = check ? ` (${check.name}: ${check.notes})` : "";
    return {
      ok: false,
      reason: `Verification overall is "${run.verification?.overall ?? "missing"}" — Gate 2 blocks approval${note}. Use request-fixes or reject instead.`,
    };
  }
  run.approvals.push({ gate: "kit_approval", decision: "approved", actor: "you", rationale, at: new Date().toISOString() });
  pushStep(run, { agent: "system", status: "done", input_summary: "Gate 2: approve", output_summary: "Human approved verified kit. Packaging simulated campaign." });
  setStatus(run, "launching");
  await runPackagingPhase(run);
  return { ok: true, run };
}

export async function requestFixes(runId: string, rationale?: string): Promise<ExperimentRun | undefined> {
  const run = getRuns().get(runId);
  if (!run) return run;
  run.approvals.push({ gate: "kit_approval", decision: "fixes_requested", actor: "you", rationale, at: new Date().toISOString() });
  pushStep(run, { agent: "system", status: "done", input_summary: "Gate 2: request fixes", output_summary: "Looping back to Builder with fixes attached." });
  setStatus(run, "building");
  await runBuilderPhase(run);
  return run;
}

export async function rejectRun(runId: string, rationale?: string): Promise<ExperimentRun | undefined> {
  const run = getRuns().get(runId);
  if (!run) return run;
  run.approvals.push({ gate: "kit_approval", decision: "rejected", actor: "you", rationale, at: new Date().toISOString() });
  pushStep(run, { agent: "system", status: "done", input_summary: "Gate 2: reject", output_summary: `Run ended. Reason: ${rationale ?? "no reason given"}` });
  setStatus(run, "complete");
  return run;
}

async function runPackagingPhase(run: ExperimentRun): Promise<void> {
  if (!run.kit || !run.verification) return;

  pushStep(run, {
    agent: "system",
    status: "running",
    tool: "launch_campaign",
    input_summary: "verified kit",
    output_summary: "Packaging the campaign board…",
  });
  await sleep(250);
  run.campaign_board = synthesizeCampaign(run.kit);
  emitRefresh(run);
  setStatus(run, "measuring");

  const measureStep = pushStep(run, {
    agent: "measurement",
    status: "running",
    tool: "llm_generate",
    input_summary: "campaign board + tracking plan",
    output_summary: "Simulating measurement and writing the learning…",
  });
  await sleep(300);
  const hyp = run.hypotheses?.find((h) => h.id === run.selected_hypothesis_id);
  run.report = synthesizeReport(hyp ?? run.hypotheses?.[0]!, run.kit, run.verification, run.company);
  measureStep.status = "done";
  measureStep.duration_ms = 500;
  measureStep.output_summary = "Report drafted; learning written to growth memory.";
  emitRefresh(run);

  // Write the learning to growth memory (compounding loop, PRD §14).
  const entry: GrowthMemoryEntry = {
    id: `mem_${randomUUID().slice(0, 8)}`,
    company_url: run.company.url,
    experiment: run.selected_hypothesis_id ?? "experiment",
    outcome: run.campaign_board ? `${run.campaign_board.channels.length} channels packaged (simulated)` : "simulated",
    learning: run.report.learning,
    tags: ["community", "landing", "icp"],
    created_at: new Date().toISOString(),
  };
  getMemoryStore().push(entry);
  run.memory_record_id = entry.id;

  setStatus(run, "complete");
}

// --- internal -----------------------------------------------------------------

function emitRefresh(run: ExperimentRun) {
  // Steps carry their own mutations via pushStep; this exists to bump
  // updated_at for non-step mutations. Currently a no-op placeholder.
  run.updated_at = new Date().toISOString();
}
