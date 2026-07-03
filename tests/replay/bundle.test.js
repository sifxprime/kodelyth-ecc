// Tests for scripts/replay/bundle.js — pure read/write of session bundles.
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const B = require('../../scripts/replay/bundle.js');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-bundle-'));
}

function seedSession(root, sessionName, workers) {
  const sessionDir = path.join(root, sessionName);
  fs.mkdirSync(sessionDir, { recursive: true });
  for (const w of workers) {
    const wdir = path.join(sessionDir, w.slug);
    fs.mkdirSync(wdir);
    fs.writeFileSync(path.join(wdir, 'task.md'),    w.task    || `# task for ${w.slug}`);
    fs.writeFileSync(path.join(wdir, 'handoff.md'), w.handoff || `# handoff for ${w.slug}`);
    fs.writeFileSync(path.join(wdir, 'status.md'),  w.status  || `# status for ${w.slug}\n- State: completed`);
  }
  return sessionDir;
}

// ── exportBundle ─────────────────────────────────────────────────────────────

test('exportBundle: rejects missing session dir', () => {
  assert.throws(() => B.exportBundle({ sessionDir: '/no/such/path' }), /not found/);
});

test('exportBundle: gathers task/handoff/status per worker', () => {
  const root = tmp();
  const dir = seedSession(root, 'swarm-test', [
    { slug: 'security-reviewer', task: 'audit', handoff: 'found 3 issues', status: 'completed' },
    { slug: 'code-reviewer',     task: 'review', handoff: 'all good',       status: 'completed' },
  ]);
  const bundle = B.exportBundle({ sessionDir: dir, sessionName: 'swarm-test', meta: { task: 'audit oauth', harness: 'claude' } });
  assert.equal(bundle.schema, B.BUNDLE_SCHEMA);
  assert.equal(bundle.session, 'swarm-test');
  assert.equal(bundle.workers.length, 2);
  assert.equal(bundle.meta.task, 'audit oauth');
  // Sorted by slug:
  assert.deepEqual(bundle.workers.map(w => w.slug), ['code-reviewer', 'security-reviewer']);
  // Content preserved:
  const sec = bundle.workers.find(w => w.slug === 'security-reviewer');
  assert.equal(sec.task, 'audit');
  assert.equal(sec.handoff, 'found 3 issues');
});

test('exportBundle: handles empty session dir gracefully', () => {
  const root = tmp();
  const empty = path.join(root, 'empty');
  fs.mkdirSync(empty);
  const bundle = B.exportBundle({ sessionDir: empty });
  assert.equal(bundle.workers.length, 0);
});

// ── writeBundle / readBundle round-trip ──────────────────────────────────────

test('writeBundle + readBundle: round-trips losslessly', () => {
  const root = tmp();
  const dir = seedSession(root, 's1', [{ slug: 'a' }, { slug: 'b' }]);
  const bundle = B.exportBundle({ sessionDir: dir, meta: { task: 'foo' } });
  const out = path.join(root, 'out.json');
  B.writeBundle(bundle, out);

  const reread = B.readBundle(out);
  assert.equal(reread.session, bundle.session);
  assert.equal(reread.workers.length, 2);
  assert.equal(reread.meta.task, 'foo');
});

test('writeBundle: rejects bad schema', () => {
  assert.throws(() => B.writeBundle({ schema: 'bogus' }, '/tmp/x.json'), /invalid schema/);
});

test('readBundle: rejects unknown schema', () => {
  const root = tmp();
  const out = path.join(root, 'bad.json');
  fs.writeFileSync(out, JSON.stringify({ schema: 'not.kodelythecc/v0', session: 'x', workers: [] }));
  assert.throws(() => B.readBundle(out), /unsupported schema/);
});

test('readBundle: rejects empty workers', () => {
  const root = tmp();
  const out = path.join(root, 'empty.json');
  fs.writeFileSync(out, JSON.stringify({ schema: B.BUNDLE_SCHEMA, session: 'x', workers: [] }));
  assert.throws(() => B.readBundle(out), /non-empty array/);
});

// ── importBundle ─────────────────────────────────────────────────────────────

