// Tests for recall rank fusion — scripts/memory/store.js fuseScore().
//
// BM25 decides relevance; fusion reorders similarly-relevant memories so a
// recent, proven one beats an old or failed one. These tests pin that ordering
// and, critically, that relevance still dominates (a much more relevant memory
// is not buried by a newer irrelevant one).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const store = require('../../scripts/memory/store');
const { fuseScore } = store;

const DAY = 86400000;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

test('a confirmed memory outranks a failed one of equal relevance and age', () => {
  const good = { score: 1, captured_at: iso(0), resolved: true };
  const bad  = { score: 1, captured_at: iso(0), resolved: false };
  assert.ok(fuseScore(good) > fuseScore(bad));
});

test('a recent memory outranks an old one of equal relevance and outcome', () => {
  const fresh = { score: 1, captured_at: iso(0) };
  const stale = { score: 1, captured_at: iso(200 * DAY) };
  assert.ok(fuseScore(fresh) > fuseScore(stale));
});

test('relevance dominates: a much more relevant memory still wins', () => {
  // Highly relevant but old and failed...
  const relevant = { score: 5, captured_at: iso(300 * DAY), resolved: false };
  // ...vs barely relevant but fresh and confirmed.
  const fresh    = { score: 1, captured_at: iso(0), resolved: true };
  assert.ok(fuseScore(relevant) > fuseScore(fresh), 'BM25 relevance must not be buried by recency/outcome');
});

test('unknown outcome and missing timestamp are handled neutrally', () => {
  assert.equal(typeof fuseScore({ score: 2 }), 'number');
  assert.equal(fuseScore({ score: 0 }), 0);
  // A memory with no timestamp and no outcome just scores its base (×1 ×1).
  assert.equal(fuseScore({ score: 3, captured_at: 'not-a-date' }), 3);
});

// ── Integration: a failed memory sinks below an equally-worded one ───────────

test('recall ranks a resolved:false memory below its equally-relevant sibling', () => {
  const memDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-fusion-'));
  process.env.KODELYTH_MEMORY_DIR = memDir;
  delete require.cache[require.resolve('../../scripts/memory/store')];
  const s = require('../../scripts/memory/store');

  const a = s.capture({ problem: 'redis cache stampede on cold start', approach: 'added a mutex lock and jittered TTL' });
  const b = s.capture({ problem: 'redis cache stampede on cold start', approach: 'raised the TTL only' });
  s.resolveMemory(b.id, false); // b's approach did not stick

  const hits = s.recall('redis cache stampede', { limit: 5 });
  const ia = hits.findIndex(h => h.id === a.id);
  const ib = hits.findIndex(h => h.id === b.id);
  assert.ok(ia !== -1 && ib !== -1, 'both memories are recalled');
  assert.ok(ia < ib, 'the non-failed memory ranks first');
});
