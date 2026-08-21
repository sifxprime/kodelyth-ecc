---
title: "The Arena — GOD vs EVIL Adversarial Loop in Kodelyth ECC"
description: "Two agent crews fight over your code until the attacker gives up. GOD builds and hardens, EVIL attacks and proves, verified findings return to GOD. Scored, budget-capped, and it remembers what it learned."
keywords:
  - adversarial AI agents
  - GOD mode EVIL mode
  - AI red team loop
  - agent convergence
  - AI code hardening
  - multi-agent security audit
  - ECC arena
og_title: "The Arena — GOD vs EVIL Adversarial Loop"
og_description: "Two agent crews fight over your code until the attacker gives up. Scored findings, adversarial verification, hard budget stops, compound memory."
og_image: /social/card-arena.svg
canonical: /docs/arena/
last_updated: 2026-08-21
version: 2.10.0
category: feature
---

# The Arena

Most AI code review is one pass by one optimist. The arena is a fight.

**GOD** builds and hardens. **EVIL** attacks and tries to break what GOD made.
Findings that survive adversarial verification go back to GOD as mandatory work.
Repeat until **two consecutive rounds surface nothing new** — then you ship,
knowing an adversary already tried and failed.

```
round N:  GOD builds/fixes  →  EVIL hunts  →  EVIL verifies  →  close round
                                                                    │
                          converged? out of budget? out of rounds? ─┤
                                    no → round N+1                  │
                                                                   yes → report
```

## Why a loop instead of a review

A single review pass has no feedback. It reports, you fix, and nobody checks
whether the fix worked or what it broke. The arena's second round attacks the
*fixes themselves* — which is where the next bug usually lives.

That is not theoretical. On its first real run against `scripts/terse`, round 1
surfaced 12 findings. One of them was a ReDoS. The first fix looked right and was
useless: excluding newlines from the pattern changed nothing, because the
pathological input contained no newlines. A measurement caught it — 7666 ms
before, 7667 ms after — and the real fix (a length bound) took it to 232 ms.

Round 2 then attacked all twelve fixes across eleven vectors and found nothing new.

## Convergence is the win condition

Not "zero findings." Findings can remain open and accepted. Convergence means
**attacking harder stopped yielding anything new**.

```
round 1   12 new  ████████████████████████
round 2    0 new  ·
```

A falling line means the attacker ran out of ideas. A flat or rising line means
stop and think — either the code has deeper problems, or the scope is too broad
for EVIL to ever exhaust.

The report never claims more than it earned. Stopping at a round limit with only
one quiet round prints **"Not converged — remaining risk is unproven, not
absent."**

## What makes a finding count

Every finding is scored `severity × confidence × exploitability`, so a *confirmed
trivial-to-exploit medium* outranks a *speculative critical*. Certainty beats
drama.

Then each one is handed to a **fresh agent told to refute it**, which defaults to
`refuted` when uncertain. A finding nobody can reproduce is not a finding. This
is the expensive failure mode the design exists to prevent: an unverified false
positive consumes GOD's entire next round.

Refuted findings stay in the record so the same false positive is never
re-litigated.

## It remembers

A run that ends is knowledge thrown away. `arena learn` closes the loop:

```bash
kodelyth-ecc arena learn <run-id>            # show what would be remembered
kodelyth-ecc arena learn <run-id> --commit   # store it
```

```
arena run  ──▶  confirmed + refuted findings  ──▶  memories
     ▲                                                │
     └────────  prior-knowledge brief  ◀──────────────┘
```

Confirmed findings become memories carrying the fix and the repro that proved it.
**Refuted findings become memories too** — the more valuable half, because
without them the next run re-investigates the same non-bug and burns a real
verification pass proving the same negative.

**Unverified findings are deliberately skipped.** Storing a question as knowledge
would launder a guess into a fact.

The next `arena start` on that scope recalls them and injects them into round 1's
briefs, so EVIL opens where the last run closed. Pass `--fresh` to skip.

Nothing is written without `--commit`. Memory that writes itself silently is
memory you cannot trust.

## Guard proposals

One symlink bug is an incident. Two in the same file is a process gap. When a bug
**class** is confirmed repeatedly, `learn --commit` files an `arena-guard`
proposal into [evolve](./evolve.md) recommending the upstream fix — *"add a shared
path-safety helper and route every file write through it"* rather than patching
the third one later.

Proposal ids are deterministic, so re-analysis never spawns duplicates.

## Cost control

This is the expensive command: roughly **200k tokens per round**. Defaults are 3
rounds, a 400k token budget, and a 45-minute wall clock.

The budget guard refuses **before** spending, not after. If the next step cannot
be afforded, the run aborts cleanly and reports the partial result — a readable
partial beats a surprise bill. Runs are resumable: a crash mid-loop reloads from
disk with phase and spend intact.

## Usage

```bash
kodelyth-ecc arena start --task "harden the webhook" --scope src/ --max-rounds 3
kodelyth-ecc arena next <run-id>          # what the loop wants next (JSON)
kodelyth-ecc arena learn <run-id>         # what the run taught
kodelyth-ecc arena report <run-id> --md   # full markdown report
kodelyth-ecc arena list
```

In your AI tool, drive the whole loop with the slash command:

```
/arena harden the payment webhook
/arena prepare this repo for open-source --all
```

The [dashboard](./dashboard.md) has an **Arena** tab showing the convergence
trend, still-open findings ranked by real risk, and which bug classes keep coming
back.

## When to use which

| Situation | Command |
|---|---|
| Build something properly | `/god-mode` |
| Audit what already exists | `/evil-mode` |
| Ship something that must not break | `/arena` |
| Before open-sourcing | `/arena --all` |

## The crew

EVIL fields four core hunters on every sweep — `prompt-injection-hunter`,
`supply-chain-auditor`, `secret-hunter`, `backdoor-hunter` — plus four opt-in
specialists: `license-violation-finder`, `code-stealer-detector`,
`jailbreak-tester`, `chaos-engineer`. Use `--all` for the full eight,
`--pre-public` for an open-source sweep, `--pre-launch` before shipping.

GOD runs a six-stage pipeline: recall → design → build → critique → harden →
prove. An artifact counts as delivered only when its verification command
actually exited clean. A round with an unverified artifact is flagged incomplete.
