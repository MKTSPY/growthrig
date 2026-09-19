# GrowthRig

A self-serve growth experiment OS: turn a company goal into a verified,
measurable growth experiment, run by agents and governed by humans. Built
for the Agentic Day "Build Something Real" hackathon (Agentic Marketing
track) — see `GrowthRig-PRD.md` for the full spec this scaffold implements.

This repo is the **harness** — the app shell, screens, data model and mock
API described below — with two mandatory human approval gates wired for
real and a working state machine behind them. The seams where real Claude
agent calls replace the stubs are marked `TODO(agents)` throughout
`src/lib/store.ts` and `src/app/api/**`.

## Design provenance

This UI deliberately reuses the shell mechanics of the internal **Nexus**
control center (`~/hermes-nexus`) — same two-panel app shell (rounded white
sidebar + rounded white main panel floating on a `#F4F4F4` page), same
`eyebrow → serif italic-accent title → filter chips → rounded content-card`
page pattern, same `⌘K` command bar in the app bar, same collapsible
sidebar / mobile bottom-sheet nav, same Inter + Newsreader type pairing,
same "ink and slate carry the interface, the accent is reserved for the
brand and live status" rule.

What's different is everything Nexus-specific: the nav vocabulary (this is
an experiment pipeline, not a fleet-ops console), the accent color (a teal
"Signal" theme instead of Nexus's blue, with a warm "Ember" alternate in
place of Nexus's Lilac), the logo mark (an upward growth-bar glyph instead
of the Nexus hub emblem), and obviously all the screens and data.

Tokens live in `src/styles/globals.css`. A few color values were darkened
from a first pass to clear WCAG AA contrast (4.5:1) for text use — see the
comments on `--slate`, `--accent`, `--caution` and `--ok` there; Nexus's own
`--slate` (`#919191`) reads at 3.15:1 on white, which is why this scaffold
doesn't copy it byte-for-byte.

## Running it

```bash
npm install
npm run dev       # http://localhost:3000
```

```bash
npm run typecheck # tsc --noEmit
npm run build      # production build (verified clean)
```

No environment variables or external services are required to run the
scaffold — it renders entirely from the seed fixtures in `src/lib/seed.ts`.

## What's real vs. stubbed

Same split the PRD specifies (§18): the **state machine, both approval
gates, and the UI are real** — clicking "Approve this bet" or "Approve &
simulate launch" actually calls a route handler, actually mutates the run,
actually blocks a failing kit from being approved. The **agents themselves
are stubbed** — `src/lib/seed.ts` holds pre-warmed research/hypotheses/kit
output standing in for a live Research → Opportunity → Experiment →
Builder → Verifier → Measurement chain.

| Piece | Status |
|---|---|
| App shell, nav, all 10 screens | Real |
| Run state machine (`src/lib/store.ts`) | Real — same states/transitions as PRD §8 |
| Gate 1 / Gate 2 (approve, request fixes, reject) | Real — mutates the run, recorded in `/logs` |
| Growth memory read/write | Real (in-memory store) |
| SSE step stream (`/api/runs/[id]/events`) | Real transport, replays seeded steps |
| Research / Opportunity / Experiment / Builder / Verifier / Measurement agents | **Stubbed** — seeded fixtures, see below |
| Campaign launch | Simulated only, per PRD §18/§20 — no live posting anywhere in this codebase |

## Wiring in real agents

Everything needed to keep this from being a demo toy lives in
`src/types/growthrig.ts` (the exact data shapes from PRD §10) and
`src/lib/store.ts` (the orchestrator seam). To wire in Claude:

1. Replace the body of `createRun()` in `src/lib/store.ts` with real calls
   to the Research → Opportunity → Experiment agent chain (PRD §11),
   pushing an `AgentStepEvent` via `pushStep()` after each tool call so the
   SSE stream and the `/runs/[id]` pipeline view light up live instead of
   replaying history.
2. After `selectHypothesis()` succeeds, call the Builder agent for real
   instead of relying on the kit already attached to the seeded run.
3. Before `approveKit()` can succeed, run the Verifier agent for real and
   populate `run.verification` — the UI already blocks the approve button
   whenever `verification.overall !== "pass"` (see `KitGate`), so a real
   verifier slots in without any UI change.
4. Swap the in-memory `Map`/array in `store.ts` for the SQLite/Postgres
   store described in PRD §10/§16 once this needs to survive more than one
   Node process — the current store is intentionally a single hackathon
   demo process.
5. `src/app/api/companies/memory/[...url]/route.ts` and the memory helpers
   in `store.ts` are the seam for a durable, cross-run growth memory.

The seeded bad-kit fixture (`run_bad_kit_demo` in `src/lib/seed.ts`) is
there specifically for the PRD's live safety-net beat (§13/§21/§26): open
`/runs/run_bad_kit_demo/kit` to see the Verifier catch an uncited,
hype-violating claim and block the approve button.

## Deployment

Deploys as a standard Next.js app (Node runtime — the SSE route and gate
mutations need server-side state, so this isn't a static export) — point
Mel at `npm run build && npm run start`, respecting `PORT`.

## Known trade-offs (hackathon scope)

- The run store is in-memory and resets on server restart — intentional
  per PRD §5's MVP scope; not for concurrent multi-instance deploys.
- Sidebar nav rows are 32px tall to match the reference density; that's
  below the 44px touch-target guideline and is a deliberate density
  trade-off for a desktop-first internal tool, same as the system it's
  modeled on.
- No auth — single demo session only, per PRD §5.

## Voice Operations

The Voice tab runs in browser-local preview mode by default. Durable outbound calling is feature-gated and requires Supabase, ElevenLabs credentials, an imported ElevenLabs phone-number ID, and a recorded consent flow. See [docs/VOICE_OPERATIONS.md](docs/VOICE_OPERATIONS.md) for setup, test-call, privacy, and rollback procedures.
