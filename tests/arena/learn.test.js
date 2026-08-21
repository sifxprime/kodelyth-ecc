// Tests for scripts/arena/learn.js — turning arena runs into durable knowledge.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const L = require('../../scripts/arena/learn');
const { makeFinding, VERDICT } = require('../../scripts/arena/contract');

const F = (over = {}) => makeFinding({
  title: 'something', severity: 'high', confidence: 'confirmed',
  exploitability: 'trivial', file: 'src/a.js', line: 1,
  evidence: 'code', repro: 'run it', fix: 'do the thing',
  verdict: VERDICT.CONFIRMED, ...over,
});

const runWith = (findings) => ({
  runId: 'r1', task: 't', scope: 'src/thing',
  rounds: [{ round: 1, findings }],
});

// ── Classification ──────────────────────────────────────────────────────────

test('classify maps findings to their bug class', () => {
  const cases = [
    ['Symlinked target followed on read', 'filesystem-symlink'],
    ['File mode not preserved: 0600 becomes 0644', 'file-permissions'],
    ['Quadratic backtracking in the link regex (ReDoS)', 'redos'],
    ['No project-root confinement allows arbitrary write', 'path-traversal'],
    ['TOCTOU between stat and rename', 'race-condition'],
    ['Unbounded memory amplification blows the heap', 'resource-exhaustion'],
    ['Predictable temp file left behind', 'temp-file-handling'],
    ['Prompt injection via untrusted content', 'prompt-injection'],
    ['Compression is not idempotent', 'idempotency'],
    ['Lockfile drift lets a typosquat in', 'supply-chain'],
  ];
  for (const [title, want] of cases) {
    assert.equal(L.classify({ title }), want, title);
  }
});

test('regression: a bare "permission" does not hijack a semantics finding', () => {
  // The file-permissions pattern matched the word "permission" anywhere, so
  // "widens permission thresholds" — a meaning bug — was filed under file modes.
  assert.equal(
    L.classify({ title: 'Intensifier deletion silently widens permission thresholds in prose' }),
    'semantic-corruption',
  );
  // ...while a real file-permission finding still classifies correctly.
  assert.equal(
    L.classify({ title: 'Original file permissions not preserved: 0600 files become 0644' }),
    'file-permissions',
  );
});

test('regression: "unvalidated" is recognised despite the missing word boundary', () => {
  // The pattern was /\bvalidat/, which cannot match inside "unvalidated"
  // because there is no word boundary after "un".
  assert.equal(L.classify({ title: 'Ledger DIR is unvalidated' }), 'input-validation');
});

test('regression: a missing trust boundary is the injection class', () => {
  // The class was keyed on the word "injection", so a finding phrased as a
  // missing trust boundary fell through to uncategorized.
  assert.equal(
    L.classify({ title: 'Command doc never tells the assistant to treat file contents as inert data' }),
    'prompt-injection',
  );
});

test('an unrecognised finding is labelled, not silently dropped', () => {
  assert.equal(L.classify({ title: 'something entirely novel' }), 'uncategorized');
});

// ── Findings → memories ─────────────────────────────────────────────────────

test('a confirmed finding becomes a memory carrying the fix and the repro', () => {
  const m = L.confirmedToMemory(F({ title: 'ReDoS in the link regex' }), { scope: 'src/thing' });
  assert.match(m.problem, /^redos: ReDoS in the link regex \(src\/a\.js:1\)$/);
  assert.match(m.approach, /Fix: do the thing/);
  assert.match(m.approach, /Proved by: run it/);
  assert.equal(m.source, 'arena');
  assert.ok(m.tags.includes('confirmed'));
  assert.ok(m.tags.includes('redos'));
  assert.equal(m.language, 'javascript');
});

test('a refuted finding is remembered as a false positive', () => {
  // The more valuable half: without it, every future run re-investigates the
  // same non-bug and spends a real verification pass proving the same negative.
  const m = L.refutedToMemory(F({ title: 'Fake bug', verdict: VERDICT.REFUTED }), {});
  assert.match(m.problem, /looks like a bug but is not/);
  assert.ok(m.tags.includes('refuted'));
  assert.ok(m.tags.includes('false-positive'));
});

