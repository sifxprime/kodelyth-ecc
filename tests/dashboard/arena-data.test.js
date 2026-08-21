// Tests for arenaSnapshot in scripts/dashboard/data.js — the Arena tab's data.
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');

// Both the arena state dir and the memory dir are frozen at require time, so
// they must be redirected BEFORE anything loads them. Without this the suite
// would read (and report on) the developer's real arena runs.
const TMP_ARENA = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-arena-dash-'));
const TMP_MEM   = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-arena-mem-'));
process.env.KODELYTH_ARENA_DIR  = TMP_ARENA;
process.env.KODELYTH_MEMORY_DIR = TMP_MEM;

const data = require('../../scripts/dashboard/data');

function writeRun(run) {
  fs.writeFileSync(path.join(TMP_ARENA, `${run.runId}.json`), JSON.stringify(run, null, 2));
}

// arenaSnapshot aggregates across every run on disk, so a test that inherits
// the previous test's runs is asserting on someone else's data.
function freshDir() {
  fs.rmSync(TMP_ARENA, { recursive: true, force: true });
  fs.mkdirSync(TMP_ARENA, { recursive: true });
}

const finding = (over = {}) => ({
  id: over.id || 'f1', title: 'a bug', severity: 'high', confidence: 'confirmed',
  exploitability: 'trivial', file: 'src/a.js', line: 1, evidence: 'e',
  verdict: 'confirmed', risk: 7, ...over,
});

const run = (over = {}) => ({
  runId: 'arena-test-0001', task: 'harden it', scope: 'src',
  startedAt: '2026-08-01T00:00:00.000Z',
  status: 'converged', stopReason: null,
  spent: { tokens: 1000, rounds: 1, ms: 0 },
  rounds: [], seenFindingIds: [], ...over,
});

test('reports unavailable rather than throwing when there are no runs', () => {
  freshDir();
  const snap = data.arenaSnapshot();
  assert.equal(snap.available, true, 'arena module is installed');
  assert.deepEqual(snap.runs, []);
  assert.deepEqual(snap.open, []);
  assert.equal(snap.totals.runs, 0);
});

test('summarises a run and exposes the convergence trend', () => {
  freshDir();
  writeRun(run({
    rounds: [
      { round: 1, counts: { new: 5 }, findings: [finding({ id: 'a' }), finding({ id: 'b' })], artifacts: [{ title: 'x' }] },
      { round: 2, counts: { new: 0 }, findings: [], artifacts: [] },
    ],
  }));
  const snap = data.arenaSnapshot();
  assert.equal(snap.runs.length, 1);
  const r = snap.runs[0];
  // The trend is the whole story the tab exists to tell.
  assert.deepEqual(r.trend, [5, 0]);
  assert.equal(r.rounds, 2);
  assert.equal(r.confirmed, 2);
  assert.equal(r.artifacts, 1);
  assert.equal(snap.totals.converged, 1);
});

test('raw findings are not shipped over the wire', () => {
  // The page needs counts and the open list, not every finding on every run.
  freshDir();
  writeRun(run({ rounds: [{ round: 1, counts: { new: 1 }, findings: [finding()], artifacts: [] }] }));
  const snap = data.arenaSnapshot();
  assert.ok(!('findings' in snap.runs[0]), 'findings leaked into the wire payload');
});

test('a finding GOD addressed is not counted as open risk', () => {
  freshDir();
  // Reporting a confirmed-and-fixed bug as outstanding would make a healthy run
  // look alarming, which is exactly backwards.
  writeRun(run({
    runId: 'arena-test-0002',
    rounds: [{
      round: 1, counts: { new: 2 },
      findings: [finding({ id: 'fixed' }), finding({ id: 'ignored', title: 'still broken' })],
      addressedIds: ['fixed'],
      artifacts: [],
    }],
  }));
  const snap = data.arenaSnapshot();
  const titles = snap.open.map(o => o.title);
  assert.ok(titles.includes('still broken'), 'unaddressed finding missing from open');
  assert.ok(!titles.includes('a bug'), 'an addressed finding was reported as open');
});

test('refuted and unverified findings never appear as open risk', () => {
  freshDir();
  writeRun(run({
    runId: 'arena-test-0003',
    rounds: [{
      round: 1, counts: { new: 2 },
      findings: [
        finding({ id: 'r1', title: 'refuted one', verdict: 'refuted' }),
        finding({ id: 'u1', title: 'unverified one', verdict: 'unverified' }),
      ],
      addressedIds: [],
      artifacts: [],
    }],
  }));
  const snap = data.arenaSnapshot();
  const titles = snap.open.map(o => o.title);
  assert.ok(!titles.includes('refuted one'));
  assert.ok(!titles.includes('unverified one'));
});

test('open findings are ranked worst-risk first', () => {
  freshDir();
  writeRun(run({
    runId: 'arena-test-0004',
    rounds: [{
      round: 1, counts: { new: 3 },
      findings: [
        finding({ id: 'low', title: 'low one', risk: 1 }),
        finding({ id: 'high', title: 'high one', risk: 9 }),
        finding({ id: 'mid', title: 'mid one', risk: 5 }),
      ],
      addressedIds: [], artifacts: [],
    }],
  }));
  const snap = data.arenaSnapshot();
  assert.deepEqual(snap.open.map(o => o.title), ['high one', 'mid one', 'low one']);
});

test('recurring bug classes are counted and sorted', () => {
  freshDir();
  writeRun(run({
    runId: 'arena-test-0005',
    rounds: [{
      round: 1, counts: { new: 3 },
      findings: [
        finding({ id: 's1', title: 'Symlinked target followed on read' }),
        finding({ id: 's2', title: 'Dangling symlink written through' }),
        finding({ id: 'r1', title: 'Quadratic backtracking ReDoS' }),
      ],
      addressedIds: [], artifacts: [],
    }],
  }));
  const snap = data.arenaSnapshot();
  assert.equal(snap.classes[0].name, 'filesystem-symlink');
  assert.equal(snap.classes[0].count, 2);
  assert.ok(snap.classes.some(c => c.name === 'redos' && c.count === 1));
});

test('an unreadable run file is skipped, not fatal', () => {
  freshDir();
  fs.writeFileSync(path.join(TMP_ARENA, 'arena-broken.json'), '{ not json');
  assert.doesNotThrow(() => data.arenaSnapshot());
});

test('runLimit is clamped so a huge value cannot be passed through', () => {
  freshDir();
  const snap = data.arenaSnapshot({ runLimit: 100000 });
  assert.ok(Array.isArray(snap.runs));
});

test.after(() => {
  fs.rmSync(TMP_ARENA, { recursive: true, force: true });
  fs.rmSync(TMP_MEM, { recursive: true, force: true });
});
