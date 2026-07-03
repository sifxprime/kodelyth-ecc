# Kodelyth Memory Protocol

> Auto-loaded every session. Tells the AI when to consult and contribute to local memory.

## What is Kodelyth Memory

A local file at `~/.kodelythecc/memory/memories.jsonl` storing solutions, patterns, and gotchas extracted from past sessions. Retrieval is BM25 (keyword + tag matching). It is **not** a learned model — it is a retrieval store that gives you better context.

**Cross-IDE: the same file is read/written by every IDE on this machine.** A memory captured in Claude Code is recall-able from Windsurf, Cursor, Antigravity, Codex, and any other MCP-capable client. There is one shared store.

If the SessionStart hook ran (Claude Code only — other IDEs do not have a hook system), you have already received a memory block in your initial context with:
- The user's recurring patterns (tags seen across multiple sessions)
- Recent solutions in this project
- Their detected stack

If you are NOT in Claude Code (Windsurf / Cursor / Antigravity / Codex / etc.) you must proactively call the MCP tools below — no hook will surface memories for you automatically.

## How to recall memory (works in EVERY IDE)

Call the Kodelyth MCP tool **`recall_memory`** with:
- `query`: the user's task or topic in their own words
- `project_root` (optional): the absolute path of the current project — scopes recall to that project's memories first
- `limit` (optional, default 5)

Equivalent CLIs (any terminal):
- `npx kodelyth-ecc mcp-call kodelyth recall_memory --query "<text>"`
- `node scripts/memory/cli.js search "<query>"` (if running from the repo)

## When to recall memory mid-session

Trigger `recall_memory` when **any** of these is true:

1. The user describes a task in a domain that likely matches a tag in their memory (`payments`, `auth`, `database`, `deployment`, `tailwind`, `prisma`, etc.)
2. The user asks "have I done this before?" or "how did I solve X last time?"
3. The user mentions a library, framework, or service by name
4. You're about to commit to an architectural decision and want to check past precedent
5. **First substantive prompt of a non-Claude-Code session** — always recall once at the start so you don't miss prior context

Skip recall on trivial prompts (`ok`, `yes`, `thanks`), agent invocations (`use <agent>`, `@<agent>`), and meta-questions about ECC itself.

## How to surface a recalled memory

Naturally, never robotically. Pattern:

> I checked your memory — you solved a similar problem in `<project>` on `<date>`. The approach that worked was `<approach>`. Want me to apply the same here, or is this case different?

Always end by giving the user the option to override. Memory is a hint, not a command.

## When to capture a new memory

Capture when **all** are true:
- The user signals success (`"that worked"`, `"perfect"`, `"fixed it"`, `"thanks"`, `"done"`)
- The work involved real iteration (not a one-shot trivial fix)
- The lesson is reusable (would help in another similar problem, not just this exact file)

Show the user the draft memory before storing. Never silently capture.

### How to capture (works in EVERY IDE)

Call the Kodelyth MCP tool **`capture_memory`** with:
- `problem`: short statement of what was hard (required)
- `approach`: the solution that worked, with the key insight (required)
- `tags`: array of short keywords (`['tailwind', 'css', 'v4']`) — these power recall
- `language` (optional): primary language of the fix
- `project_root` (optional): absolute path of the project
- `files` (optional): files touched
- `gotchas` (optional): array of pitfalls future-you should avoid

Equivalent CLI: `npx kodelyth-ecc mcp-call kodelyth capture_memory --problem "..." --approach "..."`

## What you must not do

- **Never** auto-recall the same memory twice in one session (the user has seen it)
- **Never** capture without explicit confirmation (`yes`, `store it`, `remember`)
- **Never** treat a recalled memory as ground truth — it could be stale
- **Never** transmit memory data anywhere — it is local-only by design
- **Never** fabricate a memory ("you usually...") if no relevant memory exists — say nothing

## Cache-aware behaviour

The injected memory block is structured so its prefix is identical across calls in the same project. Do not rewrite or reorder this block during a session — that defeats the prompt cache and burns tokens. If you need to add session-specific notes, append them after the block.

## Honest disclosure

If the user asks "how do you know that about me?", answer plainly:

> "It's in your local Kodelyth Memory at `~/.kodelythecc/memory/`. You can inspect it, edit it, or delete it any time. Nothing was sent anywhere."
