// =============================================================================
// Kodelyth ECC — Memory Store
// Local, zero-dependency, model-agnostic memory for AI coding sessions.
//
// Storage layout (all in ~/.kodelythecc/memory/):
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
const safeFs = require('../lib/safe-fs.js');

// Auto-migrate legacy ~/.kodelyth/ → ~/.kodelythecc/ before we touch any path.
try { require('../migrate-legacy').main(); } catch { /* best-effort */ }

const MEMORY_DIR = process.env.KODELYTH_MEMORY_DIR
  || path.join(os.homedir(), '.kodelythecc', 'memory');

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

// Any map keyed by user text MUST have a null prototype.
//
// With a normal object, `map['constructor']` returns Object.prototype's
// constructor — which is TRUTHY — so a `if (!map[key])` guard silently does not
// fire, and the code then reads `.docs` off a function and throws. The word
// "constructor" is ordinary programming vocabulary, so capturing a memory that
// merely mentions it used to break indexing AND poison recall() for good. Same
// for toString, valueOf, hasOwnProperty, __proto__, isPrototypeOf.
function nullMap(source) {
  const m = Object.create(null);
  if (source) for (const k of Object.keys(source)) m[k] = source[k];
  return m;
}

function emptyIndex() {
  return { tokens: nullMap(), docCount: 0, avgDocLength: 0, totalLength: 0 };
}

// A valid index for the current schema MUST have a `tokens` object and a
// numeric `docCount`. Older/foreign schemas (e.g. `{index, documents, docFreq}`
// from a prior BM25 implementation) are unrecognised — we rebuild from the
// append-only memories.jsonl rather than crash on `index.tokens[token]`.
function isValidIndexSchema(idx) {
  return !!idx
    && typeof idx === 'object'
    && idx.tokens && typeof idx.tokens === 'object'
    && typeof idx.docCount === 'number';
}

function loadIndex() {
  if (!fs.existsSync(PATHS.index)) {
    return rebuildIndex();
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(PATHS.index, 'utf8'));
  } catch {
    return rebuildIndex();
  }
  // JSON.parse always produces objects with Object.prototype, so an index read
  // back from disk carries the hazard again. Rebuild the token map without one.
  if (isValidIndexSchema(parsed)) parsed.tokens = nullMap(parsed.tokens);

  // Self-heal every way the two files can drift apart — a lost update from
  // concurrent captures, a failed index write (EACCES/ENOSPC), a hand-edited
  // log. Without this a memory could sit in the log and be invisible to
  // recall() forever, which for a recall-driven store is indistinguishable
  // from having lost it.
  if (isValidIndexSchema(parsed) && parsed.logSize !== logSize()) {
    return rebuildIndex();
  }

  if (!isValidIndexSchema(parsed)) {
    // Stale or foreign schema on disk — rebuild from the source of truth
    // (the canonical rebuildIndex defined below rebuilds AND persists a valid index).
    return rebuildIndex();
  }
  return parsed;
}

// Stamp the log size this index was built from. The index is DERIVED state, so
// the cheapest correct thing is to notice when it no longer matches its source
// and rebuild — rather than trying to keep two files transactionally in sync.
function logSize() {
  try { return fs.statSync(PATHS.log).size; } catch { return 0; }
}

function saveIndex(index) {
  ensureDir(PATHS.dir);
  safeFs.replaceFilePreservingMode(PATHS.index, JSON.stringify({ ...index, logSize: logSize() }, null, 2));
}

// A patch row does not change any searchable text, so the index stays valid —
// it just needs to learn the log's new size or the staleness check would force
// a needless rebuild on the next read.
function restampIndex() {
  try {
    if (!fs.existsSync(PATHS.index)) return;
    const idx = JSON.parse(fs.readFileSync(PATHS.index, 'utf8'));
    idx.logSize = logSize();
    safeFs.replaceFilePreservingMode(PATHS.index, JSON.stringify(idx, null, 2));
  } catch { /* a broken index is rebuilt on the next load anyway */ }
}

