# GrowthRig — Technical Product Requirements Document

A self-serve growth experiment OS that turns a company goal into verified, measurable growth experiments — run by agents, governed by humans.

Prepared for: Agentic Day "Build Something Real" Hackathon — Agentic Marketing Track
Status: v1.0 — Build-ready spec for Claude / Mel / Hermes

## Table of Contents

1. Idea Validation
2. Product Overview
3. Personas & Target Users
4. Core Use Case & Demo Loop
5. MVP Scope
6. User Stories
7. Agent Architecture
8. Workflow / State Machine
9. Tools & Integrations
10. Data Model
11. Agent Role Definitions & Prompts
12. Human Approval Gates & Oversight
13. Verification & Evaluation System
14. Growth Memory / Knowledge Base
15. Frontend Screens
16. Backend & API Requirements
17. Suggested Tech Stack
18. Demo Constraints: Real vs. Mocked
19. Source-of-Truth Artifacts
20. Security, Privacy & Responsible-AI Considerations
21. Failure Modes & Mitigations
22. Acceptance Criteria
23. Judge-Facing Narrative
24. 1-Day Hackathon Build Plan
25. Implementation Instructions for Claude / Hermes
26. 5-Minute Live Demo Script
27. Sources

## 1. Idea Validation

### 1.1 The Problem

Growth marketing for startups and SMBs is stuck. Teams either (a) hire expensive growth-marketing agencies or fractional growth operators, (b) duct-tape together a stack of point tools (Apollo for prospecting, Instantly/Lemlist for cold email, Jasper/Copy.ai for content, Ahrefs for SEO), or (c) buy a bespoke, high-touch "growth hacking as a service" engagement like Enso, whose public materials do not expose self-serve access, public pricing, a standardized experiment loop, a productized verification layer, or a visible learning-memory layer. None of these give a founder an opinionated, end-to-end, measurable growth experimentation loop — they sell labor or tools, not a system that thinks in hypotheses, executes them across channels, verifies the output, and learns from results.

The core unmet need: turning a business goal into a verified, measurable growth experiment — with the execution, oversight, and learning handled by agents.

### 1.2 Why Now

- Agentic infrastructure has matured. Model orchestration, tool/function calling, and agentic workflow platforms (Clay, Relevance AI, Lindy, Gumloop) have made multi-step, multi-tool agent execution practical in production.
- Growth hacking has gone agentic. Enso (enso.bot) deploys AI agents that growth-hack via LinkedIn, Reddit, Google, Wikipedia, Craigslist, and GitHub — finding demand "where buyers leak attention." This validates demand for agentic growth execution.
- Buyer discovery has shifted to AI. Generative Engine Optimization (GEO) — getting cited inside ChatGPT, Perplexity, Gemini, and Google AI Overviews — is now a recognized discipline.
- Growth experimentation is a proven methodology but rarely productized. The scientific growth loop — ideation → prioritization (ICE/RICE scoring) → execution → analysis → knowledge capture — is well-documented but almost always run manually by growth teams.

### 1.3 Existing Alternatives

| Player | What it does | What it lacks (the gap GrowthRig fills) |
|---|---|---|
| Enso (enso.bot) | Bespoke, forward-deployed growth-hacking-as-a-service. Custom agent specs per company; named operator tunes weekly. Channels: LinkedIn, Reddit, Google, Wikipedia, Craigslist, GitHub. | No self-serve access, no published pricing, and Enso's public materials do not expose a standardized/visible experiment loop, a productized verification layer, or a visible learning-memory layer — each engagement is bespoke and opaque. |
| Clay (clay.com) | Data enrichment + agentic GTM automation; Claygent researches accounts. $3.1B valuation, 10k+ orgs. | Outbound/revenue-ops focused, not full growth marketing. No opinionated growth-experiment methodology; user builds workflows. |
| General agent builders (Relevance AI, Lindy, Gumloop, Zapier Agents) | Blank-canvas workflow builders with marketing templates. | Require the user to design the workflow. No built-in growth-experimentation methodology, verification, or learning loop. |
| Enterprise orchestration (Typeface, Braze, Iterable, Klaviyo) | Campaign management + brand content at scale. | Enterprise-scale campaign delivery, not growth hacking for founders/SMBs. Heavy, expensive, not experiment-first. |
| Cold-outreach tools (Apollo, Instantly, Lemlist) | Contact databases + email/LinkedIn sequencing. | Single channel (outreach). No experiment framework, no content/SEO/GEO, no verification, no learning. |

