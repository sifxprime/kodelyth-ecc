# Kodelyth ECC — Twitter / X Hype Content
# v1.8.0 · github.com/sifxprime/kodelyth-ecc

---

## THREAD 1 — Devil Mode: 8 Adversarial Agents
**Theme:** Red-team your code before attackers do
**Image:** social/hype-devil-mode.svg

---

**Tweet 1/8**
Most "security reviews" are vibes checks.

Kodelyth ECC ships with 8 dedicated adversarial agents that read your code the way an attacker would.

One command. Runs in parallel. 8 minutes.

🧵 /devil-mode — what it actually does

---

**Tweet 2/8**
`/devil-mode` fires 4 agents simultaneously:

→ prompt-injection-hunter — finds AI injection vectors
→ supply-chain-auditor — hunts malicious deps
→ secret-hunter — scans for hardcoded credentials
→ backdoor-hunter — detects inserted vulnerabilities

All running in parallel. Not sequentially.

---

**Tweet 3/8**
`/devil-mode --all` adds 4 more:

→ jailbreak-tester — live AI feature red-team
→ code-stealer-detector — code provenance audit
→ license-violation-finder — GPL contamination check
→ chaos-engineer — failure mode analysis

8 agents. 8 minutes. Was 60+ doing this by hand.

---

**Tweet 4/8**
The prompt-injection-hunter checks things most security tools miss entirely:

- Indirect prompt injection in RAG pipelines
- System prompt leaks via tool outputs
- Tool hijacking in MCP servers
- Agent-to-agent injection vectors

AI features have a new attack surface. ECC maps it.

---

**Tweet 5/8**
supply-chain-auditor goes deeper than `npm audit`:

- Typosquatting detection
- Dependency confusion vectors
- Lockfile integrity verification
- Install-script analysis
- Recent CVE cross-reference

Your `node_modules` is the largest third-party code surface you own. It should be audited.

---

**Tweet 6/8**
Devil mode is non-destructive.

It analyzes, reports, and stops.

Nothing gets modified. Nothing gets sent anywhere. No cloud. No account. No API key.

Just adversarial analysis, local, fast, and yours.

---

**Tweet 7/8**
When to run `/devil-mode`:

- Before going open-source: `--pre-public`
- Before shipping to production: `--pre-launch`
- After a security incident: `--all`
- Any time you think like an attacker

Semantic routing also auto-triggers it: "think like an attacker, sweep my code" works.

---

**Tweet 8/8**
Kodelyth ECC is free. MIT. No account.

npx kodelyth-ecc

70 agents. 194 skills. 97 commands. 8 adversarial.
11 platforms. 0 cloud.

github.com/sifxprime/kodelyth-ecc

[attach: social/hype-devil-mode.svg]

---
---

## THREAD 2 — Compound Learning: Gets Smarter Every Session
**Theme:** The toolkit that learns your style
**Image:** social/hype-compound-learning.svg

---

**Tweet 1/8**
Most AI tools forget everything the moment a session ends.

Kodelyth ECC has a three-layer memory system that compounds across every session you run.

Month 3 feels like a colleague who has worked with you for years.

🧵 How compound learning actually works

---

**Tweet 2/8**
Layer 1: Project Lessons

Every correction you give Claude gets encoded permanently.

Say "use pnpm not npm" once. It writes to tasks/lessons.md. The next session, it injects that rule before your first message.

You never say it again.

---

**Tweet 3/8**
The mechanics:

Session ends → capture-correction.js scans for correction signals
→ extracts the rule → appends to tasks/lessons.md

Next session starts → read-lessons.js fires first
→ injects "PROJECT LESSONS — HARD RULES" into context
→ Claude follows them. Every time.

12 correction signal patterns. Async. Zero latency.

---

**Tweet 4/8**
Layer 2: Global Memory

~/.kodelyth/memory/ stores solutions cross-project via BM25 search.

Every prompt you type triggers a recall. If you solved a similar problem in a different project six months ago, that solution surfaces before the AI responds.

No cloud. No embeddings. Pure local.

---

**Tweet 5/8**
Layer 3: Semantic Intent Routing

70 specialist agents route from intent, not keywords.

Paste a stack trace → debug-detective
Paste code → code-reviewer
"help me build X" → /project-launch
"production is down" → incident-commander

No config. No agent names to memorize. Just describe the problem.

---

**Tweet 6/8**
Three layers working together:

Layer 1 knows your project rules.
Layer 2 knows your past solutions.
Layer 3 knows your intent.

Combined: the ramp-up cost at session start drops to near zero. You start exactly where you left off.

---

**Tweet 7/8**
This is all local.

tasks/lessons.md — plain Markdown you own and edit
~/.kodelyth/memory/ — plain JSONL you can inspect and delete
Rules — just files in ~/.claude/rules/

Nothing is transmitted. Nothing is analyzed on a server. No model is being fine-tuned on your corrections.

---

**Tweet 8/8**
Kodelyth ECC. Free. MIT. No account.

npx kodelyth-ecc

70 agents. 11 platforms. Compound learning.
194 skills. 97 commands. 0 cloud.

