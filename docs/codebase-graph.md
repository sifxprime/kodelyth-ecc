---
title: "Codebase Graph — AST Code Intelligence Across 158 Languages"
description: "Kodelyth ECC wires DeusData codebase-memory-mcp for AST-parsed knowledge graph across 158 languages. Structural queries at 99% fewer tokens than file-by-file grep."
keywords:
  - codebase graph
  - AST code analysis
  - tree-sitter code index
  - codebase-memory-mcp
  - Claude Code codebase
  - call chain analysis
  - Cypher code queries
  - dead code detection
  - impact analysis
  - code intelligence AI
  - LSP semantic types
og_title: "Codebase Graph — Kodelyth ECC"
og_description: "158-language AST knowledge graph. 99% fewer tokens on structural queries. Auto-installed with ECC."
og_image: /social/hype-mcp-server.svg
og_type: article
twitter_card: summary_large_image
canonical: /docs/codebase-graph/
last_updated: 2026-07-04
version: 2.4.1
category: feature
---

# Codebase Graph — AST Intelligence Across 158 Languages

Kodelyth ECC integrates **[DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp)** — a single static binary that indexes any codebase into a tree-sitter AST knowledge graph with Hybrid LSP semantic type resolution.

Structural queries like "who calls X" or "what does the auth flow look like" now cost ~3,400 tokens instead of ~412,000 tokens via file-by-file grep. **99% token reduction**.

Their binary, their curl script, their MIT license. ECC installs, wires, and surfaces it. No fork, no code copy, no npm dependency.

## What you get

- **AST-parsed graph** — 158 languages via tree-sitter grammars vendored into the binary
- **Hybrid LSP** — semantic type resolution for Python, TypeScript / JavaScript / JSX / TSX, PHP, C#, Go, C, C++, Java, Kotlin, and Rust (parameter binding, return-type inference, generic substitution, JSX component dispatch, JSDoc inference)
- **Cross-service linking** — HTTP routes, gRPC, GraphQL, tRPC, EventEmitter channels
- **14 MCP tools** — `search_graph`, `trace_path`, `get_architecture`, `manage_adr`, `semantic_query`, `detect_changes`, `search_code`, `dead code detection`, `Cypher queries`, and more
- **Zero infrastructure** — SQLite-backed, persists to `~/.cache/codebase-memory-mcp/`
- **Local only** — your code never leaves your machine

## Auto-install via ECC

Add `--codebase-graph` to your install:

```bash
npm i -g kodelyth-ecc
kodelythecc --target claude-code --codebase-graph
```

Or after ECC is installed:

```bash
kodelythecc codebase install
```

Both flows:

1. Detect if `codebase-memory-mcp` is on your PATH (idempotent — reuses existing install)
2. If not, install via their official curl script (`~/.local/bin/codebase-memory-mcp`)
3. Run their `install` command which auto-registers MCP entries in every detected AI-coding agent (`~/.claude.json`, Codex CLI, Gemini CLI, Zed, OpenCode, Antigravity, Aider, KiloCode, VS Code, OpenClaw, Kiro)

## First index

Open a project in your AI tool. Say:

> Index this project

The MCP tool `index_repository` builds the graph. Django-scale takes ~6 seconds. Linux kernel (28M LOC, 75K files) takes 3 minutes.

Verify:

```bash
kodelythecc codebase status
```

```
codebase-memory-mcp: codebase-memory-mcp 0.8.1
  indexed projects: 8
  cache dir:        /Users/you/.cache/codebase-memory-mcp
  next: open a project in your AI tool and say "Index this project"
```

## Query the graph from the CLI

```bash
kodelythecc codebase query search_graph '{"name_pattern": ".*Handler.*"}'
kodelythecc codebase query trace_path   '{"function_name": "main", "direction": "outbound"}'
kodelythecc codebase query get_architecture '{}'
kodelythecc codebase query detect_changes '{}'
```

All queries run locally. No LLM cost. Results are structured JSON your AI tool can consume in a single MCP call.

## CLI reference

```bash
kodelythecc codebase install                              # install binary + auto-register agents
kodelythecc codebase status [--json]                      # binary version + indexed projects + cache dir
kodelythecc codebase register                             # re-run their auto-configure step for installed agents
kodelythecc codebase query <cli-cmd> [json]               # pass-through to `codebase-memory-mcp cli`
kodelythecc codebase --help                               # focused help
```

## Graph edge types (selected)

- `CALLS` — function-to-function
- `IMPORTS` — module dependency
- `DEFINES` — file defines a symbol
- `IMPLEMENTS` — interface/trait implementation
- `INHERITS` — class inheritance
- `HTTP_CALLS`, `ASYNC_CALLS` — cross-service
- `EMITS`, `LISTENS_ON` — pub-sub channels
- `DATA_FLOWS` — arg-to-param mapping with field access chains
- `SIMILAR_TO` — MinHash + LSH near-clone detection
- `SEMANTICALLY_RELATED` — vocabulary-mismatch, same-language, score ≥ 0.80

## Common queries (via your AI tool)

Once indexed, ask your AI tool things like:

- "Who calls `ProcessOrder`?"
- "What's the impact of changing `AuthMiddleware`?"
- "Show me the architecture of this repo"
- "Find dead code — functions with zero callers"
- "Which HTTP routes touch the `users` table?"

The AI translates natural language to MCP calls behind the scenes. You never write Cypher unless you want to.

## Dashboard view

`kodelythecc dashboard` → **Codebase** tab shows:

- Binary version
- Indexed project count (real, from `list_projects`)
- Graph nodes / edges
- Language distribution
- Entry points (top 5)
- Project list with per-project node + edge counts

When no active session graph exists, dashboard shows the indexed project list with node/edge counts. When you open a project in your AI tool, its architecture snapshot fills in.

All numbers come from live queries — zero hardcoded values.

## Performance

Benchmarked on Apple M3 Pro (from their docs):

| Operation | Time |
|---|---|
| Linux kernel full index | 3 min (28M LOC, 75K files → 4.81M nodes, 7.72M edges) |
| Linux kernel fast index | 1m 12s (1.88M nodes) |
| Django full index | ~6s (49K nodes, 196K edges) |
| Cypher query | <1ms |
| Name search (regex) | <10ms |
| Dead code detection | ~150ms |
| Trace call path (depth=5) | <10ms |

**RAM-first pipeline**: all indexing runs in memory with LZ4 compression and in-memory SQLite. Memory is released after indexing completes.

## Attribution

- **License**: MIT
- **Maintainer**: [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp)
- **Research paper**: [Codebase-Memory: Tree-Sitter-Based Knowledge Graphs for LLM Code Exploration via MCP](https://arxiv.org/abs/2603.27277)
- **ECC's wrapper**: `scripts/codebase/index.js` — thin, no fork
- **Fallback**: If upstream disappears, ECC will fork + vendor. MIT permits.

## See also

- **[MCP Server](./mcp.md)** — how ECC exposes its own MCP surface
- **[External MCP Servers](./mcp-clients.md)** — register more MCP servers
- **[Dashboard](./dashboard.md)** — live codebase tile
- **[Getting Started](./getting-started.md)** — install path
