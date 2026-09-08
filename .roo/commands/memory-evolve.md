---
description: Phase 3.4 self-evolving memory. Convert reuse + routing-miss signals into PR-ready proposals (skill drafts + routing-rule additions). Never auto-applies.
---

# /memory-evolve

Run the self-evolving memory loop. Inspect what ECC has learned from your sessions, generate proposals, accept the ones you want as drafts, reject the rest. **Nothing is ever committed automatically** — accept writes a draft file you review.

## Usage

```
/memory-evolve                    # default: stats + analyze + list
/memory-evolve stats              # snapshot of recorded signals
/memory-evolve analyze            # signals → proposals (idempotent)
/memory-evolve list               # show all proposals
/memory-evolve list --status pending
/memory-evolve show <id>          # full proposed content + evidence
/memory-evolve accept <id>        # write draft file to disk (NEVER commits)
/memory-evolve reject <id> --note "covered by existing agent"
```

## Behavior

1. **stats** prints the current signal snapshot:
   - reuse: how many memories are tracked, total surfaces, top reused
   - routing misses: how many substantive prompts had zero memory matches, top token clusters
2. **analyze** applies thresholds and writes proposals to `~/.kodelythecc/evolve/proposals.jsonl`. Stable IDs — re-running does NOT duplicate.
3. **list** filters by state. **show** prints the full draft markdown + evidence.
4. **accept** writes the draft to its target path under `--root` (defaults to package root). Refuses to overwrite without `--overwrite`. Marks the proposal `accepted` with the absolute path.
5. **reject** marks a proposal rejected with optional note.

## Default thresholds

| Signal | Default threshold | Override flag |
|---|---|---|
| Memory reuse count | 3 | `--reuse-min N` |
| Distinct sessions per memory | 2 | `--reuse-min-sessions N` |
| Routing-miss cluster total | 3 | `--miss-min N` |
| Distinct prompts per cluster | 2 | `--miss-min-distinct N` |

## Use cases

- **Promote a recurring memory to a skill.** A memory that's been recalled 5 times across 4 sessions is probably ready to graduate.
- **Find routing gaps.** Ten substantive prompts about "feature flags" that hit zero memories and (you suspect) no specialist agent → propose a routing entry.
- **Audit what ECC has learned.** Before tagging a release, see what proposals are pending and decide which to accept.
- **Reject noisy patterns.** Some clusters look real but cover ground that's already covered by an existing agent. Reject with a note for the audit trail.

## Companion commands

- **`/memory remember`** — manual memory capture. Without captured memories, evolve has nothing to learn from.
- **`/skill-create`** — alternative path: create a skill from scratch instead of from an evolved memory.
- **`/devil-mode`** — adversarial review of the accepted draft before commit.

## Hard rules

1. **NEVER commit accepted drafts automatically.** The CLI writes the file. The user reviews, edits, commits.
2. **NEVER overwrite an existing file** without `--overwrite`. Even on accept.
3. **Routing-addition diffs ship `TODO-agent`** intentionally so they cannot accidentally route real traffic.
4. **All recording is fire-and-forget.** Hooks NEVER block on signal write failure.
5. **Append-only proposal log.** State changes preserve the full audit trail.

## Implementation

Backed by:

- `scripts/evolve/stats.js` — pure record/read of `~/.kodelythecc/evolve/{reuse.json, routing-misses.jsonl}`
- `scripts/evolve/analyze.js` — pure functions: signals → proposals
- `scripts/evolve/proposals.js` — append-only proposal log with state transitions
- `hooks/memory/auto-recall.js` — fire-and-forget signal recording on every UserPromptSubmit

CLI surface: `kodelyth-ecc evolve <stats|analyze|list|show|accept|reject>`. Skill: `self-evolving-memory`. Full reference: `docs/evolve.md`.
