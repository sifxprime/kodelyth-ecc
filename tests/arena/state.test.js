// Tests for scripts/arena/state.js — resumable run state + hard stops.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-arena-'));
process.env.KODELYTH_ARENA_DIR = TMP;

const S = require('../../scripts/arena/state');
const C = require('../../scripts/arena/contract');

function finding(title, file, opts = {}) {
  return C.makeFinding({ title, file, line: 1, severity: 'high', confidence: 'confirmed', exploitability: 'trivial', ...opts });
}

test('createRun requires a task', () => {
  assert.throws(() => S.createRun({ task: '' }), /task is required/);
});

test('createRun persists to disk and is loadable (resumable)', () => {
  const run = S.createRun({ task: 'harden the webhook' });
  const loaded = S.load(run.runId);
  assert.ok(loaded, 'run must survive a process restart');
  assert.equal(loaded.task, 'harden the webhook');
  assert.equal(loaded.status, 'running');
  assert.equal(loaded.rounds.length, 0);
});

test('recordRound stores the verdict and tracks new findings', () => {
  const run = S.createRun({ task: 't1' });
  const v1 = S.recordRound(run, { findings: [finding('SQLi', 'a.js'), finding('XSS', 'b.js')], tokensSpent: 1000 });
  assert.equal(v1.counts.total, 2);
  assert.equal(v1.counts.new, 2, 'first round: everything is new');

  // Same two findings again — nothing new the second time.
  const v2 = S.recordRound(run, { findings: [finding('SQLi', 'a.js'), finding('XSS', 'b.js')], tokensSpent: 1000 });
  assert.equal(v2.counts.total, 2);
  assert.equal(v2.counts.new, 0, 'repeat findings are not new');
});

test('convergence fires after 2 consecutive rounds with nothing new', () => {
  const run = S.createRun({ task: 't2', limits: { maxRounds: 10 } });
  S.recordRound(run, { findings: [finding('bug', 'a.js')] });      // new
  S.recordRound(run, { findings: [finding('bug', 'a.js')] });      // quiet 1
  assert.equal(run.status, 'running', 'one quiet round is not enough');
  S.recordRound(run, { findings: [finding('bug', 'a.js')] });      // quiet 2
  assert.equal(run.status, 'converged');
  assert.match(run.stopReason, /attacker gave up/);
});

test('a new finding resets the convergence streak', () => {
  const run = S.createRun({ task: 't3', limits: { maxRounds: 10 } });
  S.recordRound(run, { findings: [finding('a', 'a.js')] });
  S.recordRound(run, { findings: [finding('a', 'a.js')] });                       // quiet 1
  S.recordRound(run, { findings: [finding('a', 'a.js'), finding('b', 'b.js')] }); // new again
  assert.equal(run.status, 'running', 'a fresh finding must restart the loop');
});

test('max rounds is a hard stop', () => {
  const run = S.createRun({ task: 't4', limits: { maxRounds: 2 } });
  S.recordRound(run, { findings: [finding('a', 'a.js')] });
  S.recordRound(run, { findings: [finding('b', 'b.js')] });
  assert.equal(run.status, 'exhausted');
  assert.match(run.stopReason, /max rounds/);
});

test('token budget is a hard stop, not advisory', () => {
  const run = S.createRun({ task: 't5', limits: { maxRounds: 99, tokenBudget: 5000 } });
  S.recordRound(run, { findings: [finding('a', 'a.js')], tokensSpent: 3000 });
  assert.equal(run.status, 'running');
  S.recordRound(run, { findings: [finding('b', 'b.js')], tokensSpent: 3000 });
  assert.equal(run.status, 'aborted');
  assert.match(run.stopReason, /token budget exhausted/);
});

test('canAffordRound refuses a round that would blow the cap', () => {
  const run = S.createRun({ task: 't6', limits: { tokenBudget: 10000 } });
  S.recordRound(run, { findings: [], tokensSpent: 8000 });
  const cheap = S.canAffordRound(run, 1000);
  const pricey = S.canAffordRound(run, 5000);
  assert.equal(cheap.ok, true);
  assert.equal(pricey.ok, false, 'must refuse BEFORE spending, not after');
  assert.equal(pricey.remaining, 2000);
});

test('summarize reports the new-findings trend', () => {
  const run = S.createRun({ task: 't7', limits: { maxRounds: 10 } });
  S.recordRound(run, { findings: [finding('a', 'a.js'), finding('b', 'b.js')], tokensSpent: 500 });
  S.recordRound(run, { findings: [finding('a', 'a.js'), finding('b', 'b.js'), finding('c', 'c.js')], tokensSpent: 500 });
  const s = S.summarize(run);
  assert.deepEqual(s.trend, [2, 1], 'trend should show new findings falling per round');
  assert.equal(s.tokensSpent, 1000);
  assert.equal(s.openFindings, 3);
});

test('refuted findings do not count toward open risk in the summary', () => {
  const run = S.createRun({ task: 't8' });
  S.recordRound(run, {
    findings: [
      finding('real', 'a.js'),
      finding('bogus', 'b.js', { verdict: C.VERDICT.REFUTED }),
    ],
  });
  const s = S.summarize(run);
  assert.equal(s.openFindings, 1, 'refuted finding must be excluded');
  assert.equal(s.openRisk, 7);
});

test('listRuns returns saved runs newest-first', () => {
  const a = S.createRun({ task: 'older', now: Date.parse('2026-01-01T00:00:00Z') });
  const b = S.createRun({ task: 'newer', now: Date.parse('2026-06-01T00:00:00Z') });
  const list = S.listRuns();
  const ids = list.map(r => r.runId);
  assert.ok(ids.includes(a.runId) && ids.includes(b.runId));
  assert.ok(ids.indexOf(b.runId) < ids.indexOf(a.runId), 'newest run should sort first');
});

test('runPath refuses directory traversal in a run id', () => {
  const run = S.createRun({ task: 'safe', runId: '../../etc/passwd' });
  // The id is sanitised, so the file lands inside the arena dir, not outside it.
  const files = fs.readdirSync(TMP);
  assert.ok(files.some(f => f.endsWith('.json')));
  assert.ok(!fs.existsSync('/etc/passwd.json'));
  assert.ok(S.load(run.runId), 'still round-trips after sanitisation');
});