test('importBundle: restores worker files into target dir', () => {
  const root = tmp();
  const dir = seedSession(root, 'src', [
    { slug: 'a', task: 'task-a', handoff: 'handoff-a', status: 'status-a' },
  ]);
  const bundle = B.exportBundle({ sessionDir: dir });

  const target = path.join(root, 'restored');
  const out = B.importBundle(bundle, { targetDir: target });
  assert.equal(out.targetDir, target);
  assert.deepEqual(out.workers, ['a']);

  assert.equal(fs.readFileSync(path.join(target, 'a', 'task.md'),    'utf8'), 'task-a');
  assert.equal(fs.readFileSync(path.join(target, 'a', 'handoff.md'), 'utf8'), 'handoff-a');
  assert.equal(fs.readFileSync(path.join(target, 'a', 'status.md'),  'utf8'), 'status-a');
});

test('importBundle: refuses to overwrite without flag', () => {
  const root = tmp();
  const dir = seedSession(root, 'src', [{ slug: 'a' }]);
  const bundle = B.exportBundle({ sessionDir: dir });
  const target = path.join(root, 'exists');
  fs.mkdirSync(target);
  assert.throws(() => B.importBundle(bundle, { targetDir: target }), /already exists/);
});

test('importBundle: overwrite=true replaces existing dir', () => {
  const root = tmp();
  const dir = seedSession(root, 'src', [{ slug: 'a', task: 'fresh' }]);
  const bundle = B.exportBundle({ sessionDir: dir });
  const target = path.join(root, 'exists');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'stale.txt'), 'leftover');

  B.importBundle(bundle, { targetDir: target, overwrite: true });
  assert.equal(fs.existsSync(path.join(target, 'stale.txt')), false);
  assert.equal(fs.readFileSync(path.join(target, 'a', 'task.md'), 'utf8'), 'fresh');
});

// ── diffBundles ──────────────────────────────────────────────────────────────

test('diffBundles: detects handoff changes', () => {
  const root = tmp();
  const a = B.exportBundle({ sessionDir: seedSession(root, 'a', [
    { slug: 'x', handoff: 'aaa' }, { slug: 'y', handoff: 'shared' },
  ]) });
  const b = B.exportBundle({ sessionDir: seedSession(root, 'b', [
    { slug: 'x', handoff: 'bbb' }, { slug: 'y', handoff: 'shared' },
  ]) });
  const d = B.diffBundles(a, b);
  const x = d.find(r => r.slug === 'x');
  const y = d.find(r => r.slug === 'y');
  assert.equal(x.handoff_changed, true);
  assert.equal(y.handoff_changed, false);
});

test('diffBundles: surfaces workers that exist on only one side', () => {
  const root = tmp();
  const a = B.exportBundle({ sessionDir: seedSession(root, 'a', [
    { slug: 'only-a' }, { slug: 'shared' },
  ]) });
  const b = B.exportBundle({ sessionDir: seedSession(root, 'b', [
    { slug: 'shared' }, { slug: 'only-b' },
  ]) });
  const d = B.diffBundles(a, b);
  assert.equal(d.find(r => r.slug === 'only-a').in_a, true);
  assert.equal(d.find(r => r.slug === 'only-a').in_b, false);
  assert.equal(d.find(r => r.slug === 'only-b').in_b, true);
  assert.equal(d.find(r => r.slug === 'only-b').in_a, false);
});

// ── nextReplayName ───────────────────────────────────────────────────────────

test('nextReplayName: generates -replay-1 for fresh origin', () => {
  assert.equal(B.nextReplayName('swarm-2026-05-10-4a'), 'swarm-2026-05-10-4a-replay-1');
});

test('nextReplayName: skips taken numbers', () => {
  const taken = new Set(['swarm-x-replay-1', 'swarm-x-replay-2']);
  assert.equal(B.nextReplayName('swarm-x', taken), 'swarm-x-replay-3');
});

test('nextReplayName: strips existing -replay-N suffix to find canonical base', () => {
  assert.equal(B.nextReplayName('swarm-x-replay-3'), 'swarm-x-replay-1');
});
