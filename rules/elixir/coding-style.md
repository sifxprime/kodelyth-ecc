---
paths:
  - "**/*.ex"
  - "**/*.exs"
---
# Elixir Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Elixir specific content.

## Standards

- Follow the official **Elixir Style Guide**
- Use **mix format** — non-negotiable, always auto-format
- All public functions must have `@spec` type annotations and `@doc` documentation

## Immutability

Data is immutable by default in Elixir. Embrace it:

```elixir
# Use the pipe operator for data transformations
result =
  input
  |> validate()
  |> transform()
  |> persist()
```

## Function Heads Over Conditionals

```elixir
# Prefer pattern-matched function heads over cond/case at the top level
def process(%{status: :active} = user), do: activate(user)
def process(%{status: :banned} = user), do: reject(user)
def process(_user), do: {:error, :unknown_status}
```

## Formatting

- **mix format** — run on every save
- **Credo** for code quality and style checks
- Line length: 98 characters (mix format default)

## Reference

See skill: `elixir-patterns` for comprehensive GenServer, Phoenix, and OTP patterns.
