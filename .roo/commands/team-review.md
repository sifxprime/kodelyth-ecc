---
description: Parallel full-team audit for existing projects. Fires code-reviewer + security-reviewer + performance-optimizer + api-guardian simultaneously. One command, complete audit at once.
---

# /team-review — Parallel Full-Team Audit

Run a full audit of your existing codebase with 4 specialist agents firing simultaneously. What would take an hour sequentially takes 15 minutes in parallel.

## Usage

```
/team-review                    # full audit — all 4 agents on entire codebase
/team-review src/auth/          # focus all agents on a specific directory
/team-review --changed          # audit only files changed since last commit
/team-review --pre-release      # adds release-captain for release readiness check
```

## What Gets Launched in Parallel

| Agent | Focus |
|---|---|
| `code-reviewer` | Quality, patterns, dead code, naming, complexity, maintainability |
| `security-reviewer` | OWASP Top 10, secrets, injection, auth gaps, CVEs in deps |
| `performance-optimizer` | N+1 queries, unbounded loops, missing indexes, memory leaks, bundle size |
| `api-guardian` | Breaking changes, missing validation, versioning gaps, contract drift |

With `--pre-release`, also adds:
- `release-captain` — release readiness: changelog, semver, rollback plan, smoke test coverage

## How It Works

1. Identify the target scope (whole repo, directory, or changed files)
2. Spawn all 4 agents simultaneously with `run_in_background: true`
3. Each agent scans its assigned concern independently
4. Wait for all to complete
5. Aggregate into a structured **Team Review Report**:

```
## TEAM REVIEW REPORT

### Code Quality (code-reviewer)
CRITICAL: [list]
HIGH:     [list]
MEDIUM:   [list]

### Security (security-reviewer)
CRITICAL: [list]
HIGH:     [list]

### Performance (performance-optimizer)
HIGH:     [list]
MEDIUM:   [list]

### API Contracts (api-guardian)
BREAKING: [list]
WARN:     [list]

---
TOTAL: X critical, Y high, Z medium
RECOMMENDATION: [ship / fix critical first / block]
```

6. After report: "Which finding do you want to fix first?"

## Severity Levels

| Level | Meaning | Action |
|---|---|---|
| CRITICAL | Security vulnerability, data loss, production breakage | Block — fix before merge |
| HIGH | Bug, broken contract, significant perf regression | Fix before shipping |
| MEDIUM | Maintainability debt, minor perf, code smell | Fix when convenient |
| LOW | Style, suggestion | Optional |

## When to Use

- Before any major PR merge
- Pre-release audit
- Onboarding to an unfamiliar codebase (run `/team-review` to get the full picture fast)
- After a large refactor
- Monthly health check on long-running projects

## Time and Token Efficiency

Sequential audit (4 agents one by one): ~40–60 minutes, full context per agent.
`/team-review` parallel: ~10–15 minutes, narrow focused context per agent.
System prompt cached across all agents → each pays 10% on that prefix.

## Arguments

$ARGUMENTS

---

## Execute Now

Invoking this command is confirmation to proceed. Do not show this documentation to the user — execute immediately:

1. Identify the target scope from `$ARGUMENTS` (directory, `--changed`, `--pre-release`). Default: entire current project.
2. Spawn all agents simultaneously using `run_in_background: true`:
   - `code-reviewer` — quality, patterns, complexity, naming
   - `security-reviewer` — OWASP Top 10, secrets, auth gaps
   - `performance-optimizer` — N+1, memory, bundle size, slow queries
   - `api-guardian` — breaking changes, contract drift, missing validation
   - If `--pre-release` in args: also spawn `release-captain`
3. Wait for all agents to complete.
4. Aggregate results into the Team Review Report format above.
5. End with: "Which finding do you want to fix first?"
