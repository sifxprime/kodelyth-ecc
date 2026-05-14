---
name: git-mastery
description: Advanced Git workflows, branching strategies, history management, and team collaboration patterns. Covers trunk-based development, interactive rebase, bisect debugging, monorepo workflows, and professional commit hygiene. Powered by Kodelyth.
origin: Kodelyth
---

# Git Mastery — Advanced Git Workflows

Professional-grade Git patterns for individuals and teams. Powered by Kodelyth.

## When to Use

- Setting up a branching strategy for a team
- Learning advanced Git commands (rebase, bisect, worktree)
- Fixing a messy commit history before merging
- Debugging when a bug was introduced using `git bisect`
- Working in a monorepo
- Enforcing commit message standards

---

## Branching Strategies

### Trunk-Based Development (Recommended for most teams)

```
main (always deployable)
 ├── feat/add-oauth      (short-lived, < 2 days)
 ├── fix/null-check      (short-lived, < 1 day)
 └── chore/upgrade-deps  (short-lived)
```

**Rules:**
- All branches off `main`, all PRs back to `main`
- Branches live < 2 days — longer = higher merge conflict risk
- Use feature flags to ship incomplete features safely
- Every commit to `main` is potentially deployable

```bash
# Start a feature
git checkout main && git pull
git checkout -b feat/user-authentication

# Sync with main daily (rebase, don't merge)
git fetch origin
git rebase origin/main

# PR → squash merge → delete branch
```

### Gitflow (For versioned software with release cycles)

```
main          (production releases only)
develop       (integration branch)
 ├── feature/xyz     (features off develop)
 ├── release/1.2.0   (stabilization)
 └── hotfix/critical (off main, merges to main + develop)
```

**Use when**: You ship versioned releases (mobile apps, libraries, enterprise software)
**Avoid when**: You deploy continuously (web apps, SaaS)

### Ship / Show / Ask (For experienced teams)

```
Ship: Commit directly to main (trivial changes, docs, chores)
Show: Open PR, merge immediately without review (small, safe changes)
Ask:  Open PR, wait for review (significant changes, risk)
```

---

## Commit Message Mastery

### Conventional Commits Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
```
feat:     New feature (triggers MINOR version bump)
fix:      Bug fix (triggers PATCH version bump)
docs:     Documentation only
style:    Formatting (no logic change)
refactor: Code restructure (no feature, no fix)
test:     Adding or fixing tests
chore:    Build, tooling, dependencies
perf:     Performance improvement
ci:       CI/CD changes
revert:   Reverting a commit
```

**Examples:**
```bash
# Good
git commit -m "feat(auth): add OAuth2 login with Google"
git commit -m "fix(cart): prevent double-submission on slow networks"
git commit -m "refactor(user): extract UserService from UserController"
git commit -m "test(payment): add integration test for failed webhooks"

# Bad
git commit -m "fix bug"
git commit -m "WIP"
git commit -m "changes"
git commit -m "asdf"
```

**With body (for significant changes):**
```bash
git commit -m "feat(billing): add Stripe subscription management

Adds three subscription tiers: Free, Pro ($29/mo), Enterprise ($99/mo).
Payment flow uses Stripe Checkout. Subscription status synced via webhooks.

Breaking: removes legacy PayPal integration (deprecated since v1.3)
Closes #234"
```

---

## Interactive Rebase — History Surgery

### Squash WIP commits before merging

```bash
# You have 5 messy commits you want to clean up
git log --oneline -5
# abc1234 fix
# def5678 WIP
# ghi9012 more changes
# jkl3456 actually fix it
# mno7890 feat: add user search

# Squash all 5 into 1 clean commit
git rebase -i HEAD~5

# In the editor:
# pick mno7890 feat: add user search
# squash jkl3456 actually fix it
# squash ghi9012 more changes
# squash def5678 WIP
# squash abc1234 fix
# → writes a clean single commit message
```

### Fix a commit message (already pushed? see below)

```bash
# Fix the last commit message
git commit --amend -m "feat(search): add full-text user search with pagination"

# Fix a message 3 commits back
git rebase -i HEAD~3
# Change "pick" to "reword" on the target commit
```

### Fixup — add changes to a previous commit

```bash
# You forgot to add a file to a commit 2 commits ago
git add forgotten-file.ts
git commit --fixup HEAD~2

# Then squash fixup into its target automatically
git rebase -i --autosquash HEAD~3
```

### Split a large commit into smaller ones

