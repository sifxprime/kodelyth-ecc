// Tests for scripts/evolve/stats.js
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');

const stats = require('../../scripts/evolve/stats.js');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-evolve-stats-')); }
function cleanup(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* */ } }

// ── recordSurface ────────────────────────────────────────────────────────────

test('recordSurface: rejects missing memoryId', () => {
  const d = tmpDir();
  try {
    assert.equal(stats.recordSurface({ sessionId: 's1' }, d), false);
  } finally { cleanup(d); }
});

test('recordSurface: bumps count on first session, idempotent within same session', () => {
  const d = tmpDir();
  try {
    assert.equal(stats.recordSurface({ memoryId: 'm1', sessionId: 's1', projectRoot: '/proj' }, d), true);
    assert.equal(stats.recordSurface({ memoryId: 'm1', sessionId: 's1', projectRoot: '/proj' }, d), true);
    assert.equal(stats.recordSurface({ memoryId: 'm1', sessionId: 's1', projectRoot: '/proj' }, d), true);

    const r = stats.getReuseStats(d);
    assert.equal(r.total_memories_tracked, 1);
    assert.equal(r.total_surfaces, 1, 'same session should only count once');
    assert.equal(r.entries[0].count, 1);
    assert.deepEqual(r.entries[0].sessions, ['s1']);
    assert.deepEqual(r.entries[0].projects, ['/proj']);
  } finally { cleanup(d); }
});

test('recordSurface: bumps count on each new session', () => {
  const d = tmpDir();
  try {
    for (let i = 0; i < 4; i++) {
      stats.recordSurface({ memoryId: 'm1', sessionId: `s${i}` }, d);
    }
    const r = stats.getReuseStats(d);
    assert.equal(r.entries[0].count, 4);
    assert.equal(r.entries[0].sessions.length, 4);
  } finally { cleanup(d); }
});

test('recordSurface: tracks distinct projects without duplicating', () => {
  const d = tmpDir();
  try {
    stats.recordSurface({ memoryId: 'm1', sessionId: 's1', projectRoot: '/a' }, d);
    stats.recordSurface({ memoryId: 'm1', sessionId: 's2', projectRoot: '/a' }, d);
    stats.recordSurface({ memoryId: 'm1', sessionId: 's3', projectRoot: '/b' }, d);
    const r = stats.getReuseStats(d);
    assert.deepEqual(r.entries[0].projects, ['/a', '/b']);
  } finally { cleanup(d); }
});

test('recordSurface: never throws on bad dir; returns false', () => {
  // Create a file then pass a subpath of it as the dir — fails on all platforms
  // because mkdirSync can't create a directory where a file already exists.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-stats-bad-'));
  const fileAsDir = path.join(tmp, 'not-a-dir');
  fs.writeFileSync(fileAsDir, 'x');
  try {
    assert.equal(stats.recordSurface({ memoryId: 'm1', sessionId: 's1' }, path.join(fileAsDir, 'sub')), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── recordRoutingMiss ────────────────────────────────────────────────────────

test('recordRoutingMiss: rejects empty prompt', () => {
  const d = tmpDir();
  try {
    assert.equal(stats.recordRoutingMiss({ prompt: '', sessionId: 's1' }, d), false);
    assert.equal(stats.recordRoutingMiss({ sessionId: 's1' }, d), false);
  } finally { cleanup(d); }
});

test('recordRoutingMiss: appends one line per call', () => {
  const d = tmpDir();
  try {
    stats.recordRoutingMiss({ prompt: 'how do I reset postgres replication',  sessionId: 's1' }, d);
    stats.recordRoutingMiss({ prompt: 'postgres logical replication is stuck', sessionId: 's2' }, d);
    const m = stats.getRoutingMissStats(d);
    assert.equal(m.total_misses, 2);
    assert.equal(m.unique_prompts, 2);
    assert.ok(m.entries.every(e => Array.isArray(e.tokens) && e.tokens.length > 0));
  } finally { cleanup(d); }
});

test('recordRoutingMiss: same prompt aggregates by hash', () => {
  const d = tmpDir();
  try {
    stats.recordRoutingMiss({ prompt: 'identical prompt body', sessionId: 's1' }, d);
    stats.recordRoutingMiss({ prompt: 'identical prompt body', sessionId: 's2' }, d);
    stats.recordRoutingMiss({ prompt: 'identical prompt body', sessionId: 's3' }, d);
    const m = stats.getRoutingMissStats(d);
    assert.equal(m.total_misses, 3);
    assert.equal(m.unique_prompts, 1);
    assert.equal(m.entries[0].count, 3);
  } finally { cleanup(d); }
});

test('recordRoutingMiss: caps stored prompt to 1000 chars', () => {
  const d = tmpDir();
  try {
    const huge = 'x'.repeat(5000);
    stats.recordRoutingMiss({ prompt: huge, sessionId: 's1' }, d);
    const m = stats.getRoutingMissStats(d);
    assert.equal(m.entries[0].samples[0].length, 1000);
  } finally { cleanup(d); }
});

// ── empty / readback ────────────────────────────────────────────────────────

test('readReuse on empty dir returns sane defaults', () => {
  const d = tmpDir();
  try {
    const r = stats.readReuse(d);
    assert.deepEqual(r.byMemory, {});
    assert.equal(r.lastUpdated, null);
  } finally { cleanup(d); }
});

test('getRoutingMissStats on empty dir returns empty arrays', () => {
  const d = tmpDir();
  try {
    const m = stats.getRoutingMissStats(d);
    assert.equal(m.total_misses, 0);
    assert.equal(m.unique_prompts, 0);
    assert.deepEqual(m.entries, []);
  } finally { cleanup(d); }
});

test('resetAll clears both stores', () => {
  const d = tmpDir();
  try {
    stats.recordSurface({ memoryId: 'm', sessionId: 's' }, d);
    stats.recordRoutingMiss({ prompt: 'something here', sessionId: 's' }, d);
    assert.equal(stats.resetAll(d), true);
    assert.equal(stats.getReuseStats(d).total_memories_tracked, 0);
    assert.equal(stats.getRoutingMissStats(d).total_misses, 0);
  } finally { cleanup(d); }
});

// ── tokenize / hash ──────────────────────────────────────────────────────────

test('_internals.tokenize lowercases and splits', () => {
  const out = stats._internals.tokenize('Hello, World! foo-bar/baz');
  assert.ok(out.includes('hello'));
  assert.ok(out.includes('world'));
  assert.ok(out.includes('foo-bar/baz') || out.includes('foo-bar') || out.includes('baz'));
});

test('_internals.hashPrompt is stable + 12 hex chars', () => {
  const a = stats._internals.hashPrompt('hello');
  const b = stats._internals.hashPrompt('hello');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{12}$/);
});
