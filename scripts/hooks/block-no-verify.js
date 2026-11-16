#!/usr/bin/env node
'use strict'

/**
 * Kodelyth ECC — Block --no-verify Hook (local, vendored)
 * PreToolUse: Bash
 *
 * Intercepts Bash commands that would bypass git's pre-commit, commit-msg,
 * or pre-push hooks via --no-verify (or `git commit -n`). Exits 2 to block
 * when such a bypass is found; exits 0 otherwise.
 *
 * Why this file exists.
 *
 * v2.31.3 and earlier ran `npx block-no-verify@1.1.2` from hooks/hooks.json
 * on every Bash PreToolUse. Two problems in that one line, reported by
 * daisy-49@ilands.app on 2026-11-12:
 *
 *   1. It was a network call. On a cold npm cache every invocation fetched
 *      third-party code (maintainer tupe12334). The toolkit broadly markets
 *      "all local, zero telemetry" — the hook contradicted the claim.
 *
 *   2. It failed OPEN when the registry was unreachable. npx exits 1 on
 *      ECONNREFUSED/ENOTFOUND/timeout; Claude Code only treats exit 2 as
 *      blocking; any other non-zero is a non-blocking log. So the guard
 *      stopped guarding on exactly the condition users assume it still
 *      works — any corporate proxy hiccup, airplane, VPN drop, or registry
 *      outage silently let --no-verify through.
 *
 * This replacement is local-only, has no runtime dependencies, and only
 * emits exit 2 when it affirmatively matches a bypass pattern. Any other
 * input (empty stdin, malformed JSON, unrelated command) is exit 0. There
 * is no network failure mode because there is no network call.
 *
 * v2.31.6 — same reporter closed two more gaps verified in-session:
 *
 *   3. git's parse-options accepts any unambiguous prefix, so
 *      `git commit --no-verif` and even `--no-veri` skip the hooks while
 *      sailing past a regex that required the literal word. Prefix forms
 *      --no-veri / --no-verif / --no-verify are all caught now; the
 *      terminator excludes --no-verify-signatures and similar legitimate
 *      flags.
 *
 *   4. core.hooksPath routes git past the repo's hooks entirely.
 *      `git -c core.hooksPath=/dev/null commit`, the persistent
 *      `git config [--global] core.hooksPath ...` form, and the env-var
 *      forms (GIT_CONFIG_PARAMETERS / GIT_CONFIG_COUNT) all qualify.
 *      Caught now by matching any command segment that mentions both
 *      "git" and "core.hooksPath" — the key has no benign use alongside
 *      git invocations.
 *
 * v2.31.8 — same reporter, four more, three closed:
 *
 *   5. Case. git config keys are case-insensitive, so core.hookspath and
 *      core.HooksPath are the same key as core.hooksPath. The hooksPath
 *      pattern is now matched case-insensitively.
 *
 *   6. Quoted flag. `git commit "--no-verif"` parses identically to the
 *      bare flag, but the quote sat outside the pattern's boundary class.
 *
 *   7. Concatenated / escaped flag. The shell splices `--no-ver''ify`,
 *      `--no-ver""ify`, and `--no-\verify` back into --no-verify before git
 *      ever sees them, so the literal word is absent from the raw text.
 *
 *   5-7 are closed together: every pattern is now run against the raw
 *   command AND a copy with shell quote/escape characters (' " \) removed,
 *   which collapses the quoted and spliced forms back to what the patterns
 *   expect. The word-boundary classes still gate, so a flag merged into the
 *   middle of another token is not a boundary match and does not trip.
 *
 *   8. Variable. `f=--no-verif; git commit $f` passes the flag through a
 *      shell variable, so the literal never appears in the command text at
 *      all. This is NOT closable by any text pattern — it is the honest
 *      ceiling of a guard that reads the command string. Closing it needs a
 *      check that observes whether the hook actually RAN (a committer-side
 *      wrapper, or a server-side pre-receive hook), which is a different
 *      enforcement surface than a PreToolUse text guard. Left documented,
 *      not half-built. For the agent use case this guard exists for, an
 *      agent does not assemble a bypass flag from a variable by accident;
 *      the common, accidental forms (5-7) are what matter and are closed.
 *
 * v2.31.9 — same reporter, one more, closed:
 *
 *   9. Shell line continuation inside the token. `git commit --no-\<newline>
 *      verify` and `git -c core.hooks\<newline>Path=/dev/null commit` both
 *      bypass — the shell removes backslash-newline before parsing, so git
 *      receives the joined flag, but the raw command text the hook sees has
 *      the literal split across two lines. The v2.31.8 strip removed ' " \
 *      but kept the newline, so the token never became contiguous. Closed by
 *      unwrapping backslash-newline (\r?\n) first, producing a joined variant
 *      that the patterns then match (raw, and quote/escape-stripped). Same
 *      class as 7 (shell-level splicing); it over-triggers inside single
 *      quotes where backslash-newline is literal, the fail-closed direction
 *      already chosen for 5-7.
 *
 * v2.31.10 — a maintainer-run adversarial sweep (be-the-reporter), each vector
 * reproduced in live git before any code changed. Three classes closed:
 *
 *  10. Empty-expansion splices. `--no-ver$()ify`, `--no-ver` + empty backticks +
 *      `ify`, `--no-ver${UNSET}ify`, `--no-ver$(:)ify`, and the same inside the
 *      key (`core.hooks$()Path`) all reassemble the bare flag/key, because the
 *      shell removes a command substitution or parameter expansion before git
 *      parses. Closed by checking a view with $(...), `...`, ${...}, and $name
 *      collapsed away — IN ADDITION to the raw command, so a substitution that
 *      literally contains the flag is still caught by the raw pass.
 *
 *  11. Clustered short flags. git unbundles a single-dash run, so -n hides in
 *      -nm / -vn / -qn / -sn. Closed by matching a bundle whose pre-n characters
 *      are all no-argument flags (arg-takers m c C F t excluded, so -mn = -m "n"
 *      and -am = -a -m do NOT match). This rule runs only on views with
 *      multi-word quoted phrases removed, because a bare `-n` is a common WORD in
 *      commit messages — verified in live git that a `-n` inside a message is the
 *      message, not the flag, so matching it there would be a false positive.
 *
 *  12. Hook-manager kill-switches. husky and lefthook install their hooks as
 *      git's pre-commit/commit-msg/pre-push, and short-circuit to a no-op on
 *      HUSKY=0 / HUSKY_SKIP_HOOKS=<any> / LEFTHOOK=0|false|off. In those repos
 *      (the JS/TS ones this toolkit most runs in) that skips the hooks exactly
 *      like --no-verify. Verified as real bypasses. Matched when such an
 *      assignment shares a command with a git commit/push; runs on phrase-free
 *      views so a message mentioning the string does not trip, and the var names
 *      are unambiguous (HUSKY=1, MY_HUSKY=0, `husky install` do not match).
 *
 * Still out of scope, documented so the gap is explicit rather than silent:
 *   - The shell-variable / assembled-flag ceiling (rule 8): `f=--no-verif; git
 *     commit $f` and `$(printf -- '--no-ver'; printf 'ify')` put the literal in
 *     NO view of the text. Unclosable by a text guard; pinned by tests. The only
 *     real fix is enforcement that observes whether the hook RAN (committer-side
 *     wrapper or server-side pre-receive) — a different surface.
 *   - pre-commit framework's SKIP=<id> and PRE_COMMIT_ALLOW_NO_CONFIG env opt-
 *     outs. Real bypasses in pre-commit-framework repos, but SKIP is a collision-
 *     prone name; left documented, not matched, pending a request to cover it.
 *   - GIT_CONFIG_SYSTEM=/dev/null git commit. Verified by the reporter NOT
 *     to bypass in a normal repo: with core.hooksPath in the repo's local
 *     config, blanking the system or global config file still runs the hook.
 *     It only bypasses in the narrow case where hooksPath itself lives in the
 *     file being blanked — not worth a pattern.
 *   - attacker-controlled edits to .git/hooks/* before commit — a file-tamper
 *     class, not a flag class.
 */

