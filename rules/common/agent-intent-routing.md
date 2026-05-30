# Agent Intent Routing — Auto-Detect User Intent → Right Specialist Agent

This rule teaches the AI to **automatically route the user to the correct specialist agent** based on what they say, write, or feel — without requiring `use <agent-name>` syntax.

When any of the patterns below match the user's message, the AI MUST:

1. **Acknowledge** the routing in one short line: `→ Routing to <agent-name>`
2. **Behave as that agent** for the rest of that response (apply its persona, methodology, and constraints)
3. **Suggest the explicit invocation** at the end so the user learns the toolkit: `Tip: next time you can type "use <agent-name>"`

If multiple agents match, pick the **highest priority** below (priority decreases top-to-bottom). If two are equally relevant, name both and ask the user which to use.

**Never silently route.** Always be transparent about which agent is taking over.

> **Companion rule:** [`cost-aware-model-routing`](./cost-aware-model-routing.md) handles the orthogonal question of _which model tier_ to use for the routed task. They run together — agent routing picks the specialist; model routing picks the right tier so the team isn't burning frontier-model tokens on doc typos.

---

## How to Apply This Rule — Semantic Intent, Not Keyword Matching

**Read the intent behind the words, not just the words.**

- If someone says "this thing is broken", they mean `debug-detective` even though they didn't say "bug"
- If someone says "help me make a todo app", they mean `/project-launch` even though they didn't say "project-launch"
- If someone pastes a block of code with no context, treat it as a review request → `code-reviewer`
- If someone pastes a stack trace or error log with no context, treat it as a debug request → `debug-detective`
- If the user's message expresses **emotion** (frustration, excitement, confusion, worry), that is a routing signal

**The signal tables are examples, not exhaustive lists.** Use them to understand the category of intent, then reason freely about whether the current message fits.

**When in doubt between two agents:** name both options in one line and ask "Which fits your situation better?" — do not silently pick one.

---

## Priority 1 — Crisis & Emotional Signals

### `kodelyth-advisor` — User is lost, stuck, overwhelmed

Trigger if the user expresses **uncertainty about direction**, not a specific technical question.

| Signal | Real human phrasing |
|---|---|
| Stuck / lost | "I'm stuck", "I'm lost", "I have no idea", "I don't know where to start", "no clue what to do" |
| Overwhelmed | "this is too much", "I'm overwhelmed", "where do I even begin", "there's so much to think about" |
| Asking for direction | "what should I do", "help me figure out", "should I X or Y", "I'm not sure which way to go" |
| Confused about the codebase | "I don't understand this code", "how does this even work", "what is all this doing" |
| First-time on a problem | "first time doing X", "never done this before", "is there a right way", "I'm new to this" |
| Seeking reassurance | "am I doing this right?", "is this approach okay?", "what would you do here?" |
| General help request | "can someone help me with this?", "any advice?", "I need guidance" |

**Counter-signals (do NOT route here):** specific error message, stack trace, named file/function, or a direct technical question with a clear answer.

### `pair-programmer` — User is about to write code

Trigger if the user describes **what they're about to build** before they start.

| Signal | Real human phrasing |
|---|---|
| Pre-implementation | "I want to build", "I'm going to add", "let's create", "I need to make a", "let me add", "I'm starting to work on" |
| Approach question | "how should I implement", "what's the best way to", "should I use X pattern", "which approach is better" |
| Architecture sketch | "I'm thinking of doing X then Y", "my plan is to", "I was thinking maybe" |
| Pre-flight check | "before I start", "thinking about", "planning to", "about to write" |
| Asking how | "how do I build", "how would you do", "what's the pattern for", "is there a standard way" |
| Single feature | User describes adding ONE feature or function to an existing codebase |

---

## Priority 2 — Active Pain (something is broken)

### `debug-detective` — Bug, error, unexpected behavior

| Signal | Real human phrasing |
|---|---|
| Direct bug report | "bug", "broken", "crashed", "exception", "stack trace", "traceback", "error" |
| Frustration | "I've been trying for hours", "can't figure out why", "this won't work", "driving me crazy", "nothing works", "I'm losing my mind" |
| Unexpected behavior | "why is this X", "shouldn't this Y", "not what I expected", "acting weird", "behaving strangely" |
| Something is wrong | "something's wrong", "it's broken again", "stopped working", "used to work and now doesn't" |
| Specific error keywords | `TypeError`, `NullPointerException`, `panic`, `segfault`, `undefined`, `cannot read property`, `500 error`, `404` |
| Test failures | "test fails", "expected X got Y", "assertion failed", "tests are red", "CI is failing" |
| Implicit (code paste) | User pastes a stack trace, error log, or failing test output with no other context |

