---
title: "MCP Server — Universal Adapter for AI Agents (Kodelyth ECC)"
description: "ECC MCP server exposes 70 agents, 194 skills, 97 commands, 14 rules, BM25 memory to any MCP-compatible client — Claude Desktop, LangGraph, AutoGen, CrewAI, OpenAI Agents SDK."
keywords:
  - MCP server
  - Model Context Protocol
  - Claude Desktop MCP
  - LangGraph MCP
  - AutoGen MCP
  - CrewAI MCP
  - OpenAI Agents SDK
  - AI universal adapter
og_title: "MCP Server — Universal Adapter for AI Agents (Kodelyth ECC)"
og_description: "ECC MCP server exposes 70 agents, 194 skills, 97 commands, 14 rules, BM25 memory to any MCP-compatible client — Claude Desktop, LangGraph, AutoGen, CrewAI, OpenAI Agents SDK."
og_image: /social/hype-mcp-server.svg
og_type: article
twitter_card: summary_large_image
canonical: /docs/mcp/
last_updated: 2026-07-04
version: 2.4.1
category: feature
---
# Kodelyth ECC — MCP Server

The Kodelyth ECC MCP (Model Context Protocol) server is the **universal adapter** that lets any MCP-compatible client consume the full ECC stack: 70 agents, 194 skills, 97 commands, 14 rules, 3 power bundles, and the local BM25 self-learning memory.

If you've ever wished LangGraph, AutoGen, CrewAI, OpenAI Agents SDK, Claude Desktop, or any other agent framework could speak ECC natively — this is that bridge.

Local-only, zero telemetry, stdio transport.

---

## Quick start

### 1. Run the server

```bash
# From npm (recommended):
npx kodelyth-ecc mcp

# From this repo:
node scripts/mcp/server.js
```

The server speaks JSON-RPC over **stdio**. It stays alive until stdin closes.

You'll see one stderr banner on boot, e.g.:

```
[kodelyth-mcp] ready · 1.7.0 · 16 tools · 6 prompts · 365 resources
```

### 2. Wire it into your MCP client

#### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS)

```json
{
  "mcpServers": {
    "kodelyth-ecc": {
      "command": "npx",
      "args": ["-y", "kodelyth-ecc", "mcp"]
    }
  }
}
```

#### Cursor / Windsurf / any MCP-aware IDE

Use the same `command` + `args` pattern under whatever the IDE's MCP server config key is.

#### Programmatic clients (LangGraph, AutoGen, CrewAI, OpenAI Agents SDK, custom)

Spawn the server as a subprocess and connect via the official MCP client SDK for your language. The transport is **stdio JSON-RPC** — every spec-compliant client supports it.

---

## What it exposes

### Tools (16)

| Name | Purpose |
|---|---|
| `route_intent` | Suggest the best ECC agent for a user message via token-overlap. Pair with the `routing-rule` prompt for full tier-based routing. |
| `list_agents` | List every ECC agent (name, description, relpath). |
| `list_skills` | List every ECC skill. |
| `list_commands` | List every slash command. |
| `list_rules` | List every rule file in `rules/common/`. |
| `list_bundles` | List the power bundles (indie-hacker, red-team, enterprise). |
| `get_agent` | Fetch the full markdown body of one agent. |
| `get_skill` | Fetch the full markdown body of one skill. |
| `get_command` | Fetch the full markdown body of one slash command (with or without leading `/`). |
| `get_rule` | Fetch a rule file body. |
| `get_bundle` | Fetch a bundle cheat sheet body. |
| `recall_memory` | BM25 search across the local Kodelyth memory store. |
| `capture_memory` | Append a new memory entry (problem + approach + tags). |
| `memory_stats` | Summary of the local memory store. |
| `catalog_stats` | Summary of how many agents/skills/commands/rules/bundles are loaded. |
| `audit_skill_match` | Suggest skills whose description/body overlap a task — useful for deciding which skills to attach as context. |

All tool results follow the MCP `{ content: [{ type: 'text', text: ... }], isError? }` shape. Most return JSON-encoded payloads inside the text channel.

### Prompts (6)

Prompts let clients summon canonical ECC context blocks by name, no tool call needed.

