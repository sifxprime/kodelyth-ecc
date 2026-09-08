---
paths:
  - "**/*.rb"
  - "**/*.rake"
---
# Ruby Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Ruby specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **RuboCop**: Auto-lint `.rb` files after edit
  ```bash
  rubocop --autocorrect <file>
  ```
- **Syntax check**: Run `ruby -c <file>` after editing

## Warnings

- Warn about `puts` / `p` statements in non-test `.rb` files (use `Rails.logger` or a logger instead)
- Warn when `binding.pry` or `byebug` is left in edited files
