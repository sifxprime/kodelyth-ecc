// =============================================================================
// Kodelyth ECC 2.0 — Phase 4+5+6+7+8 end-to-end tests
//
//   Phase 4 — Token Economy (proxy, compression, ledger, counter)
//   Phase 5 — Learning Engine (observe, decay, promote)
//   Phase 6 — Dashboard v2 (real data only)
//   Phase 7 — CLI v2 (doctor, mcp-register, update-check)
//   Phase 8 — Curation (openclaw-twitter removed, skills-ledger present)
//
// Isolated by KODELYTH_HOME + KODELYTH_MEMORY_DIR tmp dirs.
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

let PASS = 0, FAIL = 0;
const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

async function run() {
  for (const c of cases) {
    try {
      await c.fn();
      PASS++;
      process.stdout.write(`  ✓ ${c.name}\n`);
    } catch (err) {
      FAIL++;
      process.stdout.write(`  ✗ ${c.name}\n    ${err.stack || err.message}\n`);
    }
  }
  process.stdout.write(`\n${PASS} passed, ${FAIL} failed\n`);
  process.exit(FAIL > 0 ? 1 : 0);
}

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc2-p4-'));
process.env.KODELYTH_HOME = tmpHome;
delete process.env.KODELYTH_MEMORY_DIR;

Object.keys(require.cache).forEach(k => {
  if (k.includes('/scripts/')) delete require.cache[k];
});

const fabric    = require('../scripts/lib/fabric');
const counter   = require('../scripts/token/count');
const ledger    = require('../scripts/token/ledger');
const proxy     = require('../scripts/token/proxy');
const compress  = require('../scripts/token/compress');
const learn     = require('../scripts/learn/engine');
const dashData  = require('../scripts/dashboard/data-v2');
const dashServer = require('../scripts/dashboard/server-v2');
const doctor    = require('../scripts/doctor-v2');
const mcpRegister = require('../scripts/mcp/register');

// ============================================================================
// PHASE 4 — Token Economy
// ============================================================================

test('Phase 4 — counter: heuristic tokens for empty is 0', () => {
  assert.strictEqual(counter.count(''), 0);
  assert.strictEqual(counter.count(null), 0);
});

test('Phase 4 — counter: word-level roughly 1 token per short word', () => {
  const c = counter.count('hello world this is a test');
  assert.ok(c >= 5 && c <= 10, `expected 5-10, got ${c}`);
});

test('Phase 4 — counter: measureSavings reports raw > lean when reduced', () => {
  const s = counter.measureSavings('long long long long text repeated', 'short');
  assert.ok(s.raw > s.lean);
  assert.ok(s.saved > 0);
  assert.ok(s.ratio > 0);
});

test('Phase 4 — proxy: rejects non-allowlisted commands', () => {
  const r = proxy.proxy('curl', ['https://example.com']);
  assert.strictEqual(r.allowed, false);
  assert.match(r.reason, /not in allowlist/);
});

test('Phase 4 — proxy: rejects git write subcommands', () => {
  const r = proxy.proxy('git', ['commit', '-m', 'hi']);
  assert.strictEqual(r.allowed, false);
});

test('Phase 4 — proxy: allows and runs git status', () => {
  const r = proxy.proxy('git', ['status'], { cwd: process.cwd() });
  assert.strictEqual(r.allowed, true);
  assert.ok(r.stdout.length > 0);
  assert.ok(r.leanStdout.length <= r.stdout.length);
});

test('Phase 4 — proxy: logs a row to the savings ledger', () => {
  const before = ledger.readAll({ limit: 100 }).length;
  proxy.proxy('ls', ['-la', '.'], { cwd: process.cwd() });
  const after = ledger.readAll({ limit: 100 }).length;
  assert.ok(after > before, `ledger did not grow (before=${before} after=${after})`);
});

test('Phase 4 — compress: strips banner + boilerplate + dedupes', () => {
  const input = [
    '# ================================================',
    '# License header MIT Copyright (c) 2026',
    '# ================================================',
    'line one',
    'line one',
    'line one',
    '',
    '',
    '',
    'line two',
  ].join('\n');
  const r = compress.compress(input, { log: false });
  assert.ok(r.saved.saved > 0, `expected some savings, got ${JSON.stringify(r.saved)}`);
  assert.ok(!/={20,}/.test(r.text), 'banner not stripped');
});

