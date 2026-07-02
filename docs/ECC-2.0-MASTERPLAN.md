# Kodelyth ECC 2.0 — Masterplan ("Massive Explosion")

Status: DRAFT for phased execution
Owner: Kodelyth (github.com/sifxprime)
Current baseline: v1.8.4
Target: v2.0.0 — Kodelyth Elite Code Crew

---

## 0. Reading this document

This is the single source of truth for the 2.0 rebuild. Each phase is independently shippable,
has explicit acceptance criteria, and lists the exact files it touches. We execute **phase by
phase** — nothing in a later phase blocks shipping an earlier one.

Two hard rules that override everything:

1. **Every feature must actually work end-to-end after install, with zero manual wiring.**
   If a thing needs a slash command to activate, it is not done.
2. **No fake data, anywhere.** Every number on the dashboard traces to a real measured event
   with a source file. If we cannot measure it truthfully, we do not display it.

### Licensing reality (read once, then it's handled)

The reference projects (`affaan-m/ecc`, `rtk-ai/rtk`, `juliusbrussee/caveman`,
`DeusData/codebase-memory-mcp`) are MIT. MIT allows reuse **and** requires the copyright
notice be preserved. Our approach:

- We **re-implement the ideas/mechanisms** in our own code and style — we do not vendor their
  source verbatim.
- Where we do adapt any file, its MIT notice goes into `THIRD-PARTY-NOTICES.md` (not surfaced in
  product UI, but legally present in the repo). This is non-negotiable and costs us nothing.
- Product-facing copy never claims or references the origins. Engineering hygiene stays in the repo.

---

## 1. The core idea — "the path that saves": Kodelyth Context Fabric

The user's central intuition ("when ECC is installed it makes a path... that path saves whenever
Claude or any agent passes through... then it easily understands and can trigger intent routing")
becomes a concrete architecture we call the **Context Fabric**.

Two persistent layers, auto-populated by hooks, read by every agent on every turn:

```
~/.kodelyth/                      GLOBAL BRAIN (cross-project, one per machine)
├── memory/
│   ├── memories.jsonl            append-only episodic memory
│   ├── index.sqlite              BM25 + FTS index (replaces drifting index.json)
│   └── embeddings.bin            optional local vectors (Phase 4)
├── instincts/                    continuous-learning rules with confidence + decay
├── savings/
│   └── ledger.jsonl              every measured token saving (RTK + compression + cache)
├── telemetry/
│   └── events.jsonl              real session/agent/tool events (dashboard source of truth)
├── graph-cache/                  per-project knowledge-graph snapshots (from indexer)
└── config.json                   IDE targets, MCP registry, feature flags

<project>/.kodelyth/              PROJECT SPINE (one per repo, git-ignored by default)
├── graph.db                      codebase knowledge graph (auto-indexed)
├── graph.manifest.json           file hashes → incremental re-index
├── lessons.md                    project rules (existing tasks/lessons.md, promoted here)
├── intent-cache.json             recent routing decisions for this repo
├── session-log.jsonl             what agents did in this repo, when
└── project.json                  detected stack, entry points, conventions
```

The Fabric is the product. Agents, skills, memory, routing, savings — all read and write here.
This is what makes ECC feel like "a teammate who has been here for years" instead of a prompt pack.

---

## 2. Honest gap analysis (grounded in the current code)

| Area | Today (v1.8.4) | Gap → 2.0 |
|---|---|---|
| Memory store | Real BM25 in `store.js`, separate `index.json` | Index drifts from log; move to SQLite FTS5; add outcome-weighted ranking |
| Memory capture | Hook `capture-stop.js` rarely produces good memories | Deterministic extraction + confirmation UX + auto-capture on success signals |
| Continuous learning | `instincts.js` + `evolve/` proposals, manual accept | Confidence + decay + auto-promotion; wired to recall ranking |
| Codebase graph | External `codebase-memory-mcp`, manual `index_repository` | Bundle our own indexer; auto-index on SessionStart; graph feeds recall + routing |
| Intent routing | Rules doc + `router/classify.js` (advisory only) | Real dispatcher: classify → auto-invoke agent (with transparency line) |
| Token savings | Not tracked at all | RTK-style measured savings + compression; real ledger; dashboard panel |
| Dashboard | Reads real JSONL, but shows unmeasured "savings" | Every panel backed by `telemetry/` + `savings/`; remove all invented numbers |
| CLI | install / mcp / route / swarm / dashboard / evolve | Add interactive menu, `update` + auto-check, IDE re-select, MCP doctor |
| Install (Windows) | Just fixed encoding/color | Harden: idempotent, MCP auto-register, post-install self-test |
| Skills/agents | 194 skills / 70 agents, uneven quality | Tiered polish pass; kill bloat; "Fable-5 level" flagship skills |
| Auto-activation | Most features need a slash command | Everything core runs from hooks; slash commands become optional shortcuts |

