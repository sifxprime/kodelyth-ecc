# Installation Guide

---

## Requirements

- Node.js 18 or higher
- npm, pnpm, yarn, or bun

---

## One-Command Install (Recommended)

```bash
npx kodelyth-ecc
```

This detects your project type, installs the right component set, and wires everything together.

---

## Targets (11 platforms, 13 install targets)

Install into a specific AI tool:

```bash
# Claude Code (default)
npx kodelyth-ecc

# Windsurf
npx kodelyth-ecc --target windsurf-project
npx kodelyth-ecc --target windsurf-home

# Cursor
npx kodelyth-ecc --target cursor-project

# Codex CLI
npx kodelyth-ecc --target codex-home

# Google Antigravity
npx kodelyth-ecc --target antigravity

# OpenCode
npx kodelyth-ecc --target opencode

# Cline (VS Code extension)
npx kodelyth-ecc --target cline

# Roocode (web IDE)
npx kodelyth-ecc --target roocode

# Aider (git-native)
npx kodelyth-ecc --target aider

# Kimi (Chinese platform)
npx kodelyth-ecc --target kimi

# Gemini
npx kodelyth-ecc --target gemini-project
npx kodelyth-ecc --target gemini-home
```

---

## Power Bundles (v1.7.0)

Pre-configured agent + skill bundles for specific use cases:

```bash
# Indie hacker — web dev, rapid prototyping, solopreneur
npx kodelyth-ecc --bundle indie-hacker

# Red team — security audits, adversarial testing, pentesting
npx kodelyth-ecc --bundle red-team

# Enterprise — compliance, supply chain, SLA tracking, incident management
npx kodelyth-ecc --bundle enterprise
```

Each bundle installs only the agents and skills relevant to that workflow.

---

## What Gets Installed

| Component | Count | Location |
|---|---|---|
| Agents | 70 | `~/.claude/agents/` (Claude Code) or project-local |
| Skills | 194 | `~/.claude/skills/` or project-local |
| Commands | 97 | `~/.claude/commands/` or project-local |
| Hooks | 20+ | `~/.claude/settings.json` (Claude Code only) |
| Rules | 14 | `~/.claude/rules/` or project-local |

---

## Profiles

Install only what your stack needs:

```bash
# Minimal — core agents + routing only
npx kodelyth-ecc --profile minimal

# Standard — agents + skills + hooks (default)
npx kodelyth-ecc --profile standard

# Full — everything including all language skill sets
npx kodelyth-ecc --profile full
```

---

## Language Skill Packs

Install language-specific skill sets alongside the base install:

```bash
npx kodelyth-ecc --skills typescript
npx kodelyth-ecc --skills python
npx kodelyth-ecc --skills golang
npx kodelyth-ecc --skills rust
npx kodelyth-ecc --skills java
npx kodelyth-ecc --skills swift
npx kodelyth-ecc --skills kotlin
```

Multiple packs at once:

```bash
npx kodelyth-ecc --skills typescript,python
```

---

## Manual Install (Without npx)

### 1. Clone the repository

```bash
git clone https://github.com/sifxprime/kodelyth-ecc.git
cd kodelyth-ecc
```

### 2. Run the install script

**macOS / Linux:**
```bash
./install.sh
```

**Windows:**
```powershell
./install.ps1
```

### 3. Verify

Open your AI tool and type:
```
/kodelyth-quickstart
```

You should see the ECC welcome screen.

---

## After Install

Type `/kodelyth-quickstart` in your AI tool to begin. It walks you through agents, hooks, memory, and skills in 5 minutes.

---

## Quick Tooling Commands

After install, you have access to local utilities:

```bash
# Start the MCP server (16 tools, 6 prompts, 370+ resources)
npx kodelyth-ecc mcp

# Launch the local dashboard (5 tabs: Overview, Memory, Evolve, Catalog, Sessions)
npx kodelyth-ecc dashboard

# Cost-aware model routing
npx kodelyth-ecc route "<task>"

# Swarm orchestrator for parallel work
npx kodelyth-ecc swarm --task "..."

# Self-evolving memory analysis
npx kodelyth-ecc evolve analyze

# Session replay
npx kodelyth-ecc replay <bundle>

# SLSA L3 + SBOM generation
npx kodelyth-ecc sbom
npx kodelyth-ecc manifest
npx kodelyth-ecc verify
```

---

## Updating

```bash
npx kodelyth-ecc@latest
```

This updates agents, skills, and hooks in place. Your `tasks/lessons.md` and memory files are preserved.

---

## Uninstalling

```bash
npx kodelyth-ecc --uninstall
```

Or manually remove the installed directories listed in the [What Gets Installed](#what-gets-installed) table above.

---

## Claude Code — Hook Wiring

Hooks are only available on Claude Code. The install script writes them to `~/.claude/settings.json` automatically.

To verify hooks are active:

```bash
cat ~/.claude/settings.json | grep -A5 '"hooks"'
```

To disable specific hooks:

```bash
export ECC_DISABLED_HOOKS=kodelyth:prompt:recall,kodelyth:post-edit:test-reminder
```

**Safety hooks (v1.7.0):**
- `prompt-injection-guard` — Detects attempted prompt injection
- `token-budget-enforcer` — Warns when approaching context limit

---

## Troubleshooting

**`npx kodelyth-ecc` says "command not found"**
- Ensure Node.js 18+ is installed: `node --version`
- Try `node -e "require('fs')"` to confirm Node.js works

**Agents are not routing**
- Check that `rules/common/agent-intent-routing.md` was installed: `ls ~/.claude/rules/common/`
- Restart your Claude Code session

**Hooks are not firing**
- Verify `~/.claude/settings.json` contains a `hooks` key
- Re-run `npx kodelyth-ecc` to repair the install

**Install fails on Windows**
- Run PowerShell as Administrator
- Or use `npx kodelyth-ecc` directly (no admin required)

**MCP server won't start**
- Ensure port 5173 (default) is not in use: `lsof -i :5173`
- Try a different port: `npx kodelyth-ecc mcp --port 5174`

**Dashboard cannot connect**
- Verify the MCP server is running: `npx kodelyth-ecc mcp`
- Check firewall — localhost access should be allowed
- Use `npx kodelyth-ecc dashboard --port 5175` to try a different port

**Tests fail after install**

```bash
npm test
```

If tests fail, file an issue with the output. Most installs pass all 373 tests.

---

## Post-Install Checklist

After installing, verify these work:

- [ ] `/kodelyth-quickstart` loads in your AI tool
- [ ] `/lessons` opens your project lessons
- [ ] `/memory` shows your memory store
- [ ] `npx kodelyth-ecc mcp` starts the server
- [ ] `npx kodelyth-ecc dashboard` opens the dashboard
- [ ] `npm test` passes all 373 tests (Claude Code only)

If any step fails, re-run the installer or file an issue.
