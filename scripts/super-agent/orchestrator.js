// scripts/super-agent/orchestrator.js
//
// The super-agent driver — the piece Agent B found missing. It is an Arena-style
// state machine: a PURE nextAction(run) decides what to do next, and the driving
// LLM performs that action (decompose with blueprint, dispatch via the swarm,
// evaluate with the GAN loop, integrate branches, verify) and reports back
// through a submit* function, which advances the run and persists it.
//
//   plan ──decompose──▶ execute ──(all steps done)──▶ integrate ──▶ verify ──▶ done
//                         │
//                         └─ dispatch ready steps (deps satisfied), budget-gated
//
// nextAction never mutates, so the whole control plane is tested without spawning
// a single agent. Mutations + phase transitions live in the submit* recorders.
'use strict';

const dag = require('./dag.js');
const state = require('./state.js');
const { PHASE } = state;

// Rough per-step token estimate for the budget gate. Deliberately conservative;
// real spend is accrued from what the driver reports.
const DEFAULT_STEP_TOKENS = 4000;

function estimateTokens(steps) {
  return (steps.length || 1) * DEFAULT_STEP_TOKENS;
}

function stepBrief(s) {
  return {
    id: s.id,
    description: s.description || '',
    deps: s.deps || [],
    contextBrief: s.contextBrief || s.context || '',
    exitCriteria: s.exitCriteria || s.exit || '',
  };
}

function branchesOf(run) {
  return run.steps
    .filter((s) => s.status === dag.STATUS.DONE && s.branch)
    .map((s) => ({ step: s.id, branch: s.branch }));
}

// ── The state machine (pure) ─────────────────────────────────────────────────
function nextAction(run) {
  if (!run || run.status !== 'running') {
    return { action: 'report', reason: (run && (run.stopReason || run.status)) || 'no run', run: run && state.summarize(run) };
  }

  switch (run.phase) {
    case PHASE.PLAN:
      // No plan yet → ask the driver to decompose the goal into a step DAG.
      return { action: 'decompose', goal: run.goal, scope: run.scope };

    case PHASE.EXECUTE: {
      if (dag.isStalled(run.steps)) {
        return { action: 'halt', reason: 'plan stalled — a dependency failed, so no remaining step can run' };
      }
      const ready = dag.readySteps(run.steps);
      if (ready.length === 0) {
        // Not stalled and nothing ready → steps are in progress; wait for results.
        return { action: 'await', inProgress: run.steps.filter((s) => s.status === dag.STATUS.IN_PROGRESS).map((s) => s.id) };
      }
      const afford = state.canAfford(run, estimateTokens(ready));
      if (!afford.ok) return { action: 'halt', reason: `budget: ${afford.reason}` };
      return { action: 'dispatch', parallel: ready.length > 1, steps: ready.map(stepBrief) };
    }

    case PHASE.INTEGRATE:
      return { action: 'integrate', branches: branchesOf(run), scope: run.scope };

    case PHASE.VERIFY:
      return { action: 'verify', scope: run.scope };

    case PHASE.DONE:
      return { action: 'report', reason: 'done', run: state.summarize(run) };

    default:
      return { action: 'report', reason: `unknown phase: ${run.phase}`, run: state.summarize(run) };
  }
}

// ── Recorders (mutate + advance + persist) ───────────────────────────────────

// The driver decomposed the goal (via blueprint). Install the plan.
function submitPlan(run, rawSteps, { persist = true } = {}) {
  requirePhase(run, PHASE.PLAN);
  const steps = dag.normalizeSteps(rawSteps);
  const v = dag.validate(steps);
  if (!v.ok) throw new Error(`super-agent: invalid plan — ${v.errors.join('; ')}`);
  if (steps.length === 0) throw new Error('super-agent: plan has no steps');
  run.steps = steps;
  run.phase = PHASE.EXECUTE;
  state.record(run, { event: 'planned', steps: steps.length });
  return persist ? state.save(run) : run;
}

// Mark a step as about to run (so nextAction reports it as in-progress, not ready).
function markDispatched(run, stepIds, { persist = true } = {}) {
  const want = new Set((Array.isArray(stepIds) ? stepIds : [stepIds]).map(String));
  for (const s of run.steps) {
    if (want.has(s.id) && s.status === dag.STATUS.PENDING) s.status = dag.STATUS.IN_PROGRESS;
  }
  state.record(run, { event: 'dispatched', steps: [...want] });
  return persist ? state.save(run) : run;
}

// The driver finished a step. Record result + budget, then advance the phase if
// the plan is now complete or stalled.
function submitStepResult(run, stepId, { status = dag.STATUS.DONE, branch = null, result = null, tokensSpent = 0 } = {}, { persist = true } = {}) {
  const s = run.steps.find((x) => x.id === String(stepId));
  if (!s) throw new Error(`super-agent: unknown step ${stepId}`);
  s.status = status;
  if (branch) s.branch = branch;
  if (result != null) s.result = result;
  state.accrue(run, { tokensSpent, steps: 1 });
  state.record(run, { event: 'step', step: s.id, status, tokensSpent });

  if (dag.isComplete(run.steps)) {
    run.phase = PHASE.INTEGRATE;
  } else if (dag.isStalled(run.steps)) {
    state.stop(run, 'plan stalled after a step failed');
  }
  return persist ? state.save(run) : run;
}

// The driver merged the worker branches.
function submitIntegration(run, { merged = true, conflicts = [], tokensSpent = 0 } = {}, { persist = true } = {}) {
  requirePhase(run, PHASE.INTEGRATE);
  state.accrue(run, { tokensSpent });
  if (Array.isArray(conflicts) && conflicts.length > 0) {
    state.record(run, { event: 'integration-conflicts', conflicts });
    state.stop(run, `integration conflicts in: ${conflicts.join(', ')}`);
  } else if (!merged) {
    state.stop(run, 'integration reported not merged');
  } else {
    run.phase = PHASE.VERIFY;
    state.record(run, { event: 'integrated' });
  }
  return persist ? state.save(run) : run;
}

// The driver ran the verification gate (tests/build).
function submitVerification(run, { passed = false, detail = '', tokensSpent = 0 } = {}, { persist = true } = {}) {
  requirePhase(run, PHASE.VERIFY);
  state.accrue(run, { tokensSpent });
  if (passed) {
    run.phase = PHASE.DONE;
    run.status = 'done';
    state.record(run, { event: 'verified', detail });
  } else {
    run.status = 'failed';
    run.stopReason = `verification failed: ${detail || 'tests/build did not pass'}`;
    state.record(run, { event: 'verification-failed', detail });
  }
  return persist ? state.save(run) : run;
}

function requirePhase(run, expected) {
  if (run.phase !== expected) {
    throw new Error(`super-agent: expected phase "${expected}" but run is in "${run.phase}"`);
  }
}

module.exports = {
  nextAction,
  submitPlan,
  markDispatched,
  submitStepResult,
  submitIntegration,
  submitVerification,
  estimateTokens,
  DEFAULT_STEP_TOKENS,
};
