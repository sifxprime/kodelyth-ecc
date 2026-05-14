// End-to-end tests for hooks/safety/token-budget.js
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.join(__dirname, '..', '..', 'hooks', 'safety', 'token-budget.js');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-budget-'));
}

function runHook(payload, env = {}) {
  const res = spawnSync(process.execPath, [HOOK], {
    input:    JSON.stringify(payload),
    encoding: 'utf8',
    env:      { ...process.env, ...env },
    timeout:  5000,
  });
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: res.status,
  };
}

test('default (mode=off): no-op, exit 0, no stderr', () => {
  const r = runHook({ hook_event_name: 'Stop', session_id: 's', prompt: 'hi' });
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
});

test('mode=warn: writes usage line, never blocks', () => {
  const dir = tmpDir();
  const r = runHook(
    { hook_event_name: 'Stop', session_id: 'sess1', prompt: 'A'.repeat(200) },
    { KODELYTH_TOKEN_BUDGET: 'warn', KODELYTH_TOKEN_BUDGET_DIR: dir }
  );
  assert.equal(r.status, 0);
  assert.match(r.stderr, /token-budget/);
  // State file should exist with positive token count.
  const state = JSON.parse(fs.readFileSync(path.join(dir, 'budget-sess1.json'), 'utf8'));
  assert.ok(state.tokens > 0);
  assert.equal(state.turns, 1);
});

test('mode=block: accumulates over turns, warns at >=70%, blocks SessionStart at 100%', () => {
  const dir = tmpDir();
  const env = { KODELYTH_TOKEN_BUDGET: '50', KODELYTH_TOKEN_BUDGET_DIR: dir };

  // Turn 1: 200 chars / 4 = 50 tokens — exactly hits budget.
  const r1 = runHook(
    { hook_event_name: 'Stop', session_id: 'cap', prompt: 'A'.repeat(200) },
    env
  );
  assert.equal(r1.status, 0, 'Stop never blocks (only warns)');
  // EXCEEDED message should fire (>=100%)
  assert.match(r1.stderr, /EXCEEDED|100%|token-budget/);

  // SessionStart now should block.
  const r2 = runHook(
    { hook_event_name: 'SessionStart', session_id: 'cap' },
    env
  );
  assert.equal(r2.status, 2, 'SessionStart must block when budget exhausted');
  assert.match(r2.stderr, /BLOCKED/);
});

test('mode=block: SessionStart passes when usage is under budget', () => {
  const dir = tmpDir();
  const env = { KODELYTH_TOKEN_BUDGET: '10000', KODELYTH_TOKEN_BUDGET_DIR: dir };
  const r = runHook(
    { hook_event_name: 'SessionStart', session_id: 'fresh' },
    env
  );
  assert.equal(r.status, 0);
});

test('reset flag wipes session state', () => {
  const dir = tmpDir();
  // Seed some usage.
  runHook(
    { hook_event_name: 'Stop', session_id: 'r1', prompt: 'X'.repeat(400) },
    { KODELYTH_TOKEN_BUDGET: '100', KODELYTH_TOKEN_BUDGET_DIR: dir }
  );
  assert.ok(fs.existsSync(path.join(dir, 'budget-r1.json')));

  // Reset.
  const r = runHook(
    { hook_event_name: 'Stop', session_id: 'r1' },
    { KODELYTH_TOKEN_BUDGET: '100', KODELYTH_TOKEN_BUDGET_DIR: dir, KODELYTH_TOKEN_BUDGET_RESET: '1' }
  );
  assert.equal(r.status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'budget-r1.json')), false);
});

test('echoes stdin to stdout for chained hooks', () => {
  const dir = tmpDir();
  const r = runHook(
    { hook_event_name: 'Stop', session_id: 'echo', prompt: 'hello world' },
    { KODELYTH_TOKEN_BUDGET: 'warn', KODELYTH_TOKEN_BUDGET_DIR: dir }
  );
  assert.match(r.stdout, /hello world/);
});

test('malformed JSON does not crash', () => {
  const dir = tmpDir();
  const res = spawnSync(process.execPath, [HOOK], {
    input:    'garbage{not-json',
    encoding: 'utf8',
    env:      { ...process.env, KODELYTH_TOKEN_BUDGET: '1000', KODELYTH_TOKEN_BUDGET_DIR: dir },
    timeout:  5000,
  });
  assert.equal(res.status, 0);
});
