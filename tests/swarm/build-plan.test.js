// Tests for scripts/swarm/build-plan.js — pure builder, no tmux/git side effects.
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const path   = require('path');

const B = require('../../scripts/swarm/build-plan');
const O = require('../../scripts/lib/tmux-worktree-orchestrator.js');

// ── pickAgents ───────────────────────────────────────────────────────────────

test('pickAgents: explicit list wins over count + signals', () => {
  const picked = B.pickAgents({
    count: 4,
    task:  'security audit oauth flow',
    explicit: ['code-architect', 'release-captain'],
  });
  assert.deepEqual(picked, ['code-architect', 'release-captain']);
});

test('pickAgents: signal-driven for security task', () => {
  const picked = B.pickAgents({ count: 4, task: 'security audit oauth flow for OWASP top 10' });
  assert.ok(picked.includes('security-reviewer'), `expected security-reviewer in ${picked}`);
});

test('pickAgents: signal-driven for performance task', () => {
  const picked = B.pickAgents({ count: 4, task: 'investigate p99 latency spike on the payments API' });
  assert.ok(picked.includes('performance-optimizer'));
  assert.ok(picked.includes('api-guardian'));
});

test('pickAgents: signal-driven for incident task picks incident-commander + debug-detective', () => {
  const picked = B.pickAgents({ count: 4, task: 'production is down, P0 incident, why is auth service failing' });
  assert.ok(picked.includes('incident-commander'));
  assert.ok(picked.includes('debug-detective'));
});

test('pickAgents: includes baseline anchors when room remains', () => {
  const picked = B.pickAgents({ count: 4, task: 'investigate p99 latency on payments API' });
  // After signals (perf, api), should fill with code-reviewer + pair-programmer.
  assert.ok(picked.includes('code-reviewer') || picked.includes('pair-programmer'));
  assert.equal(picked.length, 4);
});

test('pickAgents: count clamped to upper bound 12 even with many signals', () => {
  // A task with many signals so the picker has plenty of candidates.
  const richTask = 'security audit with perf load-test architecture API tests refactor docs release incident debug database';
  const picked = B.pickAgents({ count: 99, task: richTask });
  assert.ok(picked.length <= 12, `expected ≤12, got ${picked.length}`);
  assert.ok(picked.length > 8,  `expected >8 with rich signals, got ${picked.length}`);
});

test('pickAgents: count clamps to available pool when signals empty', () => {
  // No matching signals + no signal agent rotation past 8 = bounded by pool size.
  const picked = B.pickAgents({ count: 99, task: 'any' });
  assert.ok(picked.length >= 8 && picked.length <= 12);
});

test('pickAgents: count of 1 produces 1 agent', () => {
  assert.equal(B.pickAgents({ count: 1, task: 'any' }).length, 1);
});

test('pickAgents: falsy count falls back to default of 4', () => {
  assert.equal(B.pickAgents({ count: 0,         task: 'any' }).length, 4);
  assert.equal(B.pickAgents({ count: undefined, task: 'any' }).length, 4);
});

test('pickAgents: deduplicates if signal + anchor + rotation overlap', () => {
  const picked = B.pickAgents({ count: 6, task: 'do a code review of payment refactor with security implications' });
  assert.equal(new Set(picked).size, picked.length, 'no duplicate agents');
});

// ── shapeTaskForAgent ────────────────────────────────────────────────────────

