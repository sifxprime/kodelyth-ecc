---
title: "Local Observability Dashboard — Kodelyth ECC"
description: "Localhost-only observability dashboard for Kodelyth ECC — Memory (BM25), RTK savings, Terse mode, Codebase graph, Evolve, Catalog, Sessions. Zero telemetry, zero external deps."
keywords:
  - ECC dashboard
  - AI observability
  - Claude Code dashboard
  - localhost AI dashboard
  - zero telemetry
  - AI toolkit monitoring
  - kodelythecc dashboard
og_title: "Local Observability Dashboard — Kodelyth ECC"
og_description: "Localhost-only observability dashboard for Kodelyth ECC — Memory (BM25), RTK savings, Terse mode, Codebase graph, Evolve, Catalog, Sessions. Zero telemetry, zero external deps."
og_image: /social/section-dashboard.svg
og_type: article
twitter_card: summary_large_image
canonical: /docs/dashboard/
last_updated: 2026-07-04
version: 2.4.1
category: feature
---
# Local observability dashboard

> A localhost-only single-page web UI that renders every local data source Kodelyth ECC produces. Zero telemetry. Zero external runtime dependencies. Read-only.

---

## Why it exists

ECC produces a lot of local state by default:

- BM25 memory captures (`~/.kodelyth/memory/`)
- Self-evolving memory signals + proposals (`~/.kodelyth/evolve/`)
- Token-budget hook state (`~/.kodelyth/token-budget/`)
- Swarm/orchestration session dirs (`.orchestration/<session>/`)
- The full catalog of shipped agents / skills / commands / rules / bundles

The only way to see all of this was to read JSON files by hand or run six different CLI subcommands. The dashboard is the one-glance answer.

---

## Boot

```bash
npx kodelyth-ecc dashboard                        # default: 127.0.0.1:5747, auto-opens browser
npx kodelyth-ecc dashboard --port 8088            # custom port
npx kodelyth-ecc dashboard --no-open              # don't auto-open browser (CI / remote shells)
npx kodelyth-ecc dashboard --host localhost       # explicit localhost binding
```

Press `Ctrl+C` to stop. The server has no daemon mode by design — it lives only as long as your terminal session.

---

## Localhost lock

The dashboard exposes everything the BM25 store and evolve log have ever recorded. Memories may contain code, problem statements, project paths, gotchas. The default bind is `127.0.0.1` and the server **refuses** to start on any other interface unless you explicitly opt out:

```bash
KODELYTH_DASHBOARD_ALLOW_REMOTE=1 \
  npx kodelyth-ecc dashboard --host 0.0.0.0
```

This escape hatch is intentionally inconvenient. Don't use it on a network you don't fully control.

Without the env var, attempting any non-localhost host produces:

```
[dashboard] refusing to bind host=0.0.0.0. Dashboard is localhost-only by default.
To override (UNSAFE — exposes your memory + evolve data), set KODELYTH_DASHBOARD_ALLOW_REMOTE=1.
```

---

## What you see

### Overview tab

A wall of stat cards: agents · skills · commands · rules · bundles · captured memories · surfaces · routing misses · pending proposals · swarm sessions. Plus storage paths and a token-budget snapshot.

### Memory tab

- Stats: total / projects / language count / tag classes
- BM25 search box (proxies through `/api/memory/search`)
- Recent captures table with tags + source

### Evolve tab

- Reuse + miss + proposal counts
- Top 10 reused memories with surface count and last-seen
- Top 10 miss clusters with token tags and a sample prompt
- Proposals table with status pills (`pending` / `accepted` / `rejected` / `applied`)

### Catalog tab

- Selector for agents / skills / commands / rules / bundles
- Free-text filter across name, description, tags
- Tabular results with up to 200 entries per page

### Sessions tab

- Lists every swarm session in `.orchestration/`
- Per-session: workers, modified time, expandable detail with `task.md` + `handoff.md` + `status.md` excerpts

---

## API surface

The frontend is just a consumer of these endpoints. They're curl-friendly:

