---
title: "Documentation Sitemap — Kodelyth ECC"
description: "Complete sitemap for Kodelyth ECC documentation. Every page, every guide, every reference."
keywords: ["ECC sitemap", "Kodelyth documentation index", "docs directory"]
og_title: "Kodelyth ECC — Documentation Sitemap"
og_description: "All docs, all guides, all references — indexed."
canonical: /docs/sitemap/
last_updated: 2026-07-04
version: 2.4.1
category: meta
---

# Documentation Sitemap

Every page in the Kodelyth ECC documentation, grouped by category. Newest docs first within each group.

## Hub

- **[/docs](./index.md)** — Documentation home

## Guides (get running fast)

- **[Getting Started](./getting-started.md)** — Install, verify, first agent invocation
- **[Uninstall](./uninstall.md)** — Full ECC cleanup with dry-run support

## Features (deep-dive per subsystem)

- **[RTK](./rtk.md)** — Input token savings (60-90%) via Rust Token Killer
- **[Terse Mode](./terse-mode.md)** — Output token savings (40-70%) with 4-level dial
- **[Codebase Graph](./codebase-graph.md)** — AST intelligence across 158 languages
- **[Intent Routing v2](./intent-routing.md)** — Plain-language to specialist agent, 8 dimensions
- **[Interactive CLI](./interactive-cli.md)** — Arrow-key menu, update check, background daemon
- **[MCP Server](./mcp.md)** — Universal adapter for MCP-compatible clients
- **[External MCP Servers](./mcp-clients.md)** — Register Stripe, GitHub, Postgres, Redis
- **[Dashboard](./dashboard.md)** — Localhost observability, real data only
- **[Evolve](./evolve.md)** — Self-evolving memory pipeline
- **[Swarm](./swarm.md)** — Parallel agents in git worktrees + tmux
- **[Replay](./replay.md)** — Deterministic session replay from portable bundles
- **[Supply Chain](./supply-chain.md)** — SBOM, manifest, SLSA L3 verification

## SEO metadata

Every doc has YAML frontmatter with:

- `title` — SEO-optimized page title
- `description` — Meta description (150-160 chars)
- `keywords` — Targeted keyword list
- `og_title`, `og_description`, `og_image`, `og_type` — Open Graph tags
- `twitter_card` — Twitter card type
- `canonical` — Canonical URL slot
- `last_updated` — Recency signal (YYYY-MM-DD)
- `version` — Version doc was written against
- `category` — For tag pages (`guide`, `feature`, `meta`, `hub`)

## Version

All docs in this tree are current as of **v2.4.1** (2026-07-04).

## Related

- **[README](../README.md)** — Repo root
- **[CHANGELOG](../CHANGELOG.md)** — Full version history
- **[GitHub](https://github.com/sifxprime/kodelyth-ecc)** — Source
- **[npm](https://www.npmjs.com/package/kodelyth-ecc)** — Package
