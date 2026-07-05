---
title: "RTK Integration — 60-90% Input Token Savings for Claude Code and Every AI IDE"
description: "How Kodelyth ECC wires RTK (Rust Token Killer) into Claude Code, Cursor, Windsurf, and every supported AI IDE for 60-90% shell-command input token savings — automatically."
keywords:
  - RTK
  - Rust Token Killer
  - Claude Code token savings
  - AI token cost reduction
  - shell command compression
  - Claude Code hook
  - rtk-ai/rtk
  - AI cost optimization
  - git status compression
  - cargo test compression
  - AI toolkit token savings
og_title: "RTK Input Token Savings — Kodelyth ECC"
og_description: "Auto-install and wire RTK across every AI IDE. 60-90% input token reduction on shell commands. Live ledger in the dashboard."
og_image: /social/hype-stats-hero.svg
og_type: article
twitter_card: summary_large_image
canonical: /docs/rtk/
last_updated: 2026-07-04
version: 2.4.1
category: feature
---

# RTK — Input Token Savings

Kodelyth ECC ships end-to-end integration with **[RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk)** — a standalone Rust binary that intercepts shell commands, filters their output, and returns 60-90% fewer tokens to the LLM without losing information.

Written by the RTK team (Apache-2.0). ECC installs, configures, tracks, and reports it. Zero fork, zero code copy.

## Why it matters

Every time your AI tool runs `git status`, `ls`, `cargo test`, `docker ps`, `kubectl logs`, or any of 100+ common dev commands, it burns thousands of tokens on formatting noise, timestamps, ANSI codes, and duplicated lines. RTK strips that. What reaches the LLM is the meaningful signal — and only the meaningful signal.

Live ledger from this project maintainer's Mac:

```
total_commands:    1,285
total_input:       7,964,612    ← raw
total_output:      2,858,501    ← after RTK filter
total_saved:       5,107,394    ← 64.1% reduction, all real
```

## How it works

RTK ships a native binary that:

1. Installs a **PreToolUse hook** in your AI tool's config
2. When the tool tries to run `git status`, the hook rewrites it to `rtk git status` transparently
3. RTK executes the real command, filters the output using command-specific rules, and returns the compressed result
4. The AI sees the compressed output — never even knows the raw output existed

100+ commands supported: `git`, `ls`, `tree`, `find`, `grep`, `cat`, `head`, `tail`, `cargo`, `pytest`, `jest`, `docker`, `kubectl`, `npm`, `pnpm`, `yarn`, `gh`, `aws`, and many more.

## Auto-install via ECC

RTK is installed automatically when you install ECC:

```bash
npm i -g kodelyth-ecc
kodelythecc --target claude-code
```

The post-install step:

- Detects if `rtk` is already on your PATH (idempotent — reuses existing install)
- If not, installs via **Homebrew** on macOS, official **curl script** on Linux / WSL
- Runs `rtk init -g --auto-patch` to write the PreToolUse hook into `~/.claude/settings.json`
- Prints a summary block confirming the wire-up

Opt out with `--no-rtk`:

```bash
kodelythecc --target claude-code --no-rtk
```

Native Windows install requires manual `.zip` download from RTK releases. WSL uses the Linux path.

## CLI reference

```bash
kodelythecc rtk install                 # install rtk binary (brew or curl)
kodelythecc rtk enable [--target X]     # wire rtk into an IDE (default: claude-code)
kodelythecc rtk enable --all            # wire rtk into every ECC-installed IDE
kodelythecc rtk disable [--target X]    # remove rtk hook from an IDE
kodelythecc rtk status [--json]         # binary version + active integrations
kodelythecc rtk gain [-a] [--format]    # thin passthrough to `rtk gain`
kodelythecc rtk --help                  # focused help
```

### Multi-IDE wiring in one shot

```bash
kodelythecc rtk enable --all
```

Auto-detects every IDE that ECC has been installed for and wires RTK into all of them. Live example:

```
  ✓ claude-code
  ✓ codex-home
  ✓ gemini-home

RTK enabled on 3/3 IDEs. Restart each to activate.
```

The `--all` mode checks these config paths:
- `~/.claude/agents/` → `claude-code`
- `~/.cursor/rules/` → `cursor`
- `~/.codeium/windsurf/memories/` → `windsurf-home`
- `~/.antigravity/` → `antigravity`
- `~/.codex/` → `codex-home`
- `~/.config/opencode/` → `opencode`
- `~/.gemini/` → `gemini-home`

### Per-target flags

RTK's own `init` command uses different flag names for different IDEs. ECC translates automatically:

| ECC target | RTK invocation |
|---|---|
| `claude-code` | `rtk init -g --auto-patch` |
| `cursor` | `rtk init -g --agent cursor` |
| `cursor-project` | `rtk init --agent cursor` |
| `windsurf-home` | `rtk init -g --agent windsurf` |
| `windsurf-project` | `rtk init --agent windsurf` |
| `antigravity` | `rtk init --agent antigravity` |
| `codex-home` | `rtk init -g --codex` |
| `opencode` | `rtk init -g --opencode` |
| `cline` | `rtk init --agent cline` |
| `gemini-cli` | `rtk init -g --gemini` |

**Note**: RTK rejects `--auto-patch` on non-Claude-Code flows. ECC only passes it to the default Claude Code hook — matches RTK's own rules.

## Dashboard view

`kodelythecc dashboard` → **Token Savings** tab → **Input savings (RTK)** section shows:

- Total tokens saved (all-time)
- Commands filtered
- Raw tokens seen (before compression)
- Active integrations across your IDEs
- 30-day daily savings bar chart

All data comes from RTK's own ledger via `rtk gain --all --format json`. Zero synthetic numbers, zero fallback.

## Combined with Terse mode

RTK saves **input** tokens. **[Terse Mode](./terse-mode.md)** saves **output** tokens. Together they stack:

| Layer | Direction | Typical savings |
|---|---|---|
| RTK | Shell output → LLM | 60-90% |
| Terse | LLM → user | 40-70% |
| **Combined** | Full session | **55-65% total** |

## Attribution

- **License**: RTK is Apache-2.0
- **Maintainer**: [rtk-ai/rtk](https://github.com/rtk-ai/rtk)
- **ECC's wrapper code**: `scripts/rtk/index.js` — thin, no fork, MIT
- **Fallback**: If RTK's upstream ever disappears, ECC will fork + vendor the binary distribution. Apache-2.0 permits it.

## See also

- **[Terse Mode](./terse-mode.md)** — the output-side companion
- **[Dashboard](./dashboard.md)** — live ledger view
- **[Getting Started](./getting-started.md)** — one-command install path
