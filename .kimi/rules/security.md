---
paths:
  - "**/*.rb"
  - "**/*.rake"
---
# Ruby Security

> This file extends [common/security.md](../common/security.md) with Ruby specific content.

## Secret Management

```ruby
# Never hardcode secrets
api_key = ENV.fetch("STRIPE_SECRET_KEY")  # raises KeyError if missing, not nil

# Rails credentials (encrypted)
Rails.application.credentials.stripe[:secret_key]
```

## SQL Injection

Always use parameterized queries — never string interpolation:

```ruby
# UNSAFE
User.where("email = '#{params[:email]}'")

# SAFE
User.where(email: params[:email])
User.where("email = ?", params[:email])
```

## Mass Assignment

Use strong parameters in Rails controllers:

```ruby
def user_params
  params.require(:user).permit(:name, :email)
end
```

## Security Scanning

- **Brakeman** for static security analysis of Rails apps:
  ```bash
  brakeman -q
  ```
- **bundler-audit** for dependency CVE scanning:
  ```bash
  bundle audit check --update
  ```

## Reference

See skill: `security-review` for OWASP top 10 and auth patterns.
