# Hook Reference

ECC ships 22+ hooks that run automatically in the background — zero configuration after install.

Hooks are defined in `hooks/hooks.json` and wired into `~/.claude/settings.json` by the install script (Claude Code target only). All hooks are async and have aggressive timeouts to never block tool execution.

---

## Hook Types

| Type | When it fires |
|---|---|
| `SessionStart` | Before your first message each session |
| `UserPromptSubmit` | Before every message you send |
| `PreToolUse` | Before a tool runs (Read, Write, Edit, Bash, etc.) |
| `PostToolUse` | After a tool completes |
| `Stop` | When the session ends |

---

## Memory Hooks (v1.4.0+)

### `kodelyth:session:start:read-lessons` (SessionStart — fires first)

**Added in v1.5.1**

Reads `tasks/lessons.md` from the project root and injects all rules as `PROJECT LESSONS — HARD RULES` context before your first message.

Also detects project DNA automatically:
- Node.js: reads `package.json` for framework (Next.js, React, NestJS, Express, etc.) and package manager (pnpm/bun/yarn/npm)
- Go: detects `go.mod`
- Rust: detects `Cargo.toml`
- Python: detects `requirements.txt` / `pyproject.toml`
- Java: detects `pom.xml` / `build.gradle`

Also surfaces open items from `tasks/todo.md` into session context.

**File:** `hooks/memory/read-lessons.js`

---

### `kodelyth:session:start:memory` (SessionStart)

**Added in v1.4.0**

Reads `~/.kodelyth/memory/memories.jsonl` and builds a cache-friendly context block:
- Stable prefix: your recurring patterns + recent project memories
- Variable suffix: memories relevant to the current project

The stable prefix sits in the prompt cache — Anthropic charges 10% on cached tokens, making long sessions significantly cheaper.

**File:** `hooks/memory/inject.js`

---

### `kodelyth:prompt:recall` (UserPromptSubmit)

**Added in v1.4.1**

Watches every message you type. Runs BM25 search against your memory store. If relevant past solutions exist, injects them before the AI responds.

Features:
- Per-session repeat suppression (same memory never shown twice per session)
- Skips trivial prompts ("ok", "thanks", agent invocations)
- Sub-millisecond search — no latency impact

**File:** `hooks/memory/auto-recall.js`

---

### `kodelyth:stop:capture-correction` (Stop — fires first)

**Added in v1.5.1**

Scans the session JSONL file for 12 correction signal patterns:
- "no don't", "use X instead", "stop doing Y"
- "we always", "never do", "wrong approach"
- "I told you to", "don't", "that's not right"
- "bad pattern", "incorrect", "wrong"

Extracts corrections as plain-language rules. Appends them to `tasks/lessons.md` in the project root with date grouping. Creates the file automatically if it doesn't exist. Self-deduplicates — same rule never written twice.

Runs async at session end — zero latency impact on the session itself.

**File:** `hooks/memory/capture-correction.js`

---

### `kodelyth:stop:memory-capture` (Stop)

**Added in v1.4.0**

Scans session for successful problem-solving patterns. Extracts (problem, approach, gotchas, tags). Queues candidates for your review — never auto-stores without confirmation.

Review with `/memory review-pending` at the start of the next session.

**File:** `hooks/memory/capture.js`

---

## Quality Gate Hooks

### `kodelyth:pre-commit:secret-scan` (PreToolUse — git commit)

Scans staged files for secrets before every commit:
- API keys (OpenAI, Anthropic, AWS, GCP, Stripe, etc.)
- Passwords and tokens in code
- Private keys (RSA, EC, etc.)
- `.env` files accidentally staged

Blocks the commit and reports the exact line if found.

---

### `kodelyth:post-edit:quality-gate` (PostToolUse — Write/Edit)

Runs after every file write or edit:
- Type check (`tsc --noEmit`) if TypeScript project
- Format check (Prettier/ESLint) if configured in project
- Async — fires in background, under 5 seconds

---

### `kodelyth:pre-push:branch-check` (PreToolUse — git push)

Validates before push:
- Branch name matches `feat/`, `fix/`, `chore/`, `refactor/`, `docs/` convention
- Most recent commit message follows conventional commits format
- Prompts review if pushing to `main` or `master`

---

### `kodelyth:pre-commit:console-check` (PreToolUse — git commit)

Catches `console.log`, `console.debug`, `print()`, `fmt.Println()` debug statements left in production code. Warns but does not block (configurable).

---

### `kodelyth:pre-commit:config-guard` (PreToolUse — Write/Edit)

Blocks changes that weaken linter or formatter configs:
- `"strict": false` in tsconfig
- `"noImplicitAny": false`
- Removing rules from `.eslintrc`
- Lowering coverage thresholds in jest/vitest config

---

### `kodelyth:post-edit:test-reminder` (PostToolUse — Write/Edit)

If a source file is edited without a corresponding test file also being touched, prompts: "Tests may be needed for the changes in `<file>`. Use `tdd-guide` to write them."

Skips: config files, type-only files, README, migrations.

---

## Notification Hooks

### `kodelyth:stop:desktop-notify` (Stop)

Sends a macOS system notification when a long task completes. Useful for `/project-launch` and `/team-review` which run multiple agents in parallel.

**macOS only.**

---

### `kodelyth:stop:cost-tracker` (Stop)

Logs token usage to `~/.claude/logs/token-usage.jsonl`:
```json
{"session": "abc123", "date": "2026-05-07", "tokens": 48200, "project": "my-app"}
```

Review with:
```bash
# Top 10 most expensive sessions
cat ~/.claude/logs/token-usage.jsonl | jq -s 'sort_by(.tokens) | reverse | .[0:10]'
```

---

## MCP & Safety Hooks

### `kodelyth:pre-tool:mcp-health` (PreToolUse — MCP calls)

Validates that required MCP servers are responsive before calling them. Reports a clear error if a server is down rather than letting the call fail silently.

---

### `kodelyth:pre-tool:file-size-guard` (PreToolUse — Write)

Blocks file writes over 800 lines. Reports the line count and suggests splitting into smaller modules.

---

## Disabling Specific Hooks

```bash
# Disable specific hooks by ID
export ECC_DISABLED_HOOKS=kodelyth:prompt:recall,kodelyth:post-edit:test-reminder

# Disable all quality gate hooks (not recommended)
export ECC_DISABLED_HOOKS=kodelyth:pre-commit:secret-scan,kodelyth:pre-commit:console-check
```

---

## Hook Execution Order

**Session start:**
1. `read-lessons` (lessons + project DNA + open todos)
2. `memory inject` (past solutions)

**Every message:**
3. `auto-recall` (relevant memories for this prompt)

**After each tool:**
4. `quality-gate` (type check + format)
5. `test-reminder` (if source edited without tests)

**Before git operations:**
6. `secret-scan` (before commit)
7. `console-check` (before commit)
8. `config-guard` (before write of config files)
9. `branch-check` (before push)

**Session end:**
10. `capture-correction` (encode corrections to lessons.md — fires first)
11. `memory-capture` (queue solutions for review)
12. `desktop-notify` (macOS notification)
13. `cost-tracker` (log token usage)
