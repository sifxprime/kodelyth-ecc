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
 * Still out of scope, documented so the gap is explicit rather than silent:
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

// Apply the three bypass patterns to one already-normalized command string.
// Returns the matched label or null. detectBypass() runs this against both the
// raw command and a quote/escape-stripped copy.
function matchBypassPatterns (command) {
  // --no-verify and its two unambiguous prefixes (--no-verif, --no-veri).
  // The optional (f(y)?)? makes --no-veri match on its own; the terminator
  // set excludes '-' so --no-verify-signatures (push/merge sig verify) and
  // any hypothetical --no-verifier do not false-positive.
  if (/(^|[\s;&|`(])--no-veri(f(y)?)?(\s|$|[;&|`)=])/.test(command)) {
    return '--no-verify (or an unambiguous prefix: --no-veri / --no-verif)'
  }
  // `git commit ... -n` short form. Allow arbitrary args between `git` and
  // `commit` (e.g. `git -C /tmp commit -n`) so long as no shell command
  // boundary intervenes; that way a later `git log -n 5` on the same line
  // isn't conflated with a commit bypass.
  if (/\bgit\b[^;&|`\n]*?\bcommit\b[^;&|`\n]*?\s-n\b/.test(command)) {
    return 'git commit -n'
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
  const variants = [command, unwrapped, unwrapped.replace(/['"\\]/g, '')]
  for (const text of variants) {
    const hit = matchBypassPatterns(text)
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