test('Phase 4 — ledger: summary aggregates by source', () => {
  ledger.append({ source: 'proxy',    project: '/a', command: 'x', raw: 100, lean: 60, saved: 40, ratio: 0.4 });
  ledger.append({ source: 'compress', project: '/a', command: 'y', raw: 200, lean: 80, saved: 120, ratio: 0.6 });
  const s = ledger.summary();
  assert.ok(s.total_saved >= 160);
  assert.ok(s.bySource.proxy >= 40);
  assert.ok(s.bySource.compress >= 120);
});

// ============================================================================
// PHASE 5 — Learning Engine
// ============================================================================

test('Phase 5 — observe: creates instinct with 0.5 baseline', () => {
  learn.reset();
  const it = learn.observe('correction', 'always-use-pnpm');
  assert.ok(it.confidence >= 0.5);
  assert.strictEqual(it.support, 1);
  assert.strictEqual(it.risk_class, 'safe');
});

test('Phase 5 — observe: repeated observations boost confidence', () => {
  learn.reset();
  learn.observe('correction', 'boost-key');
  learn.observe('correction', 'boost-key');
  learn.observe('correction', 'boost-key');
  const it = learn.load().instincts['correction::boost-key'];
  assert.ok(it.confidence > 0.7, `expected > 0.7, got ${it.confidence}`);
  assert.strictEqual(it.support, 3);
});

test('Phase 5 — risk classification: security key → high risk', () => {
  learn.reset();
  const it = learn.observe('rule', 'never-commit-secrets');
  assert.strictEqual(it.risk_class, 'high');
});

test('Phase 5 — contradict: penalizes confidence', () => {
  learn.reset();
  learn.observe('rule', 'test-rule');
  learn.observe('rule', 'test-rule');
  const before = learn.load().instincts['rule::test-rule'].confidence;
  learn.contradict('rule', 'test-rule');
  const after = learn.load().instincts['rule::test-rule'].confidence;
  assert.ok(after < before, `contradiction did not reduce (before=${before} after=${after})`);
});

test('Phase 5 — decay: unused instincts fade below floor and are swept', () => {
  learn.reset();
  learn.observe('correction', 'ancient-rule');
  const data = learn.load();
  data.instincts['correction::ancient-rule'].last_boost = new Date(Date.now() - 1000 * 60 * 60 * 24 * 400).toISOString();
  data.instincts['correction::ancient-rule'].confidence = 0.08;
  fabric.writeJson(fabric.GLOBAL.instinctsFile, data);
  const r = learn.decay();
  assert.ok(r.swept >= 1);
});

test('Phase 5 — promotable: only safe/moderate above threshold', () => {
  learn.reset();
  for (let i = 0; i < 4; i++) learn.observe('rule', 'always-format-imports');
  learn.observe('rule', 'always-format-imports'); // 5th boost → > 0.85
  const p = learn.promotable();
  assert.ok(p.length >= 1, 'expected at least one promotable');
  assert.ok(p.every(x => x.risk_class !== 'high'));
});

test('Phase 5 — high-risk instincts never auto-promote', () => {
  learn.reset();
  for (let i = 0; i < 6; i++) learn.observe('rule', 'never-commit-secrets');
  const p = learn.promotable();
  assert.strictEqual(p.length, 0, 'high-risk snuck into auto-promote');
  const r = learn.needsReview();
  assert.ok(r.length >= 1, 'high-risk missing from review');
});

test('Phase 5 — autoPromote invokes callback and marks promoted', () => {
  learn.reset();
  for (let i = 0; i < 5; i++) learn.observe('rule', 'safe-rule');
  const called = [];
  const promoted = learn.autoPromote(it => { called.push(it.id); return true; });
  assert.ok(promoted.length >= 1);
  assert.ok(called.length >= 1);
  const after = learn.load().instincts['rule::safe-rule'];
  assert.strictEqual(after.promoted, true);
});

// ============================================================================
// PHASE 6 — Dashboard v2
// ============================================================================

test('Phase 6 — data.overview reports real fabric paths', () => {
  const o = dashData.overview();
  assert.strictEqual(o.fabric.global_root, fabric.GLOBAL.root);
  assert.strictEqual(o.fabric.memory_dir, fabric.GLOBAL.memory);
  assert.ok(o.files_present.savings === true || o.files_present.savings === false);
});

test('Phase 6 — data.savings reflects the ledger honestly', () => {
  const s = dashData.savings();
  const l = ledger.summary();
  assert.strictEqual(s.total_saved, l.total_saved);
  assert.strictEqual(s.rows_counted, l.rows_counted);
});

test('Phase 6 — data.learningPanel matches learn.stats', () => {
  const p = dashData.learningPanel();
  const s = learn.stats();
  assert.strictEqual(p.total, s.total);
  assert.strictEqual(p.promoted, s.promoted);
});

