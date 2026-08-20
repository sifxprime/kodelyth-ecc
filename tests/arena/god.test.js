// Tests for scripts/arena/god.js — GOD mode pipeline + proof-of-work.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const G = require('../../scripts/arena/god');
const C = require('../../scripts/arena/contract');

test('the pipeline recalls first and proves last', () => {
  const ids = G.STAGES.map(s => s.id);
  assert.equal(ids[0], 'recall', 'memory must inform the design, so it runs first');
  assert.equal(ids[ids.length - 1], 'prove', 'nothing ships before it is proven');
  assert.ok(ids.includes('critique'), 'GOD must attack its own work before EVIL does');
});

test('planBuild requires a task', () => {
  assert.throws(() => G.planBuild({ task: '  ' }), /task is required/);
});

test('planBuild returns a brief per stage and a cost estimate', () => {
  const plan = G.planBuild({ task: 'add rate limiting to the API' });
  assert.equal(plan.stages.length, G.STAGES.length);
  assert.ok(plan.stages.every(s => s.brief && s.brief.length > 0));
  assert.ok(plan.estimatedTokens > 0);
});

test('recall stage costs no agent tokens', () => {
  const recall = G.STAGES.find(s => s.id === 'recall');
  assert.equal(recall.agents.length, 0, 'recall is a memory lookup, not an agent call');
});

test('recall brief forbids inventing a memory', () => {
  const brief = G.recallBrief({ task: 'fix the webhook' });
  assert.match(brief, /Do not invent a memory/);
});

test('every stage brief demands a verify command and forbids unobserved claims', () => {
  for (const s of G.STAGES) {
    if (s.id === 'recall') continue;
    const brief = G.stageBrief({ stageId: s.id, task: 't' });
    assert.match(brief, /verifyCommand/, `${s.id} must ask for proof`);
    assert.match(brief, /Do not claim success you have not observed/, `${s.id} must forbid hand-waving`);
  }
});

test('stageBrief rejects an unknown stage', () => {
  assert.throws(() => G.stageBrief({ stageId: 'nope', task: 't' }), /unknown stage/);
});

test('EVIL findings arrive in the brief as mandatory work items', () => {
  const f = C.makeFinding({ title: 'auth bypass on /admin', file: 'a.js', line: 7, severity: 'critical', confidence: 'confirmed', exploitability: 'trivial', repro: 'curl -H "X-Role: admin" /admin' });
  const brief = G.stageBrief({ stageId: 'build', task: 'harden auth', findings: [f], round: 2 });
  assert.match(brief, /NOT suggestions/);
  assert.match(brief, /auth bypass on \/admin/);
  assert.match(brief, /repro: curl/);
});

test('critique stage is told to be adversarial about our own output', () => {
  const brief = G.stageBrief({ stageId: 'critique', task: 't' });
  assert.match(brief, /genuinely adversarial about our own output/);
});

test('verifyArtifacts marks an artifact verified only when the command passes', () => {
  const runner = (cmd) => ({ ok: cmd === 'npm test', output: cmd === 'npm test' ? 'all passed' : '3 failing' });
  const [pass, fail] = G.verifyArtifacts([
    { kind: 'test', summary: 'good', verifyCommand: 'npm test' },
    { kind: 'test', summary: 'bad', verifyCommand: 'npm run broken' },
  ], runner);
  assert.equal(pass.verified, true);
  assert.equal(fail.verified, false);
  assert.match(fail.verifyResult, /failed: 3 failing/);
});

test('an artifact with no verify command is never verified', () => {
  const [a] = G.verifyArtifacts([{ kind: 'code', summary: 'trust me' }], () => ({ ok: true }));
  assert.equal(a.verified, false, 'a claim without a command is not proof');
  assert.match(a.verifyResult, /no verify command/);
});

test('a throwing runner fails the artifact instead of crashing the round', () => {
  const [a] = G.verifyArtifacts(
    [{ kind: 'test', summary: 'x', verifyCommand: 'boom' }],
    () => { throw new Error('command not found'); },
  );
  assert.equal(a.verified, false);
  assert.match(a.verifyResult, /runner threw: command not found/);
});

test('verifyArtifacts refuses to run without a runner', () => {
  assert.throws(() => G.verifyArtifacts([{ kind: 'code' }]), /requires a runner/);
});

test('roundComplete blocks on an unverified artifact', () => {
  const r = G.roundComplete({
    artifacts: [{ kind: 'test', summary: 'untested thing', verified: false }],
    findings: [],
  });
  assert.equal(r.complete, false);
  assert.deepEqual(r.unverifiedArtifacts, ['untested thing']);
});

test('roundComplete blocks on an unaddressed critical finding', () => {
  const crit = C.makeFinding({ title: 'RCE in upload', file: 'u.js', line: 1, severity: 'critical', confidence: 'confirmed' });
  const r = G.roundComplete({
    artifacts: [{ kind: 'code', summary: 'ok', verified: true }],
    findings: [crit],
    addressedIds: [],
  });
  assert.equal(r.complete, false);
  assert.deepEqual(r.outstandingFindings, ['RCE in upload']);
});

test('roundComplete passes when artifacts are proven and criticals are addressed', () => {
  const crit = C.makeFinding({ title: 'RCE in upload', file: 'u.js', line: 1, severity: 'critical', confidence: 'confirmed' });
  const r = G.roundComplete({
    artifacts: [{ kind: 'code', summary: 'ok', verified: true }],
    findings: [crit],
    addressedIds: [crit.id],
  });
  assert.equal(r.complete, true);
});

test('a refuted finding never blocks the round', () => {
  const bogus = C.makeFinding({ title: 'phantom', file: 'x.js', line: 1, severity: 'critical', verdict: C.VERDICT.REFUTED });
  const r = G.roundComplete({ artifacts: [], findings: [bogus], addressedIds: [] });
  assert.equal(r.complete, true, 'GOD must not be blocked by a false positive');
});
