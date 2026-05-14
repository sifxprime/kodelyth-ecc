# Performance & Cost Optimization

## Budget-First Principle (CRITICAL)

**Every token costs money. Every agent invocation costs money. Treat both as finite resources.**

Match the model to the task complexity. Do not default to the heaviest model — that wastes money. Do not default to the lightest model on complex work — that wastes time and produces worse output. Pick the right tier for the actual task in front of you.

---

## Model Selection by Platform

### Claude Code (Anthropic Models)

| Tier | Model | Task Examples |
|---|---|---|
| **Trivial** | Claude Haiku | Rename, format, autocomplete, write a single test, update a comment |
| **Standard** | Claude Sonnet 4.6 | Build a component, write an API route, debug a bug, refactor a module — **most real coding work** |
| **Maximum** | Claude Opus 4.6 | Architect a system, plan a large migration, analyze cross-cutting security issues, hardest problems |

**Most sessions run on Sonnet 4.6.** Haiku is for genuinely trivial edits. Opus 4.6 is for decisions that would take a senior engineer an hour of deep thinking.

---

### Google Antigravity — Approved Model Stack

The approved stack is 4 models. **Gemini 3 Flash and GPT-OSS 120B are not used** — they are insufficient for production-grade, multi-language, 300B-scale work.

| Tier | Model | Task Examples |
|---|---|---|
| **Standard** | Gemini 3.1 Pro (Low) | Build components, write API routes, server actions, debug rendering issues, write tests, everyday refactoring — **most real coding work** |
| **Complex** | Gemini 3.1 Pro (High) | Deep multi-file reasoning, architecture decisions, hard bugs spanning many files, security audits, migration planning |
| **Claude Standard** | Claude Sonnet 4.6 (Thinking) | When Claude agent behavior is needed, extended thinking on difficult problems, complex agent orchestration |
| **Claude Maximum** | Claude Opus 4.6 (Thinking) | Hardest architectural decisions, maximum reasoning — use when Pro (High) and Sonnet both fall short |

**Do not use:**
- Gemini 3 Flash — insufficient depth for production work
- GPT-OSS 120B (Medium) — not part of the Kodelyth ECC stack

---

### Antigravity Task Mapping — Any Language, Any Scale

| What you are doing | Right model |
|---|---|
| Building a React/Next.js component | Gemini 3.1 Pro (Low) |
| Writing an API route or server action | Gemini 3.1 Pro (Low) |
| Writing tests | Gemini 3.1 Pro (Low) |
| Debugging a rendering or logic bug | Gemini 3.1 Pro (Low) |
| Go service implementation | Gemini 3.1 Pro (Low) |
| Python API endpoint | Gemini 3.1 Pro (Low) |
| Kotlin Android feature | Gemini 3.1 Pro (Low) |
| Rust systems code | Gemini 3.1 Pro (Low) |
| Java Spring Boot service | Gemini 3.1 Pro (Low) |
| Hard bug spanning 8+ files | Gemini 3.1 Pro (High) |
| Auth system architecture | Gemini 3.1 Pro (High) |
| Security audit across codebase | Gemini 3.1 Pro (High) |
| Cross-service debugging | Gemini 3.1 Pro (High) |
| Database schema and query design | Gemini 3.1 Pro (High) |
| Migration planning (framework, language) | Gemini 3.1 Pro (High) |
| Deep agent reasoning needed | Claude Sonnet 4.6 (Thinking) |
| Complex multi-agent orchestration | Claude Sonnet 4.6 (Thinking) |
| Hardest architectural decisions | Claude Opus 4.6 (Thinking) |
| Problem that Pro (High) could not solve | Claude Opus 4.6 (Thinking) |

**Gemini 3.1 Pro (High) vs (Low) — choose High when:**
- Task spans 10+ files and requires cross-file reasoning
- A bug has resisted Pro (Low)'s analysis
- Security or compliance audit needs full codebase context
- Architecture decision has significant long-term trade-offs
- Migration involves complex dependency trees across the project

