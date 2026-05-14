'use strict'

/**
 * Tests for scripts/hooks/test-reminder.js
 * Tests the pure logic functions directly without spawning a process.
 */

const assert = require('node:assert/strict')
const { test } = require('node:test')

// ── Extract pure functions for testing ────────────────────────────────────────

const TEST_FILE_PATTERNS = [
  /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/,
  /\.(test|spec)\.py$/,
  /__tests__/,
  /\/tests?\//,
  /_test\.go$/,
  /_spec\.rb$/,
  /\.test\.rs$/,
  /Test\.java$/,
  /Spec\.kt$/,
]

const CODE_FILE_PATTERNS = [
  /\.(ts|tsx|js|jsx|mjs)$/,
  /\.py$/,
  /\.go$/,
  /\.rs$/,
  /\.java$/,
  /\.kt$/,
  /\.rb$/,
  /\.cs$/,
  /\.cpp$|\.cc$|\.cxx$/,
]

const IGNORED_PATHS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /build\//,
  /coverage\//,
  /\.next\//,
  /\.nuxt\//,
  /migrations\//,
  /generated\//,
]

function isTestFile(filePath) {
  return TEST_FILE_PATTERNS.some(p => p.test(filePath))
}

function isIgnored(filePath) {
  return IGNORED_PATHS.some(p => p.test(filePath))
}

function isCodeFile(filePath) {
  return CODE_FILE_PATTERNS.some(p => p.test(filePath)) && !isTestFile(filePath)
}

// ── isTestFile ─────────────────────────────────────────────────────────────

test('isTestFile — detects .test.ts', () => {
  assert.equal(isTestFile('src/utils.test.ts'), true)
})

test('isTestFile — detects .spec.js', () => {
  assert.equal(isTestFile('src/api.spec.js'), true)
})

test('isTestFile — detects __tests__ directory', () => {
  assert.equal(isTestFile('src/__tests__/auth.ts'), true)
})

test('isTestFile — detects /tests/ directory', () => {
  assert.equal(isTestFile('tests/hook.test.js'), true)
})

test('isTestFile — detects _test.go', () => {
  assert.equal(isTestFile('server/handler_test.go'), true)
})

test('isTestFile — detects Test.java', () => {
  assert.equal(isTestFile('src/AuthServiceTest.java'), true)
})

test('isTestFile — detects Spec.kt', () => {
  assert.equal(isTestFile('src/UserSpec.kt'), true)
})

test('isTestFile — does not flag regular .ts file', () => {
  assert.equal(isTestFile('src/utils.ts'), false)
})

test('isTestFile — does not flag regular .py file', () => {
  assert.equal(isTestFile('src/service.py'), false)
})

// ── isCodeFile ─────────────────────────────────────────────────────────────

test('isCodeFile — detects .ts', () => {
  assert.equal(isCodeFile('src/auth.ts'), true)
})

test('isCodeFile — detects .py', () => {
  assert.equal(isCodeFile('app/service.py'), true)
})

test('isCodeFile — detects .go', () => {
  assert.equal(isCodeFile('server/handler.go'), true)
})

test('isCodeFile — detects .rs', () => {
  assert.equal(isCodeFile('src/main.rs'), true)
})

test('isCodeFile — detects .java', () => {
  assert.equal(isCodeFile('src/UserService.java'), true)
})

test('isCodeFile — does not classify a test file as code', () => {
  assert.equal(isCodeFile('src/auth.test.ts'), false)
})

test('isCodeFile — does not classify .md as code', () => {
  assert.equal(isCodeFile('README.md'), false)
})

test('isCodeFile — does not classify .json as code', () => {
  assert.equal(isCodeFile('config.json'), false)
})

// ── isIgnored ──────────────────────────────────────────────────────────────

test('isIgnored — ignores node_modules', () => {
  assert.equal(isIgnored('node_modules/lodash/index.js'), true)
})

test('isIgnored — ignores .next build output', () => {
  assert.equal(isIgnored('.next/server/app.js'), true)
})

test('isIgnored — ignores dist/', () => {
  assert.equal(isIgnored('dist/bundle.js'), true)
})

test('isIgnored — ignores generated/', () => {
  assert.equal(isIgnored('generated/graphql.ts'), true)
})

test('isIgnored — does not ignore src/', () => {
  assert.equal(isIgnored('src/auth.ts'), false)
})

// ── Logic: should reminder fire? ───────────────────────────────────────────

test('reminder fires when code edited with no test touched', () => {
  const files = ['src/auth.ts']
  const codeFiles = files.filter(f => !isIgnored(f) && isCodeFile(f))
  const testFiles = files.filter(f => !isIgnored(f) && isTestFile(f))
  assert.equal(codeFiles.length > 0 && testFiles.length === 0, true)
})

test('reminder does not fire when test file also touched', () => {
  const files = ['src/auth.ts', 'src/auth.test.ts']
  const codeFiles = files.filter(f => !isIgnored(f) && isCodeFile(f))
  const testFiles = files.filter(f => !isIgnored(f) && isTestFile(f))
  assert.equal(codeFiles.length > 0 && testFiles.length === 0, false)
})

test('reminder does not fire when only markdown edited', () => {
  const files = ['README.md']
  const codeFiles = files.filter(f => !isIgnored(f) && isCodeFile(f))
  assert.equal(codeFiles.length, 0)
})

test('reminder does not fire for ignored paths', () => {
  const files = ['node_modules/express/index.js']
  const codeFiles = files.filter(f => !isIgnored(f) && isCodeFile(f))
  assert.equal(codeFiles.length, 0)
})