test('unverified findings are never turned into memories', () => {
  // Storing a question as knowledge would launder a guess into a fact, and
  // future runs would recall it as if it had been established.
  const drafts = L.runToMemories(runWith([
    F({ title: 'proved', verdict: VERDICT.CONFIRMED }),
    F({ title: 'disproved', file: 'src/b.js', verdict: VERDICT.REFUTED }),
    F({ title: 'nobody checked', file: 'src/c.js', verdict: VERDICT.UNVERIFIED }),
  ]));
  assert.equal(drafts.length, 2);
  assert.ok(!drafts.some(d => /nobody checked/.test(d.memory.problem)));
});

test('a finding appearing in two rounds is remembered once', () => {
  const f = F({ title: 'same bug' });
  const drafts = L.runToMemories({
    scope: 's', rounds: [{ findings: [f] }, { findings: [f] }],
  });
  assert.equal(drafts.length, 1);
});

test('a run with no rounds yields nothing rather than throwing', () => {
  assert.deepEqual(L.runToMemories({}), []);
  assert.deepEqual(L.runToMemories(), []);
});

// ── The return path ─────────────────────────────────────────────────────────

test('priorKnowledgeBrief is empty when there is nothing to say', () => {
  assert.equal(L.priorKnowledgeBrief([]), '');
  assert.equal(L.priorKnowledgeBrief([{ problem: 'x', tags: ['arena'] }]), '');
});

test('priorKnowledgeBrief separates what was proved from what was refuted', () => {
  const brief = L.priorKnowledgeBrief([
    { problem: 'redos: bad regex', tags: ['arena', 'confirmed'] },
    { problem: 'False positive — fine actually', tags: ['arena', 'refuted'] },
  ]);
  assert.match(brief, /PRIOR KNOWLEDGE/);
  assert.match(brief, /verify they stayed fixed/);
  assert.match(brief, /redos: bad regex/);
  assert.match(brief, /Do not re-report these without new/);
  assert.match(brief, /False positive/);
});

test('priorKnowledgeBrief respects its limit', () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    ({ problem: `bug ${i}`, tags: ['arena', 'confirmed'] }));
  const brief = L.priorKnowledgeBrief(many, { limit: 3 });
  assert.equal((brief.match(/^ {2}- bug /gm) || []).length, 3);
});

// ── Recurring classes → proposals ───────────────────────────────────────────

test('recurringClasses ignores one-off findings', () => {
  const mems = [
    { source: 'arena', tags: ['arena', 'redos', 'confirmed'], files: ['a.js'], problem: 'p1' },
    { source: 'arena', tags: ['arena', 'idempotency', 'confirmed'], files: ['b.js'], problem: 'p2' },
  ];
  assert.deepEqual(L.recurringClasses(mems, { minRuns: 2 }), []);
});

test('recurringClasses surfaces a class that keeps coming back', () => {
  const mems = [
    { source: 'arena', tags: ['arena', 'filesystem-symlink', 'confirmed'], files: ['a.js'], problem: 'p1' },
    { source: 'arena', tags: ['arena', 'filesystem-symlink', 'confirmed'], files: ['b.js'], problem: 'p2' },
    { source: 'arena', tags: ['arena', 'redos', 'confirmed'], files: ['c.js'], problem: 'p3' },
  ];
  const clusters = L.recurringClasses(mems, { minRuns: 2 });
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].class, 'filesystem-symlink');
  assert.equal(clusters[0].count, 2);
  assert.deepEqual(clusters[0].files.sort(), ['a.js', 'b.js']);
});

test('refuted memories never drive a guard proposal', () => {
  // A guard against a bug that was disproved twice would be pure waste.
  const mems = [
    { source: 'arena', tags: ['arena', 'redos', 'refuted'], files: ['a.js'], problem: 'p1' },
    { source: 'arena', tags: ['arena', 'redos', 'refuted'], files: ['b.js'], problem: 'p2' },
  ];
  assert.deepEqual(L.recurringClasses(mems, { minRuns: 2 }), []);
});