**Always:** ask for the exact error, the minimal repro, and what was changed last.

### `silent-failure-hunter` — Something is wrong but no error

| Signal | Real human phrasing |
|---|---|
| Mismatch without error | "no error but wrong result", "data is wrong", "looks fine but isn't working", "getting the wrong output" |
| Silent state corruption | "X happened but Y didn't fire", "the value is off", "race condition", "something is off" |
| Swallowed exceptions | "try/catch", "fallback", "default value", "it just returns null", "it silently fails" |
| Puzzling behavior | "it's doing something unexpected", "the numbers don't add up", "data seems off", "I'm confused by the output" |

### `build-error-resolver` — Build / compile / type errors

| Signal | Real human phrasing |
|---|---|
| Build failed | "build failed", "compile error", "won't compile", "cargo build", "npm run build", "build is red", "failing to build" |
| Type errors | "type error", "TS2322", "type mismatch", "cannot assign", "incompatible types", "TypeScript is yelling at me" |
| Module/import | "module not found", "cannot resolve", "import error", "can't find the module" |
| Deploy errors | "Vercel build failed", "Railway is erroring", "can't deploy", "deployment is broken" |

**Language-specific routing:** Go → `go-build-resolver`, Rust → `rust-build-resolver`, Java → `java-build-resolver`, Kotlin → `kotlin-build-resolver`, C++ → `cpp-build-resolver`, Dart/Flutter → `dart-build-resolver`, PyTorch → `pytorch-build-resolver`.

---

## Priority 3 — Quality & Review

### `code-reviewer` — User wants feedback on existing code

| Signal | Real human phrasing |
|---|---|
| Direct review request | "review this", "code review", "LGTM?", "thoughts?", "feedback", "take a look at this", "eyes on this" |
| Quality check | "is this good", "is this clean", "anything wrong", "what do you think of this code", "can you check this" |
| Refactor opportunity | "is there a better way", "smell test", "looks ugly", "feels messy", "is this readable" |
| Implicit (code paste) | User pastes code with minimal text — treat as a review request |
| Sanity check | "does this make sense?", "is this the right approach?", "would you write it differently?" |
| Before merge | "about to merge this", "is this PR-ready?", "pre-merge check" |

**Key rule:** Single-file or single-function review → language reviewer. Full project or multiple files → `/team-review`.

**Language-specific routing (if file extension or language is mentioned):**

| Language | Agent |
|---|---|
| TypeScript / JavaScript | `typescript-reviewer` |
| Python | `python-reviewer` |
| Go | `go-reviewer` |
| Rust | `rust-reviewer` |
| Java / Spring | `java-reviewer` |
| Kotlin / Android | `kotlin-reviewer` |
| C++ | `cpp-reviewer` |
| C# / .NET | `csharp-reviewer` |
| Flutter / Dart | `flutter-reviewer` |
| SQL / Postgres / Supabase | `database-reviewer` |
| Healthcare / EMR / PHI | `healthcare-reviewer` |

### `security-reviewer` — Security concern

| Signal | Real human phrasing |
|---|---|
| Direct security question | "is this secure", "vulnerability", "CVE", "audit", "any security issues", "is this safe" |
| Common attacks | "SQL injection", "XSS", "CSRF", "SSRF", "auth bypass", "RCE", "path traversal", "injection" |
| Auth & secrets | "auth flow", "JWT", "session", "API key in code", "leaked secret", "exposed credential", "token in code" |
| Crypto | "encryption", "hashing passwords", "salt", "AES", "RSA", "how to store passwords" |
| Input handling | "user input", "sanitize", "escape", "validation", "user-submitted data" |
| Worry signal | "I'm worried this might be insecure", "is there a risk here", "could someone exploit this" |

### Devil-Mode Adversarial Crew (8 specialists — attacker mindset)

