---
description: Parallel refactor sprint — fires refactor-cleaner + code-simplifier + type-design-analyzer + tdd-guide simultaneously. Full cleanup in one pass.
---

# /refactor-sprint — Parallel Refactor Sprint

Four agents clean, simplify, type-harden, and test-cover your code simultaneously. What would take a full day of careful manual work is scoped and planned in 15 minutes.

## What Gets Launched in Parallel

| Agent | Focus |
|---|---|
| `refactor-cleaner` | Dead code, unused imports, duplicate logic, copy-paste debt, tech debt |
| `code-simplifier` | Complex functions, deep nesting, clever one-liners, readability improvements |
| `type-design-analyzer` | `any` types, weak discriminated unions, missing type guards, type safety gaps |
| `tdd-guide` | Test coverage gaps, missing unit tests, untested edge cases, coverage below 80% |

## Usage

```
/refactor-sprint                     # full repo
/refactor-sprint src/auth/           # focus on a module
/refactor-sprint --types-only        # skip cleanup, focus on type safety
/refactor-sprint --tests-only        # skip cleanup, focus on test coverage
```

## Report Format

```
## REFACTOR SPRINT REPORT

### Dead Code & Debt (refactor-cleaner)
REMOVE:    [files, functions, imports to delete]
EXTRACT:   [duplicated logic to consolidate]
DEBT:      [tech debt items ranked by impact]

### Simplification (code-simplifier)
COMPLEX:   [functions that need splitting]
NESTING:   [deep nesting to flatten with early returns]
READABILITY: [naming and clarity improvements]

### Type Safety (type-design-analyzer)
ANY_USAGE: [locations using any/unknown unsafely]
WEAK_TYPES:[discriminated unions to strengthen]
GUARDS:    [missing type guards]

### Test Coverage (tdd-guide)
UNCOVERED: [critical paths with no tests]
GAPS:      [edge cases missing]
PLAN:      [test writing priority order]

---
TOTAL DEBT: X items | QUICK WINS: Y items
RECOMMENDED ORDER: [prioritized action list]
```

## When to Use

- Before a major feature addition (clean house first)
- After a fast-moving sprint that accumulated debt
- Monthly code health pass
- Before onboarding a new team member
- When coverage has dropped below 80%

## Execute Now

Invoking this command is confirmation to proceed. Execute immediately:

1. Determine scope from `$ARGUMENTS`. Default: entire current project.
2. Spawn all agents simultaneously with `run_in_background: true`:
   - `refactor-cleaner` — dead code and duplicate logic audit
   - `code-simplifier` — complexity and readability analysis
   - `type-design-analyzer` — type safety audit
   - `tdd-guide` — test coverage gap analysis
3. Wait for all to complete.
4. Aggregate into the Refactor Sprint Report above with a prioritized action list.
5. End with: "Which area do you want to tackle first?"
