// Tests for scripts/arena/evil.js — EVIL mode v2 scoring + verification.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../../scripts/arena/evil');
const C = require('../../scripts/arena/contract');

test('default sweep selects exactly the 4 core hunters', () => {
  const crew = E.selectCrew([]);
  assert.equal(crew.length, 4);
  for (const a of ['prompt-injection-hunter', 'supply-chain-auditor', 'secret-hunter', 'backdoor-hunter']) {
    assert.ok(crew.includes(a), `${a} must be core`);
  }
});

test('--all fires the full 8-agent crew', () => {
  assert.equal(E.selectCrew(['--all']).length, 8);
});

test('opt-in flags add their agent without dropping the core four', () => {
  const crew = E.selectCrew(['--license']);
  assert.equal(crew.length, 5);
  assert.ok(crew.includes('license-violation-finder'));
  assert.ok(crew.includes('secret-hunter'), 'core crew must survive an opt-in flag');
});

test('--pre-public preset adds license + theft', () => {
  const crew = E.selectCrew(['--pre-public']);
  assert.ok(crew.includes('license-violation-finder'));
  assert.ok(crew.includes('code-stealer-detector'));
});

test('hunt brief on a later round tells the agent to skip known findings', () => {
  const first = E.huntBrief({ agent: 'secret-hunter', scope: 'src/', round: 1, knownFindingIds: [] });
  const later = E.huntBrief({ agent: 'secret-hunter', scope: 'src/', round: 3, knownFindingIds: ['a', 'b'] });
  assert.match(first, /First sweep/);
  assert.match(later, /do NOT re-report/);
  assert.match(later, /what a previous sweep MISSED/);
});

test('hunt brief demands reproducible evidence, not opinions', () => {
  const brief = E.huntBrief({ agent: 'backdoor-hunter', scope: '.', round: 1 });
  assert.match(brief, /must quote the actual offending code/);
  assert.match(brief, /Five confirmed findings beat forty guesses/);
});

test('verify brief instructs the verifier to REFUTE and default to refuted', () => {
  const f = C.makeFinding({ title: 'SQLi', file: 'a.js', line: 3 });
  const brief = E.verifyBrief(f);
  assert.match(brief, /Your job is to REFUTE it/);
  assert.match(brief, /Default to "refuted" when uncertain/);
});

test('normalizeFindings tags agent + round and drops junk', () => {
  const out = E.normalizeFindings(
    [{ title: 'real', file: 'a.js' }, { notATitle: true }, null],
    { agent: 'secret-hunter', round: 2 },
  );
  assert.equal(out.length, 1, 'entries without a title are discarded');
  assert.equal(out[0].agent, 'secret-hunter');
  assert.equal(out[0].round, 2);
});

test('applyVerdicts refutes a finding and zeroes its effective risk', () => {
  const f = C.makeFinding({ title: 'phantom XSS', file: 'v.js', line: 1, severity: 'critical', confidence: 'likely', exploitability: 'trivial' });
  assert.ok(C.effectiveRisk(f) > 0);
  const [after] = E.applyVerdicts([f], { [f.id]: { verdict: 'refuted', why: 'framework auto-escapes this' } });
  assert.equal(after.verdict, 'refuted');
  assert.equal(C.effectiveRisk(after), 0, 'a refuted finding must stop counting');
  assert.match(after.evidence, /\[verification\] framework auto-escapes/);
});

test('applyVerdicts confirming a finding raises its confidence to confirmed', () => {
  const f = C.makeFinding({ title: 'SQLi', file: 'db.js', line: 9, severity: 'critical', confidence: 'suspected', exploitability: 'trivial' });
  const before = C.effectiveRisk(f);
  const [after] = E.applyVerdicts([f], { [f.id]: { verdict: 'confirmed', repro: 'curl -X POST ...' } });
  assert.equal(after.confidence, 'confirmed');
  assert.equal(after.repro, 'curl -X POST ...');
  assert.ok(C.effectiveRisk(after) > before, 'confirmation should raise effective risk');
});

