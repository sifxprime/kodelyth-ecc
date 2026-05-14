---
paths:
  - "**/*.ex"
  - "**/*.exs"
  - "**/test/**"
---
# Elixir Testing

> This file extends [common/testing.md](../common/testing.md) with Elixir specific content.

## Framework

Use **ExUnit** (built-in). Use **Mox** for behaviour-based mocking.

## Structure

```elixir
defmodule MyApp.AccountsTest do
  use MyApp.DataCase

  alias MyApp.Accounts

  describe "create_user/1" do
    test "creates a user with valid attrs" do
      attrs = %{name: "Alice", email: "alice@example.com"}
      assert {:ok, user} = Accounts.create_user(attrs)
      assert user.email == "alice@example.com"
    end

    test "returns error with invalid attrs" do
      assert {:error, changeset} = Accounts.create_user(%{})
      assert "can't be blank" in errors_on(changeset).email
    end
  end
end
```

## Coverage

```bash
mix test --cover
```

Use **excoveralls** for detailed coverage reports:

```bash
mix coveralls
mix coveralls.html
```

## Async Tests

Mark tests as `async: true` when they don't share state:

```elixir
defmodule MyApp.PureTest do
  use ExUnit.Case, async: true
  ...
end
```

## Reference

See skill: `elixir-testing` for ExUnit async patterns, Mox setup, and property-based testing with StreamData.
