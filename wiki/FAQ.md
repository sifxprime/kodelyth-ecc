# FAQ

---

## General

**What is Kodelyth ECC?**

An AI coding toolkit (v1.8.0) that installs into 11 AI coding platforms (13 install targets). It adds 70 specialist agents (including 8 adversarial devil-mode agents), 194 skills, 97 slash commands, 20+ automation hooks, and a compound learning system. Zero cloud, zero telemetry, all local.

**Is it free?**

Yes. MIT license. No API keys, no subscriptions, no account, no telemetry. It is files on your disk.

**Does it send any data anywhere?**

No. Everything is local:
- Memory lives in `~/.kodelyth/memory/memories.jsonl`
- Lessons live in `tasks/lessons.md` in your project
- Token logs live in `~/.claude/logs/token-usage.jsonl`
- MCP server runs on localhost only

Nothing is transmitted to any server.

**What Node.js version do I need?**

Node.js 18 or higher.

**What platforms does ECC support?**

11 platforms (13 install targets): Claude Code, Windsurf (project/home), Cursor, Google Antigravity, Codex CLI, OpenCode, Cline, Roo Code, Aider, Kimi, Gemini CLI (project/home). Feature depth varies — see the platform support table in the README for what each platform gets.

---

## Memory System

**What is Kodelyth Memory?**

A local BM25 search store at `~/.kodelyth/memory/memories.jsonl`. It captures problem-solving patterns from your sessions and recalls relevant ones automatically before the AI responds. No embeddings, no cloud.

**How does memory get added?**

At session end, the `memory-capture.js` Stop hook scans the session for successful problem-solving patterns and queues candidates for your review. You review with `/memory review-pending`. Nothing is stored without your confirmation.

**How is memory recalled?**

The `auto-recall.js` UserPromptSubmit hook runs BM25 search on every message you type. If relevant past solutions exist, they are injected before the AI responds. The same memory is never shown twice in one session.

**Can I delete a memory?**

Yes. Edit `~/.kodelyth/memory/memories.jsonl` directly — it is plain JSONL. Or use `/memory delete <id>`.

**What is self-evolving memory?**

Memory in v1.7.0 now evolves. Run `npx kodelyth-ecc evolve analyze` to scan memory for patterns, extract meta-insights, and surface high-impact solutions. Memories can be tagged by domain, and the system learns which solutions get reused most often.

**What is the difference between memory and lessons?**

| | Memory | Lessons |
|---|---|---|
| Location | `~/.kodelyth/memory/` | `tasks/lessons.md` |
| Scope | Cross-project | Per-project |
| Format | JSONL, structured | Markdown, human-readable |
| Content | Past solutions, patterns | Hard rules from your corrections |
| Injected | Per-prompt (BM25 match) | Session start (always) |
| Evolves | Yes (v1.7.0+) | Manual edit |

---

## Compound Learning

**What is the compound learning system?**

Three layers that make Claude increasingly match your style:

1. **Project Lessons** — corrections you give Claude are encoded as hard rules in `tasks/lessons.md` and applied every session
2. **Global Memory** — past solutions recalled cross-project, auto-evolving
3. **Semantic Routing** — 70 specialists routing from intent

**How do lessons get written?**

The `capture-correction.js` Stop hook scans the session for correction signals ("no don't", "use X instead", "we always", etc.), extracts the rule, and appends it to `tasks/lessons.md`. Runs async at session end with zero latency impact.

**How do lessons get applied?**

The `read-lessons.js` SessionStart hook reads `tasks/lessons.md` and injects all rules as `PROJECT LESSONS — HARD RULES` context before your first message. This is Claude Code only — on other platforms, run `/lessons` at the start of each session.

**Can I edit lessons manually?**

Yes. `tasks/lessons.md` is plain Markdown. Add, edit, or delete rules freely. They are yours.

---

## MCP Server (v1.7.0)

**What is the Kodelyth ECC MCP server?**

A Model Context Protocol server that exposes 16 tools, 6 prompts, and 370+ resources. Run `npx kodelyth-ecc mcp` to start the server locally on a configurable port.

**What tools does it provide?**

16 tools covering agent invocation, memory management, skill loading, command execution, swarm orchestration, cost routing, and session analysis.

**What prompts are available?**

6 system prompts for common workflows: intent routing setup, memory protocol, security analysis, code architecture, testing strategy, and incident response.

**How do I configure the MCP server?**

```bash
npx kodelyth-ecc mcp --port 3000
npx kodelyth-ecc mcp --config ~/.kodelyth/mcp.json
```

Can also set `MCP_PORT` environment variable.

**Is the MCP server secure?**

Yes. Listens on localhost only. No external network access. All operations are read-only from disk unless explicitly writing to `tasks/lessons.md` or memory files.

