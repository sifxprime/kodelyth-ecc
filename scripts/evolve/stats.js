// scripts/evolve/stats.js
//
// Phase 3.4 — Self-evolving memory: signal recording.
//
// Two signal streams are tracked, both purely local, zero telemetry:
//
//   1) reuse signals     — memory IDs surfaced by auto-recall, counted
//                          per memory + per session. High counts → the
//                          memory is being repeatedly useful → candidate
//                          for promotion to a skill.
//
//   2) routing misses   — substantive UserPromptSubmit prompts where
//                          memory recall returned NOTHING. Clustered later
//                          by tokens to surface "we keep getting asked
//                          about X but have no agent / skill / memory for it".
//
// Storage layout (default ${HOME}/.kodelythecc/evolve/):
//   reuse.json                  { byMemory: { id: { count, sessions[], lastSurfaced } } }
//   routing-misses.jsonl        append-only — one prompt per line
//
// Override the directory with $KODELYTH_EVOLVE_DIR.
//
// Pure functions — every function takes its dir explicitly. No global state.
// Safe to call from a hook: every public function swallows internal errors
// and returns either a sane default or `false`/`null`. Hooks must never crash.
'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_DIR = process.env.KODELYTH_EVOLVE_DIR
  || path.join(os.homedir(), '.kodelythecc', 'evolve');

const REUSE_FILE = 'reuse.json';
const MISSES_FILE = 'routing-misses.jsonl';

// ── helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch { return false; }
}

function safeReadJson(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return fallback; }
}

function safeWriteJson(p, data) {
  try {
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    return true;
  } catch { return false; }
}

function safeAppendLine(p, line) {
  try {
    fs.appendFileSync(p, line.replace(/\n+$/, '') + '\n');
    return true;
  } catch { return false; }
}

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9_\-/.\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function hashPrompt(prompt) {
  return crypto.createHash('sha256').update(String(prompt)).digest('hex').slice(0, 12);
}

// ── reuse signals ────────────────────────────────────────────────────────────

function emptyReuse() { return { byMemory: {}, lastUpdated: null }; }

function readReuse(dir = DEFAULT_DIR) {
  return safeReadJson(path.join(dir, REUSE_FILE), emptyReuse());
}

/**
 * Record that a memory was surfaced to the user.
 * Idempotent per (memoryId, sessionId): if the same memory has already
 * been counted this session, count is NOT bumped again. This matches the
 * existing auto-recall semantics ("never re-surface the same memory twice
 * in a session").
 *
 * @returns true on success, false on any error (never throws).
 */
function recordSurface({ memoryId, sessionId, projectRoot, timestamp } = {}, dir = DEFAULT_DIR) {
  if (!memoryId) return false;
  if (!ensureDir(dir)) return false;
  const data = readReuse(dir);
  const ts = timestamp || new Date().toISOString();
  const sid = String(sessionId || 'unknown');

  const cur = data.byMemory[memoryId] || {
    count: 0,
    sessions: [],
    projects: [],
    firstSurfaced: ts,
    lastSurfaced: ts,
  };

  if (!cur.sessions.includes(sid)) {
    cur.count += 1;
    cur.sessions.push(sid);
  }
  if (projectRoot && !cur.projects.includes(projectRoot)) {
    cur.projects.push(projectRoot);
  }
  cur.lastSurfaced = ts;

  data.byMemory[memoryId] = cur;
  data.lastUpdated = ts;
  return safeWriteJson(path.join(dir, REUSE_FILE), data);
}

function getReuseStats(dir = DEFAULT_DIR) {
  const data = readReuse(dir);
  const entries = Object.entries(data.byMemory).map(([id, v]) => ({ id, ...v }));
  entries.sort((a, b) => b.count - a.count);
  return {
    total_memories_tracked: entries.length,
    total_surfaces: entries.reduce((s, e) => s + e.count, 0),
    last_updated: data.lastUpdated,
    entries,
  };
}

// ── routing miss signals ─────────────────────────────────────────────────────

function readMisses(dir = DEFAULT_DIR) {
  const p = path.join(dir, MISSES_FILE);
  if (!fs.existsSync(p)) return [];
  try {
    return fs.readFileSync(p, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

/**
 * Record a substantive prompt where memory recall returned nothing.
 * Hook layer decides what counts as "substantive" — this function is dumb
 * persistence. Stores the prompt itself (capped) plus tokens for clustering.
 *
 * @returns true on success, false on any error (never throws).
 */
function recordRoutingMiss({ prompt, sessionId, projectRoot, timestamp } = {}, dir = DEFAULT_DIR) {
  if (!prompt || typeof prompt !== 'string') return false;
  if (!ensureDir(dir)) return false;

  // Cap stored prompt to avoid log bloat from accidental paste of huge files.
  const trimmed = prompt.slice(0, 1000);
  const entry = {
    hash:        hashPrompt(trimmed),
    prompt:      trimmed,
    tokens:      tokenize(trimmed).slice(0, 32),
    session_id:  String(sessionId || 'unknown'),
    project:     projectRoot || null,
    recorded_at: timestamp || new Date().toISOString(),
  };
  return safeAppendLine(path.join(dir, MISSES_FILE), JSON.stringify(entry));
}

function getRoutingMissStats(dir = DEFAULT_DIR) {
  const all = readMisses(dir);
  const byHash = new Map();
  for (const m of all) {
    const cur = byHash.get(m.hash) || { hash: m.hash, count: 0, samples: [], firstSeen: m.recorded_at, lastSeen: m.recorded_at, tokens: m.tokens };
    cur.count += 1;
    if (cur.samples.length < 3) cur.samples.push(m.prompt);
    cur.lastSeen = m.recorded_at;
    byHash.set(m.hash, cur);
  }
  const entries = [...byHash.values()].sort((a, b) => b.count - a.count);
  return {
    total_misses: all.length,
    unique_prompts: entries.length,
    entries,
  };
}

// ── reset (test helper) ──────────────────────────────────────────────────────

function resetAll(dir = DEFAULT_DIR) {
  try {
    if (fs.existsSync(path.join(dir, REUSE_FILE))) fs.unlinkSync(path.join(dir, REUSE_FILE));
    if (fs.existsSync(path.join(dir, MISSES_FILE))) fs.unlinkSync(path.join(dir, MISSES_FILE));
    return true;
  } catch { return false; }
}

module.exports = {
  DEFAULT_DIR,
  REUSE_FILE,
  MISSES_FILE,
  recordSurface,
  readReuse,
  getReuseStats,
  recordRoutingMiss,
  readMisses,
  getRoutingMissStats,
  resetAll,
  // exposed for tests
  _internals: { tokenize, hashPrompt },
};
