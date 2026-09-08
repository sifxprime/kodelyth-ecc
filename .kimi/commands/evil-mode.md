---
description: EVIL mode — adversarial sweep with scored findings, adversarial verification, and loop-until-dry. The upgrade of /devil-mode — unreproducible findings get refuted instead of padding the report.
argument-hint: "[scope] [--all|--license|--theft|--jailbreak|--chaos|--pre-public|--pre-launch]"
---

# /evil-mode — Attack Your Own Code

Eight red-team specialists hunt your repository the way an attacker would. Unlike a plain sweep, EVIL mode **grades its own findings** and then **tries to disprove them** — so what reaches you is what survived scrutiny, not everything anyone thought of.

> Findings will be uncomfortable. That is the point. This attacks **your own** codebase so real attackers find nothing left.

## What makes this different from a one-shot scan

| | Plain sweep | EVIL mode |
|---|---|---|
| Output | Flat list | Scored: severity × confidence × exploitability |
| False positives | You triage them | **Adversarially refuted** before you see them |
| Coverage | One pass | **Loops until two rounds find nothing new** |
| Handoff | Prose | Structured findings `/god-mode` can consume |

## The crew

**Core (always):** `prompt-injection-hunter` · `supply-chain-auditor` · `secret-hunter` · `backdoor-hunter`

**Opt-in:** `--license` · `--theft` · `--jailbreak` · `--chaos` · `--all`

**Presets:** `--pre-public` (license + theft) · `--pre-launch` (jailbreak + chaos)

## Usage

```
/evil-mode                      # core 4 on the whole repo
/evil-mode src/auth             # focus a module
/evil-mode --all                # all 8 hunters
/evil-mode --pre-public         # before open-sourcing
```

Preview crew and cost first:
```bash
kodelythecc evil src/auth --all
```

## Instructions to the assistant

### Stage 1 — Hunt (parallel)
Launch the selected crew **simultaneously** via the Task tool. Give each agent its scope and tell it:

- `evidence` must **quote the actual offending code**, not describe it.
- `repro` must be concrete steps or a command.
- Only claim `confirmed` when you have actually reproduced it.
- **Do not pad.** Five confirmed findings beat forty guesses.

Each finding comes back as:
```json
{ "title", "severity": "critical|high|medium|low|info",
  "confidence": "confirmed|likely|suspected|speculative",
  "exploitability": "trivial|moderate|hard|theoretical",
  "file", "line", "evidence", "repro", "fix" }
```

### Stage 2 — Verify (the part that matters)
Take the top findings by risk and, for each, launch a **fresh** agent whose job is to **REFUTE it**:

1. Read the actual code — does the evidence match reality?
2. Do guards, framework behaviour, or callers already neutralise it?
3. Try to reproduce it.

Return `confirmed` / `refuted` / `needs_context`. **Default to `refuted` when uncertain.** A finding that cannot be demonstrated is not a finding.

Refuted findings stay in the record (so the same false positive isn't re-litigated) but count as **zero risk**.

### Stage 3 — Loop until dry
If this is an arena run, sweep again — telling each agent which findings are already known and to hunt what the last pass **missed**. Stop when two consecutive rounds surface nothing new.

### Stage 4 — Report

```
EVIL MODE — <scope> — round <n>
  swept:     <agents>
  found:     <n> · confirmed <n> · refuted <n>
  open risk: <sum of surviving risk>

CONFIRMED (fix these)
  [risk] title — file:line
         repro: <command or steps>
         fix:   <what to change>

REFUTED (checked, not real)
  title — why it is not exploitable
```

Order strictly by risk. Never lead with a `speculative` finding.

## Rules

- **Never invent findings to look thorough.** An empty confirmed list is a valid, good result.
- **Never report a finding you could not reproduce** without marking it `speculative`.
- This is for auditing **code you own or are authorised to test**. It is a defensive tool.

## Handoff

```
/god-mode fix the confirmed findings from the EVIL sweep
```

GOD mode treats confirmed findings as mandatory work items — each must be fixed or explicitly accepted as risk.
