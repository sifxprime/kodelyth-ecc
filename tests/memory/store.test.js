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

// ── Prototype-key collisions ────────────────────────────────────────────────

test('regression: a memory mentioning "constructor" does not break the index', () => {
  // The index used a plain object keyed by user tokens. `tokens['constructor']`
  // returns Object.prototype's constructor — TRUTHY — so the `if (!tokens[t])`
  // guard never fired and the next line read `.docs` off a function. "constructor"
  // is ordinary programming vocabulary, so this bricked recall() for good with no
  // attacker involved.
  const words = [
    'the constructor takes two arguments',
    'override toString for better logging',
    'valueOf returns a primitive',
    'check hasOwnProperty before reading',
    'the __proto__ chain was broken',
    'call isPrototypeOf to compare',
  ];
  for (const problem of words) {
    assert.doesNotThrow(
      () => store.capture({ problem, approach: 'notes', tags: [] }),
      `capture threw on: ${problem}`,
    );
  }
  // Not crashing is not enough — those tokens must actually be searchable.
  assert.doesNotThrow(() => store.recall('constructor', { limit: 3 }));
  const hits = store.recall('constructor', { limit: 3 });
  assert.ok(hits.some(m => /constructor takes two/.test(m.problem)), 'token not searchable');
});

test('regression: a prototype-key TAG does not break the index', () => {
  assert.doesNotThrow(() => store.capture({
    problem: 'tagged with a prototype key', approach: 'x',
    tags: ['constructor', '__proto__', 'toString'],
  }));
  assert.doesNotThrow(() => store.recall('tagged', { limit: 3 }));
});

test('capturing a prototype key never pollutes Object.prototype', () => {
  store.capture({ problem: 'pollution probe', approach: 'x', tags: ['__proto__', 'constructor'] });
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.pwned, undefined);
});

// ── Input bounds ────────────────────────────────────────────────────────────

test('regression: every stored field is length-bounded, not just the count', () => {
  // tags/files/gotchas capped their COUNT but not the length of each entry, so a
  // single multi-megabyte tag was stored whole — bloating the log, the index, and
  // the memory block injected at session start.
  const huge = 'a'.repeat(2 * 1024 * 1024);
  const m = store.capture({
    problem: huge, approach: huge,
    tags: [huge], files: [huge], gotchas: [huge],
  });
  assert.equal(m.problem.length, 500);
  assert.equal(m.approach.length, 2000);
  assert.ok(m.tags[0].length <= 60, `tag was ${m.tags[0].length} chars`);
  assert.ok(m.files[0].length <= 500, `file was ${m.files[0].length} chars`);
  assert.ok(m.gotchas[0].length <= 500, `gotcha was ${m.gotchas[0].length} chars`);
});

test('a huge capture does not bloat the log', () => {
  const before = fs.statSync(store.PATHS.log).size;
  const huge = 'a'.repeat(2 * 1024 * 1024);
  store.capture({ problem: huge, approach: huge, tags: [huge], files: [huge], gotchas: [huge] });
  const grew = fs.statSync(store.PATHS.log).size - before;
  assert.ok(grew < 8192, `one row added ${grew} bytes to the log`);
});

// ── Durability: the log is append-only ──────────────────────────────────────

test('regression: forget() appends a tombstone instead of rewriting the log', () => {
  // forget() used to read the WHOLE log, mutate it in memory, and write it back
  // with fs.writeFileSync — which opens with 'w' and truncates to zero BEFORE
  // writing. A concurrent reader was measured observing a 6.3 MB store at 0
  // bytes mid-write, and any reader doing its own read-modify-write would then
  // persist that emptiness.
  const m = store.capture({ problem: 'tombstone probe', approach: 'x', tags: [] });
  const sizeBefore = fs.statSync(store.PATHS.log).size;
  assert.equal(store.forget(m.id), true);
  const sizeAfter = fs.statSync(store.PATHS.log).size;
  assert.ok(sizeAfter > sizeBefore, 'the log shrank — forget() rewrote instead of appending');
  assert.ok(!store.listAll().some(x => x.id === m.id), 'forgotten memory still listed');
});

test('regression: a no-op forget() does not touch the log at all', () => {
  // The write sat OUTSIDE the `found` guard, so deleting a non-existent id still
  // rewrote the entire store — paying the full destruction window for nothing.
  const sizeBefore = fs.statSync(store.PATHS.log).size;
  assert.equal(store.forget('id-that-does-not-exist'), false);
  assert.equal(fs.statSync(store.PATHS.log).size, sizeBefore, 'a no-op delete wrote to the log');
});

test('patch rows fold onto the original by id, last write wins', () => {
  const m = store.capture({ problem: 'fold probe', approach: 'original', tags: ['fold'] });
  store.resolveMemory(m.id, true);
  const found = store.listAll().find(x => x.id === m.id);
  assert.ok(found, 'memory vanished after a patch');
  assert.equal(found.resolved, true, 'patch not applied');
  assert.equal(found.approach, 'original', 'patch clobbered the original fields');
  assert.equal(store.listAll().filter(x => x.id === m.id).length, 1, 'memory appears twice');
});

