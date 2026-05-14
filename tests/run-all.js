#!/usr/bin/env node
'use strict'

/**
 * Kodelyth ECC — Test Runner
 * Runs all test files using Node.js built-in test runner.
 */

const { execSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const ROOT = path.resolve(__dirname, '..')

function findTests(dir) {
  const results = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findTests(full))
    } else if (entry.name.endsWith('.test.js')) {
      results.push(full)
    }
  }
  return results
}

const testFiles = findTests(path.join(ROOT, 'tests'))

if (testFiles.length === 0) {
  console.log('No test files found.')
  process.exit(0)
}

console.log(`\nKodelyth ECC — running ${testFiles.length} test file(s)\n`)

let failed = false

for (const file of testFiles) {
  const rel = path.relative(ROOT, file)
  try {
    execSync(`node --test ${file}`, { stdio: 'inherit' })
  } catch {
    failed = true
  }
}

if (failed) {
  console.error('\nSome tests failed.')
  process.exit(1)
} else {
  console.log('\nAll tests passed.')
}
