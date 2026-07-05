---
title: "Getting Started with Kodelyth ECC — Install AI Agents in Claude Code, Cursor, Windsurf"
description: "Install Kodelyth ECC in one command. 70 AI agents, RTK token savings, Terse mode, and codebase graph auto-wire into Claude Code, Cursor, Windsurf, Codex, Antigravity, and more."
keywords:
  - install kodelyth ecc
  - Claude Code setup
  - Cursor AI agents
  - Windsurf install
  - Codex CLI setup
  - Antigravity install
  - AI toolkit install
  - kodelythecc CLI
  - npx kodelyth-ecc
  - Claude Code MCP setup
og_title: "Getting Started — Kodelyth ECC"
og_description: "One-command install for 70 AI agents + token savings + codebase graph across 11 AI coding IDEs."
og_image: /social/card-install.svg
og_type: article
twitter_card: summary_large_image
canonical: /docs/getting-started/
last_updated: 2026-07-04
version: 2.4.1
category: guide
---

# Getting Started

Install Kodelyth ECC and get 70 specialist agents, 194 skills, 97 slash commands, RTK input compression, Terse output compression, and the codebase graph — all wired into your AI coding tool in one command.

## Prerequisites

- **Node.js 18+** (check with `node --version`)
- **A supported AI coding tool** — Claude Code, Cursor, Windsurf, Codex, Antigravity, OpenCode, Cline, Roo Code, Aider, Kimi, or Gemini CLI

macOS, Linux, and Windows are all supported.

## Install in one command

```bash
npm i -g kodelyth-ecc
kodelythecc --target claude-code --codebase-graph
```

Restart your AI coding tool. Done.

### What just happened

That single flow ran:

1. Installed both binaries (`kodelyth-ecc` and short-form `kodelythecc`) to your PATH
2. Copied 70 agents + 194 skills + 97 commands + 22 hooks + 14 rules into `~/.claude/`
3. Auto-installed **RTK** binary (via Homebrew on macOS, curl on Linux) and wired its PreToolUse hook
4. Copied the **Terse mode** skill + `/terse` and `/terse-compress` slash commands (dormant — activate with `/terse`)
5. Auto-installed **codebase-memory-mcp** and registered its MCP entries in every detected AI-coding agent
6. Registered **ECC's own MCP server** in Claude Code (`~/.claude.json`) and Claude Desktop (`claude_desktop_config.json`)
7. Ran legacy-memory migration if you had `~/.kodelyth/` from an older install → `~/.kodelythecc/`

### Install for other IDEs

```bash
kodelythecc --target cursor              # Cursor
kodelythecc --target windsurf-home       # Windsurf (user-level)
kodelythecc --target antigravity         # Google Antigravity
kodelythecc --target codex-home          # Codex CLI
kodelythecc --target opencode            # OpenCode
kodelythecc --target cline               # Cline
kodelythecc --target roocode             # Roo Code
kodelythecc --target aider               # Aider
kodelythecc --target kimi                # Kimi
kodelythecc --target gemini-home         # Gemini CLI (user-level)
```

Add `--codebase-graph` to any of these to also install the codebase graph MCP.

## Verify the install

```bash
# Both binaries on PATH
which kodelyth-ecc kodelythecc

# Version check
kodelythecc --version

# All subsystems reporting
kodelythecc rtk status
kodelythecc terse status
kodelythecc codebase status
kodelythecc mcp-register --status
```

Every command should report a healthy state. If any doesn't, jump to the relevant per-feature doc:

- [RTK](./rtk.md) — input token savings
- [Terse Mode](./terse-mode.md) — output token savings
- [Codebase Graph](./codebase-graph.md) — code intelligence
- [MCP Server](./mcp.md) — universal adapter

## Your first invocation

Open your AI coding tool. Type any of these:

```
I've been stuck on this bug for hours
```
→ ECC auto-routes to `debug-detective`.

```
Review this code before I merge
```
→ ECC auto-routes to `code-reviewer`.

```
Index this project
```
→ codebase-memory-mcp builds an AST graph of your repo.

```
/terse full
```
→ Terse mode activates. Every reply from this point is compressed.

