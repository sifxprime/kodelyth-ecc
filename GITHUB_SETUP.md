# GitHub Repository Setup Checklist

Step-by-step instructions for everything that requires the GitHub UI or CLI.  
Do these **once** after pushing a new version. Takes ~15 minutes total.

---

## 1. Social Preview Image

GitHub requires a PNG or JPG (not SVG). Convert first, then upload.

### Convert SVG → PNG (one command)

```bash
# Option A — using Inkscape (install: brew install inkscape)
inkscape social/github-social-preview.svg \
  --export-type=png \
  --export-filename=social/github-social-preview.png \
  --export-width=1280

# Option B — using ImageMagick (install: brew install imagemagick)
convert -size 1280x640 -density 150 \
  social/github-social-preview.svg \
  social/github-social-preview.png

# Option C — using rsvg-convert (install: brew install librsvg)
rsvg-convert -w 1280 -h 640 \
  social/github-social-preview.svg \
  -o social/github-social-preview.png
```

### Upload to GitHub

1. Go to `https://github.com/sifxprime/kodelyth-ecc`
2. Click **Settings** (top right of repo)
3. Scroll to **Social preview** section
4. Click **Edit** → **Upload an image**
5. Select `social/github-social-preview.png`
6. Click **Save changes**

> The preview image appears when anyone shares the repo link on X, LinkedIn, Slack, WhatsApp, etc.

---

## 2. Repository About (Description + Topics)

### About description

1. Go to `https://github.com/sifxprime/kodelyth-ecc`
2. Click the **gear icon ⚙** next to "About" (top right of the repo page)
3. Set **Description** to exactly:

```
70 agents · 194 skills · 97 commands · MCP server · devil mode · 11 platforms · zero telemetry
```

4. Set **Website** to:
```
https://www.npmjs.com/package/kodelyth-ecc
```

5. Check these boxes:
   - ✅ Releases
   - ✅ Packages
   - ✅ Deployments (if applicable)

6. Click **Save changes**

---

### Topics (paste all at once)

In the same **Edit repository details** dialog, add these topics one by one or paste via the GitHub API:

```
claude-code
windsurf
cursor
codex
antigravity
opencode
cline
roocode
aider
gemini-cli
ai-agents
ai-coding
coding-toolkit
developer-tools
llm
llm-tools
mcp
model-context-protocol
devil-mode
red-team
adversarial
local-memory
self-learning
auto-recall
intent-routing
semantic-routing
parallel-agents
multi-agent
bm25
dashboard
observability
hooks
slash-commands
productivity
kodelyth
```

**Or set via GitHub CLI (faster):**

```bash
gh repo edit sifxprime/kodelyth-ecc \
  --add-topic claude-code \
  --add-topic windsurf \
  --add-topic cursor \
  --add-topic codex \
  --add-topic antigravity \
  --add-topic opencode \
  --add-topic cline \
  --add-topic roocode \
  --add-topic aider \
  --add-topic gemini-cli \
  --add-topic ai-agents \
  --add-topic ai-coding \
  --add-topic coding-toolkit \
  --add-topic developer-tools \
  --add-topic llm \
  --add-topic mcp \
  --add-topic model-context-protocol \
  --add-topic devil-mode \
  --add-topic red-team \
  --add-topic local-memory \
  --add-topic self-learning \
  --add-topic intent-routing \
  --add-topic parallel-agents \
  --add-topic bm25 \
  --add-topic dashboard \
  --add-topic observability \
  --add-topic hooks \
  --add-topic kodelyth
```

> **Note:** GitHub allows max 20 topics per repo. Pick the 20 most relevant if the CLI command fails.  
> Priority order: `claude-code`, `windsurf`, `ai-agents`, `mcp`, `model-context-protocol`, `devil-mode`, `local-memory`, `intent-routing`, `parallel-agents`, `coding-toolkit`, `developer-tools`, `llm`, `cursor`, `codex`, `antigravity`, `bm25`, `hooks`, `self-learning`, `kodelyth`, `dashboard`

---

## 3. GitHub Wiki — Publish the 7 Pages

The wiki lives as a separate git repo at `https://github.com/sifxprime/kodelyth-ecc.wiki.git`.

### First-time setup

```bash
# Clone the wiki repo (separate from the main repo)
git clone https://github.com/sifxprime/kodelyth-ecc.wiki.git /tmp/ecc-wiki
cd /tmp/ecc-wiki
```

### Copy and publish all 7 pages

