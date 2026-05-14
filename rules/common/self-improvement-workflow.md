# Self-Improvement Workflow — Compound Learning System

This rule encodes the workflow used by the Claude Code team internally, extended with ECC's three-layer compound memory architecture. Every session makes Claude more aligned with how YOU think and work.

---

## 1. Plan Node Default

Enter plan mode for ANY non-trivial task (3+ steps, architectural decisions, or anything that touches more than 2 files):

- Write the plan to `tasks/todo.md` with checkable items before writing a single line of code
- If something goes sideways mid-task: STOP, re-plan, do not keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront — ambiguity at start = bugs at end
- Check plan with the user before executing when scope is large

## 2. Subagent Strategy

The 70 ECC specialist agents exist so the main context window stays clean:

- Offload research, exploration, and parallel analysis to subagents
- For complex problems: throw more compute via agents, not more tokens in main context
- One task per subagent — focused execution beats monolithic threads
- Intent routing picks the right specialist automatically — trust it

## 3. Self-Improvement Loop (CRITICAL)

**After ANY correction from the user — no matter how small — encode it permanently.**

When the user says something like "no, don't do that", "use X instead", "I told you to", "wrong approach", "stop doing X":

1. **Acknowledge** the correction in one line
2. **Apply** it immediately in the current response
3. **Encode** it: mentally append the rule to `tasks/lessons.md` in the project root

The AI MUST track corrections within a session and apply them consistently from that point forward. The `capture-correction.js` hook writes them to disk automatically at session end.

### How lessons compound

```
Session 1:  User corrects "use pnpm not npm" → lesson written
Session 2:  Claude reads lesson → never uses npm again in this project
Session 3+: New lessons stack → Claude increasingly matches YOUR style
Month 3:    Claude works like a team member who has been here for years
```

**Review and extend lessons** at `tasks/lessons.md` — edit them freely, they are yours.

## 4. Verification Before Done

Never mark a task complete without proving it works:

- Run the actual code, test, or command — do not assume
- Diff behavior between baseline and your changes when relevant
- Ask: "Would a staff engineer approve this PR?"
- Run tests, check logs, demonstrate correctness with evidence
- If verification fails: fix, do not close the loop

## 5. Demand Elegance (Balanced)

For non-trivial changes, pause before presenting:

- Ask internally: "Is there a more elegant solution?"
- If the fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- **Skip this for simple, obvious fixes** — do not over-engineer
- Challenge your own work before presenting it
- Three lines of clear code beat a clever one-liner every time

## 6. Autonomous Bug Fixing

When given a bug report: fix it. Do not ask for hand-holding:

- Point at logs, errors, and failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how
- Use `debug-detective` for root cause analysis (never patch symptoms)
- Use `silent-failure-hunter` when there is no error message

---

## Task Management Protocol

When starting any non-trivial task:

1. **Plan First** — write plan to `tasks/todo.md` with checkable items
2. **Verify Plan** — check in before starting implementation on large tasks
3. **Track Progress** — mark items complete as you go
4. **Explain Changes** — high-level summary at each step
5. **Document Results** — add review section to `tasks/todo.md`
6. **Capture Lessons** — `tasks/lessons.md` is updated automatically by the correction hook

---

## Cross-Platform Lesson Loading

**For Claude Code:** `tasks/lessons.md` is loaded automatically via SessionStart hook before your first message.

**For all other platforms (Windsurf, Cursor, Codex, Antigravity, OpenCode):**
At the start of every session, BEFORE doing anything else:
1. Check if `tasks/lessons.md` exists in the project root
2. If it exists: read it and apply all rules marked with `-` as hard, mandatory constraints for this session
3. Announce: "Loaded N lessons from tasks/lessons.md — applying for this session."
4. If it does not exist: proceed normally

**Users on non-Claude-Code platforms:** run `/lessons` as your first message on any project that has a `tasks/lessons.md`. It will load and activate all your rules instantly.

---

## Three-Layer Compound Memory Architecture

ECC uses three compounding memory layers — together they make Claude increasingly match how you think:

### Layer 1 — Project Lessons (`tasks/lessons.md`)
- Per-project. Human-readable. Hard rules.
- Written automatically when you correct Claude (via `capture-correction.js` Stop hook)
- Injected at session start (via `read-lessons.js` SessionStart hook)
- Edit freely — these are YOUR rules for this project
- Example: "Always use pnpm. Never npm. Never yarn."

### Layer 2 — Global Memory (`~/.kodelyth/memory/`)
- Cross-project. BM25 fuzzy search. Solution patterns.
- Captures solutions from every session
- Auto-recalls relevant past solutions on every prompt you type
- Example: "Last time you had a CORS issue in Express, you added this middleware..."

### Layer 3 — Intent Routing (`rules/common/agent-intent-routing.md`)
- Always-on. 70 specialists. Zero setup.
- Routes your message to the right expert from the first word
- No agent names needed — just describe the problem

**Combined effect**: Layer 1 knows your project rules. Layer 2 knows your past solutions. Layer 3 knows your intent. Together they eliminate the ramp-up cost of every session.

---

## Core Principles

- **Simplicity First** — make every change as simple as possible, impact minimal code
- **No Laziness** — find root causes, no temporary fixes, senior developer standards
- **Minimal Impact** — changes touch only what's necessary, avoid introducing bugs
- **Immutability** — create new objects, never mutate existing ones
- **No Guessing** — if uncertain, ask. Never fabricate facts or behavior.
