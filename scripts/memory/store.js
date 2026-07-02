// =============================================================================
// Kodelyth ECC — Memory Store v2
//
// Pure-JS, zero-dep BM25 memory over an append-only JSONL log.
// Improvements over v1:
//   1. Fabric-based paths (~/.kodelythecc/memory/, legacy ~/.kodelyth read-only).
//   2. Integrity check + auto-heal on every load. If index docCount != log
//      live-count, the index is rebuilt silently.
//   3. Outcome-weighted ranking. Recall score = BM25 × recency-decay
//      × outcome-boost. Failed approaches sink. Newer memories float.
//   4. Every recall and capture emits a telemetry event.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const fabric    = require('../lib/fabric');
const telemetry = require('../lib/telemetry');

// ── Stop words (English + code noise) ────────────────────────────────────────
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','if','then','else','for','to','of','in','on',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','should','can','could','may','might','must','this','that',
  'these','those','it','its','as','at','by','from','with','about','i','you','we',
  'they','he','she','my','your','our','their','use','using','used','set','get',
  'fix','fixed','make','made','want','need','try','tried','run','running',
]);

// Public paths (kept for backward compat with v1 consumers).
const PATHS = {
  get dir()      { return fabric.GLOBAL.memory; },
  get log()      { return fabric.GLOBAL.memoryLog; },
  get index()    { return fabric.GLOBAL.memoryIndex; },
  get patterns() { return fabric.GLOBAL.patterns; },
  get projects() { return path.join(fabric.GLOBAL.memory, 'projects'); },
};

// ── Utilities ────────────────────────────────────────────────────────────────
function tokenise(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9_\-/.\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && t.length <= 40 && !STOP_WORDS.has(t));
}

function newMemoryId() {
  return crypto.randomBytes(8).toString('hex');
}

// ── Index (BM25) ─────────────────────────────────────────────────────────────
function emptyIndex() {
  return { tokens: {}, docCount: 0, avgDocLength: 0, totalLength: 0, version: 2 };
}

function loadIndex() {
  const raw = fabric.readJson(PATHS.index, null);
  if (!raw || typeof raw !== 'object' || !raw.tokens) return emptyIndex();
  return raw;
}

function saveIndex(idx) {
  fabric.ensureGlobal();
  fs.writeFileSync(PATHS.index, JSON.stringify(idx));
}

function indexMemory(idx, m) {
  const text   = `${m.problem || ''} ${m.approach || ''} ${(m.tags || []).join(' ')}`;
  const tokens = tokenise(text);
  const length = tokens.length;
  if (length === 0) return idx;

  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;

  for (const [token, tf] of Object.entries(freq)) {
    if (!idx.tokens[token]) idx.tokens[token] = { docs: [], df: 0 };
    idx.tokens[token].docs.push({ id: m.id, tf, len: length });
    idx.tokens[token].df += 1;
  }

  idx.totalLength += length;
  idx.docCount    += 1;
  idx.avgDocLength = idx.totalLength / idx.docCount;
  return idx;
}

// ── Log I/O (legacy-aware read) ──────────────────────────────────────────────
function readAllLines() {
  return fabric.readLogWithLegacy(PATHS.log, fabric.LEGACY.memoryLog);
}

function readMemories(ids = null) {
  const wantSet = ids ? new Set(ids) : null;
  const lines   = readAllLines();
  const out     = ids ? {} : [];
  for (const line of lines) {
    let m;
    try { m = JSON.parse(line); } catch { continue; }
    if (m.deleted) continue;
    if (wantSet) {
      if (wantSet.has(m.id)) out[m.id] = m;
    } else {
      out.push(m);
    }
  }
  return out;
}

function liveCount() {
  const lines = readAllLines();
  let n = 0;
  for (const line of lines) {
    try { const m = JSON.parse(line); if (!m.deleted) n++; } catch {}
  }
  return n;
}

function appendMemory(memory) {
  fabric.ensureDir(PATHS.dir);
  fs.appendFileSync(PATHS.log, JSON.stringify(memory) + '\n');
}

// ── Integrity check + auto-heal ──────────────────────────────────────────────
// Runs on every recall path. If the index is missing, empty, older schema, or
// drifted from the log, we rebuild it. Silent, non-blocking, always self-heals.
function ensureIndexHealthy() {
  const idx  = loadIndex();
  const live = liveCount();
  const drift = Math.abs((idx.docCount || 0) - live);
  const stale = idx.version !== 2 || drift > 0;
  if (stale) {
    const rebuilt = rebuildIndex();
    telemetry.record('memory.index.rebuild', {
      before_count: idx.docCount || 0,
      after_count:  rebuilt.count,
      drift,
    });
    return { rebuilt: true, drift };
  }
  return { rebuilt: false, drift: 0 };
}

