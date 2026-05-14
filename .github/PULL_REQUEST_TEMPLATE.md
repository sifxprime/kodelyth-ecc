## What this PR does

<!-- One paragraph. What was broken or missing, what you changed, and why this is the right approach. -->

## Type of change

- [ ] Bug fix (broken behavior, wrong count, install failure)
- [ ] New agent
- [ ] New skill
- [ ] New command
- [ ] New hook
- [ ] Rule update
- [ ] Install script change
- [ ] Documentation
- [ ] Other: ___

## Checklist

### All PRs
- [ ] `npm test` passes (`node tests/run-all.js`)
- [ ] No hardcoded version numbers or counts that will drift
- [ ] No `.DS_Store`, `node_modules`, or generated files committed

### New agent
- [ ] File at `agents/<name>.md`
- [ ] No `model:` field in frontmatter
- [ ] Has a specific persona with experience/scale context
- [ ] Responds to human situation, not just the technical question
- [ ] Ends with `> Powered by Kodelyth — [tagline]`
- [ ] Trigger patterns added to `rules/common/agent-intent-routing.md`
- [ ] Agent added to `rules/common/agents.md`
- [ ] README agent table updated

### New skill
- [ ] File at `skills/<name>/SKILL.md`
- [ ] Description is accurate and testable

### Install script change (`install.sh` / `install.ps1`)
- [ ] Both `install.sh` and `install.ps1` updated (feature parity)
- [ ] Tested on at least one platform
- [ ] No new hardcoded counts (use dynamic `find` instead)

### Rule change
- [ ] Rule is general enough to apply across languages/frameworks
- [ ] Not duplicating guidance already in another rule file

## Testing

<!-- How did you verify this works? -->

## Related issues

<!-- Closes #123 -->
