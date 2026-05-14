#!/usr/bin/env node
/**
 * Kodelyth ECC — Branch Name Check Hook
 * PreToolUse: Bash
 *
 * Intercepts `git checkout -b` and `git switch -c` commands.
 * Validates the branch name follows conventional patterns.
 * Blocks invalid names with a clear explanation.
 *
 * Valid patterns:
 *   feat/description
 *   fix/description
 *   chore/description
 *   docs/description
 *   refactor/description
 *   test/description
 *   perf/description
 *   ci/description
 *   hotfix/description
 *   release/1.2.0
 *
 * Respects ECC_DISABLED_HOOKS env var.
 */

'use strict'

const VALID_PREFIXES = [
  'feat',
  'fix',
  'chore',
  'docs',
  'refactor',
  'test',
  'perf',
  'ci',
  'hotfix',
  'release',
  'experiment',
  'spike',
  'wip',
]

const BRANCH_REGEX = new RegExp(
  `^(${VALID_PREFIXES.join('|')})\\/[a-z0-9][a-z0-9-._/]{1,60}$`
)

// Protected branches — never block these
const PROTECTED_BRANCHES = ['main', 'master', 'develop', 'staging', 'production']

// Extract branch name from git command
function extractBranchName (command) {
  // git checkout -b branch-name
  const checkoutMatch = command.match(/git\s+checkout\s+(?:-b|-B)\s+([^\s]+)/)
  if (checkoutMatch) return checkoutMatch[1]

  // git switch -c branch-name
  const switchMatch = command.match(/git\s+switch\s+(?:-c|-C)\s+([^\s]+)/)
  if (switchMatch) return switchMatch[1]

  return null
}

function isDisabled () {
  const disabled = (process.env.ECC_DISABLED_HOOKS || '').split(',')
  return disabled.includes('kodelyth:branch-name')
}

function isProtected (name) {
  return PROTECTED_BRANCHES.includes(name)
}

function isValid (name) {
  return BRANCH_REGEX.test(name)
}

function buildError (branchName) {
  return {
    type: 'user_prompt_submit',
    content: [
      {
        type: 'text',
        text: [
          `Branch name "${branchName}" doesn't follow the Kodelyth convention.`,
          '',
          'Valid format: <type>/<description>',
          '',
          'Types: ' + VALID_PREFIXES.join(', '),
          '',
          'Examples:',
          '  feat/add-user-authentication',
          '  fix/null-pointer-in-checkout',
          '  chore/upgrade-typescript-5',
          '  hotfix/payment-double-charge',
          '  release/2.1.0',
          '',
          'Rules:',
          '  - lowercase letters, numbers, hyphens only',
          '  - must have a type prefix',
          '  - description must be meaningful (not just "fix" or "test")',
        ].join('\n'),
      },
    ],
  }
}

async function main () {
  const raw = await readStdin()

  if (isDisabled()) {
    process.stdout.write(raw)
    return
  }

  let input

  try {
    input = JSON.parse(raw)
  } catch {
    process.stdout.write(raw)
    return
  }

  const command = input?.tool_input?.command || ''

  const branchName = extractBranchName(command)

  if (!branchName) {
    // Not a branch creation command — pass through
    process.stdout.write(raw)
    return
  }

  if (isProtected(branchName)) {
    // Protected branches are fine
    process.stdout.write(raw)
    return
  }

  if (isValid(branchName)) {
    // Valid name — pass through silently
    process.stdout.write(raw)
    return
  }

  // Invalid — block with explanation
  process.stdout.write(JSON.stringify(buildError(branchName)))
  process.exit(2) // exit code 2 = block the tool call
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
  process.exit(0) // never hard-fail — just pass through
})
