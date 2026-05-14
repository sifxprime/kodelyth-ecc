---
paths:
  - "**/*.ex"
  - "**/*.exs"
---
# Elixir Security

> This file extends [common/security.md](../common/security.md) with Elixir specific content.

## Secret Management

```elixir
# config/runtime.exs — read from environment at runtime, never compile-time
config :my_app, :stripe_key,
  System.fetch_env!("STRIPE_SECRET_KEY")  # raises if missing
```

Never put secrets in `config/config.exs` or `config/dev.exs` committed to git.

## SQL Injection

Always use Ecto parameterized queries:

```elixir
# UNSAFE — never do this
Repo.query("SELECT * FROM users WHERE email = '#{email}'")

# SAFE
from(u in User, where: u.email == ^email) |> Repo.one()
```

## Atom Exhaustion

Never convert untrusted user input to atoms — the atom table is not garbage collected:

```elixir
# UNSAFE
String.to_atom(user_input)

# SAFE
String.to_existing_atom(user_input)  # only if atom must already exist
# or keep it as a string
```

## Security Scanning

- **Sobelow** for Phoenix/Elixir static security analysis:
  ```bash
  mix sobelow --config
  ```
- **mix audit** for dependency vulnerability scanning:
  ```bash
  mix hex.audit
  ```

## Reference

See skill: `security-review` for OWASP top 10 and authentication patterns.
