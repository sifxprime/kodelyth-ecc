# Kodelyth ECC — Swarm Orchestrator

Run N ECC specialist agents in parallel inside isolated git worktrees, coordinated by a tmux session.

> **Phase 2.7 of the [Devil Roadmap](../README.md).** Promotes the existing tmux-worktree orchestrator infrastructure to a first-class CLI surface. The generalized form of `/devil-mode` — pick any task, pick any agents, get N panes ready to attach.

---

## Why swarm

A single specialist agent has tunnel vision. A pre-flight production change usually needs:

- Code quality review (`code-reviewer`)
- Security audit (`security-reviewer`)
- API contract check (`api-guardian`)
- Test coverage check (`tdd-guide`)
- UX/a11y pass (`ux-reviewer`)
- Performance check (`performance-optimizer`)
- Doc update (`doc-updater`)
- Release readiness (`release-captain`)

Sequential = 2 hours. Parallel = 15 minutes. Each runs in its own git worktree so their changes don't collide; their handoffs merge into one folder for human review.

---

## CLI quick reference

```bash
# Auto-pick from task signals
npx kodelyth-ecc swarm --task "audit oauth flow for security regressions" --agents 4

# Explicit agent list
npx kodelyth-ecc swarm \
  --task "ship v2.0" \
  --agents release-captain,security-reviewer,e2e-runner,code-reviewer \
  --execute

# Power-user plan.json
npx kodelyth-ecc swarm --plan plan.json --execute
```

| Flag | Description |
|---|---|
| `--task "..."` | Required (unless using `--plan`). The shared task all workers receive. |
| `--agents N` | Smart-pick N specialists from task signals + baseline + rotation. |
| `--agents name1,name2,...` | Explicit agent list. |
| `--harness <h>` | `claude` / `codex` / `opencode` / `windsurf` / `echo`. Default `claude`. |
| `--launcher-cmd "<tmpl>"` | Custom launcher template (overrides `--harness`). |
| `--seed <path>` | Overlay a path from the main repo into each worktree. Repeatable. |
| `--session <name>` | Override the auto-generated tmux session name. |
| `--worktree-root <dir>` | Where to create worktrees. Default: parent of repo. |
| `--coordination-root <dir>` | Where to write coordination files. Default: `<repo>/.orchestration/`. |
| `--base-ref <ref>` | Branch base for all worktrees. Default: `HEAD`. |
| `--replace` | Tear down any existing session/worktrees/branches with the same names. |
| `--execute` | Actually create worktrees + tmux + launch. |
| `--write-only` | Just write coordination files. |
| `--json` | Print the full plan as JSON. |
| `--plan plan.json` | Use a hand-written plan (skips auto-build). |

Default mode is **dry-run** — prints a summary and does NOT spawn anything. Always inspect first.

---

## Smart agent picking

When you pass `--agents N` (a number), the swarm picks specialists in this priority order:

### 1. Signal-driven (highest priority)

Task text is scanned for 14 signal classes. Each match adds a specialist. Examples:

| Task contains | Picks |
|---|---|
| `security`, `auth`, `vuln`, `cve`, `injection`, `owasp` | `security-reviewer` |
| `perf`, `slow`, `p99`, `latency`, `bottleneck` | `performance-optimizer` |
| `load test`, `stress test`, `capacity`, `k6` | `load-tester` |
| `architect`, `design`, `ADR`, `RFC`, `trade-off` | `architect` |
| `api`, `endpoint`, `contract`, `breaking change` | `api-guardian` |
| `test`, `tdd`, `coverage`, `spec` | `tdd-guide` |
| `refactor`, `tech debt`, `code smell` | `refactor-cleaner` |
| `ux`, `accessibility`, `wcag`, `a11y` | `ux-reviewer` |
| `doc`, `readme`, `guide`, `tutorial` | `doc-updater` |
| `release`, `ship`, `tag`, `semver` | `release-captain` |
| `incident`, `outage`, `down`, `P0`, `P1` | `incident-commander` |
| `debug`, `why is`, `stack trace`, `silent fail` | `debug-detective` |
| `database`, `sql`, `postgres`, `index`, `n+1` | `database-reviewer` |
| `devil-mode`, `adversarial`, `red team` | `prompt-injection-hunter` |

### 2. Baseline anchors

`code-reviewer` and `pair-programmer` are added if not already picked — every task benefits from generalist eyes.

### 3. Rotation fill

If we still need more, fills from a tuned default rotation:

| Count | Rotation |
|---|---|
| 4 | code-reviewer, security-reviewer, pair-programmer, tdd-guide |
| 6 | + performance-optimizer, api-guardian |
| 8 | + ux-reviewer, doc-updater |

You can always override the picker with `--agents code-reviewer,security-reviewer,architect`.

---

## Coordination protocol

Each worker gets three files in `<coord-root>/<session>/<worker-slug>/`:

### `task.md` (auto-generated)

Agent-shaped task with required handoff sections:

