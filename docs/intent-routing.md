---
title: "Intent Routing v2 — Plain-Language to Specialist Agent in Claude Code"
description: "How Kodelyth ECC routes plain-language messages to 70 specialist AI agents automatically. 8 confidence dimensions, session-state awareness, terse-mode integration, evolve pipeline."
keywords:
  - AI agent routing
  - intent routing Claude
  - agent selection AI
  - specialist AI agent
  - Kodelyth intent routing
  - AI toolkit routing
  - semantic routing
  - AI agent handoff
  - Claude Code agents
  - multi-agent AI
og_title: "Intent Routing v2 — Kodelyth ECC"
og_description: "8-dimension routing model — confidence tiers, session state, compound intent, terse mode, evolve integration."
og_image: /social/hype-parallel-agents.svg
og_type: article
twitter_card: summary_large_image
canonical: /docs/intent-routing/
last_updated: 2026-07-04
version: 2.4.1
category: feature
---

# Intent Routing v2

The always-on rule that maps plain-language user messages to the right specialist agent — no `use <agent>` syntax required.

Lives at `rules/common/agent-intent-routing.md` (832 lines, auto-loaded by every AI-tool session). Under 5% of routing decisions require the user to know an agent's name. The rest is inference.

## The 10-tier signal system

Ten priority tiers cover the domain. Higher tiers win when signals overlap.

| Priority | Family | Example agents |
|---|---|---|
| 1 | Crisis & emotional | `kodelyth-advisor`, `pair-programmer` |
| 2 | Active pain (broken) | `debug-detective`, `silent-failure-hunter`, `build-error-resolver` |
| 3 | Quality & review | `code-reviewer`, `security-reviewer`, `api-guardian`, `ux-reviewer`, 8 devil-mode adversarial agents |
| 4 | Performance & scale | `incident-commander`, `load-tester`, `performance-optimizer` |
| 5 | Planning & architecture | `planner`, `architect`, `code-architect`, `migration-guide` |
| 6 | Testing | `tdd-guide`, `e2e-runner`, `pr-test-analyzer` |
| 7 | Code hygiene | `refactor-cleaner`, `code-simplifier`, `type-design-analyzer` |
| 8 | Documentation | `doc-updater`, `docs-lookup`, `comment-analyzer` |
| 9 | Specialised workflows | `chief-of-staff`, `seo-specialist`, opensource pipeline |
| 10 | Multi-agent patterns | Parallel commands (`/team-review`, `/debug-blitz`, `/devil-mode`, ...) |

Each tier has 4-12 signal tables of real human phrasing. The AI reads intent — not keywords.

## Routing v2 — 8 new dimensions layered on top

### 1. Confidence tiers

| Tier | Trigger | AI behaviour |
|---|---|---|
| **High** | 2+ signals from one table, OR 1 signal + emotion, OR explicit `use X` / `@X` | Route immediately, one-line announcement |
| **Medium** | 1 clean signal, no counter-signals | Route + "not X? say so, I'll switch" tail |
| **Low** | 1 weak signal, or signals from 2+ tables of similar priority | Do NOT auto-route. Name the 2 best candidates in one line, ask which fits |
| **None** | No signal, or explicit anti-routing | Answer directly, no routing announcement |

### 2. Session-state awareness (sticky routing)

Once you've routed to an agent this session, **stay in its voice** for follow-ups on the same thread unless:

- The next message contains a **stronger signal** for a different agent
- The user says "back to normal", "stop routing", "just answer me"
- The task has clearly concluded

**Never re-announce the same routing.** Sticky = quiet. Only re-announce when the agent actually changes.

### 3. Anti-routing whitelist

Skip Priority 1-10 entirely when:

- Message is under 5 words with no error/code paste ("hi", "ok", "thanks", "cool")
- Message is a factual question with a one-line answer ("what does `git stash pop` do?")
- User already invoked with `use X`, `@X`, `run <agent>` — respect explicit choice
- User said "don't route" / "just answer" / "stop routing" this session
- User is mid-workflow with a previous agent
- The message is a bug report about ECC itself — answer as maintainer, not specialist

### 4. New signal families (v2.4+)

| User says | Routes to |
|---|---|
| "compress this memory file" / "shrink CLAUDE.md" | `/terse-compress` |
| "talk shorter" / "be brief" / "caveman mode" | `/terse` (skill activation) |
| "who calls X" / "trace call chain" / "impact analysis" | `codebase-memory-mcp` — `search_graph` / `trace_path` |
| "index this project" / "build the graph" | `codebase-memory-mcp` — `index_repository` |
| "remove ECC" / "uninstall kodelythecc" | `kodelythecc uninstall --dry-run` |
| "how much did I save" / "RTK stats" | `kodelythecc dashboard` OR `kodelythecc rtk gain` |
| "install for another IDE" / "add to Cursor" | `kodelythecc --target <ide>` |

### 5. Compound intent → parallel commands

When a message matches **two priority tables at once**, fire the parallel command instead of both agents sequentially.