```bash
# From your main repo root:
cp wiki/Home.md              /tmp/ecc-wiki/Home.md
cp wiki/Installation-Guide.md /tmp/ecc-wiki/Installation-Guide.md
cp wiki/Agent-Reference.md   /tmp/ecc-wiki/Agent-Reference.md
cp wiki/Skill-Reference.md   /tmp/ecc-wiki/Skill-Reference.md
cp wiki/Hook-Reference.md    /tmp/ecc-wiki/Hook-Reference.md
cp wiki/Platform-Support.md  /tmp/ecc-wiki/Platform-Support.md
cp wiki/FAQ.md               /tmp/ecc-wiki/FAQ.md

cd /tmp/ecc-wiki
git add -A
git commit -m "Publish ECC wiki v1.7.0 — 7 pages"
git push origin master
```

### Verify

Visit `https://github.com/sifxprime/kodelyth-ecc/wiki` — all 7 pages should appear in the sidebar.

### Keep wiki in sync (future updates)

Every time you update a wiki page in `wiki/`, re-run the `cp` + `git push` commands above.  
Or add a GitHub Action to auto-sync (see step 6 below).

---

## 4. GitHub Discussions — Enable and Create Pinned Post

### Enable Discussions

1. Go to `https://github.com/sifxprime/kodelyth-ecc/settings`
2. Scroll to **Features**
3. Check **Discussions** → **Set up discussions**

### Create these categories (in Discussions settings)

| Category | Format | Purpose |
|---|---|---|
| Announcements | Announcement | Releases, major updates |
| Q&A | Question / Answer | Support |
| Show & Tell | Open-ended | "What did you use ECC for?" |
| Ideas | Open-ended | Feature ideas |
| Devil Mode Stories | Open-ended | Security finds, red-team results |

### Pinned welcome post

Create a new Discussion in **Announcements**:

**Title:** `Welcome to Kodelyth ECC — start here 👋`

**Body:**
```markdown
Welcome!

**Kodelyth ECC** gives your AI coding assistant 70 specialist agents, 194 skills, 97 commands, and self-learning memory. One install, 11 platforms.

## Quick links
- [Installation Guide](https://github.com/sifxprime/kodelyth-ecc/wiki/Installation-Guide)
- [Agent Reference](https://github.com/sifxprime/kodelyth-ecc/wiki/Agent-Reference)
- [FAQ](https://github.com/sifxprime/kodelyth-ecc/wiki/FAQ)
- [Full docs](https://github.com/sifxprime/kodelyth-ecc/tree/main/docs)

## Install

\`\`\`bash
npx kodelyth-ecc
\`\`\`

## Share your first result

Drop a comment below: what's the first thing you used ECC for?  
Best results get featured in the README.
```

Pin this discussion.

---

## 5. Good First Issues — Create Them Now

Use `gh` CLI to create 10 issues tagged `good first issue`. Copy-paste each block:

```bash
gh issue create \
  --title "[GOOD FIRST ISSUE] Add Ruby language reviewer agent" \
  --label "good first issue,help wanted,new-agent" \
  --body "$(cat <<'EOF'
## What needs to be done
Create `agents/ruby-reviewer.md` — a specialist Ruby code reviewer following the same structure as `agents/python-reviewer.md` and `agents/typescript-reviewer.md`.

## Why it matters
Ruby/Rails users currently get generic review. A specialist reviewer catches Ruby-specific patterns (ActiveRecord N+1, missing frozen_string_literal, unsafe `send`, etc.)

## Exact acceptance criteria
- [ ] File at `agents/ruby-reviewer.md`
- [ ] Has a specific persona with 10+ years Ruby/Rails experience
- [ ] Review priorities cover: N+1 queries, mass assignment, missing `frozen_string_literal`, unsafe metaprogramming, Gemfile security
- [ ] Trigger patterns added to `rules/common/agent-intent-routing.md`
- [ ] Agent listed in `rules/common/agents.md`
- [ ] `npm test` passes

## Helpful context
- Related file: `agents/python-reviewer.md` (use as structure template)
- Related file: `rules/common/agent-intent-routing.md` (add trigger patterns here)
- Estimated effort: M (2–4h)
EOF
)"
```

