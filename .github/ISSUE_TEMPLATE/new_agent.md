---
name: New agent proposal
about: Propose a new specialist agent for ECC
title: '[AGENT] '
labels: enhancement, new-agent
assignees: ''
---

## Agent name

<!-- e.g. `rate-limiter-specialist`, `database-migrator` -->

## One-line description

<!-- What does this agent do? Max 15 words. -->

## Problem it solves

<!-- What pain does this agent remove? What does a developer have to do manually today that this agent would handle? -->

## Persona

<!-- Who is this agent? Describe their experience, scale they've worked at, what makes their advice different from a generic answer. -->

## Trigger patterns

<!-- When should intent routing auto-invoke this agent? Give 5–10 natural-language phrases a user might type. -->

- "..."
- "..."
- "..."

## Example interaction

<!-- Show a realistic input and the kind of response this agent would give. -->

**User:** ...

**Agent:** ...

## Does this overlap with an existing agent?

<!-- Check the agent list. If it overlaps with e.g. `debug-detective` or `performance-optimizer`, explain what makes this distinct. -->

## Kodelyth Standard checklist

- [ ] The agent has a specific, named persona with years of experience and scale context
- [ ] The agent responds to the human situation, not just the technical question
- [ ] Responses give exact file paths, before/after code, or specific commands — not abstract advice
- [ ] No emoji in agent responses
- [ ] Ends with `> Powered by Kodelyth — [tagline]`
- [ ] No `model:` field in frontmatter
