// Tests for scripts/dashboard/data.js
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');

// IMPORTANT: the memory store freezes KODELYTH_MEMORY_DIR at require time.
// Configure a TMP dir before requiring anything that loads it transitively.
const TMP_MEM = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-dash-mem-suite-'));
process.env.KODELYTH_MEMORY_DIR = TMP_MEM;

const data        = require('../../scripts/dashboard/data.js');
const memoryStore = require('../../scripts/memory/store.js');

function tmpDir(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function cleanup(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* */ } }

// ── overview ────────────────────────────────────────────────────────────────

test('overview: returns shape with counts + storage paths even on cold dirs', () => {
  const memDir    = tmpDir('kodelyth-dash-mem-');
  const evolveDir = tmpDir('kodelyth-dash-evol-');
  const coordDir  = tmpDir('kodelyth-dash-coord-');
  try {
    const o = data.overview({ memoryDir: memDir, evolveDir, coordRoot: coordDir });
    assert.equal(o.storage.memory_dir, memDir);
    assert.equal(o.storage.evolve_dir, evolveDir);
    assert.equal(o.storage.coord_root, coordDir);
    assert.ok(typeof o.catalog.agents === 'number');
    assert.ok(typeof o.catalog.skills === 'number');
    assert.equal(o.evolve.proposals.pending, 0);
    assert.equal(o.evolve.proposals.total, 0);
    assert.equal(o.swarm.sessions, 0);
    assert.match(o.generated_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally { cleanup(memDir); cleanup(evolveDir); cleanup(coordDir); }
});

test('overview: catalog counts are non-zero for the real package root', () => {
  const o = data.overview();
  assert.ok(o.catalog.skills > 0, 'skills count > 0 for real install');
  assert.ok(o.catalog.commands > 0);
});

// ── memory ──────────────────────────────────────────────────────────────────
// All memory tests share TMP_MEM (the store freezes its dir at require time).
// Run order matters: empty assertion → seed → readback.

test('memory: empty store yields empty recent list', () => {
  // Runs first, before any captures.
  assert.deepEqual(data.recentMemories({ limit: 5 }), []);
  assert.equal(data.memoryStats().total, 0);
});

test('memory: empty query returns []', () => {
  assert.deepEqual(data.memorySearch({ query: '' }), []);
  assert.deepEqual(data.memorySearch({}), []);
});

test('memory: recent + search after seeding two captures', async () => {
  const m1 = memoryStore.capture({ problem: 'unique-token-tailwind-v4-arbitrary one', approach: 'A1', tags: ['css'], language: 'js' });
  await new Promise(r => setTimeout(r, 15));
  const m2 = memoryStore.capture({ problem: 'second-distinct-problem-here',         approach: 'A2', tags: ['ts'],  language: 'ts' });

  const recent = data.recentMemories({ limit: 5 });
  assert.ok(recent.length >= 2, 'has at least the two captures');
  // Newest first.
  const newestId = recent[0].id;
  assert.equal(newestId, m2.id);
  assert.ok(recent.some(r => r.id === m1.id));
  assert.match(recent[0].approach, /^A2/);

  const stats = data.memoryStats();
  assert.ok(stats.total >= 2);
  assert.ok(typeof stats.byLanguage === 'object');

  const hits = data.memorySearch({ query: 'unique-token-tailwind-v4-arbitrary', limit: 5 });
  assert.ok(hits.length >= 1, 'BM25 finds seeded memory');
  assert.match(hits[0].problem, /unique-token-tailwind-v4-arbitrary/);
  assert.ok(typeof hits[0].score === 'number');
});

// ── evolve ──────────────────────────────────────────────────────────────────

test('evolveSnapshot: empty dir → zero counts + empty arrays', () => {
  const evolveDir = tmpDir('kodelyth-dash-evol-');
  try {
    const e = data.evolveSnapshot({ evolveDir });
    assert.equal(e.reuse.total_memories_tracked, 0);
    assert.equal(e.reuse.total_surfaces, 0);
    assert.equal(e.miss.total_misses, 0);
    assert.deepEqual(e.proposals, []);
  } finally { cleanup(evolveDir); }
});

test('evolveSnapshot: surfaces a recorded reuse + proposal', () => {
  const evolveDir = tmpDir('kodelyth-dash-evol-');
  try {
    const stats     = require('../../scripts/evolve/stats.js');
    const proposals = require('../../scripts/evolve/proposals.js');
    stats.recordSurface({ memoryId: 'mem-x', sessionId: 's1' }, evolveDir);
    proposals.appendProposal({
      id: 'skill-test',
      type: 'skill-upgrade',
      proposal: { kind: 'create-skill', target_path: 'skills/x/SKILL.md', diff: '# x', rationale: 'why' },
    }, evolveDir);

    const e = data.evolveSnapshot({ evolveDir });
    assert.equal(e.reuse.total_memories_tracked, 1);
    assert.equal(e.reuse.total_surfaces, 1);
    assert.equal(e.proposals.length, 1);
    assert.equal(e.proposals[0].id, 'skill-test');
    assert.equal(e.proposals[0].status, 'pending');
    assert.equal(e.proposals[0].target_path, 'skills/x/SKILL.md');
  } finally { cleanup(evolveDir); }
});

// ── catalog ─────────────────────────────────────────────────────────────────

test('catalogList: rejects unknown kind by returning []', () => {
  assert.deepEqual(data.catalogList({ kind: 'junk' }), []);
});

test('catalogList: returns skills for kind=skills', () => {
  const items = data.catalogList({ kind: 'skills', limit: 5 });
  assert.ok(items.length >= 1);
  assert.ok(typeof items[0].name === 'string');
});

test('catalogList: query filters by substring', () => {
  const items = data.catalogList({ kind: 'skills', query: 'self-evolving', limit: 50 });
  // Phase 3.4 just shipped this skill — must be findable.
  assert.ok(items.some(it => it.name.includes('self-evolving')), 'finds self-evolving-memory skill');
});

test('catalogList: limit caps results', () => {
  const items = data.catalogList({ kind: 'skills', limit: 3 });
  assert.ok(items.length <= 3);
});

test('catalogCounts: matches stats() shape', () => {
  const c = data.catalogCounts();
  for (const k of ['agents', 'skills', 'commands', 'rules', 'bundles']) {
    assert.ok(typeof c[k] === 'number');
  }
});

// ── sessions ────────────────────────────────────────────────────────────────

test('sessionsList: missing coord dir returns []', () => {
  assert.deepEqual(data.sessionsList({ coordRoot: '/tmp/__never_exists_xyz_kodelyth' }), []);
});

test('sessionsList: returns sessions with worker counts', () => {
  const root = tmpDir('kodelyth-dash-coord-');
  try {
    fs.mkdirSync(path.join(root, 'sess-A', 'worker-1'), { recursive: true });
    fs.mkdirSync(path.join(root, 'sess-A', 'worker-2'), { recursive: true });
    fs.mkdirSync(path.join(root, 'sess-B', 'worker-1'), { recursive: true });
    const list = data.sessionsList({ coordRoot: root });
    assert.equal(list.length, 2);
    const a = list.find(s => s.session === 'sess-A');
    assert.equal(a.worker_count, 2);
    assert.deepEqual(a.workers.sort(), ['worker-1', 'worker-2']);
  } finally { cleanup(root); }
});

test('sessionDetail: returns null for missing session', () => {
  assert.equal(data.sessionDetail({ session: 'nope', coordRoot: '/tmp/__never_exists_xyz_kodelyth' }), null);
});

test('sessionDetail: reads task/handoff/status excerpts', () => {
  const root = tmpDir('kodelyth-dash-coord-');
  try {
    const wdir = path.join(root, 'sess-X', 'worker-1');
    fs.mkdirSync(wdir, { recursive: true });
    fs.writeFileSync(path.join(wdir, 'task.md'),    '# task\nbody\n');
    fs.writeFileSync(path.join(wdir, 'handoff.md'), '# handoff\nhello\n');
    const d = data.sessionDetail({ session: 'sess-X', coordRoot: root });
    assert.ok(d);
    assert.equal(d.workers.length, 1);
    const w = d.workers[0];
    assert.equal(w.has_task, true);
    assert.equal(w.has_handoff, true);
    assert.equal(w.has_status, false);
    assert.match(w.task_excerpt, /^# task/);
    assert.match(w.handoff_excerpt, /hello/);
  } finally { cleanup(root); }
});

test('safeReadExcerpt: truncates large files', () => {
  const tmp = tmpDir('kodelyth-dash-trunc-');
  const f = path.join(tmp, 'big.md');
  try {
    fs.writeFileSync(f, 'x'.repeat(5000));
    const ex = data._internals.safeReadExcerpt(f, 100);
    assert.ok(ex.endsWith('…(truncated)'));
    assert.ok(ex.length < 5000);
  } finally { cleanup(tmp); }
});

// ── token budget ────────────────────────────────────────────────────────────

test('tokenBudgetSnapshot: missing dir → empty result', () => {
  const r = data.tokenBudgetSnapshot({ budgetDir: '/tmp/__never_exists_kodelyth_budget' });
  assert.deepEqual(r, { sessions: [], total_tokens: 0 });
});

test('tokenBudgetSnapshot: aggregates JSON budget files', () => {
  const dir = tmpDir('kodelyth-dash-budget-');
  try {
    fs.writeFileSync(path.join(dir, 'budget-s1.json'),
      JSON.stringify({ session_id: 's1', tokens: 1234, budget: 10000, mode: 'warn', last_event: '2026-05-10T10:00:00Z' }));
    fs.writeFileSync(path.join(dir, 'budget-s2.json'),
      JSON.stringify({ session_id: 's2', tokens: 5678, budget: 10000, mode: 'warn', last_event: '2026-05-10T11:00:00Z' }));
    const r = data.tokenBudgetSnapshot({ budgetDir: dir });
    assert.equal(r.sessions.length, 2);
    assert.equal(r.total_tokens, 1234 + 5678);
    assert.equal(r.sessions[0].session_id, 's2', 'sorted by last_event desc');
  } finally { cleanup(dir); }
});

test('tokenBudgetSnapshot: silently skips malformed budget files', () => {
  const dir = tmpDir('kodelyth-dash-budget-');
  try {
    fs.writeFileSync(path.join(dir, 'budget-broken.json'), 'not-json{{{');
    fs.writeFileSync(path.join(dir, 'budget-good.json'),
      JSON.stringify({ session_id: 'good', tokens: 100 }));
    const r = data.tokenBudgetSnapshot({ budgetDir: dir });
    assert.equal(r.sessions.length, 1, 'only good file counted');
    assert.equal(r.total_tokens, 100);
  } finally { cleanup(dir); }
});

// ── ide sessions (claude code / windsurf / antigravity) ─────────────────────

function emptyIdeOpts(label) {
  // Build a fully-empty IDE options bag so each call only sees what the test feeds it.
  const cc = tmpDir(`kodelyth-cc-${label}-`); cleanup(cc);
  const ws = tmpDir(`kodelyth-ws-${label}-`); cleanup(ws);
  const wn = tmpDir(`kodelyth-wn-${label}-`); cleanup(wn);
  const cu = tmpDir(`kodelyth-cu-${label}-`); cleanup(cu);
  const ag = tmpDir(`kodelyth-ag-${label}-`); cleanup(ag);
  const cwd = tmpDir(`kodelyth-cwd-${label}-`);
  return {
    claudeProjectsDir: cc, windsurfDir: ws, windsurfNextDir: wn,
    cursorDir: cu, antigravityDir: ag, extraDirs: [], cwd,
    _cleanup: () => cleanup(cwd),
  };
}

test('ideSessionsList: missing dirs return []', () => {
  const o = emptyIdeOpts('missing');
  try {
    const list = data.ideSessionsList(o);
    assert.deepEqual(list, []);
  } finally { o._cleanup(); }
});

test('ideSessionsList: surfaces claude-code sessions sorted by mtime desc', async () => {
  const o = emptyIdeOpts('cc-sort');
  o.claudeProjectsDir = tmpDir('kodelyth-cc-');
  try {
    const proj = path.join(o.claudeProjectsDir, '-Users-alice-myproject');
    fs.mkdirSync(proj, { recursive: true });
    fs.writeFileSync(path.join(proj, 'aaa-old.jsonl'), '{"x":1}\n');
    await new Promise(r => setTimeout(r, 20));
    fs.writeFileSync(path.join(proj, 'bbb-new.jsonl'), '{"x":2}\n');

    const list = data.ideSessionsList({ ...o, limit: 10 });
    assert.equal(list.length, 2);
    assert.equal(list[0].platform, 'claude-code');
    assert.equal(list[0].session_id, 'bbb-new', 'newest first');
    assert.equal(list[1].session_id, 'aaa-old');
    assert.match(list[0].project, /alice/, 'project path is decoded best-effort');
  } finally { cleanup(o.claudeProjectsDir); o._cleanup(); }
});

test('ideSessionsList: detects antigravity .agent/ in cwd', () => {
  const o = emptyIdeOpts('ag-cwd');
  try {
    fs.mkdirSync(path.join(o.cwd, '.agent'), { recursive: true });
    const list = data.ideSessionsList(o);
    assert.equal(list.length, 1);
    assert.equal(list[0].platform, 'antigravity');
    assert.equal(list[0].project, o.cwd);
  } finally { o._cleanup(); }
});

test('ideSessionsList: detects windsurf-next state files', () => {
  const o = emptyIdeOpts('wn');
  o.windsurfNextDir = tmpDir('kodelyth-wn-pop-');
  try {
    fs.writeFileSync(path.join(o.windsurfNextDir, 'state.json'), '{}');
    const list = data.ideSessionsList(o);
    assert.equal(list.length, 1);
    assert.equal(list[0].platform, 'windsurf-next');
    assert.equal(list[0].session_id, 'state.json');
  } finally { cleanup(o.windsurfNextDir); o._cleanup(); }
});

test('ideSessionsList: detects cursor workspace dirs', () => {
  const o = emptyIdeOpts('cu');
  o.cursorDir = tmpDir('kodelyth-cu-pop-');
  try {
    fs.mkdirSync(path.join(o.cursorDir, 'abc123hash'), { recursive: true });
    const list = data.ideSessionsList(o);
    assert.equal(list.length, 1);
    assert.equal(list[0].platform, 'cursor');
    assert.equal(list[0].session_id, 'abc123hash');
  } finally { cleanup(o.cursorDir); o._cleanup(); }
});

test('ideSessionsList: KODELYTH_EXTRA_IDE_WATCH paths surface as custom platform', () => {
  const o = emptyIdeOpts('extra');
  const extra = tmpDir('kodelyth-extra-');
  try {
    fs.writeFileSync(path.join(extra, 'log.txt'), 'hi');
    o.extraDirs = [extra];
    const list = data.ideSessionsList(o);
    const customs = list.filter(s => s.platform === 'custom');
    assert.equal(customs.length, 1);
    assert.equal(customs[0].path, extra);
  } finally { cleanup(extra); o._cleanup(); }
});

test('extraIdeWatchDirs: splits comma/semicolon/colon separated list', () => {
  const oldEnv = process.env.KODELYTH_EXTRA_IDE_WATCH;
  try {
    process.env.KODELYTH_EXTRA_IDE_WATCH = '/a/b , /c/d ; /e/f : /g/h';
    const dirs = data._internals.extraIdeWatchDirs();
    assert.deepEqual(dirs, ['/a/b', '/c/d', '/e/f', '/g/h']);
  } finally {
    if (oldEnv === undefined) delete process.env.KODELYTH_EXTRA_IDE_WATCH;
    else process.env.KODELYTH_EXTRA_IDE_WATCH = oldEnv;
  }
});

test('defaultCursorWorkspaceDir: returns an OS-appropriate path', () => {
  const oldEnv = process.env.KODELYTH_CURSOR_DIR;
  delete process.env.KODELYTH_CURSOR_DIR;
  try {
    const p = data._internals.defaultCursorWorkspaceDir();
    assert.match(p, /Cursor/);
  } finally {
    if (oldEnv !== undefined) process.env.KODELYTH_CURSOR_DIR = oldEnv;
  }
});

test('getMaxIdeMtime: returns 0 when no IDE dirs exist', () => {
  const o = emptyIdeOpts('mtime-zero');
  try {
    const m = data._internals.getMaxIdeMtime(o);
    assert.equal(m, 0);
  } finally { o._cleanup(); }
});

test('getMaxIdeMtime: reflects newest mtime across watched IDE files', async () => {
  const o = emptyIdeOpts('mtime-new');
  o.claudeProjectsDir = tmpDir('kodelyth-cc-mtime-');
  try {
    const proj = path.join(o.claudeProjectsDir, '-tmp-x');
    fs.mkdirSync(proj, { recursive: true });
    fs.writeFileSync(path.join(proj, 'first.jsonl'), 'x');
    await new Promise(r => setTimeout(r, 20));
    fs.writeFileSync(path.join(proj, 'second.jsonl'), 'y');

    const m = data._internals.getMaxIdeMtime(o);
    const newestStat = fs.statSync(path.join(proj, 'second.jsonl'));
    assert.equal(m, newestStat.mtimeMs);
  } finally { cleanup(o.claudeProjectsDir); o._cleanup(); }
});

test('getMaxIdeMtime: picks up windsurf-next + cursor + extra dirs', () => {
  const o = emptyIdeOpts('mtime-all');
  o.windsurfNextDir = tmpDir('kodelyth-wn-mt-');
  o.cursorDir       = tmpDir('kodelyth-cu-mt-');
  const extra       = tmpDir('kodelyth-extra-mt-');
  o.extraDirs       = [extra];
  try {
    fs.writeFileSync(path.join(o.windsurfNextDir, 's.json'), 'a');
    fs.mkdirSync(path.join(o.cursorDir, 'workspace1'), { recursive: true });
    fs.writeFileSync(path.join(extra, 'note.txt'), 'b');
    const m = data._internals.getMaxIdeMtime(o);
    assert.ok(m > 0, 'should return a positive mtime');
  } finally {
    cleanup(o.windsurfNextDir); cleanup(o.cursorDir); cleanup(extra); o._cleanup();
  }
});