| Signals | Fires |
|---|---|
| security question + review question | `/security-audit` |
| bug + been-stuck-for-hours + multi-layer | `/debug-blitz` |
| architecture + security + a11y (new project) | `/project-launch` |
| pre-release + full audit | `/pre-release` |
| refactor + types + tests | `/refactor-sprint` |
| attacker mindset + multi-vector | `/devil-mode` |
| new codebase + orientation | `/onboard` |
| general audit + multiple angles | `/team-review` |

### 6. Announcement style adapts to terse mode

If the user has `/terse` active this session:

- Drop the `Tip: next time you can type "use <agent>"` line
- Use one-token announcement: `→ debug-detective` instead of the full form
- No trailing decoration

### 7. Cultural + multi-language cues

- Emotional markers in any language route the same way: "arre yaar broken hai" = frustration = `debug-detective`
- Filler like "bro", "yaar", "man", "please" is not a signal — strip and read the substance
- Respond in the user's **this-turn** language
- Never translate code identifiers, commands, or error text (`NullPointerException` stays)

### 8. Evolve integration

Routing misses and weak matches feed `~/.kodelythecc/evolve/routing-misses.jsonl`. The evolve pipeline aggregates them into proposals for new routing triggers.

You never write this file yourself. Just be honest in the routing announcement — if the match is weak, say "medium confidence — routing to X, not Y, because Z" so the evolve pipeline has a clean signal.

## Output formats

### Default (verbose)

```
→ Routing to debug-detective (stack trace + frustration signals match the bug-tracking pattern)

[response in debug-detective's style — methodical, hypothesis-driven, asks for repro]

Tip: next time you can type "use debug-detective" to invoke me directly.
```

### Terse mode active

```
→ debug-detective

[response — no tip line, no explanation of why]
```

### Medium-confidence single match

```
→ Routing to code-reviewer (single file paste, no other context — treating as review)

[response as code-reviewer]

Not what you wanted? Say "use debug-detective" or "just answer" to switch.
```

### Low-confidence, two candidates

```
Two agents fit this: debug-detective (bug + error) or silent-failure-hunter (no error thrown).
Which one? Or should I answer directly?
```

### Sticky routing (already in an agent)

```
[response continues in the same agent's voice — no re-announcement]
```

### Compound intent → parallel command

```
→ Firing /debug-blitz — 3 agents in parallel (debug-detective + silent-failure-hunter + env-debugger)

[synthesised result]
```

## Live examples

| User writes | Routes to | Why |
|---|---|---|
| "I'm getting a TypeError on line 42" | `debug-detective` | Specific error |
| "no error but the data is wrong" | `silent-failure-hunter` | Silent failure pattern |
| "should I use React Context or Zustand here?" | `pair-programmer` | Pre-implementation approach |
| "Review my login component" | `typescript-reviewer` | Single file + likely TS |
| "I have no idea where to start" | `kodelyth-advisor` | Lost / overwhelmed |
| "make this faster" | `performance-optimizer` | Direct perf question |
| "is my JWT signing secure?" | `security-reviewer` | Auth + security keyword |
| "build failed on Vercel" | `build-error-resolver` | Build failure |
| "production is down, getting 500s" | `incident-commander` | Active production incident |
| "will this hold under 10k users?" | `load-tester` | Capacity question |
| "generate a hero image" | `image-architect` | Explicit image request |
| "help me build a todo app" | `/project-launch` | New build |
| "review my code before I deploy" | `/team-review` | Pre-release, full scope |
| "cutting v2 today, last check" | `/pre-release` | Release + confidence combo |
| "been stuck on this bug for 2 days" | `/debug-blitz` | Persistent frustration |
| "who calls `ProcessOrder`?" | `codebase-memory-mcp trace_path` | Structural query |
| "remember we always use pnpm" | `/lessons` | Preference to encode |
| [paste code with no text] | `code-reviewer` | Implicit review |
| [paste stack trace with no text] | `debug-detective` | Implicit debug |

## Counter-patterns (do NOT route)

- User already invoked explicitly (`use <agent>`, `@agent`)
- Message is one-liner factual ("what does `git stash pop` do?")
- Purely conversational ("hi", "thanks", "ok")
- User said "just answer" / "don't route"
- Trivially simple (rename a variable)

## Where it lives

- **Rule file**: `rules/common/agent-intent-routing.md` (832 lines)
- **Loaded**: automatically at every AI-tool session start via `~/.claude/rules/` or platform-equivalent
- **Companion rule**: [`cost-aware-model-routing`](../rules/common/cost-aware-model-routing.md) — picks the model tier (trivial / standard / hard) once the agent is picked

## See also

- **[Getting Started](./getting-started.md)** — first agent invocation
- **[Terse Mode](./terse-mode.md)** — how announcement style adapts
- **[Evolve](./evolve.md)** — where routing-miss signals get consumed
- **[MCP Server](./mcp.md)** — the `route_intent` MCP tool