**Claude Sonnet 4.6 (Thinking) — choose when:**
- You need Claude-specific agent behaviors from ECC
- The problem requires extended thinking beyond Gemini's reasoning
- You are orchestrating multiple agents and need deep coordination logic

**Claude Opus 4.6 (Thinking) — last resort:**
- Only when Gemini 3.1 Pro (High) and Claude Sonnet 4.6 have both been tried and fallen short
- Maximum reasoning on the hardest architectural problems
- Never open with Opus on a task Pro (Low) can handle

---

## Token Efficiency Rules

### Keep Context Lean

- Read only the function or section needed — never feed entire files when a targeted read works
- Summarize long conversations before continuing deep sessions (`/compact` in Claude Code)
- Avoid the last 20% of the context window for large operations — start a fresh session instead
- Clear context between unrelated tasks — stale context adds noise and cost

### Low-Context Tasks — safe at any point in a session

- Single-file edits
- Standalone utility creation
- Documentation updates
- Simple bug fixes
- Writing a test for a function that already exists

### High-Context Tasks — start fresh or compact first

- Large-scale refactoring across many files
- Feature implementation spanning multiple modules
- Debugging complex multi-service interactions
- Any task requiring reading 10+ files simultaneously

---

## Agent Invocation Cost Discipline

- **Don't spawn agents for trivial tasks** — a one-liner fix does not need a code-reviewer agent
- **Batch related changes** before invoking a reviewer — review once after a logical unit of work, not after every single edit
- **Use `async: true` for all non-blocking hooks** — never let a hook add latency to tool execution (Claude Code)
- **Set hook timeouts aggressively** — hooks must complete in under 5 seconds; anything longer gets killed
- **Disable hooks you don't use** (Claude Code):
  ```bash
  export ECC_DISABLED_HOOKS=kodelyth:smart-suggest,kodelyth:test-reminder
  ```

---

## Thinking Mode — Use Surgically

Claude Sonnet 4.6 (Thinking) and Claude Opus 4.6 (Thinking) reserve large token budgets for internal reasoning. Gemini 3.1 Pro (High) activates deep reasoning mode. Both are expensive. Use deliberately.

**Enable thinking / Pro (High) for:**
- Architectural decisions with significant trade-offs
- Security analysis of sensitive code paths
- Debugging that has resisted standard analysis
- Migration planning across a large, complex codebase

**Stay on Pro (Low) for:**
- Routine code generation
- Documentation and comment updates
- Standard refactoring with a clear path
- Any task where the answer is immediately obvious from context

**Claude Code — cap thinking budget to control cost:**
```bash
export MAX_THINKING_TOKENS=5000

# Toggle extended thinking: Option+T (macOS) / Alt+T (Windows/Linux)
```

**Antigravity — select at model picker:**
- Gemini 3.1 Pro (Low) = fast, capable, handles most work
- Gemini 3.1 Pro (High) = deep reasoning mode, costs more
- Claude Sonnet 4.6 (Thinking) = Claude agent behavior + thinking
- Claude Opus 4.6 (Thinking) = maximum, last resort

---

## Cost Tracking (Claude Code)

The cost-tracker hook logs token usage per session to `~/.claude/logs/token-usage.jsonl`.

```bash
# Top 10 most expensive sessions
cat ~/.claude/logs/token-usage.jsonl | jq -s 'sort_by(.tokens) | reverse | .[0:10]'

# Average tokens per session
cat ~/.claude/logs/token-usage.jsonl | jq -s '[.[].tokens] | add / length'
```

High-cost sessions signal one of three problems: wrong model selection, poor context hygiene, or over-spawning agents. Fix the habit, not just the session.

---

## Build Troubleshooting

Build errors are pattern-matching tasks, not deep reasoning tasks.

1. Use **build-error-resolver** agent — Pro (Low) or Sonnet tier, not Opus
2. Feed the exact error message, not the entire build log
3. Fix one error at a time
4. Verify after each fix before continuing
