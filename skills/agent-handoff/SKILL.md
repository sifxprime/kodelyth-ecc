---
name: agent-handoff
description: >
  How to chain ECC specialist agents for multi-step problems —
  pair-programmer → tdd-guide → code-reviewer → security-reviewer.
  Use when one agent finishes its job and the next logical step needs
  a different specialist. Documents the standard handoff protocol so
  agents pass context cleanly.
---

# Agent Handoff Protocol

Single agents handle single concerns. Real engineering tasks span multiple concerns. **Handoffs** are how ECC chains agents without losing context.

## The 3-Line Handoff Protocol

When an agent finishes its scope and the next step needs a different specialist, it ends with exactly this shape:

```
─────────────────────────────────────
HANDOFF
  From: <current-agent>
  To:   <next-agent>
  Why:  <one-line reason>
  Carry: <what the next agent needs to know>
─────────────────────────────────────
```

Then **stop**. The next agent picks up from `Carry:`.

## Standard Chains

These are the most common multi-agent flows. Memorize them.

### Build something new (clean path)

```
pair-programmer  →  tdd-guide  →  code-reviewer  →  api-guardian (if API)
                                              →  security-reviewer (if sensitive)
                                              →  ux-reviewer (if UI)
```

`pair-programmer` agrees on approach. `tdd-guide` writes failing tests first. The implementer writes code. `code-reviewer` checks it. Specialist reviewers check their domain.

### Bug in production

```
debug-detective  →  tdd-guide          →  refactor-cleaner (optional)
                 (root cause)        (regression test)
```

Always add a regression test after a real-bug fix. Always.

### Refactor a module

```
code-explorer    →  refactor-cleaner   →  tdd-guide        →  code-reviewer
(map dependencies)  (cleanup)          (verify behavior)
```

### Performance investigation

```
performance-optimizer  →  tdd-guide       →  code-reviewer
                       (perf regression test)
```

### API change

```
api-guardian  →  pair-programmer  →  tdd-guide  →  doc-updater
(blast radius)  (impl approach)                   (changelog)
```

### Security audit

```
security-reviewer  →  tdd-guide               →  release-captain
                   (security regression test)  (patch release)
```

### Open-source a private project

```
opensource-forker  →  opensource-sanitizer  →  opensource-packager  →  release-captain
(make a clean fork) (strip secrets/PII)      (README, license, examples)  (cut v0.1.0)
```

### Framework migration

```
migration-guide  →  pair-programmer  →  tdd-guide  →  pr-test-analyzer
(phase plan)        (per-phase impl)              (verify coverage on PR)
```

### Build is broken

```
build-error-resolver  →  dependency-doctor (if dep issue)
                      →  env-debugger (if env issue)
                      →  debug-detective (if it's actually a runtime bug surfacing at build)
```

### CI is flaky

```
flake-hunter  →  tdd-guide       →  release-captain (if it gates a release)
              (deterministic test)
```

### Git is on fire

```
git-rescue  →  release-captain (if a release was midway)
```

## Carry Field — What to Pass Forward

The `Carry:` line is the most important. Bad carry breaks the chain.

**Good carry:**
> "Bug is in `processPayment()` line 142 — race between `lockBalance()` and `commitTx()`. The lock returns before the DB transaction is durable. Add a regression test that simulates a 50ms commit delay and asserts no double-spend."

**Bad carry:**
> "There was a bug, please test it"

The next agent should be able to start work from `Carry:` alone, without re-reading the whole conversation.

## When NOT to Hand Off

- The current agent's job isn't actually done. Finish it.
- The user explicitly said "just do this one thing." Respect it.
- The next step is **trivial** and a handoff would slow it down (e.g., a one-line change). Just do it.
- The user is **already in flow** and a handoff context-switch would interrupt them. Wait for a natural pause.

## Parallel Handoffs

Some problems need multiple agents at once, not in sequence:

```
"Building a new payment endpoint" →

  [PARALLEL]
   ├─ api-guardian       (contract review)
   ├─ security-reviewer  (auth, input validation, idempotency)
   └─ pair-programmer    (overall approach)

  [SEQUENTIAL after agreement]
   tdd-guide → implementer → code-reviewer
```

Announce the parallel set up front so the user knows what's happening:

```
This touches three concerns at once. I'm consulting:
  • api-guardian      — for contract design
  • security-reviewer — for auth & validation
  • pair-programmer   — for overall structure

Then we'll move to tests + implementation.
```

## Handoff Hygiene

- **Always** name both agents (from/to)
- **Always** justify the handoff in one line (why this specialist now?)
- **Always** package the carry — the next agent should not need to re-investigate
- **Never** chain more than 4 agents in a single response — that's a sign the task is too big and needs decomposition (use `planner`)

## Self-Handoff Rule

An agent may **stay in role** for the next step if it's still within its specialty. Don't fake a handoff just because the conversation continues:

- `debug-detective` may continue after finding the cause to **explain** the cause — that's still debugging.
- `code-reviewer` may continue to suggest specific fixes — still review scope.
- But `code-reviewer` writing the actual fix at scale → hand off to the implementer (or appropriate language reviewer with `code-architect` for blueprint).

## The Master Conductor: kodelyth-advisor

When in doubt about whom to hand off to, the user can always invoke `kodelyth-advisor`. The advisor doesn't do the work — it picks the right specialist and routes.

```
Any agent  →  kodelyth-advisor (if next step is unclear)  →  Right specialist
```
