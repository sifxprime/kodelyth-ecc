---
description: Recommend the right model tier (trivial/standard/hard) for the current task. Surfaces the cost-aware-model-routing rule on demand.
argument-hint: "[task description]"
---

# /route-model

Get an immediate model-tier recommendation for the current task. Combines the `cost-aware-model-routing` rule, the project's `.kodelyth/router.json` config, and the active session's token-budget pressure.

## Usage

```
/route-model
/route-model rename getUserName to getUserDisplayName
/route-model audit the new oauth flow for vulnerabilities
/route-model devil-mode adversarial sweep on the payments module
```

If you don't pass a task, the AI infers it from the most recent user turn.

## What you get back

A single, scannable block:

```
[model-router] task=<tier> · suggested=<model-id> · current=<active>
  why: <one-line reason>
  next: <how to switch>
```

If you're already on the right tier, the AI routes silently and confirms in one line.

## Behind the scenes

- Pure deterministic classifier (no LLM call) at `scripts/router/classify.js`.
- Project config: `.kodelyth/router.json` (override per team).
- Env-var overrides: `KODELYTH_ROUTER_{TRIVIAL,STANDARD,HARD,DEFAULT}`.
- Disable with `KODELYTH_ROUTER=off`.
- Pairs with the `token-budget` safety hook for spend control.

## Hard rules

- Security / incident / adversarial agents never downgrade.
- Production framing ("down", "leaking", "outage") → hard tier.
- Multi-file refactors (3+) never go to trivial.
- Respect explicit user model choices unless new signals conflict.

See: `rules/common/cost-aware-model-routing.md`, `skills/cost-aware-model-routing/SKILL.md`.