---

## 3. Target architecture (2.0)

```
Kodelyth ECC 2.0
├── Context Fabric (Section 1)            ← the spine everything reads
├── Memory Engine v2 (SQLite FTS + outcome ranking + optional vectors)
├── Learning Engine (instincts w/ confidence, decay, auto-promotion)
├── Codebase Graph (bundled indexer, auto-index, graph-augmented recall)
├── Intent Dispatcher (classify → auto-invoke, transparent)
├── Token Economy (RTK proxy + context compression + cache accounting + ledger)
├── Dashboard v2 (100% real data, savings panel, memory/graph viz)
├── CLI v2 (interactive menu, update, IDE, MCP doctor, self-test)
├── MCP Server v2 (auto-connect, exposes Fabric to any client)
└── Install v2 (idempotent, cross-platform, MCP auto-register, self-test)
```

---

## 4. Phased plan

Each phase: **Goal → Work items → Files → Acceptance criteria.**

### Phase 0 — Foundation & cleanup (1 sprint) — SHIP FIRST

Goal: production-grade base. Remove bloat, lock the Fabric layout, add telemetry spine so every
later phase writes real events from day one.

Work items:
- Remove `scripts/openclaw-twitter/` from the package entirely (already .npmignored; now delete
  the leaked browser session from the tree + git history, rotate the Twitter creds).
- Introduce `scripts/lib/fabric.js` — one module that owns all Fabric paths (global + project),
  ensures dirs, and is the ONLY place paths are defined.
- Introduce `scripts/lib/telemetry.js` — append-only event writer to `~/.kodelyth/telemetry/events.jsonl`
  with a stable event schema `{ ts, kind, project, agent?, tool?, tokens_in?, tokens_out?, meta }`.
- Wire telemetry into existing hooks (SessionStart, UserPromptSubmit, PostToolUse, Stop) — non-blocking, <5ms.
- Delete or quarantine dead scripts; run `refactor-cleaner` + `knip` pass across `scripts/`.

Files: `scripts/lib/fabric.js` (new), `scripts/lib/telemetry.js` (new), `hooks/**`, `.npmignore`,
`THIRD-PARTY-NOTICES.md` (new).

Acceptance:
- Fresh install creates `~/.kodelyth/` with the Section-1 layout.
- After one real session, `events.jsonl` has ≥1 truthful event per hook fire.
- `npm test` green; package tarball has zero non-ECC files; no secrets in tree or history.

---

### Phase 1 — Memory Engine v2 (fix "BM25 doesn't work") (1–2 sprints)

Goal: memory that reliably captures, never drifts, and ranks by what actually worked.

Work items:
- Replace `index.json` with **SQLite FTS5** (`~/.kodelyth/memory/index.sqlite`). Node has no
  built-in sqlite pre-22; use `node:sqlite` when available, else a zero-dep pure-JS FTS fallback
  we already have the BM25 math for. Keep `memories.jsonl` as the durable log; index is derived
  and rebuildable in one command.
- **Deterministic capture**: rewrite `capture-stop.js` to extract on explicit success signals
  ("that worked", "fixed", "thanks", tests going green, a commit) — not vibes. Show the drafted
  memory; auto-store on confirmed-success, queue on ambiguous.
- **Outcome-weighted ranking**: recall score = BM25 × recency-decay × outcome-boost
  (memories that resolved successfully rank higher; failed approaches sink).
