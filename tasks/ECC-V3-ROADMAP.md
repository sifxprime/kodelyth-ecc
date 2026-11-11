# Kodelyth ECC — v3.0 Enterprise Upgrade Roadmap

- **Current version:** v2.24.11
- **Target:** v3.0 "Enterprise" (shipped across a 7-release train)
- **Date drafted:** 2026-11-08
- **Status:** DRAFT — awaiting your approval. Nothing below has been built.
- **Scope:** both repos — `kodelyth-ecc` (the npm package) and `ecc-web` (ecc.kodelyth.com).

This plan is grounded in a full read of the actual code, not a wishlist. Every claim about current behavior was verified against source and cites the file. Where a "feature" is dormant, false, or half-wired, it says so plainly — because the single most valuable thing an enterprise audit can do is separate what ECC *claims* from what ECC *does*.

---

## 1. Executive summary

ECC's breadth is real and impressive: 70 agents, 196 skills, 103 commands, 19 rules, 13 install targets, 3 OSes, a token-saving layer, a codebase graph, and a self-learning story. But the research found a consistent pattern underneath the breadth:

> **The surface is wide; the depth is a cliff after Claude Code, and several headline "systems" are wired only halfway.**

The seven highest-leverage truths the audit surfaced:

1. **Five parallel memory stores, two disagreeing project IDs.** BM25 memory, structured instincts, markdown lessons, homunculus instincts, and session summaries all exist separately. Memory keys a project by `sha256(absolute path)`; the observer system keys it by `sha256(git remote)`. Clone or move a repo and its memory silently orphans. This fragmentation is the root cause behind most memory gaps.
2. **The structured instinct engine is write-only.** All the confidence/decay/outcome machinery in `scripts/memory/instincts.js` runs — and is never read into a session. Self-learning is advertised but, for this store, inert.
3. **BM25 memory only grows on an explicit call.** There is no automatic capture on the main path; `capture-stop.js` queues candidates and never stores them. The "compounding memory" promise depends on an action nothing triggers automatically.
4. **Routing is a ~1,100-line markdown rule re-interpreted by the LLM every session** — no telemetry, no eval, no regression test, and two copies that have already diverged (one says 70 agents, the other 61).
5. **MCP and memory are auto-wired for Claude Code only.** Six other MCP-capable IDEs (Cursor, Windsurf, Codex, Gemini, Cline, OpenCode) get agents/skills/rules-as-markdown and nothing that compounds. This is the biggest single parity gap.
6. **Two measurement claims are false or static.** The Terse runtime ledger is never written (`appendTurn` is defined and never called), yet the docs say "every terse-active turn is recorded." The "5,107,394 tokens / 64.1%" RTK headline is hand-authored copy labelled "all real," not a computed number. RTK's actual `gain` mechanism *is* real — but the headline isn't.
7. **The codebase graph is ~5 releases behind upstream.** DeusData's `codebase-memory-mcp` is at v0.12.1 with CBM Lens, docs-in-graph, Smart CI test-selection, cross-repo intelligence, and team-shareable persistence. ECC surfaces none of it and its docs are frozen at the pre-daemon era.

**The strategic thesis:** before adding anything new, *wire and unify what already exists, and make every claim true.* An enterprise buyer's first question is "can I trust the numbers?" — so v2.25 leads with honesty and foundations, not features. New capability (the Super Agent, team backend, Kiro) lands only after the substrate underneath is coherent.

---

## 2. The release train

Each release is independently shippable and keeps the current rapid-patch cadence. The web/SEO/content work (Track 6) runs as a continuous parallel stream against `ecc-web` and does not block the package train.

