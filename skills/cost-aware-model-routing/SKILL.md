---
name: cost-aware-model-routing
description: Pick the right model tier (trivial/standard/hard) for each ECC session task. Companion to the cost-aware-model-routing rule and the token-budget safety hook. Use when the user asks "what model should I use" or when a session is burning frontier-model tokens on routine work.
origin: ECC
---

# Cost-Aware Model Routing — Explicit Skill

The companion skill to the always-on routing rule. Invoke this when the user explicitly asks "what model should I use for this task" or when you (the agent) want to surface a routing recommendation deliberately rather than via the implicit rule.

> Pairs with `rules/common/cost-aware-model-routing.md` (the always-on rule), `hooks/safety/token-budget.js` (spend control), and the `cost-aware-llm-pipeline` skill (patterns for user code).

---

## When to invoke

Trigger this skill when:

- The user asks "which model should I use", "is opus overkill for this", "can haiku handle this", "what's the cheapest tier for this".
- A session is approaching budget limits and the next task looks trivial.
- The user is on a frontier model but the next task is mechanical (rename, format, doc).
- You want to teach the user how to route deliberately for the next 10 turns instead of just this one.

Do NOT invoke when:

- The user is mid-task on something hard (architecture, incident, security audit) — keep them on the high tier.
- The user has explicitly chosen a model in this session — respect their choice.

---

## Workflow

### 1. Classify the current task

Use the three-tier framework from the rule:

| Tier | Examples |
|---|---|
| **trivial** | Rename, format, fix typo, add JSDoc, summarize, list files, version bump, kebab→camel |
| **standard** | Code review of a PR, write a unit test, refactor one file, fix a non-critical bug, write a doc section |
| **hard** | Architecture decision, debug-blitz of intermittent prod bug, security audit, multi-file refactor (3+ files), incident postmortem, devil-mode, agent harness changes |

Weight signals together. Single signals are noisy; three or four together are reliable.

### 2. Read the team's config

Check for `.kodelythecc/router.json` at the project root and these env vars:

```
KODELYTH_ROUTER          off | (unset)
KODELYTH_ROUTER_TRIVIAL  override trivial-tier model id
KODELYTH_ROUTER_STANDARD override standard-tier model id
KODELYTH_ROUTER_HARD     override hard-tier model id
KODELYTH_ROUTER_DEFAULT  trivial | standard | hard (fallback for ambiguous tasks)
```

If `KODELYTH_ROUTER=off`, do NOT emit recommendations — the team has chosen to opt out.

### 3. Emit a single, structured recommendation

Use this exact format so the user can scan it instantly:

```
[model-router] task=<tier> · suggested=<model-id> · current=<active or "unknown">
  why: <one short sentence on the dominant signals>
  next: <how to switch — provider-specific>
```

Only emit when the active model is mismatched with the suggested tier. If the user is already on the right tier, route silently and do not interrupt.

### 4. If the user wants ad-hoc routing for a future task

Tell them:

```
npx kodelyth-ecc route "<task description>"            # quick CLI hint
npx kodelyth-ecc route "<task>" --files 5 --agent debug-detective
```

Or for an in-session check, they can `use cost-aware-model-routing` and describe the task.

---

## Hard rules (never break these)

1. **Security / incident / adversarial work never downgrades.** If the active agent is `security-reviewer`, `incident-commander`, `debug-detective`, or any devil-mode agent (`prompt-injection-hunter`, `supply-chain-auditor`, `secret-hunter`, `backdoor-hunter`, `chaos-engineer`, `jailbreak-tester`, `code-stealer-detector`, `license-violation-finder`) — recommend **hard** tier even if the surface task looks trivial.
2. **Production framing wins.** "Down", "leaking", "outage", "incident", "P0", "P1" → hard.
3. **Multi-file refactors (3+) never go to trivial.**
4. **Respect explicit user choice.** If the user said "use haiku", don't override unless a new turn introduces conflicting signals.
5. **Budget-aware:** if `token-budget` reports usage > 70% of budget, bias one tier downward when ambiguous to extend the session.

---

## Examples

### Example 1 — clear downgrade opportunity

```
User: "rename getUserName to getUserDisplayName everywhere"
[active model: claude-opus-4-1]

Recommendation:
[model-router] task=trivial · suggested=claude-haiku-4-5-20251001 · current=claude-opus-4-1
  why: single mechanical rename, no behavior change, no tests need updating.
  next: switch to /model claude-haiku for this turn — saves ~80% in tokens with no quality loss.
```

### Example 2 — never downgrade incident work

```
User: "production is down and the auth service is throwing 502s, help"
[active model: claude-haiku-4-5-20251001]

Recommendation:
[model-router] task=hard · suggested=claude-opus-4-1 · current=claude-haiku-4-5-20251001
  why: production incident with security-relevant subsystem.
  next: switch to /model claude-opus before continuing — this is incident-commander territory.
```

### Example 3 — match, no recommendation

```
User: "review this 40-line PR for typos and obvious bugs"
[active model: claude-sonnet-4-6]

Recommendation: (silent — already on the right tier)
```

### Example 4 — devil-mode never downgrades

```
User: "/devil-mode --all"
[active model: claude-haiku-4-5-20251001]

Recommendation:
[model-router] task=hard · suggested=claude-opus-4-1 · current=claude-haiku-4-5-20251001
  why: devil-mode adversarial sweep — security/quality assertions need frontier reasoning.
  next: switch to /model claude-opus or your equivalent frontier model.
```

---

## Implementation references

- Rule: `rules/common/cost-aware-model-routing.md`
- Classifier: `scripts/router/classify.js` (pure-function, deterministic)
- CLI: `npx kodelyth-ecc route <task>`
- Companion safety hook: `hooks/safety/token-budget.js` (spend cap)
- Skill for user-code patterns (different scope): `cost-aware-llm-pipeline`

---

Built into [Kodelyth ECC](../../README.md). MIT licensed.
