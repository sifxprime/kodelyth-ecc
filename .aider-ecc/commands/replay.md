---
description: Replay a finished swarm session — same task, optional A/B variations (different harness, agents, base ref).
argument-hint: "[bundle.json|session-name] [--harness h] [--agents a,b] [--base-ref ref] [--execute]"
---

# /replay

Re-run a completed swarm session for regression testing, A/B comparison, or post-mortem analysis.

## Quick examples

```
/replay swarm-2026-05-10-4a
/replay oauth-audit.bundle.json --execute
/replay swarm-2026-05-10-4a --harness codex --execute
/replay oauth-audit.bundle.json --agents security-reviewer,supply-chain-auditor --execute
/replay swarm-baseline --base-ref refactor-branch --execute
```

## Behavior

By default, prints the dry-run plan. Add `--execute` to actually create worktrees, spawn the tmux session, and launch agents. The replay session is auto-named `<original>-replay-<n>` so it never collides with the source.

| Flag | Effect |
|---|---|
| `<target>` | Required. Either a bundle file path (`*.json`) or a session name in `.orchestration/`. |
| `--harness <h>` | Override the launcher harness (claude / codex / opencode / windsurf / echo). |
| `--agents a,b,c` | Replace the original agent list. |
| `--base-ref <ref>` | Branch base for replay worktrees (default: from bundle.meta or HEAD). |
| `--session <name>` | Override the auto-generated `-replay-N` suffix. |
| `--replace` | Tear down any existing session/worktrees with the same names. |
| `--execute` | Spawn worktrees + tmux + launch agents. |
| `--write-only` | Just materialize coordination files. |
| `--json` | Print the full plan + planConfig as JSON. |

## Use cases

- **Regression test prompts** — capture a baseline, replay after agent rev, compare handoffs.
- **Reproducible bug reports** — bundle a buggy session, ship to maintainers, they can `replay --execute` locally.
- **Model A/B test** — same task, two harnesses, side-by-side handoff diff.
- **Re-test against new code** — `--base-ref refactor-branch` re-runs the same audit on the new code.
- **Post-mortem** — replay an incident response swarm with new agents to see what they would have caught.

## Companion commands

- `/session-export <name>` — export a coordination dir as a bundle JSON.
- `/session-import <bundle>` — restore a bundle into `.orchestration/`.

## Hard rules

- Never `--execute` without dry-running first.
- Bundles are public artifacts — strip secrets before sharing externally.
- A/B comparisons require human review; never auto-pick winners.

## Implementation

- Skill: `session-replay`
- Bundle library: `scripts/replay/bundle.js`
- Replay engine: `scripts/replay/replay.js`
- CLI: `npx kodelyth-ecc replay`
- Full docs: `docs/replay.md`
