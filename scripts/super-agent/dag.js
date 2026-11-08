// scripts/super-agent/dag.js
//
// Pure dependency-graph model for a super-agent run's plan. No I/O. A step is
//   { id, description, deps: [ids], exitCriteria?, status, ... }
// and this module answers the only questions the orchestrator needs: which steps
// are runnable right now, is the plan finished, and is it stuck. Keeping this
// pure is what makes the whole control plane testable without spawning an agent.
'use strict';

const STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  FAILED: 'failed',
  SKIPPED: 'skipped',
});

// Normalize a raw plan into well-formed steps (stable string ids, deps array,
// a starting status). Ids are coerced to strings so numeric ids from a blueprint
// and string deps compare correctly.
function normalizeSteps(steps) {
  return (Array.isArray(steps) ? steps : []).map((s) => ({
    status: STATUS.PENDING,
    ...s,
    id: String(s && s.id != null ? s.id : ''),
    deps: Array.isArray(s && s.deps) ? s.deps.map(String) : [],
  }));
}

// Validate the plan is a sane DAG: unique non-empty ids, deps that exist, no
// self-dependency, and no cycles. Returns { ok, errors: [] }.
function validate(steps) {
  const errors = [];
  const ids = new Set();
  for (const s of steps) {
    if (!s.id) errors.push('a step has no id');
    else if (ids.has(s.id)) errors.push(`duplicate step id: ${s.id}`);
    else ids.add(s.id);
  }
  for (const s of steps) {
    for (const d of s.deps) {
      if (d === s.id) errors.push(`step ${s.id} depends on itself`);
      else if (!ids.has(d)) errors.push(`step ${s.id} depends on unknown step ${d}`);
    }
  }
  if (errors.length === 0 && hasCycle(steps)) errors.push('the plan has a dependency cycle');
  return { ok: errors.length === 0, errors };
}

// Kahn's algorithm: if we cannot topologically order every step, there is a cycle.
function hasCycle(steps) {
  const indeg = new Map(steps.map((s) => [s.id, 0]));
  const byId = new Map(steps.map((s) => [s.id, s]));
  for (const s of steps) {
    for (const d of s.deps) {
      if (byId.has(d)) indeg.set(s.id, indeg.get(s.id) + 1);
    }
  }
  const queue = [...indeg.entries()].filter(([, n]) => n === 0).map(([id]) => id);
  const dependents = new Map(steps.map((s) => [s.id, []]));
  for (const s of steps) {
    for (const d of s.deps) {
      if (dependents.has(d)) dependents.get(d).push(s.id);
    }
  }
  let visited = 0;
  while (queue.length) {
    const id = queue.shift();
    visited++;
    for (const dep of dependents.get(id) || []) {
      indeg.set(dep, indeg.get(dep) - 1);
      if (indeg.get(dep) === 0) queue.push(dep);
    }
  }
  return visited !== steps.length;
}

// Steps that can run now: still pending, with every dependency DONE (or SKIPPED,
// which counts as satisfied — a skipped step did not fail).
function readySteps(steps) {
  const satisfied = new Set(
    steps.filter((s) => s.status === STATUS.DONE || s.status === STATUS.SKIPPED).map((s) => s.id),
  );
  return steps.filter(
    (s) => s.status === STATUS.PENDING && s.deps.every((d) => satisfied.has(d)),
  );
}

function isComplete(steps) {
  return steps.length > 0 && steps.every((s) => s.status === STATUS.DONE || s.status === STATUS.SKIPPED);
}

// Stuck: there is still work pending, but nothing is runnable and nothing is in
// progress — so a dependency failed (or, if validate() passed, it cannot be a
// cycle). The orchestrator turns this into a halt rather than spinning forever.
function isStalled(steps) {
  const pending = steps.filter((s) => s.status === STATUS.PENDING);
  const running = steps.some((s) => s.status === STATUS.IN_PROGRESS);
  return pending.length > 0 && !running && readySteps(steps).length === 0;
}

function progress(steps) {
  const count = (st) => steps.filter((s) => s.status === st).length;
  return {
    total: steps.length,
    done: count(STATUS.DONE),
    failed: count(STATUS.FAILED),
    inProgress: count(STATUS.IN_PROGRESS),
    pending: count(STATUS.PENDING),
    skipped: count(STATUS.SKIPPED),
  };
}

module.exports = {
  STATUS,
  normalizeSteps,
  validate,
  hasCycle,
  readySteps,
  isComplete,
  isStalled,
  progress,
};
