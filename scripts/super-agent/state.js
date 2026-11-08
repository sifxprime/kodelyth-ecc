// scripts/super-agent/state.js
//
// Run lifecycle, persistence (so a run resumes after a crash or a new session),
// and the budget governor for the super-agent orchestrator. Mirrors the pattern
// of scripts/arena/state.js: the control plane is tokenless and durable, so the
// expensive part (actually running agents) can stop and pick up again.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const safeFs = require('../lib/safe-fs.js');
const dag = require('./dag.js');

const RUN_DIR = process.env.KODELYTH_SUPER_AGENT_DIR
  || path.join(os.homedir(), '.kodelythecc', 'super-agent');

const PHASE = Object.freeze({
  PLAN: 'plan',
  EXECUTE: 'execute',
  INTEGRATE: 'integrate',
  VERIFY: 'verify',
  DONE: 'done',
});

function runPath(id) {
  return path.join(RUN_DIR, `${id}.json`);
}

function createRun({ goal, limits = {}, scope = '.' } = {}) {
  if (!goal || !String(goal).trim()) throw new Error('super-agent: a run needs a goal');
  return {
    id: crypto.randomBytes(6).toString('hex'),
    goal: String(goal).trim(),
    scope,
    createdAt: new Date().toISOString(),
    status: 'running',           // running | done | failed | stopped
    phase: PHASE.PLAN,
    steps: [],
    budget: {
      // 0 / null means "no cap". Caps are the governor Agent B flagged as missing
      // — a single per-session token-budget could not bound a whole run.
      tokenCap: limits.tokenCap || 0,
      stepCap: limits.stepCap || 0,
      tokensSpent: 0,
      stepsRun: 0,
    },
    history: [],
    stopReason: null,
  };
}

function record(run, event) {
  run.history.push({ at: new Date().toISOString(), ...event });
}

// Budget governor. Returns { ok, reason? }. Checks both the token cap and the
// step cap; an estimate of 0 still fails if we are already over.
function canAfford(run, estTokens = 0) {
  const b = run.budget;
  if (b.stepCap && b.stepsRun >= b.stepCap) {
    return { ok: false, reason: `step cap reached (${b.stepsRun}/${b.stepCap})` };
  }
  if (b.tokenCap && b.tokensSpent + estTokens > b.tokenCap) {
    return { ok: false, reason: `token cap would be exceeded (${b.tokensSpent}+${estTokens} > ${b.tokenCap})` };
  }
  return { ok: true };
}

function accrue(run, { tokensSpent = 0, steps = 0 } = {}) {
  run.budget.tokensSpent += Math.max(0, tokensSpent) || 0;
  run.budget.stepsRun += Math.max(0, steps) || 0;
}

function stop(run, reason) {
  run.status = 'stopped';
  run.stopReason = reason;
  record(run, { event: 'stopped', reason });
}

function save(run) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  // Atomic: a crash mid-write must not corrupt a resumable run.
  safeFs.replaceFileAtomic(runPath(run.id), JSON.stringify(run, null, 2) + '\n', 0o600);
  return run;
}

function load(id) {
  const raw = fs.readFileSync(runPath(id), 'utf8');
  return JSON.parse(raw);
}

function exists(id) {
  return fs.existsSync(runPath(id));
}

function list() {
  if (!fs.existsSync(RUN_DIR)) return [];
  return fs.readdirSync(RUN_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(RUN_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function summarize(run) {
  return {
    id: run.id,
    goal: run.goal,
    status: run.status,
    phase: run.phase,
    progress: dag.progress(run.steps),
    budget: run.budget,
    stopReason: run.stopReason,
  };
}

module.exports = {
  PHASE,
  RUN_DIR,
  runPath,
  createRun,
  record,
  canAfford,
  accrue,
  stop,
  save,
  load,
  exists,
  list,
  summarize,
};
