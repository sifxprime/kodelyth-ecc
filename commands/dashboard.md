---
description: Boot the localhost-only Kodelyth ECC observability dashboard. Visualizes memory, evolve signals, catalog, swarm sessions, and token-budget snapshots. Read-only. Zero telemetry.
---

# /dashboard

A localhost web UI over every local data source ECC produces. No external dependencies, no telemetry, no network access. Auto-opens your browser.

## Usage

```
/dashboard                          # default: 127.0.0.1:5747, opens browser
/dashboard --port 8088              # custom port
/dashboard --no-open                # don't auto-open browser
/dashboard --host localhost         # explicit localhost binding
```

## What you'll see

| Tab | Content |
|---|---|
| **Overview** | Counts of every shipped asset, captured memories, surfaces, routing misses, pending proposals, swarm sessions, plus token-budget snapshot. |
| **Memory** | Live BM25 search box + recent captures with tags. |
| **Evolve** | Top reused memories, top miss clusters, proposals with status pills. |
| **Catalog** | Searchable browser over every agent / skill / command / rule / bundle. |
| **Sessions** | Swarm/orchestration sessions with per-worker drill-down. |

## Hard rules

1. **GET-only.** No mutation endpoints. The dashboard cannot accept proposals, capture memories, or change any state. Mutations stay in the CLI.
2. **Localhost-only by default.** Refuses to bind `0.0.0.0` or remote IPs without `KODELYTH_DASHBOARD_ALLOW_REMOTE=1` (intentionally noisy escape hatch).
3. **No external assets.** No CDNs, no Google Fonts. Works fully offline.
4. **No cache.** Always-fresh data on refresh.
5. **No telemetry.** All data stays on this machine.

## API endpoints (curl-friendly)

```
GET /api/health
GET /api/overview
GET /api/memory[?limit=N]
GET /api/memory/search?q=…
GET /api/evolve
GET /api/catalog?kind=skills&q=…
GET /api/sessions
GET /api/sessions/:name
GET /api/token-budget
```

The frontend is a thin consumer of these. Anything the UI shows you can also pipe through `jq`.

## Companion commands

- **`/memory remember`** — capture a memory; appears in the Memory tab on next refresh.
- **`kodelyth-ecc evolve analyze`** — generates proposals; they appear in the Evolve tab as pending.
- **`kodelyth-ecc evolve accept <id>`** — write a draft to disk; status pill flips.
- **`kodelyth-ecc swarm --task "…"`** — spawns sessions visible in the Sessions tab.

## Implementation

Backed by:

- `scripts/dashboard/server.js` — HTTP server using only Node built-ins (`http`, `fs`, `path`, `child_process`)
- `scripts/dashboard/data.js` — pure aggregators across memory/evolve/catalog/sessions/token-budget
- `scripts/dashboard/static/index.html` — single-page UI with hand-rolled CSS, vanilla JS, no build

Skill: `observability-dashboard`. Full reference: `docs/dashboard.md`.
