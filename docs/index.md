---
title: "Kodelyth ECC Documentation — AI Coding Toolkit for Claude Code, Cursor, Windsurf, and More"
description: "Complete documentation for Kodelyth ECC — 70 specialist agents, 194 skills, 97 commands, RTK input compression, Terse mode, codebase graph, MCP server. Zero telemetry, 100% local."
keywords:
  - kodelyth ecc
  - AI coding toolkit
  - Claude Code plugin
  - Cursor extension
  - Windsurf toolkit
  - Codex CLI
  - Antigravity plugin
  - Gemini CLI
  - AI agents
  - MCP server
  - Model Context Protocol
  - RTK Rust Token Killer
  - Terse mode
  - codebase memory
  - intent routing
  - BM25 memory
  - AI code review
  - local AI toolkit
  - zero telemetry AI
og_title: "Kodelyth ECC — Production AI Coding Toolkit Documentation"
og_description: "70 agents, 194 skills, 97 commands, MCP server, RTK + Terse token savings, codebase graph — all local, zero telemetry. Docs, guides, and API reference."
og_image: /social/og-image.svg
og_type: website
twitter_card: summary_large_image
twitter_title: "Kodelyth ECC — AI Coding Toolkit Docs"
twitter_description: "70 agents, 194 skills, MCP, RTK + Terse token savings — all local. Complete docs."
canonical: /docs/
last_updated: 2026-07-04
version: 2.4.1
category: hub
---

# Kodelyth ECC Documentation

The complete reference for **Kodelyth Elite Code Crew (ECC)** — a production-grade AI coding toolkit that ships as agents, skills, commands, hooks, and rules across 11 AI coding platforms. Everything runs locally. Zero telemetry.

**Version**: `2.4.1` · **npm**: [`kodelyth-ecc`](https://www.npmjs.com/package/kodelyth-ecc) · **GitHub**: [`sifxprime/kodelyth-ecc`](https://github.com/sifxprime/kodelyth-ecc)

---

## Quick start

New here? Start with these three:

- **[Getting Started](./getting-started.md)** — one-command install, verify, first agent invocation
- **[Interactive CLI](./interactive-cli.md)** — the `kodelythecc` arrow-key menu
- **[Intent Routing v2](./intent-routing.md)** — how plain-language messages map to specialist agents

## Token savings (input + output)

Two independent compression layers stack for **55-65% total token reduction** on typical coding sessions:

- **[RTK — Input Token Savings](./rtk.md)** — filters shell command output before it reaches the LLM. 60-90% input savings on `git`, `ls`, `cargo test`, `docker ps`, and 100+ more commands
- **[Terse Mode — Output Token Savings](./terse-mode.md)** — a 4-level output compression dial that shrinks what the AI writes without touching what it knows

## Structural intelligence

- **[Codebase Graph](./codebase-graph.md)** — AST-parsed knowledge graph across 158 languages via `codebase-memory-mcp`. 99% fewer tokens on "who calls X" questions vs file-by-file grep
- **[MCP Server](./mcp.md)** — universal adapter exposing 70 agents + 194 skills + 97 commands + 14 rules to Claude Desktop, LangGraph, AutoGen, CrewAI, OpenAI Agents SDK, and any MCP client
- **[External MCP Servers](./mcp-clients.md)** — register Stripe, GitHub, Postgres, Redis MCPs into the ECC surface

## Local, self-learning memory

- **[Evolve](./evolve.md)** — the self-evolving memory pipeline that turns repeated captures into proposed skill upgrades
- **[Dashboard](./dashboard.md)** — localhost-only observability across Memory, RTK, Terse, Codebase, Evolve, Catalog, Sessions

## Advanced

- **[Swarm](./swarm.md)** — parallel agent execution in isolated git worktrees + tmux
- **[Replay](./replay.md)** — deterministic session replay from a portable bundle
- **[Supply Chain](./supply-chain.md)** — SBOM, manifest, verify

## Managing the install

- **[Uninstall](./uninstall.md)** — full cleanup (~/.claude/ files, RTK hook, codebase-mcp configs, `~/.kodelythecc/`)

---

## Platform support

| Platform | Agents | Skills | Commands | Hooks | Rules |
|---|:---:|:---:|:---:|:---:|:---:|
| Claude Code | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cursor | ✓ | ✓ | ✓ | — | ✓ |
| Windsurf | ✓ | ✓ | ✓ | — | ✓ |
| Codex CLI | ✓ | ✓ | ✓ | — | ✓ |
| Google Antigravity | ✓ | ✓ | ✓ | — | ✓ |
| OpenCode | ✓ | ✓ | ✓ | — | ✓ |
| Cline | ✓ | ✓ | ✓ | — | ✓ |
| Roo Code | ✓ | ✓ | ✓ | — | ✓ |
| Aider | ✓ | ✓ | ✓ | — | ✓ |
| Kimi | ✓ | ✓ | ✓ | — | ✓ |
| Gemini CLI | ✓ | ✓ | ✓ | — | ✓ |

11 platforms, 13 install targets (some platforms have both user-level and project-level targets).

## Design principles

1. **Zero telemetry** — everything runs on your disk, nothing sent anywhere
2. **Zero runtime dependencies** in the core (a few optional peer deps for MCP)
3. **File-based, editable** — every agent/skill/command/hook/rule is a markdown or JSON file you can read and change
4. **Composable** — layer works with layer (memory feeds routing feeds agent feeds hook)

---

## Quick reference

```bash
# install
npm i -g kodelyth-ecc
kodelythecc --target claude-code --codebase-graph

# interactive menu
kodelythecc

# per-tool status
kodelythecc rtk status
kodelythecc terse status
kodelythecc codebase status
kodelythecc mcp-register --status

# dashboard
kodelythecc dashboard

# uninstall
kodelythecc uninstall --dry-run
kodelythecc uninstall --yes
```

For the full CLI reference, see **[Getting Started → CLI Commands](./getting-started.md#cli-commands)**.
