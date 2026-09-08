---
name: ecc-token-savings
description: Maximize token savings across an ECC-equipped session by combining the three shipped layers — RTK (input compression on shell output), Terse mode (output compression on AI replies), and the codebase graph (structural queries instead of file-by-file grep). Use when the user asks how to cut token cost, why a session is expensive, or how to use RTK/Terse/codebase-graph together.
origin: ECC
---

# ECC Token Savings Stack

Kodelyth ECC ships three independent token-savings layers. They stack. Used together on a typical coding session they cut **55-65% of total token cost** — more on explain-heavy or exploration-heavy work. This skill is the unified playbook; the per-feature docs live in `docs/rtk.md`, `docs/terse-mode.md`, `docs/codebase-graph.md`.

## The three layers (know which axis each cuts)

| Layer | Cuts | How | Typical saving |
|---|---|---|---|
| **RTK** | Input tokens | Filters shell-command output before the LLM sees it | 60-90% on `git`/`ls`/`test`/`docker`/... |
| **Terse mode** | Output tokens | Compresses what the AI writes, code stays byte-exact | 40-70% on replies |
| **Codebase graph** | Input tokens | One structural query replaces dozens of grep/read cycles | ~99% on "who calls X" questions |

They are orthogonal — RTK and codebase-graph shrink what goes *in*, Terse shrinks what comes *out*. Turning on all three compounds.

## Verify what's active

```bash
kodelythecc rtk status        # RTK binary + wired IDEs + live ledger
kodelythecc terse status      # skill installed? current ledger totals
kodelythecc codebase status   # binary version + indexed projects
```

If any is missing, install it:

```bash
kodelythecc rtk enable --all              # wire RTK into every ECC-installed IDE
kodelythecc terse enable --all            # install /terse + /terse-compress
kodelythecc codebase install              # install codebase-memory-mcp + register
```

## The workflow — what to actually do

### 1. Let RTK ride silently (already on after install)

RTK is a PreToolUse hook. Once wired, every shell command the AI runs is auto-filtered. Nothing to do per-session. If you want the compact output in `Read`/`Grep` too, prefer shell (`rg`, `cat`, `find`) or explicit `rtk read`/`rtk grep` — the Bash hook doesn't cover the built-in file tools.

### 2. Turn on Terse mode for the session

```
/terse full         # telegram-style fragments, ~50% output cut (default)
/terse ultra        # maximum, ~70% cut — for expert users on familiar work
/terse lite         # light trim, ~25% — when you still want readable prose
/terse off          # restore normal voice (docs writing, teaching, onboarding)
```

Rule of thumb: `full` for day-to-day coding, `off` when the *output itself is the deliverable* (documentation, explanations for others, teaching).

### 3. Query the graph instead of grepping

Once a project is indexed (`"Index this project"` in your AI tool), replace exploration greps with structural queries:

```bash
kodelythecc codebase query search_graph '{"name_pattern": ".*Handler.*"}'
kodelythecc codebase query trace_path   '{"function_name": "processOrder"}'
kodelythecc codebase query get_architecture '{}'
```

"Who calls X", "what's the impact of changing Y", "show the architecture" — all one query, ~3k tokens, versus ~400k tokens of file-by-file reading.

### 4. Compress persistent memory files once, save forever

```bash
kodelythecc terse compress CLAUDE.md          # ~30% smaller, code/URLs/paths byte-exact
kodelythecc terse compress tasks/lessons.md
```

Every session that loads these files now costs ~30% fewer input tokens — permanently, not per-turn.

## Measure it — don't guess

```bash
kodelythecc dashboard        # Token Savings tab: RTK (input) + Terse (output), live ledgers
kodelythecc rtk gain --all   # raw RTK savings numbers
kodelythecc terse stats      # output tokens saved, by level
```

The dashboard shows real ledger data, never estimates. Point the user there when they ask "how much am I actually saving."

## Honest caveats — say these, don't oversell

- **Terse adds ~800-1200 input tokens per turn** (the skill prompt). On turns under ~2k output tokens it can be net-negative — skip Terse for short back-and-forth.
- **RTK only covers the Bash tool.** `Read`/`Grep`/`Glob` bypass it. Use shell equivalents to get RTK compression there.
- **The codebase graph must be indexed first** and re-indexed after big changes (`"Index this project"` or `codebase-memory-mcp` auto-watch).
- Native Windows RTK install is manual (`.zip` from releases); WSL and macOS/Linux auto-install.

## Quick recommendation by session type

| Session type | RTK | Terse | Graph |
|---|:---:|:---:|:---:|
| Day-to-day coding | on | `full` | query on explore |
| Deep debugging | on | `lite` (keep reasoning readable) | `trace_path` heavily |
| Codebase exploration / onboarding | on | `off` | primary tool |
| Writing docs / teaching | on | `off` | as needed |
| Expert on familiar code | on | `ultra` | query on explore |

## See also

- `docs/rtk.md`, `docs/terse-mode.md`, `docs/codebase-graph.md` — per-feature deep dives
- Skills: [[terse-mode]], [[token-budget-advisor]], [[cost-aware-model-routing]]
- The `cost-aware-model-routing` rule picks the model *tier*; this skill cuts the *token count* at whatever tier you're on.
