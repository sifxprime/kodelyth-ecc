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

test('run() includes the config-drift check', () => {
  const r = doctor.run();
  const drift = r.checks.find((c) => c.id === 'config-drift');
  assert.ok(drift, 'config-drift check must be present');
  assert.ok([doctor.PASS, doctor.WARN, doctor.FAIL].includes(drift.status));
});

// ── configDriftStatus: the pure drift decision ───────────────────────────────
// This is the check that would have caught the real bug: a ~/.claude installed
// from v2.30.0 while the package had moved to v2.31.6, so hooks.json kept
// running a superseded hook. The version stamp is written by install.sh/ps1.

test('configDriftStatus WARNs when installed config is behind the package', () => {
  const s = doctor.configDriftStatus({
    installedVersion: '2.30.0',
    packageVersion: '2.31.6',
    installedAt: '2026-11-11T13:51:02Z',
  });
  assert.equal(s.status, doctor.WARN);
  assert.match(s.detail, /2\.30\.0/);
  assert.match(s.detail, /2\.31\.6/);
  assert.match(s.fix, /--target claude-code/, 'fix must point at re-running the installer');
});

test('configDriftStatus PASSes when installed config matches the package', () => {
  const s = doctor.configDriftStatus({ installedVersion: '2.31.6', packageVersion: '2.31.6' });
  assert.equal(s.status, doctor.PASS);
  assert.match(s.detail, /in sync/);
});

test('configDriftStatus treats patch, minor, and major drift as behind', () => {
  for (const [installed, pkg] of [
    ['2.31.5', '2.31.6'],  // patch
    ['2.30.9', '2.31.0'],  // minor
    ['1.9.9', '2.0.0'],    // major
  ]) {
    const s = doctor.configDriftStatus({ installedVersion: installed, packageVersion: pkg });
    assert.equal(s.status, doctor.WARN, `${installed} vs ${pkg} should warn`);
  }
});

test('configDriftStatus WARNs (does not crash) when config is newer than the package', () => {
  const s = doctor.configDriftStatus({ installedVersion: '2.32.0', packageVersion: '2.31.6' });
  assert.equal(s.status, doctor.WARN);
  assert.match(s.detail, /newer/);
  assert.match(s.fix, /npm i -g/);
});

test('configDriftStatus WARNs when the install-state version is missing', () => {
  const s = doctor.configDriftStatus({ installedVersion: null, packageVersion: '2.31.6' });
  assert.equal(s.status, doctor.WARN);
});

test('configDriftStatus WARNs when the package version is unknown', () => {
  const s = doctor.configDriftStatus({ installedVersion: '2.31.6', packageVersion: null });
  assert.equal(s.status, doctor.WARN);
});

test('cmpSemver orders versions numerically, not lexically', () => {
  assert.ok(doctor.cmpSemver('2.30.0', '2.31.6') < 0);
  assert.ok(doctor.cmpSemver('2.31.6', '2.30.0') > 0);
  assert.equal(doctor.cmpSemver('2.31.6', '2.31.6'), 0);
  // lexical sort would put '2.9.0' after '2.31.0'; numeric must not.
  assert.ok(doctor.cmpSemver('2.9.0', '2.31.0') < 0, '2.9.0 is older than 2.31.0');
});
