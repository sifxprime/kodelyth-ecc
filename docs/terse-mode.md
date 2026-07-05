---
title: "Terse Mode — 40-70% Output Token Savings for AI Coding Assistants"
description: "Compress AI reply length by 40-70% without losing information. 4-level dial, byte-preserves code and commands. Kodelyth ECC's answer to output token cost inspired by Caveman."
keywords:
  - Terse mode
  - AI output compression
  - LLM output tokens
  - Claude Code terse
  - AI reply length
  - caveman mode alternative
  - AI cost reduction
  - Kodelyth Terse
  - AI toolkit compression
  - short AI responses
og_title: "Terse Mode — Output Token Savings (Kodelyth ECC)"
og_description: "4-level dial that shrinks AI output by 40-70%, preserves code byte-exact. Skill + slash commands ship in every ECC install."
og_image: /social/hype-compound-learning.svg
og_type: article
twitter_card: summary_large_image
canonical: /docs/terse-mode/
last_updated: 2026-07-04
version: 2.4.1
category: feature
---

# Terse Mode — Output Token Savings

**Terse Mode** is Kodelyth ECC's built-in output-token compressor. It changes how the AI talks — dropping filler while preserving every technical detail — for 40-70% output token savings on typical replies.

Inspired by **[Caveman](https://github.com/JuliusBrussee/caveman)** (MIT, by Julius Brussee). ECC's implementation is independent: our own prompt, our own compressor, our own ledger, our own dashboard tile. No Caveman code copied, no Caveman dependency, no shell-out to Caveman binaries. Credit in every artifact.

## The rule

> Make the AI's **mouth** smaller, not its **brain** smaller.

Same answers. Fewer words. Code byte-exact.

## Four dial levels

Type `/terse [level]` in your AI tool. The level sticks for the session.

| Level | Style | Approx savings |
|---|---|---|
| `off` | Normal AI voice | 0% |
| `lite` | Light trim, drop filler ("basically", "essentially") | 25% |
| `full` | Telegram-style fragments (default) | 50% |
| `ultra` | Maximum compression, symbols over words | 70% |

Example — same fix, three levels:

> **Normal**: The reason your React component is re-rendering is likely because you're creating a new object reference on each render cycle. When you pass an inline object as a prop, React's shallow comparison sees it as a different object every time, which triggers a re-render. I'd recommend using useMemo to memoize the object.
>
> **Lite**: The React component re-renders because a new object reference is created on each render. Wrap the object in `useMemo`.
>
> **Full**: New ref each render → re-render. Wrap object in `useMemo`.
>
> **Ultra**: Ref/render. `useMemo` it.

## What Terse mode NEVER touches

Byte-preserved in every level:

- Fenced code blocks ` ```lang ... ``` `
- Inline `code`
- Shell commands and error text
- URLs
- File paths, function names, identifiers
- Numbers, versions, hashes
- YAML / JSON / config snippets

## Install

Terse mode is installed automatically when you install ECC:

```bash
npm i -g kodelyth-ecc
kodelythecc --target claude-code
```

The post-install step copies:

- `~/.claude/skills/terse-mode/SKILL.md` — the prompt-level compressor rule
- `~/.claude/commands/terse.md` — the `/terse` slash command
- `~/.claude/commands/terse-compress.md` — the `/terse-compress` slash command

The skill stays **dormant until you type `/terse`**. This is deliberate — Terse mode changes how the AI talks, so it must be user-consented per session.

## CLI reference

```bash
kodelythecc terse status                       # shipped / installed / ledger paths
kodelythecc terse stats [--json]               # turns tracked, tokens saved, level breakdown
kodelythecc terse compress <file> [--dry-run]  # rewrite a markdown file, byte-preserves code
kodelythecc terse enable [--target X | --all]  # install skill + slash commands into an IDE
kodelythecc terse --help                       # focused help
```

## Slash commands (inside your AI tool)

```
/terse             # set to full (default)
/terse lite        # light trim
/terse full        # telegram-style fragments
/terse ultra       # maximum compression
/terse off         # restore normal voice
```

```
/terse-compress CLAUDE.md              # compress a file
/terse-compress tasks/lessons.md
/terse-compress ~/.claude/CLAUDE.md
```

## Compress memory files — permanent savings

`/terse-compress` and its CLI counterpart `kodelythecc terse compress <file>` run a **deterministic zero-dependency compressor** on markdown files. This is different from the runtime `/terse` skill:

- The skill compresses **runtime replies** (session-scoped)
- The compressor compresses **files on disk** (permanent)

Perfect target: `CLAUDE.md`, `tasks/lessons.md`, rule files, and any memory context that gets injected into every session.

### What the compressor does

- Strips 40+ filler patterns (`in order to`, `due to the fact that`, `basically`, `essentially`, ...)
- Converts wordy connectives to compact ones (`in order to` → `to`, `due to the fact that` → `because`)
- Merges wrapped-prose paragraphs, collapses whitespace
- Removes politeness padding ("You should", "I would recommend", "Please note")

### What it byte-preserves

- Fenced code blocks
- YAML frontmatter (whole block between `---` markers)
- Inline `code`
- URLs (`https?://...`)
- File paths (Unix, `~/`, `./`, `../`, absolute)
- Markdown link URLs (inside `[text](url)`)

### Real numbers

On a real prose-heavy markdown file: **~30% byte reduction, 100% code/URL/path integrity**, verified on real tests before every release. Deterministic — same input, same output, safe to re-run.

### Programmatic usage

```javascript
const { compressText, compressFile } = require('kodelyth-ecc/scripts/terse/compress.js');

// String-in, string-out
const { output, stats } = compressText(source);
console.log(stats);
// → { originalBytes, newBytes, saved, savedPct, estimatedTokensSaved }

// File in place, with backup
const result = compressFile('/path/to/CLAUDE.md', {
  write: true,
  backup: true,  // keeps original at CLAUDE.md.pre-terse.bak
});
```

## Runtime savings ledger

Every terse-active turn is recorded in `~/.kodelythecc/terse/ledger.jsonl`:

```json
{
  "ts": "2026-07-04T17:29:33.851Z",
  "level": "full",
  "rawEstimate": 250,
  "actual": 125,
  "saved": 125,
  "source": "claude-code"
}
```

Query it:

```bash
kodelythecc terse stats
kodelythecc terse stats --json
```

Or view in the dashboard: `kodelythecc dashboard` → **Token Savings** tab → **Output savings (Terse mode)** section.

## Combined with RTK

- **[RTK](./rtk.md)** compresses input tokens (tool output → LLM)
- Terse mode compresses output tokens (LLM → user)

They're orthogonal. Stack together for **55-65% total token savings** on typical coding sessions, **65-70%** on explain-heavy or code-review sessions.

## Baked into agents (Phase C)

Two existing ECC agents have opt-in terse mode built in:

- **`code-reviewer`** — when `/terse` is active, PR comments become one-line: `L42: 🔴 bug: user null. Add guard.`
- **`release-captain`** — when `/terse` is active, Conventional Commit subjects stay ≤50 chars, changelog entries stay compact

## Attribution

- **License**: ECC's terse-mode implementation is MIT
- **Design inspiration**: [Caveman](https://github.com/JuliusBrussee/caveman) by Julius Brussee (MIT)
- **What we borrowed**: The core insight ("compress the mouth, not the brain") and the level-dial pattern
- **What we didn't borrow**: Zero copied code. Different prompt, different levels (no `wenyan` Chinese mode), different compressor implementation, integrated with our RTK ledger for combined input+output tracking

## See also

- **[RTK](./rtk.md)** — the input-side companion
- **[Dashboard](./dashboard.md)** — live combined savings view
- **[Intent Routing v2](./intent-routing.md)** — how routing adapts announcement style when terse is active