These 8 agents look at the same code an attacker would. Route to them when the user shows signs of adversarial thinking, supply-chain worry, AI safety concern, or pre-public-launch paranoia.

#### `prompt-injection-hunter` — AI-feature attack-surface review

| Signal | Real human phrasing |
|---|---|
| AI feature audit | "is my AI feature safe?", "can my agent be jailbroken?", "review my prompts", "audit my LLM integration" |
| Prompt safety | "prompt injection", "indirect injection", "system prompt leak", "tool hijacking", "RAG security" |
| MCP server review | "is this MCP server safe?", "audit my MCP integration", "agent tool security" |

#### `supply-chain-auditor` — Dependency & install-script attacker review

| Signal | Real human phrasing |
|---|---|
| Dep paranoia | "is this package safe?", "could this dep be malicious?", "typosquat", "dependency confusion", "is npm install safe?" |
| Lockfile concern | "lockfile drift", "should I trust this dep?", "audit my deps for malware", "what's in my node_modules" |
| Recent CVE worry | "is this CVE in my supply chain", "compromised package alert", "is `<pkg>` malicious now?" |

#### `secret-hunter` — Leaked credential hunt

| Signal | Real human phrasing |
|---|---|
| Leak worry | "did I leak any secrets?", "scan for API keys", "any tokens in my code?", "secret scanner", "credentials in git" |
| Pre-public | "I'm about to make this public, any secrets in history?", "before I go open-source check secrets" |
| Bundled to client | "are my env vars exposed to the browser?", "is `process.env.X` leaking to the client?" |
| Rotate event | "rotated my keys, did I miss any?", "post-incident sweep" |

#### `license-violation-finder` — IP / copyleft contamination audit

| Signal | Real human phrasing |
|---|---|
| License audit | "license audit", "are my deps GPL?", "license compatibility", "copyleft check", "AGPL contamination" |
| Going public | "before I open-source, license audit", "any license issues with my deps?" |
| Due diligence | "M&A license review", "investor due diligence", "what licenses are in my distribution" |
| Attribution | "do I need to add attribution?", "missing THIRD-PARTY.md", "MIT license requirements" |

#### `jailbreak-tester` — Live AI feature red-team

| Signal | Real human phrasing |
|---|---|
| AI red-team | "red-team my AI", "test my chatbot for jailbreaks", "can my LLM be tricked?", "AI safety testing" |
| Pre-launch AI | "launching an AI feature, is it safe?", "production AI safety check", "test my agent for refusal bypasses" |
| Overrefusal | "my AI refuses too much", "false refusals", "my chatbot won't answer normal questions" |

#### `code-stealer-detector` — Code provenance audit

| Signal | Real human phrasing |
|---|---|
| Provenance | "where did this code come from?", "provenance check", "audit copy-paste origin", "is this Stack Overflow code?" |
| AI-generated | "audit AI-generated code", "Copilot-written code provenance", "is my LLM-generated code safe to ship?" |
| Pre-public | "before going open-source, check code origins", "M&A IP audit", "due diligence code review" |
| Style break | "this code looks pasted", "doesn't match our style", "audit unusual code blocks" |

#### `backdoor-hunter` — Malicious-code pattern detection

| Signal | Real human phrasing |
|---|---|
| Malware suspicion | "is this code malicious?", "look for backdoors", "obfuscated code", "what does this eval do?", "scan for hidden payloads" |
| Post-compromise | "after a security incident, sweep the code", "vendor said they were compromised, audit my install" |
| Vendored review | "audit this vendored library", "review this third-party code dump", "contractor code review for malice" |
| Suspicious CI | "weird stuff happening in my CI", "build is doing things it shouldn't", "unexplained network calls" |

#### `chaos-engineer` — Adversarial reliability / fault injection

| Signal | Real human phrasing |
|---|---|
| Resilience | "test my system's resilience", "chaos engineering", "fault injection", "what happens if X dies?" |
| Pre-launch readiness | "is my system production-ready under failure?", "test failure modes before launch" |
| Hidden assumption | "what hidden assumptions am I making?", "what could break?", "stress my dependencies" |
| Game day | "schedule a game day", "team chaos exercise", "training for incidents" |

**Counter-signal (for all devil-mode agents):** General quality concern not framed adversarially → use the standard `code-reviewer` / `security-reviewer` / `performance-optimizer`. Route to devil-mode only when the user is explicitly thinking like an attacker or asking pre-public/pre-launch questions.

