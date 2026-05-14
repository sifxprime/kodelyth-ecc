---
description: Parallel pre-release check — fires release-captain + security-reviewer + code-reviewer simultaneously. Go/no-go in one command before you ship.
---

# /pre-release — Parallel Release Readiness Check

Three agents verify your release is safe to ship. Catches the things that turn a Friday deploy into a weekend incident.

## What Gets Launched in Parallel

| Agent | Focus |
|---|---|
| `release-captain` | Semver correctness, changelog complete, rollback plan, smoke test coverage |
| `security-reviewer` | Last-minute security gaps, secrets, auth issues before code goes live |
| `code-reviewer` | Critical quality issues, dead code, regressions introduced in this release |

## Usage

```
/pre-release                     # check current branch vs main
/pre-release v2.1.0              # check specific version tag
/pre-release --hotfix            # fast-track: release-captain only, skip style issues
```

## Report Format

```
## PRE-RELEASE REPORT

### Release Readiness (release-captain)
SEMVER:    [correct / incorrect]
CHANGELOG: [complete / missing entries]
ROLLBACK:  [plan exists / missing]
SMOKE:     [covered / gaps]

### Security Clearance (security-reviewer)
CRITICAL: [list — block if any]
HIGH:     [list]

### Code Quality (code-reviewer)
CRITICAL: [list — block if any]
HIGH:     [list]

---
VERDICT: SHIP / FIX CRITICAL FIRST / BLOCK
```

## When to Use

- Before cutting any release tag
- Before merging a large feature branch
- Before a hotfix deploy under pressure
- As the final gate before `npm publish` or production push

## Execute Now

Invoking this command is confirmation to proceed. Execute immediately:

1. Determine target from `$ARGUMENTS` (version tag, branch, or current state).
2. Spawn all agents simultaneously with `run_in_background: true`:
   - `release-captain` — release ritual check: semver, changelog, rollback
   - `security-reviewer` — security clearance scan
   - `code-reviewer` — final quality gate
3. Wait for all to complete.
4. Aggregate into the Pre-Release Report format above with a clear SHIP / BLOCK verdict.
5. End with: "Ready to proceed with the release?" or list what must be fixed first.
