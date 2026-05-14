# Skill Reference

Skills are domain knowledge and workflow definitions loaded into your session with a slash command. 194 skills total.

Skills provide deep, actionable guidance — patterns, checklists, code templates, anti-patterns — that agents draw on when they are active. Rules define *what* to do; skills define *how* to do it.

---

## How to Load Skills

```
/smart-debug
/tdd
/security-review
/api-design
/observability
```

Type the skill name with a `/` prefix. Skills load instantly and activate for the rest of the session.

---

## Core Workflow Skills

| Skill | Command | What it provides |
|---|---|---|
| Smart Debug | `/smart-debug` | Systematic 5-step debugging: hypothesis → isolate → prove → fix → regress |
| TDD Workflow | `/tdd` | Red-Green-Refactor with coverage gates, test naming conventions |
| Code Review | `/code-review` | Severity matrix (CRITICAL / HIGH / MEDIUM / LOW), checklist, agent routing |
| Observability | `/observability` | Structured logging, metrics, traces, SLOs, OpenTelemetry setup |
| Git Mastery | `/git-mastery` | Branching strategies, rebase patterns, recovery from bad states |
| API Design | `/api-design` | REST conventions, versioning, idempotency, error envelopes |
| Security Review | `/security-review` | OWASP Top 10 checklist, secret scanning, auth patterns |

---

## Memory & Learning Skills

| Skill | Command | What it provides |
|---|---|---|
| Memory Protocol | `/memory` | BM25 recall workflow, capture triggers, review-pending flow |
| Memory Evolve | `/memory-evolve` | Self-improving memory analysis, pattern extraction (v1.7.0) |
| Lessons | `/lessons` | Load/save/manage `tasks/lessons.md` on all 11 platforms |
| Configure ECC | `/configure-ecc` | Customize agents, hooks, and rules for your project |
| Quickstart | `/kodelyth-quickstart` | 5-minute tour of the entire toolkit |

---

## Language & Framework Skills

### TypeScript / JavaScript

| Skill | Command |
|---|---|
| Coding standards | `/coding-standards` |
| Bun runtime | `/bun-runtime` |
| Next.js patterns | `/nextjs-patterns` |
| React patterns | `/react-patterns` |

### Rust

| Skill | Command |
|---|---|
| Rust patterns | `/rust-patterns` |
| Rust testing | `/rust-testing` |
| Ownership & lifetimes | `/rust-ownership` |

### Java / Spring Boot

| Skill | Command |
|---|---|
| Spring Boot patterns | `/springboot-patterns` |
| Spring Boot security | `/springboot-security` |
| Spring Boot TDD | `/springboot-tdd` |
| Spring Boot verification | `/springboot-verification` |

### Mobile

| Skill | Command |
|---|---|
| Android clean architecture | `/android-clean-architecture` |
| SwiftUI patterns | `/swiftui-patterns` |
| Swift concurrency 6.2 | `/swift-concurrency-6-2` |
| Swift protocol + DI testing | `/swift-protocol-di-testing` |
| Compose multiplatform | `/compose-multiplatform-patterns` |

### Python

| Skill | Command |
|---|---|
| Python async patterns | `/python-async-patterns` |
| FastAPI patterns | `/fastapi-patterns` |
| Django TDD | `/django-tdd` |

### Go

| Skill | Command |
|---|---|
| Go idiomatic patterns | `/go-patterns` |
| Go error handling | `/go-error-handling` |
| Go concurrency | `/go-concurrency` |

---

## Architecture & Design Skills

| Skill | Command | What it provides |
|---|---|---|
| Blueprint | `/blueprint` | Feature architecture: interfaces, data flow, build order |
| Architecture Decision Records | `/architecture-decision-records` | ADR templates, decision capture workflow |
| Code Tour | `/code-tour` | Structured codebase walkthroughs for onboarding |
| Codebase Onboarding | `/codebase-onboarding` | Ramp-up workflow for unfamiliar repos |
| AI-First Engineering | `/ai-first-engineering` | Designing systems with AI in the loop |
| Agentic Engineering | `/agentic-engineering` | Patterns for multi-agent orchestration |
| Backend Patterns | `/backend-patterns` | Service architecture, data layer, API patterns |
| Microservices | `/microservices` | Distributed system patterns, service mesh, async messaging |
| Domain-Driven Design | `/ddd` | Bounded contexts, aggregates, ubiquitous language |