- **Self-heal**: on load, if `index.sqlite` doc count ≠ `memories.jsonl` live count, auto-rebuild.
- Graph link (Phase 3): recall can pull symbols/files from the project graph to enrich a hit.

Files: `scripts/memory/store.js` (rewrite index layer), `scripts/memory/capture-stop.js`,
`scripts/memory/inject.js`, `scripts/memory/rank.js` (new), `hooks/memory/*`.

Acceptance:
- Capture a fix → new session → the fix is recalled for a related prompt, with a visible source id.
- Corrupt/delete the index → next run rebuilds it automatically; recall still correct.
- Failed approaches demonstrably rank below successful ones for the same query.
- Dashboard "memories" panel counts match `memories.jsonl` exactly (no drift).

---

### Phase 2 — Auto-activation: Intent Dispatcher + auto-index (1–2 sprints)

Goal: users never need slash commands for core value. The system routes and indexes by itself.

Work items:
- **Auto-index on SessionStart**: if `<project>/.kodelyth/graph.db` is missing or stale (manifest
  hash mismatch), kick a background incremental index (bounded, non-blocking). This is the
  behavior we just did manually with `index_repository`, made automatic.
- **Intent Dispatcher**: promote `router/classify.js` from advisory to actionable. On
  UserPromptSubmit, classify intent → if confidence high, inject a directive that makes the model
  behave as the routed agent (the transparency line stays: `→ Routing to X`). Log every decision
  to `intent-cache.json` + telemetry (this also feeds `evolve` routing-miss learning with real data).
- **Confidence threshold + fallback**: low confidence → suggest, don't force. Never hijack an
  explicit `use <agent>`.

Files: `scripts/router/classify.js`, `scripts/router/dispatch.js` (new),
`hooks/memory/auto-recall.js` (extend), `hooks/routing/*` (new), `scripts/indexer/*` (Phase 3 dep).

Acceptance:
- Open a fresh repo, type "this button is broken" → routed to `debug-detective` automatically with
  the transparency line, no slash command.
- Second session in an already-indexed repo starts instantly (incremental, cache hit).
- Every routing decision appears in telemetry; `evolve stats` shows real routing-miss clusters.

---

### Phase 3 — Codebase Graph, bundled (grab from codebase-memory-mcp idea) (2 sprints)

Goal: ECC ships its own auto-indexer so the graph is a first-class Fabric citizen, not an external MCP.

Work items:
- Build `scripts/indexer/` — AST-based (tree-sitter / language parsers) → nodes (functions,
  classes, routes, components) + edges (calls, imports, data-flow). Persist to
  `<project>/.kodelyth/graph.db` with an incremental manifest (only re-parse changed files by hash).
- Expose graph queries through the MCP server v2 (`search_graph`, `trace_path`, `get_architecture`,
  `get_code_snippet`) so external clients get it too — same ergonomics we used this session.
