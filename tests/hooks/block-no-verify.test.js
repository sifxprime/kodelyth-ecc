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
    assert.equal(detectBypass(cmd), '--no-verify', `should block: ${cmd}`)
  }
})

test('detectBypass blocks git commit -n short form', () => {
  for (const cmd of [
    'git commit -n -m "x"',
    'git commit -n -am "x"',
    'git -C /tmp commit -n -m "x"',   // flag between git and commit
  ]) {
    assert.equal(detectBypass(cmd), 'git commit -n', `should block: ${cmd}`)
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
