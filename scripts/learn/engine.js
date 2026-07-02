// =============================================================================
// Kodelyth ECC — Continuous Learning Engine
//
// The compound learning layer. Every ECC signal (corrections, successful
// captures, routing hits, resolutions) feeds into a per-key instinct with:
//   - confidence   [0..1]     — how sure we are this instinct is right
//   - support      integer    — how many independent events back it
//   - last_seen    ISO date   — for decay
//   - risk_class   'safe' | 'moderate' | 'high' — gates auto-promotion
//
// Storage: ~/.kodelythecc/instincts/instincts.json (versioned, mergeable).
//
// Behaviors:
//   observe(kind, key, meta)  → update or create; boost confidence
//   contradict(kind, key)     → demote confidence
//   decay(now)                → sweep unused instincts, apply half-life
//   promotable()              → list instincts eligible for auto-promotion
//   autoPromote(cb, opts)     → promote safe/moderate high-confidence instincts;
//                               'high' risk_class ALWAYS requires human review
// =============================================================================

'use strict';

const fs = require('fs');
const fabric    = require('../lib/fabric');
const telemetry = require('../lib/telemetry');

const AUTO_PROMOTE_CONFIDENCE = 0.85;
const AUTO_PROMOTE_SUPPORT    = 3;
const DECAY_HALF_LIFE_DAYS    = 30;
const DECAY_FLOOR             = 0.05;
const CONTRADICTION_PENALTY   = 0.4;

// Risk classification derived from key or hint. 'high' never auto-promotes.
const HIGH_RISK_KEYWORDS = [
  'security', 'password', 'secret', 'delete', 'drop', 'sudo',
  'chmod', 'chown', 'rm ', 'force-push', 'ssh', 'api-key', 'token', 'jwt-sign',
];
const MODERATE_RISK_KEYWORDS = [
  'schema', 'migration', 'auth', 'session', 'permission',
  'env-var', 'dockerfile', 'ci-config',
];

function classifyRisk(key, meta = {}) {
  if (meta.risk_class) return meta.risk_class;
  const t = String(key).toLowerCase();
  if (HIGH_RISK_KEYWORDS.some(k => t.includes(k)))     return 'high';
  if (MODERATE_RISK_KEYWORDS.some(k => t.includes(k))) return 'moderate';
  return 'safe';
}

// ── Storage ─────────────────────────────────────────────────────────────────
function load() {
  fabric.ensureGlobal();
  return fabric.readJson(fabric.GLOBAL.instinctsFile, { version: 2, instincts: {} });
}

function save(data) {
  fabric.ensureGlobal();
  fabric.writeJson(fabric.GLOBAL.instinctsFile, data);
}

// ── Core operations ─────────────────────────────────────────────────────────
function observe(kind, key, meta = {}) {
  const data = load();
  const id   = `${kind}::${key}`;
  const now  = new Date().toISOString();

  if (!data.instincts[id]) {
    data.instincts[id] = {
      id,
      kind,
      key,
      confidence: 0.5,
      support:    1,
      first_seen: now,
      last_seen:  now,
      last_boost: now,
      contradictions: 0,
      promoted:   false,
      risk_class: classifyRisk(key, meta),
      meta:       meta.public ? meta.public : {},
    };
  } else {
    const it = data.instincts[id];
    // Positive reinforcement — Bayesian-ish boost, capped at 0.98.
    const gain = (1 - it.confidence) * 0.35;
    it.confidence = Math.min(0.98, it.confidence + gain);
    it.support   += 1;
    it.last_seen  = now;
    it.last_boost = now;
    if (meta.public) it.meta = { ...it.meta, ...meta.public };
  }

  save(data);
  telemetry.record('instinct.observe', { instinct_id: id, confidence: data.instincts[id].confidence });
  return data.instincts[id];
}

function contradict(kind, key) {
  const data = load();
  const id   = `${kind}::${key}`;
  if (!data.instincts[id]) return null;
  const it = data.instincts[id];
  it.confidence = Math.max(0, it.confidence * (1 - CONTRADICTION_PENALTY));
  it.contradictions += 1;
  it.last_seen = new Date().toISOString();
  save(data);
  telemetry.record('instinct.contradict', { instinct_id: id, confidence: it.confidence });
  return it;
}