- **Graph-augmented recall**: memory hits and intent routing consult the graph (e.g. "who calls
  this" enriches a debug route).
- **Dashboard graph viz** (Phase 6): render the graph the user liked from codebase-memory-mcp.

Files: `scripts/indexer/index.js`, `scripts/indexer/parse/*`, `scripts/indexer/graph-store.js`,
`scripts/mcp/server.js` (add graph tools), `scripts/lib/fabric.js` (graph paths).

Acceptance:
- `kodelyth-ecc index` (and auto-index) builds `graph.db`; re-run after editing 1 file re-parses
  only that file.
- MCP `search_graph`/`trace_path` return correct results on this very repo.
- Deleting `graph.db` and reopening the project silently rebuilds it.

---

### Phase 4 — Token Economy (grab from RTK + caveman, measured savings) (2 sprints)

Goal: real, user-visible token savings. Not a claim — a ledger.

Work items:
- **RTK-style command proxy**: `scripts/token/proxy.js` wraps noisy dev commands (git status,
  ls -R, test output, grep) and returns token-lean output. Every call records
  `{ raw_tokens, lean_tokens, saved }` to `~/.kodelyth/savings/ledger.jsonl`. (Our global RTK.md
  already assumes this UX — we make it real and measured, Node-native, no Rust dep required.)
- **Context compression (caveman idea)**: `scripts/token/compress.js` — deterministic compaction
  of large pasted context / file dumps before they hit the model (dedupe, strip boilerplate,
  summarize repetitive blocks), with measured before/after token counts logged.
- **Cache accounting**: measure prompt-cache hits from the stable memory prefix (`inject.js`
  already builds a cache-friendly block) and log the discounted tokens as savings.
- **Truthful tokenizer**: one shared `scripts/token/count.js` (tiktoken-compatible heuristic or
  bundled tokenizer) so every "tokens" number in the product uses the same counter.

Files: `scripts/token/{proxy,compress,count,ledger}.js` (new), `hooks/token/*` (new),
`rules/cost-aware-model-routing.md` (link the real ledger).

Acceptance:
- Run a wrapped command → a real row appears in `savings/ledger.jsonl` with raw/lean/saved.
- Dashboard "Token Saved" panel sums the ledger and matches a hand recount for a sample day.
- Turn the proxy off → savings stop accruing (proves it's measured, not fabricated).

---

### Phase 5 — Learning Engine (continuous, autonomous) (1–2 sprints)

Goal: ECC gets better per session without the user babysitting proposals.

Work items:
- Upgrade `instincts.js`: each instinct carries `confidence`, `support` (evidence count),
  `last_seen`, and **decay** (unused instincts fade). Successful reuse boosts; contradiction
  demotes.
- **Auto-promotion**: instinct crossing a confidence+support threshold auto-promotes into either
  a project lesson (`.kodelyth/lessons.md`) or a memory, with an audit trail. High-risk categories
  (security, deletes) still require confirmation.
- Feed the Learning Engine from real telemetry + memory outcomes (Phase 0/1), not heuristics.
- Keep `evolve` CLI as the human review surface for anything below auto-promote threshold.

Files: `scripts/memory/instincts.js`, `scripts/evolve/{analyze,proposals,stats}.js`,
`scripts/learn/promote.js` (new).

Acceptance:
- Correct the AI 3× on the same thing → an instinct forms → by the next session it's applied
  automatically (visible in the injected context, with provenance).
- Unused instincts measurably decay in confidence over time.
- No auto-promotion ever happens for security/destructive categories without confirmation.

---

### Phase 6 — Dashboard v2 (100% real data) (1–2 sprints)

Goal: a dashboard the user trusts because every pixel is backed by a file.

Work items:
- Re-point every panel at `telemetry/events.jsonl` + `savings/ledger.jsonl` + `memories.jsonl` +
  graph. Delete any panel we cannot back with real data (or label it "not yet measured").
- New panels: **Token Saved** (from ledger, with on/off proof), **Memory** (count, recall hit-rate,
  top reused), **Graph** (interactive codebase graph viz — the one the user liked), **Routing**
  (real intent decisions + misses), **Learning** (instinct confidence over time).
- "Last updated" timestamps on every panel sourced from the underlying file mtime — so stale data
  is visibly stale, never silently wrong.

Files: `scripts/dashboard/{server,data}.js`, `scripts/dashboard/static/*`.

Acceptance:
- Every number on the dashboard is reproducible from a file via a documented query.
- Generate a real session → refresh → panels update with that session's real events.
- No `Math.random`, no seeded/sample/placeholder data anywhere in `dashboard/`.

---

### Phase 7 — CLI v2 + Install v2 + MCP auto-connect (1–2 sprints)

Goal: `kodelyth-ecc` is a proper product entrypoint. Install "just works" on every OS.

Work items:
- **Interactive menu** when run with no args (TTY): Update check (npm latest vs installed) →
  Open dashboard → Install/re-target another IDE agent → MCP doctor (connect/verify) →
  Memory/graph status → Docs. Non-TTY keeps current scriptable behavior.
- **`kodelyth-ecc update`** + **auto-check**: on launch, compare installed vs npm `latest`
  (cached, throttled, offline-safe); one-liner to update.
- **IDE re-selection**: pick another target (Claude/Cursor/Windsurf/Codex/…) post-install without
  reinstalling from scratch.
- **MCP doctor / auto-connect**: register the ECC MCP server into the selected client's config
  automatically, then verify the handshake and print a green/red status. This is the "MCP always
  connects" requirement made real.
- **Install v2**: idempotent (safe re-run), post-install **self-test** (`kodelyth-ecc doctor`)
  that checks Fabric dirs, hooks wiring, MCP handshake, memory read/write, indexer smoke test.
  Windows path/encoding hardening baked in (continues the 1.8.2–1.8.4 fixes).

Files: `bin/kodelyth-ecc.js` (menu + update + ide + mcp doctor), `scripts/cli/*` (new),
`install.sh`, `install.ps1`, `scripts/doctor.js`, `scripts/mcp/register.js` (new).

Acceptance:
- Fresh Windows + Mac install → `kodelyth-ecc doctor` all green, no manual steps.
- `kodelyth-ecc` (no args) shows the menu; update-check reflects real npm latest.
- After install, the MCP server shows connected in the chosen client without hand-editing config.

---

### Phase 8 — Skills & Agents polish ("Fable-5 level, not cheap AI") (rolling, 2–3 sprints)

Goal: output that reads as senior-engineer craft, not template AI. Kill bloat.

Work items:
- **Tiering**: audit all 194 skills / 70 agents. Tag each DAILY (keep, polish hard) vs LIBRARY
  (keep lean) vs CUT (remove). Use the existing `agent-sort` / `skill-stocktake` skills for evidence.
- **Flagship polish**: rewrite the top ~25 daily skills to production depth — real patterns, real
  code, no filler, no emoji, strong structure (matches the user's global no-emoji / craft rules).
- **Agent reliability**: ensure every agent works when auto-invoked by the dispatcher (Phase 2),
  not just via slash command. Standard handoff chains verified end-to-end.
- **Frontend/design skills**: elevate `frontend-design` / `design-quality` so generated UIs don't
  "look like AII did it" — enforce the anti-template policy already in the user's web rules.
- Remove non-production scaffolding, dead commands, and duplicated guidance across skills.

Files: `skills/**`, `agents/**`, `commands/**`, `rules/**` (routing table updates).

Acceptance:
- A blind review of 10 random flagship skills reads as production docs (no filler, no emoji, real depth).
- Every agent referenced by the dispatcher auto-invokes and completes on a smoke task.
- Skill/agent count reflects deliberate curation, with a documented DAILY/LIBRARY/CUT ledger.

---

## 5. Cross-cutting requirements (apply to every phase)

- **Zero manual wiring**: if it needs a slash command to work, it isn't done.
- **No fake data**: every displayed metric maps to a source file + query.
- **Non-blocking hooks**: <5ms budget, `async` where possible, never add latency.
- **Offline-first & local**: nothing phones home; Fabric is local by design (keep the honest-
  disclosure behavior from `memory-protocol.md`).
- **Cross-platform**: Windows/Mac/Linux parity, tested each phase (Windows is the historical weak spot).
- **Tests**: keep `npm test` green; add tests per phase (target ≥80% on new modules).

## 6. Suggested execution order & versioning

- v1.9.0 — Phase 0 (foundation, cleanup, telemetry) + Phase 1 (memory fix)
- v1.9.x — Phase 2 (auto-routing + auto-index) + Phase 3 (bundled graph)
- v1.9.x — Phase 4 (token economy) + Phase 6 (dashboard real data)
- v1.9.x — Phase 5 (learning) + Phase 7 (CLI/install/MCP)
- v2.0.0 — Phase 8 polish complete; flagship launch.

Phases 0→1 are the unlock (they make everything measurable and the memory real). Do them first.

## 7. Open questions to confirm before we start Phase 0

1. SQLite dependency: OK to require Node 22+ `node:sqlite`, or keep pure-JS fallback for Node 18? (affects Phase 1)
2. Token proxy scope: wrap only read-only dev commands (git/ls/grep/test) — confirm no write commands are ever proxied.
3. Vectors in memory (Phase 4 optional): local-only embeddings acceptable, or keep it keyword+graph and skip vectors for 2.0?
4. `.kodelyth/` in each repo: git-ignored by default (recommended), or committed for team sharing as an opt-in?
5. Windows: do we drop Windows PowerShell 5.1 support and require PowerShell 7+ (kills the encoding class of bugs entirely)?
```
