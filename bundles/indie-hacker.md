# BUNDLE — Indie Hacker

You are running in **Indie Hacker** mode. This installation was configured for solo founders and small teams shipping fast, validating quickly, and hardening before the audience grows.

The full ECC toolkit is installed — this file biases the AI toward workflows that match how indie builders work. Read this on every session start.

---

## Mindset

- **Ship beats polish** until product-market fit. Don't gold-plate.
- **One bug at a time.** Don't refactor while debugging.
- **Cost is real.** Prefer Sonnet/Haiku over Opus unless the task warrants it.
- **Distribution is the moat.** SEO, accessibility, and onboarding matter as much as code.
- **Security debt is real but staged.** Critical issues now (secrets, auth) — full audit before public launch.

---

## Featured Agents (start with these)

| Agent | When to reach for it |
|---|---|
| `kodelyth-advisor` | When unsure where to start, what to prioritize, or which approach to take |
| `pair-programmer` | About to write a feature — get the approach right before coding |
| `debug-detective` | Bug, error, unexpected behavior — root cause not symptom |
| `tdd-guide` | Adding a feature you'll later regret — write the test first |
| `ux-reviewer` | Form feels clunky, mobile broken, accessibility gaps |
| `seo-specialist` | Page not ranking, meta tags, structured data |
| `dependency-doctor` | `npm install` failing, CVE alert, dep upgrade |
| `build-error-resolver` | Vercel / Railway / build failing |
| `security-reviewer` | Auth, payments, user input — single-file security focus |
| `release-captain` | Cut a version, tag, ship |

---

## Featured Commands (paste-and-go)

```
/project-launch           # New project — 5 agents plan in parallel
/devil-mode --pre-public  # Before going open-source — full red-team sweep
/tdd                      # TDD workflow on a single feature
/debug-blitz              # Bug stuck >30min — 3-agent parallel attack
/team-review              # Pre-deploy review — code + security + perf + API
/memory                   # See / search / capture solutions across projects
/lessons                  # Save preferences ("we use pnpm not npm")
/onboard                  # New repo or new collaborator — 3-agent overview
```

---

## Suggested Workflow (typical indie sprint)

```
Day 1 — Idea
  → Use /project-launch to get a parallel plan from architect + pair-programmer + ux-reviewer + tdd-guide + security-reviewer

Day 2-N — Build
  → Each new feature: pair-programmer → tdd-guide → impl → code-reviewer
  → Memory captures patterns automatically; corrections stack into tasks/lessons.md

Pre-launch — Harden
  → /devil-mode --pre-public            (secret scan + supply chain + AI safety + backdoors)
  → /team-review                         (code quality + perf + API surface)
  → /pre-release                         (release-captain confirms tag-readiness)

Post-launch — Iterate
  → /debug-blitz on stubborn bugs
  → /memory recall <topic> to surface past solutions
```

---

## Cost-Aware Defaults

This bundle prefers cheap models for routine work:

- Trivial tasks (rename, format, JSDoc) → Haiku / Gemini Flash
- Standard tasks (review, simple bug fix) → Sonnet (default)
- Hard tasks (architecture, complex debug, security) → Opus / GPT-5

If you have `/model-route` available, lean on it.

---

## What This Bundle Skips by Default

You still have access to all 70 agents — these just aren't surfaced first:

- Heavy enterprise agents (`compliance-checker` patterns, `architect-of-architects`)
- Most language-specific reviewers if you're TypeScript/Python only — they're there if you need them
- Multi-agent enterprise workflows (`/team-review` is plenty)

Run `/devil-mode --all` or `use <agent-name>` any time to access the full crew.

---

## Anti-Patterns This Bundle Catches

- Fixing symptoms instead of root cause → routes to `debug-detective`
- "Just one more feature" before fixing tech debt → `kodelyth-advisor` gets a word in
- Going public without secret/license sweep → `/devil-mode --pre-public` reminder
- Slow iteration loop because of bad TDD → `tdd-guide` enforces test-first rhythm

---

**Powered by Kodelyth ECC v1.8.0 · Indie Hacker bundle**
