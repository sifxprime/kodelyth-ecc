# Cost-Aware Model Routing — Auto-Pick the Right Model Tier per Task

This rule teaches the AI to **classify the current task and recommend the right model tier** instead of defaulting to one expensive model for everything. Pairs with the `agent-intent-routing` rule (agent selection) and the `token-budget` safety hook (spend control) to keep ECC sessions both effective AND affordable.

> **The 80/20 of cost in agent workflows:** 80% of turns are trivial (rename, format, doc, summary, list-files) and burn frontier-model tokens for no benefit. Routing them to a fast/cheap tier saves 60–80% of monthly spend with no measurable quality loss.

---

## The Rule

Before composing your response, classify the task by **scope, ambiguity, and risk**, then either:

1. **Route silently** — the user already picked a model that matches the tier (do nothing).
2. **Suggest a tier change** — emit a one-line recommendation when the active model is wildly mismatched (frontier model on a doc-typo fix, or a tiny model on a security audit).

Always be transparent. Never silently switch models. Always teach the user how to make the decision next time.

---

## Tier definitions

| Tier | Examples | Default models (provider-agnostic) |
|---|---|---|
| **trivial** | Single-line rename, format-only, fix typo, add JSDoc, generate plain summary, list files, regex tweak, version bump, capitalisation. Output usually < 50 lines. | Claude Haiku · Gemini Flash · GPT-4.1-mini · Qwen 2.5 Coder 7B (local) · Ollama (Llama 3.1 8B). |
| **standard** | Code review of a single PR, write a small unit test, refactor one file, fix a non-critical bug, write a focused doc section, design a small data model. | Claude Sonnet · GPT-4.1 · Gemini Pro · Qwen 2.5 Coder 32B. |
| **hard** | Architecture decision, debug-blitz of intermittent prod bug, security audit, multi-file refactor (3+ files), incident postmortem, design review, devil-mode adversarial sweep, agent harness changes, anything `code-architect`/`incident-commander`/`debug-detective` would own. | Claude Opus · GPT-5 · Gemini Ultra · best-available frontier model. |

**The names are reference points** — pick the equivalent tier in whatever provider stack the user has configured. The classification is what matters, not the brand.

---

## Classification heuristics (signals to weigh)

Use these signals together — single signals are noisy, three or four together are reliable:

### Trivial signals
- One file, < 50 lines of context
- Pure formatting / renaming / documentation work
- No tests need updating
- The user's question fits in a single sentence
- No ambiguity ("rename `getUserName` to `getUserDisplayName`")
- Verbs: format, rename, capitalize, fix typo, add comment, list, count, summarize

### Standard signals
- 1–3 files in scope
- Behavior change + tests required
- One subsystem
- Verbs: refactor, review, fix bug, write test, optimize, document, migrate (small)
- The user pasted a stack trace from one place

### Hard signals
- Cross-cutting concern (auth, payments, telemetry, retries, concurrency)
- Multiple subsystems / 4+ files
- Security implications (PII, secrets, authz, supply chain)
- Production / incident framing ("urgent", "down", "leaking", "live")
- Architectural framing ("decide", "design", "should we", "trade-off")
- The user invoked `code-architect`, `incident-commander`, `debug-detective`, `security-reviewer`, `chaos-engineer`, `backdoor-hunter`, `prompt-injection-hunter`
- Devil-mode parallel commands
- The session has already burned > 30k tokens (compounding context)
- Agent handoff chains involving 3+ specialists

If signals are **mixed or contradictory**, default to **standard** and surface the ambiguity to the user.

---

## Output format when suggesting a tier change

Emit exactly one block, then proceed normally:

```
[model-router] task=<trivial|standard|hard> · suggested=<tier> · current=<active model or "unknown">
  why: <one short sentence on the dominant signals>
  next: <how to switch — provider-specific, e.g. "use --model claude-haiku" or "switch to /model haiku">
```

**Only emit this block when the active model is mismatched.** If the user is already on the right tier, route silently.

---

## Per-team configurability

Teams override the defaults via env vars or `.kodelyth/router.json`:

### Env vars

| Variable | Effect |
|---|---|
| `KODELYTH_ROUTER=off` | Disable the rule entirely. The AI never suggests model changes. |
| `KODELYTH_ROUTER_TRIVIAL=<model-id>` | Override trivial tier. |
| `KODELYTH_ROUTER_STANDARD=<model-id>` | Override standard tier. |
| `KODELYTH_ROUTER_HARD=<model-id>` | Override hard tier. |
| `KODELYTH_ROUTER_DEFAULT=<trivial\|standard\|hard>` | Default tier for ambiguous tasks (default `standard`). |

### Project file: `.kodelyth/router.json`

```json
{
  "trivial":  "claude-haiku-4-5-20251001",
  "standard": "claude-sonnet-4-6",
  "hard":     "claude-opus-4-1",
  "default":  "standard",
  "notes":    "Set by infra team. Bump trivial→sonnet for any task that touches /payments."
}
```

A `notes` field is purely human — the AI surfaces it when emitting a recommendation so the team's reasoning rides along.

---

## Hard rules (never break these)

1. **Security audits, incident triage, and devil-mode never downgrade.** If the active task involves `security-reviewer`, `incident-commander`, `debug-detective`, `prompt-injection-hunter`, `supply-chain-auditor`, `secret-hunter`, `backdoor-hunter`, `chaos-engineer`, `jailbreak-tester`, `code-stealer-detector`, or `license-violation-finder` — recommend **hard** tier even if other signals look trivial.
2. **Production framing wins.** "Down", "leaking", "broken in prod", "incident", "outage" → hard.
3. **No silent demotion of multi-file refactors** — if 3+ files are in scope, never recommend trivial.
4. **Respect explicit user choice.** If the user said "use haiku" or "stay on sonnet", do not override. Surface only if a new turn introduces signals that conflict.
5. **Budget-aware:** if the `token-budget` safety hook reports usage > 70% of budget, bias one tier downward when ambiguous to extend the session.

---

## Examples

```
User: "rename getUserName to getUserDisplayName everywhere"
[model-router] task=trivial · suggested=trivial · current=opus
  why: single rename, mechanical, no behavior change.
  next: switch to /model claude-haiku to save ~80% on this turn.
```

```
User: "production is down and the auth service is throwing 502s, help"
[model-router] task=hard · suggested=hard · current=haiku
  why: production incident with security-relevant subsystem.
  next: switch to /model claude-opus before continuing — this is incident-commander territory.
```

```
User: "review this 40-line PR"
(active model: sonnet — silent route, no block emitted)
```

---

## Why this rule exists

LLM cost is the #1 reason teams stop using agent toolkits. Two complementary primitives:

- The **token-budget safety hook** prevents catastrophic blow-ups (hard cap per session).
- This **routing rule** prevents the slow leak (frontier-model overuse on trivial work).

Together they typically cut LLM bills by 50–70% with no measurable quality drop on standard work.

For implementation patterns inside user code (your own pipelines that call LLMs), see the [`cost-aware-llm-pipeline`](../../skills/cost-aware-llm-pipeline/SKILL.md) skill.
