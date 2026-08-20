// scripts/arena/state.js
// Persistent, resumable state for an arena run.
//
// An arena run is expensive (multiple agent crews × multiple rounds), so it must
// survive a crash, a Ctrl-C, or a budget abort without losing the rounds already
// paid for. Every round is appended to a run file under ~/.kodelythecc/arena/.
//
// Also owns the hard stops: max rounds, token budget, wall-clock. These are not
// advisory — the arena aborts cleanly and reports partial results.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { makeRoundVerdict, hasConverged, dedupe } = require('./contract');

const DIR = process.env.KODELYTH_ARENA_DIR
  || path.join(os.homedir(), '.kodelythecc', 'arena');

const DEFAULTS = {
  maxRounds: 3,          // deliberately low — see docs/arena.md on cost
  tokenBudget: 400000,
  wallClockMs: 45 * 60 * 1000,
  quietRoundsRequired: 2,
};

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

function runPath(runId) {
  // runId is generated internally; still refuse traversal in case a caller
  // passes one in from a CLI flag.
  const safe = String(runId).replace(/[^A-Za-z0-9._-]/g, '');
  return path.join(DIR, `${safe}.json`);
}

function newRunId(now = Date.now(), rand = Math.random) {
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffix = Math.floor(rand() * 0xffff).toString(16).padStart(4, '0');
  return `arena-${stamp}-${suffix}`;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

function createRun({ task, limits = {}, runId = null, now = Date.now() } = {}) {
  if (!task || !String(task).trim()) throw new Error('arena: task is required');
  const run = {
    runId: runId || newRunId(now),
    task: String(task).slice(0, 1000),
    startedAt: new Date(now).toISOString(),
    limits: { ...DEFAULTS, ...limits },
    spent: { tokens: 0, rounds: 0, ms: 0 },
    rounds: [],
    seenFindingIds: [],
    status: 'running',          // running | converged | exhausted | aborted
    stopReason: null,
  };
  save(run);
  return run;
}

function save(run) {
  ensureDir();
  fs.writeFileSync(runPath(run.runId), JSON.stringify(run, null, 2));
  return run;
}

function load(runId) {
  const p = runPath(runId);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function listRuns() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
        return {
          runId: r.runId,
          task: r.task,
          status: r.status,
          rounds: r.rounds?.length || 0,
          openRisk: r.rounds?.length ? r.rounds[r.rounds.length - 1].openRisk : 0,
          startedAt: r.startedAt,
        };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

// ── Recording a round ────────────────────────────────────────────────────────

function recordRound(run, { findings = [], artifacts = [], tokensSpent = 0, elapsedMs = 0 } = {}) {
  const roundNo = run.rounds.length + 1;
  const seen = new Set(run.seenFindingIds);
  const deduped = dedupe(findings);
  const newIds = deduped.filter(f => !seen.has(f.id)).map(f => f.id);

  const verdict = makeRoundVerdict({
    round: roundNo,
    findings: deduped,
    newFindingIds: newIds,
    artifacts,
  });

  run.rounds.push(verdict);
  run.seenFindingIds = [...new Set([...run.seenFindingIds, ...deduped.map(f => f.id)])];
  run.spent.rounds = run.rounds.length;
  run.spent.tokens += Math.max(0, Number(tokensSpent) || 0);
  run.spent.ms += Math.max(0, Number(elapsedMs) || 0);

  const stop = shouldStop(run);
  run.status = stop.stop ? stop.status : 'running';
  run.stopReason = stop.stop ? stop.reason : null;

  save(run);
  return verdict;
}

// ── Hard stops + convergence ─────────────────────────────────────────────────

function shouldStop(run) {
  const { limits, spent } = run;

  if (hasConverged(run.rounds, limits.quietRoundsRequired)) {
    return {
      stop: true,
      status: 'converged',
      reason: `no new findings in ${limits.quietRoundsRequired} consecutive rounds — attacker gave up`,
    };
  }
  if (spent.rounds >= limits.maxRounds) {
    return { stop: true, status: 'exhausted', reason: `max rounds reached (${limits.maxRounds})` };
  }
  if (spent.tokens >= limits.tokenBudget) {
    return {
      stop: true,
      status: 'aborted',
      reason: `token budget exhausted (${spent.tokens.toLocaleString()} / ${limits.tokenBudget.toLocaleString()})`,
    };
  }
  if (spent.ms >= limits.wallClockMs) {
    return {
      stop: true,
      status: 'aborted',
      reason: `wall-clock limit reached (${Math.round(spent.ms / 60000)} min)`,
    };
  }
  return { stop: false };
}

// Budget check BEFORE spending on another round, so we never blow past the cap.
function canAffordRound(run, estimatedTokens) {
  const remaining = run.limits.tokenBudget - run.spent.tokens;
  return {
    ok: remaining >= estimatedTokens,
    remaining,
    estimated: estimatedTokens,
  };
}

// ── Summary for reports / dashboard ──────────────────────────────────────────

function summarize(run) {
  const last = run.rounds[run.rounds.length - 1] || null;
  const open = last ? last.findings.filter(f => f.verdict !== 'refuted') : [];
  return {
    runId: run.runId,
    task: run.task,
    status: run.status,
    stopReason: run.stopReason,
    rounds: run.rounds.length,
    tokensSpent: run.spent.tokens,
    openFindings: open.length,
    openRisk: last ? last.openRisk : 0,
    confirmed: open.filter(f => f.verdict === 'confirmed').length,
    // Round-over-round new-finding counts — the curve that should trend to zero.
    trend: run.rounds.map(r => r.counts.new),
    artifacts: run.rounds.reduce((n, r) => n + (r.artifacts?.length || 0), 0),
  };
}

module.exports = {
  DIR, DEFAULTS,
  newRunId, createRun, save, load, listRuns,
  recordRound, shouldStop, canAffordRound, summarize,
};