### 1.4 Differentiated Wedge — Why GrowthRig Beats Enso

- Experiment-first, not campaign-first. Growth is treated as a hypothesis-driven, ICE-scored experiment loop — not "AI writes your content."
- Verification + human oversight baked into every step. Every agent output passes through a verifier agent and a human approval gate before anything ships.
- Multi-channel agentic execution in one harness. Outreach (email/LinkedIn), community (Reddit/LinkedIn responses), landing-page copy, and GEO/LLM-SEO content — coordinated as one experiment.
- A compounding growth memory. Every experiment's measured result is written to a knowledge base that informs the next hypothesis.

One-line positioning: **Enso-grade growth hacking, productized — with a brain.**

### 1.5 Hackathon Viability

The full Enso competitor is not buildable in a day. The winning version is a narrow, real, demoable first successful loop: company goal → research → 3 ICE-scored hypotheses → human picks one → agent builds a complete experiment kit → verifier grades it → human approves → simulated execution → growth experiment report → result written to growth memory → next hypothesis suggested.

### 1.6 Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Live integrations (LinkedIn/Reddit posting) are fragile/ToS-restricted | Execution is simulated/sandboxed into a campaign board, never live-posted. Clearly labeled. |
| LLM hallucinates competitor/audience facts | Research agent cites sources per claim; verifier flags uncited claims. |
| Scope creep into "build all of Enso" | Hard scope cut to one complete experiment loop (§4, §5). |
| Demo latency (long agent chains) | Pre-warm/cached research for the demo company; stream agent steps live to UI. |
| Judges don't grasp the differentiation | Dedicated "experiment loop" visualization + judge-facing narrative (§23). |

## 2. Product Overview

**Name:** GrowthRig
**Tagline:** Turn a goal into a verified growth experiment — run by agents, governed by you.
**Category:** Agentic growth-marketing experiment OS

What it is: A web app where a founder or growth operator enters their company and a growth goal. A team of specialized agents researches the company, its audience, competitors, and the surfaces where buyers "leak attention"; proposes ICE-scored growth-experiment hypotheses; builds a complete experiment kit (copy, outreach, content, tracking plan) for the chosen hypothesis; verifies every artifact against a checklist; and — after human approval — simulates execution and produces a measurable growth-experiment report whose results compound into a growth memory.

What it is not (for MVP): A live multi-channel posting engine, a CRM, a full A/B-testing platform, a content-scheduling tool, or an Enso replacement. It is the experimentation-and-verification layer behind agentic growth.

## 3. Personas & Target Users

- **Primary:** Founder / solo growth operator (seed–Series A). Has a goal (e.g., "get 50 waitlist signups," "book 10 demos," "rank in Perplexity for our category") and no growth team.
- **Secondary:** In-house growth marketer at a small team, drowning in point tools.
- **Tertiary (demo audience):** Hackathon judges — need to see agentic workflow, tool use, verification, oversight, and a live, coherent demo in ~5 minutes.

## 4. Core Use Case & Demo Loop

The MVP implements exactly one end-to-end loop. This is the live demo.

Demo input (pre-filled, editable): Company URL, ICP (one sentence), Growth goal.

Loop:

1. **Onboard** — user confirms/edits company URL, ICP, goal.
2. **Research Agent** reads the company site + 2–3 competitor/audience sources; identifies where the company's buyers "leak attention."
3. **Opportunity Agent** surfaces 3 "demand-leak" surfaces.
4. **Experiment Agent** proposes 3 ICE-scored growth-experiment hypotheses (Impact, Confidence, Ease; each scored 1–10), each mapped to a channel and a predicted metric.
5. **Human approves one hypothesis.**
6. **Builder Agent** produces one complete experiment kit: 1 landing-page section, 3 cold/warm outreach messages, 1 community response draft, 1 GEO/LLM-SEO content snippet, 1 tracking plan.
7. **Verifier Agent** grades the kit: claim accuracy (cited), brand-voice fit, policy/compliance risk, CTA clarity, and measurement readiness. Returns a pass/fail + fix list.
8. **Human approval gate** — user reviews the verified kit and approves.
9. **Execution is simulated** into a "Campaign Board": the kit is packaged as a ready-to-launch campaign with projected reach/reply/conversion estimates, clearly labeled simulated.
10. **Measurement Agent** produces a Growth Experiment Report: hypothesis, what was built, predicted vs. baseline metrics, confidence, and a learning.
11. **Result written to Growth Memory** — surfaces as input to the next suggested hypothesis.
12. System suggests the next experiment informed by memory → the loop visibly compounds.

