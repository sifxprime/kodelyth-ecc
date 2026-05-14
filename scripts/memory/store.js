// =============================================================================
// Kodelyth ECC — Memory Store
// Local, zero-dependency, model-agnostic memory for AI coding sessions.
//
// Storage layout (all in ~/.kodelyth/memory/):
//   memories.jsonl       Append-only log of every captured memory
//   index.json           Inverted index: token -> [memory ids]
//   patterns.json        User-level patterns (preferences, conventions)
//   projects/<hash>.json Per-project memory shortcuts
//
// Retrieval: BM25 over tokenised problem + approach + tags. No embeddings,
// no native deps, no network. Pure JS, runs anywhere Node 18+ runs.
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const crypto = require('crypto');

const MEMORY_DIR = process.env.KODELYTH_MEMORY_DIR
  || path.join(os.homedir(), '.kodelyth', 'memory');

const PATHS = {
  dir:       MEMORY_DIR,
  log:       path.join(MEMORY_DIR, 'memories.jsonl'),
  index:     path.join(MEMORY_DIR, 'index.json'),
  patterns:  path.join(MEMORY_DIR, 'patterns.json'),
  projects:  path.join(MEMORY_DIR, 'projects'),
};

// ── Stop words (English + common code noise) ─────────────────────────────────
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','if','then','else','for','to','of','in','on',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','should','can','could','may','might','must','this','that',
  'these','those','it','its','as','at','by','from','with','about','i','you','we',
  'they','he','she','my','your','our','their','use','using','used','set','get',
  'fix','fixed','make','made','want','need','try','tried','run','running',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function tokenise(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9_\-/.\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && t.length <= 40 && !STOP_WORDS.has(t));
}

function projectHash(projectRoot) {
  return crypto
    .createHash('sha256')
    .update(String(projectRoot))
    .digest('hex')
    .slice(0, 12);
}

function newMemoryId() {
  return crypto.randomBytes(8).toString('hex');
}

// ── Index ────────────────────────────────────────────────────────────────────
function loadIndex() {
  if (!fs.existsSync(PATHS.index)) {
    return { tokens: {}, docCount: 0, avgDocLength: 0, totalLength: 0 };
  }
  try {
    return JSON.parse(fs.readFileSync(PATHS.index, 'utf8'));
  } catch {
    return { tokens: {}, docCount: 0, avgDocLength: 0, totalLength: 0 };
  }
}

function saveIndex(index) {
  ensureDir(PATHS.dir);
  fs.writeFileSync(PATHS.index, JSON.stringify(index, null, 2));
}

function indexMemory(index, memory) {
  const text   = `${memory.problem || ''} ${memory.approach || ''} ${(memory.tags || []).join(' ')}`;
  const tokens = tokenise(text);
  const length = tokens.length;
  if (length === 0) return index;

  const tokenFreq = {};
  for (const token of tokens) {
    tokenFreq[token] = (tokenFreq[token] || 0) + 1;
  }

  for (const [token, freq] of Object.entries(tokenFreq)) {
    if (!index.tokens[token]) {
      index.tokens[token] = { docs: [], df: 0 };
    }
    index.tokens[token].docs.push({ id: memory.id, tf: freq, len: length });
    index.tokens[token].df += 1;
  }

  index.totalLength += length;
  index.docCount    += 1;
  index.avgDocLength = index.totalLength / index.docCount;

  return index;
}

// ── BM25 retrieval (k1=1.5, b=0.75) ──────────────────────────────────────────
function search(query, options = {}) {
  const { limit = 5, minScore = 0.5, projectFilter = null } = options;
  const index   = loadIndex();
  const tokens  = tokenise(query);
  if (tokens.length === 0 || index.docCount === 0) return [];

  const k1 = 1.5;
  const b  = 0.75;
  const N  = index.docCount;
  const avgDl = index.avgDocLength || 1;
  const scores = {};

  for (const token of tokens) {
    const entry = index.tokens[token];
    if (!entry) continue;
    const idf = Math.log(1 + (N - entry.df + 0.5) / (entry.df + 0.5));
    for (const doc of entry.docs) {
      const norm  = 1 - b + b * (doc.len / avgDl);
      const score = idf * ((doc.tf * (k1 + 1)) / (doc.tf + k1 * norm));
      scores[doc.id] = (scores[doc.id] || 0) + score;
    }
  }

  const ranked = Object.entries(scores)
    .filter(([, score]) => score >= minScore)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit * 3);

  if (ranked.length === 0) return [];

  const memories = readMemories(ranked.map(([id]) => id));
  let results = ranked
    .map(([id, score]) => {
      const memory = memories[id];
      return memory ? { ...memory, score } : null;
    })
    .filter(Boolean);

  if (projectFilter) {
    results = results.filter(m => m.project === projectFilter);
  }

  return results.slice(0, limit);
}

// ── Memory I/O ───────────────────────────────────────────────────────────────
function readMemories(ids = null) {
  if (!fs.existsSync(PATHS.log)) return ids ? {} : [];
  const wantSet = ids ? new Set(ids) : null;
  const lines = fs.readFileSync(PATHS.log, 'utf8').split('\n').filter(Boolean);
  const out = ids ? {} : [];
  for (const line of lines) {
    let memory;
    try { memory = JSON.parse(line); } catch { continue; }
    if (memory.deleted) continue;
    if (wantSet) {
      if (wantSet.has(memory.id)) out[memory.id] = memory;
    } else {
      out.push(memory);
    }
  }
  return out;
}

