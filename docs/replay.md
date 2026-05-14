# Kodelyth ECC — Session Replay

Bundle, share, and re-run swarm sessions for regression testing, reproducible bug reports, and A/B testing across harnesses, agents, and base refs.

> **Phase 2.8 of the [Devil Roadmap](../README.md).** Companion to the swarm orchestrator (Phase 2.7) — every swarm coordination dir is portable, replayable, and diff-friendly.

---

## Why replay

Three concrete wins:

1. **Reproducible bug reports.** Bundle a buggy swarm into a single JSON file, ship to maintainers. They `replay --execute` locally and see the same agent behavior.
2. **Regression testing.** Save a known-good baseline. After an agent prompt rev, replay against the new agent and diff handoffs. Did quality regress?
3. **Model A/B testing.** Same task, two harnesses. Side-by-side handoff comparison reveals which model handles the swarm better for your codebase.

---

## CLI

| Command | Purpose |
|---|---|
| `kodelyth-ecc session-export <session> [flags]` | Bundle a coordination dir to JSON. |
| `kodelyth-ecc session-import <bundle.json> [flags]` | Restore a bundle to a coordination dir. |
| `kodelyth-ecc replay <bundle\|session> [flags]` | Re-run a session with variations. |

### `session-export`

```bash
kodelyth-ecc session-export <session> \
  [--out file.json] \
  [--task "..."] [--agents a,b,c] [--harness claude] [--base-ref HEAD] \
  [--coord-root <dir>]
```

| Flag | Description |
|---|---|
| `<session>` | Required. Directory name under `.orchestration/`. |
| `--out` | Output JSON path. Default: `.orchestration/<session>.bundle.json`. |
| `--task "..."` | Enrich `meta.task` for cleaner replays. |
| `--agents a,b,c` | Enrich `meta.agents`. |
| `--harness <h>` | Enrich `meta.harness`. |
| `--base-ref <ref>` | Enrich `meta.base_ref`. |
| `--coord-root` | Where to look for coordination dirs (default: `<repo>/.orchestration`). |

### `session-import`

```bash
kodelyth-ecc session-import <bundle.json> \
  [--target <dir>] [--overwrite] \
  [--coord-root <dir>]
```

| Flag | Description |
|---|---|
| `<bundle.json>` | Required. Bundle to restore. |
| `--target` | Output directory. Default: `.orchestration/<session-from-bundle>`. |
| `--overwrite` | Replace any existing target dir. |

### `replay`

```bash
kodelyth-ecc replay <bundle.json|session-name> \
  [--harness h] [--agents a,b,c] [--base-ref ref] [--session NAME] [--replace] \
  [--execute|--write-only|--json]
```

| Flag | Description |
|---|---|
| `<target>` | Required. Bundle file (ends in `.json`) or session name in `.orchestration/`. |
| `--harness` | Override launcher harness. |
| `--agents` | Replace the agent list. |
| `--base-ref` | Branch base for replay worktrees. |
| `--session` | Override auto-generated `-replay-N` name. |
| `--replace` | Tear down any existing session/worktrees with the same names. |
| `--execute` | Actually spawn worktrees + tmux + agents. |
| `--write-only` | Just materialize coordination files. |
| `--json` | Print plan + planConfig. |

Default mode is **dry-run**. Always inspect first.

---

## Bundle format

Stable schema `kodelyth.session-bundle/v1`. Single JSON file:

```json
{
  "schema":      "kodelyth.session-bundle/v1",
  "session":     "swarm-2026-05-10-4a",
  "exported_at": "2026-05-10T17:30:00Z",
  "exported_by": "kodelyth-ecc@1.7.0",
  "meta": {
    "task":     "audit oauth flow",
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

Pure JSON. No archives, no binaries. Diff-friendly for `git diff` review of regression bundles.

---

## How replay reconstructs the task

1. **Prefer `meta.task`** if the bundle was exported with `--task "..."`.
2. **Fallback: parse the first worker's `task.md`** for the `## Shared Task` section (the agent-shaped header from `scripts/swarm/build-plan.js`).
3. **Final fallback: parse the orchestrator's own `## Objective` block** (works for hand-written tasks).

This means replay works even on bundles that pre-date the `--task` flag — the heuristic recovers the shared task from the first worker.

---

## Replay variations