## 5. MVP Scope

**In scope:** One complete experiment loop for one company; 5 specialized agents (Research, Opportunity, Experiment, Builder, Verifier — Measurement reads from Verifier + Builder outputs); 2 human approval gates; ICE scoring UI + kit rendering; Verifier checklist with pass/fail + fixes; simulated campaign board + report; growth memory (append-only log + surfaced next hypothesis); live agent-step streaming; brand-voice profile captured at onboarding.

**Out of scope:** Live posting to LinkedIn/Reddit/email send; real A/B testing / statistical significance engine; CRM/ad-platform integrations; multi-tenant accounts, billing, auth beyond a single demo session; agent self-improvement beyond the memory loop; full GEO rank-tracking over time.

## 6. User Stories

- **US1 — Onboard:** enter company URL, ICP, growth goal.
- **US2 — Research:** see agents research with cited sources.
- **US3 — See demand leaks:** see the 3 demand-leak surfaces found.
- **US4 — Score hypotheses:** see 3 ICE-scored hypotheses.
- **US5 — Approve hypothesis:** approve one hypothesis.
- **US6 — Get an experiment kit:** receive a complete, ready kit.
- **US7 — Verification:** see the verifier's grade and fixes.
- **US8 — Approve kit:** approve the verified kit.
- **US9 — See simulated launch:** see the campaign board package the kit.
- **US10 — See the report:** receive a growth experiment report.
- **US11 — Compound:** see the system store the learning and suggest a smarter next experiment.

## 7. Agent Architecture

A sequential, stateful pipeline of specialized agents (not one mega-agent): Research → Opportunity → Experiment → [Human Gate 1: pick] → Builder → Verifier → [Human Gate 2: approve] → Measurement → Growth Memory → next hypothesis.

Design principles:

- Each agent is a single-purpose LLM call (or short chain) with a typed output schema (JSON, validated).
- Every factual claim an agent makes must carry a `source_url`. The verifier fails uncited claims.
- Agents do not call external posting APIs. The only live external reads are the Research agent's web tools.
- Each agent emits structured step events (status, tool used, input summary, output summary, duration) for live UI streaming.

## 8. Workflow / State Machine

State is a single `ExperimentRun` record. Transitions:

| State | Trigger | Agent/Actor | Next state |
|---|---|---|---|
| onboarded | User submits URL+ICP+goal | — | researching |
| researching | Start | Research Agent | opportunity |
| opportunity | Research done | Opportunity Agent | hypothesizing |
| hypothesizing | Opportunity done | Experiment Agent | awaiting_hypothesis_choice |
| awaiting_hypothesis_choice | Awaiting user | Human Gate 1 | building |
| building | User picks hypothesis | Builder Agent | verifying |
| verifying | Builder done | Verifier Agent | awaiting_kit_approval |
| awaiting_kit_approval | Awaiting user | Human Gate 2 | (fail → building with fixes; pass → launching) |
| launching | User approves | (simulate) Packaging | measuring |
| measuring | Packaging done | Measurement Agent | learning |
| learning | Measurement done | Growth Memory write | complete |
| complete | — | Suggest next hypothesis | (new ExperimentRun) |

Idempotency: each agent step is re-runnable; re-running replaces only that step's output and downstream artifacts. Pause/resume: the run pauses at every `awaiting_*` state until the human acts.

## 9. Tools & Integrations

### Agent tools (function-calling)

| Tool | Used by | Purpose | Real / Mocked |
|---|---|---|---|
| `fetch_url(url)` | Research | Read company site + competitor pages | Real (web fetch adapter) |
| `web_search(query)` | Research, Opportunity | Find communities, unanswered questions, competitor mentions | Real (web search adapter) |
| `extract_brand_voice(url)` | Research | Derive tone/style guide from company site | Real (LLM over fetched homepage/about) |
| `llm_generate(prompt, schema)` | all agents | Structured generation | Real |
| `score_ice(idea)` | Experiment | ICE scoring (LLM-graded, with rubric) | Real |
| `verify_artifact(artifact, checklist)` | Verifier | Grade against checklist | Real |
| `write_memory(record)` | Measurement | Append to growth memory | Real (local store) |
| `read_memory(company_id)` | Experiment | Load prior learnings | Real (local store) |
| `launch_campaign(kit)` | (simulate) | Package kit into campaign board | Mocked (no external send) |

