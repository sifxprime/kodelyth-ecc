// Tests for scripts/super-agent/integrate.js — dependency-ordered merge planning
// and git-based conflict detection (the "merge the worker branches" piece).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const integ = require('../../scripts/super-agent/integrate');

// ── mergeOrder (pure) ────────────────────────────────────────────────────────

test('mergeOrder puts a dependency branch before the branch built on it', () => {
  const steps = [
    { id: 'ui', deps: ['api'], status: 'done', branch: 'sa/ui' },
    { id: 'api', deps: [], status: 'done', branch: 'sa/api' },
  ];
  assert.deepEqual(integ.mergeOrder(steps).map((m) => m.step), ['api', 'ui']);
});

test('mergeOrder ignores steps without a branch or not done', () => {
  const steps = [
    { id: 'a', status: 'done', branch: 'sa/a' },
    { id: 'b', status: 'failed', branch: 'sa/b' },
    { id: 'c', status: 'done' }, // no branch (e.g., a planning-only step)
  ];
  assert.deepEqual(integ.mergeOrder(steps).map((m) => m.step), ['a']);
});

// ── detectConflicts (real git) ───────────────────────────────────────────────

function gitRepoWithBranches() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-integ-')));
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 't');
  git('config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(dir, 'f.txt'), 'line1\nline2\nline3\n');
  git('add', '.'); git('commit', '-qm', 'base');
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();

  git('checkout', '-q', '-b', 'A');
  fs.writeFileSync(path.join(dir, 'f.txt'), 'line1\nAAA\nline3\n');
  git('commit', '-qam', 'A');

  git('checkout', '-q', base); git('checkout', '-q', '-b', 'B');
  fs.writeFileSync(path.join(dir, 'f.txt'), 'line1\nBBB\nline3\n'); // same line as A → conflict
  git('commit', '-qam', 'B');

  git('checkout', '-q', base); git('checkout', '-q', '-b', 'C');
  fs.writeFileSync(path.join(dir, 'g.txt'), 'new\n'); // different file → clean with A
  git('add', 'g.txt'); git('commit', '-qam', 'C');

  return dir;
}

test('detectConflicts flags two branches that edit the same line', () => {
  const dir = gitRepoWithBranches();
  const r = integ.detectConflicts(dir, ['A', 'B']);
  assert.equal(r.clean, false);
  assert.equal(r.conflicts.length, 1);
  assert.deepEqual(r.conflicts[0].branches.sort(), ['A', 'B']);
});

test('detectConflicts reports clean for branches touching different files', () => {
  const dir = gitRepoWithBranches();
  const r = integ.detectConflicts(dir, [{ branch: 'A' }, { branch: 'C' }]);
  assert.equal(r.clean, true);
  assert.equal(r.conflicts.length, 0);
});

test('detectConflicts across three branches isolates only the conflicting pair', () => {
  const dir = gitRepoWithBranches();
  const r = integ.detectConflicts(dir, ['A', 'B', 'C']);
  assert.equal(r.clean, false);
  // A↔B conflict; A↔C and B↔C are clean.
  assert.equal(r.conflicts.length, 1);
  assert.deepEqual(r.conflicts[0].branches.sort(), ['A', 'B']);
});