---

## Testing Skills

| Skill | Command | What it provides |
|---|---|---|
| TDD Workflow | `/tdd-workflow` | Full TDD cycle with coverage verification |
| Browser QA | `/browser-qa` | Playwright test patterns, flake prevention |
| AI Regression Testing | `/ai-regression-testing` | Preventing AI-introduced regressions |
| Benchmark | `/benchmark` | Performance benchmarking patterns |
| Verification Loop | `/verification-loop` | Multi-step verification before marking work done |
| Load Testing | `/load-testing` | k6, Locust, Artillery setup and patterns |
| E2E Testing Strategy | `/e2e-strategy` | End-to-end test planning and execution |

---

## Security Skills

| Skill | Command | What it provides |
|---|---|---|
| Security Review | `/security-review` | Full OWASP checklist + agent routing |
| Security Scan | `/security-scan` | Automated scan workflow |
| Security Bounty Hunter | `/security-bounty-hunter` | Structured vuln discovery process |
| Safety Guard | `/safety-guard` | Guardrail patterns for AI-generated code |
| Spring Boot Security | `/springboot-security` | Spring-specific auth, CSRF, secrets |
| Secrets Management | `/secrets-management` | `.env`, vaults, rotation, credential handling |
| Supply Chain Security | `/supply-chain-security` | SBOM, SLSA, artifact integrity (v1.7.0) |
| Zero Trust Architecture | `/zero-trust` | Implementation patterns for zero-trust systems |

---

## DevOps & Infrastructure Skills

| Skill | Command | What it provides |
|---|---|---|
| Terminal Ops | `/terminal-ops` | Shell scripting, automation, process management |
| Canary Watch | `/canary-watch` | Canary deployment monitoring patterns |
| Automation Audit Ops | `/automation-audit-ops` | Audit trail for automated operations |
| Continuous Agent Loop | `/continuous-agent-loop` | Long-running agent patterns |
| Docker & Containers | `/docker-patterns` | Docker, Kubernetes, container security |
| CI/CD Pipelines | `/ci-cd-patterns` | GitHub Actions, GitLab CI, CircleCI setup |
| Infrastructure as Code | `/iac-patterns` | Terraform, CloudFormation, Pulumi |
| Observability | `/observability` | Logging, metrics, tracing, SLOs, OpenTelemetry |

---

## Swarm & Orchestration Skills

| Skill | Command | What it provides |
|---|---|---|
| Swarm Orchestrator | `/swarm-orchestrator` | Multi-agent parallel execution and coordination (v1.7.0) |
| Agent Eval | `/agent-eval` | Evaluating agent output quality |
| Agent Handoff | `/agent-handoff` | Multi-agent chain handoff protocols |
| Agent Harness Construction | `/agent-harness-construction` | Building agent test harnesses |
| Agent Introspection Debugging | `/agent-introspection-debugging` | Debugging agent reasoning |
| Agent Sort | `/agent-sort` | Routing optimization for multi-agent flows |
| Autonomous Agent Harness | `/autonomous-agent-harness` | Patterns for fully autonomous agents |
| Autonomous Loops | `/autonomous-loops` | Self-driving agent loop patterns |
| Claude DevFleet | `/claude-devfleet` | Fleet management for parallel agents |

---

## API & Integration Skills

| Skill | Command | What it provides |
|---|---|---|
| API Design | `/api-design` | REST design, versioning, contracts |
| API Connector Builder | `/api-connector-builder` | Building typed API connectors |
| Claude API | `/claude-api` | Anthropic API patterns, tool use, streaming |
| Agent Payment (x402) | `/agent-payment-x402` | Monetizing agents with x402 protocol |
| GraphQL Patterns | `/graphql-patterns` | Schema design, resolver patterns, federation |
| WebSocket Patterns | `/websocket-patterns` | Real-time communication, state sync |

---

## Cost & Model Routing (v1.7.0)

