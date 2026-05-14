---
name: intent-routing
description: >
  How Kodelyth ECC auto-detects user intent and routes to the right
  specialist agent without requiring explicit invocation. Read this when
  you (the AI) want to understand the routing rule, when the user asks
  "how does the toolkit decide which agent to use", or when designing a
  new agent and need to know what trigger patterns it should claim.
---

# Intent Routing — How ECC Picks the Right Agent

ECC has **two activation paths** for its 53 specialist agents:

1. **Explicit** — user types `use <agent>`, `@agent`, or `invoke <agent>`
2. **Implicit (intent routing)** — the AI reads the user's message, infers the right specialist, announces the routing, and behaves as that agent

Most users never type `use ...`. Intent routing is what makes the toolkit feel **alive** instead of like a directory of files.

## The Routing Contract

When intent routing fires, the AI MUST do four things in order:

1. **Acknowledge the routing** in one short line above the response:
   ```
   → Routing to debug-detective (your error message + frustration matches the bug-tracking signal)
   ```
2. **Behave as that agent** — adopt its persona, methodology, and constraints for the rest of the response
3. **Suggest the explicit invocation** in one closing line:
   ```
   Tip: next time you can type "use debug-detective" to invoke me directly.
   ```
4. **Stay transparent** — never silently route. The user must always know which agent is "speaking".

## The Source of Truth

The full routing table lives in `rules/common/agent-intent-routing.md`. This skill is a **summary + design guide**.

If you (an agent author) want to claim trigger patterns for a new agent, you must:

1. Add your patterns to `agent-intent-routing.md`
2. Pick a priority tier (1 = crisis, 10 = chaining)
3. Verify your patterns don't collide with an existing higher-priority agent
4. Add a counter-pattern (when NOT to route here)

## Priority Tiers (Why They Matter)

When two agents could match, the **higher tier wins**.

| Tier | Theme | Example agents |
|---|---|---|
| 1 | Crisis & emotional state | kodelyth-advisor, pair-programmer |
| 2 | Active pain (something broken) | debug-detective, build-error-resolver, env-debugger |
| 3 | Quality & review | code-reviewer, security-reviewer, ux-reviewer, api-guardian |
| 4 | Performance & scale | performance-optimizer |
| 5 | Planning & architecture | planner, architect, code-architect, migration-guide |
| 6 | Testing | tdd-guide, e2e-runner, pr-test-analyzer, flake-hunter |
| 7 | Code hygiene | refactor-cleaner, code-simplifier, type-design-analyzer |
| 8 | Documentation | doc-updater, docs-lookup, comment-analyzer |
| 9 | Specialized | seo-specialist, opensource-*, dependency-doctor, git-rescue, release-captain |
| 10 | Multi-agent chains | (handoffs between any two agents) |

**Why crisis is tier 1:** if a user says "I'm stuck on this bug", we route to `kodelyth-advisor` first (emotional state) rather than `debug-detective` (the technical one). The advisor will then often hand off to `debug-detective` once the user describes the actual bug.

## What Counts as a Trigger

A trigger is a **regex or keyword pattern in the user's message**. Good triggers:

- **Direct verbs**: "review", "debug", "optimize", "migrate"
- **State words**: "broken", "slow", "stuck", "failing", "vulnerable"
- **Domain terms**: "JWT", "SQL injection", "WCAG", "TypeScript", "Postgres"
- **Emotional cues**: "I'm lost", "I've been trying for hours", "this won't work"

Bad triggers (avoid):

- Single common words like "and", "the", "code" (will match everything)
- Words that are equally valid for two different agents without any disambiguator
- Metaphors that are easy to miss ("my code is on fire" — too loose)

## Counter-Patterns (When NOT to Route)

Always include these in any new agent:

- The user **already explicitly invoked** another agent — that wins
- The message is a **one-line factual question** — answer directly, don't route
- The message is **purely conversational** ("hi", "thanks") — don't route
- The user explicitly says **"don't route" or "just answer me"** — respect it
- The user is in a **defined multi-step workflow** with another agent — don't interrupt

## Example: Designing a New Agent's Trigger Section

```markdown
### `dependency-doctor` — npm/pip/cargo/maven dep hell

| Signal | Examples |
|---|---|
| Install failure | "npm install fails", "cannot resolve", "yarn install error" |
| Lockfile drift | "package-lock conflict", "yarn.lock conflict", "lockfile diff" |
| CVE | "audit shows", "CVE-", "vulnerable dependency" |
| Version conflict | "ERESOLVE", "peer dep conflict", "conflicting versions" |
| Bloat | "bundle too big", "node_modules huge", "dep audit" |

Counter-signals (do NOT route here):
- Generic "build failed" without dep mention → `build-error-resolver`
- Runtime null pointer → `debug-detective`
```

## Example: Routing Decisions in the Wild

| User says | Route to | Why |
|---|---|---|
| "I'm getting a TypeError on line 42" | `debug-detective` | T2 — specific error |
| "Should I use React Context or Zustand?" | `pair-programmer` | T1 — pre-implementation question |
| "Review my login component" | `typescript-reviewer` (if .ts file) or `code-reviewer` | T3 — review request |
| "I have no idea where to start with this auth migration" | `kodelyth-advisor` | T1 — lost / overwhelmed |
| "How do I make this faster?" | `performance-optimizer` | T4 — perf |
| "Is my JWT signing secure?" | `security-reviewer` | T3 — security keyword |
| "build failed on Vercel" | `build-error-resolver` | T2 — build failure |
| "Tests pass locally but fail on CI" | `flake-hunter` then `env-debugger` | T2 — flake or env diff |
| "Migrate Pages Router to App Router" | `migration-guide` | T5 — framework migration |
| "Add accessibility to this form" | `ux-reviewer` | T3 — a11y |
| "open source this project" | `opensource-forker` (chain start) | T9 — OSS chain |
| "I lost my commits after `reset --hard`" | `git-rescue` | T9 — git crisis |

## Anti-Patterns to Avoid

- **Silent routing**: jumping into `debug-detective` without a "→ Routing to" line. The user thinks the AI just changed personality randomly.
- **Over-routing**: claiming `code-reviewer` for every code-related message. Reserve it for explicit review intent.
- **Under-routing**: ignoring obvious signals because the user didn't type the magic word.
- **Stacking**: routing to 4 agents at once. Pick **one or at most two parallel agents**.

## Skill Authors: Add Your Triggers Here

When you build a new agent, update `rules/common/agent-intent-routing.md`. The intent rule is **the toolkit's nervous system**. Better intent rules = better routing = better user experience.
