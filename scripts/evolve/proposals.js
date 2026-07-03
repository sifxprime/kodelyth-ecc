// scripts/evolve/proposals.js
//
// Phase 3.4 — Self-evolving memory: proposal log.
//
// Append-only JSONL store of proposals with state transitions:
//   pending   → initial state when written
//   accepted  → user ran `evolve accept <id>`; draft file written to disk
//   rejected  → user ran `evolve reject <id>`
//   applied   → user committed the accepted draft (advisory, set manually)
//
// State changes are append-only (a new line per state event), so the full
// audit trail is preserved. Reads collapse to "latest state per id".
//
// Storage:
//   ${KODELYTH_EVOLVE_DIR:-~/.kodelythecc/evolve}/proposals.jsonl
//
// Pure where possible. Public functions accept dir explicitly.
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const DEFAULT_DIR = process.env.KODELYTH_EVOLVE_DIR
  || path.join(os.homedir(), '.kodelythecc', 'evolve');

const PROPOSALS_FILE = 'proposals.jsonl';

const VALID_STATUSES = new Set(['pending', 'accepted', 'rejected', 'applied']);

function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch { return false; }
}

function readAll(dir = DEFAULT_DIR) {
  const p = path.join(dir, PROPOSALS_FILE);
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
 * Reduce raw event log → latest state per proposal id.
 * Returns an ordered array (insertion order of first event per id).
 */
function readLatest(dir = DEFAULT_DIR) {
  const events = readAll(dir);
  const byId = new Map();
  for (const ev of events) {
    if (!ev.id) continue;
    if (!byId.has(ev.id)) {
      byId.set(ev.id, { ...ev });
    } else {
      const cur = byId.get(ev.id);
      // Merge: keep original proposal/evidence, update mutable fields.
      cur.status = ev.status || cur.status;
      cur.last_updated = ev.timestamp || cur.last_updated;
      cur.applied_path = ev.applied_path || cur.applied_path;
      cur.note = ev.note ?? cur.note;
    }
  }
  return [...byId.values()];
}

function appendEvent(event, dir = DEFAULT_DIR) {
  if (!ensureDir(dir)) return false;
  try {
    fs.appendFileSync(path.join(dir, PROPOSALS_FILE), JSON.stringify(event) + '\n');
    return true;
  } catch { return false; }
}

/**
 * Append a fresh proposal with status=pending. Idempotent on `id`:
 * if a proposal with this id already exists in the log, this is a no-op.
 *
 * @returns the proposal (existing or new)
 */
function appendProposal(proposal, dir = DEFAULT_DIR) {
  if (!proposal || !proposal.id || !proposal.type || !proposal.proposal) {
    throw new Error('appendProposal: proposal must include id, type, and proposal{}');
  }
  const existing = readLatest(dir).find(p => p.id === proposal.id);
  if (existing) return existing;

  const event = {
    ...proposal,
    status: 'pending',
    created_at: new Date().toISOString(),
    timestamp:  new Date().toISOString(),
  };
  appendEvent(event, dir);
  return event;
}

function setStatus(id, status, dir = DEFAULT_DIR, extras = {}) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`setStatus: invalid status "${status}" (expected one of ${[...VALID_STATUSES].join(', ')})`);
  }
  const current = readLatest(dir).find(p => p.id === id);
  if (!current) return null;
  const event = {
    id,
    status,
    timestamp: new Date().toISOString(),
    ...extras,
  };
  appendEvent(event, dir);
  return { ...current, ...event };
}

function listByStatus(status = null, dir = DEFAULT_DIR) {
  const all = readLatest(dir);
  if (!status) return all;
  return all.filter(p => p.status === status);
}

function findById(id, dir = DEFAULT_DIR) {
  return readLatest(dir).find(p => p.id === id) || null;
}

/**
 * Write the proposal's diff to its target_path (relative to repoRoot).
 * Defensive: refuses to overwrite an existing file unless overwrite=true.
 *
 * @returns { written, path } on success
 * @throws on conflict / write failure
 */
function applyProposalToDisk(proposal, { repoRoot, overwrite = false } = {}) {
  if (!proposal?.proposal?.diff || !proposal.proposal.target_path) {
    throw new Error('applyProposalToDisk: proposal lacks diff or target_path');
  }
  if (!repoRoot) throw new Error('applyProposalToDisk: repoRoot is required');
  const abs = path.resolve(repoRoot, proposal.proposal.target_path);
  if (fs.existsSync(abs) && !overwrite) {
    throw new Error(`applyProposalToDisk: refusing to overwrite existing file at ${abs} (pass overwrite=true)`);
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, proposal.proposal.diff);
  return { written: true, path: abs };
}

module.exports = {
  DEFAULT_DIR,
  PROPOSALS_FILE,
  VALID_STATUSES,
  appendProposal,
  setStatus,
  listByStatus,
  findById,
  readAll,
  readLatest,
  applyProposalToDisk,
};
