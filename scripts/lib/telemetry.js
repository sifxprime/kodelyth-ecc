// =============================================================================
// Kodelyth ECC — Telemetry
//
// Append-only, non-blocking event writer. Every dashboard number in v2.0
// traces back to a row here. Zero-dep, sync I/O bounded to a single line.
//
// Event schema:
//   {
//     ts:        ISO-8601 timestamp
//     kind:      short event category (session.start, prompt, tool.use, ...)
//     project:   project root (or null)
//     project_hash: sha256 slice
//     agent:     active agent id when known
//     tool:      tool name when a tool event
//     tokens_in: prompt tokens when known
//     tokens_out: completion tokens when known
//     meta:      free-form object
//   }
// =============================================================================

'use strict';

const fs      = require('fs');
const fabric  = require('./fabric');

function record(kind, meta = {}) {
  try {
    fabric.ensureGlobal();
    const projectRoot = meta.project || meta.cwd || null;
    const event = {
      ts:           new Date().toISOString(),
      kind:         String(kind),
      project:      projectRoot,
      project_hash: projectRoot ? fabric.projectHash(projectRoot) : null,
      agent:        meta.agent || null,
      tool:         meta.tool  || null,
      tokens_in:    Number.isFinite(meta.tokens_in)  ? meta.tokens_in  : null,
      tokens_out:   Number.isFinite(meta.tokens_out) ? meta.tokens_out : null,
      meta:         stripKnown(meta),
    };
    fs.appendFileSync(fabric.GLOBAL.telemetryLog, JSON.stringify(event) + '\n');
    return true;
  } catch {
    // Never throw from telemetry — it must not break the caller.
    return false;
  }
}

function stripKnown(meta) {
  const known = new Set(['project', 'cwd', 'agent', 'tool', 'tokens_in', 'tokens_out']);
  const out = {};
  for (const [k, v] of Object.entries(meta || {})) {
    if (!known.has(k)) out[k] = v;
  }
  return out;
}

// Read events for the dashboard / evolve engine. Newest-first.
function readAll({ limit = 1000, kind = null, since = null } = {}) {
  try {
    if (!fs.existsSync(fabric.GLOBAL.telemetryLog)) return [];
    const raw = fs.readFileSync(fabric.GLOBAL.telemetryLog, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const out = [];
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      let e;
      try { e = JSON.parse(lines[i]); } catch { continue; }
      if (kind && e.kind !== kind) continue;
      if (since && new Date(e.ts) < new Date(since)) break;
      out.push(e);
    }
    return out;
  } catch {
    return [];
  }
}

// Simple counters for the dashboard.
function summary() {
  const events = readAll({ limit: 100_000 });
  const byKind = {};
  const byAgent = {};
  let firstTs = null, lastTs = null;
  for (const e of events) {
    byKind[e.kind] = (byKind[e.kind] || 0) + 1;
    if (e.agent) byAgent[e.agent] = (byAgent[e.agent] || 0) + 1;
    if (!lastTs  || e.ts > lastTs)  lastTs  = e.ts;
    if (!firstTs || e.ts < firstTs) firstTs = e.ts;
  }
  return { total: events.length, byKind, byAgent, firstTs, lastTs };
}

module.exports = { record, readAll, summary };
