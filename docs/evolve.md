# Self-evolving memory

> Phase 3.4 of the Devil Roadmap. Closes the learning loop on the BM25 memory system. Repeated memory hits become draft skills. Repeated routing misses become proposed routing-rule additions. Nothing is ever auto-applied.

---

## Why this exists

ECC already has:

- A BM25 memory store (`scripts/memory/store.js`)
- An auto-recall hook that surfaces relevant memories on every `UserPromptSubmit`

What it didn't have, until 3.4: a way for those signals to feed back into the toolkit's own structure. If the same memory keeps getting surfaced across sessions, that memory is doing real work — it should graduate to a `SKILL.md`. If users keep submitting prompts that match no memory at all, that's a routing gap — the routing rule should grow.

The 3.4 surface formalizes both loops while preserving the **never auto-commit** rule.

---

## Two signal streams

### 1. Memory reuse (→ skill-upgrade proposals)

Every time `auto-recall.js` surfaces a memory to the user, it bumps a counter:

```jsonc
// ~/.kodelyth/evolve/reuse.json
{
  "byMemory": {
    "<memoryId>": {
      "count": 7,
      "sessions": ["s1", "s2", "s3", ...],
      "projects": ["/path/to/proj-a", "/path/to/proj-b"],
      "firstSurfaced": "2026-04-30T...",
      "lastSurfaced":  "2026-05-10T..."
    }
  },
  "lastUpdated": "2026-05-10T..."
}
```

Counter semantics:

- **Per-memory, per-session**: surfacing the same memory ten times in one session counts ONCE. Matches the existing "never re-surface the same memory twice in a session" rule of `auto-recall.js`.
- **Cross-session**: each fresh session bumps the count by exactly one.
- **Idempotent**: replaying a session does not double-count.

Default threshold: count ≥ 3 AND sessions ≥ 2 → eligible for skill-upgrade proposal.

### 2. Routing misses (→ routing-addition proposals)

When `shouldRecall(prompt)` is true (substantive prompt, ≥12 chars, ≥2 meaningful tokens, not a slash command) AND BM25 recall returns zero matches, the prompt is logged:

```jsonl
// ~/.kodelyth/evolve/routing-misses.jsonl  (append-only)
{"hash":"abc...","prompt":"...","tokens":["..."],"session_id":"...","project":"...","recorded_at":"..."}
```

Stored prompts are capped at 1000 chars. Top tokens are extracted at write time so analysis is cheap.

Default threshold: cluster count ≥ 3 AND distinct prompts ≥ 2 → eligible for routing-addition proposal.

---

## CLI

### `kodelyth-ecc evolve stats`

Snapshot of recorded signals. No proposals generated.

```
Kodelyth ECC — self-evolving memory stats
  reuse:
    memories tracked: 14
    total surfaces:   42
    last updated:     2026-05-10T17:23:00.000Z
    top reused:
      • efe17d650917e445  count=7  sessions=5
      • a91ce2034d8b1234  count=5  sessions=4
  routing misses:
    total:            18
    unique prompts:   11
    top clusters:
      • count=4  tokens=[feature, flag, gradual, rollout]
      • count=3  tokens=[migration, postgres, downtime, zero]
```

### `kodelyth-ecc evolve analyze`

Apply thresholds and write proposals. Idempotent — same evidence produces the same proposal ID, so re-running never duplicates.

| Flag | Default | Effect |
|---|---|---|
| `--reuse-min N` | 3 | minimum total surface count |
| `--reuse-min-sessions N` | 2 | minimum distinct sessions |
| `--miss-min N` | 3 | minimum miss-cluster total |
| `--miss-min-distinct N` | 2 | minimum distinct prompts in cluster |
| `--json` | off | full report instead of pretty summary |

### `kodelyth-ecc evolve list [--status pending|accepted|rejected|applied]`

Show proposals. Filter by status. Pretty output uses ⏸ ✓ ✗ ★ marks for the four states.

### `kodelyth-ecc evolve show <id>`

Print the full proposed file content + evidence. **Always preview before accepting.**

### `kodelyth-ecc evolve accept <id> [--root DIR] [--overwrite]`

Write the proposed `diff` to its `target_path` under `--root`. Refuses to overwrite an existing file unless `--overwrite` is explicit. Marks the proposal `accepted` with the absolute `applied_path` written to the audit trail.

**The CLI does not stage, does not commit, does not push.** Review the draft, edit, commit by hand.

### `kodelyth-ecc evolve reject <id> [--note "..."]`

Mark a proposal `rejected`. The optional `--note` is preserved in the audit trail for future reference.

---

## Proposal anatomy

Both proposal kinds share a structure:

```jsonc
{
  "id": "skill-2537cb787a",          // deterministic over evidence
  "type": "skill-upgrade",            // or "routing-addition"
  "evidence": {
    "memoryId": "efe17d650917e445",
    "reuseCount": 7,
    "sessions": ["s1", "s2", "s3", "s4", "s5"],
    "firstSurfaced": "...",
    "lastSurfaced": "..."
  },
  "proposal": {
    "kind": "create-skill",                                            // or "add-routing-entry"
    "target_path": "skills/<slug>/SKILL.md",                           // for skill-upgrade
    "diff": "<full markdown content>",
    "rationale": "Memory '...' surfaced 7x across 5 sessions ..."
  },
  "status": "pending",                // pending | accepted | rejected | applied
  "created_at": "...",
  "timestamp": "...",
  "applied_path": null                // set on accept
}
```

