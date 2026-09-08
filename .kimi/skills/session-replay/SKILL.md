---
name: session-replay
description: Bundle, share, and re-run swarm sessions with optional variations (different harness, different agents, different base ref). Used for regression testing prompts, reproducible bug reports, A/B testing model versions, and post-mortems on swarm runs.
origin: ECC
---

# Session Replay — Reproducible Swarm Runs

Every swarm session writes to `<repo>/.orchestration/<session>/`. That directory is the **session record**: task prompts, agent handoffs, status markers. Replay turns it into a portable, re-runnable artifact.

> Phase 2.8 of the [Devil Roadmap](../../README.md). Pairs with the swarm orchestrator (Phase 2.7), the cost-aware model router (Phase 2.4), and the token-budget safety hook (Phase 2.10).

---

## When to invoke

Trigger this skill when the user wants to:

- **Reproduce a swarm run** with different settings (different model, different agent, different base ref).
- **Share a swarm result** with a teammate as a single JSON file (no need to ship a whole repo).
- **Compare runs** — same task, two harnesses, side-by-side handoff diff.
- **Regression-test prompts** — replay a known-good swarm against a new agent rev to see if quality regressed.
- **Build a reproducible bug report** — bundle a buggy run and ship to maintainers.

---

## Three primitives

### 1. Export a session

```bash
npx kodelyth-ecc session-export swarm-2026-05-10-4a \
  --task "audit oauth flow for security regressions" \
  --agents security-reviewer,code-reviewer,pair-programmer,tdd-guide \
  --harness claude \
  --out ~/Desktop/oauth-audit.bundle.json
```

The `--task` / `--agents` / `--harness` / `--base-ref` flags enrich the bundle's `meta` block for richer replays. They're optional — without them, the bundle still works but replays default to whatever the bundle's first worker hint reveals.

### 2. Import a bundle

```bash
npx kodelyth-ecc session-import ~/Desktop/oauth-audit.bundle.json
# or:
npx kodelyth-ecc session-import oauth-audit.bundle.json --target /tmp/audit-restore --overwrite
```

Restores the bundle into a coordination directory. Useful for inspecting handoffs locally before replaying.

### 3. Replay a session

```bash
# By bundle file
npx kodelyth-ecc replay oauth-audit.bundle.json --execute

# By session name (in current repo's .orchestration/)
npx kodelyth-ecc replay swarm-2026-05-10-4a --execute

# A/B variation: same task, different harness
npx kodelyth-ecc replay oauth-audit.bundle.json --harness codex --execute

# A/B variation: different agent set
npx kodelyth-ecc replay oauth-audit.bundle.json \
  --agents security-reviewer,supply-chain-auditor,prompt-injection-hunter \
  --execute

# Replay against new code
npx kodelyth-ecc replay oauth-audit.bundle.json --base-ref refactor/oauth-rewrite --execute
```

Default mode is **dry-run**. Pass `--execute` to actually spawn worktrees + tmux + agents. The replay session is auto-named `<original>-replay-<n>` so it never collides with the source.

---

## Bundle format

Single JSON file. Stable schema `kodelyth.session-bundle/v1`:

```json
{
  "schema":      "kodelyth.session-bundle/v1",
  "session":     "swarm-2026-05-10-4a",
  "exported_at": "2026-05-10T17:30:00Z",
  "exported_by": "kodelyth-ecc@1.7.0",
  "meta": {
    "task":     "audit oauth flow for security regressions",
    "agents":   ["security-reviewer", "code-reviewer", "pair-programmer", "tdd-guide"],
    "harness":  "claude",
    "base_ref": "HEAD"
  },
  "workers": [
    { "slug": "code-reviewer",     "task": "...", "handoff": "...", "status": "..." },
    { "slug": "pair-programmer",   "task": "...", "handoff": "...", "status": "..." },
    { "slug": "security-reviewer", "task": "...", "handoff": "...", "status": "..." },
    { "slug": "tdd-guide",         "task": "...", "handoff": "...", "status": "..." }
  ]
}
```