test('selectForVerification skips already-judged and near-zero-risk findings', () => {
  const unverified = C.makeFinding({ title: 'worth checking', file: 'a.js', line: 1, severity: 'high', confidence: 'likely', exploitability: 'moderate' });
  const alreadyDone = C.makeFinding({ title: 'done', file: 'b.js', line: 1, severity: 'high', verdict: C.VERDICT.CONFIRMED });
  const noise = C.makeFinding({ title: 'meh', file: 'c.js', line: 1, severity: 'info', confidence: 'speculative', exploitability: 'theoretical' });
  const picked = E.selectForVerification([unverified, alreadyDone, noise]);
  const titles = picked.map(f => f.title);
  assert.ok(titles.includes('worth checking'));
  assert.ok(!titles.includes('done'), 'do not re-verify a settled finding');
  assert.ok(!titles.includes('meh'), 'do not spend tokens verifying noise');
});

test('selectForVerification caps how many findings get a verification pass', () => {
  const many = Array.from({ length: 40 }, (_, i) =>
    C.makeFinding({ title: `bug ${i}`, file: `f${i}.js`, line: 1, severity: 'high', confidence: 'likely', exploitability: 'trivial' }));
  assert.equal(E.selectForVerification(many, { max: 12 }).length, 12, 'verification must be budget-bounded');
});

test('actionable hands GOD the worst first and excludes refuted noise', () => {
  const crit = C.makeFinding({ title: 'auth bypass', file: 'a.js', line: 1, severity: 'critical', confidence: 'confirmed', exploitability: 'trivial' });
  const mid = C.makeFinding({ title: 'weak hash', file: 'b.js', line: 1, severity: 'medium', confidence: 'confirmed', exploitability: 'moderate' });
  const dead = C.makeFinding({ title: 'false alarm', file: 'c.js', line: 1, severity: 'critical', confidence: 'confirmed', exploitability: 'trivial', verdict: C.VERDICT.REFUTED });
  const out = E.actionable([mid, dead, crit]);
  assert.equal(out[0].title, 'auth bypass', 'highest real risk first');
  assert.ok(!out.some(f => f.title === 'false alarm'), 'refuted findings never reach GOD mode');
});

test('planSweep produces one brief per agent and an estimate the budget can check', () => {
  const plan = E.planSweep({ scope: 'src/auth', flags: ['--all'], round: 1 });
  assert.equal(plan.crew.length, 8);
  assert.equal(plan.briefs.length, 8);
  assert.ok(plan.estimatedTokens > 0, 'orchestrator needs a cost estimate before dispatching');
});

test('huntBrief carries prior knowledge when a past run supplied it', () => {
  // The compound-learning return path: without this, every run starts from zero
  // and EVIL re-derives the same bug classes forever.
  const brief = E.huntBrief({
    agent: 'secret-hunter', scope: 'src', round: 1,
    priorKnowledge: 'PRIOR KNOWLEDGE — this scope has been attacked before.',
  });
  assert.match(brief, /PRIOR KNOWLEDGE/);
  // It lands after the rules, so it reads as context rather than a competing
  // instruction set.
  assert.ok(brief.indexOf('PRIOR KNOWLEDGE') > brief.indexOf('Only claim `confirmed`'));
});

test('huntBrief omits the prior-knowledge block entirely when there is none', () => {
  const brief = E.huntBrief({ agent: 'secret-hunter', scope: 'src', round: 1 });
  assert.ok(!brief.includes('PRIOR KNOWLEDGE'));
  assert.ok(!brief.includes('null'), 'a missing block must not leak "null" into the brief');
});

test('planSweep threads prior knowledge to every agent in the crew', () => {
  const plan = E.planSweep({ scope: 'src', round: 2, priorKnowledge: 'KNOWN THINGS' });
  assert.ok(plan.briefs.length > 1);
  for (const b of plan.briefs) assert.match(b.brief, /KNOWN THINGS/, b.agent);
});
