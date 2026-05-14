---
description: Manage local Kodelyth Memory — recall, capture, review, and curate what your AI knows about you
---

# /memory

Local self-learning memory. Everything stays on this machine.

## Subcommands

### `/memory`
Show storage stats and the 5 most recent memories for this project.

### `/memory recall <query>`
Search memory for `<query>` using BM25 keyword + tag retrieval. Surfaces the top 5 relevant matches.

Example:
```
/memory recall stripe webhook signature
```

### `/memory remember "<title>"`
Capture a new memory. The agent will:
1. Ask for the approach (what worked) and any gotchas
2. Auto-extract tags and language from the conversation
3. Show you the proposed memory
4. Store only after you confirm

### `/memory review-pending`
Show the queue of candidate memories extracted automatically by the Stop hook from your last session. Confirm each one to store, or skip.

### `/memory forget <id>`
Mark a memory deleted. It's a soft-delete (the row stays in the log marked `deleted: true`) so you can recover it by editing `~/.kodelyth/memory/memories.jsonl`.

### `/memory list`
Show all stored memories — id, date, language, problem, tags.

### `/memory rebuild`
Rebuild the BM25 index from `memories.jsonl`. Run this if search results look stale or if you've manually edited the log.

### `/memory inject [--query <text>]`
Print the cache-friendly context block that the SessionStart hook would inject. Useful for debugging what your AI sees about you.

## Implementation

This command delegates to:
```bash
node ~/.claude/scripts/memory/cli.js <subcommand> [args]
```

Or invoke the agent directly:
```
use kodelyth-memory
```

## Storage location

`~/.kodelyth/memory/` (override with `KODELYTH_MEMORY_DIR` env var)

- `memories.jsonl` — the source of truth
- `index.json` — BM25 inverted index
- `pending-review.jsonl` — Stop-hook candidates awaiting confirmation
