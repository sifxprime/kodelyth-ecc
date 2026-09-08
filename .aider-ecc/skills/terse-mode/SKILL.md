---
name: terse-mode
description: Compress LLM output tokens by 40-70% without losing information. Keeps code, commands, URLs, paths byte-exact. Four dial levels (lite / full / ultra / off). Complements RTK (which shrinks input) — together, ~55-65% total token savings on typical coding sessions.
origin: ECC (inspired by Caveman by juliusbrussee — MIT)
---

# Terse Mode — Output Token Compressor

Make the AI's **mouth** smaller, not its **brain** smaller. Same answers, fewer words, byte-exact code.

## What this is

A prompt-level output compression skill. When active, the AI drops verbose filler while preserving every technical detail. Signals correctness, not chattiness.

## When to activate

- Any coding session where reply length is dominant (explanations, reviews, planning)
- Extended sessions where you want output tokens to stretch further
- Reading the AI's output out loud sounds like padding — that's the tell

## When to skip

- User explicitly wants long, teaching-oriented explanations
- Documentation-writing tasks where the output IS the artifact
- First contact with a new user who hasn't opted in

## The rules — ALWAYS PRESERVED

The AI must **byte-preserve** these no matter which level:

1. Fenced code blocks (```lang ... ```) — exact contents, no changes
2. Inline `code` — exact
3. Shell commands and error text — exact
4. URLs, file paths, function names, identifiers — exact
5. Numbers, versions, hashes — exact
6. YAML/JSON/config snippets — exact

## Levels

### `off` — normal AI voice
Default. No compression.

### `lite` — light trim
- Drop obvious filler ("basically", "essentially", "in order to", "the reason is that")
- Convert "you should X" → "X"
- Merge sentences that repeat the same idea
- Keep normal-looking paragraphs

Example — same info, ~25% shorter:
> The React component re-renders because a new object reference is created on each render. Wrap the object in `useMemo`.

### `full` — default terse
- Fragment sentences: "New ref each render. Wrap in `useMemo`."
- Drop transitional phrases entirely
- Use `→` and `=` freely instead of prose connectors
- Assume user is a senior engineer

Example — ~50% shorter:
> New ref each render → re-render. Wrap object in `useMemo`.

### `ultra` — maximum compression
- Telegram-style. Symbols over words. Numbered points, one line each.
- Only expand if the compression would lose a technical fact.

Example — ~70% shorter:
> Ref/render. `useMemo` it.

## Interaction with other ECC systems

- **RTK** compresses input tokens (tool output → LLM). Terse compresses output tokens (LLM → user). Stack together for ~55-65% total savings.
- **kodelyth-memory** captures still capture in normal voice — memory recall is for machines, not humans. Terse mode does NOT affect memory captures.
- **`code-reviewer`** and **`release-captain`** agents can opt in via `--terse` flag for one-line PR comments and short commit messages.

## What terse mode NEVER does

- Change what the AI knows
- Skip technical details or trade-offs
- Compress code, commands, or errors
- Translate — write in the user's own language, just tighter
- Auto-activate — user opts in via `/terse` or CLI

## Activation

- Slash command: `/terse [lite|full|ultra|off]` — sticks for the session
- CLI: `kodelyth-ecc terse enable [--target claude-code|--all]` — installs the skill + command into your AI tool
- Statusline (Claude Code): shows `[TERSE ⚡ 12.4k]` — lifetime output tokens saved

## Honest numbers

- On verbose explain-heavy tasks: 60-70% output token reduction
- On terse debugging chats: 20-30% (less to compress)
- On documentation writing: net zero — skip this mode
- Skill itself adds ~800-1200 input tokens per turn. Below ~2k output tokens, may be net-negative

## Attribution

Design inspired by [Caveman](https://github.com/JuliusBrussee/caveman) (MIT, by Julius Brussee). ECC's implementation is independent — different prompt, different levels dial (no `wenyan`, no cavespeak persona), and integrated with our RTK ledger for combined input+output tracking.