| Endpoint | Returns |
|---|---|
| `GET /api/health` | `{ ok: true, time: <iso> }` — liveness probe |
| `GET /api/overview` | counts + storage paths |
| `GET /api/memory[?limit=N]` | `{ stats, recent }` |
| `GET /api/memory/search?q=…[&limit=N]` | `{ query, results }` |
| `GET /api/evolve[?limit=N]` | `{ reuse, miss, proposals }` |
| `GET /api/catalog?kind=…[&q=…&limit=N]` | `{ kind, counts, items }` (kind ∈ agents/skills/commands/rules/bundles) |
| `GET /api/sessions[?limit=N]` | `{ sessions }` |
| `GET /api/sessions/:name` | `{ session, path, workers }` |
| `GET /api/token-budget` | `{ sessions, total_tokens }` |

### Examples

```bash
# Last 5 captured memories
curl -s http://127.0.0.1:5747/api/memory?limit=5 | jq '.recent'

# Search memory for "tailwind v4"
curl -s 'http://127.0.0.1:5747/api/memory/search?q=tailwind+v4' | jq '.results'

# Pending proposals
curl -s http://127.0.0.1:5747/api/evolve | jq '.proposals[] | select(.status == "pending")'

# All agents whose tags include "security"
curl -s 'http://127.0.0.1:5747/api/catalog?kind=agents&q=security'
```

---

## Hard rules (enforced by the server)

1. **GET-only.** Any other method returns `405 method not allowed`. The dashboard CANNOT mutate state.
2. **Localhost lock.** Non-localhost binds refused without `KODELYTH_DASHBOARD_ALLOW_REMOTE=1`.
3. **Path-traversal-safe.** Static file resolution is sandboxed under `scripts/dashboard/static/`. `../` and similar are rejected.
4. **No cache.** Every response carries `Cache-Control: no-store`. Data is always fresh.
5. **Hardened headers.** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` on every response.
6. **No external assets.** No CDNs, no Google Fonts, no analytics. Works fully offline.
7. **Defensive aggregation.** Every data-source read is wrapped in try/catch with empty-default fallback. A broken memory store renders empty cards, never a 500.

---

## Architecture

```
scripts/dashboard/
├── server.js          ← HTTP server. Routes API + static files.
├── data.js            ← Pure aggregators. Reads memory + evolve + catalog + sessions + budget.
└── static/
    └── index.html     ← Single-page UI. Hand-rolled CSS + vanilla JS. No build step.
```

### `data.js`

Pure functions only. Every aggregator:

- Accepts its data-source paths as explicit arguments OR uses well-defined env-overridable defaults
- Returns sane empty defaults on failure (never throws)
- Has no global mutable state
- Is unit-testable in isolation

### `server.js`

Uses only Node built-ins:

- `http` for the listener
- `fs`, `path` for static files
- `child_process.execFileSync` for browser auto-open (`open` / `xdg-open` / `cmd /c start`) — no shell interpolation

No `express`, no `koa`, no third-party static-file middleware. All hardening is hand-rolled and auditable in ~290 lines.

### `index.html`

- Hand-rolled CSS (no Tailwind, no CDN)
- Vanilla JS with `fetch` → no build step, no transpilation
- Tabs are simple data-attribute toggles
- Lazy-loads each tab's data only when shown
- SSE (`/api/events`) pushes `data-changed` events when watched files change; a `heartbeat` every 10 s keeps the green dot alive without triggering data reloads

---

## Worked example

```bash
$ npx kodelyth-ecc dashboard --port 5747
✓ Kodelyth ECC dashboard
  http://127.0.0.1:5747/
  Press Ctrl+C to stop. Localhost only — zero telemetry.
```

In another shell:

```bash
$ curl -s http://127.0.0.1:5747/api/overview | jq '.catalog'
{
  "agents": 70,
  "skills": 193,
  "commands": 96,
  "rules": 14,
  "bundles": 3
}
```

---

## Composition with other features

| Feature | Effect on the dashboard |
|---|---|
| **Memory store** | Source of the Memory tab. |
| **Swarm orchestrator** | Source of the Sessions tab. |
| **Token-budget hook** | Source of the budget snapshot card. |
| **Self-evolving memory** | Source of the Evolve tab. Proposals appear automatically as they're generated. |

---

## See also

- `skills/observability-dashboard/SKILL.md` — explicit-invocation skill
- `commands/dashboard.md` — `/dashboard` slash command
- `scripts/dashboard/{server,data}.js` — implementation
- `tests/dashboard/` — aggregator + server smoke tests