```
# <agent> — swarm task

You are running as the ECC `<agent>` specialist in a parallel swarm. Other agents
are running the same shared task in sibling worktrees. Stay strictly inside your
specialty — do not duplicate what other agents will cover. Produce a focused
handoff that names exactly which findings are yours and yours alone.

## Shared Task
<your task>

## Required handoff sections
1. Summary
2. Files Changed
3. Validation
4. Remaining Risks
```

### `handoff.md` (worker fills in)

Where the worker's output lands. Watched by the launcher.

### `status.md` (launcher updates)

`running` / `completed` / `failed` plus timestamp + branch + worktree path.

Monitor a swarm in flight:

```bash
# All worker statuses
cat .orchestration/<session>/*/status.md

# Specific handoff
cat .orchestration/<session>/security-reviewer/handoff.md
```

---

## Harness adapters

| `--harness` | Launcher template |
|---|---|
| `claude` | `claude --print --dangerously-skip-permissions "$(cat {task_file_sh})" 2>&1 \| tee -a {handoff_file_sh}; ...` |
| `codex` | `bash {repo_root}/scripts/orchestrate-codex-worker.sh {task_file_sh} {handoff_file_sh} {status_file_sh}` |
| `opencode` | `opencode run --task-file {task_file_sh} --output {handoff_file_sh} --status {status_file_sh}` |
| `windsurf` | `windsurf-cli run --task-file {task_file_sh} --output {handoff_file_sh}` |
| `echo` | `printf 'demo {worker_slug}\n' >> {handoff_file_sh}; printf 'state: completed\n' >> {status_file_sh}` |

Custom harness via `--launcher-cmd`. Available placeholders:

```
{worker_name} {worker_slug} {session_name} {repo_root}
{worktree_path} {branch_name} {task_file} {handoff_file} {status_file}
```

Suffix with `_sh` for shell-quoted variants: `{task_file_sh}`, `{handoff_file_sh}`, etc.

---

## Worktree lifecycle

1. **Pre-flight** — verify `git rev-parse --is-inside-work-tree` and `tmux -V`.
2. **Cleanup** — if `--replace`, tear down any existing session, worktrees, branches.
3. **Materialize** — write coordination files for every worker.
4. **Branch + worktree** — `git worktree add -b orchestrator-<session>-<slug> <path> <base-ref>`.
5. **Seed overlay** — copy any `--seed` paths into each worktree.
6. **Tmux session** — `tmux new-session -d -s <session> -n orchestrator -c <repo>`.
7. **Per-worker pane** — `tmux split-window` + `select-pane` + `send-keys` to launch.

On failure, automatic rollback removes worktrees, branches, and the tmux session in reverse order.

Manually clean up later:

```bash
tmux kill-session -t <session>
git worktree list                    # verify
git worktree remove <path>
git branch -D orchestrator-<session>-<slug>
rm -rf .orchestration/<session>
```

---

## Pairing with the rest of ECC

| Pairs with | How |
|---|---|
| **`/devil-mode`** | Devil-mode is a hardcoded swarm of adversarial agents. Swarm generalizes it. |
| **Phase 2.4 cost router** | Each worker classifies its own task tier; security/incident workers force hard. |
| **Phase 2.10 token-budget hook** | Each worker has its own token budget — one rogue worker can't blow the cap. |
| **Phase 2.5 MCP client mode** | Workers can call registered external MCP servers (github, postgres, brave, redis). |
| **kodelyth-memory** | Save the merged handoff bundle: `kodelyth-ecc remember "..." --approach "..."`. |
| **`release-captain`** | After a swarm, run `release-captain` to merge the best work and ship. |

---

## Hard rules

1. **Never `--execute` without inspecting the dry-run first.** Worktree creation mutates the repo.
2. **Don't mix incompatible agents.** `release-captain` + `migration-guide` in the same swarm produces conflicting handoffs.
3. **Cap N at 8 for a single repo.** Past 8, worktree contention + pane crowding hurts.
4. **Never share tmux sessions.** Use `--session NAME` explicitly when running multiple swarms.
5. **Always human-merge handoffs.** Don't auto-apply changes from N parallel agents.

---

## Troubleshooting

**`tmux session already exists`** — pass `--replace` to tear it down, or `--session <new-name>`.

**`Worker X is missing a launcherCommand`** — pass `--harness <name>` or `--launcher-cmd "<template>"`.

**`seedPaths entries must stay inside repoRoot`** — the seed must be a subpath of the repo, not an absolute external path.

**Worktrees have stale state** — `--replace` cleans them. Or manually: `git worktree prune --expire now`.

**A worker stalled** — `tmux attach -t <session>` and inspect its pane. Or `cat .orchestration/<session>/<slug>/status.md`.

---

## Roadmap interactions

- **Phase 2.3 — local dashboard** will surface live swarm status (running / completed / failed per worker, latency, token usage).
- **Phase 2.6 — sandbox layer** will optionally Docker-isolate each worker.
- **Phase 2.8 — replay** will let you replay a finished swarm from its coordination files.

---

Built into [Kodelyth ECC](../README.md). MIT licensed.
