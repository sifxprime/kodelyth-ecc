// Tests for scripts/memory/project-id.js — the unified, git-remote-first project
// identity that stops memory orphaning on clone/move/rename.
//
// The bug: memory keyed a project by sha256(absolute path), so moving or cloning
// a repo changed its path and filed all future memories under a new id, hiding
// the old ones. The fix keys by the (normalized) git remote, which is stable
// where the path is not — and keeps the legacy path id for read-both so nothing
// captured under the old scheme is lost.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const pid = require('../../scripts/memory/project-id');
const store = require('../../scripts/memory/store');

function gitRepo(remoteUrl) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-pid-'));
  execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
  if (remoteUrl) execFileSync('git', ['remote', 'add', 'origin', remoteUrl], { cwd: dir, stdio: 'ignore' });
  return fs.realpathSync(dir);
}

// ── normalizeRemote: equivalent URL forms fold to one canonical string ───────

test('normalizeRemote folds every common form of the same repo together', () => {
  const forms = [
    'git@github.com:owner/repo.git',
    'https://github.com/owner/repo',
    'https://github.com/owner/repo.git',
    'https://github.com/owner/repo/',
    'ssh://git@github.com/owner/repo.git',
    'https://user:token@github.com/owner/repo.git',
  ];
  const canonical = pid.normalizeRemote(forms[0]);
  assert.equal(canonical, 'github.com/owner/repo');
  for (const f of forms) {
    assert.equal(pid.normalizeRemote(f), canonical, `expected ${f} to normalize to ${canonical}`);
  }
});

test('normalizeRemote keeps genuinely different repos distinct', () => {
  assert.notEqual(pid.normalizeRemote('git@github.com:owner/repo-a.git'),
                  pid.normalizeRemote('git@github.com:owner/repo-b.git'));
  assert.equal(pid.normalizeRemote(''), '');
  assert.equal(pid.normalizeRemote(null), '');
});

// ── legacyPathId matches the OLD store scheme (read-both backward compat) ─────

test('legacyPathId equals the store\'s previous projectHash, so old memories are still found', () => {
  const p = '/some/project/path';
  const expected = crypto.createHash('sha256').update(p).digest('hex').slice(0, 12);
  assert.equal(pid.legacyPathId(p), expected);
  // store.projectHash is the exact function memories were captured under before.
  assert.equal(pid.legacyPathId(p), store.projectHash(p));
});

// ── resolveProjectId: fallback + the move-survival fix ───────────────────────

test('resolveProjectId falls back to the path id when there is no git remote', () => {
  const dir = gitRepo(null); // git repo, but no origin remote
  assert.equal(pid.resolveProjectId(dir), pid.legacyPathId(dir));
});

test('resolveProjectId falls back to the path id for a non-git directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-nogit-'));
  assert.equal(pid.resolveProjectId(dir), pid.legacyPathId(dir));
});

test('THE FIX: the same remote at two different paths resolves to the same id', () => {
  const remote = 'git@github.com:kodelyth/ecc.git';
  const clone1 = gitRepo(remote);
  const clone2 = gitRepo(remote); // a different absolute path, same repo
  assert.notEqual(clone1, clone2, 'the two checkouts are at different paths');
  assert.equal(
    pid.resolveProjectId(clone1),
    pid.resolveProjectId(clone2),
    'memory must follow the repo across a move/clone, not the path',
  );
  // And it is NOT the path id — it is the remote id.
  assert.notEqual(pid.resolveProjectId(clone1), pid.legacyPathId(clone1));
});

// ── matchingProjectIds: read-both ────────────────────────────────────────────

test('matchingProjectIds returns both the remote id and the legacy path id', () => {
  const dir = gitRepo('git@github.com:kodelyth/ecc.git');
  const ids = pid.matchingProjectIds(dir);
  assert.ok(ids.includes(pid.resolveProjectId(dir)), 'includes the current (remote) id');
  assert.ok(ids.includes(pid.legacyPathId(dir)), 'includes the legacy path id for read-both');
  assert.equal(ids.length, 2);
});

test('matchingProjectIds collapses to one id when there is no remote', () => {
  const dir = gitRepo(null);
  assert.deepEqual(pid.matchingProjectIds(dir), [pid.legacyPathId(dir)]);
});

// ── integration: capture then project-scoped recall finds it ─────────────────

test('a memory captured in a repo is recalled by project scope', () => {
  const memDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-mem-'));
  process.env.KODELYTH_MEMORY_DIR = memDir;
  // Re-require store fresh so it picks up the temp memory dir.
  delete require.cache[require.resolve('../../scripts/memory/store')];
  const s = require('../../scripts/memory/store');

  const repo = gitRepo('git@github.com:kodelyth/recall-test.git');
  s.capture({ problem: 'flaky CORS preflight in staging', approach: 'added OPTIONS handler and Vary header', project: repo });

  const hits = s.recallForProject(repo, 'CORS preflight', { limit: 5 });
  assert.ok(hits.some(h => /CORS/.test(h.problem)), 'the just-captured memory is recalled for its project');
});