| Release | Theme | Headline outcomes |
|---|---|---|
| **v2.25** | Honesty & Foundations | Make every measurement true; sync codebase-mcp to v0.12.1 + rewrite its docs; consume the instinct engine; one project-identity hash; RTK collision guard. |
| **v2.26** | Memory Core | Unify the 5 stores onto one substrate; hybrid (semantic + BM25) recall; automatic high-quality capture with secret redaction; structured lessons with conflict resolution. |
| **v2.27** | Routing & Skills | Deterministic routing layer the rule defers to; routing eval in CI; skill retrieval by embeddings + usage weight; single-source-of-truth catalog. |
| **v2.28** | Platform Parity | Per-target MCP writer (unlocks MCP + memory for 6 IDEs); fix Terse/RTK path bugs; reconcile the two target registries; Windows PATH + counts; wire RTK/Terse into direct installers. |
| **v2.29** | Kiro & Reach | Add Kiro (MCP-native first); deepen Antigravity; full Mac/Linux/Windows parity audit; de-static headline numbers into live badges. |
| **v2.30** | Super Agent (beta) | Arena-style orchestrator: decompose → route → dispatch (swarm) → evaluate (GAN) → integrate branches → resumable ledger → cross-run budget. |
| **v3.0** | Enterprise | Opt-in team memory backend (RBAC, provenance, audit); governance/approval on learned artifacts; Smart CI + cross-repo + persistence in the GitHub Action; full web/SEO/content engine; docs overhaul; flagship launch. |

---

## 3. Track 1 — Memory & Intelligence Core

**Owner surface:** `scripts/memory/{store,instincts,extract,inject,cli}.js`, `hooks/memory/*`, `scripts/lib/observer-sessions.js`, `scripts/hooks/session-*.js`, `~/.claude/ecc/state.db`.

### Current state (verified)
- Recall is pure-JS BM25 (k1=1.5, b=0.75) with a well-reasoned *relative* score floor (`store.js:209`). Delivered passively at SessionStart and actively per-prompt (`hooks/memory/auto-recall.js`).
- Five stores run in parallel (BM25 memories, instincts JSONL, markdown lessons, homunculus instincts, session summaries) plus an unused SQLite `state.db`.
- Two project-identity hashes disagree: `store.js:63` (path) vs `observer-sessions.js:54` (git remote).
- Structured instincts are **written but never injected**. `patterns.json` and `projects/<hash>.json` are declared in `PATHS` but never written.
- No automatic BM25 capture; the store grows only on explicit `capture_memory`.
- Project lessons (`tasks/lessons.md`) is the one fully-wired loop, but it is unbounded, unstructured, English-regex-detected, and has no conflict resolution ("use pnpm" then "use bun" both persist as hard rules).

### Target state
One coherent memory substrate, git-remote-keyed, that actually compounds and actually influences sessions — with a clear local-first default and an opt-in team tier.

### Phased work
**P0 (v2.25) — make the dormant live, unify identity**
- Inject high-confidence, non-stale instincts at session start (consume `instincts.list()`). *Low effort, immediately activates dormant self-learning.* — `scripts/hooks/session-start.js`, `scripts/memory/instincts.js`.
- Single project-identity resolver: git-remote-first with path fallback and a stable UUID registry; use it everywhere. — new `scripts/memory/project-id.js`, refactor `store.js:63`, `observer-sessions.js:54`, `read-lessons.js`.
- Remove or implement the declared-but-dead `patterns.json` / `projects/<hash>.json` paths so the code matches reality. — `store.js:29-35`.

**P1 (v2.26) — one substrate, real capture, hybrid recall**
- Collapse the 5 stores onto the existing SQLite `state.db` with one schema (provenance, confidence, outcome, reuse, timestamps). Render markdown lessons as a *view*, not a separate source of truth. — `state-store/*`, `store.js`, `instincts.js`, `read-lessons.js`.
- Hybrid retrieval: local embeddings tier with BM25 as lexical fallback (pluggable provider; zero-network stays the default, not a hard constraint). — `store.js:211-260`.
- Automatic, high-quality capture: async LLM summarizer at session end, gated, writing clean `problem/approach/gotchas`; promote `capture-stop.js`'s queue to the store on an explicit signal. — `scripts/memory/extract.js`, `hooks/memory/capture-stop.js`.
- Secret/PII redaction on the capture path (reuse `secret-hunter` patterns). Semantic dedup/merge with a `supersedes` edge.
- Rank fusion: blend BM25/semantic score with recency decay + `resolved` outcome + reuse count (all already captured, none currently used).

**P2 (v2.26) — structured, self-resolving project memory**
- Move lessons onto the instinct schema (confidence/scope/decay already modelled); detect and supersede conflicting rules; stale lessons prompt for re-confirmation instead of being injected forever. — `hooks/memory/capture-correction.js`, `read-lessons.js`.

