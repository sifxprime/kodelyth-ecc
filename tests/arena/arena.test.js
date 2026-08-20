// Tests for scripts/arena/arena.js — the GOD-vs-EVIL loop state machine.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-arenaloop-'));
process.env.KODELYTH_ARENA_DIR = TMP;

const A = require('../../scripts/arena/arena');
const C = require('../../scripts/arena/contract');

const P = A.PHASE;

function f(title, file, opts = {}) {
  return C.makeFinding({
    title, file, line: 1,
    severity: 'critical', confidence: 'confirmed', exploitability: 'trivial',
    ...opts,
  });
}
const verifiedArtifact = { kind: 'test', summary: 'added tests', verifyCommand: 'npm test', verified: true };

// Drive one full round. Returns the closing verdict.
function runRound(run, { findings = [], artifacts = [verifiedArtifact], addressedIds = null } = {}) {
  const carried = A.carriedFindings(run).map(x => x.id);
  A.submitGodWork(run, { artifacts, addressedIds: addressedIds ?? carried, tokensSpent: 1000 });
  A.submitEvilHunt(run, { findings, tokensSpent: 1000 });
  A.submitVerdicts(run, { verdicts: {}, tokensSpent: 200 });
  return A.closeRound(run);
}

test('startArena begins in the GOD_BUILD phase', () => {
  const run = A.startArena({ task: 'harden auth', scope: 'src/auth' });
  assert.equal(run.phase, P.GOD_BUILD);
  assert.equal(run.status, 'running');
  assert.equal(run.scope, 'src/auth');
});

test('the loop walks GOD -> EVIL hunt -> verify -> close, in order', () => {
  const run = A.startArena({ task: 't' });
  assert.equal(A.nextAction(run).action, P.GOD_BUILD);

  A.submitGodWork(run, { artifacts: [verifiedArtifact] });
  assert.equal(A.nextAction(run).action, P.EVIL_HUNT);

  A.submitEvilHunt(run, { findings: [f('SQLi', 'db.js')] });
  assert.equal(A.nextAction(run).action, P.EVIL_VERIFY);

  A.submitVerdicts(run, { verdicts: {} });
  assert.equal(A.nextAction(run).action, P.ROUND_CLOSE);
});

test('phases cannot be submitted out of order', () => {
  const run = A.startArena({ task: 't' });
  assert.throws(() => A.submitEvilHunt(run, { findings: [] }), /expected phase "evil_hunt"/);
  assert.throws(() => A.closeRound(run), /expected phase "round_close"/);
});

test('round 1 intends to build; later rounds intend to fix', () => {
  const run = A.startArena({ task: 't', limits: { maxRounds: 5 } });
  assert.equal(A.nextAction(run).intent, 'build');
  runRound(run, { findings: [f('bug', 'a.js')] });
  assert.equal(A.nextAction(run).intent, 'fix', 'after EVIL lands findings, GOD is fixing');
});

test("EVIL's verified findings are carried into GOD's next brief", () => {
  const run = A.startArena({ task: 't', limits: { maxRounds: 5 } });
  runRound(run, { findings: [f('auth bypass', 'a.js'), f('replay attack', 'b.js')] });
  const next = A.nextAction(run);
  assert.equal(next.action, P.GOD_BUILD);
  assert.equal(next.carriedFindings, 2);
  const buildStage = next.stages.find(s => s.id === 'build');
  assert.match(buildStage.brief, /auth bypass/, 'GOD must be told exactly what to fix');
  assert.match(buildStage.brief, /NOT suggestions/);
});

test('refuted findings are never carried to GOD', () => {
  const run = A.startArena({ task: 't', limits: { maxRounds: 5 } });
  runRound(run, {
    findings: [f('real bug', 'a.js'), f('phantom', 'b.js', { verdict: C.VERDICT.REFUTED })],
  });
  const carried = A.carriedFindings(run).map(x => x.title);
  assert.deepEqual(carried, ['real bug'], 'a false positive must not consume a fix round');
});

test('later EVIL rounds are told which findings are already known', () => {
  const run = A.startArena({ task: 't', limits: { maxRounds: 5 } });
  runRound(run, { findings: [f('known issue', 'a.js')] });
  A.submitGodWork(run, { artifacts: [verifiedArtifact] });
  const hunt = A.nextAction(run);
  assert.equal(hunt.action, P.EVIL_HUNT);
  assert.equal(hunt.round, 2);
  assert.match(hunt.briefs[0].brief, /do NOT re-report/);
  assert.match(hunt.briefs[0].brief, /what a previous sweep MISSED/);
});

test('verification targets only unjudged findings and carries a refute brief', () => {
  const run = A.startArena({ task: 't' });
  A.submitGodWork(run, { artifacts: [verifiedArtifact] });
  A.submitEvilHunt(run, { findings: [f('needs checking', 'a.js', { confidence: 'likely' })] });
  const v = A.nextAction(run);
  assert.equal(v.action, P.EVIL_VERIFY);
  assert.equal(v.targets.length, 1);
  assert.match(v.targets[0].brief, /Your job is to REFUTE it/);
});

test('a refuting verdict zeroes the finding before the round closes', () => {
  const run = A.startArena({ task: 't' });
  const bogus = f('phantom XSS', 'v.js', { confidence: 'likely' });
  A.submitGodWork(run, { artifacts: [verifiedArtifact] });
  A.submitEvilHunt(run, { findings: [bogus] });
  A.submitVerdicts(run, { verdicts: { [bogus.id]: { verdict: 'refuted', why: 'auto-escaped' } } });
  const verdict = A.closeRound(run);
  assert.equal(verdict.counts.refuted, 1);
  assert.equal(verdict.openRisk, 0, 'a refuted finding must not inflate open risk');
});

