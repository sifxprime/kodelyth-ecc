# AGENTS.md

This file is read by AI agents (Cascade, Cursor, Codex, etc.) on every session. It tells them how to work in this repo and how to use the 70 specialist agents and 194 skills shipped with Kodelyth ECC.

---

## Repo Identity

**Kodelyth ECC** — a production-grade AI coding toolkit installed into your `~/.claude/`, `.windsurf/`, `.cursor/`, `~/.codex/`, `.agent/`, or `.opencode/` directory by `npx kodelyth-ecc`.

This repo is the **source of truth** that ships those files. When working in this repo, you are editing the toolkit itself.

---

## How to Use the Toolkit (For End Users)

The toolkit has two activation paths:

### 1. Explicit invocation

```
use kodelyth-advisor
@debug-detective
invoke security-reviewer
```

### 2. Implicit (intent routing)

The user describes their problem in plain language. You — the AI — read it, identify the right specialist, **announce the routing**, and **behave as that agent**.

The full intent → agent mapping lives in `rules/common/agent-intent-routing.md` and is loaded automatically on every session. Memorize the priority tiers:

| Tier | Theme |
|---|---|
| 1 | Crisis / emotional state (`kodelyth-advisor`, `pair-programmer`) |
| 2 | Active pain — broken (`debug-detective`, `build-error-resolver`, `env-debugger`, `silent-failure-hunter`) |
| 3 | Quality & review (`code-reviewer`, `security-reviewer`, `ux-reviewer`, `api-guardian`) |
| 4 | Performance & incidents (`incident-commander`, `load-tester`, `performance-optimizer`) |
| 5 | Planning / architecture (`planner`, `architect`, `code-architect`, `migration-guide`) |
| 6 | Testing (`tdd-guide`, `e2e-runner`, `pr-test-analyzer`, `flake-hunter`) |
| 7 | Code hygiene (`refactor-cleaner`, `code-simplifier`, `type-design-analyzer`) |
| 8 | Documentation (`doc-updater`, `docs-lookup`, `comment-analyzer`) |
| 9 | Specialized (`seo-specialist`, `opensource-*`, `dependency-doctor`, `git-rescue`, `release-captain`) |
| 10 | Multi-agent handoffs |

### Routing format (mandatory)

```
→ Routing to <agent-name> (<one-line reason>)

[response in that agent's persona]

Tip: next time you can type "use <agent-name>" to invoke me directly.
```

Never silently switch personas. Always teach the user the explicit form.

---

## Multi-Agent Chains

Standard chains documented in `skills/agent-handoff/SKILL.md`:

| Workflow | Chain |
|---|---|
| New feature | `pair-programmer` → `tdd-guide` → impl → `code-reviewer` → `security-reviewer` (if sensitive) |
| Bug fix | `debug-detective` → `tdd-guide` (regression test) → `refactor-cleaner` (optional) |
| Refactor | `code-explorer` → `refactor-cleaner` → `tdd-guide` → `code-reviewer` |
| API change | `api-guardian` → `pair-programmer` → `tdd-guide` → `doc-updater` |
| Migration | `migration-guide` → `pair-programmer` (per phase) → `pr-test-analyzer` |
| Build broken | `build-error-resolver` → `dependency-doctor` (if dep) or `env-debugger` (if env) |
| Flaky CI | `flake-hunter` → `tdd-guide` → `release-captain` (if it gates a release) |
| Open-source | `opensource-forker` → `opensource-sanitizer` → `opensource-packager` → `release-captain` |
| Git crisis | `git-rescue` → `release-captain` (if a release was midway) |
| Production incident | `incident-commander` (triage+contain) → `debug-detective` (root cause) → `tdd-guide` (regression test) |
| Pre-launch | `load-tester` (capacity validation) → `performance-optimizer` (if bottleneck) → `release-captain` |

---

## When Working IN This Repo (Toolkit Development)

When the user is editing this repo (the toolkit source itself):

1. **Adding a new agent** — create `agents/<name>.md` AND update `rules/common/agent-intent-routing.md` with trigger patterns. Also update `README.md` agent count and category table.
2. **Adding a new skill** — create `skills/<name>/SKILL.md`. If it's a routing/handoff/meta skill, link it from `skills/intent-routing/SKILL.md` or `skills/agent-handoff/SKILL.md`.
3. **Changing install behavior** — update BOTH `install.sh` (mac/linux) AND `install.ps1` (Windows). Verify with `npm test`.
4. **Bumping versions** — update BOTH `package.json` AND `VERSION`. Update `CHANGELOG.md`. Tag with `vX.Y.Z`.
5. **Cross-platform changes** — test `node bin/kodelyth-ecc.js --help` and the install scripts on at least one platform.

---

## Code Style for This Repo

- **Markdown** — sentence case, fenced code blocks with language tag, no emojis unless in social SVGs
- **Bash** — POSIX-compatible where possible; macOS bash 3.2 is the floor
- **PowerShell** — match feature parity with `install.sh`
- **Node** — ES modules, Node 18+, no external runtime deps in `bin/` (use built-ins only)

---

## Tests

Run before any commit:

```bash
npm test
```

There are 47 tests covering hooks logic, file detection, memory store, and auto-recall. Never weaken or skip tests; if behavior must change, update the test first.

---

## What This Repo Does NOT Have

- ❌ Cloud telemetry, analytics, dashboards (Lens was removed in v1.3.0 — it gave inaccurate cross-platform data)
- ❌ Background daemons or auto-running servers
- ❌ Required external services or accounts

This is markdown + shell + a thin Node wrapper. Keep it that way.

---

## Useful Slash Commands When Editing This Repo

```
/kodelyth-quickstart    Read first if new
/intent-routing         Understand the routing rule
/agent-handoff          Understand chain protocol
/skill-create           Generate a new skill
/code-review            Review your changes before commit
```
