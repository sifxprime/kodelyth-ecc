---
description: Parallel founding-team blast for new projects. Fires architect + security + UX + TDD + pair-programmer simultaneously. One command, 5 specialist reports at once.
---

# /project-launch — Parallel Founding Team

Launch all founding-team agents in parallel on your new project. What would take 40+ minutes sequentially finishes in under 10 minutes as one parallel burst.

## Usage

```
/project-launch <description>
/project-launch "SaaS dashboard with Stripe billing, user auth, real-time data"
/project-launch --full    # adds performance-optimizer and api-guardian to the team
```

## What Gets Launched in Parallel

Five specialist agents fire simultaneously, each with the same project description:

| Agent | Deliverable |
|---|---|
| `architect` | System design — components, data flow, boundaries, trade-offs |
| `pair-programmer` | Approach validation — risks, wrong turns, questions to answer before coding |
| `security-reviewer` | Threat model — auth, data exposure, OWASP risks for THIS project type |
| `tdd-guide` | Test strategy — what to test first, test pyramid, critical paths |
| `ux-reviewer` | UX blueprint — user flows, accessibility requirements, interaction risks |

With `--full`, also adds:
- `performance-optimizer` — scaling bottlenecks, caching strategy, query patterns
- `api-guardian` — API contract design, versioning strategy, breaking change risks

## How It Works

1. Read the project description from `$ARGUMENTS`
2. If no description provided, ask for one in one sentence
3. Spawn all 5 (or 7) agents simultaneously with `run_in_background: true`
4. Each agent receives: the project description + its specialist brief
5. Wait for all to complete
6. Aggregate results into a structured **Project Launch Report**:

```
## PROJECT LAUNCH REPORT
### Architecture (architect)
[findings]

### Approach Risks (pair-programmer)
[findings]

### Threat Model (security-reviewer)
[findings]

### Test Strategy (tdd-guide)
[findings]

### UX Blueprint (ux-reviewer)
[findings]
```

7. After report: ask "Which area do you want to go deeper on first?"

## Token Efficiency

Each agent gets a **narrow, focused context** — just the project description + its specialist instructions. No agent carries the full conversation history. The system prompt (rules + agents) is cached across all parallel agents. Result: 5× the analysis at roughly 2× the token cost of a single sequential session.

## When to Use

- Starting any non-trivial project (3+ components, real users, production intent)
- Before writing a single line of code
- When you want to catch architecture mistakes before they're baked in

## Arguments

$ARGUMENTS

---

## Execute Now

Invoking this command is confirmation to proceed. Do not show this documentation to the user — execute immediately:

1. Read `$ARGUMENTS` for the project description. If empty, ask: "What are you building? Describe it in 2–3 sentences."
2. Once you have a project description, spawn all agents simultaneously using `run_in_background: true`:
   - `architect` — system design, tech selection, component breakdown
   - `pair-programmer` — implementation approach, patterns, gotchas
   - `security-reviewer` — threats, auth design, data exposure risks
   - `tdd-guide` — test strategy, coverage plan, critical paths to test
   - `ux-reviewer` — UX flows, accessibility, interaction design
3. Wait for all agents to complete.
4. Aggregate into the Project Launch Report format above.
5. End with: "Which area do you want to go deeper on first?"