function rebuildIndex() {
  const memories = readMemories();
  let idx = emptyIndex();
  for (const m of memories) idx = indexMemory(idx, m);
  saveIndex(idx);
  return { count: memories.length };
}

// ── BM25 + outcome-weighted ranking ──────────────────────────────────────────
function search(query, options = {}) {
  ensureIndexHealthy();

  const {
    limit         = 5,
    minScore      = 0.5,
    projectFilter = null,
    decayHalfLifeDays = 45,   // recency half-life for the recency boost
  } = options;

  const idx    = loadIndex();
  const tokens = tokenise(query);
  if (tokens.length === 0 || idx.docCount === 0) return [];

  const k1    = 1.5;
  const b     = 0.75;
  const N     = idx.docCount;
  const avgDl = idx.avgDocLength || 1;
  const raw   = {};

  for (const token of tokens) {
    const entry = idx.tokens[token];
    if (!entry) continue;
    const idfN = Math.log(1 + (N - entry.df + 0.5) / (entry.df + 0.5));
    for (const doc of entry.docs) {
      const norm  = 1 - b + b * (doc.len / avgDl);
      const bm25  = idfN * ((doc.tf * (k1 + 1)) / (doc.tf + k1 * norm));
      raw[doc.id] = (raw[doc.id] || 0) + bm25;
    }
  }

  const candIds = Object.keys(raw);
  if (candIds.length === 0) return [];

  const memoriesById = readMemories(candIds);
  const now = Date.now();
  const results = [];
  for (const id of candIds) {
    const m = memoriesById[id];
    if (!m) continue;

    // Recency boost — exp-decay from captured_at
    let recencyBoost = 1.0;
    try {
      const ageMs   = now - new Date(m.captured_at).getTime();
      const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
      recencyBoost  = Math.pow(0.5, ageDays / decayHalfLifeDays); // 1 at 0d, 0.5 at halfLife
      recencyBoost  = 0.5 + 0.5 * recencyBoost; // clamp to [0.5, 1.0]
    } catch {}

    // Outcome boost — resolved=true → up, resolved=false → down.
    let outcomeBoost = 1.0;
    if (m.resolved === true)  outcomeBoost = 1.3;
    if (m.resolved === false) outcomeBoost = 0.6;

    const bm25Score  = raw[id];
    const finalScore = bm25Score * recencyBoost * outcomeBoost;

    if (finalScore < minScore) continue;
    results.push({
      ...m,
      score:        finalScore,
      bm25:         bm25Score,
      recency_boost: recencyBoost,
      outcome_boost: outcomeBoost,
    });
  }

  results.sort((a, b) => b.score - a.score);

  const filtered = projectFilter
    ? results.filter(m => m.project === projectFilter)
    : results;

  return filtered.slice(0, limit);
}

// ── Public API ───────────────────────────────────────────────────────────────
function capture({
  problem,
  approach,
  tags     = [],
  project  = null,
  language = null,
  files    = [],
  gotchas  = [],
  source   = 'manual',
}) {
  if (!problem || !approach) {
    throw new Error('capture requires both `problem` and `approach`');
  }
  const memory = {
    id:          newMemoryId(),
    captured_at: new Date().toISOString(),
    problem:     String(problem).slice(0, 500),
    approach:    String(approach).slice(0, 2000),
    tags:        Array.from(new Set(tags.map(String))).slice(0, 20),
    project:     project ? fabric.projectHash(project) : null,
    project_path: project,
    language,
    files:       files.slice(0, 20),
    gotchas:     gotchas.slice(0, 10),
    source,
  };
  appendMemory(memory);
  const idx = loadIndex();
  saveIndex(indexMemory(idx, memory));

  telemetry.record('memory.capture', {
    memory_id: memory.id,
    source,
    project:   project,
    tag_count: memory.tags.length,
  });

  return memory;
}

function recall(query, options = {}) {
  const results = search(query, options);
  telemetry.record('memory.recall', {
    project:   options.project || null,
    query_len: (query || '').length,
    hits:      results.length,
    top_score: results[0]?.score || 0,
  });
  return results;
}

