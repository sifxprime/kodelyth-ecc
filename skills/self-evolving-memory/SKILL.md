---
name: self-evolving-memory
description: Phase 3.4 — turn repeated memory hits and routing misses into proposed skill / routing-rule upgrades. Never auto-applies; produces PR-ready drafts the user reviews and commits.
trigger:
  - self-evolving memory
  - skill proposals
  - routing proposals
  - memory feedback loop
  - kodelyth evolve
  - propose skill
  - propose routing
---

# Skill: self-evolving-memory

## What this skill does

Closes the learning loop on the BM25 memory system. Two signals drive proposals:

| Signal | Source | Outcome when threshold hit |
|---|---|---|
| **Memory reuse** | Auto-recall hook bumps a counter every time a memory is surfaced to the user | Propose **promoting the memory to a draft `SKILL.md`** |
| **Routing miss** | Auto-recall hook logs substantive prompts where memory recall returned nothing | Propose **adding a routing entry** to `rules/common/agent-intent-routing.md` |

Both proposals are written to a local proposal log. **Nothing is ever auto-applied.** The user reviews, accepts (which writes a draft file), edits, and commits.

---

## When to use this skill

Use **explicitly** by name when:

- You've been running ECC for weeks and want to surface what the toolkit has learned about your work.
- A pattern keeps coming back in your sessions and you want to formalize it as a skill.
- You suspect there's a gap in the routing rule (you keep getting the wrong agent for a class of prompts).
- You want to inspect how the self-learning loop is doing without committing to anything.

```bash
use self-evolving-memory

# See what signals have been collected
npx kodelyth-ecc evolve stats

# Generate proposals from current signals
npx kodelyth-ecc evolve analyze

# Review what's pending
npx kodelyth-ecc evolve list

# Inspect a specific proposal end-to-end (incl. proposed file content)
npx kodelyth-ecc evolve show <proposalId>

# Accept → writes a draft file. NEVER auto-commits.
npx kodelyth-ecc evolve accept <proposalId>

# Reject — appends a state event with optional note
npx kodelyth-ecc evolve reject <proposalId> --note "covered by existing agent"
```

Implicit triggers (the AI should route here automatically):

- "what has ECC learned from my sessions?"
- "promote this memory to a skill"
- "add this to the routing rule"
- "what's missing from the routing intent rule?"

---

## CLI surface

### `kodelyth-ecc evolve stats`

Snapshot of currently recorded signals:

- **Reuse:** memories tracked, total surfaces, top reused entries.
- **Routing misses:** total misses, unique prompts, top clusters.

### `kodelyth-ecc evolve analyze`

Reads signals + your `~/.kodelyth/memory/` store, applies thresholds, and writes proposals to `~/.kodelyth/evolve/proposals.jsonl`. Idempotent — re-running with the same evidence produces the same proposal IDs and does NOT duplicate.

| Flag | Default | Effect |
|---|---|---|
| `--reuse-min N` | 3 | Memory must have surfaced ≥ N times to be eligible |
| `--reuse-min-sessions N` | 2 | …across ≥ N distinct sessions |
| `--miss-min N` | 3 | A token cluster must have ≥ N total miss events |
| `--miss-min-distinct N` | 2 | …with ≥ N distinct prompts |
| `--json` | off | Stream the full report instead of the pretty summary |

### `kodelyth-ecc evolve list [--status pending|accepted|rejected|applied]`

Show proposals filtered by state. Proposals are append-only — every state change is a new event, full audit trail preserved.

### `kodelyth-ecc evolve show <id>`

Print the full proposed file content + evidence. **Always preview before accepting.**

### `kodelyth-ecc evolve accept <id> [--root DIR] [--overwrite]`

Writes the proposed `diff` to its `target_path` under `--root` (defaults to package root). **Refuses to overwrite an existing file** unless `--overwrite` is passed. After writing, marks the proposal `accepted` with the absolute `applied_path`.

