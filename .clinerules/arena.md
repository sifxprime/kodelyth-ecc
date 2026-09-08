---
description: The Arena — GOD builds, EVIL attacks, repeat until the attacker gives up. The adversarial loop with scored findings, verification, convergence detection, and hard budget stops.
argument-hint: "<goal> [--scope src/] [--max-rounds 3] [--all]"
---

# /arena — GOD vs EVIL, until the attacker gives up

The two crews fight over your code. GOD builds and hardens. EVIL attacks and tries to break it. Verified findings go back to GOD. Repeat until **two consecutive rounds surface nothing new** — then you ship, knowing an adversary already tried and failed.

> **This is the expensive one.** ~200k tokens per round (GOD ≈ 90k + EVIL ≈ 96k + verification). Defaults are 3 rounds / 400k tokens, and the budget guard aborts *before* overspending. Use `/god-mode` or `/evil-mode` alone when you don't need the full loop.

## The loop

```
round N:  GOD builds/fixes  →  EVIL hunts  →  EVIL verifies  →  close round
                                                                    │
                          converged? out of budget? out of rounds? ─┤
                                    no → round N+1                  │
                                                                   yes → report
```

**Convergence = the win condition.** Not "zero findings" — findings may remain open and accepted. It means attacking harder stopped yielding anything new.

## Usage

```
/arena harden the payment webhook
/arena add rate limiting --scope src/api --max-rounds 2
/arena prepare this repo for open-source --all
```

Start and inspect from the terminal:
```bash
kodelythecc arena start --task "harden the webhook" --scope src/ --max-rounds 3
kodelythecc arena next <run-id>          # what the loop wants next (JSON)
kodelythecc arena report <run-id> --md   # full markdown report
kodelythecc arena list
```

## Instructions to the assistant

### 0. Start the run
```bash
kodelythecc arena start --task "<goal>" --scope "<path>" [--max-rounds N]
```
Capture the **run id**. Every step below is driven by:
```bash
kodelythecc arena next <run-id>
```
which returns the next action, its briefs, and a token estimate. **Follow it — do not improvise the order.**

### 1. `god_build`
Run the GOD-mode stages from the action's `stages` array (see `/god-mode`). Round 1 builds; later rounds **fix what EVIL proved** — those findings arrive in the brief as mandatory work items.

Finish by reporting artifacts, each with a `verifyCommand` you **actually ran**.

### 2. `evil_hunt`
Launch the crew from `briefs` **in parallel** via the Task tool. On round 2+, agents are told what's already known and to hunt what the last pass missed.

### 3. `evil_verify`
For each target, launch a **fresh** agent with the supplied refute-brief. Its job is to **disprove** the finding. Default to `refuted` when uncertain.

### 4. `round_close`
Record the round. The state machine decides whether to loop again or stop.

### 5. `report`
When the action is `report`, print the full markdown:
```bash
kodelythecc arena report <run-id> --md
```

### 6. `learn` — close the compound loop

A run that ends is knowledge thrown away. After the report:

```bash
kodelythecc arena learn <run-id>            # show what would be remembered
kodelythecc arena learn <run-id> --commit   # store it
```

Every **confirmed** finding becomes a memory carrying the fix and the repro that
proved it. Every **refuted** finding becomes a memory too — the more valuable
half, because without it the next run re-investigates the same non-bug and burns
a real verification pass proving the same negative.

**Unverified findings are deliberately skipped.** Storing a question as knowledge
would launder a guess into a fact, and future runs would recall it as settled.

The return path is automatic: the next `arena start` on that scope recalls those
memories and injects them into round 1's briefs, so EVIL opens where the last run
closed instead of rediscovering it. Pass `--fresh` to skip the recall.

```
arena run  ──▶  confirmed + refuted findings  ──▶  memories
     ▲                                                │
     └────────  prior-knowledge brief  ◀──────────────┘
```

When the same bug **class** is confirmed repeatedly, `learn --commit` also files an
`arena-guard` proposal into evolve. One symlink bug is an incident; two in the same
file is a process gap, and the proposal says so — "add a shared path-safety helper
and route every file write through it" rather than patching the third one later.

Nothing is written without `--commit`. Memory that writes itself silently is memory
you cannot trust.

## Rules that keep this honest

- **Never skip verification.** Unverified findings waste GOD's next entire round — that's the expensive failure mode this design exists to prevent.
- **Never claim a fix you didn't prove.** An artifact counts only when its command exited clean. A round with an unverified artifact is flagged incomplete in the report.
- **Never invent findings to look thorough.** An empty confirmed list is a good result.
- **Respect the budget guard.** If it aborts, report the partial result — a readable partial beats a surprise bill.
- Convergence is the goal, not zero findings. Accepted risk, stated plainly, is a legitimate outcome.

## Reading the report

The trend line is the whole story:

```
round 1   12 new  ████████████████████████
round 2    4 new  ████████
round 3    0 new  ·
round 4    0 new  ·
**Converged** — two consecutive rounds surfaced nothing new.
```

Falling to zero means the attacker ran out of ideas. A flat or rising line means **stop and think** — either the code has deep problems, or EVIL is finding new surface each pass because the scope is too broad.

## When to use which

| Situation | Command |
|---|---|
| Build something properly | `/god-mode` |
| Audit what already exists | `/evil-mode` |
| Ship something that must not break | `/arena` |
| Before open-sourcing | `/arena --all` |
