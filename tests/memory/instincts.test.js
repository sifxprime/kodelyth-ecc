// Tests for scripts/memory/instincts.js — runs against a temp directory.
// Covers Improvement B (structured instinct schema), C (outcome tracking),
// and D (pattern confidence decay).
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

// ── Temp directory isolation ──────────────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-instincts-'));
process.env.KODELYTH_MEMORY_DIR = TMP;

// Require AFTER setting env
const instincts = require('../../scripts/memory/instincts');

// ── Helpers ───────────────────────────────────────────────────────────────────
const PROJECT_A = '/projects/test-a';
const PROJECT_B = '/projects/test-b';

function freshFile() {
  // Wipe the instincts file before each group of tests that needs isolation
  if (fs.existsSync(instincts.INSTINCTS_FILE)) {
    fs.unlinkSync(instincts.INSTINCTS_FILE);
  }
}

// ── captureFromCorrection ─────────────────────────────────────────────────────

test('captureFromCorrection stores a new instinct', () => {
  freshFile();
  const inst = instincts.captureFromCorrection('always use pnpm not npm', PROJECT_A, 'project');
  assert.ok(inst.id, 'should have an id');
  assert.ok(inst.rule.includes('pnpm'), 'rule should contain original text');
  assert.equal(inst.scope, 'project');
  assert.equal(inst.source, 'correction');
  assert.ok(inst.confidence >= 0.5 && inst.confidence <= 1.0, 'confidence in range');
  assert.equal(inst.use_count, 1);
  assert.equal(inst.stale, false);
  assert.equal(inst.outcome, null);
  assert.equal(inst.project_path, PROJECT_A);
});

test('captureFromCorrection is idempotent — re-capture increments use_count', () => {
  freshFile();
  const first  = instincts.captureFromCorrection('never use var', PROJECT_A, 'project');
  const second = instincts.captureFromCorrection('never use var', PROJECT_A, 'project');
  assert.equal(first.id, second.id, 'same correction should produce same id');
  assert.equal(second.use_count, 2);
  assert.ok(second.confidence > first.confidence, 're-capture should boost confidence');
});

test('captureFromCorrection creates distinct records for different projects', () => {
  freshFile();
  const a = instincts.captureFromCorrection('always use async/await', PROJECT_A, 'project');
  const b = instincts.captureFromCorrection('always use async/await', PROJECT_B, 'project');
  assert.notEqual(a.id, b.id, 'same rule, different project = different instinct');
});

test('captureFromCorrection caps confidence at 1.0', () => {
  freshFile();
  // Capture 10 times — confidence should never exceed 1.0
  for (let i = 0; i < 10; i++) {
    instincts.captureFromCorrection('use const not let', PROJECT_A, 'project');
  }
  const all = instincts.list({ projectPath: PROJECT_A });
  const inst = all.find(i => i.rule.includes('const'));
  assert.ok(inst, 'instinct should exist');
  assert.ok(inst.confidence <= 1.0, 'confidence should not exceed 1.0');
});

// ── recordOutcome (by id) ─────────────────────────────────────────────────────

test('recordOutcome boosts confidence on success', () => {
  freshFile();
  const inst = instincts.captureFromCorrection('prefer interface over type for objects', PROJECT_A);
  const before = inst.confidence;
  const updated = instincts.recordOutcome(inst.id, 'success');
  assert.ok(updated.confidence > before, 'success should boost confidence');
  assert.equal(updated.outcome, 'success');
});

test('recordOutcome reduces confidence on failure', () => {
  freshFile();
  const inst = instincts.captureFromCorrection('avoid class components', PROJECT_A);
  const before = inst.confidence;
  const updated = instincts.recordOutcome(inst.id, 'failure');
  assert.ok(updated.confidence < before, 'failure should reduce confidence');
  assert.equal(updated.outcome, 'failure');
});

test('recordOutcome floors confidence at 0.0', () => {
  freshFile();
  const inst = instincts.captureFromCorrection('do not use callbacks', PROJECT_A);
  // Record failure 5 times — should never go below 0
  for (let i = 0; i < 5; i++) {
    instincts.recordOutcome(inst.id, 'failure');
  }
  const updated = instincts.recordOutcome(inst.id, 'failure');
  assert.ok(updated.confidence >= 0.0, 'confidence should not go below 0');
});

test('recordOutcome returns null for unknown id', () => {
  freshFile();
  const result = instincts.recordOutcome('nonexistent-id-xyz', 'success');
  assert.equal(result, null);
});

// ── recordOutcomeByProject (Improvement C bridge) ─────────────────────────────

test('recordOutcomeByProject downgrades matching instincts by project + hint', () => {
  freshFile();
  instincts.captureFromCorrection('always use pnpm not npm', PROJECT_A);
  instincts.captureFromCorrection('always run tests before commit', PROJECT_A);
  instincts.captureFromCorrection('use tailwind not inline styles', PROJECT_B);

  const before = instincts.list({ projectPath: PROJECT_A });
  const pnpmBefore = before.find(i => i.rule.includes('pnpm')).confidence;

  const changed = instincts.recordOutcomeByProject(PROJECT_A, 'use pnpm not npm', false);

  assert.ok(changed.length >= 1, 'at least one instinct should be changed');

  const after = instincts.list({ projectPath: PROJECT_A });
  const pnpmAfter = after.find(i => i.rule.includes('pnpm')).confidence;
  assert.ok(pnpmAfter < pnpmBefore, 'matched instinct confidence should decrease');

  // PROJECT_B instinct should be untouched
  const bInstincts = instincts.list({ projectPath: PROJECT_B });
  assert.ok(bInstincts[0].confidence >= 0.7, 'unrelated project instinct should be unchanged');
});