### `api-guardian` — API contract changes

| Signal | Real human phrasing |
|---|---|
| API change | "breaking change", "deprecate", "API version", "backwards compat", "changing the endpoint" |
| Contract concern | "consumer impact", "client breakage", "field removal", "rename endpoint", "will this break clients" |
| Spec work | "OpenAPI", "GraphQL schema", "REST design", "idempotent", "API design review" |

### `ux-reviewer` — Frontend / UX / Accessibility

| Signal | Real human phrasing |
|---|---|
| UI feedback | "feels off", "looks weird", "UX", "user experience", "interaction", "the UI is confusing" |
| Accessibility | "a11y", "WCAG", "screen reader", "ARIA", "keyboard nav", "color contrast", "accessible" |
| Form / interaction | "form validation", "loading state", "error state", "empty state", "the form feels clunky" |
| Mobile / responsive | "mobile", "responsive", "viewport", "touch target", "doesn't look right on phone" |
| Usability | "users are confused by", "hard to use", "the flow is broken", "nobody can find the button" |

---

## Priority 4 — Performance & Scale

### `incident-commander` — Production is down or degraded

Route here FIRST for any active production incident. This takes priority over `debug-detective` when the incident is live in production.

| Signal | Real human phrasing |
|---|---|
| Production down | "production is down", "outage", "site is down", "service unavailable", "prod is broken" |
| P0 / P1 | "P0", "P1", "incident", "on-call", "pagerduty fired", "alert triggered", "woke up to alerts" |
| Blast radius | "10% of users affected", "all requests failing", "error rate spiked", "users can't login" |
| Active degradation | "production is throwing 500s", "latency is through the roof", "database is down", "everything is slow in prod" |
| Postmortem | "postmortem", "incident review", "blameless review", "what went wrong", "write up the incident" |

**Counter-signals:** development bug (not production), staging environment, local testing — route to `debug-detective` instead.

### `load-tester` — Load, stress, and capacity testing

| Signal | Real human phrasing |
|---|---|
| Load test request | "load test", "stress test", "performance test", "capacity test", "can it handle X users" |
| Tools | "k6", "Locust", "Artillery", "wrk", "Gatling", "hey", "ab test" |
| Capacity planning | "how many users can we handle", "what's our breaking point", "max RPS", "will it scale" |
| Pre-launch validation | "will this hold under load", "ready for launch traffic", "scale test", "launch is tomorrow" |
| Soak test | "soak test", "memory leak under load", "sustained load test", "long-running load" |

**Counter-signal:** "make this code faster" → `performance-optimizer`. Load-tester handles test design, not code optimization.

### `performance-optimizer` — Slowness / bottleneck in code

| Signal | Real human phrasing |
|---|---|
| Slow | "slow", "sluggish", "laggy", "takes forever", "timing out", "too slow", "feels sluggish" |
| Resource | "high CPU", "memory leak", "OOM", "out of memory", "cpu pinned", "memory keeps growing" |
| Frontend perf | "FCP", "LCP", "INP", "bundle size", "render time", "jank", "the page loads slowly" |
| Backend perf | "N+1", "slow query", "throughput", "latency", "p99", "the API is slow" |
| Optimization request | "make this faster", "optimize this", "reduce the load time", "improve performance" |

---

## Priority 5 — Planning & Architecture

### `planner` — Feature planning

| Signal | Real human phrasing |
|---|---|
| Plan a feature | "plan this", "roadmap", "break down", "sprint plan", "milestones", "break this into tasks" |
| Decompose | "where do I start with X feature", "tasks for", "work items", "list the steps for" |
| Scope definition | "what do we need to build for X", "what's involved in adding X" |

### `architect` — System design

| Signal | Real human phrasing |
|---|---|
| System-level | "architecture", "system design", "how should the services interact", "what's the overall design" |
| Choosing tech | "should I use Postgres or Mongo", "monorepo vs polyrepo", "REST vs GraphQL", "which database" |
| Scaling | "horizontal scaling", "sharding", "queue", "event-driven", "how do I scale this" |
| Design decision | "what's the right architecture for X", "how should I structure this", "where should this live" |

### `code-architect` — Single-feature blueprint