**Ships:** instinct-injection + unified ID in **v2.25**; substrate + hybrid + capture in **v2.26**.

---

## 4. Track 2 — Intent Routing & The Super Agent

**Owner surface:** `rules/common/agent-intent-routing.md`, `scripts/router/{signals,classify}.js`, `scripts/mcp/tools.js:53-94`, plus the orchestration primitives (`scripts/swarm/*`, `scripts/arena/arena.js`, `scripts/gan-harness.sh`, `scripts/lib/tmux-worktree-orchestrator.js`, the `blueprint` skill).

### Current state (verified)
- The real router is a ~1,100-line markdown rule the LLM interprets every session: 10 priority tiers, 8 confidence dimensions, sticky routing, compound-intent→parallel-command. The only *code* router (`route_intent`, Jaccard overlap) is a thin fallback for external MCP clients and is **not** what Claude Code uses.
- No routing telemetry, no eval, no regression test. Two copies of the rule have diverged.
- "Routing miss" in `auto-recall.js:155` is actually a *BM25 memory* miss — so `evolve`'s routing proposals rest on the wrong signal.
- Super-agent primitives exist and several are genuinely strong: the `blueprint` DAG decomposer, the tmux+worktree swarm, the GAN planner→generator↔evaluator loop, and the Arena deterministic state machine (`god_build → evil_hunt → evil_verify → round_close`). But **nothing chains them**: the swarm never merges worker branches, blueprint only plans, and there is no resumable run ledger.

### Target state
A deterministic, measurable routing layer the markdown rule defers to — and a single "Super Agent" driver that turns the existing primitives into an autonomous build loop.

### Phased work
**P0 (v2.27) — deterministic, testable routing**
- A code routing layer (embeddings/classifier over the agent catalog + curated signals) that returns a ranked specialist; the markdown rule becomes *override policy* on top, not the whole engine. Cuts per-session token cost and makes routing testable. — `scripts/router/*`, `tools.js:53-94`.
- Generate the routing rule from a single source of truth (the agent catalog) so the two copies can't diverge. — build step + `rules/common/agent-intent-routing.md`.
- Routing eval harness: a labeled prompt→expected-agent corpus scored in CI (build on `eval-harness`/`learn-eval`). Rule edits can't silently regress accuracy.
- Fix the "routing miss" signal: record the agent actually chosen vs. suggested; feed real misses (not memory misses) into `evolve`. — `auto-recall.js:155`, `scripts/evolve/analyze.js:226`.

**P1 (v2.30) — the Super Agent driver**
A top-level autonomous orchestrator built as an **Arena-style state machine** (tokenless control plane, testable) wrapping:
1. **Decompose** the goal with the `blueprint` DAG (reuse as-is).
2. **Route** each step via the new deterministic router (Track 2 P0).
3. **Dispatch** — in-process subagent for small steps; tmux+worktree swarm for parallel isolated steps (reuse `build-plan.js`).
4. **Evaluate** each result with the GAN evaluator against the step's exit criteria (reuse `gan-harness.sh`).
5. **Integrate** — auto-merge/rebase worker branches with conflict detection. **(Build this — it is the missing piece.)** — `scripts/lib/tmux-worktree-orchestrator.js`.
6. **Verify** invariants (tests/build) and **persist** a resumable run ledger to `state.db`. **(Build this.)**
7. **Govern** a shared token/cost budget and policy gates across the whole run — extend `token-budget` from per-session to per-orchestration. **(Build this.)**

Reusable today: blueprint DAG, swarm fan-out, GAN loop, Arena state machine, `orchestration-session.js` observability, memory/lessons context carry-over. Missing: the driver, branch integration, the resumable ledger, cross-run budget, inter-agent state sharing.

**Ships:** routing layer + eval in **v2.27**; Super Agent beta in **v2.30**.

---

## 5. Track 3 — codebase-memory-mcp Sync & Leverage

**Owner surface:** `scripts/codebase/index.js`, `scripts/lib/win-install.js`, `docs/codebase-graph.md`, `rules/common/agent-intent-routing.md` (L61-62), `scripts/doctor-health.js`, `bin/kodelyth-ecc.js` (dashboard tile), `actions/ecc-review`.

