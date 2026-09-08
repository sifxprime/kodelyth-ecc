---
description: Spawn N specialist agents in parallel inside isolated git worktrees + a tmux session. Generalized /devil-mode.
argument-hint: "[task description] [--agents N|name1,name2,...] [--harness claude|codex|opencode|windsurf]"
---

# /swarm

Run a parallel team of ECC specialists on the same task in isolated git worktrees coordinated by a tmux session. The generalized form of `/devil-mode`, `/team-review`, `/security-audit`, and `/pre-release` — pick any task, pick any agents, get N panes ready to attach.

## Quick examples

```
/swarm audit oauth flow for security regressions
/swarm ship v2.0 --agents release-captain,security-reviewer,e2e-runner --execute
/swarm refactor payments module --agents 6 --harness codex --execute
/swarm production is down, auth service 502s --agents incident-commander,debug-detective,silent-failure-hunter --execute
```

## Behavior

By default, prints the dry-run plan (safe to inspect). Add `--execute` to actually create worktrees, spawn the tmux session, and launch agents.

| Flag | Effect |
|---|---|
| `--task "..."` | Required (or use `--plan plan.json`). |
| `--agents N` | Smart-pick N specialists from task signals + baseline anchors + rotation. |
| `--agents name1,name2,...` | Explicit agent list. |
| `--harness claude\|codex\|opencode\|windsurf\|echo` | Launcher template (default `claude`). |
| `--seed <path>` | Overlay path from main repo into each worktree (e.g. `--seed .env`). |
| `--base-ref <ref>` | Branch base for all worktrees (default `HEAD`). |
| `--session <name>` | Override the auto-generated tmux session name. |
| `--replace` | Tear down any existing session/worktrees with the same names. |
| `--execute` | Create worktrees + tmux + launch agents. |
| `--write-only` | Just write coordination files without spawning. |
| `--json` | Print the full plan as JSON. |

## Smart agent picking

If you pass `--agents N` (a number), the swarm picks specialists in this order:

1. **Signal-driven** — task keywords match specialist (security → `security-reviewer`, perf → `performance-optimizer`, API → `api-guardian`, …).
2. **Baseline anchors** — `code-reviewer` + `pair-programmer` get added (every task benefits).
3. **Rotation fill** — 4/6/8-agent default rotations tuned for breadth.

## Hard rules

- Never `--execute` without inspecting the dry-run first.
- Cap N at 8 for a single repo (worktree + pane contention past 8).
- Always human-merge handoffs from N parallel agents — don't auto-apply.
- Use `--session NAME` if running multiple swarms in parallel.

## Coordination protocol

Each worker gets three files in `<repo>/.orchestration/<session>/<worker-slug>/`:

- `task.md` — agent-shaped task with required handoff sections
- `handoff.md` — where the agent writes its output
- `status.md` — running/completed/failed marker

Inspect any worker's progress with `cat .orchestration/<session>/<slug>/status.md`.

## Implementation

- Skill: `swarm-orchestrator`
- Builder: `scripts/swarm/build-plan.js`
- Orchestrator: `scripts/lib/tmux-worktree-orchestrator.js`
- CLI: `npx kodelyth-ecc swarm`
- Full docs: `docs/swarm.md`
