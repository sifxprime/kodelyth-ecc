#!/usr/bin/env node
/**
 * Kodelyth ECC — Test Reminder Hook
 * PostToolUse: Edit / Write / MultiEdit
 *
 * If code files were edited but NO test file was touched in the same
 * response, inject a gentle reminder to write tests.
 *
 * Respects ECC_DISABLED_HOOKS env var.
 */

'use strict'

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

function isDisabled () {
  const disabled = (process.env.ECC_DISABLED_HOOKS || '').split(',')
  return disabled.includes('kodelyth:test-reminder')
}

function isIgnored (filePath) {
  return IGNORED_PATHS.some(p => p.test(filePath))
}

function isTestFile (filePath) {
  return TEST_FILE_PATTERNS.some(p => p.test(filePath))
}

function isCodeFile (filePath) {
  return CODE_FILE_PATTERNS.some(p => p.test(filePath)) && !isTestFile(filePath)
}

async function main () {
  if (isDisabled()) {
    process.stdout.write(await readStdin())
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

  // Collect all files touched in this tool use
  const filePath = input?.tool_input?.file_path || input?.tool_input?.path || ''
  const files = [filePath].filter(Boolean)

  if (files.length === 0) {
    process.stdout.write(raw)
    return
  }

  const codeFiles = files.filter(f => !isIgnored(f) && isCodeFile(f))
  const testFiles = files.filter(f => !isIgnored(f) && isTestFile(f))

  // Only remind if code was written but no test file was touched
  if (codeFiles.length > 0 && testFiles.length === 0) {
    const fileNames = codeFiles.map(f => f.split('/').pop()).join(', ')
    const message = [
      '',
      '┌─ Kodelyth Test Reminder ───────────────────────────────────┐',
      `│  Code edited: ${fileNames.slice(0, 50).padEnd(50)} │`,
      '│  No test file was touched.                                 │',
      '│                                                            │',
      '│  Consider: use tdd-guide  or  /tdd                        │',
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
  process.exit(0) // never block tool execution
})
