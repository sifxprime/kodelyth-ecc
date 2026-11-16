'use strict'

/**
 * Tests for scripts/hooks/block-no-verify.js
 *
 * Covers both:
 *  • the pure detectBypass() function — fast, deterministic unit coverage
 *  • the actual script invoked with stdin — end-to-end behaviour, exit code
 *    semantics (exit 2 = block; anything else = allow), and the regression
 *    guarantee Daisy's report targeted: no network dependency, so no
 *    network-failure fail-open path can exist.
 */

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const HOOK = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'block-no-verify.js')
const { detectBypass } = require(HOOK)

function run (payload, { env } = {}) {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return spawnSync(process.execPath, [HOOK], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: env || process.env,
  })
}

// ── detectBypass() unit coverage ─────────────────────────────────────────

test('detectBypass allows ordinary commands', () => {
  for (const cmd of [
    'ls -la',
    'git status',
    'git log -n 5',
    'git log --oneline -n 20',
    'git commit -m "normal"',
    'git commit -am "normal"',
    'git push origin main',
    'npm install',
    'node tests/run-all.js',
    'echo "safe"',
    '',
  ]) {
    assert.equal(detectBypass(cmd), null, `should allow: ${cmd}`)
  }
})

test('detectBypass blocks --no-verify in every position', () => {
  for (const cmd of [
    'git commit --no-verify -m "x"',
    'git commit -m "x" --no-verify',
    'git push --no-verify',
    'git merge --no-verify branch',
    'git rebase --no-verify main',
    'git am --no-verify',
    'echo setup && git commit --no-verify -m "x"',
    'git commit -m "x" || git commit --no-verify -m "y"',
    'git commit -m "x"; git push --no-verify',
    '(git commit --no-verify -m "x")',
  ]) {
    assert.match(detectBypass(cmd), /^--no-verify/, `should block: ${cmd}`)
  }
})

// v2.31.6: git's parse-options accepts any unambiguous prefix, so the
// regex must catch --no-veri and --no-verif too, not just the literal
// word. Daisy's second report, verified in-session: both forms bypass
// the pre-commit hook in live git.
test('detectBypass blocks unambiguous prefixes of --no-verify', () => {
  for (const cmd of [
    'git commit --no-veri -m "x"',
    'git commit --no-verif -m "x"',
    'git push --no-veri',
    'git push --no-verif',
    'echo setup && git commit --no-verif -m "x"',
    'git commit -m "x" || git commit --no-veri -m "y"',
  ]) {
    assert.match(detectBypass(cmd), /^--no-verify/, `should block: ${cmd}`)
  }
})

test('detectBypass does NOT touch --no-verify-signatures (sig verify, not hook bypass)', () => {
  // git push/merge accept --no-verify-signatures to skip GPG verification
  // of pulled commits — completely unrelated to hook bypass. The hyphen
  // after "verify" must not count as a terminator.
  for (const cmd of [
    'git push --no-verify-signatures origin main',
    'git merge --no-verify-signatures branch',
    'curl --no-verify-hostname foo',  // unrelated tool with similar flag
  ]) {
    assert.equal(detectBypass(cmd), null, `should allow: ${cmd}`)
  }
})

test('detectBypass blocks git commit -n short form', () => {
  for (const cmd of [
    'git commit -n -m "x"',
    'git commit -n -am "x"',
    'git -C /tmp commit -n -m "x"',   // flag between git and commit
  ]) {
    assert.match(detectBypass(cmd) || '', /^git commit -n/, `should block: ${cmd}`)
  }
})

test('detectBypass does NOT confuse git log -n with commit -n', () => {
  for (const cmd of [
    'git log -n 5',
    'git log -n 20 --oneline',
    'git log -n 10; git commit -m "x"',
  ]) {
    assert.equal(detectBypass(cmd), null, `should allow: ${cmd}`)
  }
})

test('detectBypass does NOT match --no-verify-ssl and similar suffixes', () => {
  for (const cmd of [
    'curl --no-verify-ssl https://example.com',
    'wget --no-verify-hostname foo',
  ]) {
    assert.equal(detectBypass(cmd), null, `should allow: ${cmd}`)
  }
})

