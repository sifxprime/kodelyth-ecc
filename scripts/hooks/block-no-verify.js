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
 *   • --no-verify — git commit/push/merge/rebase/am. Match the literal flag
 *     on a word boundary so that trailing text ("--no-verify-ssl") doesn't
 *     false-positive.
 *   • git commit -n — short form of --no-verify, but only on commit. Other
 *     subcommands use -n for different things (git log -n 5 = count), so
 *     the scope is intentionally narrow.
 *
 * False positives we knowingly accept: shell comments (`# --no-verify`) and
 * string literals that mention the flag (`echo "do not use --no-verify"`).
 * The cost of a spurious block is one edited command; the cost of a silent
 * allow is why this hook exists.
 */
function detectBypass (command) {
  if (typeof command !== 'string' || command.length === 0) return null
  // --no-verify as a complete flag. Boundary on both sides to reject
  // --no-verify-ssl and similar.
  if (/(^|[\s;&|`(])--no-verify(\s|$|[;&|`)])/.test(command)) {
    return '--no-verify'
  }
  // `git commit ... -n` short form. Allow arbitrary args between `git` and
  // `commit` (e.g. `git -C /tmp commit -n`) so long as no shell command
  // boundary intervenes; that way a later `git log -n 5` on the same line
  // isn't conflated with a commit bypass.
  if (/\bgit\b[^;&|`\n]*?\bcommit\b[^;&|`\n]*?\s-n\b/.test(command)) {
    return 'git commit -n'
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
