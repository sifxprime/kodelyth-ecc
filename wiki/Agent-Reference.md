# Agent Reference

70 specialist subagents — all auto-routed via semantic intent routing. You never need to type agent names unless you want to.

---

## How to Invoke

**Implicit (recommended):** just describe your problem. The AI routes you automatically.

**Explicit:**
```
use debug-detective
@code-reviewer
invoke security-reviewer
```

---

## Kodelyth Exclusive Agents

These 16 agents exist only in ECC — not in any other toolkit.

| Agent | What it does | Trigger signals |
|---|---|---|
| `kodelyth-advisor` | Strategic guide — picks the right tool when you're lost | "I'm stuck", "no idea where to start", "I'm overwhelmed" |
| `kodelyth-memory` | Curates local BM25 memory — recall past solutions, capture new ones | "recall this", "remember that worked", `/memory` |
| `pair-programmer` | Thinking partner before you write code — catches wrong approaches early | "I want to build", "how should I implement", "before I start" |
| `debug-detective` | Never guesses — traces every bug to root cause with evidence | error message, stack trace, "broken", "nothing works" |
| `silent-failure-hunter` | Finds bugs that don't throw errors | "no error but wrong result", "data seems off" |
| `incident-commander` | Runs P0/P1 production incidents — triage, containment, postmortem | "production is down", "outage", "P0", "error rate spiked" |
| `load-tester` | Load and stress testing — k6, Locust, Artillery, capacity planning | "load test", "will this hold under X users", "stress test" |
| `ux-reviewer` | Reviews UX behavior + WCAG 2.1 AA accessibility — never touches visual design | "feels off", "UI confusing", "a11y", "screen reader" |
| `api-guardian` | Detects breaking API changes before they ship | "breaking change", "deprecate endpoint", "consumer impact" |
| `migration-guide` | Framework and language version upgrades, phased | "upgrade from X to Y", "migrate to Next.js 15", "deprecated" |
| `dependency-doctor` | npm/pip/cargo/maven dependency hell — CVE triage, lockfile diagnosis | "npm install failing", "dependency conflict", "CVE" |
| `git-rescue` | Recovers from broken git states without destroying history | "lost commits", "bad rebase", "detached HEAD" |
| `release-captain` | Owns the release ritual — semver, tagging, publishing, rollback plan | "cut a release", "tag v2.0", "publish to npm" |
| `env-debugger` | "Works on my machine" hunter — env vars, config, secrets, layers | "works locally not CI", "env var issue", "config mismatch" |
| `flake-hunter` | Stabilizes flaky tests — never adds blind retries | "flaky test", "passes sometimes", "intermittent failure" |
| `image-architect` | Platform-aware AI image generation — Gemini/DALL-E/fal.ai/SVG | "generate a hero image", "OG card", "my site looks plain" |

---

## Guidance Agents

| Agent | Purpose |
|---|---|
| `kodelyth-advisor` | Lost or overwhelmed — strategic direction |
| `pair-programmer` | Pre-implementation thinking partner |
| `planner` | Feature breakdown — tasks, milestones, sprint plan |
| `architect` | System design, tech selection, scaling strategy |
| `code-architect` | Detailed blueprint for a single feature |
| `chief-of-staff` | Email, Slack, status updates, multi-channel coordination |
| `migration-guide` | Framework / language version upgrades |

---

## Code Review Agents

| Agent | Language / Domain |
|---|---|
| `code-reviewer` | General — quality, patterns, best practices |
| `typescript-reviewer` | TypeScript + JavaScript |
| `python-reviewer` | Python — PEP 8, type hints, async |
| `go-reviewer` | Go — idiomatic patterns, concurrency |
| `rust-reviewer` | Rust — ownership, lifetimes, unsafe |
| `java-reviewer` | Java + Spring Boot |
| `kotlin-reviewer` | Kotlin + Android + KMP |
| `cpp-reviewer` | C++ — memory safety, modern idioms |
| `csharp-reviewer` | C# + .NET — async, nullable types |
| `flutter-reviewer` | Flutter + Dart — widget patterns, state management |
| `database-reviewer` | SQL + PostgreSQL + Supabase |
| `healthcare-reviewer` | EMR/EHR — clinical safety, PHI compliance |

---

## Build Resolver Agents

| Agent | Handles |
|---|---|
| `build-error-resolver` | General — TypeScript, Node, web |
| `go-build-resolver` | Go — cargo, go vet, linker |
| `rust-build-resolver` | Rust — borrow checker, cargo |
| `java-build-resolver` | Java — Maven, Gradle, Spring |
| `kotlin-build-resolver` | Kotlin — Gradle, KMP |
| `cpp-build-resolver` | C++ — CMake, linker, templates |
| `dart-build-resolver` | Dart/Flutter — pub, build_runner |
| `pytorch-build-resolver` | PyTorch — CUDA, tensor shapes, DataLoader |
| `dependency-doctor` | All platforms — CVE triage, lockfile repair |
| `env-debugger` | Environment mismatches, secrets, config |

---

## Debugging Agents

| Agent | When to use |
|---|---|
| `debug-detective` | Has an error or stack trace — traces to root cause |
| `silent-failure-hunter` | No error, wrong result — finds silent failures |
| `flake-hunter` | Intermittent or flaky tests |

---

## Incident & Scale Agents

