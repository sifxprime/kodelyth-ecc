---
title: "Super Agent — the Autonomous Orchestrator (Kodelyth ECC)"
author: Kodelyth
description: "Drive one large objective to a verified result through ECC's Super Agent: a deterministic, resumable, budget-governed state machine that decomposes into a dependency DAG, dispatches independent steps in parallel on their own branches, conflict-checks and integrates, then verifies. Nothing faked."
keywords:
  - autonomous agent orchestrator
  - multi-step AI agent
  - dependency DAG agent
  - parallel agent execution
  - resumable agent run
  - budget-governed agent
  - agent integration conflict detection
  - Kodelyth super agent
og_title: "Super Agent — the Autonomous Orchestrator (Kodelyth ECC)"
og_description: "Decompose → dispatch in parallel → integrate → verify. A tokenless, resumable, budget-capped state machine that cannot lie about its own state."
og_image: /docs/super-agent.svg
hero_alt: "One objective flowing through a state machine: decompose into a dependency DAG, dispatch ready steps in parallel on their own branches, conflict-check and integrate, then verify — resumable and budget-capped."
og_type: article
twitter_card: summary_large_image
canonical: /docs/super-agent/
last_updated: 2026-11-10
version: 2.30.0
category: feature
faq:
  - q: "What is the Super Agent in Kodelyth ECC?"
    a: "An autonomous orchestrator that drives one large objective to a verified result. It decomposes the goal into a dependency DAG, dispatches independent steps in parallel on their own branches, integrates with conflict checks, then verifies — all through a deterministic, resumable, budget-governed state machine."
  - q: "When should I use the Super Agent vs a specialist agent?"
    a: "Use the Super Agent for a feature or change too large for one pass that splits into dependent steps. Use a specialist directly (debug-detective, code-reviewer, etc.) for single edits or one-file changes. For independent parallel work with no dependencies, use /swarm instead — it is lighter."
  - q: "How does the Super Agent avoid faking step results?"
    a: "Every step is recorded with an honest status. A step that did not succeed is marked failed, and a failed step whose result others depend on stalls the run instead of letting the machine build on a broken foundation. The verification gate requires actual passing tests with evidence; it is not a self-report."
  - q: "What happens if the Super Agent hits its budget cap?"
    a: "The machine halts and reports the reason. The step or token cap is a hard stop, not a suggestion — it is not bypassed. You can resume later with `kodelythecc super-agent next <runId>`; the run persists after every step."
  - q: "Can a Super Agent run resume after a crash?"
    a: "Yes. Runs are persisted after every step. Use `kodelythecc super-agent list` to find the runId, then `kodelythecc super-agent next <runId>` to continue from exactly where it stopped."
---

# Super Agent — the autonomous orchestrator

Most ECC agents do one job well: a review, a fix, a plan. The **Super Agent** is
the one that drives a whole objective — too big for a single pass — to a
finished, verified result, by running it through a control plane instead of
improvising the steps.

That control plane is a **tokenless state machine** in `scripts/super-agent/`.
The agent never invents the control flow; the machine owns it. That is what makes
a run three things at once: **deterministic** (the same state always yields the
same next action), **resumable** (it persists after every step and continues from
exactly where it stopped), and **budget-governed** (it halts at a step or token
cap instead of running costs away).

## When to use it, and when not to

**Use it** when the work is a real project, not an edit:

- A feature or change too large for one pass, that splits into dependent steps.
- You want independent steps to run in parallel, with correct, conflict-checked
  integration of the branches afterward.
- You want the run to survive a crash and pick up where it left off.

**Don't use it** for a single edit, a one-file change, or a quick fix — just do
it, or call the specific specialist. For independent work with no real internal
dependencies, the lighter [Swarm](./swarm.md) or a single agent is the better
tool. The Super Agent earns its overhead only when the steps actually depend on
each other.

## Run it

From your AI tool, the slash command drives the whole loop:

```
/super-agent build a rate-limited login API with tests
/super-agent resume <runId>        # continue a crashed or earlier run
```

Under the hood it behaves as the `super-agent` agent and drives the machine
through one CLI surface:

```bash
kodelythecc super-agent <command> ...
```

## The loop

The machine exposes exactly one question — "what next?" — and the agent performs
exactly the action it names, then reports the result back.

### 1. Start, always with a budget

