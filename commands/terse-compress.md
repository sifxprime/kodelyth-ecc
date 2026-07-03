---
description: Compress a markdown file into terse form for permanent input-token savings. Byte-preserves code, URLs, paths.
argument-hint: "<file>"
---

# /terse-compress — rewrite a memory file to save tokens forever

Compresses a markdown file (like `CLAUDE.md`, `tasks/lessons.md`, `AGENTS.md`) into terse form so it costs fewer tokens to load every session.

## Usage

- `/terse-compress CLAUDE.md`
- `/terse-compress tasks/lessons.md`
- `/terse-compress ~/.claude/CLAUDE.md`

## What gets compressed

Prose only. Filler-word trims, sentence merges, fragment style.

## What is byte-preserved

- Fenced code blocks ` ```lang ... ``` ` — exact
- Inline code `` ` `` — exact
- URLs — exact
- File paths — exact
- YAML frontmatter (between `---` markers) — exact
- List markers (`-`, `*`, `1.`) — kept, but item text may be shortened
- Section headings — kept, but text may be shortened

## Instructions to the assistant

1. Read the target file from the argument. If no argument, ask which file.
2. Show the user a diff (original vs compressed).
3. Ask for confirmation before writing.
4. On confirm: write the compressed version, keep the original at `<path>.pre-terse.bak`.
5. Report savings: original bytes → new bytes, percent saved, estimated tokens saved (bytes / 4).

Alternatively, use the deterministic compressor:

```bash
kodelyth-ecc terse compress <path> [--dry-run] [--backup]
```

That runs `scripts/terse/compress.js` — a zero-dep Node script that:
- Byte-preserves code, URLs, paths, frontmatter
- Removes 40+ filler patterns
- Merges wrapped prose paragraphs
- Reports byte and token savings

Prefer the CLI for automated pipelines. Use the assistant path when you want a judgment-based rewrite that also restructures for clarity.
