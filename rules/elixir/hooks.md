---
paths:
  - "**/*.ex"
  - "**/*.exs"
---
# Elixir Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Elixir specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **mix format**: Auto-format `.ex` / `.exs` files after edit
  ```bash
  mix format <file>
  ```
- **Credo**: Run on edited files for style warnings
  ```bash
  mix credo <file>
  ```

## Warnings

- Warn when `IO.inspect` is left in non-test `.ex` files (use `Logger` instead)
- Warn when `dbg()` (Elixir 1.14+) is left in production code paths