> **Disambiguation:** `graphify` (installed at `~/.local/bin/graphify`, used in this repo's root `CLAUDE.md`) is a *different* local graph tool. This track is only about DeusData's `codebase-memory-mcp`, ECC's shipped "codebase graph." The plan must not conflate them, and ECC's docs should name which one ships.

### Current state (verified)
- Upstream `DeusData/codebase-memory-mcp` is at **v0.12.1 (2026-10-16)**; the installed binary reports **0.8.1** — but its `--help`/tool surface already shows ≥0.12 features, so **the `--version` string is unreliable** and ECC trusts it blindly in `status`/`doctor`/dashboard.
- ECC pins no version (installs "latest" via upstream's own script) and delegates tool registration to upstream, so new tools reach agents *once the binary is current* — the gap is **leverage**, not plumbing.
- ECC surfaces none of: CBM Lens UI, docs-in-graph (`MENTIONS` edges, OpenAPI→`Route`, ADR nodes, diagrams), Smart CI (`detect_changes scope:"tests"`), `ingest_traces`, `query_graph` complexity/hot-path metrics, `cross-repo-intelligence`, team-shareable `persistence` artifact, IaC-in-graph.
- `docs/codebase-graph.md` is frozen at v2.4.1 and its "14 tools" list is partly wrong (names a parameter as a tool, omits 7 real tools).

### Phased work
**P0 (v2.25) — truth + leverage, docs-only risk**
- Rewrite `docs/codebase-graph.md`: correct the 14-tool list, bump the 0.8.1 example, add Lens / docs-in-graph / Smart CI / traces / complexity sections, and set expectations about the one-time forced reindex on upgrade.
- Make version/capability detection real: detect via `get_graph_schema`/tool presence instead of `--version`; warn when stale; nudge `kodelythecc codebase install`. — `scripts/codebase/index.js`, `doctor-health.js:146`.
- Teach the router the new capabilities (currently 2 lines): "which tests does this change hit" → `detect_changes scope:tests`; "find bottlenecks" → `query_graph` complexity; "what docs explain X" → inbound `MENTIONS`; "record this decision" → `manage_adr`. Wire `performance-optimizer`, `pr-test-analyzer`, `architecture-decision-records` to them.

**P1 (v3.0) — enterprise wins**
- Drive **Smart CI** test-selection from the `ecc-review` GitHub Action and `/pre-release`.
- Adopt **persistence artifacts** (`graph.db.zst`) so CI and teammates bootstrap from a shared graph instead of cold-indexing.
- Expose **cross-repo-intelligence** for monorepo/multi-repo orgs.
- Surface richer dashboard signals (index coverage, doc-node counts, hot-path candidates, Lens launch hint). — `scripts/codebase/index.js` `dashboardSnapshot()`, `bin/kodelyth-ecc.js` tile.

**Migration risks to message:** one-time forced full reindex on first index after upgrade; v0.12 binary is 331–335 MB; Linux dynamic build needs glibc 2.38 (upstream's installer already picks the static build); re-test the `query()` JSON parse against a current binary. No breaking change to the tool names ECC calls.

**Ships:** docs + detection + routing in **v2.25**; CI/persistence/cross-repo in **v3.0**.

---

## 6. Track 4 — Token Economy (RTK & Terse)

**Owner surface:** `scripts/rtk/index.js`, `scripts/lib/win-install.js`, `scripts/terse/{compress,ledger}.js`, `skills/terse-mode/SKILL.md`, `commands/terse*.md`, `docs/rtk.md`, `docs/terse-mode.md`, `README.md`.

### Current state (verified)
- **RTK `gain` is a true measurement** (raw vs filtered bytes) and the dashboard shows the user's own numbers — this part is honest.
- **But** the "5,107,394 tokens / 64.1% — all real" headline is hand-authored copy in `docs/rtk.md:19,41` and `README.md:530`, not generated.
- **No name-collision guard:** `rtk --version` passing is enough, so `reachingforthejack/rtk` (Rust Type Kit) — the exact collision your own `RTK.md` warns about — would be wired and measured as if it were RTK.
- **Windows RTK is runtime-fragile:** PATH isn't persisted, so the hook calls an `rtk` that isn't on PATH in the next shell; PowerShell hook-firing is unverified.
- **Terse runtime ledger is never written:** `appendTurn()` (`ledger.js:38`) is defined and called by nothing in production, yet `docs/terse-mode.md:163` claims "every terse-active turn is recorded." Terse savings are *modeled* from a hardcoded `RAW_MULT`, not measured. The promised `[TERSE ⚡]` statusline badge ships no script.
- **The Terse *file* compressor (`compress.js`) is genuinely good** — deterministic, byte-preserving, careful not to rewrite governance thresholds.
- **Direct `install.sh`/`install.ps1` skip RTK and Terse entirely** — only the `npx` post-install wires them, so CI/enterprise clones get neither.

### Phased work
**P0 (v2.25) — truth-in-measurement (highest trust impact)**
- Either wire Terse measurement (a Stop/PostToolUse hook that calls `ledger.appendTurn()` with the real reply) **or** delete the false "every turn is recorded" claim and the unshipped badge. Replace the hardcoded `RAW_MULT` baseline with a measured A/B or relabel it "estimated." — new hook, `ledger.js:36`, `docs/terse-mode.md`, `skills/terse-mode/SKILL.md:86`.
- Add the RTK name-collision guard: probe a signature RTK subcommand before `isInstalled()` returns true. — `scripts/rtk/index.js:67-78`.
- De-static the headline numbers: relabel "5.1M / 64.1%" as an example snapshot, or generate a live badge from `rtk gain`. — `docs/rtk.md:19,41`, `README.md:530`.

**P1 (v2.28/v2.29) — cross-platform parity**
- Windows RTK: offer consented PATH persistence; have `doctor` detect "installed but not on persistent PATH" and print the exact `setx`; state whether the hook fires under PowerShell (if not, say native-Windows savings need WSL). — `win-install.js:163`, `doctor-health.js:119`.
- Wire RTK+Terse into the direct installers (or loudly document that they're npx-only). — `install.sh`, `install.ps1`.
- Pin upstream RTK/codebase versions for reproducible enterprise installs instead of `releases/latest`.
- Add a PowerShell/cmd ruleset to the portability scanner (today POSIX-only). — `scripts/portability/rules.js`.

**P2 (later) — coverage**
- Extend RTK-style compression to `Read`/`Grep`/`Glob` via a PostToolUse compressor, closing the documented Bash-only gap.

**Ships:** honesty fixes in **v2.25**; Windows/CI parity in **v2.28–v2.29**.

---

## 7. Track 5 — Platform Reach (all IDEs, Kiro, Mac/Linux/Windows)

**Owner surface:** `install.sh`, `install.ps1`, `bin/kodelyth-ecc.js`, `scripts/mcp/register-self.js`, `scripts/rtk/index.js`, `scripts/cli/menu.js`, `scripts/lib/install-targets/registry.js`.

### Current state (verified)
- The live installer defines **13 targets** in `install.sh`/`install.ps1`; a separate modular adapter registry (`install-targets/registry.js`) has only **7** adapters, includes an **orphan `codebuddy`** target that isn't advertised, and is **missing 5** advertised platforms. The two registries disagree and mislead.
- **Depth is a cliff after Claude Code.** Claude Code gets all capabilities; every other IDE gets agents/skills/commands/rules-as-markdown + RTK, but **no hooks (by format), no auto-MCP, and no memory** — the three features that make ECC compound.
- **MCP auto-registration writes only `~/.claude.json` + Claude Desktop** (`register-self.js:115`). Six MCP-capable IDEs get nothing.
- Terse path bugs: project-scoped IDEs (cursor, windsurf-project, opencode, antigravity) have Terse written to *home* dirs the IDE won't read. RTK is missing for `aider` and `gemini-project`. Terse is absent for cline/roocode/aider/kimi.
- **Kiro is not a target.** The only "Kiro" reference is in codebase-graph docs; `.kiro/` at repo root is empty (the user's editor made it). Kiro is MCP-native (`.kiro/settings/mcp.json`), uses steering files (`.kiro/steering/*.md`) and agent hooks (`.kiro/hooks/`).
- **Windows is near-parity** at the install level now (post-install runs in the Windows branch), but PATH isn't auto-configured and the PS1 claude label prints stale counts (58/187/79 vs 70/196/103).

### Capability matrix (what each target gets out of the box today)

| Target | agents | skills | commands | rules | hooks | MCP (auto) | RTK | Terse | memory |
|---|---|---|---|---|---|---|---|---|---|
| **claude-code** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cursor | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | path-bug | ✗ |
| windsurf | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | partial | ✗ |
| codex | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ (merge script unwired) | ✓ | ✓ | ✗ |
| opencode | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | path-bug | ✗ |
| cline | partial | ✗ | partial | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| roocode | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| aider | ✓* | ✓* | ✓* | ✓* | ✗ | ✗ | ✗ | ✗ | ✗ |
| kimi | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| gemini | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗/✓ | ✓ | ✗ |
| antigravity | ✓ | rules | ✓ | ✓ | ✗ | ✗ | ✓ | path-bug | ✗ |
| **kiro (proposed)** | — | — | — | — | — | — | — | — | — |

\* Aider content is inert until the user runs `aider --read`.

### Phased work
**P0 (v2.28) — close the parity cliff**
- **Per-target MCP config writer** — the single highest-leverage move. Write `.cursor/mcp.json`, Windsurf `mcp_config.json`, `~/.codex/config.toml`, Gemini `settings.json`, Cline MCP settings. This unlocks the ECC MCP server (16 tools incl. `recall_memory`/`capture_memory`/`route_intent`/catalog) — and therefore **memory** — for 6 IDEs in one stroke. — `scripts/mcp/register-self.js:115`.
- Fix Terse path bugs (write to where the IDE actually reads). — `bin/kodelyth-ecc.js:939-968`.
- Add RTK maps for `aider`/`gemini-project`; add Terse dirs for cline/roocode/aider/kimi. — `rtk/index.js:23-35`, `bin:939`.
- Reconcile the two target registries: promote the modular adapters to drive the real install, or delete them; resolve the orphan `codebuddy`. — `install-targets/registry.js` vs `install.sh`.
- Windows: consented PATH persistence; fix the stale PS1 counts to compute dynamically. — `win-install.js`, `install.ps1:258`.

**P1 (v2.29) — add Kiro + deepen reach**
- Add Kiro targets (`kiro-project`/`kiro-home`): rules→`.kiro/steering/`, MCP→`.kiro/settings/mcp.json` (highest value, MCP-native), optional hooks in Kiro's own format. — `install.sh`, `install.ps1`, `register-self.js`, `menu.js`, `rtk/index.js`, README counts → 12 platforms / 14+ targets. *Lowest-effort/highest-value first step: Kiro MCP registration + steering rules.*
- Deepen Antigravity (it remaps agents→skills, commands→workflows; audit fidelity).
- Investigate re-implementing the hook guards (prompt-injection, token-budget) as rules-text or external wrappers for non-Claude IDEs that have no settings.json hook model (Cline/Codex have hook-ish mechanisms worth targeting).

**Ships:** MCP writer + path/registry fixes in **v2.28**; Kiro + depth in **v2.29**.

---

## 8. Track 6 — Web, SEO, Blog & LLM Discoverability (ecc-web)

**Owner surface:** `ecc-web` — `src/app/*`, `src/content/{docs,blog}`, `velite.config.ts`, `sitemap.ts`, `robots.ts`, `llms.txt`/`llms-full.txt`.

### Current state (verified)
- Strong foundation: programmatic pages for 70 agents + 196 skills + 19 docs + 13 blog posts; `sitemap.ts`, `robots.ts` with excellent AI-crawler allowances (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot); llms.txt/llms-full.txt healthy after last session.
- **Gaps:** the **103 commands have zero browsable pages** (agents and skills do) — the largest untapped programmatic-SEO surface. No comparison/alternative pages, no use-case/solution pages, no `/mcp` or `/bundles` landing pages. SEO infra isn't centralized (no `src/lib/seo.ts`; structured data is inline). The blog is one narrow niche (internal engineering war-stories) — excellent for credibility, weak for broad organic capture.

### Phased work (continuous, parallel to the package train)
**Massive SEO**
- **Programmatic command pages:** `/commands` index + `/commands/[name]` for all 103 (mirror the agents/skills generators), each with JSON-LD, OG image, canonical, and internal links to the agents/skills it fires. ~103 new indexable pages.
- **Comparison/alternative pages:** `/compare/[x]` — high-intent queries ("free alternative to X", "ECC vs Y"), honest feature tables, each with `FAQPage` + `SoftwareApplication` JSON-LD.
- **Use-case/solution landing pages:** `/solutions/[use-case]` — "security audits," "Django teams," "incident response," "monorepos" — mapping real agents/skills/commands to a job-to-be-done.
- **Top-level `/mcp` and `/bundles`** landing pages (today only docs exist).
- **Centralize SEO infra:** `src/lib/seo.ts` + `structured-data.ts` so every programmatic page emits consistent JSON-LD, canonical, OG, breadcrumbs.

**Massive blog / content engine**
- Keep the war-story voice (it's a differentiator) but add three broad clusters for organic capture: (a) **tutorials/guides** ("set up ECC memory in Cursor," "deterministic routing explained"), (b) **comparisons/landscape** ("the 2026 AI-coding-toolkit landscape"), (c) **concept explainers** tied to docs (topic-cluster internal linking to the doc hubs). Target a sustainable cadence, not a one-time dump; each post ships a purpose-built SVG hero (the existing standard).
- Build a lightweight editorial pipeline in velite (series/cluster frontmatter, related-posts rail already exists) so clusters interlink automatically.

**LLM discoverability (llms.txt and beyond)**
- Keep llms.txt/llms-full.txt complete (blog now included); add the command pages, comparison, and solutions sections as they ship.
- Per-section `llms.txt` for large sections, and ensure every programmatic page is reachable from llms-full for AI-crawler ingestion.
- Structured "answer" blocks (FAQ/HowTo JSON-LD) on high-intent pages so AI search surfaces ECC directly.

**Website enhancement**
- Finish the design/mobile polish pass started last session across the remaining detail pages; centralize the content-hash cache-busting (`withAssetVersion`) everywhere `/public` assets are referenced; verify the service worker's network-first HTML path on every deploy.

**Ships:** continuous; command pages + centralized SEO are the first wins, landing alongside **v2.26–v2.28**; the full content engine matures into **v3.0**.

---

## 9. Track 7 — Enterprise Hardening & Governance

**Owner surface:** `tests/`, `.github/workflows/*`, `actions/ecc-review`, `scripts/supply-chain/*`, release tooling, docs.

### Current state (verified)
- 693 tests in a single runner (`tests/run-all.js`), all passing; CI has `ci.yml`, `publish.yml`, `windows-install.yml`, `notify-ecc-web.yml`, and an `ecc-review` Action. Rapid patch-release cadence (v2.24.1→.11).

### Phased work
- **Test the newly-wired paths:** every "wire the dormant thing" change in Tracks 1–5 needs coverage (instinct injection, unified project-id, per-target MCP writer, routing layer, Terse ledger). The audit found several systems with zero coverage because they never ran.
- **Routing eval + memory-recall eval in CI** (Track 2) so intelligence changes are measurable, not vibes.
- **Governance for learning (v3.0):** before any auto-apply of learned artifacts (lessons, instincts, evolve proposals, skills) in an org — provenance, team review/approval gate, rollback, and audit log. None exist today; everything is local single-user.
- **Reproducible installs:** pin upstream RTK/codebase-mcp versions; keep the Windows checksum verification; extend SBOM/manifest/verify coverage to the vendored binaries.
- **Release engineering:** codify the v2.25→v3.0 train with changelog discipline (the current changelog is already strong); gate each release on the eval harnesses.

---

## 10. Cross-cutting principle — truth-in-measurement

The audit found three claims that an enterprise buyer would catch immediately: the static "5.1M/64.1%" RTK headline, the never-written Terse ledger, and the unreliable codebase `--version`. **Every number ECC shows must be either computed live or explicitly labelled an example.** This is cheap to fix, it's in v2.25, and it's the difference between "impressive demo" and "trustworthy tool." Treat it as a release gate: no release ships a claim the code doesn't back.

---

## 11. Sequencing & dependencies

```
v2.25 Honesty & Foundations ── unified project-id ─┐
  ├─ instinct injection                            │ (unblocks)
  ├─ codebase-mcp docs + detection + routing       │
  └─ RTK/Terse honesty fixes                        ▼
v2.26 Memory Core ── one substrate ── hybrid recall ── auto-capture
                         │
                         ▼ (routing defers to real data)
v2.27 Routing & Skills ── deterministic router + eval ──┐
                                                        ▼ (router feeds dispatch)
v2.28 Platform Parity ── per-target MCP writer ── (memory reaches 6 IDEs)
                         │
                         ▼
v2.29 Kiro & Reach ── MCP-native Kiro ── cross-OS parity
                         │
                         ▼ (all primitives wired + measurable)
v2.30 Super Agent (beta) ── Arena-driver chaining blueprint→route→swarm→GAN→integrate
                         │
                         ▼
v3.0  Enterprise ── team backend + governance + Smart-CI/persistence + content engine
```

Track 6 (web/SEO/content) runs continuously and depends on nothing in the package train.

---

## 12. Success metrics (how we'll know it worked)

- **Memory compounds:** BM25/semantic store grows automatically per session; recall survives a repo clone/move; instincts measurably influence output. (Today: grows only on explicit call; orphans on move; instincts never injected.)
- **Routing is measurable:** a CI routing-eval score with a regression gate; per-session routing-token cost down after the deterministic layer lands.
- **Parity:** memory + MCP available on ≥7 IDEs out of the box (today: 1); Kiro shipped; Windows/Linux/macOS at documented parity.
- **Honesty:** zero static-number-labelled-"real" claims; Terse ledger writes real turns or the claim is gone.
- **Super Agent:** an end-to-end run that decomposes a goal, dispatches parallel workers, evaluates, merges branches, and resumes after a kill — with a cost ledger.
- **Discoverability:** 103 command pages + comparison + solutions indexed; organic/AI-referral traffic trend up; llms-full covers the full surface.

---

## 13. Risks & mitigations

- **Scope is large.** Mitigate with the independently-shippable train — each release stands alone and delivers value even if the next slips.
- **codebase-mcp upgrade forces a one-time reindex** and ships a 331–335 MB binary — message it in docs and `status`; don't hide it.
- **Unifying 5 memory stores risks data loss** — migrate with a read-both/write-new shim and a one-time importer; never delete the old files until the new substrate is proven.
- **Deterministic routing could regress accuracy** — that's exactly why the eval harness lands *with* it, not after.
- **Per-target MCP writers touch user config files** — reuse the hardened, atomic, mode-preserving write patterns already in the repo (`replaceFilePreservingMode`), and always read-before-write with the absent/present/unreadable distinction.
- **Team backend adds a network dependency** — keep it strictly opt-in; local-first stays the default forever.

---

## 14. Open decisions for you to approve

These are the forks where your call changes the plan — tell me your preference and I'll lock the roadmap:

1. **Aggressiveness:** the 7-release train as written, or compress into fewer, bigger releases (e.g., straight to v2.25 → v2.30 → v3.0)?
2. **Memory substrate:** commit to SQLite `state.db` as the single store (my recommendation), or keep JSONL and only unify the schema?
3. **Semantic tier:** local embeddings (zero-network, heavier install) vs. pluggable provider (lighter, optional network) as the *default*?
4. **Super Agent autonomy:** how far does auto-merge go without a human gate — full auto-integrate, or always stop at "branches ready, review to merge"?
5. **Team/enterprise backend:** in scope for v3.0 now, or park it behind a separate "ECC Teams" track once the single-user core is coherent?
6. **Kiro priority:** ship Kiro early (v2.26, right after the MCP writer) because it's MCP-native, or hold to v2.29 as drawn?
7. **Content cadence:** target posts-per-week for the blog engine, and do you want the comparison pages to name competitors directly or stay category-level?

---

*This roadmap is a living document. On approval it becomes the source for per-release `tasks/todo.md` breakdowns, each with the file-level checklist already sketched in the track sections above.*
