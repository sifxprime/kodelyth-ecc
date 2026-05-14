'use strict'

/**
 * Tests for scripts/hooks/branch-name-check.js
 * Tests the pure logic functions directly.
 */

const assert = require('node:assert/strict')
const { test } = require('node:test')

// ── Replicate pure functions ───────────────────────────────────────────────

const VALID_PREFIXES = [
  'feat', 'fix', 'chore', 'docs', 'refactor',
  'test', 'perf', 'ci', 'hotfix', 'release',
  'experiment', 'spike', 'wip',
]

const BRANCH_REGEX = new RegExp(
  `^(${VALID_PREFIXES.join('|')})\\/[a-z0-9][a-z0-9-._/]{1,60}$`
)

const PROTECTED_BRANCHES = ['main', 'master', 'develop', 'staging', 'production']

function isValid(name) {
  return BRANCH_REGEX.test(name)
}

function isProtected(name) {
  return PROTECTED_BRANCHES.includes(name)
}

function extractBranchName(command) {
  const checkoutMatch = command.match(/git\s+checkout\s+(?:-b|-B)\s+([^\s]+)/)
  if (checkoutMatch) return checkoutMatch[1]

  const switchMatch = command.match(/git\s+switch\s+(?:-c|-C)\s+([^\s]+)/)
  if (switchMatch) return switchMatch[1]

  return null
}

// ── isValid ────────────────────────────────────────────────────────────────

test('isValid — accepts feat/add-auth', () => {
  assert.equal(isValid('feat/add-auth'), true)
})

test('isValid — accepts fix/null-pointer-checkout', () => {
  assert.equal(isValid('fix/null-pointer-checkout'), true)
})

test('isValid — accepts hotfix/payment-double-charge', () => {
  assert.equal(isValid('hotfix/payment-double-charge'), true)
})

test('isValid — accepts release/2.1.0', () => {
  assert.equal(isValid('release/2.1.0'), true)
})

test('isValid — accepts chore/upgrade-typescript-5', () => {
  assert.equal(isValid('chore/upgrade-typescript-5'), true)
})

test('isValid — accepts wip/experiments', () => {
  assert.equal(isValid('wip/experiments'), true)
})

test('isValid — rejects no-prefix branch', () => {
  assert.equal(isValid('my-feature'), false)
})

test('isValid — rejects uppercase type', () => {
  assert.equal(isValid('FEAT/add-auth'), false)
})

test('isValid — rejects unknown type prefix', () => {
  assert.equal(isValid('feature/add-auth'), false)
})

test('isValid — rejects empty description', () => {
  assert.equal(isValid('feat/'), false)
})

test('isValid — rejects description starting with dash', () => {
  assert.equal(isValid('feat/-bad-start'), false)
})

test('isValid — rejects bare branch name with no slash', () => {
  assert.equal(isValid('my-branch'), false)
})

// ── isProtected ────────────────────────────────────────────────────────────

test('isProtected — main is protected', () => {
  assert.equal(isProtected('main'), true)
})

test('isProtected — master is protected', () => {
  assert.equal(isProtected('master'), true)
})

test('isProtected — staging is protected', () => {
  assert.equal(isProtected('staging'), true)
})

test('isProtected — feat/something is not protected', () => {
  assert.equal(isProtected('feat/something'), false)
})

// ── extractBranchName ──────────────────────────────────────────────────────

test('extractBranchName — git checkout -b', () => {
  assert.equal(
    extractBranchName('git checkout -b feat/add-login'),
    'feat/add-login'
  )
})

test('extractBranchName — git checkout -B', () => {
  assert.equal(
    extractBranchName('git checkout -B hotfix/urgent-fix'),
    'hotfix/urgent-fix'
  )
})

test('extractBranchName — git switch -c', () => {
  assert.equal(
    extractBranchName('git switch -c fix/broken-button'),
    'fix/broken-button'
  )
})

test('extractBranchName — git switch -C', () => {
  assert.equal(
    extractBranchName('git switch -C release/1.2.0'),
    'release/1.2.0'
  )
})

test('extractBranchName — unrelated command returns null', () => {
  assert.equal(
    extractBranchName('git status'),
    null
  )
})

test('extractBranchName — git pull returns null', () => {
  assert.equal(
    extractBranchName('git pull origin main'),
    null
  )
})

test('extractBranchName — git commit returns null', () => {
  assert.equal(
    extractBranchName('git commit -m "fix: broken auth"'),
    null
  )
})

// ── End-to-end logic ──────────────────────────────────────────────────────

test('should block — extracts invalid branch name from command', () => {
  const command = 'git checkout -b my-random-branch'
  const name = extractBranchName(command)
  assert.ok(name)
  assert.equal(isProtected(name), false)
  assert.equal(isValid(name), false)
})

test('should pass — extracts valid branch name from command', () => {
  const command = 'git checkout -b feat/user-authentication'
  const name = extractBranchName(command)
  assert.ok(name)
  assert.equal(isValid(name), true)
})

test('should pass — protected branch always passes', () => {
  const command = 'git checkout -b main'
  const name = extractBranchName(command)
  assert.ok(name)
  assert.equal(isProtected(name), true)
})
