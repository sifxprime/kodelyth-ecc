# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:

```
// Pseudocode
WRONG:  modify(original, field, value) → changes original in-place
CORRECT: update(original, field, value) → returns new copy with change
```

Rationale: Immutable data prevents hidden side effects, makes debugging easier, and enables safe concurrency.

## Core Principles

### KISS (Keep It Simple)

- Prefer the simplest solution that actually works
- Avoid premature optimization
- Optimize for clarity over cleverness

### DRY (Don't Repeat Yourself)

- Extract repeated logic into shared functions or utilities
- Avoid copy-paste implementation drift
- Introduce abstractions when repetition is real, not speculative

### YAGNI (You Aren't Gonna Need It)

- Do not build features or abstractions before they are needed
- Avoid speculative generality
- Start simple, then refactor when the pressure is real

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Error Handling

ALWAYS handle errors comprehensively:
- Handle errors explicitly at every level
- Provide user-friendly error messages in UI-facing code
- Log detailed error context on the server side
- Never silently swallow errors

## Input Validation

ALWAYS validate at system boundaries:
- Validate all user input before processing
- Use schema-based validation where available
- Fail fast with clear error messages
- Never trust external data (API responses, user input, file content)

## Naming Conventions

- Variables and functions: `camelCase` with descriptive names
- Booleans: prefer `is`, `has`, `should`, or `can` prefixes
- Interfaces, types, and components: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Custom hooks: `camelCase` with a `use` prefix

## Code Smells to Avoid

### Deep Nesting

Prefer early returns over nested conditionals once the logic starts stacking.

### Magic Numbers

Use named constants for meaningful thresholds, delays, and limits.

### Long Functions

Split large functions into focused pieces with clear responsibilities.

## Visual Output & Documentation Style

### No Emoji (STRICT)

**Never** use decorative emoji in documentation, agent responses, README files, skill files, or UI output.

Emoji signals low craft. Use professional alternatives instead:

| Context | Wrong | Right |
|---|---|---|
| GitHub Markdown badges | ✅ Feature complete | `![Status](https://img.shields.io/badge/status-complete-brightgreen.svg)` |
| Inline doc icons | 🔍 Search | `<img src="icons/search.svg" width="16" alt="Search">` |
| Status indicators | ✅ Passing / ❌ Failing | `PASS` / `FAIL` or ✓ / ✗ (Unicode, not emoji) |
| Section headers | 🎯 Goals | `## Goals` — plain heading, no decoration |
| Terminal output | 🚀 Installing... | `Installing...` or `[INFO] Installing...` |
| Checklists | ✅ Done | `- [x] Done` (Markdown checkbox) |

**Allowed in terminal scripts only:** Unicode symbols `✓` (U+2713), `✗` (U+2717), `→` (U+2192) — these are text characters, not emoji, and render cleanly in all terminals.

**In rendered Markdown (README, docs, skills):**
```html
<!-- Use shields.io SVG badges for status -->
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen.svg)

<!-- Use <img> for inline icons -->
<img src="https://cdn.simpleicons.org/typescript" width="16" height="16" alt="TypeScript">
```

**In agent responses:** no decoration whatsoever — structured prose, code blocks, and tables only.

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values (use constants or config)
- [ ] No mutation (immutable patterns used)
- [ ] No emoji — SVG badges or plain text only
