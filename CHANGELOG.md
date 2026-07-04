# Changelog

All notable changes to Kodelyth ECC are documented here.

## v2.4.1 — Intent routing v2 (July 2026)

Full design pass on `rules/common/agent-intent-routing.md` — the always-on rule that maps plain-language user intent to specialist agents. Deferred from 2.4.0.

### Added — 8 new routing dimensions layered above the existing 10-tier signal tables

1. **Confidence tiers** — high (route silently), medium (route + "not X? say so" tail), low (name 2 candidates, ask), none (answer directly, don't announce)
2. **Session-state awareness** — once routed to an agent, stay in its voice for follow-ups. Do NOT re-announce the same routing. Only re-route when the user's message contains a stronger signal for a different agent
3. **Anti-routing whitelist** — 6 situations where routing MUST be skipped (under 5 words with no code, one-line factual questions, explicit `use X`, "don't route", mid-workflow, ECC-itself bug reports)
4. **New signal families for v2.4+** — routes for `/terse`, `/terse-compress`, `codebase-memory-mcp` queries, `kodelythecc uninstall`, `kodelythecc dashboard`, IDE install
5. **Compound intent → parallel commands** — when 2 tables match at once, fire the parallel command instead of both agents sequentially (security+review → `/security-audit`, bug+multi-layer → `/debug-blitz`, etc.)
6. **Announcement style adapts to terse mode** — if `/terse` is active this session, drop the tip line and use one-token announcement `→ debug-detective` instead of the full form
7. **Cultural / multi-language cues** — read emotional markers in any language, strip filler like "bro"/"yaar"/"man", respond in the user's this-turn language, never translate code/errors/commands
8. **Evolve integration** — routing misses feed `~/.kodelythecc/evolve/routing-misses.jsonl` so the evolve pipeline can propose new triggers later

### Added — 5 new output-format examples

- Default (verbose)
- Terse mode active — one-token announcement
- Medium-confidence single match — with "wrong?" tail
- Low-confidence, two candidates — asks user to pick
- Sticky routing continuation — no re-announcement
- Compound intent → parallel command

### Verified

- All 21 tests pass
- Rule file grew from 707 → 832 lines (net +125 lines of new dimensions), 69 sections total
- The 10-tier priority signal tables (unchanged) remain the workhorse; the 8 new dimensions layer above them

## v2.4.0 — MCP auto-register + full uninstall (July 2026)

Real bugs surfaced by live user testing on a fresh Mac install.

### Fixed

- **ECC's own MCP server was never registered anywhere** on install. Result: Claude Desktop showed "1 setup issue: MCP", the Codebase / MCP status views showed nothing, and no tool got to talk to our own MCP. `scripts/mcp/register-self.js` now writes `kodelyth-ecc` under `mcpServers` in both `~/.claude.json` (Claude Code) and `~/Library/Application Support/Claude/claude_desktop_config.json` (Claude Desktop). Idempotent — no duplicates on re-run.
- **Codebase Architecture snapshot was empty** on the dashboard when no active session graph existed. Dashboard now falls back to a per-project list (project name + nodes + edges) via `list_projects`, so users can see the 8 projects codebase-memory-mcp has indexed even before opening one in-session.
- **`mcp-register` subcommand was swallowed** by the `mcp-*` catch-all (like `mcp-status` was earlier). Excluded properly.

### Added

**MCP self-registration**
- `kodelythecc mcp-register` — write ECC's MCP entry into Claude Code + Desktop configs
- `kodelythecc mcp-register --status` — show which configs already have it
- `kodelythecc mcp-register --unregister` — remove ECC's entry
- **Auto-runs in post-install** — after `--target claude-code` succeeds, ECC registers itself in both configs and prints a summary. Opt out with `--no-mcp-register`

**Full uninstall** (`scripts/cli/uninstall.js`)
- New menu row: **Uninstall ECC completely**
- CLI: `kodelythecc uninstall --dry-run | --yes | --yes --keep-memory`
- Removes only files that were shipped by ECC (checks against the package's own `agents/skills/commands/hooks/rules/scripts/` — safe for user-authored siblings)
- Unwires RTK (`rtk init -g --uninstall`)
- Removes codebase-memory-mcp agent configs (`codebase-memory-mcp uninstall`)
- Removes ECC's MCP entry from Claude Code + Desktop
- Removes `~/.kodelythecc/` (memory + ledgers + cache)
- Removes legacy `.kodelyth.backup-*` dirs
- Dry-run mode identifies **759 ECC files** across 6 subdirs on a fresh install

### Verified live end-to-end on this Mac

- `mcp-register --status` (before): both configs empty
- `mcp-register` writes both:
  ```json
  "kodelyth-ecc": { "command": "kodelythecc", "args": ["mcp"], "env": {} }
  ```
- `~/.claude.json` now has `mcpServers.kodelyth-ecc` + existing `mcpServers.codebase-memory-mcp` (co-existing, no clobber)
- `uninstall --dry-run` correctly counts 70 agents + 301 skills + 99 commands + 12 hooks + 104 rules + 173 scripts = 759 files, plus 1 backup dir
- Nothing removed on dry-run — verified

## v2.3.0 — Interactive arrow-key CLI menu (July 2026)

Run `kodelythecc` (or `kodelyth-ecc`) with no args in a real terminal and an arrow-key menu opens.

### Added

**Interactive menu** (`scripts/cli/menu.js` — zero dependencies)
- Arrow-key up/down navigation, Enter to select, `q` / esc / Ctrl+C to quit
- Vim-style `j`/`k` also work
- Options:
  - **Update to vX.Y.Z** — only shown when a newer version exists on npm (24h-cached check)
  - **Open Dashboard** — boot localhost dashboard (RTK + Terse + Codebase + Memory, all real data)
  - **Install ECC for another IDE** — inline picker across 13 IDE targets, runs `--target X` non-interactively
  - **RTK / Terse / Codebase status** — inline `kodelyth-ecc <sub> status` runs, then returns to menu on Enter
  - **Run in background** — daemonises the dashboard, writes PID to `~/.kodelythecc/dashboard-daemon.pid`, log to `~/.kodelythecc/dashboard-daemon.log`, prints stop command
  - **Exit**

**Update checker** (`scripts/cli/update-check.js`)
- Polls `https://registry.npmjs.org/kodelyth-ecc/latest` with 2.5s timeout
- Result cached to `~/.kodelythecc/update-check.json` for 24 hours to avoid nagging or spam
- Menu shows `up to date` / `latest: vX.Y.Z` / `update available: vX.Y.Z` (yellow) as appropriate
- Non-blocking: menu renders in <1s even if npm is slow

### Behaviour

- **Menu opens only when interactive** — real TTY on both stdin and stdout, no `CI` env, no `KODELYTH_NO_MENU=1` env
- **Piped stdin / CI runs the installer** — same as before, no menu, no breakage
- **Passing any flag or subcommand** — skips the menu entirely
- **Background daemon** — the dashboard child is `detach()`ed and `unref()`ed, survives the parent shell exit. Stop with `kill $(cat ~/.kodelythecc/dashboard-daemon.pid)`

### Verified live on this Mac

- `node bin/kodelyth-ecc.js` in a TTY → menu opens, arrow keys navigate
- `echo | node bin/kodelyth-ecc.js` → menu correctly skips, installer runs as before
- `require('./scripts/cli/update-check.js').check({current: '2.2.2'})` → live npm hit, returns `{latest: '2.2.2', updateAvailable: false, cached: false}` — real data, no fake fallback

## v2.2.0 — Codebase graph integration + self-documenting CLI (July 2026)

ECC now stacks three complementary memory + savings layers, all local, all real:

| Layer | What | Source |
|---|---|---|
| **BM25 session memory** | Problems + solutions you've solved before | ECC (built-in) |
| **RTK** | Input-token compression on shell output | rtk-ai/rtk |
| **Terse mode** | Output-token compression on AI replies | ECC (inspired by Caveman) |
| **Codebase graph** | AST-parsed code graph, 158 languages, structural queries | DeusData/codebase-memory-mcp |

Together: ~99% token reduction on structural code queries (their number), 55-65% on typical LLM turns (ours). No cloud, no telemetry, no API keys.

### Added

**Codebase graph MCP integration** (`scripts/codebase/index.js`)
- Wraps [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) — MIT, single static binary, tree-sitter across 158 languages
- Auto-install path: their official curl script → binary lands at `~/.local/bin/codebase-memory-mcp`
- Their `install` command auto-registers MCP entries in every installed AI-coding agent
- After install, users say **"Index this project"** in their AI tool — done

**CLI** (`kodelyth-ecc codebase <cmd>`)
- `install` — install binary + auto-register with all agents
- `status [--json]` — version, indexed projects, cache dir
- `register` — re-run their auto-configure step
- `query <cli-cmd> [json]` — pass-through to `codebase-memory-mcp cli` (real graph queries)

**Post-install auto-wire**
- Opt-in on `--codebase-graph` or `--all` flag (off by default to avoid surprise binaries)
- Idempotent — reuses existing install if present

**Dashboard**
- New **Codebase** tab: binary version, indexed project count, graph nodes/edges, languages, entry points — **all real data**, zero fallbacks
- Renamed **RTK Savings** tab → **Token Savings** (RTK input + Terse output on one tab)

**Self-documenting CLI**
- `kodelyth-ecc rtk --help`
- `kodelyth-ecc terse --help`
- `kodelyth-ecc codebase --help`
- `kodelyth-ecc mcp --help`
- `kodelyth-ecc dashboard --help`

No more "read the README" — every subcommand has focused inline help.

### Verified live on this Mac

- MCP server boot: `[kodelyth-mcp] ready · 2.2.0 · 16 tools · 6 prompts · 381 resources` in <1s
- BM25 memory hooks confirmed wired: `UserPromptSubmit` (recall, sync, 3s timeout) + `Stop` (capture, async, 10s timeout)
- Codebase status: `codebase-memory-mcp 0.8.1 · 8 indexed projects · cache at ~/.cache/codebase-memory-mcp`
- Dashboard `/api/codebase` returns real snapshot, zero hardcoded values

### Attribution

- **DeusData/codebase-memory-mcp** — MIT. Their binary, their curl script, we wrap. If upstream disappears, we fork + vendor (MIT permits).
- **rtk-ai/rtk** — Apache-2.0. Wrapped since v1.9.0.
- **JuliusBrussee/caveman** — MIT. Design inspiration for terse-mode (independent implementation).

### Compatibility

- Backwards-compatible with v2.1.x
- Codebase graph OFF by default (opt-in via `--codebase-graph` on install or `kodelyth-ecc codebase install`)
- BM25 memory unchanged
- RTK + Terse unchanged
- Dashboard adds a tab; existing tabs preserved

## v2.1.2 — Install-flow fixes caught by live user testing (July 2026)

Ran the actual `npx kodelyth-ecc --target claude-code` flow as a user would, end-to-end. Three real bugs surfaced and got fixed.

### Fixed

- **`--target claude-code` was rejected** with "Unknown target." install.sh only knew `claude-home`, but every doc, README, and CHANGELOG example uses `claude-code`. install.sh now accepts both (`claude-home|claude-code)` case)
- **Post-install RTK block silently skipped** on the (correct) `--target claude-code` because `TARGET_MAP` was keyed on `claude-home`. Added `normalizeTarget()` and both the RTK and terse post-install blocks now normalise the target before lookup. `gemini-cli` → `gemini-home`, `cursor` → `cursor-project` also normalised
- **install.sh `/dev/tty` read failed on piped/CI shells** even though the guard tested `-e /dev/tty`. Guard now also tests `-r /dev/tty` and honours `KODELYTH_NONINTERACTIVE=1` env (Windows PowerShell path already set this)
- **install.sh footer showed stale `v1.8.1`** from a leftover VERSION file. Bumped to current

### Verified end-to-end on this Mac

```
$ npm i -g kodelyth-ecc && kodelyth-ecc --target claude-code
  ...
━ RTK token savings ─────────────────────────────
  ✓ RTK 0.42.4 — wired for claude-home
  ✓ Restart your AI tool to activate. 60-90% token savings on shell commands.

━ Terse mode ────────────────────────────────────
  ✓ /terse and /terse-compress installed for claude-home
  · Activate any time: type /terse in your AI tool (dormant until you do)
```

Files land at `~/.claude/skills/terse-mode/SKILL.md` and `~/.claude/commands/terse.md`. Discoverable by the AI on next session.

### Added

- `scripts/rtk/index.js` — `normalizeTarget(target)` exported. Accepts `claude-code`, `gemini-cli`, `cursor` and returns the canonical install.sh target names. `roocode` and `kimi` also added to `TARGET_MAP`

## v2.0.0 — Terse mode: output-token compressor + memory compressor (July 2026)

RTK saves input tokens. Terse mode now saves output tokens. Together — on a typical coding session — ECC cuts ~55-65% of total token cost while keeping code, commands, and errors byte-exact.

**Inspired by [Caveman](https://github.com/JuliusBrussee/caveman) (MIT, by Julius Brussee).** Our implementation is independent: our own prompt, own compressor, own ledger, own dashboard tile. Credit to Julius for the core insight — "make the mouth smaller, not the brain smaller."

### Added

**Terse mode skill + slash commands** (works across every ECC-installed IDE)
- `skills/terse-mode/SKILL.md` — 4-level dial (lite / full / ultra / off), byte-preserves code/commands/URLs/paths
- `commands/terse.md` — `/terse [lite|full|ultra|off]` sticks for the session
- `commands/terse-compress.md` — one-shot memory-file compression via LLM

**Deterministic memory compressor** (scriptable, no LLM required)
- `scripts/terse/compress.js` — zero-dep markdown compressor. Strips 40+ filler patterns, merges wrapped prose, byte-preserves fenced code / inline code / URLs / paths / YAML frontmatter. Idempotent, safe to re-run
- `kodelyth-ecc terse compress <file> [--dry-run] [--no-backup]` — CLI wrapper
- On real prose-heavy content: ~30% byte reduction, 100% code/URL/path integrity

**Output-token savings ledger + dashboard tile**
- `scripts/terse/ledger.js` — JSONL ledger at `~/.kodelythecc/terse/ledger.jsonl`. Per-turn record: level, actual output tokens, estimated baseline, saved
- `/api/terse` dashboard endpoint
- New "Output savings (Terse mode)" section on the RTK Savings tab: totals, level breakdown, 30-day daily bar chart
- Renamed the tab's implicit RTK header to "Input savings (RTK)" so both axes read cleanly

**CLI**
- `kodelyth-ecc terse status` — shipped/installed/ledger paths
- `kodelyth-ecc terse stats [--json]` — turns tracked, tokens saved, savings %, level breakdown
- `kodelyth-ecc terse enable [--target X | --all]` — installs skill + commands into one or every ECC-detected IDE

**Auto-install on ECC install**
- After the base installer succeeds, terse-mode files are copied into the target IDE's `skills/` and `commands/` directories automatically. Dormant until user types `/terse` — respects "no forced verbosity change"

**Phase C — bake-in to existing agents**
- `agents/code-reviewer.md` — opt-in terse section: one-line PR comments when `/terse` active
- `agents/release-captain.md` — opt-in terse section: Conventional Commit ≤50-char subjects, terse changelog rows, rollback plan stays complete

### Changed

- Major version bump: adds a new user-visible mode (terse) that changes AI output style. Breaking only in the sense of "your AI now has a new toggle." No existing behavior removed
- Dashboard RTK Savings tab now shows both input (RTK) and output (Terse) savings side by side

### Compatibility

- Fully backwards-compatible with v1.9.x installs
- Terse mode never auto-activates — user opts in per session
- RTK integration unchanged
- Memory paths (`~/.kodelythecc/`) unchanged
- Zero-dep: terse mode ships as a prompt + a plain-JS compressor. No extra npm dependencies

### Honest math

- Combined RTK + Terse on a typical coding session: 55-65% total token reduction
- On explain-heavy or review sessions: closer to 65-70%
- Terse mode adds ~800-1200 input tokens per turn (the skill prompt) — net-negative on turns with <2k output tokens
- Memory compressor: one-time rewrite of `CLAUDE.md` / `lessons.md` — cuts ~30-46% every session forever

## v1.9.1 — Smoothness pass on RTK integration (July 2026)

Follow-up polish on 1.9.0. Cleaner output, agents now say the right paths, one-shot multi-IDE RTK setup.

### Fixed

- `rtk init --codex/--gemini/--opencode/--agent X` rejected `--auto-patch` and silently failed. `enableFor()` now only passes `--auto-patch` to the default Claude Code hook flow, where RTK accepts it. Multi-IDE enable now succeeds 3/3 instead of 2/3
- 24 memory-path references across 11 agent/skill/rule/command markdown files still said `~/.kodelyth/` — agents were teaching users the wrong path. Now all say `~/.kodelythecc/` (matches the 1.8.6 runtime rename)

### Added

- `kodelyth-ecc rtk enable --all` — auto-detects every IDE ECC has been installed for on this machine (checks `~/.claude/agents`, `~/.cursor/rules`, `~/.codeium/windsurf`, `~/.antigravity`, `~/.codex`, `~/.config/opencode`, `~/.gemini`) and wires RTK into all of them in one command
- `scripts/rtk/index.js` — `detectInstalledTargets()` export

### Changed

- Post-install output: replaced the raw JSON dumps with a tight 3-line summary (RTK version, target IDE, next step)
- `kodelyth-ecc rtk status`: human-readable by default (was JSON); use `--json` for machine output. Now also lists detected ECC-installed IDEs so you can see which ones `--all` will wire

## v1.9.0 — RTK integration + revived dashboard (July 2026)

ECC now auto-installs [RTK](https://github.com/rtk-ai/rtk) (Rust Token Killer) and wires its transparent command filter into whichever IDE ECC was installed for. Real token savings (60-90% on shell commands) show up in the dashboard, pulled straight from RTK's own ledger — no synthetic numbers.

### Added

- `scripts/rtk/index.js` — RTK integration module: `install()`, `enableFor(target)`, `disableFor(target)`, `status()`, `savings()`
- `kodelyth-ecc rtk <install|enable|disable|status|gain>` — CLI subcommands to manage RTK from ECC
- Post-install auto-hook: after `npx kodelyth-ecc --target <ide>` succeeds, ECC auto-installs the RTK binary (Homebrew on macOS, curl script elsewhere) and runs `rtk init` for the target IDE. Opt out with `--no-rtk`
- Target map covers 10 install targets: `claude-code`, `cursor`, `cursor-project`, `windsurf-home`, `windsurf-project`, `antigravity`, `codex-home`, `opencode`, `cline`, `gemini-cli`
- `/api/rtk` + `/api/rtk/status` dashboard endpoints — surface RTK's live ledger
- New **RTK Savings** tab in the dashboard: total tokens saved, raw tokens seen, avg reduction %, active IDE integrations, 30-day daily bar chart

### Changed

- Dashboard nav order: `Overview → RTK Savings → Memory → Evolve → Catalog → Sessions`

### Notes

- Windows auto-install is skipped (RTK requires manual .zip download on native Windows); WSL follows the Linux path
- RTK setup is best-effort — if brew/curl aren't available, install fails gracefully with a hint to run `kodelyth-ecc rtk install` later
- Existing RTK installs are detected and reused; no double-install

## v1.8.6 — Memory path rename + auto-migration (July 2026)

Renamed the on-disk memory root from `~/.kodelyth/` to `~/.kodelythecc/` across every runtime path. Existing installs auto-migrate on first CLI invocation or hook fire — idempotent, non-destructive, keeps a dated backup of the old directory.

### Changed

- All 20 runtime JS files: memory, hooks, dashboard, evolve, MCP, router, tests now point at `~/.kodelythecc/` (42 replacements total)
- `scripts/memory/store.js` — default `MEMORY_DIR` now `~/.kodelythecc/memory/`; runs migration on `require`
- `bin/kodelyth-ecc.js` — runs migration on every CLI invocation (no-op after first run)
- `KODELYTH_MEMORY_DIR` and related env vars kept unchanged for backwards compat

### Added

- `scripts/migrate-legacy.js` — one-shot migrator: merges memories, copies sibling files (index, patterns, projects/, evolve/, safety/, mcp-clients.json), renames old dir to `~/.kodelyth.backup-YYYY-MM-DD`, drops `.migrated-from-kodelyth` marker so it never runs twice

### Behavior

- **New users**: get `~/.kodelythecc/` from the start
- **Existing users** (have `~/.kodelyth/`): data migrated on next CLI run or hook fire; original preserved as backup

## v1.8.0 — Visual system overhaul + SVG polish (May 2026)

Comprehensive overhaul of all 31 social assets. GitHub social preview and OG image rebuilt with two-panel stat card layout. All text overflow issues fixed across the full SVG set. Test counts updated to 373. PNG exports regenerated at 4K only.

### Changed

- `github-social-preview.svg`, `og-image.svg` — full redesign: two-panel layout (brand mark left, 2×2 stat cards right), dot grid texture, amber accent on SKILLS card and AGENTS top bar, platform rows in footer
- `og-image.svg`, `github-social-preview.svg` — KODELYTH wordmark font-size/letter-spacing reduced so text stays within the left panel (no overflow past separator)
- `facebook-v150.svg` — stat section overflow fix: "70" numeral baseline raised so cap-top sits below separator line; divider lines extended to fully contain the numeral
- `hype-compound-learning.svg`, `hype-devil-mode.svg`, `hype-mcp-server.svg`, `hype-parallel-agents.svg` — bottom bar rect and text shifted up 8 px to give descenders safe margin from canvas edge
- `hype-stats-hero.svg`, `fb-post-platforms.svg` — test counts updated: 336/348 → 373, 24 → 25 test files
- All 31 social SVGs: v1.7.5 → v1.8.0 version badge
- Ghost Depth Mark applied across all social assets; favicon and og-image added for kodelyth.com (carried from v1.7.5)
- PNG exports: all 31 assets regenerated at 4× scale (4K); fullhd 2× exports removed
- README test badge: 336 → 373 passing
- SECURITY.md supported versions table updated to reflect 1.8.x as current stable

## v1.7.4 — Real-time IDE-aware dashboard + cross-IDE memory protocol (May 2026)

The dashboard now sees what every IDE on the machine is doing in real time, not just Claude Code. Memory continuity across IDEs is documented and operationalised through the universal `memory-protocol.md` rule and the existing MCP tool surface.

### Added

- **Sessions → Live IDE activity** card in the dashboard, surfacing the most recently modified session files from Claude Code (`~/.claude/projects/`), Windsurf (`~/.codeium/windsurf/`), Windsurf-Next (`~/.codeium/windsurf-next/`), Cursor (OS-aware workspaceStorage path), Antigravity (`~/.antigravity/` + `<cwd>/.agent/`), plus a generic `custom` row for `KODELYTH_EXTRA_IDE_WATCH` paths
- New `GET /api/ide-sessions` endpoint (read-only, no SQLite reads — stat-only, hard-capped at 500 files per walk)
- New `KODELYTH_EXTRA_IDE_WATCH` env var (comma / semicolon / colon separated) so power users can wire arbitrary directories into the realtime watcher
- New `KODELYTH_WINDSURF_NEXT_DIR`, `KODELYTH_CURSOR_DIR`, `KODELYTH_ANTIGRAVITY_DIR` env-var overrides for non-default IDE install paths
- New section in `README.md` — **"Memory & dashboard reality per IDE"** — explicit truth table of what auto-recall, auto-capture, manual recall, and dashboard activity look like per platform
- 12 new tests (`tests/dashboard/data.test.js` + `server.test.js`) covering windsurf-next, cursor, antigravity, custom watch paths, and SSE behaviour. Total: **336 → 373 tests, all passing**

### Changed

- `rules/common/memory-protocol.md` — now explicitly instructs non-Claude-Code IDEs (Windsurf, Cursor, Codex, Antigravity, etc.) to proactively call the `recall_memory` and `capture_memory` MCP tools. Includes exact tool signatures and CLI equivalents. Auto-installed for every target via `.windsurfrules` / `.cursor/rules` / `.agent/rules`
- Dashboard SSE poll interval **10 s → 3 s** (3× faster realtime, still zero CPU when no browser is connected)
- `WATCH_PATHS` now includes `~/.kodelyth/evolve/routing-misses.jsonl` AND `~/.kodelyth/evolve/proposals.jsonl` (previously only `proposals.jsonl`, which often doesn't exist), plus the `~/.kodelyth/token-budget/` directory mtime
- Dashboard UI version badge: v1.7.0 → v1.7.4
- Source comments in `scripts/dashboard/server.js` + `data.js`: v1.7.0 → v1.7.4
- All 14 active social SVGs: v1.7.3 → v1.7.4 (27 total replacements)
- `social/github-social-preview.svg` test-count line: 336 → 348
- `wiki/Installation-Guide.md` test-count references: 336 → 348
- `README.md` test coverage badge in comparison table: 336 → 348
- `package.json` + `VERSION`: 1.7.3 → 1.7.4

### Fixed

- **Broken watch path** — `scripts/dashboard/server.js` previously watched `~/.kodelyth/evolve/proposals.jsonl` only. That file does not exist until the user runs `kodelyth-ecc evolve analyze`, so routing-miss writes never triggered SSE refreshes for most users. Now both files are watched.
- Token-budget tab now triggers SSE refresh when budget files appear (previously the tab stayed stale).

### Verified live

- SSE `data-changed` latency: ~9 s → ~1.5 s after touching a watched file
- `/api/ide-sessions` correctly surfaces mixed Claude Code + Windsurf rows on a real user's machine
- `KODELYTH_EXTRA_IDE_WATCH` end-to-end: pointing at an arbitrary `tmp` dir surfaces as a `custom` platform row

---

## v1.7.3 — Full version sync across all SVGs and docs (May 2026)

Consistency pass: every version badge, terminal line, and current-version reference across
all social SVGs and wiki pages now shows v1.7.3. Historical "introduced in v1.7.0" section
annotations in wiki pages are preserved as-is.

### Changed

- `social/readme-hero.svg` — version badge + terminal lines: v1.7.1 → v1.7.3
- `social/github-social-preview.svg` — version badge + terminal line: v1.7.1 → v1.7.3
- `social/facebook-v150.svg` — version badge: v1.7.1 → v1.7.3
- `social/card-install.svg` — terminal install line: v1.7.0 → v1.7.3
- `social/section-mcp.svg` — MCP section badge: v1.7.0 → v1.7.3
- `social/x-card-agents-grid.svg` — version badge: v1.7.0 → v1.7.3
- `wiki/FAQ.md` — toolkit version in opening description: v1.7.1 → v1.7.3
- `wiki/Home.md` — version header and Key Features heading: v1.7.2/v1.7.0 → v1.7.3
- `package.json` + `VERSION` — 1.7.2 → 1.7.3

---

## v1.7.2 — Final platform count clean-up (May 2026)

- Fix two remaining `12 platforms` references in `wiki/FAQ.md` and `wiki/Home.md`
- Sync `VERSION` file to match `package.json`
- Update `wiki/Home.md` version badge to v1.7.1 → v1.7.2

---

## v1.7.1 — Platform count correction + SVG glow fix (May 2026)

Accuracy patch: all docs, social assets, and the wiki now consistently reflect the correct
platform count (11 platforms, 13 install targets — Windsurf and Gemini CLI each expose two
install targets but remain one platform).

### Fixed

- **Platform count** — `12 platforms` corrected to `11 platforms` across README, CLAUDE.md,
  wiki (FAQ, Home, Installation-Guide, Skill-Reference, Platform-Support), and all social SVGs.
- **Platform-Support wiki** — complete rewrite with accurate capability matrix, correct
  install-directory paths (`.clinerules/` not `.cline/`, `.roo/` not `.roocode/`,
  `.aider-ecc/` not `.aider/`, `.agent/` project-local not `~/.antigravity/`),
  and honest notes on Cursor agent incompatibility and OpenCode rules-only support.
- **SVG glow on Kodelyth text** — removed `filter="url(#glow)"` (feGaussianBlur stdDeviation 8)
  and `filter="url(#softglow)"` from all text elements in `github-social-preview.svg` and
  `readme-hero.svg`. Text is now sharp at all sizes.
- **GitHub About** — updated from stale v1.5 counts (62 agents/188 skills/80 commands) to
  current accurate counts (70 agents/194 skills/97 commands/22+ hooks).

### Files changed

`README.md` · `CLAUDE.md` · `wiki/Platform-Support.md` · `wiki/FAQ.md` · `wiki/Home.md` ·
`wiki/Installation-Guide.md` · `wiki/Skill-Reference.md` · `social/readme-hero.svg` ·
`social/github-social-preview.svg` · `social/section-install.svg` · `social/facebook-v150.svg`

---

## v1.7.0 — MCP SERVER: Universal adapter for any agent framework (May 2026)

ECC is now consumable from Claude Desktop, LangGraph, AutoGen, CrewAI, OpenAI Agents SDK, Cursor, Windsurf, and any MCP-compatible client. Every framework that speaks Model Context Protocol can now route to ECC's 70 agents, 194 skills, 97 commands, and the local self-learning memory store.

### New: MCP server (`npx kodelyth-ecc mcp`)

A thin, stdio-only MCP server (Node, JSON-RPC) that exposes the full ECC stack:

- **16 tools** — `route_intent`, `list_agents`, `list_skills`, `list_commands`, `list_rules`, `list_bundles`, `get_agent`, `get_skill`, `get_command`, `get_rule`, `get_bundle`, `recall_memory`, `capture_memory`, `memory_stats`, `catalog_stats`, `audit_skill_match`.
- **6 prompts** — `routing-rule` (full 10-tier intent routing), `agents-overview`, `skills-overview`, `commands-overview`, `handoff-chains`, `devil-mode`.
- **365 resources** — every agent, skill, command, rule, and bundle addressable via `kodelyth://agents/<name>`, `kodelyth://skills/<name>`, `kodelyth://commands/<name>`, `kodelyth://rules/<name>`, `kodelyth://bundles/<name>`. All `text/markdown`.

Design principles:

- **Pure file reads + memory passthrough.** Server adds zero LLM calls of its own.
- **Local only.** stdio transport. No network egress. No telemetry.
- **Optional dependency.** `@modelcontextprotocol/sdk` is in `optionalDependencies` — installs work without it; the `mcp` subcommand prints a friendly install hint if missing.
- **Cached catalog.** Sub-millisecond catalog reads after first hit.
- **Project-aware memory.** `recall_memory` accepts an optional `project_root` to scope BM25 results, falling back to global memories if scoped results are sparse.

### New files

- `scripts/mcp/server.js` — SDK wiring + stdio transport (lazy-loaded).
- `scripts/mcp/tools.js` — 16 tool handlers + tool definitions.
- `scripts/mcp/prompts.js` — 6 prompt definitions.
- `scripts/mcp/resources.js` — 365-resource catalog with `kodelyth://` URIs.
- `scripts/mcp/catalog.js` — read-only loader for agents/skills/commands/rules/bundles with minimal YAML frontmatter parser.
- `docs/mcp.md` — full reference, client config snippets, design notes, troubleshooting.
- `tests/mcp/catalog.test.js` — catalog loader + frontmatter parser (12 tests).
- `tests/mcp/tools.test.js` — pure-function tool handlers including memory roundtrip (15 tests).
- `tests/mcp/resources-prompts.test.js` — resource discovery + prompt rendering (8 tests).

### Updated files

- `bin/kodelyth-ecc.js` — `mcp` subcommand dispatch, help text updated.
- `package.json` — `mcp` and `model-context-protocol` keywords, `optionalDependencies` for `@modelcontextprotocol/sdk@^1.0.4`, `npm run mcp` script.
- `README.md` — new "MCP server" section under install options with Claude Desktop config snippet.

### CLI surface

```bash
npx kodelyth-ecc mcp                         # start stdio MCP server
npx kodelyth-ecc --help                      # mcp subcommand documented
```

### Test count

47 → **82 tests** (added 35 MCP server tests). Final v1.7.0 count is **336 tests** — covering MCP server, model router, swarm orchestrator, session replay, supply-chain tooling, safety hooks, self-evolving memory, and the local observability dashboard.

### Counts (post-1.7.0)

| Asset            | Count |
|------------------|-------|
| Agents           | 70    |
| Skills           | 194   |
| Slash commands   | 97    |
| Parallel commands| 8     |
| Rules            | 14    |
| Power bundles    | 3     |
| MCP tools        | 16    |
| MCP prompts      | 6     |
| MCP resources    | 377   |
| Hooks            | 22+ (incl. prompt-injection-guard + token-budget) |
| Install targets  | 12    |
| Tests            | 336   |

### New: Local observability dashboard

A localhost-only single-page web UI over every local data source ECC produces. Zero telemetry, zero external runtime dependencies, fully offline, read-only.

Delivered surfaces:

- **`scripts/dashboard/server.js`** — HTTP server using ONLY Node.js built-ins (`http`, `fs`, `path`, `child_process`). Eight JSON API routes + one static-file route. GET-only — any other method returns 405. Hardened response headers on every reply (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`). Path-traversal-safe static resolution sandboxed under `scripts/dashboard/static/`.
- **`scripts/dashboard/data.js`** — pure aggregators across catalog, BM25 memory store, evolve signals + proposals, swarm/orchestration sessions, and token-budget hook state. Every read defensively wrapped — broken data sources render empty cards, never crash the dashboard.
- **`scripts/dashboard/static/index.html`** — single-page UI. Hand-rolled CSS (no Tailwind, no CDN), vanilla JavaScript (`fetch`-only), no build step, no transpilation. Five tabs: Overview / Memory / Evolve / Catalog / Sessions. Lazy-loads each tab's data only when shown. 15-second health-ping pulses a green liveness indicator.
- **`bin/kodelyth-ecc.js`** — new `dashboard` subcommand. `--port N`, `--host H`, `--no-open` flags. **Refuses to bind non-localhost without `KODELYTH_DASHBOARD_ALLOW_REMOTE=1`** — the escape hatch is intentionally noisy. Default port 5747. Auto-opens browser on macOS (`open`), Linux (`xdg-open`), Windows (`start`).
- **`skills/observability-dashboard/SKILL.md`** + **`commands/dashboard.md`** + **`docs/dashboard.md`** — explicit-invocation skill, slash command, and full reference docs with curl examples.
- **`tests/dashboard/{data,server}.test.js`** — 39 new tests. Aggregator tests cover overview shape, catalog filtering, session detail reading, token-budget JSON aggregation, malformed-input resilience. Server tests boot the real HTTP server on ephemeral ports and exercise every route + every security guardrail (POST blocked, bad-kind 400, path traversal blocked, hardened headers present, remote-bind refused, override env var honored).

API surface (read-only, GET-only):

```
GET /api/health                            # liveness
GET /api/overview                          # counts + storage paths
GET /api/memory[?limit=N]                  # stats + recent captures
GET /api/memory/search?q=…[&limit=N]       # BM25 search
GET /api/evolve[?limit=N]                  # reuse + miss + proposals
GET /api/catalog?kind=…[&q=…&limit=N]      # agents | skills | commands | rules | bundles
GET /api/sessions[?limit=N]                # swarm session list
GET /api/sessions/:name                    # one session, all workers
GET /api/token-budget                      # per-session token usage
```

The frontend is a thin consumer of these. Anything the UI shows you can also pipe through `jq`:

```bash
curl -s http://127.0.0.1:5747/api/evolve | jq '.proposals[] | select(.status == "pending")'
```

Verified end-to-end: booted on an ephemeral port → 200 OK on every happy path → 400 on bad kind → 404 on unknown route → 405 on POST → hardened headers present on every response → remote bind to `0.0.0.0` refused with the documented error message → override env var allows it.

Pairs with: BM25 memory store (Memory tab data source), swarm orchestrator (Sessions tab), token-budget hook (Overview budget snapshot), and self-evolving memory (Evolve tab). The Evolve tab makes the proposal state machine visible at a glance — status pills (⏸ ✓ ✗ ★) reflect the same state the CLI sees.

### New: Self-evolving memory

The BM25 memory system now closes its own learning loop. Repeated memory hits become draft skills. Repeated routing misses become proposed routing-rule additions. **Nothing is ever auto-applied** — the user reviews, accepts (writes a draft file to disk), edits, and commits.

Delivered surfaces:

- **`scripts/evolve/stats.js`** — pure record/read of two signal streams in `~/.kodelyth/evolve/`:
  - `reuse.json` — per-memory surface counter, idempotent per (memoryId, sessionId), tracks distinct sessions + projects
  - `routing-misses.jsonl` — append-only log of substantive prompts where memory recall returned zero matches; capped at 1000 chars per prompt
- **`scripts/evolve/analyze.js`** — pure, deterministic, no I/O. Two analysis paths:
  - reuse → skill-upgrade proposals (default thresholds: count≥3 AND sessions≥2)
  - misses → routing-addition proposals (cluster by ≥2-token overlap; default thresholds: count≥3 AND distinct≥2)
  - proposal IDs are deterministic over evidence → re-running `analyze` never duplicates
- **`scripts/evolve/proposals.js`** — append-only proposal log with state transitions: `pending → accepted → applied` or `pending → rejected`. Full audit trail preserved (every state change is a new event). `applyProposalToDisk` refuses to overwrite without `--overwrite`.
- **`hooks/memory/auto-recall.js`** — minimal augmentation. Two fire-and-forget calls: `recordSurface` when a memory is shown to the user, `recordRoutingMiss` when a substantive prompt yields zero matches. Both wrapped in try/catch — the hook NEVER blocks recall on stats failure.
- **`bin/kodelyth-ecc.js`** — new `evolve` subcommand with six sub-actions: `stats`, `analyze`, `list`, `show`, `accept`, `reject`. All support `--json`. Accept refuses to clobber existing files unless `--overwrite` is explicit.
- **`skills/self-evolving-memory/SKILL.md`** — explicit-invocation skill with full CLI reference, hard rules, composition matrix.
- **`commands/memory-evolve.md`** — `/memory-evolve` slash command (avoids collision with the pre-existing `/evolve` command for `continuous-learning-v2`).
- **`docs/evolve.md`** — full reference: signal definitions, threshold flags, proposal anatomy, sample diffs, worked example, hard rules.
- **`tests/evolve/{stats,analyze,proposals}.test.js`** — 42 new tests. Cover counter idempotence per session, distinct-session bumping, project deduplication, miss aggregation by hash, prompt capping, threshold gating, deterministic IDs, cluster overlap rules, append-only audit trail across pending→rejected→accepted, overwrite refusal, malformed input rejection, and combined `analyzeAll` cross-stream output.

Routing-addition diffs intentionally ship `TODO-agent` as the placeholder — even if accepted and committed verbatim, no real traffic gets routed until the user fills in the agent name. This is a deliberate safety property.

Verified end-to-end: seeded a memory, surfaced it 4x across 4 sessions, logged 3 routing-miss prompts on a shared token cluster, ran `evolve analyze` → 2 proposals generated, `evolve accept` wrote the skill draft to disk + marked accepted, `evolve reject --note` recorded the routing rejection. Re-running `analyze` did not duplicate. Append-only log preserved every state event.

CLI snapshot:

```bash
# After a few weeks of normal ECC usage:
npx kodelyth-ecc evolve stats             # snapshot of recorded signals
npx kodelyth-ecc evolve analyze            # signals → proposals (idempotent)
npx kodelyth-ecc evolve list               # what's pending
npx kodelyth-ecc evolve show <id>          # full draft + evidence
npx kodelyth-ecc evolve accept <id>        # write draft to disk (NEVER commits)
npx kodelyth-ecc evolve reject <id> --note "covered by existing agent"
```

Pairs with the BM25 memory store (signal source), `/memory remember` (manual capture), `rules/common/agent-intent-routing.md` (target for routing-addition proposals), swarm orchestrator (repeated swarm-task memories → skills the picker can choose), session replay (replay re-triggers reuse signals), and token-budget hook (skills are cheaper than per-prompt memory recalls).

### New: Supply chain — SLSA + SBOM + content manifest

Enterprise-grade supply-chain credentials. Every kodelyth-ecc release now ships with three independent attestations a downstream consumer can verify without trusting kodelyth-ecc:

1. **SLSA Level 3 build provenance** — sigstore-signed via `npm publish --provenance`. Verifiable on npmjs.com and via `npm audit signatures`.
2. **CycloneDX 1.5 SBOM** — `kodelyth-ecc-sbom.cdx.json`, attached to the GitHub release. Lists every component in `package-lock.json` with purl, license, and SHA-512 integrity.
3. **sha256 content manifest** — `kodelyth-ecc-manifest.json`, attached to the GitHub release. Hashes every shipped asset (730 files) so any consumer can detect tamper.

Delivered surfaces:

- **`scripts/supply-chain/sbom.js`** — CycloneDX 1.5 generator. Pure function, zero deps. Reads `package.json` + `package-lock.json` v3. Stable `serialNumber` derived from `name@version + timestamp`. Components carry purl (`pkg:npm/...`), normalized license, and base64→hex SRI hashes.
- **`scripts/supply-chain/manifest.js`** — deterministic content manifest. Walks `agents/`, `skills/`, `commands/`, `rules/`, `hooks/`, `scripts/`, `bin/`, `parallel-commands/`, `bundles/`, plus root files. Skips `node_modules/`, `.git/`, `.DS_Store`, `__pycache__/`, `*.pyc`. Top-level digest is sha256 over deterministic JSON of entries — reproducible.
- **`scripts/supply-chain/verify.js`** — pure-function verifier. Categorizes every file into `ok / modified / missing / extra`. Modified or missing files fail verify; extras are advisory. Schema-versioned at `kodelyth.content-manifest/v1`.
- **`bin/kodelyth-ecc.js`** — three new subcommands: `sbom [--out FILE] [--json]`, `manifest [--out FILE] [--json]`, `verify [--manifest FILE] [--json]`. `verify` exits 1 on any tamper.
- **`.github/workflows/publish.yml`** — extended to emit the SBOM + manifest after `npm publish --provenance` and upload both to the GitHub release via `gh release upload`.
- **`skills/supply-chain-verification/SKILL.md`** — explicit-invocation skill with full CLI reference, programmatic API, hard rules.
- **`commands/verify-supply-chain.md`** — `/verify-supply-chain` slash command.
- **`docs/supply-chain.md`** — full reference: artifact table, downstream verification flow, `npm audit signatures` integration, composition with other phases.
- **`tests/supply-chain/sbom.test.js`** + **`tests/supply-chain/manifest.test.js`** + **`tests/supply-chain/verify.test.js`** — 31 new tests. Cover SBOM round-trip on synthetic + real lockfiles, scoped purl, SRI base64→hex, deterministic manifest digest, all four verify categories (ok/modified/missing/extra), schema validation, round-trip across copy.

Verified end-to-end on the real repo: 730 files manifested, 91 SBOM components, full round-trip clean, single-byte tamper detected.

CLI snapshot:

```bash
# Generate the three artifacts
npx kodelyth-ecc sbom     --out kodelyth-ecc-sbom.cdx.json
npx kodelyth-ecc manifest --out kodelyth-ecc-manifest.json

# Verify a downstream install
npx kodelyth-ecc verify --manifest kodelyth-ecc-manifest.json
# → exit 0 if clean, exit 1 if any file is tampered or missing

# CI-friendly
npx kodelyth-ecc verify --manifest manifest.json --json | jq .ok
```

Pairs with swarm orchestrator (pre-flight verify), session replay (replay bundles can carry the producing toolkit's manifest digest), safety hooks (can warn on tampered toolkit), and the MCP server (can expose `verify` to downstream agents).

### New: Session replay

Every swarm coordination dir is now a portable, replayable artifact. Bundle a session into a single JSON file, ship it anywhere, re-run it with optional A/B variations (different harness, different agents, different base ref). Composes with swarm orchestrator and cost-aware model router for prompt regression testing and model A/B comparison.

- **`scripts/replay/bundle.js`** — pure read/write of session bundles. Stable schema `kodelyth.session-bundle/v1`. Exports task/handoff/status per worker, validates on import, supports diff between two bundles, auto-generates `-replay-N` session names.
- **`scripts/replay/replay.js`** — replay engine. Extracts shared task from bundle (prefers `meta.task`, falls back to parsing the worker's `## Shared Task` block, final fallback to orchestrator's `## Objective` block). Wires bundle + swarm builder + orchestrator with full variation support.
- **`bin/kodelyth-ecc.js`** — three new subcommands: `session-export <session> [--task] [--agents] [--harness] [--base-ref] [--out]`, `session-import <bundle> [--target] [--overwrite]`, `replay <bundle|session> [--harness] [--agents] [--base-ref] [--session] [--replace] [--execute|--write-only|--json]`.
- **`skills/session-replay/SKILL.md`** — explicit-invocation form with examples for bug-report bundles, model A/B tests, regression checks.
- **`commands/replay.md`** — `/replay` slash command.
- **`docs/replay.md`** — full reference: CLI commands, bundle format, replay reconstruction logic, variation matrix, hard rules, programmatic API.
- **`tests/replay/bundle.test.js`** + **`tests/replay/replay.test.js`** — 27 new tests covering bundle round-trip, schema validation, diff correctness, import/overwrite semantics, replay name generation, task extraction (3 fallback paths), variation flags, and orchestrator integration.

CLI snapshot:

```bash
# Export a finished swarm with rich meta
npx kodelyth-ecc session-export swarm-2026-05-10-4a \
  --task "audit oauth flow" \
  --agents security-reviewer,code-reviewer,pair-programmer,tdd-guide \
  --harness claude \
  --out oauth-audit.bundle.json

# Replay with a different harness (model A/B test)
npx kodelyth-ecc replay oauth-audit.bundle.json --harness codex --execute

# Replay with different agents
npx kodelyth-ecc replay oauth-audit.bundle.json \
  --agents supply-chain-auditor,prompt-injection-hunter,secret-hunter \
  --execute

# Replay against new code
npx kodelyth-ecc replay oauth-audit.bundle.json --base-ref refactor/oauth-rewrite --execute
```

Replays auto-name as `<original>-replay-N` to never collide. Bundles are pure JSON — diff-friendly for regression review and shippable as bug-report artifacts.

### New: Swarm orchestrator

The generalized form of `/devil-mode`, `/team-review`, `/security-audit`, and `/pre-release`. Pick any task, pick any agents (or let ECC pick from task signals), get N parallel git-worktrees + a tmux session ready to attach. Promotes the existing `tmux-worktree-orchestrator` infrastructure to a first-class CLI surface.

- **`scripts/swarm/build-plan.js`** — pure-function plan builder. Takes simple flags and produces a config compatible with the orchestrator. Smart agent picker: 14 signal classes (security, perf, API, tests, …), baseline anchors (code-reviewer + pair-programmer), 4/6/8-agent default rotations. Per-agent task shaping (required handoff sections).
- **`bin/kodelyth-ecc.js`** — new `swarm` subcommand: `--task`, `--agents N|name1,name2,...`, `--harness claude|codex|opencode|windsurf|echo`, `--seed`, `--session`, `--base-ref`, `--replace`, `--execute`/`--write-only`/`--dry-run`/`--json`, plus power-user `--plan plan.json`.
- **`skills/swarm-orchestrator/SKILL.md`** — explicit-invocation form; full pairing matrix with cost-router (2.4), token-budget hook (2.10), MCP client mode (2.5).
- **`commands/swarm.md`** — `/swarm` slash command.
- **`docs/swarm.md`** — full reference: CLI flags, smart agent picker, harness adapters, coordination protocol, lifecycle, troubleshooting.
- **`tests/swarm/build-plan.test.js`** — 21 new tests covering pickAgents (signal-driven, baseline, rotation, dedup, count clamping), shapeTaskForAgent, buildWorker (4 harnesses + custom), buildSwarmPlan (validation, orchestrator integration, explicit agents preserved, full pass-through).

CLI snapshot:

```bash
# Smart agent picking from signals:
npx kodelyth-ecc swarm --task "audit oauth flow for security regressions" --agents 4
# → picks security-reviewer + code-reviewer + pair-programmer + tdd-guide

# Explicit agents:
npx kodelyth-ecc swarm \
  --task "ship v2.0" \
  --agents release-captain,security-reviewer,e2e-runner \
  --execute

# Pre-launch full sweep:
npx kodelyth-ecc swarm --task "Pre-launch sweep for v2.0" --agents 8 --replace --execute
tmux attach -t swarm-2026-05-10-8a
```

Default mode is **dry-run** — prints a summary, doesn't spawn anything. `--write-only` materializes the coordination files (task.md / handoff.md / status.md per worker). `--execute` creates worktrees + tmux + launches agents with full rollback on failure.

### New: MCP client mode

The other half of MCP. While 2.1 serves ECC to any client, 2.5 lets ECC **consume** any external MCP server (Stripe, GitHub, Postgres, Redis, Brave, Filesystem, Shopify, anything). ECC is now the MCP **hub**.

- **`scripts/mcp/client.js`** — registry + connect/list-tools/call-tool/list-resources/read-resource/list-prompts/get-prompt helpers. Lazy-loads `@modelcontextprotocol/sdk` with a friendly install hint if missing.
- **`bin/kodelyth-ecc.js`** — five new subcommands: `mcp-add`, `mcp-list`, `mcp-remove`, `mcp-tools`, `mcp-resources`, `mcp-prompts`, `mcp-call`. JSON args via `--json '{"arg":"value"}'`. Env vars via `--env KEY=VAL`.
- **`docs/mcp-clients.md`** — full reference, examples for github/postgres/stripe/brave/filesystem/redis, programmatic API, privacy notes, troubleshooting.
- **`tests/mcp/client.test.js`** — 9 new tests including end-to-end stdio handshake using the LOCAL kodelyth MCP server itself as a real test target (registry persistence, addServer validation, listTools, callTool, listResources, listPrompts, error path).

CLI snapshot:

```bash
# Register
npx kodelyth-ecc mcp-add github \
  --env GITHUB_PERSONAL_ACCESS_TOKEN=ghp_... \
  -- npx -y @modelcontextprotocol/server-github

# Inspect
npx kodelyth-ecc mcp-list
npx kodelyth-ecc mcp-tools github

# Call
npx kodelyth-ecc mcp-call github create_issue \
  --json '{"owner":"sifxprime","repo":"kodelyth-ecc","title":"hi from ECC"}'
```

The registry lives at `~/.kodelyth/mcp-clients.json` (override with `KODELYTH_MCP_CLIENT_DIR`). Each call spawns a fresh stdio subprocess — no long-lived process pool, no credential leakage between sessions.

### New: Cost-aware model router

The orthogonal companion to agent intent routing. While intent routing picks _which specialist agent_ handles a task, this router picks _which model tier_ runs it — keeping teams from burning frontier-model tokens on doc typos and rename refactors.

- **`rules/common/cost-aware-model-routing.md`** — always-on rule. Three tiers (trivial/standard/hard) with weighted signal classification. Hard rules: security/incident/adversarial agents never downgrade; production framing wins; multi-file (3+) refactors never go to trivial; respect explicit user choice; bias downward when token-budget > 70%.
- **`skills/cost-aware-model-routing/SKILL.md`** — explicit-invocation form for "what model should I use" questions.
- **`commands/route-model.md`** — `/route-model` slash command for ad-hoc on-demand routing.
- **`scripts/router/classify.js`** — pure-function deterministic classifier with full config loader (env vars + `.kodelyth/router.json` project file).
- **`bin/kodelyth-ecc.js`** — new `route` CLI subcommand: `npx kodelyth-ecc route "<task>" [--files N] [--agent <name>] [--current <model>] [--json]`.
- **`tests/router/classify.test.js`** — 19 new tests covering classification, config precedence (env > project file > defaults), agent override, and disabled-mode.

Configuration surface:

```bash
# Disable entirely
KODELYTH_ROUTER=off

# Override per tier (provider-agnostic)
KODELYTH_ROUTER_TRIVIAL=gpt-4.1-mini
KODELYTH_ROUTER_STANDARD=claude-sonnet-4-6
KODELYTH_ROUTER_HARD=gpt-5

# Or via .kodelyth/router.json at project root
{ "trivial": "...", "standard": "...", "hard": "...", "notes": "set by infra team" }
```

Pairs with the `token-budget` safety hook for full cost discipline (the hook caps total spend; the router cuts the steady leak from frontier-model overuse on routine work). Together they typically reduce LLM bills by 50–70% with no measurable quality drop on standard tasks.

### New: Safety hooks

Two production-ready safety primitives that ride on the existing hook pipeline. **Off by default** — opt in via env vars so existing users see zero behavior change.

- **`hooks/safety/prompt-injection-guard.js`** — scans inbound text on `UserPromptSubmit` and `PostToolUse` (Read, WebFetch, mcp__*) for jailbreak / instruction-override patterns. Three modes: `off` (default), `warn`, `block`. Detects 11 pattern classes across 3 severity tiers (critical / high / medium) plus base64-decoded payload jailbreak detection. Configurable audit log at `KODELYTH_PI_GUARD_LOG`.
- **`hooks/safety/token-budget.js`** — per-session token-budget enforcer on `SessionStart` and `Stop`. Tracks usage via 4-chars-per-token heuristic over transcript size + visible message lengths. Three modes: `off` (default), `warn`, `<positive integer>`. Blocks `SessionStart` once usage ≥ budget; warns at 70%. State files live at `${KODELYTH_TOKEN_BUDGET_DIR}/budget-<sessionId>.json`.
- **`hooks/safety/lib/patterns.js`** — shared, auditable regex pattern catalog. 11 named patterns + decoded base64 probe.
- **`hooks/safety/README.md`** — full configuration + rollout guide.
- **`tests/safety/*.test.js`** — 29 new tests covering pattern detection, hook block/warn/off paths, malformed JSON recovery, and reset flow.

Both hooks always exit 0 on internal errors so they never block users due to a bug.

### Test count

47 → **336 tests** (added 35 MCP server + 9 MCP client + 29 safety + 19 router + 21 swarm + 27 replay + 31 supply-chain + 42 self-evolving memory + 39 dashboard + 37 from prior phases). All pass.

### What shipped in v1.7.0

- ✅ Devil-mode adversarial agents (8 agents + `/devil-mode` command)
- ✅ MCP server (16 tools, 6 prompts, 370+ resources)
- ✅ Local observability dashboard
- ✅ Cost-aware model router
- ✅ MCP client mode (consume external MCP servers)
- ✅ Swarm orchestrator (parallel agents in git worktrees)
- ✅ Session replay + portable bundles
- ✅ SLSA L3 + SBOM + content manifest
- ✅ Safety hooks (prompt-injection-guard + token-budget)
- ✅ Self-evolving memory (proposals from usage patterns)
- ✅ Power bundles (indie-hacker / red-team / enterprise)
- ✅ GitHub Action (CI/CD PR review integration)
- ✅ 5 new IDE platforms (Cline, Roo Code, Aider, Kimi, Gemini CLI)
- ✅ README rewrite (infrastructure-first framing)

---

## v1.6.0 — DEVIL MODE: Adversarial agent crew + `/devil-mode` parallel sweep (May 2026)

This release introduces the 8-agent adversarial red-team crew, a new parallel command that fires four of them in one shot, power bundles, and 5 new IDE platform targets.

### New Agents (8 — adversarial / red-team mindset)

Each ships with a full attacker-mindset playbook, real bash-grep patterns, severity calibration, and remediation steps. Not theatrical personas — they do real audit work.

- **`prompt-injection-hunter`** — adversarial AI safety auditor. Hunts jailbreaks, indirect injection, system-prompt leaks, tool-call hijacking. Probes RAG pipelines, MCP servers, and any code that feeds untrusted text into an LLM.
- **`supply-chain-auditor`** — dependency attacker review. Detects typosquats, malicious post-install scripts, lockfile drift, slopsquats (AI-generated phantom packages), tarball-vs-repo divergence.
- **`secret-hunter`** — leaked-credential detective. Scans live code, git history, env files, build artifacts, CI logs, encoded blobs (base64/hex), and bundled-to-client env vars. Includes provider pattern catalog (AWS, Stripe, GitHub, Slack, JWT, etc.) and key-validity probing.
- **`license-violation-finder`** — IP / copyleft contamination auditor. Hunts GPL/AGPL deps in proprietary code, missing attributions, license cocktails, license changes between versions (Elastic/Mongo/HashiCorp pattern), AI-generated code with copyleft training data.
- **`jailbreak-tester`** — live AI-feature red-teamer. 10-tier attack battery: surface filter bypass, fictional framing, instruction-following hijack, system-prompt extraction, encoded payloads, tool abuse, multi-turn drift, overrefusal probing, PII exfil, output-channel abuse.
- **`code-stealer-detector`** — code-provenance auditor. Hunts copy-pasted Stack Overflow snippets, copyleft contamination, leaked private code, AI-generated code with unverified provenance, vendored libs without attribution, embedded encoded blobs.
- **`backdoor-hunter`** — malicious-code-pattern detector. 12 hunt categories: obfuscated execution, network beacons, time bombs (xz utils CVE-2024-3094 pattern), reverse shells, credential exfiltration, build-time injection, webshells, dynamic loading, cryptominers, telemetry exfil.
- **`chaos-engineer`** — adversarial reliability tester. Hypothesis-first fault injection: process death, network partition, latency injection, DNS failure, disk full, clock skew, memory pressure, dependency failure, concurrency abuse, input fuzzing. Includes pre-flight checklist + abort criteria for safe execution.

### New Parallel Command

- **`/devil-mode`** — fires `prompt-injection-hunter` + `supply-chain-auditor` + `secret-hunter` + `backdoor-hunter` simultaneously. The "attacker mindset on the whole codebase" sweep.
  - `/devil-mode --all` — fires all 8 adversarial agents
  - `/devil-mode --pre-public` — pre-open-source sweep (adds license + theft check)
  - `/devil-mode --pre-launch` — pre-launch sweep (adds AI red-team + chaos planning)

### Intent Routing Updates

- Added a new "Devil-Mode Adversarial Crew" section under Priority 3 with intent patterns for all 8 agents
- Added `/devil-mode` to the parallel commands section with full trigger matrix
- Added 11 new rows to the Quick Reference Table covering attacker-mindset phrasings ("think like an attacker", "going open-source full audit", "we were hacked", etc.)
- Users can now route to any devil-mode agent or command in plain language without remembering names

### Power Bundles

Three audience-tailored bundles installable via `--bundle` flag. Each installs the full ECC toolkit + a curated `BUNDLE.md` cheat sheet that biases the AI toward workflows fit for that audience.

```bash
npx kodelyth-ecc --bundle indie-hacker    # Solo founder / SaaS — ship fast, validate, harden
npx kodelyth-ecc --bundle red-team        # Security engineer — devil-mode + adversarial workflows
npx kodelyth-ecc --bundle enterprise      # Compliance team — SBOM, license, supply chain
```

- New files: `bundles/indie-hacker.md`, `bundles/red-team.md`, `bundles/enterprise.md`
- `install.sh` and `install.ps1` accept `--bundle` / `-Bundle` flag, both with full alias support (`indie`, `redteam`, `security`, `compliance`)
- Bundle pre-selects sensible language modules (`typescript+python` for indie/red-team, `typescript+java+python` for enterprise)
- `BUNDLE.md` is copied to install destination so the AI reads it on every session start
- Bundle name persisted in `kodelyth-ecc-install-state.json`
- Bundle-specific reminder displayed at install end with the right lead-with commands

### New IDE Platforms

ECC now installs natively to **5 additional AI coding platforms**, closing the platform-coverage gap with `agency-agents` and unlocking new communities:

```bash
npx kodelyth-ecc --target cline             # Cline (VS Code) — .clinerules/
npx kodelyth-ecc --target roocode           # Roo Code (VS Code) — .roo/
npx kodelyth-ecc --target aider             # Aider terminal agent — .aider-ecc/ + CONVENTIONS.md
npx kodelyth-ecc --target kimi              # Kimi Code — .kimi/
npx kodelyth-ecc --target gemini-project    # Gemini CLI (project) — .gemini/
npx kodelyth-ecc --target gemini-home       # Gemini CLI (global) — ~/.gemini/
```

Per-target install layouts:

| Target | Destination | Layout |
|---|---|---|
| `cline` | `./.clinerules/` | Flat: rules + agents + commands all merged as `.md` |
| `roocode` | `./.roo/` | Subdirs: `rules/`, `agents/`, `skills/`, `commands/` |
| `aider` | `./.aider-ecc/` + `./CONVENTIONS.md` | Subdirs + auto-generated CONVENTIONS.md if missing |
| `kimi` | `./.kimi/` | Subdirs: `rules/`, `agents/`, `skills/`, `commands/` |
| `gemini-project` | `./.gemini/` + `GEMINI.md` | Subdirs: `agents/`, `skills/`, `rules/` |
| `gemini-home` | `~/.gemini/` + `GEMINI.md` | Same as above, global |

Each target writes a tailored "what to do now" message at install end, and Aider/Gemini get auto-generated bootstrap files (`CONVENTIONS.md`, `GEMINI.md`) that their CLIs auto-load.

Total IDE coverage jumps from **6** to **11** platforms — making ECC easily the most cross-platform AI coding toolkit shipped.

### README Rewrite

- Sharper "Why ECC ≠ Another Agent Collection" hero anchored on the **infrastructure thesis** (layered stack vs flat agent folders)
- New **Layer Stack** table showing what each layer does and how it's missing from competitors
- New **Quick Comparison vs Other Kits** table — 13 rows comparing ECC against `agency-agents`, `awesome-claude-agents`, generic prompt libs
- New **Devil Mode** showcase block in hero
- New **Power Bundles** section under Install
- "What's Inside" updated to v1.6.0 counts + new Parallel Commands row

### Counts

| Metric | v1.5.10 | v1.6.0 |
|---|---|---|
| Agents | 62 | **70** |
| Commands | 90 | **91** |
| Parallel commands | 7 | **8** |
| Power bundles | 0 | **3** |
| Audience-tailored installs | 0 | **3** |
| IDE platform targets | 7 | **13** (added cline, roocode, aider, kimi, gemini-project, gemini-home) |
| IDE platform families | 6 | **11** |

### What shipped in v1.6.0

- 8 adversarial devil-mode agents (prompt-injection-hunter, supply-chain-auditor, secret-hunter, license-violation-finder, jailbreak-tester, code-stealer-detector, backdoor-hunter, chaos-engineer)
- `/devil-mode` parallel command — attacker-mindset sweep with `--all`, `--pre-public`, `--pre-launch` variants
- 3 power bundles (`indie-hacker`, `red-team`, `enterprise`) installable via `--bundle` flag
- 6 new IDE platform targets (cline, roocode, aider, kimi, gemini-project, gemini-home)
- Revamped README with comparison table and Layer Stack section
- Full intent routing for all 8 devil-mode agents in plain language

---

## v1.5.10 — Fix install crash on macOS bash 3.2 (May 2026)

### Bug Fix

- **`install.sh` crashes after Rules (common) on `claude-home` target** — `set -euo pipefail` + bash 3.2 (macOS default) treats an empty array `"${LANGUAGE_MODULES[@]}"` as an unbound variable and exits. Fixed by using the bash 3.2-safe empty-array expansion `"${LANGUAGE_MODULES[@]+"${LANGUAGE_MODULES[@]}"}"`, matching the pattern already correctly used for the JSON install state on line 430. Users who install without any `--profile` or language flags (the majority) were affected.

---

## v1.5.9 — Intent routing for all 5 parallel commands (May 2026)

### Bug Fix / Feature

- **5 parallel commands now fully routable by natural language** — `/security-audit`, `/pre-release`, `/debug-blitz`, `/refactor-sprint`, and `/onboard` were added in v1.5.4 but never added to `rules/common/agent-intent-routing.md`. Users had to type the exact command name. Now the AI auto-routes to them from plain descriptions:
  - "been stuck on this bug for 2 days" → `/debug-blitz`
  - "cutting v2 today, last check" → `/pre-release`
  - "is my app secure? check everything" → `/security-audit`
  - "clean up this whole module, add types and tests" → `/refactor-sprint`
  - "I just joined this team, where do I start?" → `/onboard`
- Each command now has a full routing section with signal table, key rule, counter-signals, and agent list.
- 10 new examples added to the routing examples table.

---

## v1.5.8 — README and SVG refresh (May 2026)

### Changes

- README inline changelog updated to v1.5.7 highlights — no longer showed v1.5.3 content on npm and GitHub.
- All 6 social SVGs updated: version badges `v1.5.3` → `v1.5.7`, commands stat `80` → `90`, stale "NEW" labels replaced with `v1.5.3+`.
- CHANGELOG backfilled with missing `v1.5.4` and `v1.5.5` entries.

---

## v1.5.7 — Fix zsh inline comment args (May 2026)

### Bug Fix

- **zsh inline comment crash** — `npx kodelyth-ecc --target windsurf-home  # comment` would fail with `Unknown argument: #` in zsh. Unlike bash, zsh does not strip inline `#` comments before passing args to a process. Fixed at two layers: `bin/kodelyth-ecc.js` now filters out `#` and all following args before passing to the installer, and `install.sh` also handles `#*` args with a graceful `break`. This makes copy-pasting commands from documentation with inline comments safe on all shells.

---

## v1.5.6 — Accuracy, Ruby/Elixir, /doctor, /update (May 2026)

### Bug Fixes

- **Dynamic install counts** — `install.sh` and `install.ps1` now compute agent/skill/command counts from the actual filesystem at install time. Hardcoded numbers like `(58)` and `(79)` that were wrong on every install are gone permanently.
- **`rules/common/agents.md` rewritten** — listed only 10 agents from an ancient version. Now documents all 62 agents across 10 categories with handoff chains. This file is injected into `.windsurfrules` on every Windsurf session — the AI was being told there were 10 agents when there are 62.
- **`kodelyth-advisor` model field removed** — `model: sonnet` violated the Kodelyth Standard (`CONTRIBUTING.md` explicitly says no `model:` field). Fixed.
- **Windsurf post-install rule count** — was hardcoded as "15 coding rules", now computed dynamically.
- **`install.ps1` `.windsurfrules` path bug** — for `windsurf-home` target, the file was being written to `$HomeDir\.windsurfrules` instead of `$Dest\.windsurfrules`. Fixed.
- **README agent count** — "All 61 subagents" in the What Gets Installed table corrected to 62.
- **OpenCode platform description** — README said "Full" support. OpenCode receives rules only (no agents, no skills). Now documented honestly.

### New Features

- **`/doctor` command** — run a health check on your ECC install from inside your IDE. Wraps `scripts/doctor.js`. Shows OK/WARNING/ERROR per component with a summary.
- **`/update` command** — upgrade to the latest ECC version without memorizing your original install flags. Reads `kodelyth-ecc-install-state.json`, replays `npx kodelyth-ecc@latest --target <target>` automatically. Never overwrites `~/.kodelyth/memory/` or `tasks/lessons.md`.
- **Ruby language rules** — `rules/ruby/` with coding-style, patterns, testing (RSpec + FactoryBot), security (Brakeman + bundler-audit), and hooks (RuboCop auto-fix). Installable via `npx kodelyth-ecc ruby` or `./install.sh ruby`.
- **Elixir language rules** — `rules/elixir/` with coding-style (mix format + Credo), patterns (with/GenServer/Context), testing (ExUnit + Mox + excoveralls), security (Sobelow + mix hex.audit), and hooks. Installable via `npx kodelyth-ecc elixir` or `./install.sh elixir`.
- **GitHub issue + PR templates** — `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/new_agent.md`, `.github/PULL_REQUEST_TEMPLATE.md`. Contribution quality gate built into the repo workflow.

### Changes

- `package.json` description updated to reflect 90 commands (was 88)
- `ruby` and `elixir` added to language parser in both `install.sh` and `install.ps1`

---

## v1.5.5 — 88 Commands + Parallel Commands Table in CLAUDE.md (May 2026)

### Changes

- **`CLAUDE.md` Parallel Commands section** — added a full table of parallel commands (`/team-review`, `/project-launch`, `/security-audit`, `/debug-blitz`, `/refactor-sprint`, `/pre-release`, `/onboard`) so users see the fast paths on every session without memorizing command names.
- **Command count updated** — `CLAUDE.md`, `package.json`, and `install.sh` banner updated from 83 → 88 to reflect the 5 new parallel commands added in v1.5.4.
- **`package.json` description** updated: "62 agents, 88 commands".

---

## v1.5.4 — 5 New Parallel Commands + Agent Model Fields (May 2026)

### New Commands

Five new parallel agent commands — all fire immediately on invocation (Execute Now trigger):

| Command | Agents Fired | What It Does |
|---|---|---|
| `/security-audit` | `security-reviewer` + `dependency-doctor` + `api-guardian` | Full security sweep — secrets, deps, API surface |
| `/pre-release` | `release-captain` + `security-reviewer` + `code-reviewer` | Ship-readiness check before any release |
| `/debug-blitz` | `debug-detective` + `silent-failure-hunter` + `env-debugger` | Triple-agent blitz for stubborn bugs |
| `/refactor-sprint` | `refactor-cleaner` + `code-simplifier` + `type-design-analyzer` + `tdd-guide` | Full refactor + type + test pass |
| `/onboard` | `code-explorer` + `architect` + `doc-updater` | New-joiner onboarding — codebase tour, architecture map, docs |

### Fixes

- **`/team-review` and `/project-launch` Execute Now trigger added** — patch for v1.5.3 where these two commands required explicit invocation instead of firing immediately.
- **`install.sh` banner** updated: 61 → 62 agents, 80 → 83 commands.

---

## v1.5.3 — God-Tier Intent Routing Expansion (May 2026)

### The Routing Overhaul

Intent routing was already powerful. Now it's semantic. The AI no longer pattern-matches against keyword lists — it reads intent behind words, reasons about emotion, and catches every natural-language description of a problem without the user knowing any command names.

### What Changed

#### `rules/common/agent-intent-routing.md` — complete expansion

**Semantic reasoning preamble (new):**
- The AI is now explicitly instructed to reason about *intent behind words*, not keyword-match
- Code paste detection: user pastes a block of code with no text → auto-routes to `code-reviewer`
- Stack trace paste detection: user pastes an error log with no text → auto-routes to `debug-detective`
- Emotion as a routing signal: frustration, excitement, confusion, worry all trigger routing
- "The signal tables are examples, not exhaustive lists" — AI uses reasoning, not lookup tables

**Expanded signal coverage (2–3x more per agent):**

| Agent | Added signals |
|---|---|
| `debug-detective` | "nothing works", "driving me crazy", "acting weird", "stopped working", "broken again", naked stack trace paste |
| `code-reviewer` | "take a look at this", "eyes on this", "would you write it differently?", "before I merge", naked code paste |
| `kodelyth-advisor` | "can someone help me", "any advice", "am I doing this right?", "what would you do here?" |
| `ux-reviewer` | "the UI is confusing", "hard to use", "nobody can find the button", "users are confused" |
| `performance-optimizer` | "make this faster", "optimize this", "the API is slow", "reduce the load time" |
| `security-reviewer` | "is this safe", "any security issues", "I'm worried this might be insecure" |
| `migration-guide` | "this is deprecated", "moving to the new version", "old way is removed" |
| `doc-updater` | "nobody knows how this works", "there are no docs", "write documentation" |
| `refactor-cleaner` | "cruft", "old stuff hanging around", "vestigial code", "this is copy-pasted everywhere" |
| `chief-of-staff` | "draft an email", "reply to this", "how should I say this", "status update" |
| `seo-specialist` | "my page doesn't rank", "Google isn't indexing" |

**`/project-launch` — catches all new-build language:**
- "help me build a todo app" → caught
- "I have this idea for an app" → caught
- "I'm starting a new side project" → caught
- "I want to make a ..." → caught
- "new SaaS", "startup idea", "I want to launch" → caught
- Key rule: any non-trivial new build defaults to `/project-launch`

**`/team-review` — catches all broad review language:**
- "can you review my code?" → caught (key rule: narrow = language reviewer, broad = /team-review)
- "is this ready to ship?" → caught
- "about to go live" → caught
- "go through my code" → caught

**`image-architect` — catches implicit visual need:**
- "my site looks plain" → caught
- "make it look good" → caught
- "the page looks bare" → caught
- "give it some flair" → caught
- "I need something for the homepage" → caught

**`/lessons` — catches habit encoding:**
- "from now on always X" → caught
- "make it a rule that" → caught
- "I want you to always" → caught
- Proactive session-start offer: if `tasks/lessons.md` exists → "Found project lessons. Load them now?"

**Updated routing examples table:**
- 36 examples (up from 22)
- Natural human phrases: "help me build a todo app", "my site looks plain", "can you review my code?", "from now on never use var", naked code/trace paste

### Why This Matters

Before v1.5.3: routing worked if you said the right words. "Generate an image" → routed. "My site looks boring" → not routed.

After v1.5.3: routing works from the first word of any natural description. The AI reads intent, not phrases. You never need to know a command name. You never need to know an agent exists.

---

## v1.5.2 — Parallel Agents + Cross-Platform Lessons + AI Image Generation (May 2026)

### The Parallel Era

ECC becomes fully multi-platform and multi-agent. Five agents can now run simultaneously on a single task. Image generation works natively on every platform. Lessons work everywhere, not just Claude Code.

### Added

#### `image-architect` agent — Platform-aware AI image generation
- **Google Antigravity**: uses Gemini Imagen 3 natively — no API key, no setup
- **Codex CLI**: uses DALL-E 3 natively — no API key, no setup
- **Claude Code**: fal.ai MCP → SVG fallback
- **Windsurf / Cursor**: native model image gen → fal.ai → SVG fallback
- Knows exact dimensions for every use case: hero (1920×1080), OG (1200×630), Twitter (1200×675), LinkedIn (1584×396), square (1080×1080), GitHub preview (1280×640)
- Full prompt engineering guide built in — structured prompts for photorealistic and illustrated styles
- Always produces SVG fallback alongside AI-generated images
- Can generate full social kit (5 assets) in one command

#### `/project-launch` command — Parallel founding team for new projects
- Fires 5 agents simultaneously: `architect` + `pair-programmer` + `security-reviewer` + `tdd-guide` + `ux-reviewer`
- Each agent gets focused narrow context → cheaper per agent, runs in parallel
- Aggregated **Project Launch Report** with architecture, risk, threat model, test strategy, UX blueprint
- `--full` flag adds `performance-optimizer` + `api-guardian`
- Wall-clock time: ~10 min vs ~45 min sequential

#### `/team-review` command — Parallel full audit for existing projects
- Fires 4 agents simultaneously: `code-reviewer` + `security-reviewer` + `performance-optimizer` + `api-guardian`
- Scope options: whole repo, directory, `--changed` (git diff only), `--pre-release`
- Aggregated **Team Review Report** with severity ratings (CRITICAL / HIGH / MEDIUM / LOW)
- `--pre-release` adds `release-captain` for ship-readiness check
- Wall-clock time: ~15 min vs ~60 min sequential

#### `/lessons` command — Cross-platform project lessons
- Works on ALL platforms: Claude Code, Windsurf, Cursor, Codex, Antigravity, OpenCode
- `/lessons` — load and apply all lessons from `tasks/lessons.md` for this session
- `/lessons save` — extract corrections from current session, confirm, write to file
- `/lessons add "<rule>"` — add a manual rule instantly
- `/lessons clear` — review and prune stale rules
- On Claude Code: already automatic via hooks. On all other platforms: one command loads everything.

### Updated

- `rules/common/self-improvement-workflow.md` — added explicit cross-platform lesson loading instructions. Non-Claude-Code platforms instructed to proactively read `tasks/lessons.md` at session start.
- `rules/common/agent-intent-routing.md` — added routing patterns for `image-architect`, `/project-launch`, `/team-review`, `/lessons`. Added 7 new example routing decisions.

### Token and Time Economics

| Operation | Sequential | Parallel (`/project-launch` or `/team-review`) |
|---|---|---|
| New project analysis | ~45 min, 1 large context | ~10 min, 5 focused contexts |
| Full codebase audit | ~60 min, 1 large context | ~15 min, 4 focused contexts |
| Token cost | 1 full session | ~2× tokens, cached prefix = ~10% on system prompt |
| Net | Slower, more tokens per insight | Faster, cheaper per insight |

---

## v1.5.1 — Compound Learning System (May 2026)

### The Self-Improvement Loop

Every correction you make to Claude gets encoded permanently into your project. Next session, Claude doesn't repeat the mistake. The month after, it matches how you think. After a year, it works like a team member who has been here for years.

### New: Three-Layer Compound Memory Architecture

| Layer | File | Scope | How it works |
|---|---|---|---|
| Project Lessons | `tasks/lessons.md` | Per-project | Hard rules from your corrections. Injected at session start. |
| Global Memory | `~/.kodelyth/memory/` | Cross-project | BM25 fuzzy recall of past solutions. Auto-fires on every prompt. |
| Intent Routing | 61 agents | Always-on | Routes your message to the right specialist from the first word. |

### Added

#### `hooks/memory/capture-correction.js` (Stop hook)
- Scans session JSONL for user correction patterns (12 signal types: "no don't", "use X instead", "stop doing Y", "we always", "wrong approach", etc.)
- Extracts corrections as hard rules and appends to `tasks/lessons.md` in the project root
- Runs async at session end — zero latency impact
- Self-deduplicates: same rule never written twice

#### `hooks/memory/read-lessons.js` (SessionStart hook)
- Reads `tasks/lessons.md` at session start and injects rules as high-priority context
- Detects project tech stack (Node.js + framework, Go, Rust, Python, Java) and injects a project DNA brief
- Reads open items from `tasks/todo.md` and surfaces them at session start
- Fires before all other hooks — lessons are always loaded first

#### `rules/common/self-improvement-workflow.md`
- Encodes Boris Cherny's internal Claude Code team workflow (6 patterns)
- Extended with ECC's three-layer compound memory architecture
- Plan Node Default, Subagent Strategy, Self-Improvement Loop, Verification Before Done, Demand Elegance, Autonomous Bug Fixing
- Task Management Protocol: `tasks/todo.md` + `tasks/lessons.md` as first-class project artifacts

### How Addiction Works

```
Session 1:  You say "use pnpm not npm"
            → capture-correction.js writes: "- use pnpm not npm" to tasks/lessons.md

Session 2:  read-lessons.js fires at start
            → "PROJECT LESSONS — HARD RULES" injected into context
            → Claude uses pnpm without being told

Month 1:    10+ lessons stacked
            → Claude matches your style, your conventions, your preferences

Month 3:    You open another AI tool
            → It feels like a new hire who knows nothing about your project
            → You come back
```

---

## v1.5.0 — Incident Response + Load Testing + Complete Visual Refresh (May 2026)

### Added — 2 New Specialist Agents

#### `incident-commander`
- Production incident response specialist — P0/P1/P2/P3 triage, containment playbooks, stakeholder communication templates, blameless postmortem structure
- 5-phase protocol: Triage → Contain → Investigate → Fix → Postmortem
- Containment playbooks for 6 categories: deployment rollback, traffic spike, database issue, external dependency, memory leak, connection pool exhaustion
- Communication templates: status page updates, engineering channel messages, 30-min stakeholder cadence
- Escalation triggers and handoff to `debug-detective`, `git-rescue`, `env-debugger`
- Distinct from `debug-detective` — that agent is for development bugs; this agent runs live incidents

#### `load-tester`
- Load and performance testing specialist for k6, Locust, Artillery, wrk, Gatling, and hey
- Test pattern taxonomy: smoke, load, stress, spike, soak, breakpoint — with when-to-use guidance
- Full code examples for k6 (JS), Locust (Python), Artillery (YAML) with thresholds and success criteria
- Root cause table: maps load test symptoms to likely causes (thread pool exhaustion, memory leak, GC pressure, missing index, downstream rate limiting)
- Report structure template and capacity estimate format
- Distinct from `performance-optimizer` — that agent optimizes code; this agent designs and interprets load tests

### Added — Intent Routing Updates
- `incident-commander` routing patterns: "production is down", "P0", "outage", "incident", "postmortem"
- `load-tester` routing patterns: "load test", "k6", "Locust", "Artillery", "capacity test", "breaking point"
- 2 new sequential chains: incident chain, pre-launch chain
- 4 new example routing decisions in the reference table

### Updated — All Visual Assets (complete refresh)
- **9 SVGs redesigned** — all social cards updated to v1.4.1/v1.5.0 feature set:
  - `social/readme-hero.svg` — updated counts (59→61 agents, 188 skills, 80 commands), memory auto-recall demo in terminal
  - `social/github-social-preview.svg` (1280x640) — memory system highlighted as key differentiator, `kodelyth-memory` agent card replacing old `api-guardian`
  - `social/card-main.svg` — `npx kodelyth-ecc` as primary install, memory feature callout, correct counts
  - `social/card-agents.svg` — `kodelyth-memory` NEW badge, incident-commander and load-tester in categories
  - `social/card-install.svg` — all 4 install methods, all 7 targets shown
  - `social/readme-agents.svg` — 3-row agent grid with NEW badge on memory agent
  - `social/x-card-free.svg` — updated counts, refreshed layout
  - `social/x-card-hook.svg` — memory auto-recall featured as main message
  - `social/x-card-agents-grid.svg` — 3x3 grid with `kodelyth-memory` as center card, `git-rescue` and `flake-hunter` updated

### Updated — Complete Wiki Rewrite (all 7 files)
- `wiki/Home.md` — v1.4.1 state, new quick decision table, all 6 platforms, correct counts
- `wiki/FAQ.md` — full memory system Q&A, auto-recall mechanics, platform comparisons, all hook questions
- `wiki/Installation-Guide.md` — all 4 install methods, all 7 targets, profiles, CI/non-interactive, memory setup walkthrough
- `wiki/Agent-Reference.md` — all 61 agents documented with trigger patterns and when-to-use
- `wiki/Skill-Reference.md` — kodelyth-memory skill, intent-routing, agent-handoff, all language skills, generated skills
- `wiki/Hook-Reference.md` — all 3 memory hooks with full mechanics, quality gate hooks, hook safety design
- `wiki/Platform-Support.md` — 6-platform feature matrix, per-platform memory capabilities, multi-platform install

### Counts
- Agents: 59 → **61** (+incident-commander, +load-tester)
- Skills: 188 (unchanged)
- Commands: 80 (unchanged)
- Rules: 16 (routing rule updated)
- Tests: 47 (unchanged)

---

## v1.4.1 — Auto Chat Detection for Memory (May 2026)

### Added
- **`UserPromptSubmit` hook: `hooks/memory/auto-recall.js`** — watches every prompt in real-time, runs BM25 search against your memory, and injects relevant matches into the AI's context **before it responds**
- **Per-session repeat suppression** — never surfaces the same memory twice in one session (state at `~/.kodelyth/memory/session-surfaced-<id>.json`)
- **Smart skip filters** — skips trivial prompts (`ok`, `yes`, `thanks`), agent invocations (`use foo`, `@bar`, `/help`), and prompts under 12 chars
- **9 new tests** for the auto-recall hook (47 total passing — 26 existing + 12 memory + 9 auto-recall)

### How it changes the experience
Before v1.4.1: memory only injected once at session start, then the AI had to consciously decide to query it.

After v1.4.1: every meaningful prompt the user types triggers an instant memory check. Relevant past solutions appear in the AI's context for that turn, automatically. No agent invocation needed. No `/memory recall` needed.

### Example
```
You:  "I need to add Stripe webhooks for subscription renewals"
       └─ Auto-recall fires → finds your March 2026 memory →
          injects: "raw body parser, validate with constructEvent,
                   test with stripe-cli not curl"
AI:   "I checked your memory — you solved this exact problem in March.
       The approach that worked was raw body parser before
       signature validation. Want me to apply the same pattern?"
```

You never typed `/memory recall`. The AI just knew.

### Honest limits
- The hook fires on Claude Code's `UserPromptSubmit` event. Other platforms (Cursor, Codex, Windsurf, Antigravity) don't currently expose an equivalent pre-prompt hook — auto-recall there is limited to SessionStart injection.
- Repeat suppression is per-session-id. If your platform doesn't pass a stable session_id, the same memory may surface twice across sessions (still better than none).

---

## v1.4.0 — Local Self-Learning Memory (May 2026)

### Added — Kodelyth Memory
- **Local self-learning memory store** — captures problems and solutions from past sessions, recalls them when relevant in future sessions
- **Zero dependencies, zero telemetry** — all memory lives at `~/.kodelyth/memory/` (override with `KODELYTH_MEMORY_DIR`)
- **BM25 retrieval** — pure JS keyword + tag search, sub-millisecond, no embeddings, no network
- **Cache-friendly injection** — context block is structured with stable prefix → variable suffix to maximise prompt-cache hits on Anthropic and OpenAI models
- **Model-agnostic** — works for Claude, GPT, Gemini, Llama, any model. Prompt-cache savings apply where the provider supports it; recall quality applies everywhere
- **Privacy-first** — never auto-stores. Stop hook extracts candidates → user reviews via `/memory review-pending` → user confirms before storing

### New files
- `agents/kodelyth-memory.md` — agent persona and protocols
- `skills/kodelyth-memory/SKILL.md` — when and how to use the memory system
- `commands/memory.md` — `/memory` slash command
- `rules/common/memory-protocol.md` — mid-session recall + capture rules
- `scripts/memory/store.js` — BM25 storage + retrieval
- `scripts/memory/inject.js` — cache-friendly context block builder
- `scripts/memory/extract.js` — heuristic learning extractor for session JSONL
- `scripts/memory/cli.js` — CLI entry point
- `hooks/memory/inject-start.js` — SessionStart hook
- `hooks/memory/capture-stop.js` — Stop hook
- `tests/memory/store.test.js` — 12 new tests (38 total passing)

### Honest disclosure
- "Self-learning" means **better context retrieval over time**, not model fine-tuning. The LLM is unchanged. We give it smarter context.
- Cloud-AI platforms (Windsurf, Antigravity, partial Cursor) store sessions server-side. Auto-extract from past sessions doesn't work there. Manual `/memory remember` still does.

### Counts
- Agents: 58 → **59** (+kodelyth-memory)
- Skills: 187 → **188** (+kodelyth-memory)
- Commands: 79 (+`/memory`, total stays 79 — replaces no slash)
- Rules: 15 → **16** (+memory-protocol)

---

## v1.3.0 — God-Tier Intent Routing + 5 New Agents (May 2026)

### Removed
- **Kodelyth Lens dashboard** — bundled local dashboard removed. Cloud-AI platforms (Windsurf, Antigravity, parts of Cursor) don't expose token/cost data locally, which led to inaccurate or hardcoded zeros. The toolkit is now leaner and only does what it can do honestly.
- `dashboard/` folder, `scripts/agent-tracker-hook.js`, Lens auto-start logic in `install.sh`, Lens social SVGs

### Added — God-Tier Intent Routing Rule
- New `rules/common/agent-intent-routing.md` — auto-loaded on every session
- 10 priority tiers (crisis → multi-agent chains)
- 50+ trigger pattern groups across emotional state, error keywords, language hints, framework signals
- Mandatory routing format: `→ Routing to <agent>` + persona switch + explicit-form teaching
- Counter-patterns (when NOT to route) baked in
- Documents standard chains for new feature, bug fix, refactor, migration, OSS prep, git crisis

### Added — 5 New Specialist Agents
- `dependency-doctor` — npm/pip/cargo/maven dep hell, CVE triage, lockfile diagnosis, safe upgrade plans
- `git-rescue` — recovers broken git states (lost commits, bad rebases, force-pushes) without destroying history
- `release-captain` — owns the release ritual (semver, changelog, tagging, publishing, rollback rehearsal)
- `env-debugger` — "works on my machine" hunter (env vars, config layers, secrets, build-time vs runtime)
- `flake-hunter` — flaky test stabilization with 6-class taxonomy and real fixes (never adds blind retries)

### Added — 2 New Meta Skills
- `skills/intent-routing/SKILL.md` — documents the routing system, priority tiers, trigger design rules
- `skills/agent-handoff/SKILL.md` — standard multi-agent chain protocol with 10 documented chains

### Updated
- `README.md` — full rewrite emphasizing intent routing as the differentiator
- `KODELYTH.md` — reflects v1.3.0 changes
- `CLAUDE.md`, `AGENTS.md` — updated agent counts, intent routing guidance
- `install.sh` — removed all Lens install/auto-start blocks
- Counts: 58 agents (was 53), 187 skills (was 185), 79 commands, 15 rules (was 14)

## v1.2.0 — Lens Dashboard + Windsurf + npx (May 2026)

### Kodelyth Lens — AI Usage Dashboard
- Zero-dependency real-time dashboard tracking 6 platforms: Claude Code, Cursor, Windsurf, Codex CLI, OpenCode, Antigravity
- Agent leaderboard — ranked by usage with intent detection across 12 categories, 50+ patterns
- ECC savings banner — shows actual cost vs. estimated without-ECC, cache hit rate, % reduction
- 30-day cost chart, today vs. all-time stats, session table
- Light theme, sticky header, auto-refresh every 60 seconds
- Only shows installed platforms — non-installed platforms hidden
- Dynamic subtitle lists detected platform names after first load

### Platform Readers
- **Claude Code reader** — full JSONL session parsing, lastDate field for today filter, hook tracking merge
- **Codex CLI reader** — SQLite via `sqlite3 -json` mode, COALESCE for optional columns, lastDate field
- **Windsurf reader** — workspaceStorage + Cascade files, lastDate field, sort comparator fixed
- **Cursor reader** — workspaceStorage + chat files, lastDate field, sort comparator fixed
- **OpenCode reader** — JSONL/JSON session files, lastDate field, tokens.total fixed (was including cacheRead)
- **Antigravity reader** — ECC project detection, cross-platform path resolution (macOS/Windows/Linux)

### Install Improvements
- `npx github:sifxprime/kodelyth-ecc` — install from any machine with Node.js 18+
- `--target windsurf-project` — installs to `.windsurf/` + generates `.windsurfrules` auto-loaded by Cascade
- `--target windsurf-home` — installs to `~/.codeium/windsurf/` globally
- Non-interactive install — auto-accepts in CI/Docker environments without `/dev/tty`
- `go` argument normalized to `golang` (rules dir is `rules/golang/`)
- Agent/skill counts corrected to 53/185 in all install targets
- `WINDSURFRULES_DEST` initialized to empty string to prevent `set -u` crash

### Bug Fixes
- `claude-code-guide` removed from ECC_AGENTS (agent file does not exist — invocations were silently failing)
- `conversation-analyzer` added to ECC_AGENTS (agent file exists, was untracked)
- `buildAgentLeaderboard` sessions counter fixed — now counts unique sessions via Set, not invocations
- Windsurf removed from CLOUD_AI_PLATFORMS — it has local files; only Antigravity is truly cloud-AI
- Path traversal protection added to Lens static file server
- OpenCode added to server.js startup tracking message
- Linux Cursor path (`~/.config/Cursor/`) added to platform detector
- Unused `PLATFORM` constant removed from platform-detector.js
- Dead `src` variable replaced with intent tooltip in renderSessions

### Content
- README: intent detection table, ANTIGRAVITY_DIR env var, Codex/OpenCode install tables, npx instructions
- KODELYTH.md: fully updated with all v1.1.0 and v1.2.0 additions
- Dashboard version badge updated to v1.2

---

## v1.1.0 — Full Enhancement Release (April 2026)

### New Agents (3)

#### `api-guardian`
- API contract protection specialist — detects breaking changes before they ship
- Classifies every change: BREAKING (block), SAFE (additive), WARN (design issues)
- Consumer impact report: number of affected clients, migration path, deprecation timeline
- Enforces: versioning strategy, `Deprecation` headers, idempotency keys, machine-readable error codes, `X-RateLimit-*` headers
- Covers REST, GraphQL, gRPC, WebSocket contracts
- Model-agnostic

#### `pair-programmer`
- Pre-code thinking partner — catches the wrong approach before a line is written
- "Cost curve of bugs: thinking=0x, code review=6x, production=200x"
- Pre-implementation checklist: correctness, scale, simplicity, testability, reversibility
- Wrong approach detection: premature optimization, over-engineering, wrong abstraction, missing idempotency
- Push-back patterns: when to simplify, when to split, when to use an existing library
- Model-agnostic

#### `migration-guide`
- Full migration playbooks: React 17/18→19, Next.js 12/13→15, Python 2→3, Node.js 14→22, TypeScript 4→5, Java 8→21
- Phase 0: audit → Phase 1: blast radius map → Phase 2: phased plan → Phase 3: execute → Phase 4: validate
- Dependency conflict resolution for npm, pip, Gradle
- Incremental migration strategy — never "stop the world"
- Model-agnostic

### New Skills (2)

#### `git-mastery`
- Trunk-based development vs gitflow vs GitHub Flow — decision framework
- Ship/Show/Ask branching philosophy
- Interactive rebase: squash, fixup, split, reorder commits
- `git bisect` for regression hunting
- Worktrees for parallel feature development
- Monorepo patterns, branch protection rules
- Emergency recovery: dangling commits, reflog, `git stash`

#### `observability`
- Structured logging with Pino (Node.js) and structlog (Python) — before/after examples
- Three metric types: Counter, Gauge, Histogram — with naming conventions
- Four Golden Signals: latency, traffic, errors, saturation
- OpenTelemetry setup with custom spans and baggage propagation
- Correlation ID propagation across services
- SLOs, SLIs, SLAs, error budgets
- Health check endpoint patterns (`/health`, `/ready`, `/live`)
- Alerting rules (latency p99, error rate, saturation)

### New Hooks (3)

#### `test-reminder` (PostToolUse — Edit/Write/MultiEdit)
- Detects when a code file is edited but no corresponding test file was touched
- Posts a non-blocking reminder box to stderr
- Language-aware: covers `.ts`, `.tsx`, `.js`, `.py`, `.go`, `.rs`, `.java`, `.rb`, `.php`
- Respects `ECC_DISABLED_HOOKS=kodelyth:test-reminder` env var
- Async, timeout 5s — never delays tool execution

#### `smart-suggest` (Stop hook)
- After each Claude response, detects session signals and suggests the next logical agent
- 8 detection rules: errors → debug-detective, "looks good" → code-reviewer, migration terms → migration-guide, API changes → api-guardian, slow performance → performance-optimizer, etc.
- Non-blocking, outputs to stderr
- Respects `ECC_DISABLED_HOOKS=kodelyth:smart-suggest`

#### `branch-name-check` (PreToolUse — Bash)
- Intercepts `git checkout -b` and `git switch -c` commands
- Enforces pattern: `^(feat|fix|chore|docs|refactor|test|perf|ci|hotfix|release|experiment|spike|wip)\/[a-z0-9][a-z0-9-._/]{1,60}$`
- Blocks with exit code 2, clear explanation, and valid examples
- Respects `ECC_DISABLED_HOOKS=kodelyth:branch-name`

### Install Profiles

Added `--profile` flag to `install.sh` and `install.ps1`:

| Profile | Languages installed |
|---|---|
| `--profile nextjs` | TypeScript |
| `--profile python-api` | Python |
| `--profile fullstack` | TypeScript + Python + Go |
| `--profile mobile` | Kotlin + Swift |
| `--profile backend` | Go + Python + Java |

### CONTRIBUTING.md

Full contribution guide with:
- Kodelyth Standard definition (GOD-level persona requirements)
- Agent template with required sections (persona, tools, output format, Kodelyth footer)
- Skill template with quality standards
- Hook script template with all safety requirements
- Hook ID naming convention: `kodelyth:{phase}:{matcher}:{name}`
- Branch naming and PR description templates
- "What we want / don't want" guidance

### Other

- VERSION bumped: `1.0.0` → `1.1.0`
- AGENTS.md updated: api-guardian, pair-programmer, migration-guide added to Kodelyth Exclusive section
- README.md updated: all new agents, skills, hooks, install profiles, Contributing section
- `.agent/skills/` synced: all 3 new agents copied to Antigravity pre-built layout
- Badge count updated: Skills 183 → 185

---

## v1.0.0 — Initial Release (April 2026)

### Foundation
- Initial public release of Kodelyth ECC
- Full multi-platform support: Claude Code, Google Antigravity, Cursor, Codex, OpenCode

### Kodelyth Exclusive Agents (3 new)

#### `kodelyth-advisor`
- Master engineering advisor with decade-level experience persona
- Reads user emotional state and responds to the *person* first, then the problem
- Knows every agent, skill, and command — gives direct, confident tool recommendations
- Responds differently to frustration, confusion, excitement — never robotic
- Model-agnostic — works with any Claude model

#### `debug-detective`
- Systematic root-cause analyst — never guesses, never patches symptoms
- Formal hypothesis protocol: CLAIM → EVIDENCE → TEST
- Advanced debugging patterns: binary search debug, git bisect, minimal reproducer, chaos testing
- Deep language patterns for TypeScript/JS, Python, Go, SQL
- Model-agnostic — works with any Claude model

#### `ux-reviewer`
- Master UX and accessibility engineer
- Explicitly never touches visual design/aesthetics — only interaction behavior
- Full WCAG 2.1 AA review with real before/after code examples
- Covers: interaction logic, error states, loading states, mobile/touch, keyboard navigation, screen readers
- Model-agnostic — works with any Claude model

### Kodelyth Exclusive Skills (2 new)

#### `kodelyth-quickstart`
- Plain-language getting-started guide for new users
- Explains agents, skills, commands, and hooks without jargon
- Quick-reference card covering every major workflow
- Designed to be read in under 10 minutes

#### `smart-debug`
- 5-step systematic debugging framework for any language
- Step 1: Characterize — Step 2: Read the error — Step 3: Hypothesize — Step 4: Evidence — Step 5: Fix and verify
- Language-specific tips for TypeScript/JS, Python, Go, SQL
- Common bug pattern reference table by symptom
- Rubber duck checklist for when you're stuck

### Core Enhancements

#### SOUL.md — Enhanced Identity
- Added 2 new core principles: "Friendly by Default" and "Debug to Root Cause"
- Added explicit Personality section — warm, direct, proactive, honest
- Added Kodelyth brand identity throughout

#### CLAUDE.md — Updated Reference
- Added Kodelyth additions table
- Added new commands reference for `/kodelyth-quickstart` and `/smart-debug`
- Updated skill-to-file mapping

#### README.md — Kodelyth Branded
- "Kodelyth Enhanced Edition" section with full feature table
- Original repo credits maintained

### Installer

#### `install.sh` (macOS/Linux)
- Supports 5 targets: `claude-home`, `antigravity`, `cursor-project`, `codex-home`, `opencode`
- Automatic language module installation
- Smart flattening for targets that require flat rule directories (Antigravity, Cursor)
- Install state tracking via `kodelyth-ecc-install-state.json`
- ASCII banner and colored output

#### `install.ps1` (Windows PowerShell)
- Full feature parity with `install.sh`
- Supports all 5 targets
- Same install state tracking

### Antigravity Pre-built Layout
- `.agent/rules/` — 12 rule files (flattened for Antigravity)
- `.agent/workflows/` — 79 command workflows
- `.agent/skills/` — all 50 agents

---

---

> Powered by Kodelyth — [github.com/sifxprime/kodelyth-ecc](https://github.com/sifxprime/kodelyth-ecc)
