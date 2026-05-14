# Kodelyth ECC — MCP Client Mode

The other half of the MCP story. While `npx kodelyth-ecc mcp` (Phase 2.1) **serves** ECC to any MCP-compatible client, MCP client mode lets ECC **consume** any external MCP server — Stripe, GitHub, Postgres, Redis, Brave, Filesystem, Shopify, Sentry, anything.

> **Phase 2.5 of the [Devil Roadmap](../README.md).** This makes ECC the MCP **hub**, not just a node. Local-only registry. Zero telemetry. Same SDK as the server side.

---

## Quick start

### 1. Register an external MCP server

```bash
# Public servers (no env vars needed)
npx kodelyth-ecc mcp-add brave -- npx -y @modelcontextprotocol/server-brave-search
npx kodelyth-ecc mcp-add filesystem -- npx -y @modelcontextprotocol/server-filesystem /Users/me/notes

# Servers that need credentials
npx kodelyth-ecc mcp-add github \
  --env GITHUB_PERSONAL_ACCESS_TOKEN=ghp_... \
  --desc "ECC project ops on github" \
  -- npx -y @modelcontextprotocol/server-github

npx kodelyth-ecc mcp-add postgres \
  --env DB_URL=postgres://localhost/myapp \
  -- npx -y @modelcontextprotocol/server-postgres

npx kodelyth-ecc mcp-add stripe \
  --env STRIPE_API_KEY=sk_... \
  -- npx -y @stripe/mcp
```

The registry is stored at `~/.kodelyth/mcp-clients.json` (override with `KODELYTH_MCP_CLIENT_DIR`).

### 2. Inspect a registered server

```bash
npx kodelyth-ecc mcp-list                       # all registered
npx kodelyth-ecc mcp-tools github               # tools the server exposes
npx kodelyth-ecc mcp-resources filesystem       # resources
npx kodelyth-ecc mcp-prompts brave              # prompts
```

### 3. Call a tool

```bash
# No args:
npx kodelyth-ecc mcp-call github list_repos

# JSON args:
npx kodelyth-ecc mcp-call github create_issue \
  --json '{"owner":"sifxprime","repo":"kodelyth-ecc","title":"hi from ECC"}'

npx kodelyth-ecc mcp-call postgres query \
  --json '{"sql":"SELECT count(*) FROM users"}'
```

### 4. Unregister

```bash
npx kodelyth-ecc mcp-remove github
```

---

## CLI surface

| Command | Description |
|---|---|
| `mcp-add <name> [--env K=V] [--desc "..."] -- <command> [args...]` | Register an external server. |
| `mcp-list` | List registered servers. |
| `mcp-remove <name>` | Unregister. |
| `mcp-tools <name>` | List tools exposed by the server. |
| `mcp-resources <name>` | List resources. |
| `mcp-prompts <name>` | List prompts. |
| `mcp-call <name> <tool> [--json '{"arg":"value"}']` | Call a tool with JSON arguments. |

The `--` separator before the command is mandatory in `mcp-add` so the registry can disambiguate flags belonging to ECC from flags meant for the external server.

---

## Programmatic use

The same registry powers in-session agent tool calls. Inside an ECC agent or skill, require the client library:

```js
const client = require('kodelyth-ecc/scripts/mcp/client.js');

// Open a stable connection.
const session = await client.connect('github');
const out = await session.client.callTool({
  name: 'create_issue',
  arguments: { owner: 'sifxprime', repo: 'kodelyth-ecc', title: 'auto-issue' },
});
await session.close();

// Or one-shot:
const tools = await client.listTools('postgres');
const stats = await client.callTool('redis', 'set', { key: 'k', value: 'v' });
```

Every call spawns a fresh stdio subprocess; there's no long-lived process pool. This is intentional — failed servers don't poison subsequent calls, and credentials live only in the per-call env.

---

## Registry shape

```json
{
  "servers": {
    "github": {
      "name": "github",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env":  { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..." },
      "description": "ECC project ops on github",
      "added_at": "2026-05-10T10:48:00.690Z"
    }
  }
}
```

You can hand-edit the file. Reserved name patterns: alphanumeric, dash, underscore.

---

## Pairing with the rest of ECC

| Pairs with | How |
|---|---|
| **Phase 2.1 — MCP server** | The two halves complete each other. ECC serves to any framework AND consumes from any provider. |
| **Phase 2.10 — prompt-injection-guard** | Tool responses from external MCP servers are scanned for indirect injection on `PostToolUse:mcp__*` (opt in via `KODELYTH_PI_GUARD=warn|block`). |
| **Phase 2.4 — cost-aware model router** | Tool responses are part of the session token-budget when the safety hook is enabled. |
| **kodelyth-memory** | Capture interesting tool responses as memories with `kodelyth-ecc remember "..." --approach "..."`. |

---

## Privacy & safety

- **No network egress from this client** — it only spawns subprocesses you registered.
- **Credentials live in the registry file.** Treat `~/.kodelyth/mcp-clients.json` like a secrets file. `chmod 600` is recommended on shared machines.
- **External servers can do whatever the user gives them permission to do** — register only servers you trust.
- **Pair with `prompt-injection-guard`** to scan tool responses for indirect injection before agents act on them.

---

## Troubleshooting

**"Kodelyth MCP client requires `@modelcontextprotocol/sdk`"** — run `npm install @modelcontextprotocol/sdk` once, or rerun via `npx -y kodelyth-ecc ...`.

**"MCP server X is not registered"** — `mcp-list` shows nothing because the registry lives at `~/.kodelyth/mcp-clients.json` (or `$KODELYTH_MCP_CLIENT_DIR`). Re-run `mcp-add`.

**Server hangs on connect** — the external server probably needs env vars you didn't pass. Re-add with `--env KEY=VAL`.

**Tool call returns `isError: true`** — the external server rejected the call. Inspect the `content[0].text` for the underlying error message; it's typed exactly as the spec.

---

## Roadmap interactions

- **Phase 2.6 — sandbox layer** will wrap external MCP servers in Docker/firejail isolation by default.
- **Phase 2.3 — local dashboard** will show live MCP traffic per registered server (count, latency, errors).
- **Phase 2.9 — SLSA/SBOM** will publish provenance for the ECC server side and let `supply-chain-auditor` verify external server packages.

---

Built into [Kodelyth ECC](../README.md). MIT licensed. PRs welcome.
