---
title: "Interactive CLI — Arrow-Key Menu, Update Check, Background Daemon"
description: "Type kodelythecc alone in a terminal for an arrow-key menu with live update check, dashboard, IDE installer, and background daemon. Zero-dep raw-mode CLI in Kodelyth ECC."
keywords:
  - kodelythecc CLI
  - interactive CLI
  - arrow-key menu
  - CLI update check
  - background daemon dashboard
  - AI toolkit CLI
  - Kodelyth interactive
  - npm CLI menu
  - terminal UI Node.js
  - CLI TUI
og_title: "Interactive CLI — Kodelyth ECC"
og_description: "Arrow-key navigation, update check, IDE picker, background daemon, full uninstall — all in one menu."
og_image: /social/x-card-hook.svg
og_type: article
twitter_card: summary_large_image
canonical: /docs/interactive-cli/
last_updated: 2026-07-04
version: 2.4.1
category: feature
---

# Interactive CLI

Type `kodelythecc` alone in a real terminal → an arrow-key menu opens.

```
⚙ Kodelyth ECC  v2.4.1  ·  Elite Code Crew   up to date

 ▸ Open Dashboard                     localhost — RTK, Terse, Codebase, Memory
   Install ECC for another IDE        13-target picker
   RTK status                         Version + wired IDEs + savings
   Terse status                       Skill install state, ledger totals
   Codebase graph status              158 languages, structural queries
   Memory stats                       BM25 recall — captures, projects, tags
   Run in background                  Detached dashboard daemon
   Uninstall ECC completely           Full cleanup with 4-choice picker
   Exit

↑/↓ navigate  ·  ⏎ select  ·  q / esc / Ctrl+C to quit
```

Both `kodelyth-ecc` (canonical) and `kodelythecc` (short alias) trigger the menu. Zero dependencies — raw-mode stdin + ANSI escape sequences.

## When the menu opens (and when it doesn't)

The menu opens **only when interactive** — both stdin and stdout are TTYs, no `CI` env var, no `KODELYTH_NO_MENU=1` env var.

| Situation | Menu opens? |
|---|:---:|
| `kodelythecc` in Terminal / iTerm / any TTY | ✓ |
| `kodelythecc rtk status` (any subcommand) | ✗ — runs subcommand |
| `echo hi \| kodelythecc` (piped stdin) | ✗ — runs installer |
| Inside a CI job (`$CI` set) | ✗ |
| `KODELYTH_NO_MENU=1 kodelythecc` | ✗ |

This preserves scripting behaviour: piped input still runs the installer, CI still runs cleanly, subcommands still work headless.

## Navigation

| Key | Action |
|---|---|
| `↑` / `k` | Move selection up |
| `↓` / `j` | Move selection down |
| `⏎` / `Enter` | Select current row |
| `q` / `Esc` / `Ctrl+C` | Exit clean, cursor restored |

Vim-style `j`/`k` also works.

## Menu options

### Update to vX.Y.Z (only shown when update is available)

The menu polls `https://registry.npmjs.org/kodelyth-ecc/latest` on open. Results cached 24h in `~/.kodelythecc/update-check.json` so npm isn't hit on every menu open. When a newer version exists, an extra row appears at the top:

```
 ▸ Update to v2.4.2 [NEW]              npm i -g kodelyth-ecc
```

Selecting it runs `npm install -g kodelyth-ecc` in the same terminal.

### Open Dashboard

Boots `kodelythecc dashboard` inline (foreground, port 5747, browser opens). See [Dashboard](./dashboard.md).

### Install ECC for another IDE

Nested picker for 13 install targets:

- `claude-code`
- `cursor-project`
- `windsurf-home` / `windsurf-project`
- `antigravity`
- `codex-home`
- `opencode`
- `cline`
- `roocode`
- `gemini-home` / `gemini-project`
- `kimi`
- `aider`

Select one → runs `kodelythecc --target <choice>` non-interactively (with `KODELYTH_NONINTERACTIVE=1`). Returns to the main menu on Enter.

### RTK status / Terse status / Codebase status

Inline runs the corresponding `kodelythecc <sub> status` command. Press Enter to return to the menu.

### Memory stats

Runs `kodelythecc dashboard` in the foreground so you can browse the Memory tab (full BM25 stats + search).

### Run in background

Forks `kodelythecc dashboard --port 5747 --no-open` as a **detached** process. Survives shell exit:

```
✓ Dashboard daemon started (pid 12345)
  URL:    http://127.0.0.1:5747
  Log:    /Users/you/.kodelythecc/dashboard-daemon.log
  Pid:    /Users/you/.kodelythecc/dashboard-daemon.pid
  Stop:   kill $(cat ~/.kodelythecc/dashboard-daemon.pid)
```

Real daemon. `child.unref()` releases the reference so Node exits.

### Uninstall ECC completely

Opens a 4-choice picker:

1. **Uninstall — remove EVERYTHING including memory**
2. **Uninstall — keep `~/.kodelythecc/` memory + ledgers**
3. **Dry run — show what would be removed, change nothing**
4. **Cancel**

See [Uninstall](./uninstall.md) for the full removal reference.

### Exit

Cleanup + `process.exit(0)`. ANSI cursor restored, raw mode disabled.

## Update check

The check hits npm registry directly:

```
https://registry.npmjs.org/kodelyth-ecc/latest
```

- 2.5-second network timeout — never blocks the menu
- 1-second render deadline — menu shows in <1s even if npm is slow
- Result cached to `~/.kodelythecc/update-check.json` for 24 hours
- Version comparison uses semver-friendly numeric split

Status line at the top shows one of:

| State | Display |
|---|---|
| No update | `up to date` (grey) |
| Update available | `update available: v2.4.2` (yellow) |
| Different but not newer | `latest: v2.3.9` (grey) |
| Still checking | `checking npm registry…` (dim) |

## Programmatic use

The menu module is exported:

```javascript
const { main } = require('kodelyth-ecc/scripts/cli/menu.js');
main().catch(console.error);
```

The update checker is separately available:

```javascript
const { check } = require('kodelyth-ecc/scripts/cli/update-check.js');
const r = await check({ current: '2.4.1' });
// → { current, latest, updateAvailable, cached }
```

## Environment variables

| Var | Effect |
|---|---|
| `KODELYTH_NO_MENU=1` | Skip menu even in a TTY |
| `CI=1` | Auto-skips menu (standard CI convention) |
| `KODELYTH_NONINTERACTIVE=1` | Passed to `install.sh` when the menu triggers an install |

## Source

- `bin/kodelyth-ecc.js` — TTY-detection entry (lines ~40-50)
- `scripts/cli/menu.js` — raw-mode UI + option dispatch
- `scripts/cli/update-check.js` — npm registry polling with cache
- `scripts/cli/uninstall.js` — full cleanup (called from menu option)

All zero-dependency. Nothing external is required to run the menu.

## See also

- **[Getting Started](./getting-started.md)** — install path
- **[Dashboard](./dashboard.md)** — the observability UI the menu launches
- **[Uninstall](./uninstall.md)** — the cleanup routine the menu drives