test('Phase 6 — data.savings.empty=true when ledger is genuinely empty', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc2-empty-'));
  const prev = process.env.KODELYTH_HOME;
  process.env.KODELYTH_HOME = tmp;
  Object.keys(require.cache).forEach(k => { if (k.includes('/scripts/')) delete require.cache[k]; });
  const dashDataFresh = require('../scripts/dashboard/data-v2');
  const s = dashDataFresh.savings();
  assert.strictEqual(s.empty, true);
  assert.strictEqual(s.total_saved, 0);
  process.env.KODELYTH_HOME = prev;
  Object.keys(require.cache).forEach(k => { if (k.includes('/scripts/')) delete require.cache[k]; });
});

test('Phase 6 — server handler responds to /api/health', () => {
  return new Promise((resolve, reject) => {
    const req  = { url: '/api/health' };
    const res  = mockRes(json => {
      try { assert.strictEqual(json.ok, true); resolve(); }
      catch (e) { reject(e); }
    });
    dashServer.handle(req, res);
  });
});

test('Phase 6 — server handler responds to /api/overview', () => {
  return new Promise((resolve, reject) => {
    const req  = { url: '/api/overview' };
    const res  = mockRes(json => {
      try { assert.ok(json.fabric); resolve(); }
      catch (e) { reject(e); }
    });
    dashServer.handle(req, res);
  });
});

function mockRes(onJson) {
  let body = '';
  return {
    writeHead() {},
    end(payload) {
      body += payload || '';
      try { onJson(JSON.parse(body)); } catch { onJson({}); }
    },
  };
}

// ============================================================================
// PHASE 7 — CLI v2
// ============================================================================

test('Phase 7 — doctor: all checks pass on a fresh install', async () => {
  const results = await doctor.run();
  const failed  = results.filter(r => !r.ok);
  assert.strictEqual(failed.length, 0, `doctor failed: ${JSON.stringify(failed)}`);
});

test('Phase 7 — mcp-register dry-run produces per-client status', () => {
  const results = mcpRegister.registerAll({ dryRun: true });
  assert.ok(Array.isArray(results));
  assert.ok(results.length >= 1);
  assert.ok(results.every(r => r.id && r.config));
});

test('Phase 7 — mcp-status returns per-client presence', () => {
  const s = mcpRegister.status();
  assert.ok(Array.isArray(s));
  assert.ok(s.every(x => typeof x.registered === 'boolean'));
});

test('Phase 7 — CLI: kodelyth-ecc token savings runs and shows a summary', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'kodelyth-ecc.js'), 'token', 'savings'], {
    encoding: 'utf8',
    env: { ...process.env, KODELYTH_HOME: tmpHome, KODELYTH_NONINTERACTIVE: '1' },
  });
  assert.strictEqual(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /Token Savings/);
});

test('Phase 7 — CLI: kodelyth-ecc learn stats runs', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'kodelyth-ecc.js'), 'learn', 'stats'], {
    encoding: 'utf8',
    env: { ...process.env, KODELYTH_HOME: tmpHome, KODELYTH_NONINTERACTIVE: '1' },
  });
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /Learning Engine/);
});

test('Phase 7 — CLI: doctor exits 0 in JSON mode with all-green', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'kodelyth-ecc.js'), 'doctor', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, KODELYTH_HOME: tmpHome, KODELYTH_NONINTERACTIVE: '1' },
  });
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.ok, true, `doctor failed: ${JSON.stringify(out.results.filter(x => !x.ok))}`);
});

// ============================================================================
// PHASE 8 — Curation
// ============================================================================

test('Phase 8 — openclaw-twitter directory is removed from the tree', () => {
  const p = path.join(__dirname, '..', 'scripts', 'openclaw-twitter');
  assert.strictEqual(fs.existsSync(p), false, 'openclaw-twitter still in tree');
});

test('Phase 8 — SKILLS-LEDGER-2.0.md exists', () => {
  const p = path.join(__dirname, '..', 'docs', 'SKILLS-LEDGER-2.0.md');
  assert.ok(fs.existsSync(p));
  const src = fs.readFileSync(p, 'utf8');
  assert.match(src, /DAILY/); assert.match(src, /LIBRARY/); assert.match(src, /CUT/);
});

test('Phase 8 — ECC-2.0-MASTERPLAN.md still present', () => {
  const p = path.join(__dirname, '..', 'docs', 'ECC-2.0-MASTERPLAN.md');
  assert.ok(fs.existsSync(p));
});

// ============================================================================
run().catch(err => { console.error(err); process.exit(1); });
