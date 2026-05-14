# Kodelyth ECC — PR Review GitHub Action

A one-line GitHub Action that runs the Kodelyth ECC adversarial agent crew against your pull-request diff, posts findings as a PR comment, and optionally fails CI on critical issues.

> **Phase 1.6 of the Devil Roadmap.** Bigger reach lever than the VS Code extension — every GitHub repo is a potential install target.

---

## Quick Start

Drop this into `.github/workflows/ecc-review.yml` in any repo:

```yaml
name: Kodelyth ECC Review

on:
  pull_request:
    branches: [main, master]

permissions:
  contents: read
  pull-requests: write   # required to post the review comment

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: sifxprime/kodelyth-ecc/actions/ecc-review@v1.7.3
        with:
          bundle: red-team
          fail-on: critical
          api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

That's it. Every PR now gets reviewed by ECC's adversarial crew and the findings appear as a sticky PR comment.

---

## Inputs

| Input | Default | Description |
|---|---|---|
| `bundle` | `red-team` | Which ECC bundle: `indie-hacker` / `red-team` / `enterprise` |
| `agents` | (none) | Comma-separated agent names. Overrides `bundle` if set. Example: `prompt-injection-hunter,secret-hunter,backdoor-hunter` |
| `fail-on` | `critical` | Severity threshold that fails the build: `critical` / `high` / `medium` / `none` |
| `api-key` | (none) | Anthropic API key. Pass via `${{ secrets.ANTHROPIC_API_KEY }}`. **Required** for live model review. |
| `model` | `claude-sonnet-4-5-20250929` | Claude model to use |
| `comment` | `true` | Post findings as a PR comment |
| `max-files` | `20` | Max files reviewed per run (cost guard) |
| `ecc-version` | `latest` | Pin a specific Kodelyth ECC version (e.g., `1.6.0`) |

## Outputs

| Output | Description |
|---|---|
| `critical-count` | Number of CRITICAL findings |
| `high-count` | Number of HIGH findings |
| `medium-count` | Number of MEDIUM findings |
| `report-path` | Path to the JSON report on the runner |

---

## Bundle → Agents Mapping

| Bundle | Agents Run on Each PR |
|---|---|
| `indie-hacker` | `security-reviewer` · `code-reviewer` · `ux-reviewer` · `dependency-doctor` |
| `red-team` (default) | `prompt-injection-hunter` · `supply-chain-auditor` · `secret-hunter` · `backdoor-hunter` |
| `enterprise` | `code-reviewer` · `security-reviewer` · `license-violation-finder` · `supply-chain-auditor` · `api-guardian` |

To run a custom set, use `agents:` instead:

```yaml
- uses: sifxprime/kodelyth-ecc/actions/ecc-review@v1.7.3
  with:
    agents: secret-hunter,license-violation-finder,jailbreak-tester
```

---

## Real-World Example Workflows

### 1. Indie Hacker — fast feedback, never block

```yaml
- uses: sifxprime/kodelyth-ecc/actions/ecc-review@v1.7.3
  with:
    bundle: indie-hacker
    fail-on: none
    api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

PR gets a comment, but CI never fails. You decide what to address.

### 2. Red Team — full adversarial sweep, block on critical

```yaml
- uses: sifxprime/kodelyth-ecc/actions/ecc-review@v1.7.3
  with:
    bundle: red-team
    fail-on: critical
    api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

Default. Recommended for any user-facing product.

### 3. Enterprise — strict, block on high

```yaml
- uses: sifxprime/kodelyth-ecc/actions/ecc-review@v1.7.3
  with:
    bundle: enterprise
    fail-on: high
    api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 4. Pre-public-release — secret + license + AI safety only

```yaml
- uses: sifxprime/kodelyth-ecc/actions/ecc-review@v1.7.3
  with:
    agents: secret-hunter,license-violation-finder,prompt-injection-hunter
    fail-on: critical
    api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 5. Cost-controlled — only review on changes to security-sensitive paths

```yaml
on:
  pull_request:
    paths:
      - 'src/auth/**'
      - 'src/api/**'
      - 'src/payments/**'
      - 'package*.json'
```

---

## Cost & Rate-Limit Guards

The action ships with sensible defaults to keep your Anthropic spend under control:

- `max-files: 20` — caps how many changed files get sent per run
- Each file capped at 20KB per send (truncated with marker)
- Default `red-team` bundle = 4 agents = 4 API calls per PR
- Each call uses `max_tokens: 4096`
- A typical PR review: 4 calls × ~6k input + 4k output tokens ≈ ~$0.06-0.15 with Sonnet

For larger codebases or stricter cost control:

```yaml
with:
  max-files: 10
  agents: secret-hunter   # single agent only
  ecc-version: 1.6.0      # pin version for reproducibility
```

---

## How It Works

1. **Setup** — installs the latest (or pinned) Kodelyth ECC into the runner via `npx kodelyth-ecc --target claude-home --bundle <bundle>`
2. **Diff** — resolves the changed files between PR base and head SHAs
3. **Filter** — drops binary, vendored, and oversized files; caps at `max-files`
4. **Review loop** — for each agent in the bundle:
   - Loads the agent's playbook from `~/.claude/agents/<name>.md`
   - Sends `[playbook + changed files + JSON output schema]` to Claude
   - Parses the structured findings response
5. **Aggregate** — combines all findings, tallies severities
6. **Comment** — posts a single PR comment (upserts on subsequent pushes — never spammy)
7. **Gate** — exits non-zero if findings exceed `fail-on` threshold

---

## What This Action Does NOT Do

- ❌ Auto-fix issues (advisory only)
- ❌ Send any data anywhere except Anthropic API + GitHub PR comments
- ❌ Cache anything between runs (each PR = clean slate)
- ❌ Run on commits that don't touch reviewable file types

---

## Privacy & Security

- **Code never leaves your control:** PR diff is sent to Anthropic API (using your key) and GitHub PR comments (using `github.token`). Nothing else.
- **No telemetry:** This action sends no analytics anywhere.
- **No persistence:** No data stored beyond the runtime of the workflow.
- **API key:** Pass via `secrets.*` only. Never hardcode.

If your repo has compliance requirements that prohibit sending code to Anthropic, **don't use this action**. Run ECC locally instead.

---

## Troubleshooting

### "No ANTHROPIC_API_KEY set — review skipped"

You forgot to pass the secret. Add it under repo Settings → Secrets and variables → Actions, then reference it in the workflow:

```yaml
api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### "::warning::Agent file not found"

The bundle resolved an agent name that doesn't exist in the installed ECC. Pin a known-good version:

```yaml
ecc-version: 1.6.0
```

### "Failed to post PR comment: 403"

Your workflow needs `pull-requests: write` permission. Add to top of workflow:

```yaml
permissions:
  contents: read
  pull-requests: write
```

### Comment is too long (GitHub 65k limit)

Reduce findings by tightening `agents:` or `max-files:`. The action caps to first 30 findings in the comment but writes the full report to the runner artifacts (downloadable from Actions tab).

---

## Related

- [Kodelyth ECC repo](https://github.com/sifxprime/kodelyth-ecc) — the toolkit this action runs
- [`/devil-mode` command](../../commands/devil-mode.md) — same agents, run locally
- [Devil Roadmap](../../) — the broader v1.7.3 → v2.0.0 plan

---

**Powered by Kodelyth ECC** · MIT license · No telemetry · No cloud