You never had to remember an agent name. That's [Intent Routing v2](./intent-routing.md).

## Interactive menu

Type `kodelythecc` alone in a real terminal:

```
⚙ Kodelyth ECC  v2.4.1  ·  Elite Code Crew   up to date

 ▸ Open Dashboard
   Install ECC for another IDE
   RTK status
   Terse status
   Codebase graph status
   Memory stats
   Run in background
   Uninstall ECC completely
   Exit

↑/↓ navigate  ·  ⏎ select  ·  q / esc / Ctrl+C to quit
```

Full details in [Interactive CLI](./interactive-cli.md).

## CLI commands

All commands support `--help`:

```bash
kodelythecc --help              # top-level menu
kodelythecc rtk --help          # RTK subcommands
kodelythecc terse --help        # terse mode
kodelythecc codebase --help     # code graph queries
kodelythecc mcp --help          # MCP server
kodelythecc dashboard --help    # observability
```

Full subcommand list:

| Command | What it does |
|---|---|
| `kodelythecc` | Interactive menu |
| `kodelythecc --target X` | Install ECC into target IDE |
| `kodelythecc mcp` | Start ECC's own MCP server (stdio JSON-RPC) |
| `kodelythecc mcp-add <name> -- <cmd>` | Register an external MCP server |
| `kodelythecc mcp-register` | Add ECC MCP entry to Claude Code + Desktop configs |
| `kodelythecc rtk <install\|enable\|disable\|status\|gain>` | Manage RTK |
| `kodelythecc terse <status\|stats\|compress\|enable>` | Manage Terse mode |
| `kodelythecc codebase <install\|status\|register\|query>` | Manage codebase graph |
| `kodelythecc dashboard [--port] [--host] [--no-open]` | Boot local dashboard |
| `kodelythecc route "<task>"` | Cost-aware model tier recommendation |
| `kodelythecc swarm --task "<task>"` | Parallel agents in git worktrees |
| `kodelythecc evolve analyze` | Self-evolving memory proposals |
| `kodelythecc session-export <session>` | Export session as portable bundle |
| `kodelythecc replay <bundle>` | Re-run a session |
| `kodelythecc sbom` | Emit CycloneDX 1.5 SBOM |
| `kodelythecc manifest` | Emit sha256 content manifest |
| `kodelythecc verify` | Verify install against manifest |
| `kodelythecc uninstall <--dry-run\|--yes\|--keep-memory>` | Full cleanup |

## Where things live on disk

```
~/.kodelythecc/                    # Memory store, RTK ledger, Terse ledger, evolve, update cache
├── memory/
│   ├── memories.jsonl             # BM25 memory store
│   ├── index.json                 # Inverted index for BM25 recall
│   └── projects/                  # Per-project memory shortcuts
├── terse/
│   └── ledger.jsonl               # Terse output token savings
├── evolve/
│   ├── reuse.json                 # Memory reuse signals
│   └── routing-misses.jsonl       # Intent-routing miss signals
├── update-check.json              # 24h npm registry cache
└── dashboard-daemon.pid           # If dashboard is backgrounded

~/.claude/                          # Claude Code config directory
├── agents/                        # 70 ECC agent files
├── skills/                        # 194 ECC skill files
├── commands/                      # 97 ECC slash commands
├── hooks/                         # 22+ ECC hook scripts
├── rules/                         # 14 always-on rule files
└── settings.json                  # ECC hooks + mcpServers entries

~/.claude.json                      # User-level MCP server registry (ECC + codebase-mcp)
~/Library/Application Support/Claude/claude_desktop_config.json    # Claude Desktop MCP config
```

## Where to go next

- **[Intent Routing v2](./intent-routing.md)** — how routing decides which agent to fire
- **[RTK](./rtk.md)** — deep-dive on input compression
- **[Terse Mode](./terse-mode.md)** — output compression
- **[Codebase Graph](./codebase-graph.md)** — structural code intelligence
- **[Dashboard](./dashboard.md)** — the localhost observability UI
- **[MCP Server](./mcp.md)** — expose ECC to any MCP-compatible client
