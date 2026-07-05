---
title: "Uninstall Kodelyth ECC — Full Cleanup for macOS, Linux, Windows"
description: "Complete Kodelyth ECC removal — 759 shipped files, RTK hook, codebase-mcp configs, ECC MCP entries, and ~/.kodelythecc/ memory. Interactive menu or CLI, dry-run supported."
keywords:
  - uninstall kodelyth ecc
  - remove kodelythecc
  - Claude Code cleanup
  - AI toolkit uninstall
  - kodelythecc removal
  - kodelythecc uninstall
  - dry run uninstall
  - remove Claude agents
  - Kodelyth cleanup
  - MCP removal
og_title: "Uninstall Kodelyth ECC — Full Cleanup"
og_description: "Interactive picker + CLI flags for total ECC removal. Dry-run friendly. Preserves user-authored files."
og_image: /social/section-mcp.svg
og_type: article
twitter_card: summary_large_image
canonical: /docs/uninstall/
last_updated: 2026-07-04
version: 2.4.1
category: guide
---

# Uninstall Kodelyth ECC

Complete removal of Kodelyth ECC from your system. Works on macOS, Linux, and Windows. Interactive menu or direct CLI. Dry-run mode previews changes without touching anything.

## Interactive uninstall (recommended)

```bash
kodelythecc
```

In the menu, select **Uninstall ECC completely**. A picker opens:

```
Confirm

 ▸ Uninstall — remove EVERYTHING including memory
   Uninstall — keep ~/.kodelythecc/ memory + ledgers
   Dry run — show what would be removed, change nothing
   Cancel
```

Pick the level of cleanup you want. Confirmation happens before anything is deleted.

## Non-interactive uninstall

```bash
# Preview what would be removed — safe
kodelythecc uninstall --dry-run

# Full cleanup, remove memory too
kodelythecc uninstall --yes

# Cleanup, keep ~/.kodelythecc/ memory + ledgers
kodelythecc uninstall --yes --keep-memory

# Finally remove the npm package itself
npm uninstall -g kodelyth-ecc
```

## What gets removed

The uninstall routine runs in this order:

### 1. ECC-shipped files in `~/.claude/`

Only files that ECC installed. **User-authored siblings in the same directories are preserved** — the routine checks the ECC package's own `agents/skills/commands/hooks/rules/scripts/` directories to know which specific files it owns.

Live dry-run count on a fresh install:

| Kind | Files |
|---|---:|
| `agents/` | 70 |
| `skills/` | 301 |
| `commands/` | 99 |
| `hooks/` | 12 |
| `rules/` | 104 |
| `scripts/` | 173 |
| **Total** | **759** |

After each subdir is cleaned, any now-empty ECC-owned subdirectories are removed. Directories with user-authored files remain.

### 2. MCP server entries

Removes the `kodelyth-ecc` entry from:

- `~/.claude.json` (Claude Code user-level MCP)
- `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- `%APPDATA%/Claude/claude_desktop_config.json` (Windows)
- `~/.config/Claude/claude_desktop_config.json` (Linux)

Other MCP entries (including `codebase-memory-mcp`) are preserved.

### 3. RTK integration

Runs the RTK team's own uninstall command:

```bash
rtk init -g --uninstall
```

This removes the PreToolUse hook from Claude Code's `settings.json` and cleans up the RTK.md file. The `rtk` binary itself is **not** removed — to remove it entirely:

```bash
brew uninstall rtk    # if you installed via brew
# or delete ~/.local/bin/rtk if you installed via curl
```

### 4. codebase-memory-mcp registration

Runs their own uninstall:

```bash
codebase-memory-mcp uninstall
```

This removes agent configs (MCP entries, instruction files, pre-tool hooks) across every installed agent. The binary and SQLite databases in `~/.cache/codebase-memory-mcp/` stay unless you explicitly remove them.

### 5. `~/.kodelythecc/` (memory, ledgers, cache)

Removed unless `--keep-memory` or menu option 2 is chosen.

Contents removed:

```
~/.kodelythecc/
├── memory/           # BM25 memory store
├── terse/            # Terse mode ledger
├── evolve/           # Evolve reuse + routing-miss signals
├── update-check.json # 24h npm cache
└── dashboard-daemon.pid  # If daemon was running
```

### 6. Legacy migration backups

Any `.kodelyth.backup-YYYY-MM-DD` directories in your home (created by the 1.8.6 memory-path migration) are removed.

## What does NOT get removed

- Your **npm package** — run `npm uninstall -g kodelyth-ecc` separately
- Any **user-authored files** you added to `~/.claude/agents/`, `~/.claude/skills/`, `~/.claude/commands/`, etc. — only ECC-shipped files are removed
- The **rtk binary** — remove with `brew uninstall rtk` or delete `~/.local/bin/rtk` yourself
- The **codebase-memory-mcp binary** — remove with `rm ~/.local/bin/codebase-memory-mcp` yourself
- Its **cache database** — remove with `rm -rf ~/.cache/codebase-memory-mcp/` yourself
- **Anything you customized** in your AI tool's settings that wasn't added by ECC

## Dry run — verify before you commit

```bash
kodelythecc uninstall --dry-run
```

Sample output on this maintainer's Mac:

```
Removing ECC-installed files from ~/.claude/ …
  [dry-run] would remove 70 agents files from /Users/you/.claude/agents
  [dry-run] would remove 301 skills files from /Users/you/.claude/skills
  [dry-run] would remove 99 commands files from /Users/you/.claude/commands
  [dry-run] would remove 12 hooks files from /Users/you/.claude/hooks
  [dry-run] would remove 104 rules files from /Users/you/.claude/rules
  [dry-run] would remove 173 scripts files from /Users/you/.claude/scripts
  [dry-run] would unregister kodelyth-ecc MCP server from Claude Code + Desktop
Unwiring RTK integrations …
Uninstalling codebase-memory-mcp agent configs …
[dry-run] would remove ~/.kodelythecc/ (memory, ledgers, cache) …
  [dry-run] would remove backup /Users/you/.kodelyth.backup-2026-07-03

Removed 0 files across 3 subsystems.
(dry-run — no changes made)
```

Nothing is touched in dry-run mode.

## Fresh reinstall after uninstall

After a full uninstall, reinstalling is a single command:

```bash
npm i -g kodelyth-ecc
kodelythecc --target claude-code --codebase-graph
```

The installer detects the missing state and rebuilds everything cleanly.

## Programmatic use

The uninstall module is exported:

```javascript
const { plan, run } = require('kodelyth-ecc/scripts/cli/uninstall.js');

// See what would be removed
const p = plan(process.env.PWD);
console.log(p.shipped);   // { agents: 70, skills: 301, commands: 99, ... }
console.log(p.dests);     // { agents: '~/.claude/agents', ... }

// Actually run
const result = run({
  log: console.log,
  dryRun: false,
  keepMemory: false,
});
console.log(result);
// → { removed_files, dirs_removed, subsystems_uninstalled, errors }
```

## Troubleshooting

**"Permission denied" on some files** → Some files may be locked by a running AI tool. Fully quit Claude Code / Cursor / Windsurf first, then re-run.

**"Cannot find `rtk`"** → RTK was never installed. Safe to ignore, `rtk` uninstall step is skipped gracefully.

**"Cannot find `codebase-memory-mcp`"** → codebase-graph was never installed. Same — skipped gracefully.

**Left over files after uninstall** → Anything under `~/.claude/agents/` or `~/.claude/skills/` that wasn't in ECC's own package directory is treated as user-authored and preserved. If you added custom agents, they're kept.

**`npm uninstall -g kodelyth-ecc` fails** → Try `sudo npm uninstall -g kodelyth-ecc` if npm was installed system-wide.

## Source

- `scripts/cli/uninstall.js` — the module
- `scripts/mcp/register-self.js` — MCP-entry cleanup helper
- `bin/kodelyth-ecc.js` — the `uninstall` subcommand handler

## See also

- **[Getting Started](./getting-started.md)** — the reverse operation
- **[Interactive CLI](./interactive-cli.md)** — where the menu option lives
- **[MCP Server](./mcp.md)** — MCP entry registration details