| Skill | Command | What it provides |
|---|---|---|
| Cost-Aware Routing | `/cost-aware-routing` | Match tasks to optimal model (Haiku/Sonnet/Opus) |
| Context Budget | `/context-budget` | Managing context window efficiently |
| Token Budget Advisor | `/token-budget-advisor` | Cost optimization guidance |
| Model Selection | `/model-selection` | When to use which Claude or Gemini model |

---

## Specialized Skills

| Skill | Command | Domain |
|---|---|---|
| ClickHouse IO | `/clickhouse-io` | Analytics database patterns |
| Research Ops | `/research-ops` | Structured research workflows |
| Rules Distill | `/rules-distill` | Extracting rules from codebase patterns |
| Skill Stocktake | `/skill-stocktake` | Auditing which skills are active |
| Strategic Compact | `/strategic-compact` | Condensing context before large tasks |
| Search First | `/search-first` | Always-search-before-implement workflow |
| SEO | `/seo` | Technical SEO, meta, schema, Core Web Vitals |
| Remotion Video | `/remotion-video-creation` | Programmatic video patterns |

---

## Devil-Mode Security Skills (v1.7.0)

| Skill | Command | What it provides |
|---|---|---|
| Prompt Injection Hunting | `/prompt-injection-hunting` | Finding AI injection vectors |
| Supply Chain Auditing | `/supply-chain-auditing` | Dependency vulnerability analysis |
| Secret Hunting | `/secret-hunting` | Hardcoded credential detection |
| License Compliance | `/license-compliance` | GPL and license violation hunting |
| Jailbreak Testing | `/jailbreak-testing` | Safety bypass testing techniques |
| Code Theft Detection | `/code-theft-detection` | Exfiltration and unauthorized access paths |
| Backdoor Hunting | `/backdoor-hunting` | Identifying inserted malicious code |
| Chaos Engineering | `/chaos-engineering` | Failure mode and resilience testing |

---

## Parallel Commands That Fire Multiple Skills

| Command | Skills activated |
|---|---|
| `/project-launch` | architect + pair-programmer + security-reviewer + tdd-guide + ux-reviewer |
| `/team-review` | code-reviewer + security-reviewer + performance-optimizer + api-guardian |
| `/security-audit` | security-reviewer + dependency-doctor + api-guardian |
| `/debug-blitz` | debug-detective + silent-failure-hunter + env-debugger |
| `/refactor-sprint` | refactor-cleaner + code-simplifier + type-design-analyzer + tdd-guide |
| `/pre-release` | release-captain + security-reviewer + code-reviewer |
| `/onboard` | code-explorer + architect + doc-updater |
| `/devil-mode` | prompt-injection-hunter + supply-chain-auditor + secret-hunter + license-violation-finder (or all 8 with `--all`) |

These are not skill loads — they fire 4-8 specialist agents in parallel and return all results at once.

---

## Finding a Skill

If you are unsure what command to use, just describe the problem. The semantic router picks the right skill automatically.

```
You:  "How should I approach debugging this?"
AI:   → Loading /smart-debug (debugging workflow signal)
```

---

## Skill Categories

**Quick overview by category:**

- **9 workflow skills** — core debugging, testing, review, APIs, security
- **27 language/framework skills** — TypeScript, Rust, Java, Python, Go, Swift, Kotlin, and more
- **9 architecture skills** — design patterns, ADRs, microservices, DDD
- **7 testing skills** — TDD, E2E, benchmarking, flake prevention
- **8 security skills** — OWASP, bounty hunting, supply chain, zero trust
- **8 DevOps skills** — containers, CI/CD, IaC, observability
- **9 swarm/orchestration skills** — multi-agent coordination, autonomy
- **6 API skills** — REST, GraphQL, WebSockets, payment
- **4 cost/routing skills** — model selection, token budgets (v1.7.0)
- **8 specialized skills** — ClickHouse, SEO, video, research
- **8 devil-mode security skills** — red-team, penetration testing (v1.7.0)

**Total: 194 skills**

---

## Installing All Skills

```bash
# Download and cache all 194 skills locally
npx kodelyth-ecc --profile full
```

Or load skills on-demand as needed.
