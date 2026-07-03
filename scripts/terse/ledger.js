// scripts/terse/ledger.js
// Output-token savings ledger. Stores one JSONL row per terse-active turn.
// Zero deps. Reads only. Writes append-only.
//
// Row shape:
//   { ts, level, rawEstimate, actual, saved, projectHash?, source }
//
// Path: ~/.kodelythecc/terse/ledger.jsonl (overridable via KODELYTH_TERSE_DIR)

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const DIR = process.env.KODELYTH_TERSE_DIR
  || path.join(os.homedir(), '.kodelythecc', 'terse');
const LEDGER = path.join(DIR, 'ledger.jsonl');

function ensureDir() { fs.mkdirSync(DIR, { recursive: true }); }

// Rough token count: ~4 chars/token English. Not exact — good enough for savings math.
function estimateTokens(text) {
  if (!text) return 0;
  return Math.round(Buffer.byteLength(text, 'utf8') / 4);
}

// Baseline output multiplier per level.
// Empirically: full ≈ 0.5x normal, ultra ≈ 0.35x, lite ≈ 0.75x.
const RAW_MULT = { lite: 1.33, full: 2.0, ultra: 2.85, off: 1.0 };

function appendTurn({ actualText, level = 'full', source = 'unknown', projectHash = null }) {
  ensureDir();
  const actual      = estimateTokens(actualText);
  const rawEstimate = Math.round(actual * (RAW_MULT[level] || 1));
  const saved       = Math.max(0, rawEstimate - actual);
  const row = {
    ts: new Date().toISOString(),
    level,
    rawEstimate,
    actual,
    saved,
    source,
    ...(projectHash ? { projectHash } : {}),
  };
  fs.appendFileSync(LEDGER, JSON.stringify(row) + '\n');
  return row;
}

function readAll() {
  if (!fs.existsSync(LEDGER)) return [];
  return fs.readFileSync(LEDGER, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function summary({ days = 30 } = {}) {
  const rows = readAll();
  if (rows.length === 0) {
    return {
      totalTurns: 0, totalActual: 0, totalSaved: 0, totalRawEstimate: 0,
      avgSavingsPct: 0, daily: [], byLevel: {},
    };
  }
  let totalActual = 0, totalSaved = 0, totalRaw = 0;
  const daily = new Map();
  const byLevel = {};
  const cutoff = Date.now() - days * 24 * 3600 * 1000;

  for (const r of rows) {
    totalActual += r.actual  || 0;
    totalSaved  += r.saved   || 0;
    totalRaw    += r.rawEstimate || 0;

    const ts = new Date(r.ts).getTime();
    if (!isNaN(ts) && ts >= cutoff) {
      const day = r.ts.slice(0, 10);
      const d = daily.get(day) || { date: day, actual: 0, saved: 0, turns: 0 };
      d.actual += r.actual || 0;
      d.saved  += r.saved  || 0;
      d.turns  += 1;
      daily.set(day, d);
    }

    const lv = r.level || 'unknown';
    byLevel[lv] = (byLevel[lv] || 0) + 1;
  }

  return {
    totalTurns: rows.length,
    totalActual,
    totalSaved,
    totalRawEstimate: totalRaw,
    avgSavingsPct: totalRaw ? Math.round((totalSaved / totalRaw) * 100) : 0,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    byLevel,
  };
}

module.exports = { appendTurn, readAll, summary, estimateTokens, LEDGER, DIR };
