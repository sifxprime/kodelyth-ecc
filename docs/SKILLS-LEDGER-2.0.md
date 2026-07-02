# Kodelyth ECC 2.0 — Skills & Agents Curation Ledger

This is the single source of truth for what stays, what stays lean, and what gets cut in 2.0.
Every skill/agent/command in the repo is classified into exactly one tier.

## Tiers

- **DAILY** — used in a real dev session multiple times per week. Deserves flagship polish:
  real patterns, real code, no filler, no emoji, deep enough to teach a senior engineer something.
- **LIBRARY** — infrequent but genuinely useful reference material. Stays lean, gets loaded on demand.
- **CUT** — dead weight in 2.0. Removed from the shipped package (still in git history if anyone needs it).

The curation is deliberate. **Fewer, sharper skills > more, generic skills.** A "cheap AI website"
look comes from breadth without depth — we're aiming for the opposite.

---

## DAILY (flagship — polish hard)

### Agents (top-24 auto-invoke targets)
`kodelyth-advisor` · `pair-programmer` · `debug-detective` · `silent-failure-hunter` ·
`build-error-resolver` · `code-reviewer` · `security-reviewer` · `api-guardian` ·
`ux-reviewer` · `incident-commander` · `load-tester` · `performance-optimizer` ·
`refactor-cleaner` · `code-simplifier` · `type-design-analyzer` · `tdd-guide` ·
`e2e-runner` · `planner` · `architect` · `code-architect` · `migration-guide` ·
`dependency-doctor` · `env-debugger` · `release-captain`

### Skills (top-25 flagship)
`smart-debug` · `code-tour` · `frontend-design` · `frontend-patterns` · `backend-patterns` ·
`api-design` · `database-migrations` · `deep-research` · `docs-lookup` · `documentation-lookup` ·
`git-mastery` · `git-workflow` · `hexagonal-architecture` · `observability` · `security-review` ·
`security-scan` · `search-first` · `tdd-workflow` · `verification-loop` · `agent-handoff` ·
`intent-routing` · `agentic-engineering` · `agent-harness-construction` · `blueprint` ·
`ai-first-engineering`

### Commands (top-12 workflow starters)
`/team-review` · `/project-launch` · `/security-audit` · `/debug-blitz` · `/refactor-sprint` ·
`/pre-release` · `/onboard` · `/devil-mode` · `/tdd` · `/plan` · `/code-review` · `/smart-debug`

---

## LIBRARY (keep lean, load on demand)

Everything not in DAILY and not in CUT. These are genuine reference material — Kotlin coroutines,
Rust patterns, PyTorch idioms, Django TDD, Swift concurrency, various language reviewers,
platform-specific patterns. They exist for the developers who need them, but they don't get the
same polish investment as DAILY.

Rule for LIBRARY files: must have a purpose that's clear in the first paragraph. No filler.

---

## CUT (removed from 2.0 package)

- `scripts/openclaw-twitter/**` — separate marketing bot, not part of ECC toolkit.
  Already gitignore-excluded from npm; the source tree is next to go. If someone wants the
  bot, it belongs in its own repo.
- Any skill file with generic AI-looking headers ("🚀 Getting Started"), decorative emoji,
  or filler like "Let's dive in..." — swept in the polish pass.
- Placeholder skills that reference features never built.

Note: CUT means removed from the shipped npm tarball. Nothing is deleted from git history unless
also privacy-sensitive (like the Twitter session).

---

## Polish standard for DAILY (what "next level" means)

Every DAILY skill/agent must have:

1. **A one-line description** that would fit in a routing rule.
2. **A first paragraph** that says *what you get* — no ceremony, no "in this guide we will…".
3. **Concrete code** in the language(s) the skill targets. Not pseudo-code.
4. **A "when NOT to use this" section** — the difference between library and flagship material.
5. **No decorative emoji, no fluff banners**, no "🎯 Goals" section headers. Plain Markdown.
6. **Actual craft**: patterns senior engineers use, not tutorial fodder.

Non-negotiable: if it reads like it was written by an AI for AI, it hasn't been polished.

---

## Enforcement in 2.0

- Phase 2 dispatcher: only routes to DAILY agents. LIBRARY agents remain invocable via
  explicit `use <name>` but do not participate in the auto-routing table.
- `docs/ECC-2.0-MASTERPLAN.md` §Phase 8 tracks the polish pass, one flagship at a time.
- `npm test` gains a `skill-polish` lint (Phase 8.5) that fails on emoji, filler headers,
  or files under a minimum quality bar in the DAILY set.
