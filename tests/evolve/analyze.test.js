// Tests for scripts/evolve/analyze.js
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');

const A = require('../../scripts/evolve/analyze.js');

const FAKE_MEMORY = {
  id: 'm1',
  problem: 'Tailwind v4 migration breaks arbitrary values',
  approach: 'Regenerate config with @config and update postcss-import order',
  tags: ['css', 'tailwind', 'migration'],
  language: 'typescript',
  source: 'manual',
  captured_at: '2026-04-01T00:00:00Z',
};

// ── thresholds ──────────────────────────────────────────────────────────────

test('exposes default thresholds', () => {
  assert.ok(A.DEFAULT_REUSE_MIN_COUNT >= 1);
  assert.ok(A.DEFAULT_REUSE_MIN_SESSIONS >= 1);
  assert.ok(A.DEFAULT_MISS_MIN_COUNT >= 1);
});

// ── analyzeReuseForProposals ────────────────────────────────────────────────

test('analyzeReuseForProposals: skips when below threshold', () => {
  const reuseStats = {
    entries: [{ id: 'm1', count: 1, sessions: ['s1'], projects: [] }],
  };
  const proposals = A.analyzeReuseForProposals({ reuseStats, memories: [FAKE_MEMORY] });
  assert.equal(proposals.length, 0);
});

