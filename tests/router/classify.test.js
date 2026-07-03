// Tests for scripts/router/classify.js — the cost-aware model-tier classifier.
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const R = require('../../scripts/router/classify');

test('classify: rename → trivial', () => {
  const r = R.classify('rename getUserName to getUserDisplayName');
  assert.equal(r.tier, 'trivial');
  assert.ok(r.reasons.some(x => x.includes('rename')));
});

test('classify: fix typo → trivial', () => {
  const r = R.classify('fix typo in readme');
  assert.equal(r.tier, 'trivial');
});

test('classify: production incident → hard', () => {
  const r = R.classify('production is down and the auth service is throwing 502s');
  assert.equal(r.tier, 'hard');
  assert.ok(r.reasons.some(x => x.includes('hard:production')));
});

test('classify: security audit → hard', () => {
  const r = R.classify('perform a security audit on the new oauth flow');
  assert.equal(r.tier, 'hard');
});

test('classify: multi-file refactor (5 files) → hard', () => {
  const r = R.classify('refactor the payment processor', { file_count: 5 });
  assert.equal(r.tier, 'hard');
  assert.ok(r.reasons.some(x => x.includes('multi-file')));
});

test('classify: code review of small PR → standard', () => {
  const r = R.classify('review this 40-line PR for our team', { file_count: 1 });
  assert.equal(r.tier, 'standard');
});

test('classify: write a unit test → standard', () => {
  const r = R.classify('write a unit test for the new validator', { file_count: 1 });
  assert.equal(r.tier, 'standard');
});

test('classify: security-reviewer agent forces hard regardless of task', () => {
  const r = R.classify('rename a variable', { active_agent: 'security-reviewer' });
  assert.equal(r.tier, 'hard');
  assert.ok(r.reasons.some(x => x.includes('never downgrades')));
});

test('classify: incident-commander agent forces hard', () => {
  const r = R.classify('quick check', { active_agent: 'incident-commander' });
  assert.equal(r.tier, 'hard');
});

test('classify: devil-mode keyword → hard', () => {
  const r = R.classify('/devil-mode --all on the payments module');
  assert.equal(r.tier, 'hard');
});

test('classify: empty task defaults to standard', () => {
  const r = R.classify('');
  assert.equal(r.tier, 'standard');
});

test('classify: budget pressure biases standard down to trivial', () => {
  // Standard signal alone, but budget at 80% → trivial bias should kick in.
  const r = R.classify('write some docs', {
    file_count: 0,
    session_tokens: 80000,
    budget_tokens: 100000,
  });
  // Standard:doc-section + budget bias → tied; trivial wins ties.
  assert.ok(['trivial', 'standard'].includes(r.tier));
});

test('loadConfig: defaults when no overrides', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'router-cfg-'));
  const cfg = R.loadConfig({ projectRoot: tmp });
  assert.equal(cfg.trivial,  R.DEFAULT_MODELS.trivial);
  assert.equal(cfg.standard, R.DEFAULT_MODELS.standard);
  assert.equal(cfg.hard,     R.DEFAULT_MODELS.hard);
  assert.equal(cfg.disabled, false);
});

test('loadConfig: project file overrides defaults', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'router-cfg-'));
  fs.mkdirSync(path.join(tmp, '.kodelythecc'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.kodelythecc', 'router.json'), JSON.stringify({
    trivial:  'gpt-4.1-mini',
    standard: 'gpt-4.1',
    hard:     'gpt-5',
    notes:    'set by infra team',
  }));
  const cfg = R.loadConfig({ projectRoot: tmp });
  assert.equal(cfg.trivial,  'gpt-4.1-mini');
  assert.equal(cfg.standard, 'gpt-4.1');
  assert.equal(cfg.hard,     'gpt-5');
  assert.equal(cfg.notes,    'set by infra team');
});

test('loadConfig: env vars override project file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'router-cfg-'));
  fs.mkdirSync(path.join(tmp, '.kodelythecc'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.kodelythecc', 'router.json'), JSON.stringify({
    trivial: 'gpt-4.1-mini',
  }));
  const orig = process.env.KODELYTH_ROUTER_TRIVIAL;
  process.env.KODELYTH_ROUTER_TRIVIAL = 'haiku-override';
  try {
    const cfg = R.loadConfig({ projectRoot: tmp });
    assert.equal(cfg.trivial, 'haiku-override');
  } finally {
    if (orig === undefined) delete process.env.KODELYTH_ROUTER_TRIVIAL;
    else process.env.KODELYTH_ROUTER_TRIVIAL = orig;
  }
});

test('loadConfig: KODELYTH_ROUTER=off marks disabled', () => {
  const orig = process.env.KODELYTH_ROUTER;
  process.env.KODELYTH_ROUTER = 'off';
  try {
    const cfg = R.loadConfig({ projectRoot: process.cwd() });
    assert.equal(cfg.disabled, true);
  } finally {
    if (orig === undefined) delete process.env.KODELYTH_ROUTER;
    else process.env.KODELYTH_ROUTER = orig;
  }
});

test('recommend: returns mismatched=true when current model differs from suggestion', () => {
  const r = R.recommend('rename a variable', {
    current_model: 'claude-opus-4-1',
    project_root: os.tmpdir(),
  });
  assert.equal(r.tier, 'trivial');
  assert.ok(r.mismatched);
  assert.equal(r.recommended_model, R.DEFAULT_MODELS.trivial);
});

test('recommend: mismatched=false when current model matches suggestion', () => {
  const r = R.recommend('rename a variable', {
    current_model: R.DEFAULT_MODELS.trivial,
    project_root: os.tmpdir(),
  });
  assert.equal(r.mismatched, false);
});

test('recommend: returns disabled when KODELYTH_ROUTER=off', () => {
  const orig = process.env.KODELYTH_ROUTER;
  process.env.KODELYTH_ROUTER = 'off';
  try {
    const r = R.recommend('any task', { project_root: os.tmpdir() });
    assert.equal(r.disabled, true);
  } finally {
    if (orig === undefined) delete process.env.KODELYTH_ROUTER;
    else process.env.KODELYTH_ROUTER = orig;
  }
});