function recallForProject(projectRoot, query, options = {}) {
  const opts = { ...options, projectFilter: fabric.projectHash(projectRoot) };
  const local = search(query, opts);
  if (local.length >= (options.limit || 5)) {
    telemetry.record('memory.recall.project', {
      project: projectRoot, query_len: (query || '').length, hits: local.length,
    });
    return local;
  }
  // Fill from global if project results are sparse
  const global = search(query, options);
  const seen   = new Set(local.map(r => r.id));
  for (const m of global) {
    if (!seen.has(m.id)) local.push(m);
    if (local.length >= (options.limit || 5)) break;
  }
  telemetry.record('memory.recall.project', {
    project: projectRoot, query_len: (query || '').length, hits: local.length,
  });
  return local;
}

function listAll() { return readMemories(); }

function forget(memoryId) {
  if (!fs.existsSync(PATHS.log)) return false;
  const lines = fs.readFileSync(PATHS.log, 'utf8').split('\n').filter(Boolean);
  let found = false;
  const updated = lines.map(line => {
    try {
      const m = JSON.parse(line);
      if (m.id === memoryId) {
        found = true;
        return JSON.stringify({ ...m, deleted: true, deleted_at: new Date().toISOString() });
      }
      return line;
    } catch { return line; }
  });
  fs.writeFileSync(PATHS.log, updated.join('\n') + '\n');
  if (found) rebuildIndex();
  return found;
}

// ── Outcome tracking (was Improvement C) ─────────────────────────────────────
function resolveMemory(memoryId, resolved) {
  if (!fs.existsSync(PATHS.log)) return false;
  const lines = fs.readFileSync(PATHS.log, 'utf8').split('\n').filter(Boolean);
  let found = false;
  const updated = lines.map(line => {
    try {
      const m = JSON.parse(line);
      if (m.id === memoryId && !m.deleted) {
        found = true;
        return JSON.stringify({ ...m, resolved, resolved_at: new Date().toISOString() });
      }
      return line;
    } catch { return line; }
  });
  if (found) {
    fs.writeFileSync(PATHS.log, updated.join('\n') + '\n');
    telemetry.record('memory.resolve', { memory_id: memoryId, resolved });
  }
  return found;
}

function findMemoriesForFile(filePath, options = {}) {
  const { projectRoot = null, limit = 5 } = options;
  const normFile = path.normalize(filePath);
  const lines    = readAllLines();
  const matches  = [];
  for (const line of lines) {
    let m;
    try { m = JSON.parse(line); } catch { continue; }
    if (m.deleted || m.resolved !== undefined) continue;
    if (!Array.isArray(m.files) || m.files.length === 0) continue;
    if (projectRoot && m.project_path && m.project_path !== projectRoot) continue;
    const hit = m.files.some(f => {
      const normF = path.normalize(String(f));
      return normF === normFile || normFile.endsWith(normF) || normF.endsWith(normFile);
    });
    if (hit) {
      matches.push({
        id: m.id, problem: m.problem, approach: m.approach,
        files: m.files, captured_at: m.captured_at, project_path: m.project_path,
      });
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

function autoResolveOnEdit(filePath, projectRoot = null) {
  const affected = findMemoriesForFile(filePath, { projectRoot });
  if (affected.length === 0) return [];
  const resolved = [];
  for (const m of affected) {
    if (resolveMemory(m.id, false)) resolved.push(m);
  }
  return resolved;
}

function stats() {
  const memories = readMemories();
  const byProject = {}, byLanguage = {}, byTag = {};
  let resolvedTrue = 0, resolvedFalse = 0;
  for (const m of memories) {
    if (m.project) byProject[m.project] = (byProject[m.project] || 0) + 1;
    if (m.language) byLanguage[m.language] = (byLanguage[m.language] || 0) + 1;
    for (const tag of m.tags || []) byTag[tag] = (byTag[tag] || 0) + 1;
    if (m.resolved === true) resolvedTrue++;
    if (m.resolved === false) resolvedFalse++;
  }
  return {
    total: memories.length,
    resolvedTrue, resolvedFalse,
    storageDir: PATHS.dir,
    projects: Object.keys(byProject).length,
    byLanguage,
    topTags: Object.entries(byTag).sort(([, a], [, b]) => b - a).slice(0, 10),
  };
}

module.exports = {
  PATHS,
  capture,
  recall,
  recallForProject,
  listAll,
  forget,
  rebuildIndex,
  ensureIndexHealthy,
  stats,
  tokenise,
  projectHash: fabric.projectHash,
  resolveMemory,
  findMemoriesForFile,
  autoResolveOnEdit,
};
