---
description: Upgrade Kodelyth ECC to the latest version, preserving your current install target and language profile
---

# /update

Upgrades your ECC install to the latest version from npm. Reads your existing install state to replay the same target and language options automatically — no flags to remember.

## Usage

```
/update
```

## What It Does

1. Reads `kodelyth-ecc-install-state.json` from your install directory to recover the original `target` and `languages`
2. Runs `npx kodelyth-ecc@latest` with those same flags
3. Overwrites agents, skills, rules, and commands with the latest versions
4. Leaves your memory store (`~/.kodelythecc/memory/`) and `tasks/lessons.md` untouched — your learned context is never overwritten

## Implementation

The agent should run the appropriate command based on your platform.

### Automatic (reads install state)

```bash
node -e "
const fs = require('fs');
const os = require('os');
const path = require('path');

const candidates = [
  path.join(os.homedir(), '.claude', 'kodelyth-ecc-install-state.json'),
  path.join(os.homedir(), '.codeium', 'windsurf', 'kodelyth-ecc-install-state.json'),
  path.join(os.homedir(), '.codex', 'kodelyth-ecc-install-state.json'),
  path.join(process.cwd(), '.windsurf', 'kodelyth-ecc-install-state.json'),
  path.join(process.cwd(), '.cursor', 'kodelyth-ecc-install-state.json'),
  path.join(process.cwd(), '.agent', 'kodelyth-ecc-install-state.json'),
  path.join(process.cwd(), '.opencode', 'kodelyth-ecc-install-state.json'),
];

let state = null;
let stateFile = null;
for (const f of candidates) {
  if (fs.existsSync(f)) { state = JSON.parse(fs.readFileSync(f, 'utf8')); stateFile = f; break; }
}

if (!state) {
  console.error('No install state found. Run the installer manually:');
  console.error('  npx kodelyth-ecc --target <target>');
  process.exit(1);
}

const langs = (state.languages || []).join(' ');
const cmd = ['npx', 'kodelyth-ecc@latest', '--target', state.target, langs].filter(Boolean).join(' ');
console.log('Found install state:', stateFile);
console.log('Previous version:', state.version);
console.log('Running:', cmd);
require('child_process').execSync(cmd, { stdio: 'inherit' });
"
```

### Manual (if you know your target)

```bash
npx kodelyth-ecc@latest                              # Claude Code
npx kodelyth-ecc@latest --target windsurf-home       # Windsurf global
npx kodelyth-ecc@latest --target windsurf-project    # Windsurf project
npx kodelyth-ecc@latest --target codex-home          # Codex CLI
npx kodelyth-ecc@latest --target cursor-project      # Cursor
```

## What Is NOT Overwritten

| Path | Protected |
|------|-----------|
| `~/.kodelythecc/memory/` | Your BM25 memory store |
| `tasks/lessons.md` | Project correction rules |
| `tasks/todo.md` | Open todos |

## After Updating

Run `/doctor` to confirm the new version is healthy.

## Related

- `/doctor` — verify install health
- `use kodelyth-advisor` — guidance after a major version update

> Powered by Kodelyth — stay current, stay sharp.