### External integrations (all mocked/simulated in MVP)

LinkedIn, Reddit, email (Instantly/Resend), ad platforms, CRM. Represented as simulated channels on the campaign board with projected metrics. Architecture leaves clear seams (interface adapters) so a real integration can drop in post-hackathon.

## 10. Data Model

Core entities (store as JSON; SQLite or Postgres if a DB is desired). See `src/types/growthrig.ts` in this repo for the TypeScript mirror of this schema.

```json
// ExperimentRun (the central state record)
{
  "id": "run_01",
  "company": {
    "name": "...", "url": "https://...", "icp": "...",
    "goal": "50 demo signups in 14 days",
    "brand_voice": { "tone": "...", "do": ["..."], "dont": ["..."] }
  },
  "research": {
    "company_brief": "...",
    "competitors": [{ "name": "...", "url": "...", "notes": "..." }],
    "audience_signals": ["..."],
    "demand_surfaces": [
      { "surface": "r/SaaS", "url": "...", "signal": "users ask for X weekly", "source_url": "..." }
    ],
    "citations": ["https://..."]
  },
  "opportunities": [{ "id": "opp_1", "surface": "...", "why": "...", "source_url": "..." }],
  "hypotheses": [
    {
      "id": "hyp_1",
      "statement": "If we post a value-first reply in r/SaaS + a matching landing page, we will convert 3% to signups.",
      "channel": "reddit+landing",
      "predicted_metric": { "name": "signups", "target": 50, "baseline": 0 },
      "ice": { "impact": 8, "confidence": 6, "ease": 7, "score": 7.0 },
      "rationale": "..."
    }
  ],
  "selected_hypothesis_id": "hyp_1",
  "kit": {
    "landing_page": { "headline": "...", "bullets": ["..."], "cta": "..." },
    "outreach": [{ "channel": "email", "subject": "...", "body": "..." }],
    "community_reply": { "platform": "reddit", "draft": "...", "value_add": "..." },
    "geo_content": { "question": "...", "answer_snippet": "...", "target_models": ["perplexity", "chatgpt"] },
    "tracking_plan": [{ "metric": "signups", "method": "UTM + form", "threshold": 50 }]
  },
  "verification": {
    "checks": [
      { "name": "claims_cited", "status": "pass", "notes": "all 3 claims have source_url" },
      { "name": "brand_voice_fit", "status": "pass" },
      { "name": "policy_compliance", "status": "pass", "notes": "no spam/deceptive claims" },
      { "name": "cta_clarity", "status": "pass" },
      { "name": "measurement_readiness", "status": "pass" }
    ],
    "overall": "pass",
    "fixes": []
  },
  "campaign_board": {
    "status": "ready_to_launch",
    "channels": [
      { "type": "reddit", "action": "post value-first reply", "projected_reach": 1200, "projected_replies": 8 },
      { "type": "landing", "action": "publish page section", "projected_visitors": 300, "projected_signups": 9 }
    ],
    "simulated": true
  },
  "report": {
    "hypothesis": "...",
    "what_was_built": ["..."],
    "predicted_vs_baseline": { "signups": { "predicted": 9, "baseline": 0 } },
    "confidence": "medium",
    "learning": "Value-first community replies + a dedicated landing page outperform generic outreach for this ICP."
  },
  "memory_record_id": "mem_01",
  "status": "complete",
  "created_at": "...",
  "updated_at": "..."
}
```

```json
// GrowthMemoryEntry (append-only)
{
  "id": "mem_01",
  "company_url": "...",
  "experiment": "reddit+landing value-first reply",
  "outcome": "simulated 9 signups projected",
  "learning": "...",
  "tags": ["community", "landing", "icp-SaaS"],
  "created_at": "..."
}
```

## 11. Agent Role Definitions & Prompts

Each agent: Role, Input, Output (schema), System prompt skeleton, Tools.

**Research Agent** — Understand the company, its buyers, competitors, and where buyers leak attention. Input: company URL, ICP, goal. Output: `research` object. Tools: `fetch_url`, `web_search`, `extract_brand_voice`.

> System prompt skeleton: You are a growth researcher. Given a company URL, ICP, and goal, produce a structured brief. For every factual claim, include a `source_url`. Identify 3 "demand-leak surfaces": specific places where the company's buyers actively seek this category but the company is absent or weak. Prefer surfaces with evidence of real demand. Use `fetch_url` and `web_search`. Never invent sources.

