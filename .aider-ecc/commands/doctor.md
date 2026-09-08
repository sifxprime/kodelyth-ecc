---
description: Diagnose your Kodelyth ECC install — check for drift, missing files, version mismatches, and confirm everything is healthy
---

# /doctor

Runs a health check on your ECC install. Detects drift between what was installed and what is currently on disk.

## What It Checks

- Install state file exists and is readable
- Installed version vs latest available
- Agent files present and uncorrupted
- Skills directory intact
- Rules loaded correctly
- Memory store accessible (if applicable)
- Hooks registered (Claude Code only)

## Usage

```
/doctor
```

Run with no arguments for a full health report on all detected installs.

## Implementation

Runs the built-in doctor script:

```bash
node scripts/doctor.js
```

Or with a specific target:

```bash
node scripts/doctor.js --target claude-home
node scripts/doctor.js --target windsurf-home
node scripts/doctor.js --target windsurf-project
node scripts/doctor.js --target codex-home
node scripts/doctor.js --target cursor-project
```

For JSON output (useful in CI or scripts):

```bash
node scripts/doctor.js --json
```

## Output

The doctor report shows:

| Field | Meaning |
|-------|---------|
| `OK` | Component healthy, no issues |
| `WARNING` | Potential issue, non-blocking |
| `ERROR` | Missing or corrupted file, needs attention |

A summary line shows total checked, ok, warnings, and errors.

## When to Run

- After first install to confirm everything landed
- After upgrading to a new ECC version
- When an agent or skill isn't behaving as expected
- Before filing a bug report

## Related

- `/update` — upgrade to the latest ECC version
- `use kodelyth-advisor` — if you're not sure where to start

> Powered by Kodelyth — trust your install, verify your tools.