function appendMemory(memory) {
  ensureDir(PATHS.dir);
  fs.appendFileSync(PATHS.log, JSON.stringify(memory) + '\n');
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
    project:     project ? projectHash(project) : null,
    project_path: project,
    language,
    files:       files.slice(0, 20),
    gotchas:     gotchas.slice(0, 10),
    source,
  };
  appendMemory(memory);
  const index = loadIndex();
  saveIndex(indexMemory(index, memory));
  return memory;
}

function recall(query, options = {}) {
  return search(query, options);
}

function recallForProject(projectRoot, query, options = {}) {
  const opts = { ...options, projectFilter: projectHash(projectRoot) };
  const results = search(query, opts);
  if (results.length >= (options.limit || 5)) return results;
  // Fall back to global memories if project-specific are sparse
  const globalResults = search(query, options);
  const seen = new Set(results.map(r => r.id));
  for (const m of globalResults) {
    if (!seen.has(m.id)) results.push(m);
    if (results.length >= (options.limit || 5)) break;
  }
  return results;
}

function listAll() {
  return readMemories();
}

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
    } catch {
      return line;
    }
  });
  fs.writeFileSync(PATHS.log, updated.join('\n') + '\n');
  if (found) rebuildIndex();
  return found;
}

// ── Improvement C: outcome tracking ──────────────────────────────────────────
// Mark a memory as resolved:true (success) or resolved:false (failure).
// Called automatically by the PostToolUse hook when an edited file matches
// a memory's files[] list — a follow-up fix implies the previous approach
// didn't fully work, so resolved=false. The user can also call this manually.
//
// Side-effect: also propagates to instincts.js if the instinct module exists,
// so low-confidence instincts sourced from the same session get downgraded.
function resolveMemory(memoryId, resolved) {
  if (!fs.existsSync(PATHS.log)) return false;
  const lines = fs.readFileSync(PATHS.log, 'utf8').split('\n').filter(Boolean);
  let found = false;
  const updated = lines.map(line => {
    try {
      const m = JSON.parse(line);
      if (m.id === memoryId && !m.deleted) {
        found = true;
        return JSON.stringify({
          ...m,
          resolved,
          resolved_at: new Date().toISOString(),
        });
      }
      return line;
    } catch {
      return line;
    }
  });
  if (found) {
    fs.writeFileSync(PATHS.log, updated.join('\n') + '\n');
  }
  return found;
}

// Find unresolved memories whose files[] overlap with the given file path.
// Returns [ { id, problem, files, captured_at } ] — caller decides what to do.
function findMemoriesForFile(filePath, options = {}) {
  const { projectRoot = null, limit = 5 } = options;
  if (!fs.existsSync(PATHS.log)) return [];

  const normFile = path.normalize(filePath);
  const lines    = fs.readFileSync(PATHS.log, 'utf8').split('\n').filter(Boolean);
  const matches  = [];

  for (const line of lines) {
    let m;
    try { m = JSON.parse(line); } catch { continue; }
    if (m.deleted || m.resolved !== undefined) continue; // skip already resolved
    if (!Array.isArray(m.files) || m.files.length === 0) continue;
    if (projectRoot && m.project_path && m.project_path !== projectRoot) continue;

    const hit = m.files.some(f => {
      const normF = path.normalize(String(f));
      return normF === normFile || normFile.endsWith(normF) || normF.endsWith(normFile);
    });

    if (hit) {
      matches.push({
        id:          m.id,
        problem:     m.problem,
        approach:    m.approach,
        files:       m.files,
        captured_at: m.captured_at,
        project_path: m.project_path,
      });
      if (matches.length >= limit) break;
    }
  }

  return matches;
}

// Auto-resolve hook: called by PostToolUse (Write|Edit) with the file just edited.
// Marks any unresolved memory that listed this file as resolved:false, then
// nudges the instinct schema to downgrade the matching instinct's confidence.
function autoResolveOnEdit(filePath, projectRoot = null) {
  const affected = findMemoriesForFile(filePath, { projectRoot });
  if (affected.length === 0) return [];

  const resolved = [];
  for (const m of affected) {
    const ok = resolveMemory(m.id, false);
    if (ok) resolved.push(m);
  }

  // Propagate to instinct schema — best-effort only
  try {
    const instinctsPath = path.join(__dirname, 'instincts.js');
    if (fs.existsSync(instinctsPath)) {
      const instincts = require(instinctsPath);
      for (const m of resolved) {
        // Match by project_path + approximate problem text
        instincts.recordOutcomeByProject(m.project_path, m.problem, false);
      }
    }
  } catch { /* never block */ }

  return resolved;
}

function rebuildIndex() {
  const memories = readMemories();
  let index = { tokens: {}, docCount: 0, avgDocLength: 0, totalLength: 0 };
  for (const m of memories) {
    index = indexMemory(index, m);
  }
  saveIndex(index);
  return { count: memories.length };
}

function stats() {
  const memories = readMemories();
  const byProject = {};
  const byLanguage = {};
  const byTag = {};
  for (const m of memories) {
    if (m.project) byProject[m.project] = (byProject[m.project] || 0) + 1;
    if (m.language) byLanguage[m.language] = (byLanguage[m.language] || 0) + 1;
    for (const tag of m.tags || []) byTag[tag] = (byTag[tag] || 0) + 1;
  }
  return {
    total: memories.length,
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
  stats,
  tokenise,
  projectHash,
  // Improvement C
  resolveMemory,
  findMemoriesForFile,
  autoResolveOnEdit,
};
