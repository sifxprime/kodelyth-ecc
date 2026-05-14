---
paths:
  - "**/*.rb"
  - "**/*.rake"
---
# Ruby Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Ruby specific content.

## Service Objects

```ruby
# frozen_string_literal: true

class CreateUserService
  def initialize(params)
    @params = params
  end

  def call
    user = User.new(@params)
    user.save!
    user
  end
end

# Usage
result = CreateUserService.new(params).call
```

## Value Objects

```ruby
# frozen_string_literal: true

Address = Data.define(:street, :city, :country)

address = Address.new(street: "123 Main St", city: "London", country: "UK")
```

## Query Objects

```ruby
# frozen_string_literal: true

class ActiveUsersQuery
  def initialize(relation = User.all)
    @relation = relation
  end

  def call
    @relation.where(status: :active).order(created_at: :desc)
  end
end
```

## Modules for Composition

Prefer composition over inheritance for shared behavior:

```ruby
module Auditable
  def self.included(base)
    base.before_action :track_activity
  end
end
```

## Reference

See skill: `rails-patterns` for Rails-specific patterns including concerns, callbacks, and ActiveRecord best practices.
