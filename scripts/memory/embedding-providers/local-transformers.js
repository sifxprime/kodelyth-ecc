// scripts/memory/embedding-providers/local-transformers.js
//
// Local, on-device embedding provider. Runs a small sentence-embedding model
// through the OPTIONAL `@xenova/transformers` dependency (WASM/ONNX — no native
// build). After the model is cached once, inference is fully on-device, so the
// "100% local, zero-network" property holds at recall time; only the first-ever
// load fetches the model.
//
// This module is required ONLY when the user has opted into embeddings
// (KODELYTH_MEMORY_EMBEDDINGS=on). If the optional dependency is not installed,
// the require throws and embeddings.getProvider() catches it and falls back to
// BM25 — so a default install never needs this and never loads it.
//
// Not exercised by the CI suite (it needs the heavy optional dependency and a
// model download); the fusion/gating logic it feeds IS covered, via a stub
// provider, in tests/memory/embeddings.test.js.
'use strict';

const MODEL = process.env.KODELYTH_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';

let _pipelinePromise = null;

async function createProvider() {
  // require is inside the function so a missing optional dependency surfaces to
  // the caller (embeddings.getProvider) as a catchable error, not an import-time
  // crash of the memory module.
  const { pipeline } = require('@xenova/transformers');
  if (!_pipelinePromise) {
    _pipelinePromise = pipeline('feature-extraction', MODEL);
  }
  const extractor = await _pipelinePromise;
  return {
    model: MODEL,
    async embed(text) {
      if (!text) return null;
      // Mean-pooled, L2-normalized sentence embedding — the standard recipe for
      // all-MiniLM-style models. output.data is a Float32Array.
      const output = await extractor(String(text), { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    },
  };
}

module.exports = { createProvider, MODEL };
