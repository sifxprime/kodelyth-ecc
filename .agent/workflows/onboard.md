---
description: Parallel codebase onboarding — fires code-explorer + architect + doc-updater simultaneously. Understand any codebase in 15 minutes instead of 3 days.
---

# /onboard — Parallel Codebase Onboarding

Three agents map your codebase simultaneously — architecture, execution paths, and documentation gaps. New to a repo? Get up to speed in 15 minutes.

## What Gets Launched in Parallel

| Agent | Focus |
|---|---|
| `code-explorer` | Traces execution paths, maps data flow, identifies key entry points and dependencies |
| `architect` | Infers the architectural pattern, layers, module boundaries, and design decisions |
| `doc-updater` | Identifies documentation gaps, stale docs, and missing READMEs or JSDoc |

## Usage

```
/onboard                             # full codebase overview
/onboard src/payments/               # focus on a specific module
/onboard --new-hire                  # adds kodelyth-advisor for getting-started guidance
/onboard --audit                     # adds code-reviewer for quality assessment
```

## Report Format

```
## ONBOARDING REPORT

### Architecture (architect)
PATTERN:    [MVC / hexagonal / microservices / etc.]
LAYERS:     [how the code is organized]
KEY FILES:  [the 5–10 files you must understand first]
DECISIONS:  [notable architectural choices and why]

### Execution Paths (code-explorer)
ENTRY POINTS: [main flows — auth, data, API, jobs]
DATA FLOW:    [how data moves through the system]
DEPENDENCIES: [what talks to what]
GOTCHAS:      [non-obvious behaviours]

### Documentation Health (doc-updater)
MISSING:   [modules with no docs]
STALE:     [docs that no longer match the code]
GAPS:      [API endpoints with no documentation]

---
TIME TO PRODUCTIVE: estimated X days
FIRST 3 THINGS TO READ: [ordered list]
```

## When to Use

- First day on a new codebase
- Reviewing a large PR in an unfamiliar module
- Taking over a project from another team
- Returning to code you haven't touched in 6+ months
- Evaluating an open-source repo before adopting it

## Execute Now

Invoking this command is confirmation to proceed. Execute immediately:

1. Determine scope from `$ARGUMENTS`. Default: entire current project.
2. Spawn all agents simultaneously with `run_in_background: true`:
   - `code-explorer` — execution path tracing and dependency mapping
   - `architect` — architectural pattern inference
   - `doc-updater` — documentation gap analysis
3. Wait for all to complete.
4. Aggregate into the Onboarding Report format above.
5. End with: "Which area do you want to explore deeper first?"
