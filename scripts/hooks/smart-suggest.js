#!/usr/bin/env node
/**
 * Kodelyth ECC — Smart Suggest Hook
 * Stop: runs after each Claude response
 *
 * Reads what just happened in the session transcript and suggests
 * the most logical next agent or command to invoke.
 *
 * Respects ECC_DISABLED_HOOKS env var.
 */

'use strict'

const SUGGESTION_RULES = [
  {
    // Code was written/edited → suggest code review
    signals: ['file_path', 'new_string', 'old_string', 'content'],
    keywords: ['.ts', '.tsx', '.js', '.py', '.go', '.rs', '.java', '.kt'],
    notKeywords: ['test', 'spec', '__test__'],
    suggestion: 'use code-reviewer',
    reason: 'Code was written — review before committing',
  },
  {
    // Error/bug mentioned → suggest debug-detective
    signals: ['error', 'bug', 'crash', 'exception', 'undefined', 'null', 'failed', 'broken'],
    suggestion: 'use debug-detective',
    reason: 'A bug or error is present — trace it to root cause',
  },
  {
    // PR created → suggest security review
    signals: ['pull_request', 'gh pr create', 'created pr', 'pull request'],
    suggestion: 'use security-reviewer',
    reason: 'PR was created — run a security check before merge',
  },
  {
    // Build succeeded → suggest E2E tests
    signals: ['build succeeded', 'compiled successfully', 'build passed', 'tests passed'],
    suggestion: 'use e2e-runner',
    reason: 'Build passed — verify critical user flows with E2E tests',
  },
  {
    // API route created/modified → suggest api-guardian
    signals: ['route', 'endpoint', 'controller', 'handler', '/api/'],
    suggestion: 'use api-guardian',
    reason: 'API was modified — check for breaking changes',
  },
  {
    // New feature planning → suggest pair programmer
    signals: ['i want to', 'i need to', 'how do i', 'help me build', 'implement'],
    suggestion: 'use pair-programmer',
    reason: 'Planning a feature — think it through before coding',
  },
  {
    // Frontend UI written → suggest ux-reviewer
    signals: ['.tsx', '.jsx', 'component', '<button', '<form', '<input', 'onClick', 'onChange'],
    suggestion: 'use ux-reviewer',
    reason: 'UI was built — check UX and accessibility',
  },
  {
    // Major dependency mentioned → suggest migration guide
    signals: ['upgrade', 'migrate', 'version', 'breaking change', 'deprecated'],
    suggestion: 'use migration-guide',
    reason: 'Migration or upgrade detected — get a phased plan',
  },
]

function isDisabled () {
  const disabled = (process.env.ECC_DISABLED_HOOKS || '').split(',')
  return disabled.includes('kodelyth:smart-suggest')
}

function detectSuggestion (content) {
  const lower = content.toLowerCase()

  for (const rule of SUGGESTION_RULES) {
    const hasSignal = (rule.signals || []).some(s => lower.includes(s.toLowerCase()))
    const hasKeyword = !rule.keywords || rule.keywords.some(k => lower.includes(k.toLowerCase()))
    const hasNoExclusion = !rule.notKeywords || !rule.notKeywords.some(k => lower.includes(k.toLowerCase()))

    if (hasSignal && hasKeyword && hasNoExclusion) {
      return rule
    }
  }

  return null
}

async function main () {
  if (isDisabled()) {
    const raw = await readStdin()
    process.stdout.write(raw)
    return
  }

  const raw = await readStdin()
  let input

  try {
    input = JSON.parse(raw)
  } catch {
    process.stdout.write(raw)
    return
  }

  // Extract content from the session transcript
  const transcript = JSON.stringify(input || {})
  const rule = detectSuggestion(transcript)

  if (rule) {
    const message = [
      '',
      '┌─ Kodelyth Smart Suggest ───────────────────────────────────┐',
      `│  Next: ${rule.suggestion.padEnd(54)} │`,
      `│  Why:  ${rule.reason.slice(0, 54).padEnd(54)} │`,
      '└────────────────────────────────────────────────────────────┘',
      '',
    ].join('\n')

    process.stderr.write(message)
  }

  process.stdout.write(raw)
}

function readStdin () {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => { data += chunk })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', () => resolve(data))
    setTimeout(() => resolve(data), 3000)
  })
}

main().catch(() => {
  process.exit(0)
})