```bash
gh issue create \
  --title "[GOOD FIRST ISSUE] Add Elixir language reviewer agent" \
  --label "good first issue,help wanted,new-agent" \
  --body "$(cat <<'EOF'
## What needs to be done
Create `agents/elixir-reviewer.md` — a specialist Elixir/Phoenix code reviewer.

## Why it matters
Elixir users have no specialist reviewer. Key patterns to catch: missing pattern match exhaustiveness, unbounded GenServer message queues, blocking Repo calls inside GenServers, missing supervision tree restarts.

## Exact acceptance criteria
- [ ] File at `agents/elixir-reviewer.md`
- [ ] Has a specific persona with Elixir/OTP/Phoenix experience
- [ ] Review covers: GenServer misuse, supervision, Ecto query safety, pattern match completeness
- [ ] Trigger patterns added to `rules/common/agent-intent-routing.md`
- [ ] `npm test` passes

## Helpful context
- Template: `agents/go-reviewer.md`
- Estimated effort: M (2–4h)
EOF
)"
```

```bash
gh issue create \
  --title "[GOOD FIRST ISSUE] Add Neovim as an install target" \
  --label "good first issue,help wanted" \
  --body "$(cat <<'EOF'
## What needs to be done
Add `neovim` as a target in `install.sh` and `install.ps1`. Neovim AI plugins (avante.nvim, codecompanion.nvim) read from a project config directory.

## Why it matters
Neovim + AI plugin users have no install path. It's a large audience with growing adoption of coding AI tools.

## Exact acceptance criteria
- [ ] `--target neovim` works in `install.sh` (copy rules to `.nvim/rules/` or equivalent)
- [ ] Feature parity in `install.ps1`
- [ ] `--help` output updated
- [ ] README platform table updated
- [ ] `npm test` passes

## Helpful context
- Start from the `opencode` target in `install.sh` as the simplest rules-only pattern
- Estimated effort: S (1–2h)
EOF
)"
```

```bash
gh issue create \
  --title "[GOOD FIRST ISSUE] Write a new devil-mode agent: rate-limit-tester" \
  --label "good first issue,help wanted,new-agent" \
  --body "$(cat <<'EOF'
## What needs to be done
Create `agents/rate-limit-tester.md` — an adversarial agent that audits API rate limiting implementations.

## Why it matters
Rate limiting is frequently missing, misconfigured, or bypassable. It belongs in the devil-mode crew.

## What it should check
- Missing rate limits on public endpoints
- Rate limits bypassable via IP rotation / header manipulation
- Missing rate limits on auth endpoints (brute-force risk)
- Redis/memory-based rate limiters with race conditions
- Missing rate limit headers in responses (RFC 6585)

## Exact acceptance criteria
- [ ] File at `agents/rate-limit-tester.md`
- [ ] Follows devil-mode agent structure (bash grep patterns, severity levels, remediation)
- [ ] Added to `/devil-mode` command's agent list in `commands/devil-mode.md`
- [ ] Trigger patterns added to `rules/common/agent-intent-routing.md`
- [ ] `npm test` passes

## Helpful context
- Template: `agents/secret-hunter.md` (follow this structure)
- Estimated effort: M (2–4h)
EOF
)"
```

```bash
gh issue create \
  --title "[GOOD FIRST ISSUE] Add badge: Node.js version requirement" \
  --label "good first issue,help wanted,documentation" \
  --body "$(cat <<'EOF'
## What needs to be done
Add a Node.js version badge to `README.md` that links to nodejs.org.

## Why it matters
Users on older Node versions get cryptic errors. A visible badge sets expectations upfront.

## Exact acceptance criteria
- [ ] Badge added to the badge row in README: `[![Node](https://img.shields.io/badge/Node.js-18%2B-339933.svg)](https://nodejs.org)`
- [ ] Badge appears in the correct position (after License badge)
- [ ] `npm test` passes

## Helpful context
- File: `README.md` lines 5–21
- Estimated effort: XS (< 15 min)
EOF
)"
```

```bash
gh issue create \
  --title "[GOOD FIRST ISSUE] Add CONTRIBUTING template for new skill" \
  --label "good first issue,help wanted,documentation" \
  --body "$(cat <<'EOF'
## What needs to be done
Add a skill proposal template to `.github/ISSUE_TEMPLATE/new_skill.md`. Currently only `new_agent.md` exists — skills need their own template.

## Exact acceptance criteria
- [ ] File at `.github/ISSUE_TEMPLATE/new_skill.md`
- [ ] Sections: skill name, problem it solves, target agents, example content (first 20 lines), Kodelyth Standard checklist
- [ ] Labels: `enhancement`, `new-skill`
- [ ] `npm test` passes

## Helpful context
- Template reference: `.github/ISSUE_TEMPLATE/new_agent.md`
- Estimated effort: XS (< 1h)
EOF
)"
```

```bash
gh issue create \
  --title "[GOOD FIRST ISSUE] Add PHP language rules" \
  --label "good first issue,help wanted" \
  --body "$(cat <<'EOF'