Trigger when the user wants a **detailed implementation blueprint for one specific feature**, not the whole system.

| Signal | Real human phrasing |
|---|---|
| Feature blueprint | "how do I implement X", "give me a blueprint for X", "design the X feature", "how should X work technically" |

### `migration-guide` — Framework / language version upgrade

| Signal | Real human phrasing |
|---|---|
| Upgrade | "upgrade from X to Y", "migrate to", "Next.js 12 → 15", "Python 2 → 3", "React 18 → 19" |
| Major version | "major version bump", "breaking deps", "node 18 → 22", "TS 4 → 5", "moving to the new version" |
| Deprecation | "this is deprecated", "the old way is removed", "I need to update away from X" |

---

## Priority 6 — Testing

### `tdd-guide` — Tests, coverage, TDD

| Signal | Real human phrasing |
|---|---|
| Write tests | "write a test", "unit test", "integration test", "test for this", "I need tests for" |
| TDD | "TDD", "test driven", "red green refactor", "write the test first" |
| Coverage | "coverage", "what's not tested", "coverage gap", "my coverage is low", "what am I missing in tests" |
| No tests yet | "I haven't written any tests", "there are no tests", "need to add tests" |

### `e2e-runner` — End-to-end Playwright tests

| Signal | Real human phrasing |
|---|---|
| E2E | "Playwright", "end-to-end", "E2E", "browser test", "user flow test", "test the whole flow" |
| Critical path | "checkout flow", "signup flow", "happy path test", "test the full user journey" |

### `pr-test-analyzer` — Test coverage on PRs

| Signal | Real human phrasing |
|---|---|
| PR | "review my PR tests", "did I cover everything", "PR test gaps", "is my PR well tested" |

---

## Priority 7 — Code Hygiene

### `refactor-cleaner` — Dead code, cleanup

| Signal | Real human phrasing |
|---|---|
| Cleanup | "clean up", "dead code", "unused", "remove old", "tech debt", "time to clean this up" |
| Duplicate | "duplicate", "DRY", "extract function", "this is copy-pasted everywhere" |
| Cruft | "old stuff hanging around", "deprecated code we never removed", "vestigial code" |

### `code-simplifier` — Reduce complexity

| Signal | Real human phrasing |
|---|---|
| Simplify | "simpler", "too complex", "hard to read", "convoluted", "this is too complicated" |
| Readability | "easier to follow", "more readable", "nobody can understand this", "even I can't read it" |

### `type-design-analyzer` — Type system improvements

| Signal | Real human phrasing |
|---|---|
| Type design | "better types", "stricter types", "type safety", "discriminated union", "generics" |
| `any` cleanup | "remove any", "stricter typing", "narrow type", "too many anys", "weaken the types" |

---

## Priority 8 — Documentation

### `doc-updater` — Update docs/README

| Signal | Real human phrasing |
|---|---|
| Docs | "update README", "document this", "add docs", "JSDoc", "docstring", "write the docs for" |
| Onboarding | "explain how this works", "doc for new devs", "I need to document this for my team" |
| Missing docs | "nobody knows how this works", "there are no docs", "write documentation" |

### `docs-lookup` — Library / framework API question

| Signal | Real human phrasing |
|---|---|
| Library API | "how do I use X library", "what's the signature", "API for X", "how does X work" |
| Framework feature | "Next.js App Router", "React Suspense", "Django ORM", "Rails 7", "how does X handle Y" |
| Usage question | "what's the syntax for", "what parameters does X take", "how do I call" |

### `comment-analyzer` — Comment quality

| Signal | Real human phrasing |
|---|---|
| Comments | "are my comments good", "comment hygiene", "explain why not what", "are these comments useful" |

---

## Priority 9 — Specialized Workflows

### `chief-of-staff` — Communication, email, multi-channel ops

Trigger for non-code workflow tasks: drafting emails, scheduling, status updates, multi-channel coordination.

| Signal | Examples |
|---|---|
| Communication | "draft an email", "write a message", "reply to this", "slack message" |
| Status | "status update", "what do I tell the team", "write the incident update" |

### `seo-specialist` — SEO / metadata / search

| Signal | Examples |
|---|---|
| SEO | "SEO", "meta tags", "schema.org", "structured data", "Core Web Vitals", "sitemap", "my page doesn't rank" |

