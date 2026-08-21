// Tests for scripts/lib/safe-fs.js — the shared path-safety guard.
//
// This module exists because the same containment bug was confirmed four times
// across three files. Every case below is one of those bugs, or an attempt to
// walk through the guard that replaced them.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const S = require('../../scripts/lib/safe-fs');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-fs-'));
  const root = path.join(dir, 'root');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(dir, 'outside.txt'), 'OUTSIDE-SECRET');
  fs.writeFileSync(path.join(root, 'inside.txt'), 'inside');
  return { dir, root, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

// ── resolveContained ────────────────────────────────────────────────────────

test('a file genuinely inside the root resolves', () => {
  const s = sandbox();
  try {
    assert.ok(S.resolveContained('inside.txt', s.root));
  } finally { s.cleanup(); }
});

test('textual traversal is rejected', () => {
  const s = sandbox();
  try {
    for (const p of ['../outside.txt', '../../etc/passwd', 'sub/../../outside.txt', './../outside.txt']) {
      assert.equal(S.resolveContained(p, s.root), null, p);
    }
  } finally { s.cleanup(); }
});

test('regression: a symlink pointing out of the root is rejected', () => {
  // The bug this module exists for. path.resolve normalises `..` but does not
  // resolve symlinks, so a link sitting lexically inside the root passed a
  // startsWith() check while its target was anywhere on disk.
  const s = sandbox();
  try {
    fs.symlinkSync(path.join(s.dir, 'outside.txt'), path.join(s.root, 'leak.txt'));
    assert.equal(S.resolveContained('leak.txt', s.root), null);
  } finally { s.cleanup(); }
});

test('regression: an intermediate DIRECTORY symlink cannot be traversed', () => {
  const s = sandbox();
  try {
    fs.symlinkSync(s.dir, path.join(s.root, 'updir'));
    assert.equal(S.resolveContained('updir/outside.txt', s.root), null);
  } finally { s.cleanup(); }
});

test('a dangling symlink is rejected rather than throwing', () => {
  const s = sandbox();
  try {
    fs.symlinkSync(path.join(s.dir, 'nope.txt'), path.join(s.root, 'broken.txt'));
    assert.equal(S.resolveContained('broken.txt', s.root), null);
  } finally { s.cleanup(); }
});

test('a symlink that stays INSIDE the root is allowed', () => {
  // Containment is about where the link points, not that links are forbidden.
  const s = sandbox();
  try {
    fs.symlinkSync(path.join(s.root, 'inside.txt'), path.join(s.root, 'alias.txt'));
    assert.ok(S.resolveContained('alias.txt', s.root));
  } finally { s.cleanup(); }
});

test('a symlinked ROOT still serves its own files', () => {
  // Installs are sometimes reached through a symlinked directory; the guard must
  // not reject the legitimate case.
  const s = sandbox();
  try {
    const linked = path.join(s.dir, 'linked-root');
    fs.symlinkSync(s.root, linked);
    assert.ok(S.resolveContained('inside.txt', linked));
  } finally { s.cleanup(); }
});

test('a sibling directory sharing a name prefix is not treated as inside', () => {
  // "root-evil" must not pass a startsWith("root") check.
  const s = sandbox();
  try {
    const sibling = path.join(s.dir, 'root-evil');
    fs.mkdirSync(sibling);
    fs.writeFileSync(path.join(sibling, 'x.txt'), 'x');
    assert.equal(S.resolveContained(path.join(sibling, 'x.txt'), s.root), null);
  } finally { s.cleanup(); }
});

test('an absolute path outside the root is rejected', () => {
  const s = sandbox();
  try {
    assert.equal(S.resolveContained(path.join(s.dir, 'outside.txt'), s.root), null);
  } finally { s.cleanup(); }
});

test('missing input fails closed', () => {
  assert.equal(S.resolveContained('', '/tmp'), null);
  assert.equal(S.resolveContained('x', ''), null);
  assert.equal(S.resolveContained(null, '/tmp'), null);
});

// ── statRegularFile ─────────────────────────────────────────────────────────

test('statRegularFile refuses a symlink, a directory, and a missing file', () => {
  const s = sandbox();
  try {
    fs.symlinkSync(path.join(s.dir, 'outside.txt'), path.join(s.root, 'link.txt'));
    assert.throws(() => S.statRegularFile(path.join(s.root, 'link.txt')), /symlink/);
    assert.throws(() => S.statRegularFile(s.root), /not a regular file/);
    assert.throws(() => S.statRegularFile(path.join(s.root, 'nope')), /file not found/);
    assert.ok(S.statRegularFile(path.join(s.root, 'inside.txt')));
  } finally { s.cleanup(); }
});

// ── safeConfigDir ───────────────────────────────────────────────────────────

test('safeConfigDir rejects a value containing ..', () => {
  assert.equal(S.safeConfigDir('/a/b/../../etc', '/fallback'), '/fallback');
  assert.equal(S.safeConfigDir('', '/fallback'), '/fallback');
  assert.equal(S.safeConfigDir(undefined, '/fallback'), '/fallback');
});

test('safeConfigDir accepts a clean absolute path', () => {
  assert.equal(S.safeConfigDir('/a/b/c', '/fallback'), path.resolve('/a/b/c'));
});

// ── writeNewFile ────────────────────────────────────────────────────────────

test('writeNewFile refuses to overwrite an existing file', () => {
  const s = sandbox();
  try {
    assert.throws(() => S.writeNewFile(path.join(s.root, 'inside.txt'), 'x', 0o644), { code: 'EEXIST' });
  } finally { s.cleanup(); }
});

test('regression: writeNewFile refuses to follow a planted dangling symlink', () => {
  // existsSync reports a DANGLING link as absent, so a check-then-write skipped
  // its own no-clobber guard and wrote through the link to a chosen path.
  const s = sandbox();
  try {
    const victim = path.join(s.dir, 'victim.txt');
    fs.symlinkSync(victim, path.join(s.root, 'bak'));
    assert.throws(() => S.writeNewFile(path.join(s.root, 'bak'), 'payload', 0o644), { code: 'EEXIST' });
    assert.ok(!fs.existsSync(victim), 'wrote through the planted symlink');
  } finally { s.cleanup(); }
});

test('regression: the mode survives a restrictive umask', () => {
  // open() filters its mode through the umask, so a 0644 file came back 0600
  // under `umask 077`. fchmod after the write ignores the umask.
  const s = sandbox();
  const prev = process.umask(0o077);
  try {
    const f = path.join(s.root, 'new.txt');
    S.writeNewFile(f, 'x', 0o644);
    assert.equal(fs.statSync(f).mode & 0o777, 0o644);
  } finally { process.umask(prev); s.cleanup(); }
});

// ── replaceFileAtomic ───────────────────────────────────────────────────────

test('replaceFileAtomic swaps contents and preserves the mode', () => {
  const s = sandbox();
  try {
    const f = path.join(s.root, 'inside.txt');
    fs.chmodSync(f, 0o600);
    S.replaceFileAtomic(f, 'replaced', 0o600);
    assert.equal(fs.readFileSync(f, 'utf8'), 'replaced');
    assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  } finally { s.cleanup(); }
});

test('regression: a failed rename leaves no temp file behind', () => {
  const s = sandbox();
  const realRename = fs.renameSync;
  try {
    fs.renameSync = () => { throw new Error('simulated crash'); };
    assert.throws(() => S.replaceFileAtomic(path.join(s.root, 'inside.txt'), 'x', 0o644), /simulated crash/);
    fs.renameSync = realRename;
    const strays = fs.readdirSync(s.root).filter(n => n.includes('.tmp-'));
    assert.deepEqual(strays, [], `temp survived: ${strays.join(', ')}`);
  } finally { fs.renameSync = realRename; s.cleanup(); }
});

test('regression: temp names are unpredictable, not pid-based', () => {
  // A predictable temp name lets another process pre-plant a symlink there.
  const s = sandbox();
  const realRename = fs.renameSync;
  const seen = new Set();
  try {
    fs.renameSync = (tmp) => { seen.add(path.basename(tmp)); throw new Error('stop'); };
    for (let i = 0; i < 3; i++) {
      try { S.replaceFileAtomic(path.join(s.root, 'inside.txt'), 'x', 0o644); } catch { /* expected */ }
    }
    fs.renameSync = realRename;
    assert.equal(seen.size, 3, 'temp name repeated');
    for (const n of seen) assert.ok(!n.includes(String(process.pid)), 'temp name contains the pid');
  } finally { fs.renameSync = realRename; s.cleanup(); }
});
