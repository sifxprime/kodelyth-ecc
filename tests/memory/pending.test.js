// Tests for the auto-capture review queue — scripts/memory/pending.js.
//
// The Stop hook auto-extracts candidates from a finished session and queues them
// (never storing). This module is the consent gate: list what was proposed, then
// explicitly promote (store) or discard. Nothing enters the recall store without
// promotePending() — the memory protocol's "never capture without confirmation".
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function fresh(candidates = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-pending-'));
  process.env.KODELYTH_MEMORY_DIR = dir;
  delete require.cache[require.resolve('../../scripts/memory/store')];
  delete require.cache[require.resolve('../../scripts/memory/pending')];
  if (candidates.length) {
    fs.writeFileSync(path.join(dir, 'pending-review.jsonl'),
      candidates.map(c => JSON.stringify(c)).join('\n') + '\n');
  }
  const pending = require('../../scripts/memory/pending');
  const store = require('../../scripts/memory/store');
  return { pending, store, dir };
}

const cand = (over = {}) => ({
  problem: 'cors preflight fails in staging',
  approach: 'added an OPTIONS handler and a Vary header',
  tags: ['cors'],
  files: [],
  language: 'ts',
  score: 4,
  session_id: 's1',
  project_path: '/work/app',
  queued_at: '2026-11-08T10:00:00Z',
  ...over,
});

test('listPending dedupes by content, keeps newest, assigns a stable id', () => {
  const { pending } = fresh([
    cand({ queued_at: '2026-11-08T10:00:00Z' }),
    cand({ queued_at: '2026-11-08T12:00:00Z' }), // same content, later — should win
    cand({ problem: 'redis stampede', approach: 'mutex + jitter', queued_at: '2026-11-08T11:00:00Z' }),
  ]);
  const items = pending.listPending();
  assert.equal(items.length, 2, 'the duplicate folded');
  for (const c of items) assert.match(c.id, /^[0-9a-f]{8}$/);
  // Newest-first: the cors candidate's surviving copy is queued at 12:00, the
  // redis one at 11:00, so cors sorts first.
  assert.equal(items[0].problem, 'cors preflight fails in staging');
});

test('countPending reflects the deduped queue; empty queue is empty', () => {
  assert.equal(fresh().pending.countPending(), 0);
  assert.equal(fresh([cand(), cand()]).pending.countPending(), 1);
});

test('promotePending(all) stores every candidate and clears the queue', () => {
  const { pending, store } = fresh([
    cand(),
    cand({ problem: 'redis stampede', approach: 'mutex + jitter' }),
  ]);
  const stored = pending.promotePending('all');
  assert.equal(stored.length, 2);
  assert.equal(store.listAll().length, 2, 'both are now in the recall store');
  assert.equal(pending.countPending(), 0, 'the queue is cleared');
});

test('promotePending(id) stores only that candidate and leaves the rest queued', () => {
  const { pending, store } = fresh([
    cand(),
    cand({ problem: 'redis stampede', approach: 'mutex + jitter' }),
  ]);
  const target = pending.listPending().find(c => c.problem === 'redis stampede');
  const stored = pending.promotePending(target.id);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].problem, 'redis stampede');
  assert.equal(store.listAll().length, 1);
  const left = pending.listPending();
  assert.equal(left.length, 1);
  assert.equal(left[0].problem, 'cors preflight fails in staging', 'the other candidate is still pending');
});

test('discardPending removes without storing', () => {
  const { pending, store } = fresh([cand(), cand({ problem: 'x', approach: 'y' })]);
  const n = pending.discardPending('all');
  assert.equal(n >= 1, true);
  assert.equal(pending.countPending(), 0);
  assert.equal(store.listAll().length, 0, 'nothing was stored');
});

test('promotion redacts secrets (capture() scrubs on the way in)', () => {
  const { pending } = fresh([
    cand({ approach: 'rotated the key ghp_0123456789abcdefghijABCDEFGHIJ0123 and redeployed' }),
  ]);
  const [m] = pending.promotePending('all');
  assert.doesNotMatch(m.approach, /ghp_0123456789/, 'the token was scrubbed when promoted');
});

test('promoting a non-existent id stores nothing', () => {
  const { pending, store } = fresh([cand()]);
  assert.deepEqual(pending.promotePending('deadbeef'), []);
  assert.equal(store.listAll().length, 0);
  assert.equal(pending.countPending(), 1, 'the real candidate is untouched');
});