const fs = require('node:fs')

// Read Claude Code's hook input from stdin. If stdin is unreadable, empty,
// or not valid JSON, there is nothing to evaluate — exit 0 so unrelated
// commands run normally. A guard that refused everything it could not
// parse would break every non-git command in the session.
function readPayload () {
  let input
  try {
    input = fs.readFileSync(0, 'utf8')
  } catch {
    return null
  }
  if (!input || !input.trim()) return null
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

/**
 * Given a Bash command string, return the matched bypass flag name if the
 * command would skip git hooks, or null otherwise.
 *
 * Detection rules:
 *   • --no-verify (and its unambiguous prefixes --no-verif, --no-veri) —
 *     git's parse-options accepts prefix matches. --no-veri is the shortest
 *     prefix that resolves uniquely to verify (--no-verb* goes to verbose).
 *     The terminator rejects --no-verify-signatures and similar.
 *   • git commit -n — short form of --no-verify, but only on commit. Other
 *     subcommands use -n for different things (git log -n 5 = count), so
 *     the scope is intentionally narrow.
 *   • core.hooksPath — in the same command segment as `git`, in any form:
 *     `git -c core.hooksPath=...`, `git config [--global] core.hooksPath ...`,
 *     or `GIT_CONFIG_PARAMETERS=...core.hooksPath... git ...`. The config
 *     key has no benign use next to a git invocation; even `git config
 *     --get core.hooksPath` from a script is suspect enough to interrupt.
 *
 * False positives we knowingly accept: shell comments (`# --no-verify`) and
 * string literals that mention the flag (`echo "do not use --no-verify"`).
 * Since v2.31.8 the quote-stripping pass means such mentions are matched more
 * often than before (a quoted `--no-verify` in an echo now trips). That is the
 * intended trade: the cost of a spurious block is one edited command; the cost
 * of a silent allow is why this hook exists.
 */

// Apply the flag-literal bypass patterns (--no-verify and core.hooksPath) to
// one already-normalized command string. Returns the matched label or null.
// detectBypass() runs this against every view of the command. The -n short-form
// rule is NOT here — it lives in matchDashN() and runs only on views with
// multi-word quoted phrases removed, because a bare `-n` is a common word in
// commit messages and must not trip when it appears inside a message string.
function matchBypassPatterns (command) {
  // --no-verify and its two unambiguous prefixes (--no-verif, --no-veri).
  // The optional (f(y)?)? makes --no-veri match on its own; the terminator
  // set excludes '-' so --no-verify-signatures (push/merge sig verify) and
  // any hypothetical --no-verifier do not false-positive.
  if (/(^|[\s;&|`(])--no-veri(f(y)?)?(\s|$|[;&|`)=])/.test(command)) {
    return '--no-verify (or an unambiguous prefix: --no-veri / --no-verif)'
  }
  // core.hooksPath override, any form. Match when both `git` and the config
  // key appear in the same command segment (no shell boundary between them),
  // in either order — `git -c core.hooksPath=...` has git first;
  // `GIT_CONFIG_PARAMETERS='core.hooksPath=...' git ...` has the key first.
  // Case-insensitive: git config keys are case-insensitive, so core.hookspath
  // and core.HooksPath are the same key.
  if (/\bgit\b[^;&|`\n]*?\bcore\.hooksPath\b|\bcore\.hooksPath\b[^;&|`\n]*?\bgit\b/i.test(command)) {
    return 'core.hooksPath override'
  }
  return null
}

