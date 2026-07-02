// =============================================================================
// Kodelyth ECC — Self-test / Doctor v2
// (v1 doctor kept for backward compat; this is the 2.0 verifier)
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const fabric    = require('./lib/fabric');
const telemetry = require('./lib/telemetry');

const checks = [];
function check(name, fn) { checks.push({ name, fn }); }

check('fabric: global brain dir created', () => {
  fabric.ensureGlobal();
  if (!fs.existsSync(fabric.GLOBAL.root)) throw new Error(`missing ${fabric.GLOBAL.root}`);
  return { path: fabric.GLOBAL.root };
});

check('fabric: memory dir writeable', () => {
  const probe = path.join(fabric.GLOBAL.memory, `.probe-${process.pid}`);
  fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe);
  return { path: fabric.GLOBAL.memory };
});

check('memory: capture → recall roundtrip', () => {
  const store = require('./memory/store');
  const marker = `doctor-${Date.now()}`;
  const m = store.capture({
    problem:  `doctor probe ${marker}`,
    approach: `synthetic capture for self-test ${marker}`,
    tags:     ['doctor'],
    source:   'doctor',
  });
  const hits = store.recall(marker, { minScore: 0.3 });
  if (!hits.some(h => h.id === m.id)) throw new Error('captured memory not recalled');
  store.forget(m.id);
  return { id: m.id };
});

check('memory: index self-heals when index.json missing', () => {
  const store = require('./memory/store');
  if (fs.existsSync(fabric.GLOBAL.memoryIndex)) fs.unlinkSync(fabric.GLOBAL.memoryIndex);
  const health = store.ensureIndexHealthy();
  if (!health.rebuilt) throw new Error('did not rebuild when index missing');
  return { rebuilt: true };
});

check('telemetry: event append + read', () => {
  telemetry.record('doctor.probe', { marker: 'ok' });
  const evs = telemetry.readAll({ limit: 5, kind: 'doctor.probe' });
  if (evs.length === 0) throw new Error('event not readable');
  return { events: evs.length };
});

check('ledger: append + summary', () => {
  const ledger = require('./token/ledger');
  ledger.append({ source: 'proxy', project: '/doctor', command: 'doctor probe', raw: 100, lean: 60, saved: 40, ratio: 0.4 });
  const s = ledger.summary();
  if (s.total_saved <= 0) throw new Error('ledger summary broken');
  return { total_saved: s.total_saved };
});

check('learn: observe → stats', () => {
  const learn = require('./learn/engine');
  learn.observe('doctor', 'probe-key', { public: { note: 'self-test' } });
  const s = learn.stats();
  if (s.total < 1) throw new Error('instinct not observed');
  return { total: s.total };
});

check('router: classify smoke test', () => {
  const dispatch = require('./router/dispatch');
  const d = dispatch.classify('production is down and 500s in prod');
  if (!d || d.agent !== 'incident-commander') throw new Error('classifier broken');
  return { agent: d.agent };
});

check('indexer: parses a synthetic repo', () => {
  const indexer = require('./indexer/index');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-doctor-idx-'));
  fs.writeFileSync(path.join(tmp, 'file.ts'), 'export function hello() { return 1; }\n');
  const g = indexer.indexRepo(tmp);
  if (g.nodes.length === 0) throw new Error('no nodes indexed');
  return { nodes: g.nodes.length };
});

check('mcp: registered client configs (soft)', () => {
  const found = [];
  const claudeDesktop = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  if (fs.existsSync(claudeDesktop)) found.push('claude-desktop');
  const claudeCode = path.join(os.homedir(), '.claude', 'mcp.json');
  if (fs.existsSync(claudeCode)) found.push('claude-code');
  return { registered_clients: found, note: found.length === 0 ? 'no MCP clients registered yet' : null };
});

async function run() {
  const results = [];
  for (const c of checks) {
    try {
      const detail = await c.fn();
      results.push({ name: c.name, ok: true, detail });
    } catch (err) {
      results.push({ name: c.name, ok: false, error: err.message });
    }
  }
  return results;
}

async function main({ json = false } = {}) {
  const results = await run();
  const ok = results.filter(r => r.ok).length;
  const total = results.length;

  if (json) {
    process.stdout.write(JSON.stringify({ ok: ok === total, passed: ok, total, results }, null, 2) + '\n');
    process.exit(ok === total ? 0 : 1);
  }

  process.stdout.write(`\nKodelyth ECC 2.0 — Doctor\n`);
  process.stdout.write(`--------------------------\n`);
  for (const r of results) {
    const mark = r.ok ? '✓' : '✗';
    process.stdout.write(`  ${mark} ${r.name}${r.ok ? '' : '  →  ' + r.error}\n`);
  }
  process.stdout.write(`\n${ok}/${total} checks passed\n`);
  process.exit(ok === total ? 0 : 1);
}

module.exports = { run, main, checks };
if (require.main === module) main({ json: process.argv.includes('--json') });