function indexMemory(index, memory) {
  const text   = `${memory.problem || ''} ${memory.approach || ''} ${(memory.tags || []).join(' ')}`;
  const tokens = tokenise(text);
  const length = tokens.length;
  if (length === 0) return index;

  const tokenFreq = nullMap();
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
  const scores = nullMap();

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
// The log is append-only, so a memory may appear more than once: the original
// row, then PATCH rows appended by forget()/resolveMemory(). Fold by id with
// last-write-wins, then drop anything a patch marked deleted.
//
// This is what lets mutation be an append instead of a full-file rewrite. The
// rewrite was the bug: fs.writeFileSync opens with 'w', truncating to zero
// before writing, and a 6.3 MB store takes several syscalls to write back. A
// concurrent reader was measured observing the store at 0 bytes mid-write, and
// any reader doing its own read-modify-write would then persist that emptiness.
function readMemories(ids = null) {
  if (!fs.existsSync(PATHS.log)) return ids ? {} : [];
  const wantSet = ids ? new Set(ids) : null;
  const lines = fs.readFileSync(PATHS.log, 'utf8').split('\n').filter(Boolean);

  const folded = new Map();   // preserves first-seen order
  for (const line of lines) {
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (!row || !row.id) continue;
    if (wantSet && !wantSet.has(row.id)) continue;
    const prior = folded.get(row.id);
    if (prior) { folded.set(row.id, { ...prior, ...row }); continue; }
    // No prior row means this is an orphan patch — a tombstone or a {resolved}
    // marker whose original is missing (a hand-edited or truncated log). It is
    // not a memory: promoting it would surface a phantom with problem=undefined
    // into recall(), the dashboard, and the injected memory block.
    if (row.problem === undefined) continue;
    folded.set(row.id, row);
  }

  const live = [...folded.values()].filter(m => !m.deleted);
  if (!ids) return live;
  const out = {};
  for (const m of live) out[m.id] = m;
  return out;
}

// Append a patch row for an existing memory. Returns false when the id is
// unknown, so callers keep their found/not-found contract.
function appendPatch(memoryId, patch) {
  if (!fs.existsSync(PATHS.log)) return false;
  const existing = readMemories([memoryId])[memoryId];
  if (!existing) return false;
  ensureDir(PATHS.dir);
  fs.appendFileSync(PATHS.log, JSON.stringify({ id: memoryId, ...patch }) + '\n');
  return true;
}

// If a previous append was interrupted (crash, SIGKILL, ENOSPC) the log ends
// mid-row with no terminator. Appending straight onto that fragment fuses two
// records into one unparseable line, so readMemories drops BOTH — and capture()
// still returns an id, telling the caller a memory was saved that does not
// exist. A leading newline quarantines the fragment on its own line, where the
// existing JSON.parse skip handles it correctly.
function endsWithNewline() {
  try {
    const { size } = fs.statSync(PATHS.log);
    if (size === 0) return true;
    const fd = fs.openSync(PATHS.log, 'r');
    try {
      const buf = Buffer.alloc(1);
      fs.readSync(fd, buf, 0, 1, size - 1);
      return buf[0] === 0x0a;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return true;   // no file yet
  }
}

function appendMemory(memory) {
  ensureDir(PATHS.dir);
  const prefix = endsWithNewline() ? '' : '\n';
  fs.appendFileSync(PATHS.log, prefix + JSON.stringify(memory) + '\n');
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
    // The COUNT was capped but not the length of each tag, so a single
    // multi-megabyte tag was stored whole — bloating the log, the index, and
    // the memory block injected at session start. Bound both.
    tags:        Array.from(new Set(tags.map(t => String(t).slice(0, 60)))).slice(0, 20),
    project:     project ? projectHash(project) : null,
    project_path: project,
    language,
    files:       files.slice(0, 20).map(f => String(f).slice(0, 500)),
    gotchas:     gotchas.slice(0, 10).map(g => String(g).slice(0, 500)),
    source,
  };
  // Load the index BEFORE writing the row. If index.json is missing or invalid,
  // loadIndex() falls through to rebuildIndex(), which re-reads the log — and if
  // the new row were already there, it would be indexed once by the rebuild and
  // again by indexMemory() below. That inflated docCount permanently and gave the
  // doubled document exactly 2x its true BM25 score, on every cold start.
  const index = loadIndex();
  appendMemory(memory);
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
  const found = appendPatch(memoryId, { deleted: true, deleted_at: new Date().toISOString() });
  // Only rebuild when something actually changed. The old code rewrote the whole
  // store even when the id was not found, paying the full destruction window for
  // a no-op delete.
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
  const found = appendPatch(memoryId, { resolved, resolved_at: new Date().toISOString() });
  // This hook fires on every Edit/Write, so a full rebuild here would be costly
  // on a large store. The patch adds no searchable text, so restamping is enough.
  if (found) restampIndex();
  return found;
}

// Find unresolved memories whose files[] overlap with the given file path.
// Returns [ { id, problem, files, captured_at } ] — caller decides what to do.
function findMemoriesForFile(filePath, options = {}) {
  const { projectRoot = null, limit = 5 } = options;
  if (!fs.existsSync(PATHS.log)) return [];

  const normFile = path.normalize(filePath);
  // Go through readMemories so patch rows are folded in. Reading the log
  // line-by-line here meant an appended `{resolved}` patch was never applied to
  // its original row, so a resolved memory kept being returned.
  const matches  = [];

  for (const m of readMemories()) {
    if (m.resolved !== undefined) continue; // skip already resolved
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

// Rebuild the inverted index from memories.jsonl, persist it, and RETURN the
// index object (with a `count` property for callers that want the memory total).
// Returning the index lets loadIndex() self-heal a stale/foreign on-disk schema
// in a single pass instead of returning a bare {count} that breaks search().
function rebuildIndex() {
  const memories = readMemories();
  let index = emptyIndex();
  for (const m of memories) {
    if (m && m.id) index = indexMemory(index, m);
  }
  try { saveIndex(index); } catch { /* read-only fs — keep in-memory index */ }
  index.count = memories.length;
  return index;
}

function stats() {
  const memories = readMemories();
  const byProject = nullMap();
  const byLanguage = nullMap();
  const byTag = nullMap();
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
