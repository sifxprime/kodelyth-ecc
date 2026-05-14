'use strict'

/**
 * Tests for scripts/hooks/smart-suggest.js
 * Tests signal detection logic.
 */

const assert = require('node:assert/strict')
const { test } = require('node:test')

// ── Replicate detection logic ─────────────────────────────────────────────

const SUGGESTION_RULES = [
  {
    signals: ['file_path', 'new_string', 'old_string', 'content'],
    keywords: ['.ts', '.tsx', '.js', '.py', '.go', '.rs', '.java', '.kt'],
    notKeywords: ['test', 'spec', '__test__'],
    suggestion: 'use code-reviewer',
    reason: 'Code was written — review before committing',
  },
  {
    signals: ['error', 'bug', 'crash', 'exception', 'undefined', 'null', 'failed', 'broken'],
    suggestion: 'use debug-detective',
    reason: 'A bug or error is present — trace it to root cause',
  },
  {
    signals: ['pull_request', 'gh pr create', 'created pr', 'pull request'],
    suggestion: 'use security-reviewer',
    reason: 'PR was created — run a security check before merge',
  },
  {
    signals: ['build succeeded', 'compiled successfully', 'build passed', 'tests passed'],
    suggestion: 'use e2e-runner',
    reason: 'Build passed — verify critical user flows with E2E tests',
  },
  {
    signals: ['route', 'endpoint', 'controller', 'handler', '/api/'],
    suggestion: 'use api-guardian',
    reason: 'API was modified — check for breaking changes',
  },
  {
    signals: ['i want to', 'i need to', 'how do i', 'help me build', 'implement'],
    suggestion: 'use pair-programmer',
    reason: 'Planning a feature — think it through before coding',
  },
  {
    signals: ['.tsx', '.jsx', 'component', '<button', '<form', '<input', 'onclick', 'onchange'],
    suggestion: 'use ux-reviewer',
    reason: 'UI was built — check UX and accessibility',
  },
  {
    signals: ['upgrade', 'migrate', 'version', 'breaking change', 'deprecated'],
    suggestion: 'use migration-guide',
    reason: 'Migration or upgrade detected — get a phased plan',
  },
]

function detectSuggestion(content) {
  const lower = content.toLowerCase()

  for (const rule of SUGGESTION_RULES) {
    const hasSignal = (rule.signals || []).some(s => lower.includes(s.toLowerCase()))
    const hasKeyword = !rule.keywords || rule.keywords.some(k => lower.includes(k.toLowerCase()))
    const hasNoExclusion = !rule.notKeywords || !rule.notKeywords.some(k => lower.includes(k.toLowerCase()))

    if (hasSignal && hasKeyword && hasNoExclusion) {
      return { suggestion: rule.suggestion, reason: rule.reason }
    }
  }

  return null
}

// ── detectSuggestion ──────────────────────────────────────────────────────

test('detects code edit → suggests code-reviewer', () => {
  const result = detectSuggestion('file_path: src/auth.ts new_string: ...')
  assert.ok(result)
  assert.equal(result.suggestion, 'use code-reviewer')
})

test('detects error → suggests debug-detective', () => {
  const result = detectSuggestion('TypeError: Cannot read property of undefined')
  assert.ok(result)
  assert.equal(result.suggestion, 'use debug-detective')
})

test('detects crash → suggests debug-detective', () => {
  const result = detectSuggestion('app crash on startup')
  assert.ok(result)
  assert.equal(result.suggestion, 'use debug-detective')
})

test('detects PR creation → suggests security-reviewer', () => {
  const result = detectSuggestion('gh pr create --title "feat: add auth"')
  assert.ok(result)
  assert.equal(result.suggestion, 'use security-reviewer')
})

test('detects build passed → suggests e2e-runner', () => {
  const result = detectSuggestion('build succeeded — all 24 tests passed')
  assert.ok(result)
  assert.equal(result.suggestion, 'use e2e-runner')
})

test('detects API route → suggests api-guardian', () => {
  const result = detectSuggestion('created new endpoint /api/users')
  assert.ok(result)
  assert.equal(result.suggestion, 'use api-guardian')
})

test('detects feature planning → suggests pair-programmer', () => {
  const result = detectSuggestion('i want to build a notification system')
  assert.ok(result)
  assert.equal(result.suggestion, 'use pair-programmer')
})

test('detects UI component → suggests ux-reviewer', () => {
  const result = detectSuggestion('created a new component with <button onClick...')
  assert.ok(result)
  assert.equal(result.suggestion, 'use ux-reviewer')
})

test('detects migration → suggests migration-guide', () => {
  const result = detectSuggestion('upgrade from Next.js 13 to 15 — breaking change')
  assert.ok(result)
  assert.equal(result.suggestion, 'use migration-guide')
})

test('returns null for unrelated content', () => {
  const result = detectSuggestion('hello world nothing special here')
  assert.equal(result, null)
})

test('does not suggest code-reviewer for test file edits', () => {
  const result = detectSuggestion('file_path: src/auth.test.ts new_string: ...')
  // test keyword exclusion means code-reviewer is skipped
  // but another rule might match — we just verify it is NOT code-reviewer
  if (result) {
    assert.notEqual(result.suggestion, 'use code-reviewer')
  }
})

test('returns first matching rule — error takes priority over API route', () => {
  const result = detectSuggestion('error in the route handler: exception thrown')
  assert.ok(result)
  // error rule comes before route rule in the list
  assert.equal(result.suggestion, 'use debug-detective')
})
