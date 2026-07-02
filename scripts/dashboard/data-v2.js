// =============================================================================
// Kodelyth ECC — Dashboard v2 Data Layer
//
// Every function in this file returns REAL data from files. If the source
// file is missing or empty, the function returns an honest zero — never a
// placeholder or Math.random.
//
// Sources of truth:
//   savings/ledger.jsonl        → tokens saved
//   telemetry/events.jsonl      → sessions, prompts, routing decisions
//   memory/memories.jsonl       → memory captures
//   instincts/instincts.json    → learning state
//   graph.json (per project)    → codebase graph
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const fabric    = require('../lib/fabric');
const telemetry = require('../lib/telemetry');
const ledger    = require('../token/ledger');
const memory    = require('../memory/store');
const learn     = require('../learn/engine');

// ── Overview panel: catalog + fabric + storage ──────────────────────────────
function overview() {
  fabric.ensureGlobal();
  return {
    version: '2.0',
    generated_at: new Date().toISOString(),
    fabric: {
      global_root:      fabric.GLOBAL.root,
      memory_dir:       fabric.GLOBAL.memory,
      telemetry_log:    fabric.GLOBAL.telemetryLog,
      savings_ledger:   fabric.GLOBAL.savingsLedger,
      instincts_file:   fabric.GLOBAL.instinctsFile,
    },
    files_present: {
      memories:   fs.existsSync(fabric.GLOBAL.memoryLog),
      telemetry:  fs.existsSync(fabric.GLOBAL.telemetryLog),
      savings:    fs.existsSync(fabric.GLOBAL.savingsLedger),
      instincts:  fs.existsSync(fabric.GLOBAL.instinctsFile),
    },
    counts: {
      memories:  countLines(fabric.GLOBAL.memoryLog),
      telemetry: countLines(fabric.GLOBAL.telemetryLog),
      savings:   countLines(fabric.GLOBAL.savingsLedger),
    },
  };
}

// ── Token savings panel — real ledger ───────────────────────────────────────
function savings({ project = null, since = null } = {}) {
  const s = ledger.summary({ project, since });
  return {
    ...s,
    // Add a small honest note if there's no data yet
    empty: s.rows_counted === 0,
    empty_reason: s.rows_counted === 0
      ? 'no savings recorded yet — start using the token proxy (kodelyth-ecc token proxy) or enable context compression'
      : null,
  };
}

// ── Memory panel — real store ───────────────────────────────────────────────
function memoryPanel({ limit = 10 } = {}) {
  const mems = memory.listAll();
  const s = memory.stats();
  const sorted = mems.slice().sort((a, b) => (b.captured_at || '').localeCompare(a.captured_at || ''));
  return {
    ...s,
    empty: s.total === 0,
    recent: sorted.slice(0, limit).map(m => ({
      id: m.id,
      problem: m.problem,
      approach: (m.approach || '').slice(0, 240),
      tags: m.tags || [],
      resolved: m.resolved,
      captured_at: m.captured_at,
      project: m.project_path,
    })),
  };
}

// ── Routing panel — from telemetry ──────────────────────────────────────────
function routingPanel({ limit = 20 } = {}) {
  const events = telemetry.readAll({ limit: 10_000, kind: 'intent.dispatch' });
  const byAgent = {};
  let routed = 0, suggested = 0;
  for (const e of events) {
    const agent = e.meta?.agent || e.agent || 'unknown';
    byAgent[agent] = (byAgent[agent] || 0) + 1;
    if (e.meta?.kind === 'route') routed++;
    if (e.meta?.kind === 'suggest') suggested++;
  }
  return {
    total:  events.length,
    routed, suggested,
    byAgent,
    empty:  events.length === 0,
    recent: events.slice(0, limit).map(e => ({
      ts: e.ts,
      agent: e.meta?.agent || 'unknown',
      confidence: e.meta?.confidence,
      kind: e.meta?.kind,
      prompt_head: e.meta?.prompt_head,
    })),
  };
}

// ── Learning panel — real instincts ─────────────────────────────────────────
function learningPanel() {
  const s = learn.stats();
  const eligible = learn.promotable().slice(0, 10);
  const review   = learn.needsReview().slice(0, 10);
  return {
    ...s,
    eligible_for_promotion: eligible.map(publicInstinct),
    needs_review:            review.map(publicInstinct),
    empty: s.total === 0,
  };
}

function publicInstinct(it) {
  return {
    id: it.id, kind: it.kind, key: it.key,
    confidence: Number(it.confidence.toFixed(3)),
    support: it.support, risk_class: it.risk_class,
    last_seen: it.last_seen, contradictions: it.contradictions,
    promoted: !!it.promoted,
  };
}

// ── Graph panel — per-project ───────────────────────────────────────────────
function graphPanel(projectRoot) {
  const paths = fabric.project(projectRoot);
  if (!fs.existsSync(paths.graph)) {
    return { empty: true, project: projectRoot, path: paths.graph };
  }
  const g = fabric.readJson(paths.graph, null);
  if (!g) return { empty: true, project: projectRoot };
  return {
    project: projectRoot,
    indexed_at: g.indexed_at,
    stats: g.stats,
    kinds: countBy(g.nodes, n => n.kind),
    top_files: topFiles(g.nodes),
    empty: g.nodes.length === 0,
  };
}

function countBy(arr, keyFn) {
  const out = {};
  for (const x of arr) {
    const k = keyFn(x);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function topFiles(nodes) {
  const perFile = {};
  for (const n of nodes) perFile[n.rel] = (perFile[n.rel] || 0) + 1;
  return Object.entries(perFile)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([file, count]) => ({ file, symbol_count: count }));
}

// ── Sessions panel — from telemetry ─────────────────────────────────────────
function sessionsPanel({ limit = 25 } = {}) {
  const events = telemetry.readAll({ limit: 5000, kind: 'session.start' });
  const sessions = events.slice(0, limit).map(e => ({
    ts: e.ts,
    session_id: e.meta?.session_id || null,
    project:    e.project,
  }));
  return {
    total: events.length,
    empty: events.length === 0,
    recent: sessions,
  };
}

// ── Utilities ───────────────────────────────────────────────────────────────
function countLines(file) {
  try {
    if (!fs.existsSync(file)) return 0;
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length;
  } catch { return 0; }
}

module.exports = {
  overview,
  savings,
  memoryPanel,
  routingPanel,
  learningPanel,
  graphPanel,
  sessionsPanel,
};
