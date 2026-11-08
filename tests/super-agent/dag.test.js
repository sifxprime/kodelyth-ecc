// Tests for scripts/super-agent/dag.js — the pure dependency-graph model that
// tells the orchestrator which steps can run now, when the plan is finished, and
// when it is stuck. This is the foundation of a testable control plane.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const dag = require('../../scripts/super-agent/dag');
const { STATUS } = dag;

const mk = (over) => dag.normalizeSteps(over);

test('normalizeSteps coerces ids/deps to strings and defaults status', () => {
  const [s] = mk([{ id: 1, deps: [2] }]);
  assert.equal(s.id, '1');
  assert.deepEqual(s.deps, ['2']);
  assert.equal(s.status, STATUS.PENDING);
});

test('readySteps: only pending steps whose deps are all done', () => {
  const steps = mk([
    { id: 'a' },
    { id: 'b', deps: ['a'] },
    { id: 'c', deps: ['a', 'b'] },
  ]);
  assert.deepEqual(dag.readySteps(steps).map((s) => s.id), ['a'], 'only a is ready at first');

  steps.find((s) => s.id === 'a').status = STATUS.DONE;
  assert.deepEqual(dag.readySteps(steps).map((s) => s.id), ['b'], 'b unlocks when a is done');

  steps.find((s) => s.id === 'b').status = STATUS.DONE;
  assert.deepEqual(dag.readySteps(steps).map((s) => s.id), ['c']);
});

test('parallel steps: two independent steps are both ready', () => {
  const steps = mk([{ id: 'a' }, { id: 'root' }, { id: 'b', deps: ['root'] }]);
  steps.find((s) => s.id === 'root').status = STATUS.DONE;
  assert.deepEqual(dag.readySteps(steps).map((s) => s.id).sort(), ['a', 'b']);
});

test('a SKIPPED dependency counts as satisfied; a FAILED one does not', () => {
  const skipped = mk([{ id: 'a' }, { id: 'b', deps: ['a'] }]);
  skipped.find((s) => s.id === 'a').status = STATUS.SKIPPED;
  assert.deepEqual(dag.readySteps(skipped).map((s) => s.id), ['b']);

  const failed = mk([{ id: 'a' }, { id: 'b', deps: ['a'] }]);
  failed.find((s) => s.id === 'a').status = STATUS.FAILED;
  assert.deepEqual(dag.readySteps(failed).map((s) => s.id), [], 'b cannot run behind a failure');
});

test('isComplete / isStalled', () => {
  const steps = mk([{ id: 'a' }, { id: 'b', deps: ['a'] }]);
  assert.equal(dag.isComplete(steps), false);
  assert.equal(dag.isStalled(steps), false, 'a is ready, not stalled');

  steps.find((s) => s.id === 'a').status = STATUS.FAILED;
  assert.equal(dag.isStalled(steps), true, 'b pending behind a failed dep, nothing runnable');
  assert.equal(dag.isComplete(steps), false);

  for (const s of steps) s.status = STATUS.DONE;
  assert.equal(dag.isComplete(steps), true);
});

test('validate catches cycles, unknown deps, self-deps, and duplicate ids', () => {
  assert.equal(dag.validate(mk([{ id: 'a' }, { id: 'b', deps: ['a'] }])).ok, true);

  const cycle = dag.validate(mk([{ id: 'a', deps: ['b'] }, { id: 'b', deps: ['a'] }]));
  assert.equal(cycle.ok, false);
  assert.match(cycle.errors.join(' '), /cycle/);

  assert.match(dag.validate(mk([{ id: 'a', deps: ['zzz'] }])).errors.join(' '), /unknown step zzz/);
  assert.match(dag.validate(mk([{ id: 'a', deps: ['a'] }])).errors.join(' '), /depends on itself/);
  assert.match(dag.validate(mk([{ id: 'a' }, { id: 'a' }])).errors.join(' '), /duplicate/);
});

test('hasCycle on a diamond (no cycle) is false', () => {
  // a → b, a → c, b → d, c → d
  const diamond = mk([
    { id: 'a' },
    { id: 'b', deps: ['a'] },
    { id: 'c', deps: ['a'] },
    { id: 'd', deps: ['b', 'c'] },
  ]);
  assert.equal(dag.hasCycle(diamond), false);
});