Pure JSON. No archives, no binaries. Diff-friendly for git review of regression bundles.

---

## Replay variations matrix

| Want to test | Flags |
|---|---|
| Same task, different model | `--harness claude` vs `--harness codex` (or use `KODELYTH_ROUTER_*` env vars) |
| Same task, different agents | `--agents new1,new2,new3` |
| Same task, new code | `--base-ref refactor-branch` |
| Same task, custom session name | `--session my-replay-1` |
| Inspect plan only | (default — dry-run prints plan) |
| Just write coordination files | `--write-only` |
| Full execute | `--execute` |

---

## Hard rules

1. **Never replay with `--execute` without inspecting the dry-run first.** Worktrees mutate disk; bad replays waste storage.
2. **Replays are auto-named** to avoid collisions. Don't manually reuse the origin name.
3. **Bundles are public artifacts** — strip secrets from `task.md` / `handoff.md` before sharing externally. Use `opensource-sanitizer` if needed.
4. **A/B comparisons require human review.** Never auto-pick a "winner" between two replays.

---

## Pairing with the rest of ECC

| Pairs with | How |
|---|---|
| **2.7 swarm orchestrator** | Replay only works on swarm coordination dirs. The two ship together. |
| **2.4 cost router** | Vary `KODELYTH_ROUTER_*` env vars across replays for A/B model tests. |
| **2.10 token-budget hook** | Replays open new sessions with fresh budgets — no spillover from the origin. |
| **2.5 MCP client mode** | Replays inherit the same MCP registry, so tool calls reproduce. |
| **opensource-sanitizer** | Run on a bundle before sharing externally. |
| **kodelyth-memory** | Capture the bundle path as a memory: `kodelyth-ecc remember "oauth audit replay" --approach "..."`. |

---

## Examples

### Bug report bundle

```bash
# 1. Capture the buggy run
npx kodelyth-ecc swarm --task "..." --execute

# 2. After it finishes, export
npx kodelyth-ecc session-export swarm-2026-05-10-4a --out bug-report.bundle.json

# 3. Strip secrets if needed
# (manually edit bug-report.bundle.json or use opensource-sanitizer)

# 4. Ship to maintainers
gh issue create --body "Reproducer: bug-report.bundle.json (attached)"
```

### Model A/B test

```bash
# Run with claude
npx kodelyth-ecc swarm --task "refactor payments module" --agents 4 --harness claude --execute
npx kodelyth-ecc session-export swarm-... --out claude-run.bundle.json

# Replay with codex against the same task
npx kodelyth-ecc replay claude-run.bundle.json --harness codex --execute
npx kodelyth-ecc session-export swarm-...-replay-1 --out codex-run.bundle.json

# Compare handoffs side-by-side
diff <(jq -r '.workers[] | "\(.slug):\n\(.handoff)"' claude-run.bundle.json) \
     <(jq -r '.workers[] | "\(.slug):\n\(.handoff)"' codex-run.bundle.json)
```

### Regression check after agent rev

```bash
# 1. Save a known-good run as a baseline.
npx kodelyth-ecc session-export swarm-baseline --out baseline.bundle.json

# 2. After updating an agent prompt, replay and compare.
npx kodelyth-ecc replay baseline.bundle.json --execute
npx kodelyth-ecc session-export swarm-baseline-replay-1 --out replay.bundle.json
# Inspect the diff manually — has quality regressed?
```

---

## Implementation references

- Bundle library: `scripts/replay/bundle.js` (pure read/write, validation, diff helper).
- Replay engine: `scripts/replay/replay.js` (extracts task from bundle, builds replay plan-config).
- CLI: `npx kodelyth-ecc session-export | session-import | replay`.
- Slash command: `/replay`.
- Full reference: `docs/replay.md`.

---

Built into [Kodelyth ECC](../../README.md). MIT licensed.