| Name | Returns |
|---|---|
| `routing-rule` | The full ECC intent routing rule (10-tier priority system). |
| `agents-overview` | Compact list of all 70 agents with one-line descriptions. |
| `skills-overview` | Compact list of all 194 skills. |
| `commands-overview` | Compact list of all 97 slash commands. |
| `handoff-chains` | The `agent-handoff` skill body — standard multi-agent chains for new feature, bug fix, refactor, incident, etc. |
| `devil-mode` | The `/devil-mode` parallel command — fires the adversarial red-team crew. |

### Resources (365)

Every agent, skill, command, rule, and bundle is also addressable as an MCP resource:

```
kodelyth://agents/<name>
kodelyth://skills/<name>
kodelyth://commands/<name>
kodelyth://rules/<name>
kodelyth://bundles/<name>
```

All resources are `text/markdown`. Use `resources/list` to discover, `resources/read` to fetch.

---

## Example session

```jsonc
// → client
{ "jsonrpc": "2.0", "id": 1, "method": "initialize",
  "params": { "protocolVersion": "2024-11-05", "capabilities": {},
              "clientInfo": { "name": "my-client", "version": "0.1.0" } } }

// ← server
{ "jsonrpc": "2.0", "id": 1, "result": {
  "protocolVersion": "2024-11-05",
  "capabilities": { "tools": {}, "resources": {}, "prompts": {} },
  "serverInfo": { "name": "kodelyth-ecc", "version": "1.7.0" } } }

// → client
{ "jsonrpc": "2.0", "id": 2, "method": "tools/call",
  "params": { "name": "route_intent",
              "arguments": { "message": "production is down and i don't know why",
                             "top_k": 3 } } }

// ← server (paraphrased)
{ "result": { "content": [{ "type": "text", "text":
  "{ \"suggestions\": [
       { \"agent\": \"incident-commander\", ... },
       { \"agent\": \"debug-detective\",    ... },
       { \"agent\": \"silent-failure-hunter\", ... }
     ] }" }] } }
```

---

## Design notes

- **Pure file reads + memory passthrough.** The server adds no LLM calls of its own. It surfaces ECC context; your client's model decides what to do with it.
- **No telemetry, no network egress.** stdio only. Local memory only. Reads from this repo's checked-in markdown.
- **Lazy SDK load.** The MCP SDK is an `optionalDependency` so installs work without it; the `mcp` subcommand prints a friendly install hint if missing.
- **Cached catalog.** Agent/skill/command lists are cached in-process after first read for sub-millisecond subsequent calls.
- **Memory store is project-aware.** `recall_memory` accepts an optional `project_root` to scope BM25 results to memories captured against that project, falling back to global memories if scoped results are sparse.

---

## Privacy & safety

- The server only reads files under this package and the local memory directory (default `~/.kodelyth/memory/`, override via `KODELYTH_MEMORY_DIR`).
- It writes only when the client invokes `capture_memory`.
- No network calls. No analytics. No phone-home.
- The server never executes arbitrary commands or code. Tools that surface code (`get_agent`, etc.) return markdown documentation, not executable instructions.

---

## Troubleshooting

**"Kodelyth MCP server requires `@modelcontextprotocol/sdk`"** — run `npm install @modelcontextprotocol/sdk` once, or rerun via `npx -y kodelyth-ecc mcp` to let npm fetch optional deps.

**Empty results from `recall_memory` on a fresh memory store** — BM25 needs a few documents before IDF scores rise above the default `minScore` floor. Capture 2-3 memories first.

**Resources missing in your client UI** — some MCP clients render only tools and prompts. Resources are still queryable via `resources/list`.

---

## Roadmap interactions

- **Phase 2.5 — MCP client mode** will add the inverse: ECC agents consuming external MCP servers (Stripe, GitHub, Postgres, Brave, etc.) — making ECC the MCP **hub**, not just a node.
- **Phase 2.3 — local dashboard** will visualize live MCP traffic so you can see which tools/prompts/resources clients hit, in real time.
- **Phase 2.10 — prompt-injection guardrail** will sit in front of MCP responses to scrub jailbreak patterns before they reach client models.

---

Built into [Kodelyth ECC](../README.md). MIT licensed. PRs welcome.