---

## Local Dashboard (v1.7.0)

**What is the Kodelyth dashboard?**

A local web-based dashboard running on localhost. No analytics, no external calls. Five tabs: Overview, Memory, Evolve, Catalog, Sessions.

**How do I launch it?**

```bash
npx kodelyth-ecc dashboard
```

Opens automatically at `http://localhost:5173` (or your configured port).

**What can I do on each tab?**

- **Overview** — Agent counts, installed components, config status
- **Memory** — View, search, tag, and delete stored memories
- **Evolve** — Analyze memory for patterns, surface high-impact solutions
- **Catalog** — Browse all 70 agents and 194 skills with descriptions
- **Sessions** — Replay session transcripts, see token usage, review lessons captured

---

## Devil-Mode Agents (v1.7.0)

**What is devil-mode?**

Dedicated red-team mode that fires 4-8 adversarial agents to stress-test your code from an attacker's perspective. Find vulnerabilities before bad actors do.

**How do I invoke it?**

```bash
/devil-mode                 # Top 4: injection, supply chain, secrets, license
/devil-mode --all          # All 8: adds jailbreak, theft, backdoors, chaos
```

**What are the 8 agents?**

1. `prompt-injection-hunter` — AI injection vectors
2. `supply-chain-auditor` — Dependency and artifact vulnerabilities
3. `secret-hunter` — Hardcoded credentials
4. `license-violation-finder` — GPL and license issues
5. `jailbreak-tester` — Safety bypass testing
6. `code-stealer-detector` — Exfiltration vectors
7. `backdoor-hunter` — Inserted vulnerabilities
8. `chaos-engineer` — Failure mode analysis

**Is devil-mode destructive?**

No. It analyzes code and reports findings. It does not modify anything or access external systems. Results are advisory — you decide what to fix.

---

## Swarm Orchestrator (v1.7.0)

**What is the swarm orchestrator?**

A system for running multiple agents in parallel on complex tasks. Agents communicate their findings and coordinate work distribution.

**How do I use it?**

```bash
npx kodelyth-ecc swarm --task "audit my codebase for security + performance issues"
```

Also available as the `/swarm-orchestrator` skill.

**How is it different from parallel commands?**

Parallel commands fire fixed teams (e.g., `/team-review` always fires the same 4 agents). Swarm takes a free-form task, analyzes it, and dynamically selects the best agent team and sequencing.

---

## Cost-Aware Routing (v1.7.0)

**What is cost-aware routing?**

A router that matches your task to the right model tier (Haiku 4.5 for trivial work, Sonnet 4.6 for standard coding, Opus 4.6 for hard architecture).

**How do I use it?**

```bash
npx kodelyth-ecc route "write a React component"
# Suggests: Haiku 4.5 (fast, cheap, capable for components)

npx kodelyth-ecc route "architecture a distributed payment system"
# Suggests: Opus 4.6 (deep reasoning, long-term trade-offs)
```

**Does it help save money?**

Yes. Most coding work runs fine on Sonnet (and often Haiku). The router prevents overspending on Opus for trivial tasks.

---

## SLSA L3 + SBOM (v1.7.0)

**What is SLSA L3 support?**

Software Artifact Signing Level 3 — ECC can generate and verify supply chain artifacts with cryptographic signatures.

**How do I generate SBOM?**

```bash
npx kodelyth-ecc sbom
```

Generates Software Bill of Materials in SPDX format.

**How do I create the manifest?**

```bash
npx kodelyth-ecc manifest
```

Creates a content manifest with file hashes and timestamps.

**How do I verify integrity?**

```bash
npx kodelyth-ecc verify
```

Verifies SBOM, manifest, and signatures. Reports any tampering or missing artifacts.

---

## Agents

**Do I need to type agent names?**

No. Semantic intent routing detects what you need from how you describe the problem. You never need to type `use debug-detective` — just describe the bug.

**What are the 70 agents?**

62 standard specialist agents (reviewers, debuggers, architects, etc.) + 8 adversarial devil-mode agents (injection hunter, supply chain auditor, secret hunter, etc.).

**How do I invoke an agent explicitly?**

```
use debug-detective
@code-reviewer
invoke security-reviewer
```

All three forms work.

**Can I create my own agents?**

