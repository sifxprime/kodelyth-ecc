// Tests for scripts/arena/contract.js — the GOD/EVIL shared data contract.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const C = require('../../scripts/arena/contract');

test('makeFinding fills defaults and computes a risk score', () => {
  const f = C.makeFinding({ title: 'SQL injection in user lookup', severity: 'critical', confidence: 'confirmed', exploitability: 'trivial', file: 'src/db.js', line: 42 });
  assert.equal(f.severity, 'critical');
  assert.equal(f.verdict, C.VERDICT.UNVERIFIED);
  assert.equal(f.risk, 10, 'critical + confirmed + trivial = max risk');
  assert.ok(f.id, 'gets a stable id');
});

test('makeFinding rejects unknown scale values by falling back to safe defaults', () => {
  const f = C.makeFinding({ title: 'x', severity: 'apocalyptic', confidence: 'certain', exploitability: 'lol' });
  assert.equal(f.severity, 'medium');
  assert.equal(f.confidence, 'suspected');
  assert.equal(f.exploitability, 'moderate');
});

test('risk ranks a confirmed-high above a speculative-critical', () => {
  const confirmedHigh = C.makeFinding({ title: 'a', severity: 'high', confidence: 'confirmed', exploitability: 'trivial' });
  const speculativeCritical = C.makeFinding({ title: 'b', severity: 'critical', confidence: 'speculative', exploitability: 'theoretical' });
  assert.ok(confirmedHigh.risk > speculativeCritical.risk,
    'certainty must outweigh raw severity, otherwise noise floats to the top');
});

test('refuted findings carry zero effective risk', () => {
  const f = C.makeFinding({ title: 'false alarm', severity: 'critical', confidence: 'confirmed', exploitability: 'trivial', verdict: C.VERDICT.REFUTED });
  assert.equal(C.riskScore(f), 10);
  assert.equal(C.effectiveRisk(f), 0, 'verification must be able to zero out a finding');
});

test('fingerprint is stable for the same issue and differs across files', () => {
  const a = C.makeFinding({ title: 'Hardcoded API key', file: 'src/a.js', line: 10 });
  const b = C.makeFinding({ title: 'hardcoded  API   key!!', file: 'src/a.js', line: 10 });
  const c = C.makeFinding({ title: 'Hardcoded API key', file: 'src/b.js', line: 10 });
  assert.equal(a.id, b.id, 'wording drift must not create a duplicate');
  assert.notEqual(a.id, c.id, 'same issue in a different file is a different finding');
});

test('dedupe collapses duplicates and keeps the strongest claim', () => {
  const weak = C.makeFinding({ title: 'XSS in render', file: 'src/v.js', line: 5, severity: 'low', confidence: 'speculative' });
  const strong = C.makeFinding({ title: 'XSS in render', file: 'src/v.js', line: 5, severity: 'critical', confidence: 'confirmed', exploitability: 'trivial' });
  const out = C.dedupe([weak, strong]);
  assert.equal(out.length, 1);
  assert.equal(out[0].severity, 'critical', 'the stronger of two identical findings wins');
});

test('dedupe sorts by effective risk, highest first', () => {
  const low = C.makeFinding({ title: 'low', file: 'a.js', line: 1, severity: 'low' });
  const crit = C.makeFinding({ title: 'crit', file: 'b.js', line: 1, severity: 'critical', confidence: 'confirmed', exploitability: 'trivial' });
  const out = C.dedupe([low, crit]);
  assert.equal(out[0].title, 'crit');
});

test('newFindings returns only what has not been seen before', () => {
  const seen = C.makeFinding({ title: 'known', file: 'a.js', line: 1 });
  const fresh = C.makeFinding({ title: 'brand new', file: 'b.js', line: 2 });
  const out = C.newFindings([seen, fresh], [seen.id]);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'brand new');
});

test('makeArtifact only marks verified when explicitly true', () => {
  const claimed = C.makeArtifact({ kind: 'test', summary: 'added tests', verified: 'yes' });
  const real = C.makeArtifact({ kind: 'test', summary: 'added tests', verified: true });
  assert.equal(claimed.verified, false, 'a truthy claim is not proof');
  assert.equal(real.verified, true);
});

test('makeRoundVerdict counts open vs refuted and sums only open risk', () => {
  const open = C.makeFinding({ title: 'real bug', file: 'a.js', line: 1, severity: 'high', confidence: 'confirmed', exploitability: 'trivial' });
  const refuted = C.makeFinding({ title: 'not a bug', file: 'b.js', line: 1, severity: 'critical', confidence: 'confirmed', exploitability: 'trivial', verdict: C.VERDICT.REFUTED });
  const v = C.makeRoundVerdict({ round: 1, findings: [open, refuted], newFindingIds: [open.id] });
  assert.equal(v.counts.total, 2);
  assert.equal(v.counts.open, 1);
  assert.equal(v.counts.refuted, 1);
  assert.equal(v.counts.new, 1);
  assert.equal(v.openRisk, 7, 'refuted finding must not inflate open risk');
});

test('hasConverged only when N consecutive rounds found nothing new', () => {
  const quiet = { counts: { new: 0 } };
  const noisy = { counts: { new: 3 } };
  assert.equal(C.hasConverged([noisy, quiet], 2), false, 'one quiet round is not convergence');
  assert.equal(C.hasConverged([noisy, quiet, quiet], 2), true);
  assert.equal(C.hasConverged([quiet, noisy], 2), false, 'a new finding resets the streak');
  assert.equal(C.hasConverged([quiet], 2), false, 'not enough rounds yet');
});