test('shapeTaskForAgent: includes agent name + required sections', () => {
  const out = B.shapeTaskForAgent('security-reviewer', 'audit oauth flow');
  assert.match(out, /# security-reviewer — swarm task/);
  assert.match(out, /audit oauth flow/);
  assert.match(out, /## Required handoff sections/);
  assert.match(out, /1\. Summary/);
  assert.match(out, /2\. Files Changed/);
  assert.match(out, /3\. Validation/);
  assert.match(out, /4\. Remaining Risks/);
});

test('shapeTaskForAgent: handles empty task gracefully', () => {
  const out = B.shapeTaskForAgent('code-reviewer', '');
  assert.match(out, /no task description provided/);
});

// ── buildWorker ──────────────────────────────────────────────────────────────

test('buildWorker: claude harness produces a launcher with task placeholder', () => {
  const w = B.buildWorker({ agent: 'security-reviewer', task: 'foo', harness: 'claude' });
  assert.equal(w.name, 'security-reviewer');
  assert.match(w.launcherCommand, /\{task_file_sh\}/);
  assert.match(w.launcherCommand, /claude/);
});

test('buildWorker: codex harness uses orchestrate-codex-worker.sh', () => {
  const w = B.buildWorker({ agent: 'security-reviewer', task: 'foo', harness: 'codex' });
  assert.match(w.launcherCommand, /orchestrate-codex-worker\.sh/);
});

test('buildWorker: unknown harness throws helpful error', () => {
  assert.throws(
    () => B.buildWorker({ agent: 'x', task: 'y', harness: 'bogus' }),
    /No launcher template for harness "bogus"/
  );
});

test('buildWorker: custom launcherCommand overrides harness', () => {
  const w = B.buildWorker({ agent: 'x', task: 'y', harness: 'claude', launcherCommand: 'my-custom {task_file}' });
  assert.equal(w.launcherCommand, 'my-custom {task_file}');
});

// ── buildSwarmPlan (full plan-config) ────────────────────────────────────────

test('buildSwarmPlan: rejects empty task', () => {
  assert.throws(() => B.buildSwarmPlan({ task: '' }), /--task is required/);
  assert.throws(() => B.buildSwarmPlan({}),            /--task is required/);
});

test('buildSwarmPlan: produces a plan-config the orchestrator can consume', () => {
  const planConfig = B.buildSwarmPlan({
    task:    'audit oauth flow for security',
    count:   4,
    harness: 'echo',
    repoRoot: process.cwd(),
  });
  assert.ok(planConfig.workers.length === 4);
  assert.ok(planConfig.sessionName.startsWith('swarm-'));
  assert.ok(planConfig._meta.pickedAgents.includes('security-reviewer'));

  // Verify orchestrator accepts it without throwing.
  const plan = O.buildOrchestrationPlan(planConfig);
  assert.equal(plan.workerPlans.length, 4);
  assert.ok(plan.workerPlans.every(w => w.launchCommand.includes('demo')));
  assert.ok(plan.workerPlans.every(w => w.taskFilePath.includes('.orchestration')));
});

test('buildSwarmPlan: explicit agents preserved in worker order', () => {
  const planConfig = B.buildSwarmPlan({
    task:    'ship v2.0',
    agents:  ['release-captain', 'security-reviewer', 'e2e-runner'],
    harness: 'echo',
  });
  assert.deepEqual(
    planConfig.workers.map(w => w.name),
    ['release-captain', 'security-reviewer', 'e2e-runner']
  );
});

test('buildSwarmPlan: passes through orchestrator-only fields', () => {
  const planConfig = B.buildSwarmPlan({
    task:             'test',
    count:            2,
    harness:          'echo',
    sessionName:      'my-custom-session',
    baseRef:          'main',
    replaceExisting:  true,
    seedPaths:        ['scripts'],
    coordinationRoot: '/tmp/coord',
    worktreeRoot:     '/tmp/worktrees',
  });
  assert.equal(planConfig.sessionName,      'my-custom-session');
  assert.equal(planConfig.baseRef,          'main');
  assert.equal(planConfig.replaceExisting,  true);
  assert.deepEqual(planConfig.seedPaths,    ['scripts']);
  assert.equal(planConfig.coordinationRoot, '/tmp/coord');
  assert.equal(planConfig.worktreeRoot,     '/tmp/worktrees');
});

test('buildSwarmPlan + orchestrator: worker tasks contain agent-shaped prompt', () => {
  const planConfig = B.buildSwarmPlan({
    task:    'audit oauth flow',
    count:   2,
    harness: 'echo',
    agents:  ['security-reviewer', 'code-reviewer'],
  });
  const plan = O.buildOrchestrationPlan(planConfig);
  for (const w of plan.workerPlans) {
    assert.match(w.task, /Required handoff sections/);
    assert.match(w.task, /audit oauth flow/);
    assert.match(w.task, new RegExp(w.workerName));
  }
});
