// =============================================================================
// Kodelyth ECC 2.0 — Phase 1+2+3 end-to-end tests
//
// Tests that run like a real user:
//   Phase 1  — memory capture, recall, outcome ranking, index self-heal
//   Phase 2  — intent dispatcher: classify + directive + counter-signals
//   Phase 3  — bundled indexer: nodes, edges, incremental rebuild
//
// Every test uses an isolated ~/.kodelythecc under a tmp KODELYTH_HOME.
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const assert = require('assert');

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
      process.stdout.write(`  ✗ ${c.name}\n    ${err.message}\n`);
    }
  }
  process.stdout.write(`\n${PASS} passed, ${FAIL} failed\n`);
  process.exit(FAIL > 0 ? 1 : 0);
}

// ── Test isolation: point KODELYTH_HOME at a fresh tmp dir ──────────────────
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc2-'));
process.env.KODELYTH_HOME = tmpHome;

// Clean module cache so fabric picks up the env var
Object.keys(require.cache).forEach(k => {
  if (k.includes('/scripts/lib/') || k.includes('/scripts/memory/') || k.includes('/scripts/router/') || k.includes('/scripts/indexer/')) {
    delete require.cache[k];
  }
});

const fabric    = require('../scripts/lib/fabric');
const telemetry = require('../scripts/lib/telemetry');
const store     = require('../scripts/memory/store');
const dispatch  = require('../scripts/router/dispatch');
const indexer   = require('../scripts/indexer/index');

// ============================================================================
// PHASE 1 — Memory Engine v2
// ============================================================================

test('Phase 1 — fabric ensures ~/.kodelythecc layout', () => {
  fabric.ensureGlobal();
  assert.ok(fs.existsSync(fabric.GLOBAL.root), 'root missing');
  assert.ok(fs.existsSync(fabric.GLOBAL.memory), 'memory dir missing');
  assert.ok(fs.existsSync(fabric.GLOBAL.savings), 'savings dir missing');
  assert.ok(fs.existsSync(fabric.GLOBAL.telemetry), 'telemetry dir missing');
});

test('Phase 1 — capture writes memory and updates index', () => {
  const m = store.capture({
    problem:  'API returns 401 on valid token',
    approach: 'Fix by re-reading env at request time instead of module load',
    tags:     ['auth', 'jwt', 'next'],
    project:  '/tmp/example-project',
    files:    ['src/lib/auth.ts'],
  });
  assert.ok(m.id, 'no id assigned');
  const memories = store.listAll();
  assert.ok(memories.some(x => x.id === m.id), 'not in log');
});

test('Phase 1 — recall returns the captured memory', () => {
  const hits = store.recall('401 auth token', { minScore: 0.3 });
  assert.ok(hits.length > 0, 'no recall hits');
  assert.ok(hits[0].problem.includes('401'), 'wrong top hit');
  assert.ok(hits[0].score > 0, 'zero score');
});

test('Phase 1 — outcome ranking: resolved:true ranks above resolved:false', () => {
  const good = store.capture({
    problem:  'CORS blocks the fetch call',
    approach: 'Add Access-Control-Allow-Origin to server middleware',
    tags:     ['cors', 'express'],
    project:  '/tmp/example-project',
  });
  const bad = store.capture({
    problem:  'CORS blocks the fetch call',
    approach: 'Tried to disable CORS in browser — did not work',
    tags:     ['cors', 'browser'],
    project:  '/tmp/example-project',
  });
  store.resolveMemory(good.id, true);
  store.resolveMemory(bad.id, false);

  const hits = store.recall('cors fetch', { minScore: 0.1, limit: 5 });
  const goodIdx = hits.findIndex(h => h.id === good.id);
  const badIdx  = hits.findIndex(h => h.id === bad.id);
  assert.ok(goodIdx !== -1, 'good memory missing');
  assert.ok(badIdx  !== -1, 'bad memory missing');
  assert.ok(goodIdx < badIdx, `outcome ranking failed: good=${goodIdx} bad=${badIdx}`);
});

test('Phase 1 — index self-heals on drift', () => {
  // Corrupt the index by deleting it entirely
  fs.unlinkSync(fabric.GLOBAL.memoryIndex);
  const health = store.ensureIndexHealthy();
  assert.ok(health.rebuilt, 'did not rebuild on missing index');
  const hits = store.recall('401 auth token', { minScore: 0.3 });
  assert.ok(hits.length > 0, 'recall broken after rebuild');
});