Yes. Create `agents/<name>.md` with YAML frontmatter (name, description, tools). Add trigger patterns to `rules/common/agent-intent-routing.md` so the router knows when to call it. See [CONTRIBUTING.md](https://github.com/sifxprime/kodelyth-ecc/blob/main/CONTRIBUTING.md) for the template.

---

## Hooks

**Hooks only work on Claude Code?**

Yes. Hooks use the Claude Code hook system (`~/.claude/settings.json`). On other platforms, the equivalent quality checks must be set up manually or run via CI.

**How do I disable a specific hook?**

```bash
export ECC_DISABLED_HOOKS=kodelyth:prompt:recall,kodelyth:post-edit:test-reminder
```

**Will hooks slow down my session?**

No. All hooks are async with aggressive timeouts. They fire in the background and never block tool execution. The secret scanner and quality gate both complete in under 5 seconds.

**What does the secret scanner catch?**

API keys (OpenAI, Anthropic, AWS, GCP, Stripe, etc.), passwords and tokens in code, private keys (RSA, EC), and `.env` files accidentally staged. It blocks the commit and reports the exact line.

**Are there safety hooks?**

Yes. v1.7.0 adds:
- `prompt-injection-guard` — Detects attempted prompt injection in inputs
- `token-budget-enforcer` — Warns when approaching token limit per session

---

## Costs

**Does ECC increase my Claude API costs?**

Slightly, because hooks inject context at session start (memory and lessons). The memory block uses a cache-friendly structure — the stable prefix sits in Anthropic's prompt cache at 10% of normal token cost. For most users the net cost impact is negligible.

**How do I track costs?**

The `cost-tracker` Stop hook logs token usage to `~/.claude/logs/token-usage.jsonl`.

```bash
# Top 10 most expensive sessions
cat ~/.claude/logs/token-usage.jsonl | jq -s 'sort_by(.tokens) | reverse | .[0:10]'
```

**How do I reduce costs?**

1. Disable hooks you don't use: `export ECC_DISABLED_HOOKS=...`
2. Keep `tasks/lessons.md` concise — long lesson files inject more tokens every session
3. Use `/compact` (Claude Code) before large sessions to summarize context
4. Use `npx kodelyth-ecc route` to match model to task
5. Review memory periodically — delete old or obsolete solutions

---

## Privacy

**Does ECC phone home?**

Never. No telemetry, no analytics, no usage reporting of any kind. The MCP server runs on localhost only.

**Where is my data stored?**

Entirely on your machine:
- `~/.kodelyth/memory/` — memory store
- `tasks/lessons.md` — project lessons
- `~/.claude/logs/` — token usage logs
- `~/.claude/settings.json` — hook configuration

**Can I use ECC in an air-gapped environment?**

Yes. After install, ECC requires no internet access. The AI models themselves (Claude API, Gemini, etc.) still require connectivity — that is your AI tool, not ECC.

**Is memory encrypted?**

Memory files are plain text JSONL. For security-sensitive projects, you can encrypt `~/.kodelyth/memory/` and `tasks/lessons.md` with your OS or disk encryption. ECC has no built-in encryption (by design — simpler, more transparent).

---

## Troubleshooting

**Agents are not routing automatically**

The routing rule at `rules/common/agent-intent-routing.md` must be installed and loaded. Verify:
```bash
ls ~/.claude/rules/common/agent-intent-routing.md
```
Restart your Claude Code session after confirming the file exists.

**`/lessons` says "no lessons found"**

`tasks/lessons.md` does not exist yet in the project root. It gets created automatically after the first session where you correct Claude. Or create it manually:
```bash
echo "# Project Lessons" > tasks/lessons.md
```

**Memory is not being recalled**

Check that `hooks/memory/auto-recall.js` is running. Verify in `~/.claude/settings.json` that the UserPromptSubmit hook is wired. Re-run `npx kodelyth-ecc` to repair.

**image-architect says it cannot generate images**

On Claude Code, `image-architect` requires the fal.ai MCP server to be configured. If not available, it falls back to SVG generation. On Antigravity and Codex CLI, image generation is native and requires no configuration.

**MCP server fails to start**

Check that the port is not in use:
```bash
lsof -i :5173
# Kill if needed: kill -9 <PID>
npx kodelyth-ecc mcp --port 5174  # Use a different port
```

**Dashboard shows no sessions**

Sessions are recorded when hooks are active (Claude Code only). On other platforms, run `/sessions` in your AI tool to see local session metadata.

**devil-mode returns no findings**

This is normal — not all code has vulnerabilities. devil-mode ran cleanly. If you suspect it should have found issues, try `/devil-mode --all` to run all 8 agents (slower but more thorough).

---

## Getting Help

- GitHub Issues: [github.com/sifxprime/kodelyth-ecc/issues](https://github.com/sifxprime/kodelyth-ecc/issues)
- Start a session and type `/kodelyth-quickstart` for an interactive tour
- Type "I'm lost" or "I don't know where to start" — the `kodelyth-advisor` agent will orient you
- For MCP server help: `npx kodelyth-ecc mcp --help`
- For dashboard help: `npx kodelyth-ecc dashboard --help`
