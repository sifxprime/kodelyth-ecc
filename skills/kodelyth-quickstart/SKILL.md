---
name: kodelyth-quickstart
description: Friendly getting-started guide — powered by Kodelyth. A plain-language introduction to Kodelyth ECC for new users. Explains what agents, skills, commands, and hooks are in simple terms, and guides you to the right tool for your task. Read this first.
origin: Kodelyth
---

# Kodelyth Quickstart — Getting Started with Kodelyth ECC

Welcome. This guide explains Kodelyth ECC (ECC) in plain language so you can start using it confidently in the first 10 minutes.

> Powered by Kodelyth — making AI tooling friendly from the first interaction.

## What Is This?

Kodelyth ECC is a **plugin that makes Claude Code smarter**. It adds:

- **Agents** — specialists you delegate tasks to (like hiring a contractor for a specific job)
- **Skills** — domain knowledge loaded into Claude's context (like giving Claude a textbook to reference)
- **Commands** — shortcuts to trigger common workflows (like macros)
- **Hooks** — automatic actions that run before/after Claude does things (like background safety checks)

You don't need to use all of them. Start with what solves your current problem.

## The 4 Things You Need to Know

### 1. Agents — Specialists for Specific Jobs

Agents are like calling a specialist instead of doing it yourself. You delegate a task to an agent and it handles it end-to-end.

**When to use an agent**: when you have a specific, defined task that matches an expert's domain.

```
# To use an agent, just say:
"use code-reviewer"
"use planner"
"use debug-detective"
```

**Kodelyth agents added to this repo:**

| Agent | What it does |
|---|---|
| `kodelyth-advisor` | Not sure what to use? Ask this agent — it guides you to the right tool |
| `debug-detective` | Traces bugs to their root cause step by step — never guesses |
| `ux-reviewer` | Reviews frontend code for UX and accessibility issues |

**Other useful built-in agents:**

| Agent | When to use it |
|---|---|
| `planner` | Before starting a complex feature |
| `code-reviewer` | After writing or changing code |
| `security-reviewer` | When code touches auth, payments, or user data |
| `refactor-cleaner` | When code has grown messy |
| `build-error-resolver` | When a build or compile is failing |
| `tdd-guide` | When you want to write tests properly |
| `performance-optimizer` | When something is slow |

---

### 2. Skills — Domain Knowledge on Demand

Skills load expert knowledge into Claude's context for a specific topic. They're not agents — they don't do a task for you. They give Claude the right context to do it well.

**When to use a skill**: when you're working in a specific language, framework, or domain and want Claude to follow best practices for it.

```
# To use a skill, type the skill name as a command:
/python-patterns
/golang-patterns
/postgres-patterns
/docker-patterns
/coding-standards
```

**Kodelyth skills added to this repo:**

| Skill | What it covers |
|---|---|
| `/kodelyth-quickstart` | This guide — plain-language intro to ECC |
| `/smart-debug` | Systematic debugging framework for any language |

**Other useful built-in skills:**

| Skill | When to use it |
|---|---|
| `/coding-standards` | General code quality rules (naming, structure, etc.) |
| `/python-patterns` | Python best practices |
| `/golang-patterns` | Go best practices |
| `/typescript-patterns` | TypeScript/React best practices |
| `/postgres-patterns` | Database query and schema patterns |
| `/docker-patterns` | Container and Docker Compose patterns |
| `/security-review` | Security audit guidance |
| `/api-design` | REST API design conventions |

---

### 3. Commands — Workflow Shortcuts

Commands trigger multi-step workflows with a single slash command.

**When to use commands**: for repeatable workflows you do often.

```
/tdd          → Start test-driven development workflow
/plan         → Create an implementation plan
/code-review  → Trigger a quality review
/build-fix    → Fix a broken build
/e2e          → Generate and run E2E tests
/learn        → Extract reusable patterns from this session
```

---

### 4. Hooks — Automatic Background Protection

Hooks run automatically — you don't invoke them. They silently protect you from common mistakes.

**What's running in the background right now:**

| Hook | What it does |
|---|---|
| Session start | Loads context from your last session |
| Pre-commit check | Catches `console.log`, secrets, and bad commit messages |
| Quality gate | Runs type checks and formatting after you edit files |
| Git push reminder | Prompts you to review before pushing |
| Cost tracker | Logs token usage per session |
| Desktop notify | Sends a macOS notification when Claude finishes a long task |

You don't need to do anything — hooks are already active.

---

## Your First 5 Minutes — A Practical Path

**Step 1: Get guidance on what to use**
```
use kodelyth-advisor
```
Tell it what you're building. It will recommend the right agents and skills.

**Step 2: Load the right skill for your stack**
```
/python-patterns          # if you're working in Python
/typescript-patterns      # if you're working in TypeScript/React
/golang-patterns          # if you're working in Go
/coding-standards         # if you want general best practices
```

**Step 3: Plan your feature before coding**
```
use planner
```
Describe what you want to build. The planner will produce a phased implementation plan.

**Step 4: After you write code, review it**
```
use code-reviewer
```
This catches security issues, code quality problems, and missing tests before they become problems.

**Step 5: If something breaks, debug it systematically**
```
use debug-detective
/smart-debug
```
Tell the agent the symptom. It will trace the bug to its root cause.

**Bonus: See your AI workspace at a glance**
```
npx kodelyth-ecc dashboard
```
Opens the local observability dashboard at `http://127.0.0.1:5747`. Inspect memory captures, BM25 search across past solutions, evolve proposals, the full skill and agent catalog, swarm sessions, and token-budget snapshots — all local, zero telemetry.

---

## Common Questions

**Q: What's the difference between an agent and a skill?**
An agent *does* something (takes actions, reads files, writes code). A skill *informs* Claude (loads reference knowledge into context). Use agents for tasks, skills for expertise.

**Q: How do I know which agent to use?**
When in doubt: `use kodelyth-advisor` — it will recommend the right one for your situation.

**Q: Can I use multiple skills at once?**
Yes. Load any combination of skills and Claude will use all of them.

**Q: Do hooks cost me tokens?**
Minimal. Most hooks are fast shell scripts that run outside Claude's context window.

**Q: The command didn't do anything obvious — is it working?**
Commands load context into the conversation. Claude will then follow the skill's guidance in its next response. Try asking a question related to the skill topic.

---

## Quick Reference Card

```
NOT SURE WHERE TO START?    →  use kodelyth-advisor
PLANNING A FEATURE?         →  use planner  or  /plan
REVIEWING CODE?             →  use code-reviewer  or  /code-review
DEBUGGING?                  →  use debug-detective  or  /smart-debug
SECURITY CONCERN?           →  use security-reviewer
TESTS NEEDED?               →  use tdd-guide  or  /tdd
BUILD BROKEN?               →  use build-error-resolver  or  /build-fix
UX REVIEW?                  →  use ux-reviewer
LOAD LANGUAGE PATTERNS?     →  /python-patterns, /golang-patterns, etc.
GENERAL CODE STANDARDS?     →  /coding-standards
OBSERVABILITY DASHBOARD?    →  npx kodelyth-ecc dashboard  (localhost:5747)
```

---

> Powered by Kodelyth — you got this.