test('regression: findMemoriesForFile sees patch rows', () => {
  // It read the log line-by-line instead of via readMemories, so an appended
  // {resolved} patch was never applied and a resolved memory kept coming back.
  const m = store.capture({
    problem: 'patch visibility probe', approach: 'x', tags: [],
    project: '/proj-z', files: ['/proj-z/src/thing.ts'],
  });
  assert.ok(store.findMemoriesForFile('/proj-z/src/thing.ts').some(x => x.id === m.id));
  store.resolveMemory(m.id, true);
  assert.ok(!store.findMemoriesForFile('/proj-z/src/thing.ts').some(x => x.id === m.id),
    'resolved memory still returned');
});

// ── Index integrity ─────────────────────────────────────────────────────────

test('regression: a memory is indexed once, not twice, on a cold start', () => {
  // capture() appended the row BEFORE loadIndex(). With no index on disk,
  // loadIndex() fell through to rebuildIndex(), which re-read the log and
  // indexed the brand-new row — then indexMemory() counted it again. docCount
  // was permanently inflated and the doubled document scored exactly 2x.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-cold-'));
  const prev = process.env.KODELYTH_MEMORY_DIR;
  try {
    // A fresh require is needed because PATHS are frozen at module load.
    process.env.KODELYTH_MEMORY_DIR = dir;
    delete require.cache[require.resolve('../../scripts/memory/store')];
    const cold = require('../../scripts/memory/store');
    cold.capture({ problem: 'alpha unique widget', approach: 'x', tags: [] });
    const idx = JSON.parse(fs.readFileSync(cold.PATHS.index, 'utf8'));
    assert.equal(idx.docCount, 1, `docCount was ${idx.docCount} for one memory`);
    assert.equal(idx.tokens.alpha.df, 1, 'token indexed twice');
  } finally {
    process.env.KODELYTH_MEMORY_DIR = prev;
    delete require.cache[require.resolve('../../scripts/memory/store')];
    require('../../scripts/memory/store');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('regression: an index that drifts from the log self-heals', () => {
  // A failed index write left the memory in the log but invisible to recall()
  // forever — for a recall-driven store that is indistinguishable from loss.
  const orphan = {
    id: 'orphan-probe-1', captured_at: new Date().toISOString(),
    problem: 'orphaned unsearchable widget', approach: 'y',
    tags: [], files: [], gotchas: [],
  };
  fs.appendFileSync(store.PATHS.log, JSON.stringify(orphan) + '\n');
  assert.ok(store.listAll().some(m => m.id === orphan.id), 'orphan not in the log');
  assert.ok(
    store.recall('orphaned unsearchable widget', { limit: 5 }).some(m => m.id === orphan.id),
    'index did not self-heal — memory is in the log but unsearchable',
  );
});

test('regression: an interrupted append does not swallow the next memory', () => {
  // A crash mid-append leaves a row with no terminator. The next append used to
  // concatenate onto the fragment, fusing two records into one dead line — and
  // capture() still returned an id, reporting success for a memory that was
  // never stored.
  fs.appendFileSync(store.PATHS.log, '{"id":"PARTIAL","problem":"half-written ro');
  const m = store.capture({ problem: 'the very next memory', approach: 'z', tags: [] });
  assert.ok(store.listAll().some(x => x.id === m.id), 'the memory after a torn row was lost');
  assert.ok(
    store.recall('very next memory', { limit: 3 }).some(x => x.id === m.id),
    'the memory after a torn row is unsearchable',
  );
});

test('regression: an orphan patch row is not promoted to a phantom memory', () => {
  // The fold set folded[id] = row even with no prior, so a bare {id, resolved}
  // patch whose original was missing surfaced as a memory with problem=undefined
  // — and would have flowed into recall(), the dashboard, and the injected
  // session-start block.
  const before = store.listAll().length;
  fs.appendFileSync(store.PATHS.log, JSON.stringify({ id: 'ghost-orphan', resolved: true }) + '\n');
  const after = store.listAll();
  assert.equal(after.length, before, 'an orphan patch became a memory');
  assert.ok(!after.some(m => m.id === 'ghost-orphan'));
});

test('a patch cannot resurrect a tombstoned memory', () => {
  const m = store.capture({ problem: 'resurrect probe', approach: 'x', tags: [] });
  store.forget(m.id);
  fs.appendFileSync(store.PATHS.log, JSON.stringify({ id: m.id, resolved: true }) + '\n');
  assert.ok(!store.listAll().some(x => x.id === m.id), 'a deleted memory came back');
});

test('a memory whose id is a prototype key does not break the fold', () => {
  for (const id of ['__proto__', 'constructor', 'toString']) {
    fs.appendFileSync(store.PATHS.log, JSON.stringify({ id, problem: 'proto id ' + id, approach: 'x', tags: [] }) + '\n');
  }
  assert.doesNotThrow(() => store.listAll());
  assert.doesNotThrow(() => store.recall('proto id', { limit: 5 }));
  assert.equal({}.polluted, undefined);
});