test('Phase 1 — recallForProject prefers project matches then falls back', () => {
  store.capture({
    problem:  'button width bad on mobile',
    approach: 'Add w-full at breakpoint sm:w-auto',
    tags:     ['tailwind', 'mobile'],
    project:  '/tmp/other-project',
  });
  store.capture({
    problem:  'button width bad on mobile',
    approach: 'Use max-w-xs mx-auto',
    tags:     ['tailwind', 'mobile'],
    project:  '/tmp/example-project',
  });
  const hits = store.recallForProject('/tmp/example-project', 'button mobile width', { minScore: 0.3, limit: 3 });
  assert.ok(hits.length > 0, 'no project recall');
  assert.strictEqual(hits[0].project, fabric.projectHash('/tmp/example-project'), 'project-scoped top hit missing');
});

test('Phase 1 — telemetry logged for every capture and recall', () => {
  const before = telemetry.readAll({ limit: 10000 }).length;
  store.capture({
    problem:  'test telemetry emission',
    approach: 'this should emit memory.capture',
    tags:     ['telemetry-test'],
    project:  '/tmp/example-project',
  });
  store.recall('telemetry emission');
  const after = telemetry.readAll({ limit: 10000 }).length;
  assert.ok(after > before, `no new events (before=${before} after=${after})`);
});

// ============================================================================
// PHASE 2 — Intent Dispatcher
// ============================================================================

test('Phase 2 — classify: production down → incident-commander', () => {
  const d = dispatch.classify('production is down, users cannot login, 500s everywhere');
  assert.ok(d, 'no decision');
  assert.strictEqual(d.agent, 'incident-commander');
  assert.ok(d.confidence > 0.6, `confidence too low: ${d.confidence}`);
});

test('Phase 2 — classify: TypeError with stack → debug-detective', () => {
  const d = dispatch.classify('getting a TypeError: cannot read property foo of undefined on line 42');
  assert.ok(d, 'no decision');
  assert.strictEqual(d.agent, 'debug-detective');
});

test('Phase 2 — classify: build failed → build-error-resolver', () => {
  const d = dispatch.classify('the vercel build failed with a TS2322 type error');
  assert.ok(d);
  assert.strictEqual(d.agent, 'build-error-resolver');
});

test('Phase 2 — classify: security question → security-reviewer', () => {
  const d = dispatch.classify('is my JWT signing secure? worried about vulnerabilities');
  assert.ok(d);
  assert.strictEqual(d.agent, 'security-reviewer');
});

test('Phase 2 — classify: a11y feedback → ux-reviewer', () => {
  const d = dispatch.classify('screen reader is skipping my form labels, need a11y fix');
  assert.ok(d);
  assert.strictEqual(d.agent, 'ux-reviewer');
});

test('Phase 2 — counter-signal: explicit "use agent" is NOT routed', () => {
  const d = dispatch.classify('use debug-detective on this stack trace');
  assert.strictEqual(d, null, 'should not route when user explicitly invoked');
});

test('Phase 2 — counter-signal: slash commands NOT routed', () => {
  const d = dispatch.classify('/team-review please');
  assert.strictEqual(d, null);
});

test('Phase 2 — counter-signal: greeting NOT routed', () => {
  const d = dispatch.classify('hey');
  assert.strictEqual(d, null);
});

test('Phase 2 — directive: high confidence produces route block', () => {
  const out = dispatch.directive('production is down, 500s in prod', '/tmp/example-project');
  assert.ok(out, 'no directive');
  assert.strictEqual(out.kind, 'route');
  assert.ok(out.block.includes('Routing to'));
  assert.ok(out.block.includes('incident-commander'));
});

test('Phase 2 — directive caches decision to .kodelythecc/intent-cache.json', () => {
  dispatch.directive('slow query taking p99 4s in prod', '/tmp/dispatch-cache-test');
  const cache = fabric.readJson(path.join('/tmp/dispatch-cache-test/.kodelythecc/intent-cache.json'), null);
  assert.ok(cache, 'no cache written');
  assert.ok(cache.decisions.length > 0, 'no decisions cached');
});

// ============================================================================
// PHASE 3 — Bundled Codebase Indexer
// ============================================================================

const idxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc2-repo-'));