// v2.31.6: `git -c core.hooksPath=/dev/null commit` and the persistent
// `git config core.hooksPath ...` form both route past the repo's hooks
// without ever mentioning --no-verify. Caught now by matching both
// tokens (git + core.hooksPath) in the same command segment.
test('detectBypass blocks core.hooksPath override in every form', () => {
  for (const cmd of [
    'git -c core.hooksPath=/dev/null commit -m "x"',
    'git -c core.hooksPath=/tmp/empty commit -m "x"',
    'git config core.hooksPath /dev/null',
    'git config --global core.hooksPath /dev/null',
    'git config --local core.hooksPath /dev/null',
    'echo setup && git -c core.hooksPath=/dev/null commit -m "x"',
    // env-var form: GIT_CONFIG_PARAMETERS appears BEFORE git on the line
    "GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\" git commit -m x",
    // GIT_CONFIG_COUNT/KEY_N/VALUE_N trio form
    'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m x',
  ]) {
    assert.equal(detectBypass(cmd), 'core.hooksPath override', `should block: ${cmd}`)
  }
})

// v2.31.8 case 5: git config keys are case-insensitive, so core.hookspath and
// core.HooksPath are the same key as core.hooksPath. Verified a real bypass in
// live git (lowercase hookspath lands a commit past a failing pre-commit hook).
test('detectBypass blocks case-variant core.hooksPath', () => {
  for (const cmd of [
    'git -c core.hookspath=/dev/null commit -m x',
    'git -c core.HooksPath=/dev/null commit -m x',
    'git -c core.HOOKSPATH=/dev/null commit -m x',
    'git config core.HOOKSPATH /dev/null',
  ]) {
    assert.equal(detectBypass(cmd), 'core.hooksPath override', `should block: ${cmd}`)
  }
})

// v2.31.8 cases 6 & 7: the shell collapses quoted and spliced/escaped forms to
// the bare flag before git parses them, so the literal word is hidden in the
// raw text. The quote/escape-stripping pass catches all of these.
test('detectBypass blocks quoted, concatenated, and escaped bypass flags', () => {
  const noVerify = [
    'git commit "--no-verif" -m x',      // double-quoted
    "git commit '--no-verif' -m x",      // single-quoted
    "git commit --no-ver''ify -m x",     // single-quote splice
    'git commit --no-ver""ify -m x',     // double-quote splice
    'git commit --no-\\verify -m x',     // backslash escape
  ]
  for (const cmd of noVerify) {
    assert.match(detectBypass(cmd) || '', /^--no-verify/, `should block: ${cmd}`)
  }
  assert.match(detectBypass('git commit "-n" -m x') || '', /^git commit -n/, 'quoted -n')
  assert.equal(
    detectBypass('git -c "core.hooksPath=/dev/null" commit -m x'),
    'core.hooksPath override',
    'quoted hooksPath',
  )
})

// v2.31.9 case 9: a shell line continuation (backslash-newline) splits the flag
// across two physical lines. The shell joins the token before git parses it, so
// git receives --no-verify / core.hooksPath and bypasses the repo hooks, but the
// raw command text the hook sees has the literal broken across lines. Both forms
// were CONFIRMED live bypasses (commit landed past a failing pre-commit). The
// v2.31.8 strip removed ' " \ but kept the newline; detectBypass now unwraps
// backslash-newline first so the token becomes contiguous.
test('detectBypass blocks flags split by a shell line continuation', () => {
  assert.match(
    detectBypass('git commit --no-\\\nverify -m x') || '',
    /^--no-verify/,
    'line-continuation --no-verify',
  )
  assert.match(
    detectBypass('git commit --no-\\\r\nverify -m x') || '',
    /^--no-verify/,
    'CRLF line-continuation --no-verify',
  )
  assert.equal(
    detectBypass('git -c core.hooks\\\nPath=/dev/null commit -m x'),
    'core.hooksPath override',
    'line-continuation core.hooksPath',
  )
})

// The line-continuation unwrap must only matter when it reconstructs a real
// bypass token — a benign wrapped command carries no flag and must be allowed.
test('detectBypass allows a benign shell line continuation', () => {
  assert.equal(detectBypass('echo one \\\ntwo'), null)
  assert.equal(detectBypass('git status \\\n  --short'), null)
})

// v2.31.10 case 10: shell expansions that collapse to nothing can splice a flag
// token invisibly. The shell removes $(), empty backticks, and ${unset} before
// git parses, reassembling the bare flag; the raw text never shows it contiguous.
// All CONFIRMED live bypasses. detectBypass checks an expansion-stripped view.
test('detectBypass blocks flags spliced by empty shell expansions', () => {
  for (const cmd of [
    'git commit --no-ver$()ify -m x',
    'git commit --no-ver``ify -m x',        // empty backticks
    'git commit --no-ver${U}ify -m x',
    'git commit --no-ver$(:)ify -m x',       // non-empty parens, empty output
  ]) {
    assert.match(detectBypass(cmd) || '', /^--no-verify/, `should block: ${cmd}`)
  }
  assert.equal(detectBypass('git -c core.hooks$()Path=/dev/null commit -m x'), 'core.hooksPath override')
  assert.equal(detectBypass('git -c core.hooks${U}Path=/dev/null commit -m x'), 'core.hooksPath override')
})

