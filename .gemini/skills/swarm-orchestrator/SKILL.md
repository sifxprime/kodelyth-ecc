---
name: swarm-orchestrator
description: Run N ECC specialist agents in parallel inside isolated git worktrees coordinated by a tmux session. Generalizes /devil-mode to arbitrary task + agent combinations. Use when one agent isn't enough — you want a parallel sweep across security, code quality, perf, UX, tests, architecture, and docs simultaneously.
origin: ECC
---

# Swarm Orchestrator — Parallel Agent Execution at Scale

The "team-of-specialists" pattern. Where `/devil-mode` is a fixed adversarial sweep with 4–8 specific agents, swarm is the **generalized form**: pick any task, pick any agents (or let ECC pick from task signals), get N parallel worktrees + a tmux session ready to attach.

> Phase 2.7 of the [Devil Roadmap](../../README.md). Promotes the existing `tmux-worktree-orchestrator` infrastructure to a first-class CLI surface.

---

## When to invoke

Trigger this skill when:

- A task is too cross-cutting for one specialist (touches security AND perf AND API AND tests).
- The user asks for "parallel review", "multi-agent sweep", "parallel agents", or "team review".
- A change is high-stakes and you want defense-in-depth (security audit + UX + perf + arch in 15 min instead of 60).
- The user has 4+ cores and wants throughput.

Don't invoke when:

- The task is genuinely single-axis (just security → use `security-reviewer` directly).
- The repo is tiny enough that worktree overhead exceeds review time.
- The user is on a machine without tmux/git worktree support.

---

## CLI surface

```bash
# Auto-pick agents from task signals.
npx kodelyth-ecc swarm --task "audit the new oauth flow for security regressions" --agents 4

# Explicit agent list.
npx kodelyth-ecc swarm --task "ship v2.0" \
  --agents release-captain,security-reviewer,e2e-runner,code-reviewer \
  --execute

# Different harness (codex / opencode / windsurf).
npx kodelyth-ecc swarm --task "refactor payment module" --agents 6 --harness codex --execute

# Power-user: hand-written plan.
npx kodelyth-ecc swarm --plan plan.json --execute
```

Three execution modes:

| Mode | Effect |
|---|---|
| (default) dry-run | Prints the plan. Doesn't spawn anything. Safe to inspect. |
| `--write-only` | Materializes coordination files (`task.md`, `handoff.md`, `status.md`) but doesn't spawn worktrees or tmux. |
| `--execute` | Creates git worktrees, spawns tmux session, launches each agent in its own pane. |

---

## Smart agent picking

When you pass `--agents N` (a number), the swarm picks specialists in this priority order:

1. **Signal-driven** — task keywords match agent specialties (security → `security-reviewer`, perf → `performance-optimizer`, API → `api-guardian`, etc.). 14 signal classes.
2. **Baseline anchors** — `code-reviewer` and `pair-programmer` are added if not already picked (every task benefits from generalist eyes).
3. **Rotation fill** — fills remaining slots from a 4 / 6 / 8-agent default rotation tuned for breadth.

You can always override with `--agents code-reviewer,security-reviewer,architect`.

---

## Harness adapters

| `--harness` | Launcher | Notes |
|---|---|---|
| `claude` | `claude --print --dangerously-skip-permissions ...` | Default. Works with Claude Code. |
| `codex` | `bash scripts/orchestrate-codex-worker.sh ...` | Codex CLI worker with full status tracking. |
| `opencode` | `opencode run --task-file ...` | OpenCode harness. |
| `windsurf` | `windsurf-cli run --task-file ...` | Windsurf agent. |
| `echo` | trivial echo | For dry-run validation only. |

Use `--launcher-cmd "<your-template>"` to plug a custom harness. Available placeholders:

```
{worker_name} {worker_slug} {session_name} {repo_root}
{worktree_path} {branch_name} {task_file} {handoff_file} {status_file}
```

Add `_sh` suffix for shell-quoted variants (`{task_file_sh}`, etc.).

---

## Coordination protocol

Every worker gets three files in the coordination dir:

- **`task.md`** — agent-shaped task with required handoff sections (Summary, Files Changed, Validation, Remaining Risks). Generated automatically.
- **`handoff.md`** — where the worker writes its output. Watched by the launcher.
- **`status.md`** — running / completed / failed marker for monitoring scripts and the future dashboard.

Workers run in **isolated git worktrees** branched from `--base-ref` (default: `HEAD`). Each gets a unique branch (`orchestrator-<session>-<slug>`). Cleanup is automatic on failure (rolls back worktrees, branches, and tmux session).

---

## Pairing with the rest of ECC

| Pairs with | How |
|---|---|
| **`/devil-mode`** | Devil-mode is a hardcoded swarm of adversarial agents. Swarm generalizes it to arbitrary specialists. |
| **Phase 2.4 cost router** | Each worker gets the same model-tier recommendation; security/incident workers force hard tier. |
| **Phase 2.10 token-budget hook** | Each worker has its own session token-budget — one rogue worker can't burn the whole budget. |
| **Phase 2.5 MCP client mode** | Workers can call registered external MCP servers (github, postgres, brave). |
| **kodelyth-memory** | Capture the merged handoff bundle as a memory: `kodelyth-ecc remember "swarm 2026-05-10 oauth audit" --approach "..."`. |
| **release-captain** | After a swarm, run `release-captain` to merge the best work and ship. |

---

## Examples

### Pre-launch full sweep (8 agents, parallel)

```bash
npx kodelyth-ecc swarm \
  --task "Pre-launch sweep for v2.0 — security, perf, UX, API contracts, docs, tests, release readiness" \
  --agents 8 \
  --replace \
  --execute

# Attach when ready:
tmux attach -t swarm-2026-05-10-8a
```

### Production incident: 3-agent parallel triage

```bash
npx kodelyth-ecc swarm \
  --task "Production is down. Auth service throwing 502s. Triage and propose fixes." \
  --agents incident-commander,debug-detective,silent-failure-hunter \
  --base-ref main \
  --execute
```

### Refactor sprint with seeded files

```bash
npx kodelyth-ecc swarm \
  --task "Refactor the payments module for testability without changing behavior" \
  --agents refactor-cleaner,code-simplifier,type-design-analyzer,tdd-guide \
  --seed src/payments \
  --seed tests/payments \
  --execute
```

---

## Hard rules

1. **Never run `--execute` without inspecting the dry-run first.** Worktree creation mutates the repo; bad plans waste disk.
2. **Don't mix incompatible agents in one swarm.** Putting `release-captain` and `migration-guide` in the same swarm produces conflicting handoffs.
3. **Cap N at 8 for a single repo.** Worktree contention + tmux pane crowding hurts past 8.
4. **Never share tmux sessions across swarms.** Use `--session NAME` explicitly when running multiple swarms.
5. **Always merge handoffs through human review** — don't auto-apply changes from N parallel agents without a human pass.

---

## Implementation

- Plan builder: `scripts/swarm/build-plan.js` (pure function, fully tested).
- Orchestrator: `scripts/lib/tmux-worktree-orchestrator.js` (the existing infrastructure).
- Worker (codex): `scripts/orchestrate-codex-worker.sh`.
- CLI: `npx kodelyth-ecc swarm`.
- Slash command: `/swarm`.
- Full reference: `docs/swarm.md`.

---

Built into [Kodelyth ECC](../../README.md). MIT licensed.
