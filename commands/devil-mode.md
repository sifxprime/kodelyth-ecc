---
description: Parallel adversarial sweep — fires prompt-injection-hunter + supply-chain-auditor + secret-hunter + backdoor-hunter simultaneously. The full attacker-mindset audit in one command.
---

# /devil-mode — Adversarial Parallel Sweep

Four red-team specialists attack your codebase from every angle attackers actually use. What would take a security firm a week of billable hours, your repo gets in 20 minutes.

> **Read the brief first.** Each agent thinks like a hostile actor. Findings will be uncomfortable. That's the point.

## What Gets Launched in Parallel

| Agent | Hunts |
|---|---|
| `prompt-injection-hunter` | Jailbreak vectors, indirect injection, system-prompt leaks, tool-call hijacking |
| `supply-chain-auditor` | Typosquats, malicious post-install, lockfile drift, slopsquats, compromised deps |
| `secret-hunter` | Live secrets, git history leaks, encoded creds, bundled-to-client env vars |
| `backdoor-hunter` | Obfuscated payloads, network beacons, time bombs, eval/exec abuse, cryptominers |

## Optional Extension Agents

Use these flags to add more agents to the sweep:

| Flag | Adds |
|---|---|
| `--license` | `license-violation-finder` (GPL contamination, attribution gaps) |
| `--theft` | `code-stealer-detector` (copy-paste provenance, copyleft hits) |
| `--jailbreak` | `jailbreak-tester` (live AI feature red-team) |
| `--chaos` | `chaos-engineer` (fault-injection plan generation) |
| `--all` | All 8 agents — the **full devil sweep** |

## Usage

```
/devil-mode                  # 4-agent default sweep
/devil-mode --all            # all 8 adversarial agents
/devil-mode src/auth/        # focus on auth module
/devil-mode --pre-public     # before going open-source: --license + --theft + default
/devil-mode --pre-launch     # before public launch: --jailbreak + default + --chaos
```

## Report Format

```
## DEVIL MODE REPORT

### Prompt Injection Surface (prompt-injection-hunter)
CRITICAL: [list]
HIGH:     [list]
DEFENSE GAPS: [where existing protections can be bypassed]

### Supply Chain (supply-chain-auditor)
THREATS:    [confirmed malicious / typosquat / drift]
WATCHLIST:  [suspicious patterns]
LOCKFILE:   [OK / drift / missing]

### Leaked Secrets (secret-hunter)
ACTIVE:     [rotate now — still valid]
HISTORICAL: [git history leaks — assume compromised]
BUNDLED:    [exposed to every client visit]

### Backdoors / Malicious Code (backdoor-hunter)
CRITICAL:   [confirmed reverse-shell / RCE / exfiltration]
SUSPICIOUS: [needs manual decode/review]

---
TOTAL EXPOSURE:    X critical, Y high, Z medium across N agents
PRIORITIZED ACTIONS:
  1. [first action — usually rotate or revert]
  2. [second]
  3. [third]
```

## When to Use

- **Before going open-source** — any repo about to be public, run with `--pre-public`
- **Before any public launch** — run with `--pre-launch`
- **After accepting code from new contractor / contributor** — full audit with `--all`
- **Quarterly red-team review** — schedule it
- **After any compromise alert / vendor security advisory** — verify your exposure
- **Before M&A due diligence** — what their lawyers will find, you find first
- **After major dep update** — supply-chain + backdoor + secret sweep

## When NOT to Use

- ❌ On code you don't have permission to audit (run only on your own repos / authorized targets)
- ❌ On production systems for `chaos-engineer` flag — chaos requires `--staging` or signed-off blast radius
- ❌ As a substitute for actual security review — this finds patterns; humans verify exploitability

## Execute Now

Invoking this command is confirmation to proceed. Execute immediately:

1. Parse `$ARGUMENTS` for scope path and flags (`--all`, `--license`, `--theft`, `--jailbreak`, `--chaos`, `--pre-public`, `--pre-launch`).
2. Determine the agent set:
   - Default: `prompt-injection-hunter`, `supply-chain-auditor`, `secret-hunter`, `backdoor-hunter`
   - `--pre-public`: default + `license-violation-finder` + `code-stealer-detector`
   - `--pre-launch`: default + `jailbreak-tester` + `chaos-engineer`
   - `--all`: all 8
3. Spawn all selected agents simultaneously with `run_in_background: true`.
4. Wait for all to complete.
5. Aggregate findings into the Devil Mode Report format above.
6. Prioritize actions by severity (critical first), with concrete recommended fix for each.
7. End with: "Which threat do you want to neutralize first?"

## Severity Priority Order

When aggregating across agents, sort findings by:

1. **Active credential leak** (still valid keys) — rotate immediately
2. **Confirmed backdoor / malicious code** in current dep — quarantine + revert
3. **Confirmed prompt injection** with tool-call abuse possible — disable affected agent
4. **Critical supply-chain threat** (typosquat, malicious postinstall) — remove dep
5. **Historical credential leak** in git history — rotate, plan history rewrite
6. **High-severity prompt injection** without tool abuse — patch + monitor
7. **License/IP exposure** — remediate before any public action
8. **Suspicious patterns needing manual review** — schedule deep dive

---

**Remember:** The devil-mode report is uncomfortable on purpose. Every finding here is one an attacker can find too — the only question is whether you fix it first.