### Skill-upgrade diff (sample)

```markdown
---
name: <slug-from-problem>
description: <problem text> (auto-derived from memory <id> after repeated reuse)
origin: kodelyth-evolve
language: typescript
tags:
  - <memory tags>
---

# Skill: <slug>

> **Auto-derived draft.** Generated by `kodelyth-ecc evolve` after this memory
> was surfaced repeatedly across multiple sessions. Review, refine, and rename
> before committing.

## Problem
<memory.problem>

## Approach
<memory.approach>

## Gotchas
<memory.gotchas if any>

## When to invoke
_Replace this section with explicit trigger conditions._

## Origin
- Memory id: `<id>`
- Captured at: <timestamp>
- Auto-promoted by Phase 3.4 self-evolving memory.
```

### Routing-addition diff (sample)

```markdown
<!-- proposed addition to rules/common/agent-intent-routing.md -->
<!-- review by hand, decide on tier + agent, then merge -->

### TODO-agent — covers prompts about <token>, <token>, <token>

Trigger if the user mentions `<t1>`, `<t2>`, `<t3>`.

| Signal | Real human phrasing |
|---|---|
| repeated unrouted prompt cluster | <tokens> |

**Origin:** Phase 3.4 self-evolving memory — N prompts in this cluster were
submitted with no memory match and (presumably) no specialist routing.

Recent samples:
  - "<sample 1>"
  - "<sample 2>"
  - "<sample 3>"

_(Pick the right tier in `rules/common/agent-intent-routing.md` before merging.
Do NOT commit this block as-is — replace `TODO-agent` with the real agent name
and slot under the correct priority tier.)_
```

The `TODO-agent` placeholder is intentional. Even if you accept and commit verbatim, the rule won't route any real traffic — it's a no-op until you fill in the agent name.

---

## Storage layout

```
~/.kodelyth/evolve/                        ← override with $KODELYTH_EVOLVE_DIR
├── reuse.json                             ← per-memory reuse counters
├── routing-misses.jsonl                   ← append-only miss log
└── proposals.jsonl                        ← append-only proposal events
```

`proposals.jsonl` is append-only. Every state transition is a new event. Reading collapses to "latest state per id" while preserving the full history for audit.

---

## Worked example

```bash
# 1) Use ECC normally for a few weeks. The auto-recall hook records signals.
# 2) Eventually run:
$ npx kodelyth-ecc evolve stats
... shows current signal volume ...

# 3) Generate proposals.
$ npx kodelyth-ecc evolve analyze
✓ analyzed signals
  reuse entries scanned:  14
  miss entries scanned:   11
  proposals generated:    3
  new proposals (added):  3

  Run 'kodelyth-ecc evolve list' to review.

# 4) See what's pending.
$ npx kodelyth-ecc evolve list
Kodelyth ECC — self-evolving memory proposals (3)
  ⏸ [pending] skill-2537cb787a  skill-upgrade
     target: skills/tailwind-v4-arbitrary-values/SKILL.md
     why:    Memory '...' surfaced 7x across 5 sessions ...
  ⏸ [pending] route-13d976a554  routing-addition
     target: rules/common/agent-intent-routing.md
     why:    4 substantive prompts (4 distinct) clustered on tokens [...]

# 5) Inspect the skill draft.
$ npx kodelyth-ecc evolve show skill-2537cb787a
... full markdown + evidence ...

# 6) Accept it. Writes to disk. NEVER commits.
$ npx kodelyth-ecc evolve accept skill-2537cb787a
✓ accepted skill-2537cb787a
  draft written: /path/to/repo/skills/tailwind-v4-arbitrary-values/SKILL.md

  Review the draft. When you're happy with it, commit it.

# 7) Reject the routing one — already covered.
$ npx kodelyth-ecc evolve reject route-13d976a554 --note "covered by debug-detective"
✗ rejected route-13d976a554 (note: covered by debug-detective)
```

---

## Hard rules

1. **NEVER auto-apply.** `accept` writes a draft. The user reviews, edits, commits.
2. **NEVER overwrite without `--overwrite`.** Even on accept of a stale proposal.
3. **NEVER block the recall hook.** All evolve recording is wrapped in try/catch and lazy-required.
4. **NEVER auto-route a `TODO-agent` proposal.** The placeholder is intentional.
5. **Idempotent IDs.** Stable evidence → stable proposal ID. Re-running `analyze` never duplicates.
6. **Append-only proposal log.** Every state change is a new event. Full audit trail preserved.

---

## Composition with other phases

| Pair | Effect |
|---|---|
| BM25 memory store | Source of reuse signals. |
| `/memory remember` | Manually captured memories that get reused → skill proposals. |
| `rules/common/agent-intent-routing.md` | Direct target for routing-addition proposals. |
| Phase 2.7 swarm | Repeated swarm tasks reusing the same memories → those memories become skills the swarm picker can choose automatically. |
| Phase 2.8 replay | Replay bundles re-trigger reuse signals when the same memory is surfaced again. |
| Phase 2.10 token-budget hook | Promoting memories → skills means cheaper recalls. |

---

## See also

- `skills/self-evolving-memory/SKILL.md` — explicit-invocation skill
- `commands/memory-evolve.md` — `/memory-evolve` slash command
- `scripts/evolve/{stats,analyze,proposals}.js` — pure-function implementation
- `hooks/memory/auto-recall.js` — signal capture (Phase 3.4 augmentation)
