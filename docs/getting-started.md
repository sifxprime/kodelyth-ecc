---
title: "Getting Started with Kodelyth ECC — Install AI Agents in Claude Code, Cursor, Windsurf"
description: "Install Kodelyth ECC in one command. 71 AI agents, the Super Agent orchestrator, RTK token savings, Terse mode, and codebase graph auto-wire into Claude Code, Cursor, Windsurf, Codex, Antigravity, Kiro, and more."
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
og_description: "One-command install for 71 AI agents + the Super Agent orchestrator + token savings + codebase graph across 12 AI coding IDEs."
og_image: /docs/getting-started.svg
hero_alt: "One install command wiring 71 agents, RTK savings, Terse mode and the codebase graph into Claude Code, Cursor, Windsurf, Codex, Kiro and 12 platforms."
og_type: article
twitter_card: summary_large_image
canonical: /docs/getting-started/
last_updated: 2026-11-08
version: 2.29.0
category: guide
---

# Getting Started

Install Kodelyth ECC and get 71 specialist agents (including the Super Agent orchestrator), 196 skills, 104 slash commands, RTK input compression, Terse output compression, the codebase graph, a universal MCP server, and local Memory Core recall — all wired into your AI coding tool in one command.

## Prerequisites

- **Node.js 18+** (check with `node --version`)
- **A supported AI coding tool** — Claude Code, Cursor, Windsurf, Codex, Antigravity, OpenCode, Cline, Roo Code, Aider, Kimi, Gemini CLI, or Kiro

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
2. Copied 71 agents + 196 skills + 104 commands + 44 hook entries + 15 rules into `~/.claude/`
3. Auto-installed **RTK** binary (via Homebrew on macOS, curl on Linux) and wired its PreToolUse hook
4. Copied the **Terse mode** skill + `/terse` and `/terse-compress` slash commands (dormant — activate with `/terse`)
5. Auto-installed **codebase-memory-mcp** and registered its MCP entries in every detected AI-coding agent
6. Registered **ECC's own MCP server** (and local memory) in Claude Code (`~/.claude.json`) and Claude Desktop — and, when your `--target` is Cursor, Windsurf, Gemini CLI, Codex, or Kiro, auto-wired it there too
7. Ran legacy-memory migration if you had `~/.kodelyth/` from an older install → `~/.kodelythecc/`

### Install for other IDEs

```bash
kodelythecc --target cursor-project              # Cursor
kodelythecc --target windsurf-home       # Windsurf (user-level)
kodelythecc --target antigravity         # Google Antigravity
kodelythecc --target codex-home          # Codex CLI
kodelythecc --target opencode            # OpenCode
kodelythecc --target cline               # Cline
kodelythecc --target roocode             # Roo Code
kodelythecc --target aider               # Aider
kodelythecc --target kimi                # Kimi
kodelythecc --target gemini-home         # Gemini CLI (user-level)
kodelythecc --target kiro                # Kiro (AWS) — project-level
```

Add `--codebase-graph` to any of these to also install the codebase graph MCP. Targeting Cursor, Windsurf, Gemini CLI, Codex, or Kiro also auto-wires ECC's MCP server and local memory into that IDE.

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
kodelythecc mcp-list
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
/super-agent build a rate-limited login API with tests
```
→ the autonomous orchestrator decomposes the objective into a dependency DAG, runs independent steps in parallel on their own branches, conflict-checks and integrates, then verifies — resumable and budget-capped. See [Super Agent](./super-agent.md).

```
/terse full
```
→ Terse mode activates. Every reply from this point is compressed.

You never had to remember an agent name. That's [Intent Routing v2](./intent-routing.md).

## Memory that follows the project

ECC captures the solution that worked at the end of a session and recalls the
relevant one on your next prompt — injected into context before the AI answers.
**Memory Core** keys that store to your git remote, so it follows the project even
if you move or re-clone the repo; it redacts secrets before they're ever written,
and ranks by relevance, recency, and whether the fix actually worked. It lives
locally at `~/.kodelythecc/memory/` — no cloud, no account, nothing leaves the
machine. On the six MCP-wired IDEs it's reachable as the `recall_memory` /
`capture_memory` tools; everywhere else it feeds the session automatically.

## Interactive menu

Type `kodelythecc` alone in a real terminal:

```
⚙ Kodelyth ECC  v2.29.0  ·  Elite Code Crew   up to date

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
├── agents/                        # 71 ECC agent files
├── skills/                        # 196 ECC skill files
├── commands/                      # 104 ECC slash commands
├── hooks/                         # 9 ECC hook scripts (44 entries across 8 events)
├── rules/                         # 15 always-on rule files
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
