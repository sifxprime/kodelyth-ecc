---
name: kodelyth-memory
description: Local self-learning memory for AI coding sessions. Captures what works, recalls it next time, shapes context for prompt-cache savings. Zero dependencies, zero telemetry, model-agnostic.
---

# Kodelyth Memory — Skill

## When to use

- **At session start** when the task touches a domain the user has worked in before (auth, payments, database, deployment, API integration)
- **When the user says "that worked"** or signals success after struggle — capture the lesson
- **When the user asks "have I done this before?"** or seems to be repeating past work
- **When starting a new feature** in a project with existing memory

## How it works

```
┌─────────────────┐    capture    ┌─────────────────┐    inject    ┌─────────────────┐
│  Past session   │ ─────────────→│  ~/.kodelythecc/   │─────────────→│  Next session   │
│  (you solved X) │               │  memory/        │              │  (X comes up)   │
└─────────────────┘               └─────────────────┘              └─────────────────┘
                                          │
                                          │  BM25 keyword + tag retrieval
                                          │  No embeddings, no network
                                          ↓
                                  Cache-friendly context block
                                  (stable prefix → cheap re-reads)
```

## Storage layout

All under `~/.kodelythecc/memory/` (override with `KODELYTH_MEMORY_DIR`):

| File | Purpose |
|---|---|
| `memories.jsonl` | Append-only log — every captured memory |
| `index.json` | Inverted BM25 index for fast retrieval |
| `patterns.json` | User-level recurring patterns (auto-derived) |
| `projects/<hash>.json` | Per-project shortcut indexes |

## Why BM25 instead of embeddings

| Embeddings (OpenAI/local) | BM25 (what we use) |
|---|---|
| Semantic match — finds related ideas with no shared words | Keyword + tag match |
| Requires either network calls or 50MB+ local model | Pure JS, ~3KB |
| Adds 200-2000ms latency per query | Sub-millisecond |
| Cost per session | Free forever |
| Privacy: leaks query text to provider | Stays local |

For coding memory, the things you want to recall **almost always share vocabulary** with the trigger — file paths, library names, error strings, framework terms. BM25 nails this. We deliberately chose worse semantic match for vastly better latency, privacy, and cost.

## CLI cheatsheet

```bash
# Add a memory manually
node scripts/memory/cli.js remember "Stripe webhook signature failed in production" \
  --approach "Switched body parser from json to raw, validated with constructEvent" \
  --tags payments,stripe,webhooks \
  --language typescript

# Search
node scripts/memory/cli.js search "stripe webhook"

# Show what would be injected at session start
node scripts/memory/cli.js inject --query "add stripe payments"

# Extract memory candidates from a Claude Code session log
node scripts/memory/cli.js extract ~/.claude/projects/<project>/<session>.jsonl

# List all memories
node scripts/memory/cli.js list

# Storage stats
node scripts/memory/cli.js stats

# Forget one
node scripts/memory/cli.js forget <id>
```

## Slash command

In Claude Code:

```
/memory                          # Show stats and recent memories
/memory recall <query>           # Search and surface matches
/memory remember <title>         # Capture a new memory (interactive)
/memory forget <id>              # Delete one
/memory review-session           # Extract candidates from current session
```

## Cache-friendly injection

The injected context block is structured for prompt cache reuse:

```
[STABLE PREFIX — cached after first call, ~10% cost on subsequent calls]
  ## Your recurring patterns (built from N sessions)
  ## Recent solutions in this project
  ## Detected stack: typescript, next, postgres

[VARIABLE SUFFIX — varies per query]
  ## Relevant to your current task: "<query>"
```

For Anthropic models the cache TTL is 5 minutes — typing back-to-back during a coding session keeps the prefix warm. For OpenAI models the prefix is automatically cached when ≥1024 tokens. Other models (Gemini, Llama, Mistral) do not currently cache, so for them the benefit is purely the recall quality, not cost reduction.

## Honest limits

- **Not "the model learns"** — the model is unchanged. We're just feeding it better context.
- **Per-machine by default** — sync via Dropbox/iCloud/git on `~/.kodelythecc/memory/` if needed.
- **Cloud-AI platforms** (Windsurf, Antigravity, partial Cursor) — session data is server-side. Auto-extract from past sessions doesn't work there. Manual `/memory remember` still does.
- **Privacy** — every byte stays on your disk. Verify with `ls -la ~/.kodelythecc/memory/`.

## Anti-patterns

| Don't | Do |
|---|---|
| Auto-capture every conversation | Capture only when user signals success |
| Inject all memories on every session | Inject relevant + recent + patterns only |
| Capture without showing user the draft | Always confirm before storing |
| Recall the same memory twice in one session | Track surfaced memories per session |
| Treat memory as ground truth | Memory is a hint — current task may differ |

## Files in this skill

- `agents/kodelyth-memory.md` — the agent persona and protocols
- `scripts/memory/store.js` — storage + BM25 retrieval
- `scripts/memory/inject.js` — cache-friendly context block builder
- `scripts/memory/extract.js` — heuristic learning extractor for session logs
- `scripts/memory/cli.js` — command-line entry point
- `hooks/memory/capture-stop.js` — Stop hook that runs extractor on session end
- `hooks/memory/inject-start.js` — SessionStart hook that runs `inject`
- `commands/memory.md` — `/memory` slash command
- `rules/common/memory-protocol.md` — when AI should query memory mid-session
