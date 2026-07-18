// Tests for scripts/memory/store.js — runs against a temp directory
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-mem-'));
process.env.KODELYTH_MEMORY_DIR = TMP;

// Require AFTER setting env so the store picks up the temp dir
const store = require('../../scripts/memory/store');
const { buildContextBlock } = require('../../scripts/memory/inject');

test('tokenise removes stopwords and short tokens', () => {
  const tokens = store.tokenise('The Stripe webhook signature failed in production');
  assert.ok(tokens.includes('stripe'));
  assert.ok(tokens.includes('webhook'));
  assert.ok(tokens.includes('signature'));
  assert.ok(tokens.includes('failed'));
  assert.ok(!tokens.includes('the'));
  assert.ok(!tokens.includes('in'));
});

test('capture stores a memory and returns it with id', () => {
  const m = store.capture({
    problem:  'Stripe webhook signature failed in production',
    approach: 'Switched body parser from json to raw, validated with constructEvent',
    tags:     ['payments', 'stripe', 'webhooks'],
    project:  '/test/project-a',
    language: 'typescript',
  });
  assert.ok(m.id);
  assert.equal(m.problem, 'Stripe webhook signature failed in production');
  assert.equal(m.tags.length, 3);
  assert.ok(m.captured_at);
});

test('capture rejects missing problem or approach', () => {
  assert.throws(() => store.capture({ problem: '', approach: 'x' }));
  assert.throws(() => store.capture({ problem: 'x', approach: '' }));
});

test('recall finds memory by keyword', () => {
  const results = store.recall('stripe webhook');
  assert.ok(results.length >= 1);
  assert.match(results[0].problem, /stripe/i);
  assert.ok(results[0].score > 0);
});

test('recall returns empty for irrelevant query', () => {
  const results = store.recall('completely unrelated quantum mechanics');
  assert.equal(results.length, 0);
});

test('recallForProject prioritises project memories then falls back to global', () => {
  store.capture({
    problem:  'Database connection pool exhausted',
    approach: 'Increased pool size and added connection timeout',
    tags:     ['database', 'postgres'],
    project:  '/test/project-b',
    language: 'typescript',
  });
  const projectA = store.recallForProject('/test/project-a', 'webhook');
  assert.ok(projectA.length >= 1);
  assert.equal(projectA[0].project_path, '/test/project-a');
});

test('listAll returns all non-deleted memories', () => {
  const all = store.listAll();
  assert.ok(all.length >= 2);
});

test('forget marks memory deleted', () => {
  const all = store.listAll();
  const target = all[0];
  const ok = store.forget(target.id);
  assert.equal(ok, true);
  const after = store.listAll();
  assert.ok(after.length < all.length);
});

test('rebuildIndex restores searchability after manual log edit', () => {
  const r = store.rebuildIndex();
  assert.ok(r.count >= 1);
});

test('stats summarises store contents', () => {
  const s = store.stats();
  assert.ok(s.total >= 1);
  assert.equal(s.storageDir, TMP);
  assert.ok(s.byLanguage.typescript >= 1);
});

test('buildContextBlock returns null when memory is empty', () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-empty-'));
  process.env.KODELYTH_MEMORY_DIR = emptyDir;
  // Force fresh require by clearing cache
  delete require.cache[require.resolve('../../scripts/memory/store')];
  delete require.cache[require.resolve('../../scripts/memory/inject')];
  const { buildContextBlock: bcb } = require('../../scripts/memory/inject');
  const result = bcb({ projectRoot: '/test/project-x' });
  assert.equal(result, null);
  // Restore
  process.env.KODELYTH_MEMORY_DIR = TMP;
  delete require.cache[require.resolve('../../scripts/memory/store')];
  delete require.cache[require.resolve('../../scripts/memory/inject')];
});

test('buildContextBlock returns structured block when memory exists', () => {
  const fresh = require('../../scripts/memory/inject');
  const result = fresh.buildContextBlock({
    projectRoot: '/test/project-b',
    query:       'database pool',
  });
  assert.ok(result);
  assert.ok(result.text.includes('Kodelyth Memory'));
  assert.ok(result.memoryCount >= 1);
});

// ── Improvement C: outcome tracking ──────────────────────────────────────────