github.com/sifxprime/kodelyth-ecc

[attach: social/hype-compound-learning.svg]

---
---

## THREAD 3 — Parallel Agents: The Speed Thread
**Theme:** Fire 4 specialists simultaneously — not one after another
**Image:** social/hype-parallel-agents.svg

---

**Tweet 1/8**
A full code review used to mean:
code quality → security → performance → API contracts

Done sequentially. Each agent gets the full context. 60 minutes.

/team-review fires all 4 simultaneously. 15 minutes. Same depth.

🧵 How parallel agents work and why it matters

---

**Tweet 2/8**
The 8 parallel commands:

/team-review — 4 agents, 15 min
/project-launch — 5 agents, 10 min
/security-audit — 3 agents, 8 min
/debug-blitz — 3 agents, 8 min
/refactor-sprint — 4 agents, 12 min
/pre-release — 3 agents, 8 min
/onboard — 3 agents, 10 min
/devil-mode — 4-8 agents, 8-15 min

---

**Tweet 3/8**
/project-launch is the most underrated one.

You describe a project idea. Five agents fire simultaneously:

architect — system design
pair-programmer — implementation approach
security-reviewer — threat model
tdd-guide — test strategy
ux-reviewer — interaction and a11y

Catch design mistakes before writing a single line.

---

**Tweet 4/8**
Why parallel matters beyond speed:

Each agent gets a focused, narrow context.
They don't pollute each other's reasoning.
You get independent opinions, not one AI trying to do everything.

code-reviewer doesn't soften its findings because security-reviewer already complained.

---

**Tweet 5/8**
/debug-blitz is for bugs that have resisted 30+ minutes of investigation.

debug-detective + silent-failure-hunter + env-debugger.

Three hypotheses in parallel:
- It's a code bug
- It's a silent failure / swallowed error
- It's an environment / config difference

One of them usually wins fast.

---

**Tweet 6/8**
/pre-release is the "go/no-go" command.

release-captain + security-reviewer + code-reviewer.

Checks: semver decisions, changelog completeness, security regressions, code quality gates, rollback plan, smoke test coverage.

Run it before you tag. Not after.

---

**Tweet 7/8**
You don't need to memorize command names.

Semantic routing auto-triggers parallel commands from intent:

"review my project before I deploy" → /team-review
"launching tomorrow, find everything" → /devil-mode --pre-launch
"help me build a SaaS from scratch" → /project-launch

Just describe what you need.

---

**Tweet 8/8**
Kodelyth ECC. Free. MIT. No account.

npx kodelyth-ecc

70 agents. 8 parallel commands. 194 skills.
11 platforms. Compound learning. 0 cloud.

github.com/sifxprime/kodelyth-ecc

[attach: social/hype-parallel-agents.svg]

---
---

## THREAD 4 — MCP Server: Bridge Every AI Framework
**Theme:** One toolkit, every AI tool you use
**Image:** social/hype-mcp-server.svg

---

**Tweet 1/8**
Claude Desktop, LangGraph, AutoGen, CrewAI, OpenAI Agents SDK.

Every framework wants its own integration layer.

Kodelyth ECC ships an MCP server with 16 tools, 6 prompts, and 377 resources.

One server. Any client.

🧵 The kodelyth-ecc MCP server

---

**Tweet 2/8**
npx kodelyth-ecc mcp

That's it. stdio JSON-RPC server starts locally.

Connect it to Claude Desktop with two lines in settings.json.
Connect it to LangGraph with the MCP client adapter.
Connect it to any framework that speaks Model Context Protocol.

---

**Tweet 3/8**
The 16 tools cover the full ECC surface:

agent_invoke — call any of the 70 specialist agents
memory_search — BM25 recall from your local memory store
skill_load — load any of 194 skills into context
swarm_run — spawn parallel agents in git worktrees
cost_route — get model-tier recommendation for a task
session_analyze — analyze session transcripts

+10 more.

---

**Tweet 4/8**
377 resources means every agent, skill, and command is directly addressable as an MCP resource.

Your LangGraph workflow can reference kodelyth://agents/debug-detective and get the full agent spec.

Your AutoGen setup can load kodelyth://skills/tdd-guide dynamically.

---

**Tweet 5/8**
The 6 system prompts:

- Intent routing setup
- Memory protocol
- Security analysis
- Code architecture
- Testing strategy
- Incident response

Pre-built, battle-tested system prompts you can load into any AI agent without writing them yourself.

---

**Tweet 6/8**
Localhost only. No external network access.

The MCP server listens on stdio or a configurable port. Never exposes anything to the internet. All operations are read-only from disk (except writing to tasks/lessons.md when you ask it to).

No API key. No account. Runs entirely on your machine.

---

**Tweet 7/8**
The dashboard (npx kodelyth-ecc dashboard) complements the MCP server:

5 tabs: Overview · Memory · Evolve · Catalog · Sessions

Browse all 70 agents and 194 skills in a browser UI.
View and manage your memory store.
See session transcripts and token usage.

Also localhost only. Also free.

---

