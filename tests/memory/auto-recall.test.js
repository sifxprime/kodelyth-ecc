// Tests for hooks/memory/auto-recall.js — UserPromptSubmit auto chat detection
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-recall-'));
process.env.KODELYTH_MEMORY_DIR = TMP;

const HOOK = path.join(__dirname, '..', '..', 'hooks', 'memory', 'auto-recall.js');
const store = require('../../scripts/memory/store');

function runHook(payload) {
  const res = spawnSync(process.execPath, [HOOK], {
    input:    JSON.stringify(payload),
    encoding: 'utf8',
    env:      { ...process.env, KODELYTH_MEMORY_DIR: TMP },
    timeout:  5000,
  });
  return { stdout: res.stdout || '', stderr: res.stderr || '', status: res.status };
}

// Seed memory once
store.capture({
  problem:  'Stripe webhook signature failed in production',
  approach: 'Switched body parser from json to raw, validated with constructEvent',
  tags:     ['payments', 'stripe', 'webhooks'],
  project:  '/test/payments',
  language: 'typescript',
});
store.capture({
  problem:  'Redis cluster split-brain after AZ failover',
  approach: 'Configured min-slaves-to-write to 2 to prevent stale primary writes',
  tags:     ['redis', 'cluster', 'reliability'],
  project:  '/test/payments',
  language: 'typescript',
});

test('auto-recall: returns nothing for empty prompt', () => {
  const r = runHook({ prompt: '', cwd: '/test/payments', session_id: 's1' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('auto-recall: skips trivial prompts', () => {
  for (const trivial of ['ok', 'yes', 'thanks', 'cool']) {
    const r = runHook({ prompt: trivial, cwd: '/test/payments', session_id: 's-trivial' });
    assert.equal(r.stdout, '', `should skip "${trivial}"`);
  }
});

test('auto-recall: skips agent invocation prompts', () => {
  for (const cmd of ['use debug-detective', '@code-reviewer', '/help', 'invoke security-reviewer']) {
    const r = runHook({ prompt: cmd, cwd: '/test/payments', session_id: 's-cmd' });
    assert.equal(r.stdout, '', `should skip "${cmd}"`);
  }
});

test('auto-recall: skips short prompts', () => {
  const r = runHook({ prompt: 'fix bug', cwd: '/test/payments', session_id: 's-short' });
  assert.equal(r.stdout, '');
});

test('auto-recall: surfaces relevant memory for a real query', () => {
  const r = runHook({
    prompt: 'I need to add Stripe webhooks for subscription renewal events',
    cwd:    '/test/payments',
    session_id: 's-fire-1',
  });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.length > 0, 'should produce output');
  const out = JSON.parse(r.stdout);
  assert.ok(out.additionalContext.includes('Stripe webhook'));
  assert.equal(out.meta.source, 'kodelyth-memory:auto-recall');
  assert.equal(out.meta.recalledCount, 1);
});

test('auto-recall: suppresses repeat in same session', () => {
  // First call surfaces the memory
  runHook({
    prompt: 'help with stripe webhook integration',
    cwd:    '/test/payments',
    session_id: 's-repeat',
  });
  // Second call same topic — should NOT surface again
  const r2 = runHook({
    prompt: 'about that stripe webhook problem, what about retries',
    cwd:    '/test/payments',
    session_id: 's-repeat',
  });
  assert.equal(r2.stdout, '', 'repeat should be suppressed');
});

test('auto-recall: surfaces different memory for different topic in same session', () => {
  runHook({
    prompt: 'how do I handle stripe webhook errors',
    cwd:    '/test/payments',
    session_id: 's-multi',
  });
  // Different topic — redis — should surface
  const r2 = runHook({
    prompt: 'redis cluster is acting weird after failover today',
    cwd:    '/test/payments',
    session_id: 's-multi',
  });
  assert.ok(r2.stdout.length > 0, 'different topic should surface');
  const out = JSON.parse(r2.stdout);
  assert.ok(out.additionalContext.toLowerCase().includes('redis'));
});

test('auto-recall: returns nothing when no memory matches', () => {
  const r = runHook({
    prompt: 'what is the meaning of life and quantum entanglement',
    cwd:    '/test/payments',
    session_id: 's-nomatch',
  });
  assert.equal(r.stdout, '');
});

test('auto-recall: never crashes on malformed payload', () => {
  const res = spawnSync(process.execPath, [HOOK], {
    input:    'not-json-at-all',
    encoding: 'utf8',
    env:      { ...process.env, KODELYTH_MEMORY_DIR: TMP },
    timeout:  3000,
  });
  assert.equal(res.status, 0, 'must exit 0 even on garbage input');
});