// `git commit ... -n` short form, including clustered short-flag bundles.
// git's parse-options unbundles a single-dash run of short flags, so -n hides
// inside any bundle whose characters BEFORE the n are all no-argument flags:
// -vn, -qn, -sn, -an, -nm, etc. The pre-n class is the set of commit short flags
// that take no argument (a s v q e o i p u z S A n). A flag that DOES take an
// argument before n (m c C F t) would consume the n as its own value, so `-mn`
// is `-m` with message "n" and must NOT match — those letters are excluded from
// the pre-n class. Allow arbitrary args between `git` and `commit` so long as no
// shell command boundary intervenes, so a later `git log -n 5` on the same line
// is not conflated with a commit bypass. This runs ONLY on phrase-stripped views
// (see detectBypass), so a `-n` inside a quoted commit message does not trip.
function matchDashN (command) {
  if (/\bgit\b[^;&|`\n]*?\bcommit\b[^;&|`\n]*?\s-[asvqeoipuzSA]*n[a-zA-Z]*(?=\s|$)/.test(command)) {
    return 'git commit -n (short form, bundled or not)'
  }
  return null
}

// Hook-manager kill-switches. husky and lefthook install their hooks as git's
// pre-commit/commit-msg/pre-push (via core.hooksPath or .git/hooks), and their
// scripts short-circuit to a no-op when a manager-specific env var is set:
// HUSKY=0, HUSKY_SKIP_HOOKS=<any>, LEFTHOOK=0 / false / off. Setting one of these
// alongside a git commit/push skips the repo's hooks exactly as --no-verify does,
// in the very repos (JS/TS) this toolkit most often runs in. Verified as real
// bypasses in a manager-style repo. These env-var NAMES have no legitimate use
// other than disabling hooks, so an assignment of one in the same command as a
// git commit/push is a bypass. Runs ONLY on phrase-stripped views (see
// detectBypass), so the string "HUSKY=0" inside a commit message does not trip.
// Out of scope by deliberate choice (collision-prone names, documented not
// matched): pre-commit framework's SKIP=<id> and PRE_COMMIT_ALLOW_NO_CONFIG.
function matchHookManager (command) {
  const killSwitch = /(?:^|[\s;&|`(]|export\s+)(?:HUSKY=0|HUSKY_SKIP_HOOKS=\S|LEFTHOOK=(?:0|false|off))\b/
  const gitCommitOrPush = /\bgit\b[^;&|`\n]*?\b(?:commit|push)\b/
  if (killSwitch.test(command) && gitCommitOrPush.test(command)) {
    return 'hook-manager kill-switch (HUSKY / LEFTHOOK) with git commit/push'
  }
  return null
}

function detectBypass (command) {
  if (typeof command !== 'string' || command.length === 0) return null
  // Run the patterns against three views of the command:
  //   1. the raw command.
  //   2. an "unwrapped" copy with shell line continuations (backslash-newline)
  //      removed. The shell joins `--no-\<newline>verify` into the single token
  //      --no-verify before git parses it, but the raw text has the literal
  //      split across two lines; unwrapping makes it contiguous (rule 9).
  //   3. the unwrapped copy with shell quote and escape characters (' " \)
  //      removed. git and the shell treat `"--no-verif"`, `--no-ver''ify`, and
  //      `--no-\verify` identically to the bare flag, but the raw text hides the
  //      literal behind quotes or an escape; stripping collapses them (rules 6-7).
  // The boundary classes in matchBypassPatterns still gate, so a flag merged
  // into the middle of another token (`x"--no-verify"y` becomes `x--no-verifyy`)
  // is not a boundary match and does not trip. A flag passed through a shell
  // variable (`f=--no-verif; git commit $f`) still slips — the literal is not in
  // the text at all; see rule 8 in the header.
  const unwrapped = command.replace(/\\\r?\n/g, '')
  // A copy with shell expansions collapsed away. The shell removes a command
  // substitution ($(...) or `...`) or a parameter expansion (${...} or $name)
  // before git parses the line, so `--no-ver$()ify`, `--no-ver${x}ify`, and
  // `core.hooks$(:)Path` all reassemble the bare flag at runtime while hiding
  // the literal in the raw text. Collapsing the expansions reconstructs the
  // token. This is checked IN ADDITION TO the raw command, never instead of it,
  // so a substitution that literally CONTAINS the flag (`git commit $(echo
  // --no-verify)`) is still caught by the raw/unwrapped passes — only the empty-
  // or value-splice forms rely on this copy. A substitution assembled from
  // pieces that never form the literal (`$(printf -- '--no-ver'; printf 'ify')`)
  // is the shell-variable ceiling of rule 8: the literal is in neither view.
  const noExpansion = unwrapped
    .replace(/\$\([^()]*\)/g, '')            // $(...) command substitution
    .replace(/`[^`]*`/g, '')                 // `...` command substitution
    .replace(/\$\{[^}]*\}/g, '')             // ${...} parameter expansion
    .replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, '') // $name variable
  // Remove MULTI-WORD quoted strings (commit messages, echo text) before the
  // quote strip. A real bypass flag is always a single shell token — bare, or a
  // single-token quote like "--no-verif" or "-n" — never a multi-word quoted
  // phrase, which git would receive as one unknown argument and reject. Dropping
  // the phrases stops a flag-shaped WORD inside a message (`-m "pass -n to
  // disable"`, `-m "do not use --no-verify"`) from tripping the guard, while a
  // single-token quoted flag survives the drop and is still caught after the
  // quote strip. (A message that is literally and only "-n" is the one residual
  // over-block; committing that exact string is vanishingly rare, and the
  // fail-closed cost is one reworded message.)
  const dropPhrases = (s) => s
    .replace(/"[^"]*\s[^"]*"/g, ' ')
    .replace(/'[^']*\s[^']*'/g, ' ')
  // Phrase-free views: multi-word quoted strings removed, then quotes/escapes
  // stripped. These are the only views the -n rule may see.
  const phraseFree = [
    dropPhrases(unwrapped).replace(/['"\\]/g, ''),
    dropPhrases(noExpansion).replace(/['"\\]/g, ''),
  ]
  // The --no-verify and core.hooksPath rules run on every view, including the
  // raw command: those literals are unusual inside a normal message, so a quoted
  // mention tripping is the accepted fail-closed trade.
  for (const text of [command, unwrapped, noExpansion, ...phraseFree]) {
    const hit = matchBypassPatterns(text)
    if (hit) return hit
  }
  // The -n short-form and hook-manager rules run ONLY on the phrase-free views,
  // because a bare `-n` and the string `HUSKY=0` are both things that can appear
  // as ordinary WORDS inside a commit message. git confirms a `-n` inside a
  // message is the message, not the flag; the same reasoning applies to a message
  // that mentions a kill-switch. Dropping the quoted phrases removes that text
  // first, so only a real flag/assignment token remains.
  for (const text of phraseFree) {
    const hit = matchDashN(text) || matchHookManager(text)
    if (hit) return hit
  }
  return null
}

function main () {
  const payload = readPayload()
  if (payload === null) return 0

  const command = payload?.tool_input?.command
  const match = detectBypass(command)
  if (!match) return 0

  process.stderr.write(
    `[block-no-verify] refused: the command uses "${match}", which bypasses ` +
    `git's pre-commit, commit-msg, or pre-push hooks. Those hooks exist to ` +
    `stop broken commits, leaked secrets, and failing tests from reaching ` +
    `the remote. If you genuinely need to bypass them, run the command ` +
    `yourself in a terminal — this hook exists to protect agent-driven ` +
    `commits, not override the author's own judgment.\n`
  )
  return 2
}

// Export the pure functions for direct unit testing, and run main() when
// invoked as a script (which is how Claude Code launches the hook).
module.exports = { detectBypass, readPayload, main }
if (require.main === module) {
  process.exit(main())
}
