// Types mirror the ExperimentRun / GrowthMemoryEntry schemas in the
// GrowthRig PRD (§10 Data Model) 1:1, so the run/orchestrator layer can be
// wired straight into these shapes without a translation step.

export type RunStatus =
  | "onboarded"
  | "researching"
  | "opportunity"
  | "hypothesizing"
  | "awaiting_hypothesis_choice"
  | "building"
  | "verifying"
  | "awaiting_kit_approval"
  | "launching"
  | "measuring"
  | "learning"
  | "complete";

export interface BrandVoice {
  tone: string;
  do: string[];
  dont: string[];
}

export interface Company {
  name: string;
  url: string;
  icp: string;
  goal: string;
  brand_voice: BrandVoice;
}

export interface Competitor {
  name: string;
  url: string;
  notes: string;
}

export interface DemandSurface {
  surface: string;
  url: string;
  signal: string;
  source_url: string;
}

// ---------------------------------------------------------------------------
// Reddit types (PRD §10 — kept pure; no adapter import).
// Shape is structurally compatible with RedditItem in adapters/reddit.ts.
// ---------------------------------------------------------------------------

export interface RedditItem {
  id: string;
  title: string;
  /** Post selftext (body), or "" for link-only posts. */
  body: string;
  subreddit: string;
  upvotes: number;
  permalink: string;
  created_utc: number;
}

export interface RedditSource {
  items: RedditItem[];
  query: string;
  fetched_at: string;
}

export interface Research {
  company_brief: string;
  competitors: Competitor[];
  audience_signals: string[];
  demand_surfaces: DemandSurface[];
  citations: string[];
  /** Reddit posts fetched to ground community reply and verifier citations. */
  reddit?: RedditSource;
}

export interface Opportunity {
  id: string;
  surface: string;
  why: string;
  source_url: string;
}

export interface IceScore {
  impact: number; // 1-10
  confidence: number; // 1-10
  ease: number; // 1-10
  score: number; // average
}

export interface PredictedMetric {
  name: string;
  target: number;
  baseline: number;
}

export interface Hypothesis {
  id: string;
  statement: string;
  channel: string;
  predicted_metric: PredictedMetric;
  ice: IceScore;
  rationale: string;
}

export interface OutreachMessage {
  channel: "email" | "linkedin";
  subject: string;
  body: string;
}

export interface CommunityReply {
  platform: string;
  draft: string;
  value_add: string;
}

export interface GeoContent {
  question: string;
  answer_snippet: string;
  target_models: string[];
}

export interface TrackingPlanItem {
  metric: string;
  method: string;
  threshold: number;
}

export interface ExperimentKit {
  landing_page: {
    headline: string;
    bullets: string[];
    cta: string;
  };
  outreach: OutreachMessage[];
  community_reply: CommunityReply;
  geo_content: GeoContent;
  tracking_plan: TrackingPlanItem[];
  /** Value-first Reddit reply drafted from real Reddit sources (PRD §25.3). */
  reddit_reply?: {
    content: string;
    /** Permalinks of Reddit posts cited in the reply. */
    citation_ids: string[];
  };
}

export type CheckStatus = "pass" | "fail";

export interface VerificationCheck {
  name:
    | "claims_cited"
    | "brand_voice_fit"
    | "policy_compliance"
    | "cta_clarity"
    | "measurement_readiness"
    | "reddit_citations";
  status: CheckStatus;
  notes: string;
}

export interface Verification {
  checks: VerificationCheck[];
  overall: CheckStatus;
  fixes: string[];
}

export interface CampaignChannel {
  type: "reddit" | "landing" | "email" | "linkedin" | "geo";
  action: string;
  projected_reach?: number;
  projected_replies?: number;
  projected_visitors?: number;
  projected_signups?: number;
}

export interface CampaignBoard {
  status: "ready_to_launch" | "packaging";
  channels: CampaignChannel[];
  simulated: true;
}

export interface GrowthReport {
  hypothesis: string;
  what_was_built: string[];
  predicted_vs_baseline: Record<string, { predicted: number; baseline: number }>;
  confidence: "low" | "medium" | "high";
  learning: string;
}

export interface ApprovalRecord {
  gate: "hypothesis_selection" | "kit_approval";
  decision: "approved" | "rejected" | "fixes_requested";
  actor: string;
  rationale?: string;
  at: string;
}

export interface AgentStepEvent {
  id: string;
  agent: "research" | "opportunity" | "experiment" | "builder" | "verifier" | "measurement" | "system";
  status: "running" | "done" | "error" | "retrying";
  tool?: string;
  input_summary: string;
  output_summary: string;
  duration_ms?: number;
  citations?: string[];
  at: string;
}

export interface ExperimentRun {
  id: string;
  company: Company;
  research?: Research;
  opportunities?: Opportunity[];
  hypotheses?: Hypothesis[];
  selected_hypothesis_id?: string;
  kit?: ExperimentKit;
  verification?: Verification;
  campaign_board?: CampaignBoard;
  report?: GrowthReport;
  approvals: ApprovalRecord[];
  steps: AgentStepEvent[];
  memory_record_id?: string;
  status: RunStatus;
  created_at: string;
  updated_at: string;
  /** First-party click/conversion metrics keyed by event name (W3 analytics). */
  metrics?: Record<string, number>;
}

export interface GrowthMemoryEntry {
  id: string;
  company_url: string;
  experiment: string;
  outcome: string;
  learning: string;
  tags: string[];
  created_at: string;
}