The user must still review the draft, edit, and commit. The CLI does not stage or commit anything.

### `kodelyth-ecc evolve reject <id> [--note "..."]`

Marks a proposal `rejected`. Optional `--note` is preserved for the audit trail.

---

## How signals are recorded

The auto-recall hook (`hooks/memory/auto-recall.js`) does two things in addition to its normal job:

1. **On a memory surface** — calls `evolve.recordSurface({ memoryId, sessionId, projectRoot })`. This bumps the per-memory counter in `~/.kodelyth/evolve/reuse.json`. Idempotent per `(memoryId, sessionId)` — you can't game the counter by surfacing the same memory ten times in one session.
2. **On a substantive prompt with zero memory matches** — calls `evolve.recordRoutingMiss({ prompt, sessionId, projectRoot })`. Appends one line to `~/.kodelyth/evolve/routing-misses.jsonl`. The prompt is capped to 1000 chars and stored alongside its top tokens for clustering.

Both calls are **fire-and-forget**: any error is swallowed silently. The hook NEVER blocks recall on stats failure.

---

## How proposals are generated

`scripts/evolve/analyze.js` is pure, deterministic, no I/O.

**Skill upgrade** — for every memory whose reuse meets thresholds, build a draft `SKILL.md` from the memory's problem / approach / tags / language. Target path: `skills/<slug>/SKILL.md`.

**Routing addition** — cluster routing-miss entries by their top-K tokens (≥2-token overlap). For every cluster meeting thresholds, build a draft markdown block to add to `rules/common/agent-intent-routing.md`. Target path: the rule itself (the diff is meant to be merged in by hand under the right priority tier — the agent name in the draft is intentionally `TODO-agent`).

Proposal IDs are deterministic over their evidence — the same evidence always produces the same ID, so re-running `analyze` does not duplicate.

---

## Hard rules

1. **NEVER auto-apply.** `accept` writes a draft file. The user reviews, edits, and commits. No git operations.
2. **NEVER overwrite by default.** `accept` refuses to clobber an existing file unless `--overwrite` is explicit.
3. **NEVER block the recall hook.** All evolve recording is fire-and-forget with try/catch around every call.
4. **NEVER auto-route to a `TODO-agent` proposal.** The routing-addition diff intentionally names `TODO-agent` so accepting it cannot accidentally flip routing behavior. The user must rename + place it under the right priority tier.
5. **Idempotent IDs.** Re-running `analyze` does not duplicate proposals. Stable evidence → stable ID.
6. **Append-only proposal log.** Every state change is a new event. Full audit trail preserved.

---

## Pairing with other ECC features

| Pair with | What you get |
|---|---|
| **BM25 memory store** | Source of reuse signals. Without captured memories, this skill has nothing to learn from. |
| **`/memory remember`** | Manual capture. Explicitly captured memories that get reused → skill proposals. |
| **`rules/common/agent-intent-routing.md`** | The exact target for routing-addition proposals. |
| **Phase 2.7 swarm** | Repeated swarm tasks that surface the same memories → those memories become skills the swarm can pick automatically. |
| **Phase 2.8 replay** | Replay bundles can re-trigger reuse signals when the same memory is surfaced again. |
| **Phase 2.10 token-budget hook** | Promoting memories → skills means cheaper recalls (skills are loaded once, memories are recalled per-prompt). |

---

## Storage layout

```
~/.kodelyth/evolve/
├── reuse.json               # per-memory reuse counters
├── routing-misses.jsonl     # append-only miss log
└── proposals.jsonl          # append-only proposal events
```

Override with `KODELYTH_EVOLVE_DIR`. All zero telemetry. All local.

---

## See also

- `commands/evolve.md` — `/evolve` slash command
- `docs/evolve.md` — full reference + worked example
- `scripts/evolve/{stats,analyze,proposals}.js` — pure-function implementation
- `hooks/memory/auto-recall.js` — signal capture (Phase 3.4 augmentation)
