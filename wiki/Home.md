# Kodelyth ECC Wiki

**Kodelyth Enhanced Coding Companion** — production-grade AI coding toolkit for Claude Code, Windsurf, Cursor, Codex CLI, Google Antigravity, and more.

> Version: **v1.8.0** · Agents: **70** (including 8 adversarial) · Skills: **194** · Commands: **97** (including 8 parallel) · Hooks: **22+** · Platforms: **11** · Tests: **348**

---

## What is ECC?

Most "AI agent kits" are folders of markdown files you have to remember the names of. ECC has **semantic intent routing** baked into the rules layer — you describe your problem in plain words, the AI announces which specialist is taking over, and you get senior-grade help without memorizing a directory.

```
You:   "I've been staring at this NullPointerException for hours, nothing works."

AI:    → Routing to debug-detective (error + frustration signals match bug-tracking)

       Let's trace it properly. Share the full stack trace and tell me what changed
       last — we'll find the root cause, not patch the symptom.
```

You never typed `use debug-detective`. You never had to.

---

## Quick Install

```bash
# Any platform — Node.js 18+ required
npx kodelyth-ecc

# Specific targets
npx kodelyth-ecc --target windsurf-project
npx kodelyth-ecc --target antigravity
npx kodelyth-ecc --target cursor-project

# Power bundles
npx kodelyth-ecc --bundle indie-hacker
npx kodelyth-ecc --bundle red-team
npx kodelyth-ecc --bundle enterprise
```

After install, type `/kodelyth-quickstart` in your AI tool to begin.

---

## What Gets Installed

| Component | Count | Description |
|---|---|---|
| Agents | **70** | Specialist subagents (62 standard + 8 adversarial devil-mode agents) |
| Skills | **194** | Domain knowledge — patterns, testing, security, DevOps, memory, swarm orchestration |
| Commands | **97** | Slash workflows (88 base + 8 parallel multi-agent + `/devil-mode` + utilities) |
| Hooks | **20+** | Quality gates, memory inject + capture, correction encoding, safety guards |
| Rules | **14** | Always-on standards, semantic routing, memory protocol, self-improvement |

---

## Key Features (v1.8.0)

### Semantic Intent Routing

The AI reads **intent behind words**, not just keywords. It reasons about emotion, context, and even what you paste.

| What you write | Auto-routed to |
|---|---|
| "I'm stuck, no idea where to start" | `kodelyth-advisor` |
| "nothing works, driving me crazy" | `debug-detective` |
| "help me build a todo app" | `/project-launch` |
| "review my code before I deploy" | `/team-review` |
| "my site looks plain, needs visuals" | `image-architect` |
| "remember we always use pnpm" | `/lessons` |
| [paste code with no text] | `code-reviewer` |
| [paste stack trace with no text] | `debug-detective` |
| "Build failed on Vercel" | `build-error-resolver` |
| "production is down, 500s everywhere" | `incident-commander` |
| "Find vulnerabilities in my code" | `/devil-mode` |

### Parallel Commands (8 total)

Fire multiple specialist agents at once and get results in 10-15 minutes instead of 45-60:

| Command | Agents fired | Time saving |
|---|---|---|
| `/project-launch` | architect + pair-programmer + security-reviewer + tdd-guide + ux-reviewer | 45 min → 10 min |
| `/team-review` | code-reviewer + security-reviewer + performance-optimizer + api-guardian | 60 min → 15 min |
| `/security-audit` | security-reviewer + dependency-doctor + api-guardian | 30 min → 8 min |
| `/debug-blitz` | debug-detective + silent-failure-hunter + env-debugger | 30 min → 8 min |
| `/refactor-sprint` | refactor-cleaner + code-simplifier + type-design-analyzer + tdd-guide | 45 min → 12 min |
| `/pre-release` | release-captain + security-reviewer + code-reviewer | 30 min → 8 min |
| `/onboard` | code-explorer + architect + doc-updater | 45 min → 10 min |
| `/devil-mode` | prompt-injection-hunter + supply-chain-auditor + secret-hunter + license-violation-finder (or all 8 with `--all`) | 60 min → 15 min |

### Adversarial Devil-Mode Agents (v1.7.0)

Dedicated red-team mode fires 4-8 specialized adversarial agents to find vulnerabilities your team missed:

```bash
/devil-mode                 # Fires top 4: injection, supply chain, secrets, license
/devil-mode --all          # Fires all 8 (adds: jailbreak, code theft, backdoors, chaos)
```

The 8 devil-mode agents:
- `prompt-injection-hunter` — Find AI injection vulnerabilities
- `supply-chain-auditor` — Audit dependencies and build artifacts
- `secret-hunter` — Hunt hardcoded secrets and API keys
- `license-violation-finder` — Detect GPL/license compliance issues
- `jailbreak-tester` — Test safety bypass attempts
- `code-stealer-detector` — Find exfiltration vectors
- `backdoor-hunter` — Identify inserted vulnerabilities
- `chaos-engineer` — Failure mode and edge case analysis

### MCP Server & Local Tooling

