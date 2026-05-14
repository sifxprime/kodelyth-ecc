# Agent Orchestration

70 specialist agents are available. Intent routing is always-on — describe your problem in plain words and the right agent is invoked automatically. You can also invoke explicitly: `use <agent-name>`.

## Kodelyth Exclusives

| Agent | When to Use |
|-------|-------------|
| `kodelyth-advisor` | Not sure where to start — master guide |
| `pair-programmer` | Before writing code — think through approach first |
| `debug-detective` | Any bug — evidence-first root cause, never guess-and-check |
| `silent-failure-hunter` | Bugs that don't throw errors |
| `incident-commander` | Production incident — P0/P1 triage, contain, postmortem |
| `load-tester` | Load/stress testing — k6, Locust, Artillery, capacity planning |
| `kodelyth-memory` | Manage local BM25 memory — recall, capture, review |
| `image-architect` | AI image generation — Gemini/DALL-E/fal.ai/SVG |

## Planning & Architecture

| Agent | When to Use |
|-------|-------------|
| `planner` | Plan a feature before writing a line of code |
| `architect` | System-level design, dependency graphs |
| `code-architect` | Code-level architecture decisions |
| `chief-of-staff` | Strategic decisions, comms, stakeholder updates |
| `migration-guide` | Framework/language version upgrades, phase by phase |

## Code Review

| Agent | When to Use |
|-------|-------------|
| `code-reviewer` | General review after writing code |
| `typescript-reviewer` | TypeScript / React / Next.js |
| `python-reviewer` | Python |
| `go-reviewer` | Go |
| `rust-reviewer` | Rust |
| `java-reviewer` | Java / Spring Boot |
| `kotlin-reviewer` | Kotlin / Android / KMP |
| `cpp-reviewer` | C++ |
| `csharp-reviewer` | C# / .NET |
| `flutter-reviewer` | Flutter / Dart |
| `database-reviewer` | SQL schema, query patterns, indexes |
| `healthcare-reviewer` | PHI/HIPAA-aware review for healthcare apps |

## Build Fixers

| Agent | When to Use |
|-------|-------------|
| `build-error-resolver` | General build failure |
| `go-build-resolver` | Go build errors |
| `rust-build-resolver` | Rust/Cargo build errors |
| `java-build-resolver` | Java/Maven/Gradle build errors |
| `kotlin-build-resolver` | Kotlin/Gradle build errors |
| `cpp-build-resolver` | C++/CMake/Make build errors |
| `dart-build-resolver` | Dart/Flutter build errors |
| `pytorch-build-resolver` | PyTorch/CUDA build errors |
| `dependency-doctor` | npm/pip/cargo/maven dep hell, CVEs, lockfile drift |
| `env-debugger` | "Works on my machine" — env, config, secrets layers |

## Debugging & Testing

| Agent | When to Use |
|-------|-------------|
| `tdd-guide` | Write tests first — TDD methodology |
| `e2e-runner` | End-to-end test automation |
| `pr-test-analyzer` | CI output — root cause failing tests |
| `flake-hunter` | Flaky test stabilization — never blind retries |

## Security & API

| Agent | When to Use |
|-------|-------------|
| `security-reviewer` | OWASP top 10, secrets, auth, injection vectors |
| `api-guardian` | Detect breaking API changes before they ship |

## Performance & Quality

| Agent | When to Use |
|-------|-------------|
| `performance-optimizer` | Profiling-first — measure before optimizing |
| `refactor-cleaner` | Remove code smells, dead code, tech debt |
| `code-simplifier` | Improve readability without changing behavior |
| `type-design-analyzer` | TypeScript type system design |

## Documentation & Analysis

| Agent | When to Use |
|-------|-------------|
| `doc-updater` | Update or write documentation |
| `docs-lookup` | Find docs for a library or API |
| `comment-analyzer` | Audit code comments for accuracy |
| `code-explorer` | Explore an unfamiliar codebase |
| `conversation-analyzer` | Analyze conversation or chat patterns |

## Release & Ops

| Agent | When to Use |
|-------|-------------|
| `release-captain` | Cut a clean release — semver, tagging, rollback plan |
| `git-rescue` | Broken git state, lost commits, bad rebase — no history loss |

## Open Source

| Agent | When to Use |
|-------|-------------|
| `opensource-forker` | Fork and clean a project for open-source release |
| `opensource-sanitizer` | Strip secrets, PII, proprietary references |
| `opensource-packager` | README, license, contribution docs |

## Specialized

| Agent | When to Use |
|-------|-------------|
| `ux-reviewer` | UX behavior + WCAG 2.1 AA accessibility |
| `seo-specialist` | Technical SEO, structured data, rankings |

## GAN Harness (Multi-Agent)

| Agent | When to Use |
|-------|-------------|
| `gan-planner` | Plan a GAN-style generator/evaluator workflow |
| `gan-generator` | Generate output in a GAN harness loop |
| `gan-evaluator` | Evaluate output and provide adversarial feedback |
| `harness-optimizer` | Optimize agent harness action spaces |
| `loop-operator` | Operate autonomous agent loops |

## Parallel Execution

ALWAYS launch independent agents in parallel:

```
# GOOD: parallel
use code-reviewer + security-reviewer + ux-reviewer simultaneously

# BAD: sequential when not needed
code-reviewer → then security-reviewer → then ux-reviewer
```

## Standard Handoff Chains

| Workflow | Chain |
|----------|-------|
| New feature | `pair-programmer` → `tdd-guide` → `code-reviewer` → `security-reviewer` |
| Bug fix | `debug-detective` → `tdd-guide` → `refactor-cleaner` |
| Production incident | `incident-commander` → `debug-detective` → `tdd-guide` |
| Open-source | `opensource-forker` → `opensource-sanitizer` → `opensource-packager` → `release-captain` |