**Tweet 8/8**
Kodelyth ECC. Free. MIT. No account.

npx kodelyth-ecc
npx kodelyth-ecc mcp
npx kodelyth-ecc dashboard

70 agents. 16 MCP tools. 377 resources.
11 platforms. 0 cloud.

github.com/sifxprime/kodelyth-ecc

[attach: social/hype-mcp-server.svg]

---
---

## THREAD 5 — The Full Pitch: What ECC Actually Is
**Theme:** The complete picture for someone who has never heard of it
**Image:** social/hype-stats-hero.svg

---

**Tweet 1/8**
Most "AI agent kits" are folders of markdown files you have to memorize.

Kodelyth ECC is different. It has semantic intent routing baked into the rules layer.

You describe your problem in plain words. The AI announces which specialist takes over. You get senior-grade help.

🧵 What ECC actually is

---

**Tweet 2/8**
The numbers:

70 specialist agents (including 8 adversarial)
194 skills
97 slash commands (8 parallel multi-agent)
22+ automation hooks
14 always-on rules
11 platforms, 13 install targets
373 passing tests

One install. npx kodelyth-ecc

---

**Tweet 3/8**
The semantic routing system is the core feature.

It reads intent, not keywords:

"this thing is broken" → debug-detective
"I have no idea where to start" → kodelyth-advisor
"production is throwing 500s" → incident-commander
[paste code, no text] → code-reviewer
[paste stack trace, no text] → debug-detective

You never type an agent name unless you want to.

---

**Tweet 4/8**
The 11 platforms:

Claude Code (full: 70 agents, 194 skills, 97 commands, 22+ hooks)
Windsurf · Cursor · Codex CLI · Cline · Roo Code
Aider · Kimi · Gemini CLI · Antigravity · OpenCode

Feature depth varies by platform. Full power on Claude Code.
Agents + skills + rules on most others.

---

**Tweet 5/8**
The specialist agent catalog is deep:

debug-detective — evidence-first root cause
incident-commander — P0/P1 production triage
load-tester — k6, Locust, capacity planning
image-architect — Gemini/DALL-E/fal.ai/SVG generation
kodelyth-memory — local BM25 self-learning
migration-guide — framework version upgrades
release-captain — semver, tagging, rollback plan

...and 63 more.

---

**Tweet 6/8**
The compound learning system means you configure it once:

Tell it "use pnpm" once → it never uses npm again.
Tell it "no comments on trivial lines" once → it learns your style.
Month 3: it works like someone who has been on your team for years.

Entirely local. Zero cloud.

---

**Tweet 7/8**
What you get at install:

~/.claude/agents/ — 70 specialist agent files
~/.claude/commands/ — 97 slash commands
~/.claude/skills/ — 194 skill files
~/.claude/hooks/ — 22+ automation hooks
~/.claude/rules/ — 14 always-on rules

All editable. All yours. No lock-in. MIT license.

---

**Tweet 8/8**
Kodelyth ECC. Free. MIT. No account. No API key. No telemetry.

npx kodelyth-ecc

That's the entire install.

github.com/sifxprime/kodelyth-ecc

[attach: social/hype-stats-hero.svg]

---
---

## STANDALONE HOOK TWEETS (5)

---

**Hook 1 — Devil Mode**
Your AI reviewed your code.

An attacker is about to review it too.

/devil-mode fires 8 adversarial agents that read code the way an attacker does. Prompt injection. Supply chain. Secrets. Backdoors. Jailbreaks. All parallel. 8 minutes.

npx kodelyth-ecc
github.com/sifxprime/kodelyth-ecc

[attach: social/hype-devil-mode.svg]

---

**Hook 2 — Speed**
You've been doing code reviews wrong.

Sequentially: code quality → security → performance → API contracts. 60 minutes.

/team-review fires all 4 specialists simultaneously. 15 minutes. Same depth.

70 agents. 8 parallel commands. Free forever.

npx kodelyth-ecc

[attach: social/hype-parallel-agents.svg]

---

**Hook 3 — Compound Learning**
You corrected your AI assistant once: "use pnpm not npm."

It forgot by the next session.

Kodelyth ECC encodes every correction to disk. Next session, it injects that rule before your first message.

Month 3: it works like someone who has been on your team for years.

npx kodelyth-ecc — free, local, no cloud.

[attach: social/hype-compound-learning.svg]

---

**Hook 4 — Stats**
70 specialist agents.
194 skills.
97 slash commands.
22+ automation hooks.
11 platforms.
373 passing tests.
0 cloud.

One install: npx kodelyth-ecc

MIT. No account. No API key. No telemetry.

github.com/sifxprime/kodelyth-ecc

[attach: social/hype-stats-hero.svg]

---

**Hook 5 — MCP**
npx kodelyth-ecc mcp

That starts an MCP server with 16 tools, 6 system prompts, and 377 resources.

Connect Claude Desktop. LangGraph. AutoGen. CrewAI. OpenAI Agents SDK.

Localhost only. No API key. Free forever.

github.com/sifxprime/kodelyth-ecc

[attach: social/hype-mcp-server.svg]