```bash
# Start the MCP server (16 tools, 6 prompts, 370+ resources)
npx kodelyth-ecc mcp

# Launch the local dashboard (5 tabs: Overview, Memory, Evolve, Catalog, Sessions)
npx kodelyth-ecc dashboard

# Cost-aware model routing
npx kodelyth-ecc route "<task>"

# Swarm orchestrator for parallel work
npx kodelyth-ecc swarm --task "..."

# Self-evolving memory system
npx kodelyth-ecc evolve analyze

# Session replay
npx kodelyth-ecc replay <bundle>

# SLSA L3 + SBOM verification
npx kodelyth-ecc sbom
npx kodelyth-ecc manifest
npx kodelyth-ecc verify
```

### Compound Learning System

Every correction you give Claude gets encoded permanently. The toolkit gets smarter every session.

```
Session 1:  You say "use pnpm not npm"
            → capture-correction.js writes to tasks/lessons.md

Session 2:  read-lessons.js fires at session start
            → "PROJECT LESSONS — use pnpm not npm" injected
            → Claude uses pnpm without being told

Month 3:    You try another tool. It uses pnpm. You praise the consistency.
```

**Three layers working together:**

| Layer | File | Scope |
|---|---|---|
| Project Lessons | `tasks/lessons.md` | Per-project hard rules from your corrections |
| Global Memory | `~/.kodelyth/memory/` | Cross-project BM25 recall of past solutions |
| Semantic Routing | 70 agents | Routes every message to the right specialist |

---

## Platform Support (11 platforms, 13 install targets)

Kodelyth ECC installs on 11 AI coding platforms. Feature depth varies — hooks are a Claude Code native format with no equivalent on other platforms, and Cursor's agent system uses a different format:

| Platform | Agents | Skills | Commands | Hooks | Rules |
|---|---|---|---|---|---|
| Claude Code | ✓ 70 | ✓ 194 | ✓ 97 | ✓ 22+ | ✓ |
| Roo Code | ✓ | ✓ | ✓ | — | ✓ |
| Codex CLI | ✓ | ✓ | ✓ | — | ✓ |
| Aider | ✓ | ✓ | ✓ | — | ✓ |
| Kimi | ✓ | ✓ | ✓ | — | ✓ |
| Windsurf | ✓ | ✓ | — | — | ✓ |
| Antigravity | ✓ | partial | ✓ | — | ✓ |
| Gemini CLI | ✓ | ✓ | — | — | ✓ |
| Cursor | — | ✓ | — | — | ✓ |
| Cline | ✓ | — | ✓ | — | ✓ |
| OpenCode | — | — | — | — | ✓ |

---

## Wiki Pages

- [Installation Guide](Installation-Guide) — all install methods, targets, profiles, bundles, OS support
- [Agent Reference](Agent-Reference) — all 70 agents including 8 adversarial devil-mode agents
- [Skill Reference](Skill-Reference) — all 194 skills including MCP, swarm, dashboard, and safety hooks
- [Hook Reference](Hook-Reference) — all 22+ hooks and how they work
- [Platform Support](Platform-Support) — per-platform capabilities for 11 platforms
- [FAQ](FAQ) — memory, MCP server, dashboard, devil-mode, swarm, SLSA/SBOM, privacy, troubleshooting

---

## Version History

| Version | Headline |
|---|---|
| **v1.8.0** | Real-time IDE-aware dashboard (Claude Code + Windsurf + Windsurf-Next + Cursor + Antigravity), cross-IDE memory protocol via MCP tools, `KODELYTH_EXTRA_IDE_WATCH` env var, 3 s SSE realtime, 373 tests |
| **v1.7.3** | Social hype pack (5 X/Twitter SVGs + 5 thread scripts), full SVG version sync, GitHub issue templates, repo polish |
| **v1.7.0** | Adversarial devil-mode (8 agents), MCP server, local dashboard, swarm orchestrator, cost-aware routing, self-evolving memory, SLSA L3 + SBOM, 11 platforms, 194 skills |
| **v1.6.0** | 8 adversarial devil-mode agents, power bundles, 6 new IDE platform targets, 97 commands |
| **v1.5.3** | Semantic intent routing — intent not keywords, code/trace paste detection, 62 agents, 188 skills |
| **v1.5.2** | Parallel agents, `image-architect`, `/project-launch`, `/team-review`, `/lessons` |
| **v1.5.1** | Compound learning — `capture-correction.js`, `read-lessons.js`, self-improvement workflow |
| **v1.5.0** | `incident-commander`, `load-tester`, visual refresh, wiki rewrite |
| **v1.4.1** | Auto chat recall — `UserPromptSubmit` hook injects memories before AI responds |
| **v1.4.0** | `kodelyth-memory` — local BM25 self-learning. Zero cloud. |
| **v1.3.0** | God-tier intent routing rule. 5 new exclusive agents. |

---

**Repository:** [github.com/sifxprime/kodelyth-ecc](https://github.com/sifxprime/kodelyth-ecc) · **npm:** [npmjs.com/package/kodelyth-ecc](https://www.npmjs.com/package/kodelyth-ecc) · **License:** MIT
