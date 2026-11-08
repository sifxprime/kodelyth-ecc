// scripts/memory/embeddings.js
//
// OPTIONAL, OFF BY DEFAULT semantic layer for memory recall. The default recall
// path stays pure BM25 — sync, zero-dependency, zero-network — exactly as
// advertised. This module only does anything when a user opts in
// (KODELYTH_MEMORY_EMBEDDINGS=on) AND a local embedding provider is actually
// available. If either is false, every function here degrades to "no semantics",
// and recall falls back to BM25 unchanged.
//
// The provider is pluggable: the real one (scripts/memory/embedding-providers/
// local-transformers.js) runs a local model via the optional `@xenova/
// transformers` dependency, so inference is on-device. Tests inject a
// deterministic stub instead, so the fusion/gating logic is verified without the
// heavy dependency or a model download.
'use strict';

// Test seam: when set (including to null), overrides provider resolution.
let _providerOverride;
let _hasOverride = false;

function _setProviderForTest(provider) { _providerOverride = provider; _hasOverride = true; }
function _clearProviderForTest() { _providerOverride = undefined; _hasOverride = false; }

// Off unless explicitly enabled. Keeps the default session zero-network/zero-dep.
function isEnabled() {
  const v = String(process.env.KODELYTH_MEMORY_EMBEDDINGS || '').trim().toLowerCase();
  return v === '1' || v === 'on' || v === 'true' || v === 'yes';
}

// Resolve the embedding provider, or null. Null means "no semantics" — a
// disabled flag, a missing optional dependency, or a load failure all collapse
// to the same safe BM25-only behaviour.
async function getProvider() {
  if (_hasOverride) return _providerOverride;
  if (!isEnabled()) return null;
  try {
    const { createProvider } = require('./embedding-providers/local-transformers');
    return await createProvider();
  } catch {
    return null; // optional dep not installed, or model load failed
  }
}

// Cosine similarity of two equal-length numeric vectors. Returns 0 for missing,
// mismatched, or zero-magnitude vectors rather than NaN, so it is always safe to
// sort by.
function cosineSim(a, b) {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Fuse BM25 relevance with semantic similarity and re-rank. Pure function.
//
//   results:  BM25 results, each { id, score, ... }, already relevance-ranked
//   queryVec: the query embedding (or null → returns results unchanged)
//   vecById:  { [id]: vector } for whichever results have a stored embedding
//   weight:   semantic weight in [0,1] (default 0.5). final =
//             weight*semantic + (1-weight)*bm25norm, with BM25 min-max normalized
//             across this result set. A result with no stored vector keeps its
//             BM25-normalized score (semantic contribution 0), so missing
//             embeddings never push a relevant memory down unfairly.
function fuseHybrid(results, { queryVec, vecById = {}, weight = 0.5 } = {}) {
  if (!Array.isArray(results) || results.length === 0) return results || [];
  if (!queryVec) return results;

  const scores = results.map(r => r.score || 0);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min;
  const norm = (s) => (span === 0 ? 1 : (s - min) / span);

  const w = Math.min(1, Math.max(0, weight));
  return results
    .map(r => {
      const vec = vecById[r.id];
      const bm25n = norm(r.score || 0);
      const sem = vec ? Math.max(0, cosineSim(queryVec, vec)) : bm25n;
      const fused = w * sem + (1 - w) * bm25n;
      return { ...r, _bm25norm: bm25n, _semantic: vec ? sem : null, _hybrid: fused };
    })
    .sort((a, b) => b._hybrid - a._hybrid);
}

module.exports = {
  isEnabled,
  getProvider,
  cosineSim,
  fuseHybrid,
  _setProviderForTest,
  _clearProviderForTest,
};
