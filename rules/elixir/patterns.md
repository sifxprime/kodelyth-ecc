---
paths:
  - "**/*.ex"
  - "**/*.exs"
---
# Elixir Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Elixir specific content.

## with for Multi-Step Operations

```elixir
def create_user(params) do
  with {:ok, validated} <- validate(params),
       {:ok, user} <- Repo.insert(User.changeset(%User{}, validated)),
       :ok <- send_welcome_email(user) do
    {:ok, user}
  end
end
```

## GenServer Pattern

```elixir
defmodule MyApp.Cache do
  use GenServer

  def start_link(opts), do: GenServer.start_link(__MODULE__, %{}, opts)

  def get(pid, key), do: GenServer.call(pid, {:get, key})
  def put(pid, key, value), do: GenServer.cast(pid, {:put, key, value})

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_call({:get, key}, _from, state), do: {:reply, Map.get(state, key), state}

  @impl true
  def handle_cast({:put, key, value}, state), do: {:noreply, Map.put(state, key, value)}
end
```

## Context Modules (Phoenix)

```elixir
defmodule MyApp.Accounts do
  alias MyApp.Accounts.User
  alias MyApp.Repo

  def get_user!(id), do: Repo.get!(User, id)

  def create_user(attrs) do
    %User{}
    |> User.changeset(attrs)
    |> Repo.insert()
  end
end
```

## Tagged Tuples for Errors

Always return `{:ok, result}` or `{:error, reason}` — never bare values from functions that can fail.

## Reference

See skill: `phoenix-patterns` for Phoenix LiveView, contexts, and Ecto query patterns.