| Agent | When to use |
|---|---|
| `incident-commander` | Production is down or degraded — P0/P1/P2 |
| `load-tester` | Load, stress, capacity, soak testing |
| `performance-optimizer` | Slow code — bottlenecks, N+1, bundle size |

---

## Security & API Agents

| Agent | When to use |
|---|---|
| `security-reviewer` | Auth, secrets, OWASP Top 10, injection, XSS |
| `api-guardian` | Breaking changes, versioning, REST/GraphQL contracts |

---

## Testing Agents

| Agent | When to use |
|---|---|
| `tdd-guide` | Write tests first — TDD enforcement, 80% coverage |
| `e2e-runner` | Playwright end-to-end tests — critical user flows |
| `pr-test-analyzer` | PR test coverage quality — behavioral completeness |
| `flake-hunter` | Stabilize intermittent tests |

---

## Quality & Hygiene Agents

| Agent | When to use |
|---|---|
| `refactor-cleaner` | Dead code, duplication, tech debt cleanup |
| `code-simplifier` | Reduce complexity, improve readability |
| `type-design-analyzer` | Type safety, discriminated unions, `any` cleanup |

---

## Documentation Agents

| Agent | When to use |
|---|---|
| `doc-updater` | Update README, write JSDoc, docstrings, codemaps |
| `docs-lookup` | Library / framework API questions (uses Context7) |
| `comment-analyzer` | Comment quality — explain why, not what |
| `code-explorer` | Deep codebase analysis — trace execution paths, map dependencies |

---

## Release & Ops Agents

| Agent | When to use |
|---|---|
| `release-captain` | Semver decisions, tagging, publishing, rollback |
| `git-rescue` | Lost commits, bad rebase, broken git state |

---

## Open Source Agents (chain)

Use in sequence: `opensource-forker` → `opensource-sanitizer` → `opensource-packager`

| Agent | What it does |
|---|---|
| `opensource-forker` | Copies files, strips secrets, replaces internal references |
| `opensource-sanitizer` | Scans for leaked secrets, PII, internal refs before release |
| `opensource-packager` | Generates CLAUDE.md, README, LICENSE, CONTRIBUTING, templates |

---

## Adversarial / Devil-Mode Agents (v1.7.0)

8 dedicated red-team agents that find vulnerabilities and weaknesses through adversarial analysis.

| Agent | What it does | When to use |
|---|---|---|
| `prompt-injection-hunter` | Finds AI/LLM injection vulnerabilities, jailbreak attempts | "Find prompt injection vectors in my AI code" |
| `supply-chain-auditor` | Audits dependency tree, build artifacts, artifact provenance | "Audit our supply chain security" |
| `secret-hunter` | Hunts hardcoded API keys, tokens, credentials in code | "Find any secrets that might be exposed" |
| `license-violation-finder` | Detects GPL, license compliance issues, forbidden deps | "Check for license violations" |
| `jailbreak-tester` | Tests safety bypass techniques, red-team AI behavior | "Test if my safety guardrails can be bypassed" |
| `code-stealer-detector` | Finds data exfiltration vectors, unauthorized access paths | "Find ways attackers could steal our code" |
| `backdoor-hunter` | Identifies inserted vulnerabilities, supply chain attacks | "Scan for backdoors or intentional vulnerabilities" |
| `chaos-engineer` | Failure mode analysis, edge case testing, resilience | "What happens if X fails? Test all failure modes" |

**Invoke together:**
```bash
/devil-mode                 # Top 4 agents (injection, supply chain, secrets, license)
/devil-mode --all          # All 8 agents (adds jailbreak, code theft, backdoors, chaos)
```

---

## Specialized Agents

| Agent | When to use |
|---|---|
| `seo-specialist` | SEO, meta tags, schema.org, Core Web Vitals, sitemap |
| `ux-reviewer` | UX behavior, WCAG 2.1 AA, keyboard nav, form states |
| `image-architect` | AI image gen — hero, OG cards, social, thumbnails |

---

## Phase 2 Infrastructure Agents (v1.7.0)

Newer specialist agents for advanced orchestration and observability.

| Agent | Purpose |
|---|---|
| `swarm-orchestrator` | Manage parallel agent execution and work distribution |
| `cost-aware-router` | Route tasks to the right model tier (Haiku/Sonnet/Opus) |
| `memory-evolve` | Self-improving memory — analyze patterns, surface insights |
| `observability-dashboard` | System metrics, agent performance, session replay |
| `supply-chain-analyst` | Deep SBOM analysis, vulnerability tracking |

---

## Parallel Commands (multi-agent)

| Command | Agents fired simultaneously |
|---|---|
| `/project-launch` | architect + pair-programmer + security-reviewer + tdd-guide + ux-reviewer |
| `/team-review` | code-reviewer + security-reviewer + performance-optimizer + api-guardian |
| `/security-audit` | security-reviewer + dependency-doctor + api-guardian |
| `/debug-blitz` | debug-detective + silent-failure-hunter + env-debugger |
| `/refactor-sprint` | refactor-cleaner + code-simplifier + type-design-analyzer + tdd-guide |
| `/pre-release` | release-captain + security-reviewer + code-reviewer |
| `/onboard` | code-explorer + architect + doc-updater |
| `/devil-mode` | prompt-injection-hunter + supply-chain-auditor + secret-hunter + license-violation-finder (4) or all 8 with `--all` |

---

## Agent Count Summary

- **Standard Agents:** 62
- **Adversarial Devil-Mode Agents:** 8
- **Total Agents:** 70
