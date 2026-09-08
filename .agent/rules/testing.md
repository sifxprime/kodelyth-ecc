---
paths:
  - "**/*.rb"
  - "**/*_spec.rb"
  - "**/spec/**"
---
# Ruby Testing

> This file extends [common/testing.md](../common/testing.md) with Ruby specific content.

## Framework

Use **RSpec** as the testing framework. Use **FactoryBot** for fixtures.

## Structure

```ruby
# frozen_string_literal: true

RSpec.describe CreateUserService do
  subject(:service) { described_class.new(params) }

  let(:params) { { name: "Alice", email: "alice@example.com" } }

  describe "#call" do
    context "with valid params" do
      it "creates a user" do
        expect { service.call }.to change(User, :count).by(1)
      end
    end

    context "with invalid params" do
      let(:params) { { name: "", email: "bad" } }

      it "raises an error" do
        expect { service.call }.to raise_error(ActiveRecord::RecordInvalid)
      end
    end
  end
end
```

## Coverage

```bash
COVERAGE=true bundle exec rspec
```

Use **SimpleCov** for coverage reporting. Target 90%+ for new code.

## Factories

```ruby
FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    name { Faker::Name.name }
    status { :active }
  end
end
```

## Reference

See skill: `ruby-testing` for detailed RSpec patterns, shared examples, and Rails request specs.