function seedRepo() {
  fs.writeFileSync(path.join(idxDir, 'package.json'), JSON.stringify({
    name: 'demo', dependencies: { next: '15.0.0', react: '19.0.0' },
  }));
  fs.mkdirSync(path.join(idxDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(idxDir, 'src', 'utils.ts'),
    `import { z } from 'zod';\n` +
    `export function slugify(s: string): string {\n` +
    `  return s.toLowerCase().replace(/\\s+/g, '-');\n` +
    `}\n` +
    `export const parseId = (input: string) => slugify(input);\n`
  );
  fs.mkdirSync(path.join(idxDir, 'src', 'app'), { recursive: true });
  fs.writeFileSync(path.join(idxDir, 'src', 'app', 'route.ts'),
    `import { slugify } from '../utils';\n` +
    `export async function GET(req: Request) {\n` +
    `  const url = new URL(req.url);\n` +
    `  return new Response(slugify(url.pathname));\n` +
    `}\n`
  );
  fs.writeFileSync(path.join(idxDir, 'src', 'app', 'page.tsx'),
    `import { slugify } from '../utils';\n` +
    `export default function HomePage() {\n` +
    `  const value = slugify('Hello World');\n` +
    `  return <div>{value}</div>;\n` +
    `}\n`
  );
  fs.mkdirSync(path.join(idxDir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(idxDir, 'scripts', 'seed.py'),
    `import os\n` +
    `def seed_users():\n` +
    `    return []\n` +
    `class Seeder:\n` +
    `    pass\n`
  );
}

test('Phase 3 — indexer builds a graph from a fresh repo', () => {
  seedRepo();
  const g = indexer.indexRepo(idxDir);
  assert.ok(g.nodes.length > 0, `no nodes indexed: ${JSON.stringify(g.stats)}`);
  assert.ok(g.edges.length > 0, 'no edges');
  const names = g.nodes.map(n => n.name);
  assert.ok(names.includes('slugify'), `slugify missing from nodes: ${names.join(',')}`);
  assert.ok(names.includes('HomePage'), 'HomePage component missing');
  assert.ok(names.includes('GET'), 'GET route missing');
});

test('Phase 3 — indexer picks up Python defs and classes', () => {
  const g = indexer.loadGraph(idxDir);
  const names = g.nodes.map(n => n.name);
  assert.ok(names.includes('seed_users'), 'python function missing');
  assert.ok(names.includes('Seeder'), 'python class missing');
});

test('Phase 3 — imports become IMPORTS edges', () => {
  const g = indexer.loadGraph(idxDir);
  const importsFromUtils = g.edges.filter(e => e.type === 'IMPORTS');
  assert.ok(importsFromUtils.length > 0, 'no import edges');
});

test('Phase 3 — same-file call edges are recorded', () => {
  const g = indexer.loadGraph(idxDir);
  const calls = g.edges.filter(e => e.type === 'CALLS');
  assert.ok(calls.length > 0, `no CALLS edges (edges=${g.edges.length})`);
});

test('Phase 3 — incremental re-index: unchanged files skipped', () => {
  const first = indexer.indexRepo(idxDir);
  // Modify one file only
  fs.writeFileSync(path.join(idxDir, 'src', 'utils.ts'),
    `export function slugify(s: string): string {\n` +
    `  return s.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');\n` +
    `}\n` +
    `export function newExport() { return 42; }\n`
  );
  const second = indexer.indexRepo(idxDir);
  assert.strictEqual(second.stats.files_changed, 1, `expected 1 changed, got ${second.stats.files_changed}`);
  assert.ok(second.stats.files_unchanged >= 2, `expected 2+ unchanged, got ${second.stats.files_unchanged}`);
  const names = second.nodes.map(n => n.name);
  assert.ok(names.includes('newExport'), 'new symbol not indexed');
});

test('Phase 3 — searchGraph finds a symbol by name', () => {
  const results = indexer.searchGraph(idxDir, { name: 'slugify' });
  assert.ok(results.length > 0);
  assert.strictEqual(results[0].name, 'slugify');
});

test('Phase 3 — architecture returns useful stats', () => {
  const arch = indexer.architecture(idxDir);
  assert.ok(arch);
  assert.ok(arch.byKind.function >= 1, 'no functions counted');
  assert.ok(arch.stats.nodes_total >= 4, `too few nodes: ${arch.stats.nodes_total}`);
});

test('Phase 3 — graph.json written to .kodelythecc/', () => {
  const graphPath = path.join(idxDir, '.kodelythecc', 'graph.json');
  assert.ok(fs.existsSync(graphPath), 'graph.json missing');
  const raw = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  assert.ok(raw.version === 2);
});

// ============================================================================
run().catch(err => { console.error(err); process.exit(1); });
