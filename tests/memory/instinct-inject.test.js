// Tests for scripts/memory/instinct-inject.js — the structured-instinct reader
// that activates the previously write-only instinct engine at session start.
//
// The engine (scripts/memory/instincts.js) recorded corrections with confidence,
// decay, and outcome scoring, but nothing ever READ it, so none of that
// machinery influenced a session. These tests pin the selection/formatting that
// closes the loop, and prove the store-reading path can never throw.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// instincts.js captures its memory dir from KODELYTH_MEMORY_DIR at require time,
// so point it at a throwaway dir BEFORE anything requires the store.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-instinct-'));
process.env.KODELYTH_MEMORY_DIR = TMP;

const {
  formatStructuredInstincts,
  summarizeStructuredInstincts,
} = require('../../scripts/memory/instinct-inject');

const rec = (over = {}) => ({
  rule: 'Always use pnpm, never npm',
  scope: 'global',
  confidence: 0.9,
  stale: false,
  project_path: null,
  ...over,
});

// ── Pure selection + formatting ──────────────────────────────────────────────

test('a confident, non-stale global instinct is injected', () => {
  const out = formatStructuredInstincts([rec()]);
  assert.match(out, /Learned instincts/);
  assert.match(out, /\[global 90%\] Always use pnpm, never npm/);
});

test('stale instincts are excluded', () => {
  assert.equal(formatStructuredInstincts([rec({ stale: true })]), '');
});

test('instincts below the confidence threshold are excluded', () => {
  assert.equal(formatStructuredInstincts([rec({ confidence: 0.5 })]), '');
});

test('project-scoped instincts apply only inside their project', () => {
  const r = rec({ scope: 'project', project_path: '/work/alpha', rule: 'Run the alpha migration first' });
  // Matching project → included
  assert.match(
    formatStructuredInstincts([r], { projectPath: '/work/alpha' }),
    /\[project 90%\] Run the alpha migration first/,
  );
  // Different project → excluded
  assert.equal(formatStructuredInstincts([r], { projectPath: '/work/beta' }), '');
});

test('results are ranked by confidence and capped at max', () => {
  const recs = [
    rec({ rule: 'low',  confidence: 0.72 }),
    rec({ rule: 'high', confidence: 0.99 }),
    rec({ rule: 'mid',  confidence: 0.85 }),
  ];
  const out = formatStructuredInstincts(recs, { max: 2 });
  const lines = out.split('\n').slice(1); // drop the header
  assert.equal(lines.length, 2);
  assert.match(lines[0], /high/);   // highest confidence first
  assert.match(lines[1], /mid/);
  assert.doesNotMatch(out, /low/);  // capped out
});

test('empty, non-array, and junk input all yield no injection', () => {
  assert.equal(formatStructuredInstincts([]), '');
  assert.equal(formatStructuredInstincts(null), '');
  assert.equal(formatStructuredInstincts([{ confidence: 0.9 }]), ''); // no rule text
  assert.equal(formatStructuredInstincts([{ rule: '   ', confidence: 0.9 }]), ''); // blank rule
});

// ── Store-reading path (integration against a temp store) ────────────────────

test('summarizeStructuredInstincts reads the JSONL store and injects', () => {
  fs.mkdirSync(TMP, { recursive: true });
  const line = JSON.stringify(rec({ rule: 'Prefer early returns over nesting' }));
  fs.writeFileSync(path.join(TMP, 'instincts.jsonl'), line + '\n');

  const out = summarizeStructuredInstincts('/any/project');
  assert.match(out, /Prefer early returns over nesting/);
});

test('summarizeStructuredInstincts never throws and returns a string', () => {
  // Even if the store is absent/garbage, session start must not break.
  const prev = process.env.KODELYTH_MEMORY_DIR;
  try {
    process.env.KODELYTH_MEMORY_DIR = path.join(TMP, 'does-not-exist');
    const out = summarizeStructuredInstincts('/any/project');
    assert.equal(typeof out, 'string'); // '' is fine — the point is no throw
  } finally {
    process.env.KODELYTH_MEMORY_DIR = prev;
  }
});