### `opensource-forker` + `opensource-sanitizer` + `opensource-packager` — Open-sourcing a project

| Signal | Examples |
|---|---|
| OSS prep | "open source this", "make this public", "strip secrets", "remove credentials", "release as open source" |

Use the chain: `forker` → `sanitizer` → `packager`.

### `/dashboard` — Local observability dashboard

| Signal | Examples |
|---|---|
| Open dashboard | "open the dashboard", "show me the dashboard", "start the dashboard" |
| Inspect memory | "show me what's in my memory", "browse my sessions", "see my memory store" |
| Token / evolve | "what's my token budget", "show evolve proposals", "evolve tab" |

### `/swarm` — Parallel agent swarm in git worktrees

| Signal | Examples |
|---|---|
| Swarm request | "use the swarm", "run a swarm", "swarm this", "parallel swarm" |
| Parallel worktrees | "run agents in parallel", "spawn multiple agents", "maximum throughput" |

### `/route-model` — Cost-aware model selection

| Signal | Examples |
|---|---|
| Model choice | "which model should I use", "haiku or sonnet?", "should I use opus here" |
| Cost concern | "cheapest model for this", "save tokens", "cost-aware routing" |

### `/memory-evolve` — Self-evolving memory proposals

| Signal | Examples |
|---|---|
| Evolve proposals | "show evolve proposals", "what has ECC learned", "memory evolution" |
| Routing additions | "suggest routing improvements", "what routing misses happened" |

### `/replay` — Session replay

| Signal | Examples |
|---|---|
| Replay request | "replay a session", "re-run that session", "session replay" |
| Bundle | "session bundle", "export and replay", "portable session" |

---

## Priority 10 — Multi-Agent Patterns

### Sequential chains (suggest the next agent)

| Just used | Suggest next |
|---|---|
| `pair-programmer` (approach agreed) | `code-reviewer` after implementation |
| `debug-detective` (root cause found) | `tdd-guide` to add a regression test |
| `code-reviewer` (issues found) | `refactor-cleaner` to fix |
| `security-reviewer` (vuln found) | `tdd-guide` to add a security test |
| `architect` (design done) | `code-architect` for the first feature |
| `performance-optimizer` (bottleneck found) | `tdd-guide` for a perf regression test |
| `incident-commander` (incident resolved) | `debug-detective` for deeper root cause, then postmortem |

---

### `image-architect` — Image and visual generation

Trigger on ANY request for a visual, image, picture, graphic, or design asset.

| Signal | Examples |
|---|---|
| Explicit request | "generate an image", "create a picture", "make a visual", "I need graphics" |
| Hero / social | "hero image", "banner", "OG image", "social preview", "GitHub card", "Twitter card" |
| Implicit visual need | "my site looks plain", "it looks empty", "needs something visual", "looks boring" |
| Design ask | "design a logo", "make it look good", "something for the homepage" |

Platform routing: Antigravity → Gemini Imagen 3 · Codex → DALL-E 3 · Claude Code → fal.ai → SVG · others → SVG.

---

### `/project-launch` — New project parallel founding team

Trigger when starting something new of meaningful scope.

| Signal | Examples |
|---|---|
| New build | "help me build X", "I want to build X", "I'm building X", "let's make X" |
| Greenfield | "starting from scratch", "new project", "new app", "new service", "new API" |
| Idea phase | "I have this idea", "I'm thinking of building", "I want to make a" |
| New SaaS / startup | "I'm building a SaaS", "side project", "startup idea" |

**Key rule:** Non-trivial new build → `/project-launch`. Adding one feature to existing codebase → `pair-programmer`.

Route to `/project-launch` — fires `architect` + `pair-programmer` + `security-reviewer` + `tdd-guide` + `ux-reviewer` simultaneously.

---

### `/team-review` — Existing project parallel full audit

Trigger when review scope is broad (multiple files) or the user asks "is this ready?".

| Signal | Examples |
|---|---|
| Broad review | "review my project", "check my codebase", "audit my code" |
| Pre-release | "before I ship", "ready to release?", "pre-launch check", "about to go live" |
| Readiness check | "is this ready?", "any issues before I ship?", "is this production-ready?" |

**Key rule:** Single-file review → language-specific reviewer. Full project or multi-file → `/team-review`.

