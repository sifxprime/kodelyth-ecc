# Kodelyth

Kodelyth ECC is built and maintained by **Kodelyth** — a brand focused on making AI-powered developer tooling smarter, faster, and production-grade for real-world use at scale.

## What's New in v1.5.0

### Added: 2 New Specialist Agents

| Agent | What it does |
|---|---|
| `incident-commander` | Production incident response — P0/P1 triage, containment, postmortem. Distinct from `debug-detective` which handles development bugs. |
| `load-tester` | Load and stress testing with k6, Locust, Artillery. Capacity planning, breakpoint discovery. Distinct from `performance-optimizer` which handles code optimization. |

### Updated: All Visual Assets
Nine SVG social cards refreshed to reflect v1.5.0 features — memory system, correct counts (62 agents), auto-recall demo.

### Updated: Complete Wiki Rewrite
All 7 wiki files rewritten to reflect current state — v1.4.1 memory system, 6-platform feature matrix, all 62 agents documented.

### Updated: Intent Routing
New routing patterns for `incident-commander` (outage signals) and `load-tester` (load test signals). Two new sequential chains added.

---

## What's New in v1.4.1

### Auto Chat Detection for Memory
`UserPromptSubmit` hook (`hooks/memory/auto-recall.js`) — fires on every meaningful prompt, runs BM25 search, injects relevant memories before the AI responds. Per-session repeat suppression. Smart skip filters.

---

## What's New in v1.4.0

### Local Self-Learning Memory
Complete local memory system: BM25 store, session inject, auto-extract, CLI, agent, skill, command, rule. Zero dependencies. Zero telemetry. All data at `~/.kodelyth/memory/`.

---

## What's New in v1.3.0

### Removed: Lens Dashboard

The bundled Kodelyth Lens dashboard has been removed. It tried to track usage across Claude Code, Windsurf, Cursor, Codex, OpenCode, and Antigravity — but cloud-AI platforms (Windsurf, Antigravity, parts of Cursor) don't expose token/cost data locally, which led to inaccurate or hardcoded zeros in the dashboard.

The toolkit is now leaner and **does only what it does honestly**: ship rules, agents, and skills your AI loads on every session.

### Added: God-Tier Intent Routing

A new rule (`rules/common/agent-intent-routing.md`) auto-loads with every session and maps user intent → specialist agent across 10 priority tiers, 50+ pattern groups.

Now the user just describes their problem in plain words and the AI:

1. Announces which specialist is taking over (`→ Routing to <agent>`)
2. Behaves as that agent
3. Teaches the user the explicit form (`Tip: type "use <agent>"`)

No more memorizing 62 agent names.

### Added: 5 New Specialist Agents

| Agent | What it does |
|---|---|
| `dependency-doctor` | Diagnoses npm/pip/cargo/maven dep hell, CVEs, lockfile drift |
| `git-rescue` | Recovers broken git states without destroying history |
| `release-captain` | Owns the release ritual — semver, tagging, publishing, rollback |
| `env-debugger` | "Works on my machine" hunter — env, config, secrets, layers |
| `flake-hunter` | Stabilizes flaky tests — never adds blind retries |

### Added: 2 New Meta Skills

| Skill | What it does |
|---|---|
| `intent-routing` | Documents the routing system, priority tiers, design rules for new agents |
| `agent-handoff` | Standard multi-agent chain protocol with 10 documented chains |

---

## Kodelyth Exclusives — The 13 Agents That Define ECC

| Agent | Job |
|---|---|
| `kodelyth-advisor` | Master guide — picks the right tool when you don't know where to start |
| `pair-programmer` | The engineer who sits next to you **before** you write the code |
| `debug-detective` | Never guesses — traces every bug to root cause through evidence |
| `silent-failure-hunter` | Finds bugs that don't throw errors |
| `ux-reviewer` | Reviews UX behavior + WCAG 2.1 AA accessibility |
| `api-guardian` | Detects breaking API changes before they ship |
| `migration-guide` | Framework / language version upgrades, phase by phase |
| `dependency-doctor` | Dep hell — CVE triage, lockfile diagnosis, safe upgrade plans |
| `git-rescue` | Broken git states, lost commits, bad rebases — without destroying history |
| `release-captain` | Owns the release ritual, semver, rollback rehearsal |
| `env-debugger` | "Works on my machine" — environment, config, secrets layers |
| `flake-hunter` | Flaky test stabilization — root cause, not retries |
| `kodelyth-memory` | Local self-learning memory — captures and recalls past solutions automatically |
| `incident-commander` | Production incident response — triage, contain, postmortem |
| `load-tester` | Load and stress testing — k6, Locust, Artillery, capacity planning |

---

## Kodelyth-Authored Skills

| Skill | Description |
|---|---|
| `kodelyth-quickstart` | Plain-language onboarding guide |
| `smart-debug` | Structured 5-step debugging framework |
| `git-mastery` | Trunk-based dev, rebase, bisect, monorepos |
| `observability` | Structured logging, Four Golden Signals, OpenTelemetry, SLOs |
| `intent-routing` | How auto-routing works, priority tiers, design rules |
| `agent-handoff` | Standard multi-agent chain protocol |

---

## Hooks (18+)

| Hook | Trigger | What it does |
|---|---|---|
| `memory/inject-start` | SessionStart | Injects relevant past solutions into session context |
| `memory/auto-recall` | UserPromptSubmit | Real-time BM25 memory check on every meaningful prompt |
| `memory/capture-stop` | Stop | Extracts learning candidates to pending review (never auto-stores) |
| `test-reminder` | PostToolUse (Edit) | Reminds you to write tests when code is edited without tests |
| `smart-suggest` | Stop | Suggests the next logical agent after each response |
| `branch-name-check` | PreToolUse (Bash) | Enforces `feat/`, `fix/`, `chore/` branch naming before creation |
| `session-start` | SessionStart | Loads context from previous session |
| `pre-commit` | Before `git commit` | Catches `console.log`, secrets, bad commit messages |
| `quality-gate` | After file edit | Runs type checks and formatting |
| `desktop-notify` | Long task complete | macOS notification |
| `mcp-health-check` | Before MCP call | Validates server health |

---

## Kodelyth Philosophy

- **Smart defaults** — the system guides you to the right tool without you needing to know everything upfront
- **Production quality** — every enhancement is battle-tested, not theoretical
- **Zero friction** — good tools get out of the way and let you build
- **No magic, no telemetry** — everything is markdown your AI reads on every session; nothing phones home
- **Honest about limits** — if we can't measure something accurately, we don't pretend (this is why Lens was removed)

---

## Credits

Built and maintained by **Kodelyth** — [github.com/sifxprime/kodelyth-ecc](https://github.com/sifxprime/kodelyth-ecc)

---

> Built with care. Powered by Kodelyth.
