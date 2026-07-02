// =============================================================================
// Kodelyth ECC — Token Savings Ledger
//
// Append-only log of every measured token saving. Every row is proof.
// If the ledger stops growing, the savings panel on the dashboard stops
// counting — no fabricated numbers.
//
// Row schema:
//   {
//     ts:      ISO-8601 timestamp
//     source:  'proxy' | 'compress' | 'cache'
//     project: project root when known
//     command: string (proxy only) or context label
//     raw:     tokens before
//     lean:    tokens after
//     saved:   raw - lean
//     ratio:   saved / raw
//     meta:    free-form context
//   }
// =============================================================================

'use strict';

const fs      = require('fs');
const fabric  = require('../lib/fabric');
const telemetry = require('../lib/telemetry');

function append(row) {
  try {
    fabric.ensureGlobal();
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      source:  String(row.source || 'unknown'),
      project: row.project || null,
      command: row.command || null,
      raw:     Number(row.raw) || 0,
      lean:    Number(row.lean) || 0,
      saved:   Number(row.saved) || 0,
      ratio:   Number(row.ratio) || 0,
      meta:    row.meta || {},
    });
    fs.appendFileSync(fabric.GLOBAL.savingsLedger, line + '\n');
    telemetry.record('token.saved', {
      project: row.project || null,
      source:  row.source,
      saved:   row.saved,
      ratio:   row.ratio,
    });
    return true;
  } catch { return false; }
}

function readAll({ limit = 5000, since = null, source = null } = {}) {
  try {
    if (!fs.existsSync(fabric.GLOBAL.savingsLedger)) return [];
    const raw = fs.readFileSync(fabric.GLOBAL.savingsLedger, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const out = [];
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      let e;
      try { e = JSON.parse(lines[i]); } catch { continue; }
      if (source && e.source !== source) continue;
      if (since && new Date(e.ts) < new Date(since)) break;
      out.push(e);
    }
    return out;
  } catch { return []; }
}

// Aggregate savings for the dashboard.
function summary({ project = null, since = null } = {}) {
  const rows = readAll({ limit: 100_000, since });
  let filtered = rows;
  if (project) filtered = filtered.filter(r => r.project === project);
  let saved = 0, raw = 0, lean = 0;
  const bySource = {};
  const byDay = {};
  for (const r of filtered) {
    saved += r.saved; raw += r.raw; lean += r.lean;
    bySource[r.source] = (bySource[r.source] || 0) + r.saved;
    const day = r.ts.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + r.saved;
  }
  const ratio = raw > 0 ? saved / raw : 0;
  return {
    rows_counted: filtered.length,
    total_raw:    raw,
    total_lean:   lean,
    total_saved:  saved,
    ratio,
    bySource,
    byDay,
    ledger_path:  fabric.GLOBAL.savingsLedger,
    ledger_exists: fs.existsSync(fabric.GLOBAL.savingsLedger),
    last_ts:      filtered[0]?.ts || null,
  };
}

module.exports = { append, readAll, summary };