test('recordOutcomeByProject skips instincts with < 20% token overlap', () => {
  freshFile();
  instincts.captureFromCorrection('always use pnpm', PROJECT_A);
  const changed = instincts.recordOutcomeByProject(PROJECT_A, 'completely unrelated topic xyz', false);
  // Should change 0 because token overlap < 20%
  assert.equal(changed.length, 0, 'should not match on low overlap');
});

// ── runDecayCheck (Improvement D) ─────────────────────────────────────────────

test('runDecayCheck marks old instincts as stale', () => {
  freshFile();
  const inst = instincts.captureFromCorrection('prefer named exports', PROJECT_A);

  // Manually backdate last_used to 35 days ago
  const all = instincts.list();
  const record = all.find(i => i.id === inst.id);
  const old = new Date();
  old.setDate(old.getDate() - 35);
  record.last_used = old.toISOString();
  // Write back manually via the file
  const lines = fs.readFileSync(instincts.INSTINCTS_FILE, 'utf8').split('\n').filter(Boolean);
  const rewritten = lines.map(l => {
    try {
      const r = JSON.parse(l);
      return r.id === inst.id ? JSON.stringify(record) : l;
    } catch { return l; }
  });
  fs.writeFileSync(instincts.INSTINCTS_FILE, rewritten.join('\n') + '\n', 'utf8');

  const stale = instincts.runDecayCheck();
  assert.ok(stale.length >= 1, 'should detect at least one stale instinct');
  assert.equal(stale[0].id, inst.id);
  assert.equal(stale[0].stale, true);
});

test('runDecayCheck does not mark recent instincts as stale', () => {
  freshFile();
  instincts.captureFromCorrection('use strict mode', PROJECT_A);
  const stale = instincts.runDecayCheck();
  assert.equal(stale.length, 0, 'fresh instinct should not be stale');
});

test('runDecayCheck returns only newly-stale (not already-stale)', () => {
  freshFile();
  const inst = instincts.captureFromCorrection('prefer optional chaining', PROJECT_A);

  // Backdate and mark already stale
  const lines = fs.readFileSync(instincts.INSTINCTS_FILE, 'utf8').split('\n').filter(Boolean);
  const old = new Date();
  old.setDate(old.getDate() - 40);
  const rewritten = lines.map(l => {
    try {
      const r = JSON.parse(l);
      if (r.id === inst.id) {
        return JSON.stringify({ ...r, stale: true, last_used: old.toISOString() });
      }
      return l;
    } catch { return l; }
  });
  fs.writeFileSync(instincts.INSTINCTS_FILE, rewritten.join('\n') + '\n', 'utf8');

  const stale = instincts.runDecayCheck();
  assert.equal(stale.length, 0, 'already-stale instincts should not be re-reported');
});

// ── pruneWeak ─────────────────────────────────────────────────────────────────

test('pruneWeak removes instincts below threshold', () => {
  freshFile();
  const inst = instincts.captureFromCorrection('do not shadow outer variables', PROJECT_A);

  // Drive confidence below threshold via repeated failures
  for (let i = 0; i < 5; i++) {
    instincts.recordOutcome(inst.id, 'failure');
  }

  const pruned = instincts.pruneWeak(0.2);
  assert.ok(pruned >= 1, 'should prune at least one weak instinct');

  const remaining = instincts.list();
  const found = remaining.find(i => i.id === inst.id);
  assert.equal(found, undefined, 'pruned instinct should be gone');
});

test('pruneWeak keeps high-confidence instincts', () => {
  freshFile();
  instincts.captureFromCorrection('use es modules not commonjs', PROJECT_A);
  const pruned = instincts.pruneWeak(0.2);
  assert.equal(pruned, 0, 'strong instinct should not be pruned');
});

// ── list + filtering ──────────────────────────────────────────────────────────

test('list filters by scope', () => {
  freshFile();
  instincts.captureFromCorrection('global rule one', null, 'global');
  instincts.captureFromCorrection('project rule one', PROJECT_A, 'project');

  const globals  = instincts.list({ scope: 'global' });
  const projects = instincts.list({ scope: 'project' });
  assert.ok(globals.every(i => i.scope === 'global'));
  assert.ok(projects.every(i => i.scope === 'project'));
});

test('list filters by minConfidence', () => {
  freshFile();
  const inst = instincts.captureFromCorrection('high confidence rule', PROJECT_A);
  instincts.recordOutcome(inst.id, 'success'); // boosts to ~0.85

  const high = instincts.list({ minConfidence: 0.8 });
  assert.ok(high.length >= 1);
  assert.ok(high.every(i => i.confidence >= 0.8));
});

test('list filters by projectPath', () => {
  freshFile();
  instincts.captureFromCorrection('rule for project a', PROJECT_A, 'project');
  instincts.captureFromCorrection('rule for project b', PROJECT_B, 'project');

  const aOnly = instincts.list({ projectPath: PROJECT_A });
  assert.ok(aOnly.every(i => i.project_path === PROJECT_A));
  assert.ok(aOnly.length >= 1);
});