// Apply exp-decay from last_boost, sweep instincts below floor.
function decay({ now = new Date(), halfLifeDays = DECAY_HALF_LIFE_DAYS } = {}) {
  const data = load();
  const nowMs = new Date(now).getTime();
  const removed = [];
  for (const [id, it] of Object.entries(data.instincts)) {
    if (it.promoted) continue; // promoted instincts don't decay
    const ageMs   = nowMs - new Date(it.last_boost || it.last_seen).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const factor  = Math.pow(0.5, ageDays / halfLifeDays);
    it.confidence = Math.max(0, it.confidence * factor);
    if (it.confidence < DECAY_FLOOR) {
      delete data.instincts[id];
      removed.push(id);
    }
  }
  save(data);
  if (removed.length > 0) telemetry.record('instinct.decay', { removed: removed.length });
  return { swept: removed.length };
}

// List instincts eligible for auto-promotion (safe/moderate, high confidence, high support).
function promotable() {
  const data = load();
  const out = [];
  for (const it of Object.values(data.instincts)) {
    if (it.promoted) continue;
    if (it.risk_class === 'high') continue;
    if (it.confidence < AUTO_PROMOTE_CONFIDENCE) continue;
    if (it.support    < AUTO_PROMOTE_SUPPORT)    continue;
    if (it.contradictions > 1) continue;
    out.push(it);
  }
  return out;
}

// List instincts that would auto-promote if they were not high-risk.
// Surface these for human review via `kodelyth-ecc learn review`.
function needsReview() {
  const data = load();
  const out = [];
  for (const it of Object.values(data.instincts)) {
    if (it.promoted) continue;
    if (it.risk_class !== 'high') continue;
    if (it.confidence < AUTO_PROMOTE_CONFIDENCE) continue;
    if (it.support    < AUTO_PROMOTE_SUPPORT)    continue;
    out.push(it);
  }
  return out;
}

// Perform auto-promotion. Caller supplies a promoter callback that decides
// where the promoted rule goes (memory, lesson, agent-routing, etc.).
function autoPromote(promoter, { limit = 20 } = {}) {
  if (typeof promoter !== 'function') throw new Error('autoPromote requires a promoter fn');
  const data = load();
  const eligible = promotable().slice(0, limit);
  const promoted = [];
  for (const it of eligible) {
    let ok = false;
    try { ok = !!promoter(it); } catch { ok = false; }
    if (ok) {
      data.instincts[it.id].promoted = true;
      data.instincts[it.id].promoted_at = new Date().toISOString();
      promoted.push(it);
      telemetry.record('instinct.promote', {
        instinct_id: it.id, kind: it.kind, risk_class: it.risk_class,
      });
    }
  }
  if (promoted.length > 0) save(data);
  return promoted;
}

// Stats for the dashboard.
function stats() {
  const data = load();
  const all = Object.values(data.instincts);
  const byRisk = {};
  const byKind = {};
  let promoted = 0, atThreshold = 0;
  for (const it of all) {
    byRisk[it.risk_class] = (byRisk[it.risk_class] || 0) + 1;
    byKind[it.kind]       = (byKind[it.kind] || 0) + 1;
    if (it.promoted) promoted++;
    if (it.confidence >= AUTO_PROMOTE_CONFIDENCE && it.support >= AUTO_PROMOTE_SUPPORT) atThreshold++;
  }
  return {
    total: all.length,
    promoted,
    atThreshold,
    byRisk, byKind,
    thresholds: {
      confidence: AUTO_PROMOTE_CONFIDENCE,
      support:    AUTO_PROMOTE_SUPPORT,
      halfLifeDays: DECAY_HALF_LIFE_DAYS,
    },
  };
}

// Testing hook: wipe all instincts.
function reset() { save({ version: 2, instincts: {} }); }

module.exports = {
  observe, contradict, decay,
  promotable, needsReview, autoPromote,
  stats, load, reset, classifyRisk,
  AUTO_PROMOTE_CONFIDENCE, AUTO_PROMOTE_SUPPORT, DECAY_HALF_LIFE_DAYS,
};
