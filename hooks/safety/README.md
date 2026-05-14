# Kodelyth ECC — Safety Hooks

Two production-ready safety primitives that ride on the existing ECC hook pipeline. Both are **off by default** — explicitly opt in via env vars so existing users see zero behavior change unless they ask for it.

> Phase 2.10 of the [Devil Roadmap](../../README.md). Local-only, deterministic regex-based detection. No LLM calls. No telemetry.

---

## 1. `prompt-injection-guard.js`

Scans inbound text for jailbreak / instruction-override patterns **before the model sees it**. Wires into:

- `UserPromptSubmit` — scans the user's outbound message
- `PostToolUse` on `Read|WebFetch|mcp__*` — scans tool responses for indirect injection from external content

### Modes

| `KODELYTH_PI_GUARD` | Behavior |
|---|---|
| `off` (or unset) | Hook does nothing. Default. |
| `warn` | Always exits 0. Prints findings to stderr (visible in transcript). |
| `block` | Exits 2 (block) on **critical** findings. Warns on high. Passes on medium. |

### Severity tiers

- **critical** — instruction override, system-prompt extraction, role rebind (DAN/dev-mode), exfiltration channel, decoded base64 jailbreak payload
- **high** — hidden system markers (`[[SYSTEM]]`, `<|system|>`, `### NEW INSTRUCTIONS`), tool-call hijack patterns, jailbreak canaries, demands for unrestricted output
- **medium** — generic "new instructions" keywords, invisible/bidi Unicode, large base64 blobs

The full pattern catalog lives in `lib/patterns.js` — auditable and contributor-friendly.

### Optional knobs

```bash
KODELYTH_PI_GUARD_LOG=/path/to/findings.jsonl   # append findings to a JSONL audit log
KODELYTH_PI_GUARD_MAX_INPUT=20000               # truncate scanned text length
```

### Example

```bash
# Warn-only (recommended for first rollout)
KODELYTH_PI_GUARD=warn claude

# Hard block on critical (production / enterprise)
KODELYTH_PI_GUARD=block KODELYTH_PI_GUARD_LOG=~/.kodelyth/safety/pi-audit.jsonl claude
```

---

## 2. `token-budget.js`

Tracks per-session token usage and **blocks new turns** once a configurable budget is exceeded. Wires into:

- `SessionStart` — pre-check; can block if budget already exhausted
- `Stop` — accumulates usage from transcript size + visible message lengths

### Token estimation

Hooks don't get authoritative token counts from the platform, so the budget enforcer uses a **4-chars-per-token heuristic** over the transcript path supplied in the Stop payload, plus visible prompt / tool-response text. Rough but stable, and good enough for guardrail purposes.

### Modes

| `KODELYTH_TOKEN_BUDGET` | Behavior |
|---|---|
| `off` (or unset) | Hook does nothing. Default. |
| `warn` | Tracks usage and prints it to stderr after every turn. Never blocks. |
| `<positive integer>` (e.g. `200000`) | Hard budget in tokens. Warns at threshold. Blocks `SessionStart` once usage ≥ budget. |

### Optional knobs

```bash
KODELYTH_TOKEN_BUDGET_DIR=~/.kodelyth/safety   # state file directory (per-session JSON)
KODELYTH_TOKEN_BUDGET_WARN=0.7                  # warn at this fraction of budget (default 0.7)
KODELYTH_TOKEN_BUDGET_RESET=1                   # admin op: wipe session state and exit
```

### Example

```bash
# Warn-only — track but never block (good for cost visibility)
KODELYTH_TOKEN_BUDGET=warn claude

# Hard 200K-token budget per session, warn at 70%, block at 100%
KODELYTH_TOKEN_BUDGET=200000 claude

# Reset the current session's accumulated budget
KODELYTH_TOKEN_BUDGET=200000 KODELYTH_TOKEN_BUDGET_RESET=1 claude
```

State files live at `${KODELYTH_TOKEN_BUDGET_DIR}/budget-<sessionId>.json`. Inspect or delete them manually anytime — the hook will recover gracefully.

---

## Why opt-in?

Safety primitives that **silently block traffic** are how observability tools become "that thing the team hates." Both hooks default to `off` so:

- Existing users upgrade to v1.7+ with zero behavior change.
- Adoption happens deliberately — `warn` first, `block` once the team trusts the signal.
- A misfire from a bad regex never silently kills a workflow.

Both hooks **always exit 0 on internal errors** (parse failure, missing env, fs error) so a broken hook never blocks the user.

---

## Architecture

```
hooks/safety/
├── README.md                      ← this file
├── prompt-injection-guard.js      ← UserPromptSubmit + PostToolUse hook
├── token-budget.js                ← SessionStart + Stop hook
└── lib/
    └── patterns.js                ← shared injection pattern catalog (regex + severity)
```

Both hooks read the standard Claude Code hook payload from stdin, echo it back to stdout for chained hooks, and write any human-readable report to stderr. Tests cover block/warn/off paths plus parse-failure recovery.

Tests live at `tests/safety/`.

---

Built into [Kodelyth ECC](../../README.md). MIT licensed.
