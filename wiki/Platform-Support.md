# Platform Support

Kodelyth ECC installs on 11 AI coding platforms via 13 install targets. Feature depth varies — hooks use Claude Code's native settings format and have no equivalent elsewhere; Cursor's agent system is incompatible with ECC's markdown agent format.

---

## Capability Matrix

| Feature | Claude Code | Roo Code | Codex CLI | Aider | Kimi | Windsurf | Antigravity | Gemini CLI | Cursor | Cline | OpenCode |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 70 Agents | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓* | — |
| 194 Skills | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | partial | ✓ | ✓ | — | — |
| 97 Commands | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | ✓* | — |
| 22+ Hooks | ✓ | — | — | — | — | — | — | — | — | — | — |
| Rules | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auto lessons | ✓ | — | — | — | — | — | — | — | — | — | — |
| Manual `/lessons` | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

\* Cline flattens agents and commands into `.clinerules/` as markdown rules — they provide context but not structured invocation.

**Hooks** require Claude Code's JSON hook system (`~/.claude/settings.json`). No other platform has an equivalent.

**MCP Server** and **Dashboard** (`npx kodelyth-ecc mcp` / `npx kodelyth-ecc dashboard`) are standalone CLI tools that work on every platform.

---

## Claude Code

Full feature set. All hooks auto-wired. Memory injected automatically at session start.

**Install:**
```bash
npx kodelyth-ecc
```

**File layout:**
```
~/.claude/
├── agents/          → 70 specialist agents
├── skills/          → 194 skills
├── commands/        → 97 slash commands
├── rules/           → always-on coding standards + routing
└── hooks/           → hooks.json (wired into settings.json)
```

**Hooks active:**
- Session start: `read-lessons.js` + memory inject
- Every prompt: auto-recall (BM25 search)
- After edits: quality-gate + test-reminder
- Before commit: secret-scan + console-check
- Before push: branch-check
- Session end: capture-correction + memory-capture + cost-tracker

**Safety hooks (v1.7.0):**
- `prompt-injection-guard` — blocks prompt injection attempts
- `token-budget-enforcer` — warns when approaching token limit

---

## Roo Code

Agents, skills, and commands. No hooks.

**Install:**
```bash
npx kodelyth-ecc --target roocode
```

**File layout:**
```
.roo/
├── agents/
├── skills/
├── commands/
└── rules/
```

**Lessons (manual):** Run `/lessons` at session start to load `tasks/lessons.md`.

---

## Codex CLI

Agents, skills, and commands. `image-architect` uses DALL-E 3 natively.

**Install:**
```bash
npx kodelyth-ecc --target codex-home
```

**File layout:**
```
~/.codex/
├── agents/
├── skills/
├── commands/
└── rules/
```

**Image generation:** `image-architect` routes to DALL-E 3 automatically on Codex CLI (no API key required).

---

## Aider

Agents, skills, and commands. `CONVENTIONS.md` auto-generated at project root.

**Install:**
```bash
npx kodelyth-ecc --target aider
```

**File layout:**
```
.aider-ecc/
├── agents/
├── skills/
├── commands/
└── rules/
CONVENTIONS.md     → auto-generated, points aider at .aider-ecc/
```

**Usage:**
```bash
aider --read .aider-ecc/rules/agent-intent-routing.md \
      --read .aider-ecc/agents/debug-detective.md
```

---

## Kimi

Agents, skills, and commands.

**Install:**
```bash
npx kodelyth-ecc --target kimi
```

**File layout:**
```
.kimi/
├── agents/
├── skills/
├── commands/
└── rules/
```

---

## Windsurf

Agents, skills, and rules. No commands (Windsurf workflows use a different format). A `.windsurfrules` file is generated from the common rules.

**Install (project):**
```bash
npx kodelyth-ecc --target windsurf-project
```

**Install (global):**
```bash
npx kodelyth-ecc --target windsurf-home
```

**File layout:**
```
.windsurf/
├── agents/
├── skills/
└── rules/
.windsurfrules     → auto-generated from common rules
```

---

## Antigravity

Agents (installed as `.agent/skills/`), commands (as `.agent/workflows/`), rules. Four core ECC skills are copied into rules as always-on context. The full 194-skill directory is not installed (Antigravity has no separate skills system).

**Install:**
```bash
npx kodelyth-ecc --target antigravity
```

**File layout:**
```
.agent/
├── skills/          → 70 agents (mapped to Antigravity's skills system)
├── workflows/       → 97 commands (mapped to Antigravity's workflows)
└── rules/           → rules + 4 featured ECC skills as context
```

**Image generation:** `image-architect` routes to Gemini Imagen 3 natively.

---

## Gemini CLI

Agents, skills, and rules. No commands. A `GEMINI.md` is generated pointing to the installed content.

**Install (project):**
```bash
npx kodelyth-ecc --target gemini-project
```

**Install (global):**
```bash
npx kodelyth-ecc --target gemini-home
```

**File layout:**
```
.gemini/
├── agents/
├── skills/
├── rules/
└── GEMINI.md        → auto-generated context file
```

---

## Cursor

Rules and skills only. Cursor's agent system uses a different YAML format that is not compatible with ECC's markdown agents.

**Install:**
```bash
npx kodelyth-ecc --target cursor-project
```

**File layout:**
```
.cursor/
├── skills/
└── rules/           → flattened from all rule directories
```

---

## Cline

Rules, agents, and commands all flattened into `.clinerules/` as markdown context files. No separate skills directory.

**Install:**
```bash
npx kodelyth-ecc --target cline
```

**File layout:**
```
.clinerules/
├── (all rule .md files)
├── (all agent .md files — flattened)
└── (all command .md files — flattened)
```

Cline reads everything in `.clinerules/` as persistent context, so agents and commands are available as reference material even though they aren't structured invocations.

---

## OpenCode

Rules only. OpenCode has no agent or skill directory concept.

**Install:**
```bash
npx kodelyth-ecc --target opencode
```

**File layout:**
```
.opencode/
└── rules/           → flattened from all rule directories
```

---

## Lessons on Non-Claude-Code Platforms

On all platforms except Claude Code, load project lessons manually at session start:

```
/lessons
```

This reads `tasks/lessons.md` and activates all project rules for the session. On Claude Code, this happens automatically via the `read-lessons.js` SessionStart hook.

---

## image-architect Platform Routing

| Platform | Image model |
|---|---|
| Antigravity | Gemini Imagen 3 (native, no key) |
| Codex CLI | DALL-E 3 (native, no key) |
| Claude Code | fal.ai MCP → SVG fallback |
| Windsurf / Cursor | native model gen → fal.ai → SVG fallback |
| Others | SVG fallback |

---

## OS Support

| OS | Supported | Install method |
|---|---|---|
| macOS | ✓ | `npx` or `./install.sh` |
| Linux | ✓ | `npx` or `./install.sh` |
| Windows | ✓ | `npx` or `.\install.ps1` |

The `desktop-notify` hook (macOS system notification) is macOS-only and silently skips on other platforms.

---

## Choosing a Platform

| Workflow | Best platform |
|---|---|
| Maximum feature set | Claude Code |
| Git-native automation | Aider |
| VS Code + Cline extension | Cline or Roo Code |
| OpenAI stack | Codex CLI |
| Deep reasoning, complex architecture | Antigravity |
| Windsurf IDE | Windsurf |
| Gemini stack | Gemini CLI |