test('analyzeReuseForProposals: emits skill-upgrade when count + sessions clear thresholds', () => {
  const reuseStats = {
    entries: [{
      id: 'm1', count: 4,
      sessions: ['s1', 's2', 's3', 's4'],
      projects: ['/p'],
      firstSurfaced: '2026-04-01T...',
      lastSurfaced:  '2026-05-01T...',
    }],
  };
  const proposals = A.analyzeReuseForProposals({ reuseStats, memories: [FAKE_MEMORY] });
  assert.equal(proposals.length, 1);
  const p = proposals[0];
  assert.equal(p.type, 'skill-upgrade');
  assert.equal(p.evidence.memoryId, 'm1');
  assert.equal(p.evidence.reuseCount, 4);
  assert.match(p.proposal.target_path, /^skills\/tailwind-v4-migration/);
  assert.match(p.proposal.diff, /## Problem/);
  assert.match(p.proposal.diff, /Tailwind v4 migration/);
});

test('analyzeReuseForProposals: thresholds are configurable', () => {
  const reuseStats = { entries: [{ id: 'm1', count: 2, sessions: ['s1'], projects: [] }] };
  // Default: needs count>=3 AND sessions>=2 → skip
  assert.equal(A.analyzeReuseForProposals({ reuseStats, memories: [FAKE_MEMORY] }).length, 0);
  // Lower thresholds → emit
  const proposals = A.analyzeReuseForProposals({
    reuseStats, memories: [FAKE_MEMORY],
    thresholds: { minCount: 1, minSessions: 1 },
  });
  assert.equal(proposals.length, 1);
});

test('analyzeReuseForProposals: skips memories not present in store', () => {
  const reuseStats = { entries: [{ id: 'orphan', count: 5, sessions: ['s1', 's2'], projects: [] }] };
  const proposals = A.analyzeReuseForProposals({ reuseStats, memories: [FAKE_MEMORY] });
  assert.equal(proposals.length, 0);
});

test('analyzeReuseForProposals: deterministic ID across runs', () => {
  const reuseStats = { entries: [{ id: 'm1', count: 4, sessions: ['s1', 's2', 's3', 's4'], projects: [] }] };
  const a = A.analyzeReuseForProposals({ reuseStats, memories: [FAKE_MEMORY] })[0];
  const b = A.analyzeReuseForProposals({ reuseStats, memories: [FAKE_MEMORY] })[0];
  assert.equal(a.id, b.id);
  assert.match(a.id, /^skill-[0-9a-f]{10}$/);
});

// ── clusterMisses ───────────────────────────────────────────────────────────

test('clusterMisses: groups by ≥2 token overlap', () => {
  const entries = [
    { tokens: ['feature', 'flag', 'gradual', 'rollout'], count: 2, samples: [], hash: 'a' },
    { tokens: ['feature', 'flag', 'percentage', 'enabled'], count: 1, samples: [], hash: 'b' },
    { tokens: ['unrelated', 'topic', 'completely', 'different'], count: 1, samples: [], hash: 'c' },
  ];
  const clusters = A.clusterMisses(entries);
  assert.equal(clusters.length, 2, 'two distinct clusters');
  assert.equal(clusters[0].count, 3, 'feature/flag cluster aggregated count');
});

test('clusterMisses: single-overlap entries do NOT cluster', () => {
  const entries = [
    { tokens: ['alpha', 'beta', 'gamma', 'delta'], count: 1, samples: [], hash: 'a' },
    { tokens: ['alpha', 'epsilon', 'zeta', 'eta'], count: 1, samples: [], hash: 'b' },
  ];
  const clusters = A.clusterMisses(entries);
  assert.equal(clusters.length, 2);
});

// ── analyzeMissesForProposals ───────────────────────────────────────────────

test('analyzeMissesForProposals: emits routing-addition when cluster exceeds thresholds', () => {
  const missStats = {
    entries: [
      { tokens: ['feature', 'flag', 'gradual'], count: 2, samples: ['feature flag gradual rollout 1'], hash: 'a' },
      { tokens: ['feature', 'flag', 'percent'], count: 1, samples: ['feature flag percent enabled'],   hash: 'b' },
      { tokens: ['feature', 'flag', 'kill'],    count: 1, samples: ['feature flag kill switch'],       hash: 'c' },
    ],
  };
  const proposals = A.analyzeMissesForProposals({ missStats });
  assert.equal(proposals.length, 1);
  const p = proposals[0];
  assert.equal(p.type, 'routing-addition');
  assert.equal(p.proposal.target_path, 'rules/common/agent-intent-routing.md');
  assert.match(p.proposal.diff, /TODO-agent/);
  assert.match(p.proposal.diff, /feature/);
});

test('analyzeMissesForProposals: skips clusters below threshold', () => {
  const missStats = { entries: [{ tokens: ['x', 'y', 'z'], count: 1, samples: [], hash: 'a' }] };
  const proposals = A.analyzeMissesForProposals({ missStats });
  assert.equal(proposals.length, 0);
});

// ── analyzeAll ──────────────────────────────────────────────────────────────

test('analyzeAll: combines reuse + miss proposals', () => {
  const out = A.analyzeAll({
    reuseStats: { entries: [{ id: 'm1', count: 4, sessions: ['s1', 's2', 's3', 's4'], projects: [] }] },
    missStats:  { entries: [
      { tokens: ['database', 'vacuum', 'job'], count: 2, samples: ['database vacuum job 1'], hash: 'a' },
      { tokens: ['database', 'vacuum', 'big'], count: 1, samples: ['database vacuum big table'], hash: 'b' },
      { tokens: ['database', 'vacuum', 'fast'], count: 1, samples: ['database vacuum fast'], hash: 'c' },
    ] },
    memories:   [FAKE_MEMORY],
  });
  const types = out.map(p => p.type).sort();
  assert.deepEqual(types, ['routing-addition', 'skill-upgrade']);
});

test('analyzeAll: empty inputs → empty output', () => {
  assert.deepEqual(
    A.analyzeAll({ reuseStats: { entries: [] }, missStats: { entries: [] }, memories: [] }),
    []
  );
});

// ── slugify edge cases ─────────────────────────────────────────────────────

test('_internals.slugify: empty fallback', () => {
  assert.equal(A._internals.slugify(''), 'untitled');
  assert.equal(A._internals.slugify(null), 'untitled');
  assert.equal(A._internals.slugify(undefined), 'untitled');
});

test('_internals.slugify: caps length', () => {
  const s = A._internals.slugify('a'.repeat(200));
  assert.ok(s.length <= 60);
});

test('_internals.slugify: special chars normalized', () => {
  assert.equal(A._internals.slugify('Hello, World! 2026'), 'hello-world-2026');
});