test('the arena converges when two rounds surface nothing new', () => {
  const run = A.startArena({ task: 't', limits: { maxRounds: 10 } });
  const same = [f('stubborn bug', 'a.js')];
  runRound(run, { findings: same });   // new
  runRound(run, { findings: same });   // quiet 1
  assert.equal(run.status, 'running');
  runRound(run, { findings: same });   // quiet 2
  assert.equal(run.status, 'converged');
  assert.match(run.stopReason, /attacker gave up/);
  assert.equal(A.nextAction(run).action, P.REPORT);
});

test('a fresh finding restarts the loop instead of converging', () => {
  const run = A.startArena({ task: 't', limits: { maxRounds: 10 } });
  runRound(run, { findings: [f('a', 'a.js')] });
  runRound(run, { findings: [f('a', 'a.js')] });                  // quiet
  runRound(run, { findings: [f('a', 'a.js'), f('b', 'b.js')] });  // new again
  assert.equal(run.status, 'running');
});

test('max rounds stops the arena even while findings keep arriving', () => {
  const run = A.startArena({ task: 't', limits: { maxRounds: 2 } });
  runRound(run, { findings: [f('a', 'a.js')] });
  runRound(run, { findings: [f('b', 'b.js')] });
  assert.equal(run.status, 'exhausted');
  assert.equal(A.nextAction(run).action, P.REPORT);
});

test('closeRound flags a round where GOD left an artifact unproven', () => {
  const run = A.startArena({ task: 't', limits: { maxRounds: 5 } });
  const verdict = runRound(run, {
    findings: [],
    artifacts: [{ kind: 'code', summary: 'unproven change', verified: false }],
  });
  assert.equal(verdict.godComplete, false);
  assert.deepEqual(verdict.unverifiedArtifacts, ['unproven change']);
});

test('closeRound flags a critical finding GOD never addressed', () => {
  const run = A.startArena({ task: 't', limits: { maxRounds: 5 } });
  const verdict = runRound(run, { findings: [f('RCE', 'x.js')], addressedIds: [] });
  assert.equal(verdict.godComplete, false);
  assert.deepEqual(verdict.outstandingFindings, ['RCE']);
});

test('affordOrAbort stops the run before an unaffordable step', () => {
  const run = A.startArena({ task: 't', limits: { tokenBudget: 5000 } });
  const ok = A.affordOrAbort(run, { estimatedTokens: 1000 });
  assert.equal(ok.ok, true);
  assert.equal(run.status, 'running');

  const broke = A.affordOrAbort(run, { estimatedTokens: 999999 });
  assert.equal(broke.ok, false);
  assert.equal(run.status, 'aborted', 'must abort BEFORE spending');
  assert.match(run.stopReason, /budget guard/);
  assert.equal(A.nextAction(run).action, P.REPORT);
});

test('report shows the trend and declares convergence', () => {
  const run = A.startArena({ task: 'harden the webhook', limits: { maxRounds: 10 } });
  runRound(run, { findings: [f('a', 'a.js'), f('b', 'b.js')] });
  runRound(run, { findings: [f('a', 'a.js'), f('b', 'b.js'), f('c', 'c.js')] });
  runRound(run, { findings: [f('a', 'a.js'), f('b', 'b.js'), f('c', 'c.js')] });
  runRound(run, { findings: [f('a', 'a.js'), f('b', 'b.js'), f('c', 'c.js')] });

  const md = A.buildReport(run);
  assert.match(md, /# Arena report — harden the webhook/);
  assert.match(md, /Did the attacker give up\?/);
  assert.match(md, /\*\*Converged\*\*/);
  assert.match(md, /round 1/);
  assert.match(md, /Still open/);
});

test('report lists refuted findings so the same false positive is not re-litigated', () => {
  const run = A.startArena({ task: 't', limits: { maxRounds: 5 } });
  const bogus = f('phantom', 'p.js');
  A.submitGodWork(run, { artifacts: [verifiedArtifact] });
  A.submitEvilHunt(run, { findings: [bogus] });
  A.submitVerdicts(run, { verdicts: { [bogus.id]: { verdict: 'refuted', why: 'guarded upstream' } } });
  A.closeRound(run);
  const md = A.buildReport(run);
  assert.match(md, /Refuted \(checked, not real\)/);
  assert.match(md, /~~phantom~~/);
});

test('a clean run reports nothing open', () => {
  const run = A.startArena({ task: 'clean build', limits: { maxRounds: 10 } });
  runRound(run, { findings: [] });
  runRound(run, { findings: [] });
  const md = A.buildReport(run);
  assert.match(md, /Nothing open/);
  assert.equal(run.status, 'converged');
});

test('an arena run survives a process restart mid-loop', () => {
  const run = A.startArena({ task: 'resume me', limits: { maxRounds: 5 } });
  A.submitGodWork(run, { artifacts: [verifiedArtifact], tokensSpent: 5000 });

  // Simulate a crash: reload purely from disk.
  const state = require('../../scripts/arena/state');
  const reloaded = state.load(run.runId);
  assert.equal(reloaded.phase, P.EVIL_HUNT, 'phase must survive');
  assert.equal(reloaded.spent.tokens, 5000, 'spend already paid for must survive');
  assert.equal(A.nextAction(reloaded).action, P.EVIL_HUNT);
});
