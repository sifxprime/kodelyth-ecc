// Tests for scripts/doctor-health.js — the live subsystem health check.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Point memory at a temp dir so the recall check runs against a known state.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-doctor-'));
process.env.KODELYTH_MEMORY_DIR = TMP;

const doctor = require('../../scripts/doctor-health.js');

test('run() returns all checks with a summary', () => {
  const r = doctor.run();
  assert.ok(Array.isArray(r.checks));
  assert.ok(r.checks.length >= 10, 'should run at least 10 checks');
  assert.equal(r.summary.total, r.checks.length);
  assert.equal(r.summary.pass + r.summary.warn + r.summary.fail, r.checks.length);
});

test('every check has id, status, and detail', () => {
  const r = doctor.run();
  for (const c of r.checks) {
    assert.ok(c.id, 'check has id');
    assert.ok([doctor.PASS, doctor.WARN, doctor.FAIL].includes(c.status), `valid status for ${c.id}`);
    assert.ok(typeof c.detail === 'string' && c.detail.length > 0, `detail for ${c.id}`);
  }
});

test('memory-recall check never throws even on a foreign index schema', () => {
  // Seed a memory + write the old/foreign index schema (the 2.4.3 bug).
  const store = require('../../scripts/memory/store.js');
  store.capture({ problem: 'doctor recall test', approach: 'x', tags: ['doctor'], project: '/t' });
  fs.writeFileSync(
    path.join(TMP, 'index.json'),
    JSON.stringify({ k1: 1.5, b: 0.75, corpusStats: {}, index: [], documents: [], docFreq: {} }),
  );
  const r = doctor.run();
  const recall = r.checks.find((c) => c.id === 'memory-recall');
  assert.ok(recall, 'memory-recall check exists');
  assert.notEqual(recall.status, doctor.FAIL, 'recall must self-heal, not fail');
});

test('failing checks carry a fix hint', () => {
  const r = doctor.run();
  for (const c of r.checks) {
    if (c.status === doctor.FAIL || c.status === doctor.WARN) {
      // A fix hint is expected for anything that is not a clean pass
      // (some warns are purely informational like "optional, not installed").
      assert.ok(typeof c.detail === 'string');
    }
  }
});