test('resolveMemory marks a memory with outcome', () => {
  // Capture a memory with a file reference
  const m = store.capture({
    problem:  'Auth token refresh race condition',
    approach: 'Added mutex lock around token refresh logic',
    tags:     ['auth', 'race-condition'],
    project:  '/test/project-c',
    files:    ['/test/project-c/src/auth/refresh.ts'],
  });
  const ok = store.resolveMemory(m.id, false);
  assert.equal(ok, true, 'resolveMemory should return true when memory found');

  const all = store.listAll();
  const updated = all.find(mem => mem.id === m.id);
  assert.ok(updated, 'memory should still exist');
  assert.equal(updated.resolved, false);
  assert.ok(updated.resolved_at, 'resolved_at should be set');
});

test('resolveMemory returns false for unknown id', () => {
  const ok = store.resolveMemory('totally-unknown-id-123', true);
  assert.equal(ok, false);
});

test('findMemoriesForFile finds memories by exact file path', () => {
  store.capture({
    problem:  'Database migration ran twice',
    approach: 'Added idempotency check in migration runner',
    tags:     ['migrations', 'database'],
    project:  '/test/project-d',
    files:    ['/test/project-d/migrations/001_users.sql'],
  });
  const matches = store.findMemoriesForFile('/test/project-d/migrations/001_users.sql');
  assert.ok(matches.length >= 1, 'should find memory with exact file path');
});

test('findMemoriesForFile returns empty when no file match', () => {
  const matches = store.findMemoriesForFile('/completely/unrelated/path/file.ts');
  assert.equal(matches.length, 0);
});

test('findMemoriesForFile excludes already-resolved memories', () => {
  const m = store.capture({
    problem:  'Cache invalidation bug in product listing',
    approach: 'Switched to event-driven cache clearing',
    tags:     ['cache', 'redis'],
    project:  '/test/project-e',
    files:    ['/test/project-e/src/cache/products.ts'],
  });
  store.resolveMemory(m.id, true);  // mark as resolved

  const matches = store.findMemoriesForFile('/test/project-e/src/cache/products.ts');
  const found = matches.find(mem => mem.id === m.id);
  assert.equal(found, undefined, 'resolved memory should not be returned');
});

test('autoResolveOnEdit marks matching memory resolved:false', () => {
  const filePath = '/test/project-f/src/api/users.ts';
  const m = store.capture({
    problem:  'User endpoint returned 500 on empty body',
    approach: 'Added body validation middleware before handler',
    tags:     ['api', 'validation'],
    project:  '/test/project-f',
    files:    [filePath],
  });

  const resolved = store.autoResolveOnEdit(filePath, '/test/project-f');
  assert.ok(resolved.length >= 1, 'should resolve at least one memory');
  assert.equal(resolved[0].id, m.id);

  const all = store.listAll();
  const updated = all.find(mem => mem.id === m.id);
  assert.equal(updated.resolved, false);
});

test('autoResolveOnEdit returns empty when no matching memory', () => {
  const resolved = store.autoResolveOnEdit('/no/memory/for/this/file.ts');
  assert.equal(resolved.length, 0);
});

test('recall self-heals from a stale/foreign index schema (regression)', () => {
  // Seed at least one memory so there is something to recall.
  store.capture({
    problem:  'CORS preflight blocked on express API',
    approach: 'Added cors() middleware with explicit origin allowlist',
    tags:     ['cors', 'express', 'api'],
    project:  '/test/project-cors',
  });

  // Simulate the pre-2.4.3 bug: an index.json written by a FOREIGN BM25 schema
  // that lacks the `.tokens` / `.docCount` fields search() reads. Before the fix
  // this made recall throw `Cannot read properties of undefined (reading '<token>')`.
  const idxPath = path.join(TMP, 'index.json');
  fs.writeFileSync(idxPath, JSON.stringify({
    k1: 1.5, b: 0.75, corpusStats: {}, index: [], documents: [], docFreq: {},
  }));

  // Must NOT throw, and must return the seeded memory after self-heal.
  let results;
  assert.doesNotThrow(() => {
    results = store.recall('cors express preflight', { limit: 3, minScore: 0.1 });
  });
  assert.ok(results.length >= 1, 'recall should self-heal and return results');

  // The on-disk index should now be the valid schema (has .tokens + .docCount).
  const healed = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  assert.ok(healed.tokens && typeof healed.tokens === 'object', 'index rebuilt with .tokens');
  assert.equal(typeof healed.docCount, 'number', 'index rebuilt with numeric .docCount');
});