// v2.31.10 case 11: git unbundles a single-dash short-flag run, so -n hides in
// -nm / -vn / -qn / -sn. CONFIRMED live bypasses. The pre-n class is no-arg flags
// only, so -mn (message "n") and -am (-a -m) do NOT match.
test('detectBypass blocks -n bundled into a short-flag cluster', () => {
  for (const cmd of ['git commit -nm x', 'git commit -vn -m x', 'git commit -qn -m x', 'git commit -snm x']) {
    assert.match(detectBypass(cmd) || '', /^git commit -n/, `should block: ${cmd}`)
  }
  // -m before n consumes n as the message value, so these are NOT bypasses.
  assert.equal(detectBypass('git commit -mn x'), null, '-mn is -m with message n')
  assert.equal(detectBypass('git commit -am "x"'), null, '-am is -a -m')
})

// A -n that is a WORD inside a quoted commit message is the message, not the flag
// (verified in live git: hooks RAN), so it must be allowed. Multi-word quoted
// phrases are dropped before the -n rule runs. (A quoted --no-verify still trips,
// by the documented fail-closed trade — that literal is rare in real messages.)
test('detectBypass does NOT trip on -n inside a commit message', () => {
  for (const cmd of [
    'git commit -m "add -n flag docs"',
    'git commit -m "the number is -n here"',
    'git commit -am "wip -n notes"',
    'git commit -m "release v2.31.10"',
  ]) {
    assert.equal(detectBypass(cmd), null, `should allow: ${cmd}`)
  }
})

// v2.31.10 case 12: husky/lefthook kill-switch env vars disable manager-installed
// git hooks. Verified as real bypasses in a manager-style repo. The env-var names
// are unambiguous, so an assignment alongside a git commit/push is a bypass.
test('detectBypass blocks hook-manager kill-switches with a git commit/push', () => {
  for (const cmd of [
    'HUSKY=0 git commit -m x',
    'HUSKY_SKIP_HOOKS=1 git commit -m x',
    'LEFTHOOK=0 git commit -m x',
    'LEFTHOOK=false git push',
    'export HUSKY=0; git commit -m x',
  ]) {
    assert.match(detectBypass(cmd) || '', /hook-manager/, `should block: ${cmd}`)
  }
})

// Lookalikes must be allowed: enabling values, different var names, message
// mentions, and a kill-switch with no git commit/push in the command.
test('detectBypass does NOT trip on hook-manager lookalikes', () => {
  for (const cmd of [
    'HUSKY=1 git commit -m x',
    'LEFTHOOK=1 git commit -m x',
    'MY_HUSKY=0 git commit -m x',
    'git commit -m "set HUSKY=0 in CI config"',
    'echo HUSKY=0 > .env',
    'husky install && git commit -m x',
  ]) {
    assert.equal(detectBypass(cmd), null, `should allow: ${cmd}`)
  }
})

// v2.31.8 case 8: a flag passed through a shell variable is NOT in the command
// text at all, so NO text pattern can catch it. This test PINS that known gap
// so the ceiling is explicit — if a future change appears to close it, that
// change is almost certainly over-matching and this test should be revisited,
// not silently deleted.
test('detectBypass does NOT catch a flag passed via a shell variable (documented ceiling)', () => {
  assert.equal(detectBypass('f=--no-verif; git commit $f -m x'), null)
  assert.equal(detectBypass('v=--no-verify && git commit $v'), null)
})

// The quote-stripping pass must not start matching a flag spliced into the
// MIDDLE of another token — the word-boundary classes still gate.
test('detectBypass does NOT trip on a flag embedded mid-token', () => {
  for (const cmd of [
    'echo x--no-verifyy',
    'echo "prefix--no-verifysuffix"',
    'grep -r "core.hooksPath" docs/',   // hooksPath but no git in segment
  ]) {
    assert.equal(detectBypass(cmd), null, `should allow: ${cmd}`)
  }
})

test('detectBypass does NOT trip on core.hooksPath outside a git context', () => {
  // Reading/greping documentation that mentions the config key is not a
  // bypass unless `git` is also in the same segment.
  for (const cmd of [
    'grep -r "core.hooksPath" docs/',
    'echo "the config key is called core.hooksPath" > notes.txt',
    'cat README.md | less',
  ]) {
    assert.equal(detectBypass(cmd), null, `should allow: ${cmd}`)
  }
})

