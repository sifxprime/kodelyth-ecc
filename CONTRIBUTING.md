# Contributing to Kodelyth ECC

Thank you for contributing. Every agent, skill, hook, and improvement makes every developer using this toolkit better at their craft.

---

## The Kodelyth Standard

Every contribution must meet the **Kodelyth Standard** — the bar that makes this toolkit feel like advice from a decade-experienced senior engineer, not a checklist tool.

### What makes a Kodelyth-quality agent

- **GOD-level persona** — the agent has a specific identity: years of experience, scale of systems, emotional intelligence
- **Feels the user** — responds to the human situation, not just the technical question
- **Model-agnostic** — no `model:` field in frontmatter. Works on any model
- **Never childish** — no simple boilerplate answers, no obvious advice a junior would give
- **Concrete, not abstract** — every suggestion has exact file paths, before/after code, or specific commands
- **No emoji** — agent responses use structured prose, tables, and code blocks. Never decorative emoji. SVG badges in rendered Markdown; plain Unicode symbols (✓ ✗) in terminal contexts only
- **Kodelyth footer** — every agent ends with `> Powered by Kodelyth — [tagline]`

---

## Agent Contribution

### File location
```
agents/your-agent-name.md
```

### Required frontmatter
```yaml
---
name: your-agent-name
description: >
  [2-3 line description that Claude Code uses to decide when to invoke this agent.
  Include: what it does, the persona, and when to use it.]
tools: ["Read", "Grep", "Glob", "Bash"]   # only include what the agent actually needs
---
```

**Do NOT include `model:` field** — agents must be model-agnostic.

### Required persona opening

Every agent must open with a clear identity paragraph:

```markdown
You are the [Agent Name] — a [role] with [X]+ years of [experience type] at
companies [scale context]. You have [specific war story or expertise].
You [key personality trait that makes responses better].
```

### Required Kodelyth footer

Every agent must end with:
```markdown
---

> Powered by Kodelyth — [short tagline specific to this agent's domain].
```

### Agent checklist before submitting

- [ ] Frontmatter has `name`, `description`, `tools` — no `model`
- [ ] Opens with a specific, credible persona (decade experience, real scale)
- [ ] Reads emotional state and responds to the person first
- [ ] Contains concrete examples (before/after code, exact commands)
- [ ] Has output format section (what does a response look like?)
- [ ] No emoji anywhere — structured prose and tables only
- [ ] Ends with Kodelyth footer
- [ ] File named `lowercase-with-hyphens.md`
- [ ] Added to `AGENTS.md` table

---

## Skill Contribution

### File location
```
skills/your-skill-name/SKILL.md
```

### Required frontmatter
```yaml
---
name: your-skill-name
description: One-line description of what this skill covers.
origin: Kodelyth
---
```

### Required sections

```markdown
# Skill Title — Subtitle

Brief intro paragraph. What is this, why does it matter.
Powered by Kodelyth.

## When to Use
[Bullet list of trigger conditions]

## [Core Content Sections]
[The actual knowledge — patterns, examples, code snippets]

---

> Powered by Kodelyth — [tagline].
```

### Skill quality standards

- **Production-grade examples** — every code example must be something a senior engineer would actually write
- **Before/after comparisons** — show the bad pattern and the good pattern, not just the good
- **Language-specific** — if the skill covers a specific language, use that language's idioms correctly
- **Actionable** — every section should tell the reader exactly what to do, not just what to know

### Skill checklist before submitting

- [ ] Frontmatter has `name`, `description`, `origin: Kodelyth`
- [ ] Has "When to Use" section
- [ ] All code examples are production-quality (not toy examples)
- [ ] Has before/after comparisons where relevant
- [ ] No emoji — SVG badges for status indicators, plain text everywhere else
- [ ] Ends with Kodelyth footer
- [ ] Skill directory named `lowercase-with-hyphens/`

---

## Hook Contribution

### Hook script location
```
scripts/hooks/your-hook-name.js
```

### hooks.json entry location
```
hooks/hooks.json
```

### Hook script requirements

```javascript
'use strict'
// Always:
// 1. Read stdin fully before processing
// 2. Write original input to stdout if not blocking
// 3. Never hard-crash — catch all errors, exit 0 on unexpected input
// 4. Respect ECC_DISABLED_HOOKS env var
// 5. Keep blocking hooks fast (< 200ms) — no network calls
// 6. Mark long operations as async: true with timeout

function isDisabled() {
  const disabled = (process.env.ECC_DISABLED_HOOKS || '').split(',')
  return disabled.includes('kodelyth:your-hook-id')
}
```

### hooks.json entry format

```json
{
  "matcher": "Edit|Write|MultiEdit",
  "hooks": [
    {
      "type": "command",
      "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/your-hook.js\"",
      "async": true,
      "timeout": 10
    }
  ],
  "description": "Kodelyth: What this hook does in one sentence",
  "id": "kodelyth:post:edit:your-hook-name"
}
```

### Hook ID naming convention
```
kodelyth:{phase}:{matcher}:{name}

Phase:   pre, post, stop, session
Matcher: bash, edit, write, mcp, any
Name:    descriptive-kebab-case

Examples:
  kodelyth:pre:bash:branch-name
  kodelyth:post:edit:test-reminder
  kodelyth:stop:smart-suggest
```

---

## Branch and PR Standards

### Branch naming
```
feat/add-migration-guide-agent
fix/branch-name-check-regex
chore/update-contributing-docs
```

### Commit messages (Conventional Commits)
```
feat(agents): add migration-guide agent for framework upgrades
fix(hooks): handle empty stdin in test-reminder gracefully
docs(skills): add observability skill with OpenTelemetry examples
chore: update VERSION to 1.1.0
```

### PR description template
```markdown
## What this adds
[1-3 bullets on what's new]

## Why it matters
[Who benefits from this and how]

## Kodelyth Standard checklist
- [ ] Agent has GOD-level persona (if adding an agent)
- [ ] No model: field in frontmatter
- [ ] No emoji — SVG badges or plain text only
- [ ] Kodelyth footer present
- [ ] All examples are production-quality
- [ ] AGENTS.md updated (if adding an agent)
- [ ] README.md updated (if adding a major feature)
```

---

## What We're Looking For

### Agents we want
- Domain specialists that don't exist yet (database schema reviewer, API load tester, i18n auditor)
- Language-specific experts for languages not yet covered
- Workflow specialists (release manager, incident commander, on-call guide)

### Skills we want
- Production patterns for specific tech stacks
- Domain knowledge (fintech compliance, healthcare, e-commerce)
- Advanced topics (distributed systems, consensus algorithms, CQRS/Event Sourcing)

### We do NOT want
- Agents that duplicate existing ones (check AGENTS.md first)
- Simple checklists repackaged as skills
- Anything that feels like it was written in 10 minutes
- Agents with `model: opus` or any hardcoded model

---

## Questions?

Open an issue with the label `contribution-question`. We respond fast.

> Powered by Kodelyth — raise the bar, together.
