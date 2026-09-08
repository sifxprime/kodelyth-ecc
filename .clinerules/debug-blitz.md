---
description: Parallel debug assault — fires debug-detective + silent-failure-hunter + env-debugger simultaneously. Three root-cause specialists on your bug at once.
---

# /debug-blitz — Parallel Debug Assault

Three debugging specialists attack your problem from different angles simultaneously. The bug that has resisted one approach rarely survives all three.

## What Gets Launched in Parallel

| Agent | Focus |
|---|---|
| `debug-detective` | Traces the explicit error to root cause — stack traces, logs, hypothesis → proof |
| `silent-failure-hunter` | Finds bugs with no error — swallowed exceptions, bad fallbacks, wrong output |
| `env-debugger` | Catches environment-layer bugs — env vars, config drift, "works locally" failures |

## Usage

```
/debug-blitz                         # general debug — all three agents
/debug-blitz "TypeError on line 42"  # paste the error — agents use it as starting point
/debug-blitz --ci                    # focus env-debugger on CI/CD environment
/debug-blitz --prod                  # production context — incident-commander added
```

## Report Format

```
## DEBUG BLITZ REPORT

### Root Cause Analysis (debug-detective)
HYPOTHESIS: [most likely cause]
EVIDENCE:   [what points to it]
DISPROVEN:  [what was ruled out]
FIX:        [exact change needed]

### Silent Failures (silent-failure-hunter)
FOUND:      [swallowed errors, bad fallbacks]
RISK:       [what could be silently wrong]

### Environment (env-debugger)
CONFIG:     [mismatches found]
SECRETS:    [missing or wrong vars]
DRIFT:      [local vs CI vs prod differences]

---
MOST LIKELY CAUSE: [one sentence]
RECOMMENDED FIX:   [one action]
```

## When to Use

- Bug has resisted more than 30 minutes of investigation
- "Works on my machine" but fails in CI or prod
- No error thrown but wrong output
- Intermittent failures with no obvious pattern
- A fix was applied but the bug came back

## Execute Now

Invoking this command is confirmation to proceed. Execute immediately:

1. Extract the error, symptom, or context from `$ARGUMENTS`. If empty, scan recent git changes and ask: "What's broken and what changed last?"
2. Spawn all agents simultaneously with `run_in_background: true`:
   - `debug-detective` — hypothesis-driven root cause analysis
   - `silent-failure-hunter` — scan for swallowed errors and bad fallbacks
   - `env-debugger` — environment and config layer investigation
3. Wait for all to complete.
4. Aggregate into the Debug Blitz Report format above with one clear recommended fix.
5. End with: "Want me to implement the fix?"