Route to `/team-review` — fires `code-reviewer` + `security-reviewer` + `performance-optimizer` + `api-guardian` simultaneously.

---

### `/security-audit` — Full parallel security sweep

Trigger when security concern spans the whole project or multiple vectors (secrets + deps + API).

| Signal | Examples |
|---|---|
| Full security concern | "is my app secure?", "security audit", "run a security check" |
| Pre-launch security | "before I go public", "about to expose this API" |
| Dependency worry | "are my deps safe?", "any vulnerable packages?", "CVEs in my dependencies?" |

**Key rule:** Single file concern → `security-reviewer`. Multi-vector or project-wide → `/security-audit`.

Route to `/security-audit` — fires `security-reviewer` + `dependency-doctor` + `api-guardian` simultaneously.

---

### `/devil-mode` — Full adversarial parallel sweep

Trigger when attacker mindset is needed across the whole codebase, especially pre-public or post-compromise.

| Signal | Examples |
|---|---|
| Attacker mindset | "think like an attacker", "red-team my code", "find what's exploitable" |
| Pre-public sweep | "going open-source — full audit", "scan for everything before I publish" |
| Post-compromise | "we were hacked, audit everything", "after the incident, full review" |
| Devil mode keyword | "devil mode", "no-mercy audit", "paranoid review" |

**Key rule:** One or two security angles → `/security-audit`. Multi-vector attacker sweep → `/devil-mode`.

Route to `/devil-mode` — fires `prompt-injection-hunter` + `supply-chain-auditor` + `secret-hunter` + `backdoor-hunter`. Use `--all` for all 8, `--pre-public` for OSS sweep, `--pre-launch` for launch sweep.

---

### `/pre-release` — Ship-readiness parallel check

Trigger when cutting a release, tagging a version, or deploying to production.

| Signal | Examples |
|---|---|
| About to release | "ready to cut v2?", "cutting a release", "tagging v1.0", "shipping today" |
| Release checklist | "release checklist", "anything missing before v2?" |
| Final sanity check | "last check before I push to prod", "one more look before shipping" |

**Key rule:** General readiness → `/team-review`. Explicit release or version cut → `/pre-release`.

Route to `/pre-release` — fires `release-captain` + `security-reviewer` + `code-reviewer` simultaneously.

---

### `/debug-blitz` — Triple-agent parallel debug for stubborn bugs

Trigger when a bug has resisted normal debugging or spans multiple layers (code + env + hidden failure).

| Signal | Examples |
|---|---|
| Persistent bug | "been fighting this for hours", "nothing is working", "tried everything" |
| Multi-layer problem | "works locally not in CI", "works on my machine", "only fails in prod" |
| Frustration signal | "I give up", "losing my mind", "been stuck for X hours/days" |

**Key rule:** First-time bug → `debug-detective`. Persistent, multi-layer, or frustration-coded → `/debug-blitz`.

Route to `/debug-blitz` — fires `debug-detective` + `silent-failure-hunter` + `env-debugger` simultaneously.

---

### `/refactor-sprint` — Full parallel refactor + type + test pass

Trigger when cleanup spans a module or file, especially when multiple concerns (readability + types + tests) come together.

| Signal | Examples |
|---|---|
| Big cleanup | "refactor this module", "this code is a mess", "technical debt cleanup" |
| Multi-concern quality | "improve quality, types, and add tests", "full cleanup", "legacy code overhaul" |

**Key rule:** Single function cleanup → `refactor-cleaner`. Module-wide with types and tests → `/refactor-sprint`.

Route to `/refactor-sprint` — fires `refactor-cleaner` + `code-simplifier` + `type-design-analyzer` + `tdd-guide` simultaneously.

---

### `/onboard` — New-joiner parallel codebase onboarding

Trigger when someone is new to a codebase and needs to understand it.

| Signal | Examples |
|---|---|
| New to codebase | "I just joined the team", "inherited this codebase", "taking over this repo" |
| Explore unfamiliar code | "never seen this code before", "where do I even start?" |
| Ramp-up request | "help me get up to speed", "ramp me up on this" |

**Key rule:** Single "explain this function" → `code-explorer`. Full codebase orientation → `/onboard`.

Route to `/onboard` — fires `code-explorer` + `architect` + `doc-updater` simultaneously.

---

### `/lessons` — Project lessons management

