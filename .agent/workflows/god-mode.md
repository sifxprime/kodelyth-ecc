---
description: GOD mode — the constructive crew. Recalls past solutions, designs, builds test-first, self-critiques, hardens, and proves the work with a command that actually runs.
argument-hint: "<what to build or harden>"
---

# /god-mode — Build It Properly

Nine specialists in a six-stage pipeline. This is **not** `/project-launch` (which fires everyone at once) — GOD mode is sequential where sequence matters, parallel where it doesn't, and it refuses to call anything done that it hasn't proven.

## The pipeline

| Stage | Agents | What happens |
|---|---|---|
| **Recall** | — | Search local memory for prior solutions to this problem |
| **Design** ∥ | `architect` + `code-architect` | Blueprint: files, interfaces, data flow, build order |
| **Build** → | `pair-programmer` + `tdd-guide` | Implement test-first; tests must actually run |
| **Self-critique** ∥ | `type-design-analyzer` + `api-guardian` + `ux-reviewer` | Attack our own work before anyone else can |
| **Harden** ∥ | `performance-optimizer` + `refactor-cleaner` | Hot spots and dead weight, no behaviour change |
| **Prove** | — | Run the verification commands |

∥ = parallel · → = sequential

## Usage

```
/god-mode add rate limiting to the payments API
/god-mode harden the webhook signature verification
/god-mode                      # asks what to build
```

Preview the plan and cost from the terminal first:
```bash
kodelythecc god --task "add rate limiting to the payments API"
```

## Instructions to the assistant

Run the stages **in order**. Do not skip Recall and do not skip Prove.

### Stage 1 — Recall (do this first, always)
Search local memory for prior work on this problem:
- Use the `recall_memory` MCP tool, or `kodelythecc memory recall "<task>"`.
- For each relevant hit, state: the past problem, the approach that worked, and whether it applies here.
- **If nothing relevant exists, say so plainly.** Never invent a memory.

### Stage 2 — Design (parallel)
Launch `architect` and `code-architect` together via the Task tool. Produce one concrete blueprint: exact files, interfaces, data flow, build order. No hand-waving.

### Stage 3 — Build (sequential)
Launch `pair-programmer` and `tdd-guide`. Write the test first, watch it fail, implement, watch it pass. Report which files you created or changed.

### Stage 4 — Self-critique (parallel)
Launch `type-design-analyzer`, `api-guardian`, and `ux-reviewer` together. Be genuinely adversarial about your own output — it is far cheaper to find a problem here than to let `/evil-mode` find it later.

### Stage 5 — Harden (parallel)
Launch `performance-optimizer` and `refactor-cleaner`. Improve without changing behaviour. Tests must stay green.

### Stage 6 — Prove (mandatory)
**Run the verification command.** A test suite, a build, a benchmark — something that exits 0.

- If it passes: report the command and its output.
- If it fails: **the round is not complete.** Fix it and re-run. Do not report success.
- "Should work" / "looks correct" is a failure of this stage.

## The output contract

End every GOD-mode run with:

```
GOD MODE — <task>
  files:    <what you created or changed>
  verified: <the command you ran> → <pass/fail + evidence>
  memory:   <what you recalled, or "no prior art">
  open:     <anything you deliberately did not do, and why>
```

## Handoff

When the work touches security, auth, payments, user input, or dependencies, follow with:

```
/evil-mode <the files you changed>
```

That is the adversarial half — it will try to break exactly what you just built.
