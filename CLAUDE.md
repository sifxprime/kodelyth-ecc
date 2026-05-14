# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

**Kodelyth ECC** — a production-grade AI coding toolkit:

- **70 specialist agents** — debug-detective, incident-commander, load-tester, image-architect, kodelyth-memory, security-reviewer, plus 8 adversarial devil-mode agents
- **194 skills** — domain knowledge, patterns, testing, security, intent routing, local memory, swarm orchestration, MCP integration
- **97 commands** — slash workflows (`/tdd`, `/plan`, `/code-review`, `/team-review`, `/devil-mode`, `/debug-blitz`, `/security-audit`, ...)
- **22+ hooks** — quality gates, memory inject + capture, correction encoding, prompt-injection guard, token-budget enforcer
- **14 rules** — always-on coding standards + semantic intent routing + memory protocol + self-improvement

Works with Claude Code, Windsurf, Cursor, Codex CLI, Antigravity, OpenCode, Cline, Roo Code, Aider, Kimi, and Gemini CLI — **11 platforms** (13 install targets).

## Architecture

```
agents/      → 70 specialist subagents (planner, code-reviewer, debug-detective, devil-mode crew, ...)
commands/    → 97 slash commands (8 parallel multi-agent, rest single-agent)
skills/      → 194 workflow + domain knowledge files (loadable via slash commands)
hooks/       → 22+ automations (pre-commit, session memory, prompt-injection guard, token-budget)
rules/       → 14 always-on guidelines (agent-intent-routing, self-improvement, memory-protocol, ...)
scripts/     → Node.js utilities: MCP server, dashboard, swarm, replay, router, memory, supply-chain
bundles/     → 3 power bundles (indie-hacker, red-team, enterprise)
actions/     → GitHub Action (CI/CD integration for PR review)
docs/        → Feature docs (mcp.md, dashboard.md, swarm.md, replay.md, evolve.md, supply-chain.md)
tests/       → 373 passing tests across 25 test files
```

## Running Tests

```bash
npm test
# or directly
node tests/run-all.js
```

## CLI Subcommands

Beyond install, the `npx kodelyth-ecc` CLI exposes:

```bash
npx kodelyth-ecc mcp                          # Start MCP server (stdio JSON-RPC)
npx kodelyth-ecc route "<task>"               # Cost-aware model-tier recommendation
npx kodelyth-ecc swarm --task "..."           # Parallel agents in git worktrees
npx kodelyth-ecc dashboard                    # Localhost observability dashboard
npx kodelyth-ecc evolve analyze               # Self-evolving memory proposals
npx kodelyth-ecc replay <bundle>              # Re-run a past session
npx kodelyth-ecc sbom                         # CycloneDX 1.5 SBOM
npx kodelyth-ecc manifest                     # sha256 content manifest
npx kodelyth-ecc verify                       # Verify install against manifest
npx kodelyth-ecc mcp-add <name> -- <cmd>      # Register external MCP server
npx kodelyth-ecc session-export <session>     # Export session bundle
```

## Intent Routing

The toolkit ships with a god-tier intent routing rule (`rules/common/agent-intent-routing.md`) that auto-loads on every session. It maps user intent → specialist agent across 10 priority tiers.

When a user message matches a routing pattern, you MUST:

1. Acknowledge with `→ Routing to <agent>` (one line)
2. Behave as that agent for the response
3. Suggest the explicit form: `Tip: type "use <agent>"`
4. Never silently route — transparency is mandatory

## Parallel Commands (Fastest Paths — Multi-Agent)

These fire multiple specialist agents simultaneously:

| Command | Agents Fired | Best For |
|---|---|---|
| `/team-review` | code-reviewer + security-reviewer + performance-optimizer + api-guardian | Full audit before any PR or deploy |
| `/project-launch` | architect + pair-programmer + security-reviewer + tdd-guide + ux-reviewer | Starting any new project |
| `/security-audit` | security-reviewer + dependency-doctor + api-guardian | Full threat surface check |
| `/debug-blitz` | debug-detective + silent-failure-hunter + env-debugger | Bug that resisted 30+ min of investigation |
| `/refactor-sprint` | refactor-cleaner + code-simplifier + type-design-analyzer + tdd-guide | Full cleanup before a feature sprint |
| `/pre-release` | release-captain + security-reviewer + code-reviewer | Go/no-go verdict before shipping |
| `/onboard` | code-explorer + architect + doc-updater | Understand any codebase in 15 minutes |
| `/devil-mode` | prompt-injection-hunter + supply-chain-auditor + secret-hunter + backdoor-hunter | Adversarial sweep (use `--all` for all 8) |

## Key Commands

- `/kodelyth-quickstart` — friendly onboarding guide
- `/smart-debug` — systematic debugging
- `/tdd` — test-driven development workflow
- `/plan` — implementation planning
- `/code-review` — quality review
- `/git-mastery` — git workflows + recovery patterns
- `/observability` — logging, metrics, OpenTelemetry, SLOs
- `/dashboard` — launch local observability dashboard
- `/route-model` — cost-aware model selection
- `/swarm` — parallel agent swarm in git worktrees
- `/memory-evolve` — self-evolving memory proposals

## Specialist Agents (Pick the Right One)

| Use case | Agent |
|---|---|
| Lost / overwhelmed | `kodelyth-advisor` |
| Pre-implementation thinking | `pair-programmer` |
| Bug with error or stack trace | `debug-detective` |
| Bug with no error (silent fail) | `silent-failure-hunter` |
| Build / compile / type errors | `build-error-resolver` (or language-specific build resolver) |
| Slow code | `performance-optimizer` |
| Security review | `security-reviewer` |
| API contract check | `api-guardian` |
| Frontend / a11y | `ux-reviewer` |
| Framework upgrade | `migration-guide` |
| npm/pip/cargo dep hell | `dependency-doctor` |
| Broken git state | `git-rescue` |
| Cut a release | `release-captain` |
| "Works on my machine" | `env-debugger` |
| Flaky tests | `flake-hunter` |
| Tests / coverage | `tdd-guide` |
| Refactor / cleanup | `refactor-cleaner` |
| Open-source a project | `opensource-forker` (chain start) |
| Leaked secrets in code/history | `secret-hunter` |
| Malicious deps / supply chain | `supply-chain-auditor` |
| AI feature jailbreak safety | `prompt-injection-hunter` |
| Backdoors / obfuscated code | `backdoor-hunter` |
| Chaos / fault injection testing | `chaos-engineer` |

## Development Notes

- Package manager detection: npm, pnpm, yarn, bun
- Cross-platform: Windows (`install.ps1`), macOS / Linux (`install.sh`), or `npx` anywhere
- Agent format: Markdown with YAML frontmatter (name, description, tools, model)
- Skill format: Markdown with clear sections (description, when to use, how it works)
- Hook format: JSON with matcher conditions and command/notification hooks
- No runtime deps in core — `@modelcontextprotocol/sdk` is an optionalDependency for MCP server only

## Contributing

When adding a new agent:

1. Create `agents/<name>.md` with YAML frontmatter
2. Add trigger patterns to `rules/common/agent-intent-routing.md` (so the router knows when to call you)
3. If part of a chain, document the handoff in `skills/agent-handoff/SKILL.md`

See [CONTRIBUTING.md](CONTRIBUTING.md) for full templates.

File naming: lowercase with hyphens (e.g., `dependency-doctor.md`, `flake-hunter.md`).