Trigger when the user references project rules, preferences, corrections, or past instructions.

| Signal | Examples |
|---|---|
| Load rules | "load my lessons", "what rules do we have", "show me the rules" |
| Remember something | "remember that we use pnpm", "note that we do X", "don't forget Y" |
| Habit encode | "from now on always X", "make it a rule that", "I want you to always" |

Proactively offer to load if `tasks/lessons.md` exists in the project root.

---

### Parallel suggestions

When the user's request spans multiple concerns, name the parallel agents:

- "I'm building a payment endpoint" → `pair-programmer` + `security-reviewer` + `api-guardian`
- "Refactoring the auth module" → `refactor-cleaner` + `security-reviewer` + `tdd-guide`
- "help me build a SaaS app" → `/project-launch` (5 agents)
- "review my project before I deploy" → `/team-review` (4 agents)
- "my site needs visuals" → `image-architect`

---

## Counter-Patterns — Do NOT Route

**Skip routing if:**

- The user **already explicitly invoked** an agent (`use <agent>`, `@agent`, `invoke <agent>`) — that takes precedence
- The message is **a one-liner factual question** — answer directly
- The message is **purely conversational** ("hi", "thanks", "ok") — respond normally
- The user says **"just answer me directly"** or **"don't route"** — respect it
- The request is **trivially simple** (rename a variable, change one line)

---

## Example Routing Decisions

| User says | Route to | Why |
|---|---|---|
| "I'm getting a TypeError on line 42" | `debug-detective` | Specific error |
| "something is wrong but there's no error" | `silent-failure-hunter` | Silent failure pattern |
| "Should I use React Context or Zustand here?" | `pair-programmer` | Pre-implementation approach |
| "Review my login component" | `typescript-reviewer` | Single file + likely TS |
| "I have no idea where to start" | `kodelyth-advisor` | Lost / overwhelmed |
| "How do I make this faster?" | `performance-optimizer` | Direct perf question |
| "Is my JWT signing secure?" | `security-reviewer` | Auth + security keyword |
| "build failed on Vercel" | `build-error-resolver` | Build failure |
| "Migrate from Pages Router to App Router" | `migration-guide` | Framework migration |
| "Add accessibility to this form" | `ux-reviewer` | a11y |
| "production is down, getting 500s" | `incident-commander` | Active production incident |
| "will this hold under 10k users?" | `load-tester` | Capacity question |
| "generate a hero image" | `image-architect` | Explicit image request |
| "my site looks plain" | `image-architect` | Implicit visual need |
| "help me build a todo app" | `/project-launch` | New build |
| "I have this idea for a SaaS dashboard" | `/project-launch` | Greenfield project |
| "review my code before I deploy" | `/team-review` | Pre-release, full scope |
| "is my app secure? check everything" | `/security-audit` | Full security sweep |
| "cutting v2 today, last check" | `/pre-release` | Release + confidence combo |
| "been stuck on this bug for 2 days" | `/debug-blitz` | Persistent frustration |
| "works locally not in prod" | `/debug-blitz` | Multi-layer problem |
| "clean up this whole module, add types and tests" | `/refactor-sprint` | Multi-concern quality |
| "I just joined this team, where do I start?" | `/onboard` | New-joiner onboarding |
| "think like an attacker, sweep my code" | `/devil-mode` | Attacker mindset trigger |
| "going open-source, full audit before publish" | `/devil-mode --pre-public` | Pre-public sweep |
| "we were hacked, audit everything" | `/devil-mode --all` | Post-compromise full sweep |
| "is my AI feature jailbreak-safe?" | `prompt-injection-hunter` | AI-feature attack surface |
| "did I leak secrets in git history?" | `secret-hunter` | Credential leak hunt |
| "remember we always use pnpm here" | `/lessons` | Preference to encode |
| [user pastes code with no text] | `code-reviewer` | Implicit review |
| [user pastes stack trace with no text] | `debug-detective` | Implicit debug |

---

## Output Format When Routing

```
→ Routing to debug-detective (stack trace + frustration signals match the bug-tracking pattern)

[response in debug-detective's style — methodical, hypothesis-driven, asks for repro]

Tip: next time you can type "use debug-detective" to invoke me directly.
```

This keeps the user **informed**, **never surprised**, and **learning the toolkit** with every interaction.
