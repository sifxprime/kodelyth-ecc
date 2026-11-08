// Tests for the super-agent driver — scripts/super-agent/{orchestrator,state}.js.
//
// The whole point of the Arena-style design is that the control plane is a PURE
// state machine: it decides the next action, the driver performs it and reports
// back, and the run persists so it can resume. These tests drive a full run to
// completion without spawning a single agent, and pin dependency ordering, the
// budget governor, stall handling, and resume.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Point run persistence at a throwaway dir BEFORE requiring state.js (it captures
// the dir at load time).
process.env.KODELYTH_SUPER_AGENT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-sa-'));

const state = require('../../scripts/super-agent/state');
const orch = require('../../scripts/super-agent/orchestrator');
const { STATUS } = require('../../scripts/super-agent/dag');

const NO_PERSIST = { persist: false };

test('createRun requires a goal and starts in the plan phase', () => {
  assert.throws(() => state.createRun({}), /needs a goal/);
  const run = state.createRun({ goal: 'ship the thing' });
  assert.equal(run.phase, state.PHASE.PLAN);
  assert.equal(run.status, 'running');
  assert.match(run.id, /^[0-9a-f]{12}$/);
});

test('full run: decompose -> dispatch (in dep order) -> integrate -> verify -> done', () => {
  const run = state.createRun({ goal: 'build feature X' });

  // 1. plan phase → the machine asks to decompose.
  assert.equal(orch.nextAction(run).action, 'decompose');

  // 2. driver returns a DAG: a, then b and c both depend on a.
  orch.submitPlan(run, [
    { id: 'a', description: 'scaffold' },
    { id: 'b', description: 'api', deps: ['a'] },
    { id: 'c', description: 'ui', deps: ['a'] },
  ], NO_PERSIST);
  assert.equal(run.phase, state.PHASE.EXECUTE);

  // 3. only 'a' is ready first.
  let act = orch.nextAction(run);
  assert.equal(act.action, 'dispatch');
  assert.deepEqual(act.steps.map((s) => s.id), ['a']);
  orch.markDispatched(run, ['a'], NO_PERSIST);
  orch.submitStepResult(run, 'a', { status: STATUS.DONE, branch: 'sa/a' }, NO_PERSIST);

  // 4. now b and c are both ready → dispatched in parallel.
  act = orch.nextAction(run);
  assert.equal(act.action, 'dispatch');
  assert.equal(act.parallel, true);
  assert.deepEqual(act.steps.map((s) => s.id).sort(), ['b', 'c']);
  orch.markDispatched(run, ['b', 'c'], NO_PERSIST);
  orch.submitStepResult(run, 'b', { status: STATUS.DONE, branch: 'sa/b' }, NO_PERSIST);
  orch.submitStepResult(run, 'c', { status: STATUS.DONE, branch: 'sa/c' }, NO_PERSIST);

  // 5. all steps done → integrate, with the worker branches.
  act = orch.nextAction(run);
  assert.equal(run.phase, state.PHASE.INTEGRATE);
  assert.equal(act.action, 'integrate');
  assert.deepEqual(act.branches.map((b) => b.branch).sort(), ['sa/a', 'sa/b', 'sa/c']);
  orch.submitIntegration(run, { merged: true, conflicts: [] }, NO_PERSIST);

  // 6. verify → done.
  act = orch.nextAction(run);
  assert.equal(act.action, 'verify');
  orch.submitVerification(run, { passed: true, detail: '693 tests pass' }, NO_PERSIST);
  assert.equal(run.status, 'done');
  assert.equal(orch.nextAction(run).action, 'report');
});

test('budget governor halts dispatch when the token cap would be exceeded', () => {
  const run = state.createRun({ goal: 'x', limits: { tokenCap: 1 } });
  orch.submitPlan(run, [{ id: 'a' }], NO_PERSIST);
  const act = orch.nextAction(run);
  assert.equal(act.action, 'halt');
  assert.match(act.reason, /budget/);
});

test('step cap is enforced too', () => {
  const run = state.createRun({ goal: 'x', limits: { stepCap: 1 } });
  orch.submitPlan(run, [{ id: 'a' }, { id: 'b' }], NO_PERSIST);
  orch.markDispatched(run, ['a'], NO_PERSIST);
  orch.submitStepResult(run, 'a', { status: STATUS.DONE }, NO_PERSIST); // stepsRun → 1
  const act = orch.nextAction(run);
  assert.equal(act.action, 'halt');
  assert.match(act.reason, /step cap/);
});

test('a failed step stalls dependents and stops the run', () => {
  const run = state.createRun({ goal: 'x' });
  orch.submitPlan(run, [{ id: 'a' }, { id: 'b', deps: ['a'] }], NO_PERSIST);
  orch.markDispatched(run, ['a'], NO_PERSIST);
  orch.submitStepResult(run, 'a', { status: STATUS.FAILED }, NO_PERSIST);
  assert.equal(run.status, 'stopped');
  assert.match(run.stopReason, /stalled/);
  assert.equal(orch.nextAction(run).action, 'report');
});

test('integration conflicts stop the run instead of proceeding to verify', () => {
  const run = state.createRun({ goal: 'x' });
  orch.submitPlan(run, [{ id: 'a' }], NO_PERSIST);
  orch.submitStepResult(run, 'a', { status: STATUS.DONE, branch: 'sa/a' }, NO_PERSIST);
  assert.equal(run.phase, state.PHASE.INTEGRATE);
  orch.submitIntegration(run, { merged: false, conflicts: ['src/app.ts'] }, NO_PERSIST);
  assert.equal(run.status, 'stopped');
  assert.match(run.stopReason, /conflicts/);
});

test('verification failure marks the run failed', () => {
  const run = state.createRun({ goal: 'x' });
  orch.submitPlan(run, [{ id: 'a' }], NO_PERSIST);
  orch.submitStepResult(run, 'a', { status: STATUS.DONE }, NO_PERSIST);
  orch.submitIntegration(run, { merged: true }, NO_PERSIST);
  orch.submitVerification(run, { passed: false, detail: '2 tests red' }, NO_PERSIST);
  assert.equal(run.status, 'failed');
  assert.match(run.stopReason, /verification failed/);
});

test('a run persists and resumes with the same next action', () => {
  const run = state.createRun({ goal: 'resumable' });
  orch.submitPlan(run, [{ id: 'a' }, { id: 'b', deps: ['a'] }]); // persists
  orch.markDispatched(run, ['a']);
  orch.submitStepResult(run, 'a', { status: STATUS.DONE, branch: 'sa/a' }); // persists

  // Simulate a fresh process: load the run from disk and continue.
  const resumed = state.load(run.id);
  assert.equal(resumed.phase, state.PHASE.EXECUTE);
  const act = orch.nextAction(resumed);
  assert.equal(act.action, 'dispatch');
  assert.deepEqual(act.steps.map((s) => s.id), ['b'], 'resumes exactly where it left off');

  // And it shows up in list().
  assert.ok(state.list().some((r) => r.id === run.id));
});
