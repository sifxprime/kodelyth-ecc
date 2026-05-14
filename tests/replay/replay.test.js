// Tests for scripts/replay/replay.js — replay engine.
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const path   = require('path');

const R = require('../../scripts/replay/replay.js');
const B = require('../../scripts/replay/bundle.js');
const O = require('../../scripts/lib/tmux-worktree-orchestrator.js');

const FAKE_BUNDLE = {
  schema: B.BUNDLE_SCHEMA,
  session: 'swarm-2026-05-10-4a',
  exported_at: '2026-05-10T17:00:00Z',
  exported_by: 'kodelyth-ecc@1.7.0',
  meta: {
    task: 'audit oauth flow for security regressions',
    agents: ['security-reviewer', 'code-reviewer'],
    harness: 'echo',
    base_ref: 'HEAD',
  },
  workers: [
    { slug: 'security-reviewer', task: '# task', handoff: '# handoff', status: '# status' },
    { slug: 'code-reviewer',     task: '# task', handoff: '# handoff', status: '# status' },
  ],
};

// ── extractTaskFromBundle ────────────────────────────────────────────────────

test('extractTaskFromBundle: prefers meta.task when present', () => {
  const t = R.extractTaskFromBundle(FAKE_BUNDLE);
  assert.equal(t, 'audit oauth flow for security regressions');
});

test('extractTaskFromBundle: falls back to parsing first worker task.md (Shared Task)', () => {
  const bundle = {
    schema: B.BUNDLE_SCHEMA,
    session: 's',
    workers: [{
      slug: 'a',
      task: '# a — swarm task\n\nblah\n\n## Shared Task\n\nrefactor payments\n\n## Required handoff sections\n1. Summary',
    }],
    meta: {},
  };
  assert.equal(R.extractTaskFromBundle(bundle), 'refactor payments');
});

test('extractTaskFromBundle: falls back to orchestrator Objective block', () => {
  const bundle = {
    schema: B.BUNDLE_SCHEMA,
    session: 's',
    workers: [{
      slug: 'a',
      task: '# Worker Task\n\n## Objective\nfix the bug\n\n## Completion\nDo not spawn',
    }],
    meta: {},
  };
  assert.equal(R.extractTaskFromBundle(bundle), 'fix the bug');
});

test('extractTaskFromBundle: throws if no task can be recovered', () => {
  const bundle = { schema: B.BUNDLE_SCHEMA, session: 's', workers: [], meta: {} };
  assert.throws(() => R.extractTaskFromBundle(bundle), /cannot extract task/);
});

// ── buildReplayPlanConfig ────────────────────────────────────────────────────

test('buildReplayPlanConfig: defaults to bundle.meta values', () => {
  const cfg = R.buildReplayPlanConfig(FAKE_BUNDLE, { repoRoot: process.cwd() });
  assert.equal(cfg._meta.task, 'audit oauth flow for security regressions');
  assert.deepEqual(cfg._meta.pickedAgents, ['security-reviewer', 'code-reviewer']);
  assert.match(cfg.sessionName, /^swarm-2026-05-10-4a-replay-1$/);
  assert.equal(cfg.baseRef, 'HEAD');
});

test('buildReplayPlanConfig: --harness override flows to plan', () => {
  const cfg = R.buildReplayPlanConfig(FAKE_BUNDLE, { repoRoot: process.cwd(), harness: 'echo' });
  // Harness override is preserved in the planConfig._meta.
  assert.equal(cfg._meta.harness, 'echo');
});

test('buildReplayPlanConfig: --agents override replaces bundle.meta.agents', () => {
  const cfg = R.buildReplayPlanConfig(FAKE_BUNDLE, {
    repoRoot: process.cwd(),
    agents: ['supply-chain-auditor', 'prompt-injection-hunter'],
  });
  assert.deepEqual(cfg._meta.pickedAgents, ['supply-chain-auditor', 'prompt-injection-hunter']);
});

test('buildReplayPlanConfig: --base-ref override flows to plan', () => {
  const cfg = R.buildReplayPlanConfig(FAKE_BUNDLE, { repoRoot: process.cwd(), baseRef: 'main' });
  assert.equal(cfg.baseRef, 'main');
});

test('buildReplayPlanConfig: --session override wins over auto-naming', () => {
  const cfg = R.buildReplayPlanConfig(FAKE_BUNDLE, {
    repoRoot: process.cwd(),
    sessionName: 'my-replay',
  });
  assert.equal(cfg.sessionName, 'my-replay');
});

test('buildReplayPlanConfig: takenSessions skips conflicting names', () => {
  const taken = new Set(['swarm-2026-05-10-4a-replay-1', 'swarm-2026-05-10-4a-replay-2']);
  const cfg = R.buildReplayPlanConfig(FAKE_BUNDLE, { repoRoot: process.cwd(), takenSessions: taken });
  assert.equal(cfg.sessionName, 'swarm-2026-05-10-4a-replay-3');
});

test('buildReplayPlanConfig: produces a plan-config the orchestrator accepts', () => {
  const cfg = R.buildReplayPlanConfig(FAKE_BUNDLE, { repoRoot: process.cwd() });
  // Verify orchestrator can build a real plan from it.
  const plan = O.buildOrchestrationPlan(cfg);
  assert.equal(plan.workerPlans.length, 2);
  assert.ok(plan.workerPlans.every(w => w.task.includes('audit oauth flow')));
  assert.match(plan.sessionName, /-replay-/);
});

test('buildReplayPlanConfig: falls back to worker slugs when no meta.agents AND no override', () => {
  const minimalBundle = {
    schema: B.BUNDLE_SCHEMA,
    session: 'minimal',
    workers: [
      { slug: 'a', task: '## Shared Task\n\ndo X\n\n## Required handoff sections\n' },
      { slug: 'b', task: '## Shared Task\n\ndo X\n\n## Required handoff sections\n' },
    ],
    meta: {},
  };
  const cfg = R.buildReplayPlanConfig(minimalBundle, { repoRoot: process.cwd(), harness: 'echo' });
  assert.deepEqual(cfg._meta.pickedAgents, ['a', 'b']);
});