test('memories from outside the arena are ignored', () => {
  const mems = [
    { source: 'manual', tags: ['arena', 'redos', 'confirmed'], files: [], problem: 'p1' },
    { source: 'manual', tags: ['arena', 'redos', 'confirmed'], files: [], problem: 'p2' },
  ];
  assert.deepEqual(L.recurringClasses(mems, { minRuns: 2 }), []);
});

test('guard proposal ids are deterministic across runs', () => {
  const cluster = { class: 'redos', count: 3, files: ['a.js'], examples: ['x'] };
  assert.equal(L.guardProposalId(cluster), L.guardProposalId({ ...cluster }));
  assert.notEqual(L.guardProposalId(cluster), L.guardProposalId({ ...cluster, count: 4 }));
});

test('a guard proposal names the class and offers concrete advice', () => {
  const mems = [
    { source: 'arena', tags: ['arena', 'file-permissions', 'confirmed'], files: ['a.js'], problem: 'p1' },
    { source: 'arena', tags: ['arena', 'file-permissions', 'confirmed'], files: ['b.js'], problem: 'p2' },
  ];
  const [proposal] = L.analyzeRunForProposals(mems, { minRuns: 2 });
  assert.equal(proposal.type, 'arena-guard');
  assert.equal(proposal.evidence.class, 'file-permissions');
  assert.match(proposal.proposal.diff, /file-permissions/);
  assert.match(proposal.proposal.diff, /fchmod/);
  assert.match(proposal.proposal.rationale, /2 confirmed arena findings/);
});

test('every bug class has guard advice', () => {
  // A class with no advice produces a proposal that says nothing useful.
  for (const [name] of L.CLASSES) {
    assert.ok(L.GUARD_ADVICE[name], `no guard advice for class "${name}"`);
  }
});

// ── Scope filtering ─────────────────────────────────────────────────────────

test('regression: recall is filtered to the scope actually being audited', () => {
  // Recall is BM25 over the whole store, and EVERY arena memory carries the tag
  // "arena" — so a query mentioning the arena matched all of them regardless of
  // origin. A run against scripts/dashboard was handed scripts/terse findings
  // and told they were "confirmed here previously", which is simply false.
  const mems = [
    { problem: 'terse bug', files: ['scripts/terse/compress.js'], tags: ['arena', 'confirmed'] },
    { problem: 'dash bug', files: ['scripts/dashboard/server.js'], tags: ['arena', 'confirmed'] },
  ];
  assert.deepEqual(
    L.filterToScope(mems, 'scripts/dashboard').map(m => m.problem),
    ['dash bug'],
  );
});

test('scope filtering does not bleed across a shared name prefix', () => {
  // "scripts/dash" must not match "scripts/dashboard" — only a whole path
  // segment counts.
  const mems = [{ problem: 'x', files: ['scripts/dashboard/server.js'], tags: ['arena'] }];
  assert.deepEqual(L.filterToScope(mems, 'scripts/dash'), []);
  assert.equal(L.filterToScope(mems, 'scripts/dashboard').length, 1);
});

test('a whole-repo scope keeps every memory', () => {
  const mems = [
    { problem: 'a', files: ['x.js'], tags: ['arena'] },
    { problem: 'b', files: [], tags: ['arena'] },
  ];
  for (const scope of ['.', './', '', null, undefined]) {
    assert.equal(L.filterToScope(mems, scope).length, 2, `scope=${scope}`);
  }
});

test('a memory with no files is not attributed to a narrow scope', () => {
  // Without a file there is no evidence it belongs here, and a false "confirmed
  // here before" is worse than no prior knowledge at all.
  const mems = [{ problem: 'unattributed', files: [], tags: ['arena', 'confirmed'] }];
  assert.deepEqual(L.filterToScope(mems, 'scripts/dashboard'), []);
});

test('trailing slashes and ./ prefixes are handled', () => {
  const mems = [{ problem: 'x', files: ['./scripts/dashboard/server.js'], tags: ['arena'] }];
  assert.equal(L.filterToScope(mems, 'scripts/dashboard/').length, 1);
  assert.equal(L.filterToScope(mems, './scripts/dashboard').length, 1);
});
