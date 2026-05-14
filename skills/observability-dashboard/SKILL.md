---
name: observability-dashboard
description: Localhost-only observability dashboard for Kodelyth ECC. Visualizes memory captures, BM25 search, evolve signals + proposals, full catalog browser, swarm sessions, and token-budget snapshots. Zero telemetry.
trigger:
  - dashboard
  - observability
  - kodelyth dashboard
  - show me the memory
  - browse skills
  - inspect proposals
  - what has ECC learned
---

# Skill: observability-dashboard

A read-only HTTP server bound to `127.0.0.1` that renders a single-page UI over every local data source ECC produces. No build step, no external runtime dependencies, no telemetry, no network access required.

## What you can see

| Tab | Powered by | Shows |
|---|---|---|
| **Overview** | catalog + memory store + evolve store + .orchestration + token-budget | One-glance counts: agents, skills, commands, rules, bundles, captured memories, surfaces, routing misses, pending proposals, swarm sessions. Plus storage paths and token-budget snapshot. |
| **Memory** | `scripts/memory/store.js` | Total / projects / language breakdown. Live BM25 search box (proxies `recall()`). Recent capture stream with tags + source. |
| **Evolve** | `scripts/evolve/{stats,proposals}.js` | Top reused memories, top routing-miss clusters, every proposal with status pill. Tells you the exact CLI command to accept. |
| **Catalog** | `scripts/mcp/catalog.js` | Browse + filter every shipped agent / skill / command / rule / bundle by name, description, or tag. |
| **Sessions** | `.orchestration/<session>/` | Swarm session list with worker counts and per-worker drill-down (task.md / handoff.md / status.md excerpts). |

## When to invoke

Use **explicitly**:

```bash
use observability-dashboard

# Boots on http://127.0.0.1:5747, auto-opens browser
npx kodelyth-ecc dashboard

# Custom port, suppress browser open
npx kodelyth-ecc dashboard --port 8088 --no-open

# Bind to a different localhost-aliased host
npx kodelyth-ecc dashboard --host localhost
```

Implicit triggers (the AI should route here):

- "show me the memory"
- "what has ECC learned?"
- "browse the skills"
- "what's pending in evolve?"
- "is there a UI for this?"
- "open the dashboard"

## CLI surface

```
kodelyth-ecc dashboard [--port N] [--host 127.0.0.1] [--no-open]
```

| Flag | Default | Behavior |
|---|---|---|
| `--port N` | `5747` | Port to bind. Picks a free port pattern. |
| `--host H` | `127.0.0.1` | Bind interface. Refuses non-localhost without escape hatch. |
| `--no-open` | off | Suppress browser auto-open (useful in remote shells / CI smoke). |

### Localhost lock

Binding to `0.0.0.0`, a public IP, or a non-localhost name is **refused** unless you explicitly set:

```bash
KODELYTH_DASHBOARD_ALLOW_REMOTE=1 \
  npx kodelyth-ecc dashboard --host 0.0.0.0
```

This is intentionally noisy. The dashboard exposes everything the BM25 store and evolve log have ever recorded. Don't expose it to networks you don't fully control.

## API surface (read-only, GET-only)

The frontend is just a consumer of these endpoints. You can curl them directly:

| Endpoint | Returns |
|---|---|
| `GET /api/health` | liveness probe |
| `GET /api/overview` | counts + storage paths |
| `GET /api/memory[?limit=N]` | stats + recent captures |
| `GET /api/memory/search?q=…[&limit=N]` | BM25 results |
| `GET /api/evolve[?limit=N]` | reuse + miss + proposals snapshot |
| `GET /api/catalog?kind=…[&q=…&limit=N]` | agents \| skills \| commands \| rules \| bundles |
| `GET /api/sessions[?limit=N]` | swarm session list |
| `GET /api/sessions/:name` | worker details for one session |
| `GET /api/token-budget` | per-session token usage |

**Only `GET` is supported.** Any `POST`/`PUT`/`DELETE` returns `405 method not allowed`. The dashboard is a *strict observer* — it cannot mutate memories, accept proposals, or modify any state. All mutations stay in the CLI (`evolve accept`, `memory remember`, etc.).

## Hard rules

1. **NEVER expose remotely without explicit opt-in.** Default refuses everything except `127.0.0.1` / `localhost`.
2. **NEVER write data.** GET-only routes. No mutation endpoints.
3. **NEVER include external assets.** No CDNs, no fonts loaded over the network. Works offline.
4. **NEVER swallow data-source failures with crashes.** A broken memory store or evolve dir renders empty cards, not a 500 page.
5. **NEVER cache.** `Cache-Control: no-store` on every response — data is always fresh.
6. **NEVER allow path traversal.** Static file resolution sandboxed under `scripts/dashboard/static/`.

## Composition with other features

| Pair with | Effect |
|---|---|
| **`/memory remember`** | New memories appear in the **Memory** tab on next refresh. |
| **`kodelyth-ecc evolve analyze`** | New proposals appear in the **Evolve** tab as `pending`. |
| **`kodelyth-ecc evolve accept`** | The status pill flips from `pending` → `accepted` after refresh. |
| **`kodelyth-ecc swarm`** | New `.orchestration/<session>/` dirs surface in the **Sessions** tab. |
| **token-budget hook** | Per-session token totals appear on the **Overview** tab. |

## See also

- `commands/dashboard.md` — `/dashboard` slash command
- `docs/dashboard.md` — full reference + curl examples + architecture notes
- `scripts/dashboard/{server,data}.js` — implementation
- `scripts/dashboard/static/index.html` — single-page UI
