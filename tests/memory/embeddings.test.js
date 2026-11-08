// Tests for the opt-in semantic layer — scripts/memory/embeddings.js and the
// store's hybrid recall. The real on-device provider (@xenova/transformers) is
// NOT exercised here (heavy optional dep + model download); a deterministic stub
// stands in, so the gating, cosine, fusion, and fallback logic are all verified.
//
// The load-bearing guarantee: with embeddings OFF or unavailable, recall behaves
// exactly like BM25 — the default install is untouched.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const emb = require('../../scripts/memory/embeddings');

test('isEnabled is off by default and on only when explicitly set', () => {
  const prev = process.env.KODELYTH_MEMORY_EMBEDDINGS;
  try {
    delete process.env.KODELYTH_MEMORY_EMBEDDINGS;
    assert.equal(emb.isEnabled(), false);
    for (const on of ['1', 'on', 'true', 'yes', 'ON']) {
      process.env.KODELYTH_MEMORY_EMBEDDINGS = on;
      assert.equal(emb.isEnabled(), true, `"${on}" should enable`);
    }
    process.env.KODELYTH_MEMORY_EMBEDDINGS = 'off';
    assert.equal(emb.isEnabled(), false);
  } finally {
    if (prev === undefined) delete process.env.KODELYTH_MEMORY_EMBEDDINGS;
    else process.env.KODELYTH_MEMORY_EMBEDDINGS = prev;
  }
});

test('getProvider returns null when disabled (default) — forces BM25 fallback', async () => {
  const prev = process.env.KODELYTH_MEMORY_EMBEDDINGS;
  delete process.env.KODELYTH_MEMORY_EMBEDDINGS;
  try {
    assert.equal(await emb.getProvider(), null);
  } finally {
    if (prev !== undefined) process.env.KODELYTH_MEMORY_EMBEDDINGS = prev;
  }
});

test('cosineSim: identical=1, orthogonal=0, safe on bad input', () => {
  assert.ok(Math.abs(emb.cosineSim([1, 2, 3], [1, 2, 3]) - 1) < 1e-9);
  assert.equal(emb.cosineSim([1, 0], [0, 1]), 0);
  assert.equal(emb.cosineSim([0, 0], [1, 1]), 0); // zero magnitude
  assert.equal(emb.cosineSim([1, 2], [1, 2, 3]), 0); // mismatched length
  assert.equal(emb.cosineSim(null, [1]), 0);
});

test('fuseHybrid passes results through unchanged when there is no query vector', () => {
  const results = [{ id: 'a', score: 3 }, { id: 'b', score: 1 }];
  assert.equal(emb.fuseHybrid(results, { queryVec: null }), results);
});

test('fuseHybrid promotes a semantically-aligned result over a higher BM25 one', () => {
  const results = [{ id: 'a', score: 5 }, { id: 'b', score: 1 }]; // BM25: a > b
  const queryVec = [0, 1, 1];
  const vecById = { a: [1, 0, 0], b: [1, 1, 1] }; // b aligns with the query, a does not
  const out = emb.fuseHybrid(results, { queryVec, vecById, weight: 0.8 });
  assert.equal(out[0].id, 'b', 'the semantically-aligned result is promoted at high weight');
});

test('fuseHybrid at weight 0 preserves pure BM25 order', () => {
  const results = [{ id: 'a', score: 5 }, { id: 'b', score: 1 }];
  const out = emb.fuseHybrid(results, { queryVec: [1, 0], vecById: { a: [0, 1], b: [1, 0] }, weight: 0 });
  assert.deepEqual(out.map(r => r.id), ['a', 'b']);
});

test('fuseHybrid does not unfairly sink a result that has no stored embedding', () => {
  const results = [{ id: 'a', score: 5 }, { id: 'b', score: 1 }];
  // a has no vector; b does but is orthogonal to the query.
  const out = emb.fuseHybrid(results, { queryVec: [1, 0, 0], vecById: { b: [0, 1, 0] }, weight: 0.5 });
  assert.equal(out[0].id, 'a', 'the higher-BM25 result without a vector keeps its standing');
});

// ── Store integration with a stub provider ───────────────────────────────────

const STUB = { embed: async (text) => {
  // 3-axis keyword embedding — deterministic, no model needed.
  const t = String(text).toLowerCase();
  return [t.includes('cors') ? 1 : 0, t.includes('redis') ? 1 : 0, t.includes('auth') ? 1 : 0];
} };

function freshStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-emb-'));
  process.env.KODELYTH_MEMORY_DIR = dir;
  delete require.cache[require.resolve('../../scripts/memory/store')];
  return { store: require('../../scripts/memory/store'), dir };
}

test('recallHybrid equals BM25 recall when no provider is available', async () => {
  const { store } = freshStore();
  emb._clearProviderForTest(); // ensure disabled
  store.capture({ problem: 'cors preflight failing', approach: 'added OPTIONS handler' });
  const bm25 = store.recall('cors preflight', { limit: 5 }).map(m => m.id);
  const hybrid = (await store.recallHybrid('cors preflight', { limit: 5 })).map(m => m.id);
  assert.deepEqual(hybrid, bm25, 'default path is untouched');
});

test('captureWithEmbedding stores a sidecar vector when a provider is set', async () => {
  const { store, dir } = freshStore();
  emb._setProviderForTest(STUB);
  try {
    const m = await store.captureWithEmbedding({ problem: 'cors preflight', approach: 'OPTIONS handler' });
    const sidecar = path.join(dir, 'embeddings.jsonl');
    assert.ok(fs.existsSync(sidecar), 'embeddings sidecar was written');
    const vecs = store.loadEmbeddings([m.id]);
    assert.deepEqual(vecs[m.id], [1, 0, 0], 'the stored vector matches the stub embedding');
  } finally {
    emb._clearProviderForTest();
  }
});

test('recallHybrid runs the semantic path end-to-end and recalls both candidates', async () => {
  const { store } = freshStore();
  emb._setProviderForTest(STUB);
  try {
    // Both contain "cors" so both are solid BM25 candidates for the query; they
    // differ on a second axis (redis), so their stored embeddings differ.
    const a = await store.captureWithEmbedding({ problem: 'cors redis issue', approach: 'fix' });
    const b = await store.captureWithEmbedding({ problem: 'cors issue', approach: 'fix' });
    // Query embeds to the cors axis ([1,0,0]); b aligns with it exactly. Under
    // full semantic weight the path must run and rank b at or above a.
    const hits = await store.recallHybrid('cors', { limit: 5, semanticWeight: 1 });
    const ids = hits.map(h => h.id);
    assert.ok(ids.includes(a.id) && ids.includes(b.id), 'both recalled');
    assert.ok(ids.indexOf(b.id) <= ids.indexOf(a.id), 'semantic ranking is applied without error');
  } finally {
    emb._clearProviderForTest();
  }
});
