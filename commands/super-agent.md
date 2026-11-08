---
name: super-agent
description: Drive a large objective to completion through the autonomous orchestrator — decompose, dispatch (parallel), integrate branches, verify. Resumable, budget-governed.
---

# /super-agent

Turn one big objective into a finished, verified result by running it through the
**super-agent** orchestrator — a deterministic, resumable, budget-governed state
machine (`scripts/super-agent/`).

## Usage

```
/super-agent <objective>            e.g. /super-agent build a rate-limited login API with tests
/super-agent resume <runId>         continue a crashed or earlier run
```

## What it does

Behaves as the `super-agent` agent and runs the loop:

1. `kodelythecc super-agent start --goal "<objective>" --step-cap <N>` — always with a budget.
2. `kodelythecc super-agent next <id>` → perform the action it names:
   - **decompose** → build a dependency DAG with the `blueprint` skill, `… plan <id> --file`.
   - **dispatch** → run each ready step (parallel where independent, each on its own branch), `… step <id> <step> --status done --branch`.
   - **integrate** → conflict-check with `scripts/super-agent/integrate.js`, merge in `mergeOrder`, `… integrate <id>` (or `--conflicts …` to stop).
   - **verify** → run `/verify`, then `… verify <id> --passed|--failed`.
3. Repeat until **report**.

## When to use it

- A feature or change too large for one pass, that splits into dependent steps.
- You want parallel execution of independent steps with correct, conflict-checked integration.
- You want the run to survive a crash and resume.

## When NOT to use it

- A single edit, one-file change, or a quick fix — just do it, or use the specific specialist.
- Something with no real internal dependencies — the swarm (`/swarm`) or a single agent is lighter.

## Guarantees

- Nothing is faked: a step that did not succeed is recorded `failed`, and a failed
  dependency stalls the run instead of building on it.
- The budget cap and integration-conflict stop are honored, never bypassed.
- `verify --passed` requires the tests/build to actually pass, with evidence.