## What needs to be done
Create `rules/php/` with coding standards for PHP projects (Laravel, Symfony, vanilla PHP).

## Why it matters
PHP is one of the most widely used server-side languages and has no language-specific rules in ECC.

## What to cover
- Type hints and strict_types declaration
- PDO usage over raw mysql_* functions
- Input sanitization patterns
- Composer autoloading conventions
- PSR-12 coding standard alignment

## Exact acceptance criteria
- [ ] `rules/php/coding-standards.md` created
- [ ] `install.sh` `php` case already handles it — verify it works
- [ ] `npm test` passes

## Helpful context
- Template: `rules/golang/` (follow same structure)
- Estimated effort: S (1–2h)
EOF
)"
```

```bash
gh issue create \
  --title "[GOOD FIRST ISSUE] Add /memory CLI examples to wiki FAQ" \
  --label "good first issue,help wanted,documentation" \
  --body "$(cat <<'EOF'
## What needs to be done
Add a dedicated FAQ section to `wiki/FAQ.md` covering the `/memory` slash command with real examples.

## Exact acceptance criteria
- [ ] New section in `wiki/FAQ.md`: "How do I use the memory system?"
- [ ] Covers: /memory recall, /memory remember, /memory review-pending, /memory inject
- [ ] At least 3 example prompts with expected outputs
- [ ] Section follows existing FAQ style

## Helpful context
- File: `wiki/FAQ.md`
- Reference: `commands/memory.md` (source of truth for memory CLI)
- Estimated effort: XS (< 1h)
EOF
)"
```

```bash
gh issue create \
  --title "[GOOD FIRST ISSUE] Add GitHub Actions badge to README" \
  --label "good first issue,help wanted" \
  --body "$(cat <<'EOF'
## What needs to be done
Add a CI status badge to README that reflects the `.github/workflows/ci.yml` workflow.

## Exact acceptance criteria
- [ ] Badge added: `[![CI](https://github.com/sifxprime/kodelyth-ecc/actions/workflows/ci.yml/badge.svg)](https://github.com/sifxprime/kodelyth-ecc/actions/workflows/ci.yml)`
- [ ] Placed after the Tests badge in README
- [ ] `npm test` passes locally

## Estimated effort: XS (< 15 min)
EOF
)"
```

```bash
gh issue create \
  --title "[GOOD FIRST ISSUE] Add dart/flutter language rules" \
  --label "good first issue,help wanted" \
  --body "$(cat <<'EOF'
## What needs to be done
Create `rules/dart/` with coding standards for Dart/Flutter projects.

## Why it matters
Dart/Flutter is one of ECC's supported review targets (flutter-reviewer agent exists) but has no language rules file.

## What to cover
- Null safety patterns
- Widget build method best practices
- async/await over .then() chaining
- const constructors where possible
- State management conventions (BLoC, Riverpod)

## Exact acceptance criteria
- [ ] `rules/dart/coding-standards.md` created
- [ ] `install.sh` handles `dart` already — verify it installs correctly
- [ ] `npm test` passes

## Helpful context
- Template: `rules/kotlin/` (similar mobile-first mindset)
- Estimated effort: S (1–2h)
EOF
)"
```

---

## 6. Optional: Auto-sync Wiki via GitHub Actions

If you want wiki pages to auto-publish when you push to `main`, add this workflow:

```bash
# Create the file:
cat > .github/workflows/wiki-sync.yml << 'EOF'
name: Sync Wiki

on:
  push:
    branches: [main]
    paths:
      - 'wiki/**'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Publish wiki pages
        uses: nicowillis/publish-wiki-action@v1
        with:
          path: wiki
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
EOF
```

> Alternatively keep it manual — the `cp` + `git push` approach from Step 3 is more reliable and gives you explicit control.

---

## Completion Checklist

Run through this after every major release:

- [ ] Social preview PNG uploaded to GitHub Settings
- [ ] About description updated (`70 agents · 194 skills · ...`)
- [ ] Topics set (20 max)
- [ ] Wiki pages pushed via `git push` to wiki repo
- [ ] Discussions enabled + welcome post pinned
- [ ] At least 5 good-first-issues open
- [ ] README badges rendering correctly (check on GitHub, not just locally)
- [ ] CI badge added and showing green

---

*Repo: https://github.com/sifxprime/kodelyth-ecc*