**Opportunity Agent** — Distill research into 3 concrete demand-leak opportunities. Input: `research`. Output: `opportunities[]`.

> System prompt skeleton: You are a growth opportunity analyst. From the research, surface exactly 3 demand-leak opportunities. Each must reference a real surface from the research and explain the leverage. Rank by potential impact.

**Experiment Agent** — Convert opportunities into 3 ICE-scored experiment hypotheses. Input: `opportunities`, `company.goal`, `read_memory(company_id)`. Output: `hypotheses[]`.

> System prompt skeleton: You are a growth experimentation lead. Write experiment hypotheses in the form "If we [action], we will [metric change]." Score each with ICE (1–10 each; score = average). Reference prior learnings from memory where relevant. Each hypothesis must map to one channel and one measurable predicted metric. Be specific and falsifiable.

**Builder Agent** — Produce a complete experiment kit for the chosen hypothesis. Input: selected hypothesis, `company.brand_voice`, `research`. Output: `kit`.

> System prompt skeleton: You are a growth creative builder. For the approved hypothesis, produce a complete, launch-ready experiment kit matching the company's brand voice. The community reply must add genuine value — never spam or astroturf. The GEO content must be the factual, citable answer the company wants AI models to surface. Include a tracking plan with a clear success threshold.

**Verifier Agent** — Grade the kit against a checklist; return pass/fail + fixes. Input: `kit`, `company.brand_voice`, `research.citations`. Output: `verification`. Checklist: `claims_cited`, `brand_voice_fit`, `policy_compliance`, `cta_clarity`, `measurement_readiness`.

> System prompt skeleton: You are a rigorous, skeptical verifier. Grade the experiment kit against 5 checks. Fail any kit with uncited factual claims, off-brand voice, spammy/deceptive content, unclear CTAs, or no measurable success threshold. Return a fix list for any failure. You are the last line of defense before a human approves.

**Measurement Agent** — Produce the growth experiment report and write the learning to memory. Input: `kit`, `campaign_board`, selected hypothesis. Output: `report` + `memory_record_id`.

> System prompt skeleton: You are a growth analyst. Produce a growth experiment report: hypothesis, what was built, predicted vs. baseline metrics, confidence level, and one crisp learning. Write the learning to growth memory. Then suggest the next experiment informed by this learning.

## 12. Human Approval Gates & Oversight

Two mandatory approval gates. The run cannot advance without explicit user action.

- **Gate 1 — Hypothesis selection.** User sees 3 ICE-scored hypotheses and picks one. Rationale shown.
- **Gate 2 — Kit approval.** User sees the verified kit + verifier grade. Can approve, request fixes (loops back to Builder), or reject.

Oversight principles (surfaced in UI): every agent step is visible; every claim is traceable to a source; simulated actions are clearly labeled simulated; user can pause/abort the run at any state.

## 13. Verification & Evaluation System

The Verifier Agent is a first-class component — a primary differentiator and judging criterion.

Verification checklist (5 checks, each pass/fail): claims cited; brand-voice fit; policy/compliance; CTA clarity; measurement readiness.

Behavior: if any check fails, `overall = fail`, a `fixes[]` list is returned, and the run loops back to the Builder with the fixes attached. The verifier's report renders as a visible "Verification Report" card in the UI.

