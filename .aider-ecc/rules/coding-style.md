---
paths:
  - "**/*.rb"
  - "**/*.rake"
  - "**/Gemfile"
  - "**/Rakefile"
---
# Ruby Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Ruby specific content.

## Standards

- Follow the **Ruby Style Guide** (rubocop default)
- Use **frozen_string_literal: true** at the top of every file
- Prefer `do...end` for multi-line blocks, `{ }` for single-line

## Immutability

```ruby
# frozen_string_literal: true

User = Data.define(:name, :email)  # Ruby 3.2+ immutable value object
```

## Formatting

- **RuboCop** for linting and style enforcement
- **StandardRB** as a zero-config RuboCop config alternative
- Line length: 120 characters max

## Naming

- `snake_case` for methods and variables
- `CamelCase` for classes and modules
- `SCREAMING_SNAKE_CASE` for constants
- Predicate methods end with `?`, destructive methods end with `!`

## Reference

See skill: `ruby-patterns` for comprehensive Ruby idioms, Rails patterns, and concurrency.