| Want to test | Flags |
|---|---|
| Same task, different model | `--harness claude` vs `--harness codex` (or vary `KODELYTH_ROUTER_*`) |
| Same task, different agents | `--agents new1,new2,new3` |
| Same task, new code | `--base-ref refactor-branch` |
| Custom session name | `--session my-replay-1` |
| Inspect plan only | (default — dry-run) |
| Just write coordination files | `--write-only` |
| Full execute | `--execute` |

---

## Hard rules

1. **Never `--execute` without inspecting the dry-run.** Worktrees mutate disk.
2. **Replays are auto-named** (`-replay-N`) to avoid collisions. Don't manually reuse the origin name.
3. **Bundles are public artifacts** — strip secrets before sharing externally. Use `opensource-sanitizer` if needed.
4. **A/B comparisons require human review.** Never auto-pick a "winner" between two replays.
5. **Don't replay across incompatible base refs.** A swarm built against `main` may break if replayed against `feature-branch` with conflicting changes.

---

## Pairing with the rest of ECC

| Pairs with | How |
|---|---|
| **2.7 swarm orchestrator** | Replay only works on swarm coordination dirs. The two ship together. |
| **2.4 cost router** | Vary `KODELYTH_ROUTER_*` env vars across replays for A/B model tests. |
| **2.10 token-budget hook** | Replays open new sessions with fresh budgets — no spillover from the origin. |
| **2.5 MCP client mode** | Replays inherit the same MCP registry, so tool calls reproduce. |
| **opensource-sanitizer** | Run on a bundle before sharing externally. |

---

## Examples

### Reproducible bug report

```bash
# 1. Capture the buggy run
npx kodelyth-ecc swarm --task "..." --execute

# 2. After it finishes, export with rich meta
npx kodelyth-ecc session-export swarm-2026-05-10-4a \
  --task "..." --agents code-reviewer,security-reviewer --harness claude \
  --out bug-report.bundle.json

# 3. Strip secrets if needed
# (manually edit bug-report.bundle.json)

# 4. Ship to maintainers
gh issue create --body "Reproducer attached: bug-report.bundle.json"
```

### Model A/B test

```bash
# Run with claude
npx kodelyth-ecc swarm --task "refactor payments module" --agents 4 --harness claude --execute
npx kodelyth-ecc session-export swarm-...               --out claude-run.bundle.json

# Replay with codex against the same task
npx kodelyth-ecc replay claude-run.bundle.json --harness codex --execute
npx kodelyth-ecc session-export swarm-...-replay-1      --out codex-run.bundle.json

# Compare handoffs
diff <(jq -r '.workers[] | "\(.slug):\n\(.handoff)"' claude-run.bundle.json) \
     <(jq -r '.workers[] | "\(.slug):\n\(.handoff)"' codex-run.bundle.json)
```

### Regression check after agent rev

```bash
# 1. Save a baseline.
npx kodelyth-ecc session-export swarm-baseline --out baseline.bundle.json

# 2. After updating an agent prompt, replay.
npx kodelyth-ecc replay baseline.bundle.json --execute
npx kodelyth-ecc session-export swarm-baseline-replay-1 --out replay.bundle.json

# 3. Inspect the diff manually — has quality regressed?
diff <(jq -r '.workers[] | "\(.slug)\n\(.handoff)"' baseline.bundle.json) \
     <(jq -r '.workers[] | "\(.slug)\n\(.handoff)"' replay.bundle.json)
```

---

## Programmatic use

```js
const bundleLib = require('kodelyth-ecc/scripts/replay/bundle.js');
const replayLib = require('kodelyth-ecc/scripts/replay/replay.js');
const { buildOrchestrationPlan, executePlan } = require('kodelyth-ecc/scripts/lib/tmux-worktree-orchestrator.js');

// Read a bundle
const bundle = bundleLib.readBundle('./oauth-audit.bundle.json');

// Build a replay plan with overrides
const planConfig = replayLib.buildReplayPlanConfig(bundle, {
  harness: 'codex',
  baseRef: 'main',
});

// Execute
const plan = buildOrchestrationPlan(planConfig);
const result = executePlan(plan);
console.log(`replay started: ${result.sessionName}`);
```

---

## Roadmap interactions

- **Phase 2.3 — local dashboard** will surface replay history and side-by-side handoff diffs for the same task across runs.
- **Phase 2.6 — sandbox layer** will isolate replay execution in Docker so re-running an external bundle doesn't trust the source.
- **Phase 2.2 — SWE-Bench harness** will use bundle replay as its evaluation primitive.

---

Built into [Kodelyth ECC](../README.md). MIT licensed.