```bash
kodelythecc super-agent start --goal "<objective>" [--step-cap N] [--token-cap N] [--scope .]
```

Set a `--step-cap` or `--token-cap`. An autonomous run without a budget is how
costs run away; the machine treats the cap as a hard stop, not a suggestion. The
output gives you a `runId` and the first action.

### 2. Ask what's next, do exactly that

```bash
kodelythecc super-agent next <runId>
```

The JSON `action` is one of:

- **`decompose`** — Break the goal into a dependency DAG with the
  [`blueprint`](https://github.com/sifxprime/kodelyth-ecc/tree/main/skills/blueprint)
  skill. Each step is `{ id, description, deps: [ids], contextBrief,
  exitCriteria }`, where `contextBrief` is written so a fresh agent can execute
  the step cold. Install the plan:
  ```bash
  kodelythecc super-agent plan <runId> --file plan.json
  ```

- **`dispatch`** — The listed steps are ready (their dependencies are done). Run
  independent steps in parallel — the Task tool, or `kodelythecc swarm` for
  isolated git worktrees — each on its **own branch**. Report each as it finishes:
  ```bash
  kodelythecc super-agent step <runId> <stepId> --status done --branch <branch> [--tokens N]
  # or, if it could not be completed:
  kodelythecc super-agent step <runId> <stepId> --status failed
  ```

- **`integrate`** — All steps are done. Detect conflicts first, **without touching
  the tree**, via `scripts/super-agent/integrate.js` (`mergeOrder` for the order,
  `detectConflicts` for the check — backed by `git merge-tree`). If clean, merge
  in that order:
  ```bash
  kodelythecc super-agent integrate <runId>
  ```
  If branches conflict, it does not force the merge — it reports the conflicting
  files and stops for a human:
  ```bash
  kodelythecc super-agent integrate <runId> --conflicts path/a,path/b
  ```

- **`verify`** — Run the real gate (tests, build, type-check — ECC's
  [`/verify`](./getting-started.md)). Then record the honest result:
  ```bash
  kodelythecc super-agent verify <runId> --passed --detail "693 tests pass"
  # or --failed --detail "2 tests red"
  ```

- **`halt`** — The budget cap was reached or the plan stalled. Stop and report the
  reason; the cap is not worked around.

- **`report`** — The run is done, failed, or stopped. Summarize it.

Repeat `next` → act → submit until the action is `report`.

## Resuming a run

A run persists after every step, so a crash loses nothing:

```bash
kodelythecc super-agent list            # find the runId
kodelythecc super-agent next <runId>    # continues from exactly where it stopped
kodelythecc super-agent status <runId>  # full state of a run
```

## What it guarantees

The design goal is a machine that **cannot lie about its own state**:

- **Nothing is faked.** A step that did not succeed is recorded `failed`, and a
  failed step whose result others depend on *stalls* the run instead of letting
  the machine build on a broken foundation.
- **The budget is honored.** The step/token cap is a hard halt.
- **Integration is conflict-safe.** Conflicts are detected before the tree is
  touched; a conflicting merge stops for a human rather than forcing it.
- **Verification is real.** `verify --passed` is only submitted when the tests and
  build actually pass, with the evidence in `--detail`.

## Honest limits

It is a **beta** driver, and worth knowing where the edges are. The machine owns
the control flow, but the *quality of the decomposition* is still the agent's job
— bad dependency edges mean lost parallelism or an integration that fights itself,
so the DAG is only as good as the `blueprint` step that produced it. Parallel
dispatch across git worktrees needs a clean working tree to branch from. And the
orchestrator coordinates work; it does not replace the specialist agents that do
it — it dispatches to them. For a task with no real internal dependencies, that
coordination is overhead you don't need.

---

The orchestrator — the DAG with cycle detection, the resumable state store, the
budget governor, and the `git merge-tree` conflict check — is dependency-free Node
in
[scripts/super-agent](https://github.com/sifxprime/kodelyth-ecc/tree/main/scripts/super-agent).
The driver is the
[`super-agent`](https://github.com/sifxprime/kodelyth-ecc/blob/main/agents/super-agent.md)
agent and the
[`/super-agent`](https://github.com/sifxprime/kodelyth-ecc/blob/main/commands/super-agent.md)
command. For lighter parallel work, see [Swarm](./swarm.md).

```bash
npm i -g kodelyth-ecc && kodelythecc --target claude-code
```