Evaluation (for the team's own quality, demo-time): maintain a tiny eval set of 3 sample companies; run the loop and confirm the verifier catches 1 intentionally-bad kit (e.g., uncited claim) to demonstrate the safety net works live.

## 14. Growth Memory / Knowledge Base

A simple append-only store (SQLite table or JSON file) of `GrowthMemoryEntry` records keyed by `company_url`. On each completed experiment, the Measurement agent writes a learning. On the next run, the Experiment agent reads prior learnings for the company and factors them into the next hypotheses. For the demo, seed memory with 1 prior learning so the "next hypothesis" suggestion is clearly informed by history.

## 15. Frontend Screens

A single-page app, left-to-right "experiment pipeline" view:

1. **Onboard screen** — company URL, ICP, goal inputs (pre-filled for demo). "Start" button.
2. **Pipeline / run view** — vertical timeline of agent steps (agent name, status, tool used, input/output summary, duration, citations). Live-streams as agents run.
3. **Hypotheses screen (Gate 1)** — 3 ICE-scored hypothesis cards with bar visualization of I/C/E; "Select" on each.
4. **Kit screen** — rendered experiment kit + Verification Report card with the 5 checks. "Approve" / "Request fixes" / "Reject".
5. **Campaign board** — simulated launch package: channel cards with projected reach/reply/conversion, labeled Simulated.
6. **Growth experiment report** — hypothesis, what was built, predicted vs. baseline, confidence, learning. "Save learning" + "Suggest next experiment."
7. **Growth memory drawer** — collapsible list of prior learnings for this company.

Design: clean, developer/PM-friendly, dark or light per design system; every simulated element has a visible "SIM" badge; every claim has a clickable source.

## 16. Backend & API Requirements

REST/WebSocket API (or server-sent events) to stream agent step events.

Endpoints:

- `POST /runs` — create a run from onboard inputs → returns `run_id`.
- `GET /runs/{id}` — full run state.
- `GET /runs/{id}/events` (SSE/WS) — live step events.
- `POST /runs/{id}/select-hypothesis` — Gate 1.
- `POST /runs/{id}/approve-kit | /request-fixes | /reject` — Gate 2.
- `GET /companies/{url}/memory` — growth memory.

Agent runner: an orchestrator that executes the state machine, calls each agent (LLM + tools), persists artifacts, and emits events. Retry/idempotency per step.

LLM access: Anthropic Claude (primary) via Mel/Hermes, with structured-output (tool-use) for every agent's JSON schema.

Web research tools: a `web_search`/`fetch_url` adapter — Perplexity/Sonar, Tavily, SerpAPI, or Mel/Hermes-provided web tools can back it. Keep the adapter behind an interface so the backing provider is swappable.

## 17. Suggested Tech Stack

- **Frontend:** Next.js (React) + Tailwind + shadcn/ui. SSE for live streaming.
- **Backend:** Next.js API routes or a small FastAPI/Express service. SQLite for persistence (zero-ops).
- **Agent layer:** Claude (via Mel/Hermes) with structured tool-use outputs; a thin orchestrator implementing the state machine.
- **Web research tools:** a swappable `web_search`/`fetch_url` adapter.
- **Deploy:** Mel (primary, per hackathon) for the app; local dev server for the demo.

Rationale: Next.js + Tailwind + shadcn gives a polished demo UI fastest; SQLite removes DB ops; Claude tool-use gives reliable structured agent outputs; Perplexity gives cited research.

## 18. Demo Constraints: Real vs. Mocked

| Component | Real | Mocked/Simulated | Why |
|---|---|---|---|
| Company/competitor research | ✅ real web fetch + search | — | Shows real tool use; cited. |
| Brand-voice extraction | ✅ real (LLM over fetched site) | — | — |
| ICE scoring | ✅ real (LLM + rubric) | — | — |
| Experiment kit generation | ✅ real (LLM) | — | — |
| Verification | ✅ real (LLM checklist) | — | Core differentiator. |
| Growth memory | ✅ real (local store) | — | Shows compounding. |
| Campaign launch / posting | — | ✅ simulated campaign board | ToS-safe; fragile live APIs. |
| Projected metrics | — | ✅ simulated (labeled) | No real traffic yet. |

Rule: anything that creates value or ensures safety is real; anything that touches external accounts or requires real traffic is simulated and clearly labeled.

## 19. Source-of-Truth Artifacts

1. **Experiment Card** — the selected hypothesis + ICE score + predicted metric. The "bet."
2. **Approval Record** — Gate 1 + Gate 2 decisions, who/when, with rationale. Audit trail.
3. **Verification Report** — the 5-check grade + fixes. The safety net, made visible.
4. **Learning Memory Entry** — the outcome + learning written to growth memory. The compounding brain.

## 20. Security, Privacy & Responsible-AI Considerations

- No live posting — simulated execution only; no spam, no astroturfing, no ToS violations.
- Human-in-the-loop — two mandatory gates; nothing ships without explicit approval.
- Cited claims — verifier rejects uncited factual claims, reducing hallucination risk.
- Brand guardrails — brand-voice profile constrains output tone/structure.
- Policy check — explicit anti-spam/anti-deception check in the verifier.
- Data — company inputs and memory are stored locally for the demo; production would need tenant isolation, encryption, and retention controls (out of MVP scope).
- Transparency — every agent step and every claim is traceable in the UI.

## 21. Failure Modes & Mitigations

| Failure | Mitigation |
|---|---|
| Web fetch blocked / slow | Cached research for the demo company; fallback search snippets. |
| LLM returns malformed JSON | Enforce structured output via tool-use; validate + retry on schema error. |
| Verifier passes a bad kit | Seed eval includes an intentionally-bad kit the verifier must catch (demoed live). |
| Agent loop stalls (no progress) | Per-step timeout + retry; UI shows "retrying." |
| User rejects at Gate 2 | Loop back to Builder with fixes; if rejected outright, run ends with reason logged. |
| Demo latency | Pre-warm research; stream steps; keep the kit scope tight. |

## 22. Acceptance Criteria

The demo is "done" when, live, for a real company input:

- ✅ Research agent returns a cited brief with ≥3 demand-leak surfaces (each with `source_url`).
- ✅ Experiment agent returns 3 hypotheses, each ICE-scored (I/C/E 1–10).
- ✅ User selects one hypothesis (Gate 1) and the system advances.
- ✅ Builder produces a complete kit (landing section + 3 outreach + 1 community reply + 1 GEO snippet + tracking plan).
- ✅ Verifier returns a 5-check report; at least one check is shown failing on a seeded bad kit.
- ✅ User approves the kit (Gate 2).
- ✅ Campaign board packages the kit with simulated, clearly-labeled projected metrics.
- ✅ Growth experiment report is produced with predicted vs. baseline + a learning.
- ✅ Learning is written to growth memory and surfaces in the next-hypothesis suggestion.
- ✅ Every agent step is visible in the UI with tool + citations; every simulated element is labeled.

## 23. Judge-Facing Narrative

| Judging Criterion | How GrowthRig demonstrates it |
|---|---|
| Importance of the problem | Growth marketing is unaffordable/opaque for founders; GrowthRig productizes the missing experiment-and-verification layer. |
| Agentic workflow & tool use | 5 specialized agents in a stateful pipeline, each with typed tools. Visible tool use streamed live. |
| Quality of execution | Polished UI, structured agent outputs, idempotent state machine, cited claims, clean experiment kit. |
| Verification & responsible human oversight | First-class Verifier agent, 2 mandatory human approval gates, simulated-only execution, anti-spam/anti-deception checks, cited claims. |
| Creativity & originality | Experiment-first methodology + verification + compounding growth memory — not another content generator or marketplace. |
| Real-world usefulness | Produces a launch-ready, verified experiment kit + tracking plan a founder could actually run. |
| Quality of the live demonstration | One tight loop, streamed step-by-step, with a visible verifier safety-net demo and a compounding "next experiment" beat. |

On-stage one-liner: "GrowthRig turns a goal into a verified growth experiment — agents research, hypothesize, build, and verify, you approve, and the system learns. Enso-grade growth hacking, productized — with a brain."

## 24. 1-Day Hackathon Build Plan

| Timebox | Work | Owner hint |
|---|---|---|
| 0:00–0:30 | Lock scope. Stub repo: Next.js + Tailwind + shadcn. SQLite. | — |
| 0:30–1:30 | Agent schemas + state machine + orchestrator (stub agents). Wire SSE event stream. | Backend |
| 1:30–2:30 | Research + Opportunity agents with real web tools. Cited outputs. | Backend |
| 2:30–3:15 | Experiment + Builder agents (Claude structured output). ICE scoring. | Backend |
| 3:15–3:45 | Verifier agent + 5-check report; seed a bad-kit eval case. | Backend |
| 3:45–4:15 | Measurement agent + growth memory (read/write) + next-hypothesis suggestion. | Backend |
| 4:15–5:45 | UI: onboard, pipeline timeline, Gate 1 cards, kit + verification report, campaign board, report, memory drawer. | Frontend |
| 5:45–6:15 | Simulated campaign board + projected metrics (labeled SIM). | Frontend |
| 6:15–6:45 | End-to-end dry run on the demo company; fix latency/breaks; pre-warm research. | Both |
| 6:45–7:15 | Live verifier safety-net demo (seeded bad kit); polish UI; citations visible; SIM labels. | Both |
| 7:15–7:45 | Demo rehearsal (5-min flow); prepare judge narrative. | Both |
| 7:45–8:00 | Buffer / submit. | — |

Parallelization tip: one person owns the agent layer + orchestrator; one owns the UI + SSE wiring. They converge on the event contract early.

## 25. Implementation Instructions for Claude / Hermes

1. Build the state machine and event contract first. Implement `ExperimentRun` and the state transitions as the backbone. Stub every agent to return the JSON shapes from §10. Get the SSE event stream working end-to-end with stubs before any real LLM call.
2. Implement agents in this order: Research → Opportunity → Experiment → Builder → Verifier → Measurement. Each agent = one function with a typed JSON-schema output, enforced via Claude tool-use. Never accept free-text where a schema exists.
3. Enforce citations. The Research agent's `demand_surfaces` and any factual claim must include `source_url`. The Verifier's `claims_cited` check fails any kit with an uncited claim. This is non-negotiable.
4. Make the two human gates real. The run must physically pause at `awaiting_hypothesis_choice` and `awaiting_kit_approval` until the user acts. No auto-advance.
5. Simulate execution. The campaign board packages the kit with projected metrics and a visible `simulated: true` flag. Do not implement live posting.
6. Seed the safety-net demo. Include one intentionally-bad kit fixture (uncited claim) and confirm the verifier catches it.
7. Seed growth memory. Pre-write one `GrowthMemoryEntry` for the demo company so the "next hypothesis" suggestion is clearly informed by prior learning.
8. Stream everything. Emit a step event per agent (status, tool, input summary, output summary, duration, citations).
9. Keep scope to §4. Resist building live integrations, multi-tenant auth, billing, or a full A/B engine. Leave clean adapter seams for post-hackathon.

Tech defaults: Next.js + Tailwind + shadcn/ui frontend; Next.js API routes or FastAPI backend; SQLite; Claude via Mel/Hermes with tool-use; a swappable `web_search`/`fetch_url` adapter.

## 26. 5-Minute Live Demo Script

Pre-warm the research for the demo company before going on stage.

Setup (pre-stage): Pre-fill Onboard inputs with the demo company. Pre-warm/cache the Research agent's output. Seed one `GrowthMemoryEntry`. Have the seeded bad-kit fixture ready.

The run (≈5 minutes):

- **0:00 — Onboard (10s).** Show the pre-filled inputs. Hit Start.
- **0:10 — Research streams live (45s).** Steps stream into the pipeline timeline; each demand-leak surface has a clickable `source_url`.
- **0:55 — Opportunity (20s).** 3 demand-leak surfaces appear as cards, cited.
- **1:15 — 3 ICE-scored hypotheses (30s).** Structured, falsifiable bets render with I/C/E bars and predicted metrics.
- **1:45 — HUMAN GATE 1 (15s).** You pick one hypothesis and explain why.
- **2:00 — Builder produces the kit (45s).** Landing section, 3 outreach messages, community reply, GEO snippet, tracking plan.
- **2:45 — Verifier grades the kit (30s).** All 5 checks pass. Toggle the seeded bad kit — `claims_cited` fails and a fix list appears.
- **3:15 — HUMAN GATE 2 (15s).** You approve the verified kit.
- **3:30 — Simulated campaign board (30s).** Channel cards with projected metrics, each labeled SIM.
- **4:00 — Growth experiment report (30s).** Hypothesis, what was built, predicted vs. baseline, confidence, learning.
- **4:30 — Growth memory compounds (30s).** Learning written to memory; next experiment suggested, informed by the seeded prior learning.
- **5:00 — Close.** "GrowthRig turns a goal into a verified growth experiment — agents research, hypothesize, build, and verify, you approve, and the system learns. Enso-grade growth hacking, productized — with a brain."

Demo guardrails: keep the kit scope tight to hold latency; if any live web call is slow, fall back to the cached research; never imply the simulated campaign board is a real launch.

## 27. Sources

- Enso — Growth Hacking using AI agents; AI Agents for Small Businesses; Launch of Guided AI Agents for SMBs (PR Newswire, Jul 2024)
- Clay — Build systems to grow revenue; nrich.io — Clay challenger-brand GTM library
- Growth Method — Best Marketing AI Agent Builders; Intempt — Best AI Agents for Marketing 2026; AI Nexus — Relevance AI vs Lindy vs Gumloop
- Growth100x — Apollo vs Lemlist vs Instantly 2026
- Blueshift — Best AI Marketing Agent Platforms 2026; Typeface — Enterprise Marketing AI / Arc
- Hashmeta — Growth Experimentation Framework; Maciej Turek — Growth Experimentation Playbook 2025
- Search Engine Journal — How to Win at GEO; Wikipedia — Generative Engine Optimization