test('detectBypass does NOT span shell command boundaries', () => {
  // A later, unrelated git command on the same line (chained with && / ;
  // / || / |) must not reach back and claim a core.hooksPath mentioned
  // in the first segment.
  assert.equal(
    detectBypass('echo "core.hooksPath is a config key" ; git status'),
    null,
    'echo-then-git across `;` must not trip',
  )
  assert.equal(
    detectBypass('cat core.hooksPath.txt && git log -n 1'),
    null,
    'cat-then-git across `&&` must not trip',
  )
})

test('detectBypass handles non-string input without throwing', () => {
  assert.equal(detectBypass(null), null)
  assert.equal(detectBypass(undefined), null)
  assert.equal(detectBypass(42), null)
  assert.equal(detectBypass({}), null)
})

// ── End-to-end spawn behaviour ───────────────────────────────────────────

test('end-to-end: exits 0 on empty stdin', () => {
  const r = run('')
  assert.equal(r.status, 0)
})

test('end-to-end: exits 0 on malformed JSON stdin', () => {
  const r = run('not json at all {')
  assert.equal(r.status, 0)
})

test('end-to-end: exits 0 on missing tool_input', () => {
  const r = run({ tool_name: 'Bash' })
  assert.equal(r.status, 0)
})

test('end-to-end: exits 0 on unrelated command', () => {
  const r = run({ tool_name: 'Bash', tool_input: { command: 'ls -la' } })
  assert.equal(r.status, 0)
  assert.equal(r.stderr, '')
})

test('end-to-end: exits 2 on --no-verify with explanation on stderr', () => {
  const r = run({
    tool_name: 'Bash',
    tool_input: { command: 'git commit --no-verify -m "x"' },
  })
  assert.equal(r.status, 2)
  assert.match(r.stderr, /refused/)
  assert.match(r.stderr, /--no-verify/)
})

test('end-to-end: exits 2 on git commit -n', () => {
  const r = run({
    tool_name: 'Bash',
    tool_input: { command: 'git commit -n -m "x"' },
  })
  assert.equal(r.status, 2)
  assert.match(r.stderr, /git commit -n/)
})

test('end-to-end: exits 2 on --no-verify prefix form', () => {
  const r = run({
    tool_name: 'Bash',
    tool_input: { command: 'git commit --no-verif -m "x"' },
  })
  assert.equal(r.status, 2)
  assert.match(r.stderr, /refused/)
})

test('end-to-end: exits 2 on core.hooksPath override', () => {
  const r = run({
    tool_name: 'Bash',
    tool_input: { command: 'git -c core.hooksPath=/dev/null commit -m "x"' },
  })
  assert.equal(r.status, 2)
  assert.match(r.stderr, /core\.hooksPath/)
})

// ── Regression guarantee for Daisy's finding ─────────────────────────────

test('regression: the hook has no network dependency', () => {
  // The whole point of vendoring this hook was that `npx block-no-verify`
  // failed open on network loss. The replacement is local-only — there is
  // no scenario in which the exit code depends on network reachability.
  // We prove this structurally: the script must not reference `npx`, must
  // not require() any npm-fetched module, and must not spawn child
  // processes.
  const src = require('node:fs').readFileSync(HOOK, 'utf8')

  // The ONLY mention of "npx" in the file is the explanatory comment at
  // the top; nothing in the executable path invokes it. Confirm by checking
  // there is no npx invocation pattern (as opposed to the word being inside
  // a comment).
  const executable = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(executable, /\bnpx\b/,
    'executable body must not invoke npx — that was the whole bug')
  assert.doesNotMatch(executable, /\bspawn\b|\bexec\b/,
    'executable body must not spawn child processes — a child could introduce the network dep back')
  // require() is fine for `node:` builtins and relative paths; forbid bare
  // npm module names (anything starting with a letter that isn't `node:`).
  const bareRequires = [...executable.matchAll(/require\s*\(\s*['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .filter((spec) => !spec.startsWith('node:') && !spec.startsWith('.') && !spec.startsWith('/'))
  assert.deepEqual(bareRequires, [],
    `executable body must only require() node: builtins or relative paths — no npm modules: ${bareRequires.join(', ')}`)
})

test('regression: a failing network cannot make the hook fail open', () => {
  // Simulate a network-dead environment by zeroing out DNS. If the vendored
  // hook ever regresses to doing network work, the child would hang; here
  // it must return promptly with status 2 on a --no-verify command.
  const r = run(
    { tool_name: 'Bash', tool_input: { command: 'git push --no-verify' } },
    { env: { ...process.env, no_proxy: '*', http_proxy: 'http://127.0.0.1:1', https_proxy: 'http://127.0.0.1:1' } }
  )
  assert.equal(r.status, 2, 'network-dead environment must still block bypass')
  assert.doesNotMatch(r.stderr, /ECONNREFUSED|ENOTFOUND|npm ERR|npx/,
    'stderr must not contain network errors — the hook is local-only')
})