```bash
git rebase -i HEAD~1
# Change "pick" to "edit" on the commit to split

# Now git stops at that commit
git reset HEAD~1         # unstage all changes
git add -p               # selectively stage first logical change
git commit -m "feat: add user model"
git add -p               # stage second logical change
git commit -m "feat: add user repository"
git rebase --continue    # finish the rebase
```

---

## Git Bisect — Binary Search for Bugs

When you know "it worked in v1.2, broke somewhere before v1.5":

```bash
git bisect start
git bisect bad                    # current HEAD is broken
git bisect good v1.2.0            # this tag/commit was good

# Git checks out the midpoint automatically
# Test it (run your test, check the behavior)
git bisect good   # if this commit is OK
git bisect bad    # if this commit has the bug

# Repeat — git halves the search space each time
# With 1000 commits, it takes at most 10 steps

# Automate with a test script
git bisect run npm test -- --grep "the failing test"

# When done
git bisect reset  # returns to original HEAD
```

---

## Git Worktrees — Multiple Branches Simultaneously

Work on a hotfix while keeping your feature branch untouched:

```bash
# Create a new worktree (separate directory, same repo)
git worktree add ../hotfix-payment hotfix/payment-crash

# Now you have two working directories:
#   ~/project/           → your feature branch
#   ~/hotfix-payment/    → the hotfix branch

# Work in the hotfix directory, commit, push, PR
cd ../hotfix-payment
# ... make fix ...
git commit -m "fix(payment): prevent double charge on retry"
git push origin hotfix/payment-crash

# Clean up when done
cd ~/project
git worktree remove ../hotfix-payment
```

---

## Git Log — Find Anything in History

```bash
# See changes to a specific file over time
git log --follow --oneline -- src/components/Auth.tsx

# See who last changed each line (with commit + author)
git blame src/components/Auth.tsx

# Search commit messages
git log --oneline --grep="payment"

# Search code changes (find when a string was added or removed)
git log -S "functionName" --oneline

# See what changed between two tags
git log v1.2.0..v1.3.0 --oneline

# Visualize branch graph
git log --oneline --graph --decorate --all
```

---

## Git Stash — Save Work in Progress

```bash
# Stash everything (tracked + untracked)
git stash push -u -m "WIP: halfway through auth refactor"

# List stashes
git stash list
# stash@{0}: WIP: halfway through auth refactor
# stash@{1}: quick fix attempt

# Apply and remove the latest stash
git stash pop

# Apply a specific stash (keep it)
git stash apply stash@{1}

# Stash only specific files
git stash push -m "partial" -- src/auth.ts src/user.ts

# Drop a stash
git stash drop stash@{1}
```

---

## Monorepo Git Patterns

```bash
# Only run CI for changed packages
git diff --name-only origin/main...HEAD | grep "^packages/"

# Sparse checkout — only clone part of a large monorepo
git clone --filter=blob:none --sparse https://github.com/org/monorepo
git sparse-checkout init --cone
git sparse-checkout set packages/my-package

# Tag per package
git tag packages/auth@1.2.0
git tag packages/api@2.0.1

# Find which package a file belongs to
git log --oneline -- packages/billing/
```

---

## Branch Protection Rules (GitHub/GitLab)

```yaml
# Recommended branch protection for main:
required_status_checks:
  strict: true           # must be up to date with main
  contexts:
    - "CI / test"
    - "CI / lint"
    - "CI / typecheck"

required_pull_request_reviews:
  required_approving_review_count: 1
  dismiss_stale_reviews: true
  require_code_owner_reviews: true

restrictions:
  push: []               # nobody can push directly to main
  force_push: false      # never allow force push to main
  delete: false          # never allow delete of main
```

---

## Emergency Recovery

```bash
# Accidentally deleted a branch?
git reflog                           # find the last commit hash
git checkout -b recovered-branch <hash>

# Accidentally force pushed?
git reflog origin/main              # see the hash before the force push
git push origin <hash>:main --force # restore it

# Committed to the wrong branch?
git log --oneline -3                # note the commit hash
git reset HEAD~1 --soft             # undo commit, keep changes staged
git stash                           # stash the changes
git checkout correct-branch
git stash pop                       # apply changes to correct branch
git commit -m "feat: the actual message"

# Accidentally committed secrets?
# 1. Rotate the secret IMMEDIATELY (assume it's compromised)
# 2. Remove from history:
git filter-repo --path secrets.env --invert-paths
# OR use BFG Repo Cleaner for simpler cases
```

---

> Powered by Kodelyth — Git is not just version control, it's your project's memory.
