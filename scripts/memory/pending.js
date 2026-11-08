// scripts/memory/pending.js
//
// The consent-respecting half of auto-capture. The Stop hook
// (hooks/memory/capture-stop.js) already AUTO-EXTRACTS memory candidates from a
// finished session and queues them to pending-review.jsonl — it never stores
// them. But nothing ever read that queue or promoted it, so the candidates piled
// up with no way to confirm them (the `/memory review-pending` the hook points at
// did not exist). This module closes the loop while honouring the memory
// protocol's rule: "never capture without explicit confirmation."
//
//   listPending()      — review what the session proposed
//   promotePending(id) — the confirmation gate: store it (capture() redacts)
//   discardPending(id) — throw it away
//
// Candidates are auto-collected; storing them is one explicit command. Nothing
// enters the recall store silently.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const safeFs = require('../lib/safe-fs.js');
const store = require('./store.js');

function pendingFile() {
  return path.join(store.PATHS.dir, 'pending-review.jsonl');
}

// Stable id from content, so the same proposal queued across several sessions
// folds to one entry and the user can reference it to confirm/discard.
function candidateId(c) {
  return crypto.createHash('sha256')
    .update(`${(c && c.problem) || ''}::${(c && c.approach) || ''}`)
    .digest('hex')
    .slice(0, 8);
}

function readQueue() {
  const f = pendingFile();
  if (!fs.existsSync(f)) return [];
  const out = [];
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line) continue;
    let row; try { row = JSON.parse(line); } catch { continue; }
    if (!row || !row.problem || !row.approach) continue;
    out.push(row);
  }
  return out;
}

function writeQueue(rows) {
  const f = pendingFile();
  if (rows.length === 0) {
    try { fs.unlinkSync(f); } catch { /* already gone */ }
    return;
  }
  safeFs.replaceFilePreservingMode(f, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
}

// Deduped view of the queue, newest first, each with its stable id.
function listPending() {
  const byId = new Map();
  for (const c of readQueue()) {
    const id = candidateId(c);
    const prior = byId.get(id);
    if (!prior || (c.queued_at || '') > (prior.queued_at || '')) {
      byId.set(id, { ...c, id });
    }
  }
  return [...byId.values()].sort((a, b) => (b.queued_at || '').localeCompare(a.queued_at || ''));
}

function countPending() {
  return listPending().length;
}

function selectIds(selector) {
  if (selector === 'all' || selector == null) return new Set(listPending().map(c => c.id));
  const arr = Array.isArray(selector) ? selector : [selector];
  return new Set(arr.map(String));
}

// The confirmation gate. Promotes the selected candidates into the recall store
// via capture() — which redacts secrets — then removes them from the queue.
// Returns the stored memories.
function promotePending(selector = 'all') {
  const ids = selectIds(selector);
  const promotedContentIds = new Set();
  const stored = [];
  for (const c of listPending()) {
    if (!ids.has(c.id)) continue;
    stored.push(store.capture({
      problem:  c.problem,
      approach: c.approach,
      tags:     c.tags || [],
      project:  c.project_path || null,
      language: c.language || null,
      files:    c.files || [],
      source:   'auto-confirmed',
    }));
    promotedContentIds.add(c.id); // c.id === candidateId(c)
  }
  const remaining = readQueue().filter(c => !promotedContentIds.has(candidateId(c)));
  writeQueue(remaining);
  return stored;
}

// Remove candidates from the queue without storing them. Returns the count removed.
function discardPending(selector = 'all') {
  const ids = selectIds(selector);
  const discardContentIds = new Set(listPending().filter(c => ids.has(c.id)).map(c => c.id));
  const before = readQueue();
  const remaining = before.filter(c => !discardContentIds.has(candidateId(c)));
  writeQueue(remaining);
  return before.length - remaining.length;
}

module.exports = {
  pendingFile,
  candidateId,
  listPending,
  countPending,
  promotePending,
  discardPending,
};
