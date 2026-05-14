// scripts/dashboard/data.js
//
// Local observability dashboard: pure aggregators (v1.8.0).
//
// All data the dashboard renders comes from:
//   - The MCP catalog (filesystem reads of agents/, skills/, commands/, rules/, bundles/)
//   - The BM25 memory store (~/.kodelyth/memory/)
//   - The evolve signal streams (~/.kodelyth/evolve/)
//   - The token-budget hook state (${KODELYTH_TOKEN_BUDGET_DIR})
//   - The orchestration session dirs (.orchestration/<session>/)
//   - Live IDE session activity (Claude Code, Windsurf, Antigravity)
//
// Every aggregator is pure: takes its inputs explicitly OR uses well-defined
// env-overridable defaults. No global mutable state. Errors are swallowed
// and replaced with sane empty defaults — the dashboard must never crash
// because one data source is unavailable.
'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Lazy + defensive requires — the dashboard renders even if one module is broken.
function safeRequire(rel) {
  try { return require(path.join(ROOT, rel)); } catch { return null; }
}

const memoryStore = safeRequire('scripts/memory/store.js');
const catalog     = safeRequire('scripts/mcp/catalog.js');
const evolveStats = safeRequire('scripts/evolve/stats.js');
const evolveProposals = safeRequire('scripts/evolve/proposals.js');

// ── helpers ──────────────────────────────────────────────────────────────────

function defaultMemoryDir() {
  return process.env.KODELYTH_MEMORY_DIR || path.join(os.homedir(), '.kodelyth', 'memory');
}
function defaultEvolveDir() {
  return process.env.KODELYTH_EVOLVE_DIR || path.join(os.homedir(), '.kodelyth', 'evolve');
}
function defaultBudgetDir() {
  return process.env.KODELYTH_TOKEN_BUDGET_DIR || path.join(os.homedir(), '.kodelyth', 'token-budget');
}
function defaultCoordRoot() {
  return process.env.KODELYTH_COORDINATION_ROOT || path.join(process.cwd(), '.orchestration');
}
function defaultClaudeProjectsDir() {
  return process.env.KODELYTH_CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
}
function defaultWindsurfStateDir() {
  return process.env.KODELYTH_WINDSURF_DIR || path.join(os.homedir(), '.codeium', 'windsurf');
}
function defaultWindsurfNextStateDir() {
  // Windsurf Next (newer Codeium release) uses a separate state dir.
  return process.env.KODELYTH_WINDSURF_NEXT_DIR || path.join(os.homedir(), '.codeium', 'windsurf-next');
}
function defaultCursorWorkspaceDir() {
  if (process.env.KODELYTH_CURSOR_DIR) return process.env.KODELYTH_CURSOR_DIR;
  const home = os.homedir();
  switch (process.platform) {
    case 'darwin': return path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'workspaceStorage');
    case 'win32':  return path.join(home, 'AppData', 'Roaming', 'Cursor', 'User', 'workspaceStorage');
    default:       return path.join(home, '.config', 'Cursor', 'User', 'workspaceStorage');
  }
}
function defaultAntigravityStateDir() {
  // Best-effort — Google Antigravity is in early access and the canonical session
  // path is not yet documented. Users can override via KODELYTH_ANTIGRAVITY_DIR.
  return process.env.KODELYTH_ANTIGRAVITY_DIR || path.join(os.homedir(), '.antigravity');
}
// Comma-separated extra dirs from env. Each path's mtime contributes to SSE.
function extraIdeWatchDirs() {
  const raw = process.env.KODELYTH_EXTRA_IDE_WATCH || '';
  return raw.split(/[,;:]/).map(s => s.trim()).filter(Boolean);
}

function safeReadDir(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; }
}
function safeStat(p) {
  try { return fs.statSync(p); } catch { return null; }
}
function safeReadJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return fallback; }
}

// ── overview ─────────────────────────────────────────────────────────────────

function overview({
  repoRoot   = ROOT,
  memoryDir  = defaultMemoryDir(),
  evolveDir  = defaultEvolveDir(),
  coordRoot  = defaultCoordRoot(),
} = {}) {
  let catalogStats = { agents: 0, skills: 0, commands: 0, rules: 0, bundles: 0 };
  if (catalog?.stats) {
    try { catalogStats = catalog.stats(); } catch { /* swallow */ }
  }

  let memoryTotal = 0;
  let memoryProjects = 0;
  if (memoryStore?.stats) {
    try {
      const ms = memoryStore.stats();
      memoryTotal = ms.total || 0;
      memoryProjects = ms.projects || 0;
    } catch { /* swallow */ }
  }

  let proposalsCounts = { pending: 0, accepted: 0, rejected: 0, applied: 0, total: 0 };
  if (evolveProposals?.readLatest) {
    try {
      const all = evolveProposals.readLatest(evolveDir);
      proposalsCounts.total = all.length;
      for (const p of all) {
        if (p.status && proposalsCounts[p.status] !== undefined) {
          proposalsCounts[p.status] += 1;
        }
      }
    } catch { /* swallow */ }
  }

  let routingMisses = 0;
  if (evolveStats?.getRoutingMissStats) {
    try { routingMisses = evolveStats.getRoutingMissStats(evolveDir).total_misses || 0; } catch { /* */ }
  }

  let surfaceTotal = 0;
  if (evolveStats?.getReuseStats) {
    try { surfaceTotal = evolveStats.getReuseStats(evolveDir).total_surfaces || 0; } catch { /* */ }
  }

  let sessionsCount = 0;
  try {
    if (fs.existsSync(coordRoot)) {
      sessionsCount = safeReadDir(coordRoot).filter(e => e.isDirectory()).length;
    }
  } catch { /* */ }

  return {
    package_root: repoRoot,
    storage: {
      memory_dir:  memoryDir,
      evolve_dir:  evolveDir,
      coord_root:  coordRoot,
      home:        os.homedir(),
    },
    catalog: catalogStats,
    memory:  { total: memoryTotal, projects: memoryProjects },
    evolve:  {
      proposals:       proposalsCounts,
      routing_misses:  routingMisses,
      surfaces_total:  surfaceTotal,
    },
    swarm: {
      sessions: sessionsCount,
    },
    generated_at: new Date().toISOString(),
  };
}

// ── memory ───────────────────────────────────────────────────────────────────

// NOTE: the memory store reads `KODELYTH_MEMORY_DIR` once at require time
// and freezes its path. The dashboard therefore reads from whatever store
// path was configured at boot — there's no way to redirect mid-process.
// `memoryDir` here is reported back via /api/overview but cannot be
// overridden per-call.
function memoryStats() {
  if (!memoryStore?.stats) return { total: 0, projects: 0, byLanguage: {}, topTags: [], storageDir: defaultMemoryDir() };
  try { return memoryStore.stats(); }
  catch { return { total: 0, projects: 0, byLanguage: {}, topTags: [], storageDir: defaultMemoryDir() }; }
}

function recentMemories({ limit = 20 } = {}) {
  if (!memoryStore?.listAll) return [];
  try {
    const all = memoryStore.listAll();
    all.sort((a, b) => String(b.captured_at || '').localeCompare(String(a.captured_at || '')));
    return all.slice(0, Math.max(1, Math.min(200, limit))).map(m => ({
      id:           m.id,
      captured_at:  m.captured_at,
      problem:      m.problem,
      approach:     (m.approach || '').slice(0, 240),
      tags:         m.tags || [],
      language:     m.language || null,
      project_path: m.project_path || null,
      source:       m.source || null,
    }));
  } catch { return []; }
}

function memorySearch({ query, limit = 10 } = {}) {
  if (!memoryStore?.recall || !query) return [];
  try {
    const results = memoryStore.recall(query, { limit: Math.max(1, Math.min(50, limit)) });
    return results.map(r => ({
      id:       r.id,
      score:    Number((r.score || 0).toFixed(3)),
      problem:  r.problem,
      approach: (r.approach || '').slice(0, 240),
      tags:     r.tags || [],
      language: r.language || null,
    }));
  } catch { return []; }
}

// ── evolve ───────────────────────────────────────────────────────────────────

function evolveSnapshot({ evolveDir = defaultEvolveDir(), proposalLimit = 50 } = {}) {
  proposalLimit = Math.max(1, Math.min(200, proposalLimit));
  let reuse = { total_memories_tracked: 0, total_surfaces: 0, last_updated: null, entries: [] };
  let miss  = { total_misses: 0, unique_prompts: 0, entries: [] };
  if (evolveStats?.getReuseStats) {
    try { reuse = evolveStats.getReuseStats(evolveDir); } catch { /* */ }
  }
  if (evolveStats?.getRoutingMissStats) {
    try { miss = evolveStats.getRoutingMissStats(evolveDir); } catch { /* */ }
  }

  let proposals = [];
  if (evolveProposals?.readLatest) {
    try {
      proposals = evolveProposals.readLatest(evolveDir).slice(0, proposalLimit).map(p => ({
        id:           p.id,
        type:         p.type,
        status:       p.status,
        created_at:   p.created_at,
        last_updated: p.last_updated || p.timestamp,
        target_path:  p.proposal?.target_path || null,
        rationale:    p.proposal?.rationale || null,
        applied_path: p.applied_path || null,
        note:         p.note || null,
      }));
    } catch { /* */ }
  }

  return { reuse, miss, proposals };
}

// ── catalog ──────────────────────────────────────────────────────────────────

function catalogList({ kind, query = '', limit = 50 } = {}) {
  if (!catalog) return [];
  const fnByKind = {
    agents:   catalog.loadAgents,
    skills:   catalog.loadSkills,
    commands: catalog.loadCommands,
    rules:    catalog.loadRules,
    bundles:  catalog.loadBundles,
  };
  const fn = fnByKind[kind];
  if (!fn) return [];

  let items;
  try { items = fn() || []; } catch { return []; }

  const q = String(query || '').toLowerCase().trim();
  if (q) {
    items = items.filter(it => {
      const hay = `${it.name || ''} ${it.description || ''} ${(it.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }
  return items.slice(0, Math.max(1, Math.min(500, limit))).map(it => ({
    name:        it.name,
    description: it.description || '',
    tags:        it.tags || [],
    path:        it.path || null,
    origin:      it.origin || null,
  }));
}

function catalogCounts() {
  if (!catalog?.stats) return { agents: 0, skills: 0, commands: 0, rules: 0, bundles: 0 };
  try { return catalog.stats(); } catch { return { agents: 0, skills: 0, commands: 0, rules: 0, bundles: 0 }; }
}

// ── sessions (orchestration / swarm) ─────────────────────────────────────────

function sessionsList({ coordRoot = defaultCoordRoot(), limit = 30 } = {}) {
  if (!fs.existsSync(coordRoot)) return [];
  const dirs = safeReadDir(coordRoot).filter(e => e.isDirectory());
  const out = [];
  for (const d of dirs) {
    const abs = path.join(coordRoot, d.name);
    const st = safeStat(abs);
    if (!st) continue;
    const workers = safeReadDir(abs).filter(e => e.isDirectory()).map(e => e.name);
    out.push({
      session: d.name,
      path:    abs,
      modified: st.mtime.toISOString(),
      workers,
      worker_count: workers.length,
    });
  }
  out.sort((a, b) => b.modified.localeCompare(a.modified));
  return out.slice(0, Math.max(1, Math.min(200, limit)));
}

function sessionDetail({ session, coordRoot = defaultCoordRoot() } = {}) {
  if (!session || session === '..' || session === '.') return null;
  const dir = path.join(coordRoot, session);
  // Containment check — ensure the resolved path stays within coordRoot.
  if (!dir.startsWith(coordRoot + path.sep) && dir !== coordRoot) return null;
  if (!fs.existsSync(dir)) return null;
  const workers = safeReadDir(dir).filter(e => e.isDirectory());
  return {
    session,
    path: dir,
    workers: workers.map(w => {
      const wdir = path.join(dir, w.name);
      const taskPath    = path.join(wdir, 'task.md');
      const handoffPath = path.join(wdir, 'handoff.md');
      const statusPath  = path.join(wdir, 'status.md');
      return {
        slug:        w.name,
        has_task:    fs.existsSync(taskPath),
        has_handoff: fs.existsSync(handoffPath),
        has_status:  fs.existsSync(statusPath),
        task_excerpt:    safeReadExcerpt(taskPath, 800),
        handoff_excerpt: safeReadExcerpt(handoffPath, 800),
        status_excerpt:  safeReadExcerpt(statusPath, 800),
      };
    }),
  };
}

function safeReadExcerpt(p, max = 800) {
  try {
    const content = fs.readFileSync(p, 'utf8');
    return content.length > max ? content.slice(0, max) + '\n…(truncated)' : content;
  } catch { return null; }
}

// ── IDE sessions (Claude Code / Windsurf / Antigravity) ──────────────────────
//
// Surfaces the AI coding sessions the user is actually running RIGHT NOW.
// Read-only filesystem stats — never reads JSONL contents (could be 27MB+).
// Caps the walk to keep watcher latency predictable.

const IDE_WALK_FILE_CAP = 500; // hard ceiling so a runaway dir can't hang the watcher

function decodeClaudeProjectName(name) {
  // Claude Code encodes the project's absolute path by replacing '/' with '-'.
  // Best-effort decode for display only — original separators are unrecoverable.
  if (!name) return null;
  return '/' + name.replace(/^-+/, '').replace(/-/g, '/');
}

function pushTopLevelFiles(sessions, dir, platform, cap, scannedRef) {
  if (!fs.existsSync(dir)) return;
  for (const entry of safeReadDir(dir)) {
    if (scannedRef.value++ > cap) break;
    if (!entry.isFile()) continue;
    const fp = path.join(dir, entry.name);
    const st = safeStat(fp);
    if (!st) continue;
    sessions.push({
      platform,
      session_id: entry.name,
      project:    null,
      path:       fp,
      size_bytes: st.size,
      modified:   st.mtime.toISOString(),
    });
  }
}

function ideSessionsList({
  claudeProjectsDir = defaultClaudeProjectsDir(),
  windsurfDir       = defaultWindsurfStateDir(),
  windsurfNextDir   = defaultWindsurfNextStateDir(),
  cursorDir         = defaultCursorWorkspaceDir(),
  antigravityDir    = defaultAntigravityStateDir(),
  extraDirs         = extraIdeWatchDirs(),
  cwd               = process.cwd(),
  limit             = 15,
} = {}) {
  const sessions = [];
  const scannedRef = { value: 0 };

  // Claude Code: ~/.claude/projects/<encoded-path>/<uuid>.jsonl
  if (fs.existsSync(claudeProjectsDir)) {
    for (const proj of safeReadDir(claudeProjectsDir)) {
      if (!proj.isDirectory()) continue;
      const projDir = path.join(claudeProjectsDir, proj.name);
      for (const f of safeReadDir(projDir)) {
        if (scannedRef.value++ > IDE_WALK_FILE_CAP) break;
        if (!f.isFile() || !f.name.endsWith('.jsonl')) continue;
        const fp = path.join(projDir, f.name);
        const st = safeStat(fp);
        if (!st) continue;
        sessions.push({
          platform:    'claude-code',
          session_id:  f.name.replace(/\.jsonl$/, ''),
          project:     decodeClaudeProjectName(proj.name),
          path:        fp,
          size_bytes:  st.size,
          modified:    st.mtime.toISOString(),
        });
      }
      if (scannedRef.value > IDE_WALK_FILE_CAP) break;
    }
  }

  // Windsurf (legacy) + Windsurf-Next: top-level state files only.
  pushTopLevelFiles(sessions, windsurfDir,     'windsurf',      IDE_WALK_FILE_CAP, scannedRef);
  pushTopLevelFiles(sessions, windsurfNextDir, 'windsurf-next', IDE_WALK_FILE_CAP, scannedRef);

  // Cursor: ~/Library/Application Support/Cursor/User/workspaceStorage/<hash>/
  // Each workspace is a directory containing .vscdb sqlite files; we surface
  // the directory mtime (proxies for last open) without reading SQLite.
  if (fs.existsSync(cursorDir)) {
    for (const ws of safeReadDir(cursorDir)) {
      if (scannedRef.value++ > IDE_WALK_FILE_CAP) break;
      if (!ws.isDirectory()) continue;
      const wsDir = path.join(cursorDir, ws.name);
      const st = safeStat(wsDir);
      if (!st) continue;
      sessions.push({
        platform:    'cursor',
        session_id:  ws.name,
        project:     null,
        path:        wsDir,
        size_bytes:  0,
        modified:    st.mtime.toISOString(),
      });
    }
  }

  // Antigravity (home dir, best-effort) + per-workspace .agent/ in cwd.
  if (fs.existsSync(antigravityDir)) {
    const st = safeStat(antigravityDir);
    if (st) {
      sessions.push({
        platform:    'antigravity',
        session_id:  'home',
        project:     null,
        path:        antigravityDir,
        size_bytes:  0,
        modified:    st.mtime.toISOString(),
      });
    }
  }
  const agentDir = path.join(cwd, '.agent');
  if (fs.existsSync(agentDir)) {
    const st = safeStat(agentDir);
    if (st) {
      sessions.push({
        platform:    'antigravity',
        session_id:  path.basename(cwd) || 'workspace',
        project:     cwd,
        path:        agentDir,
        size_bytes:  0,
        modified:    st.mtime.toISOString(),
      });
    }
  }

  // User-supplied extra paths (KODELYTH_EXTRA_IDE_WATCH).
  // We only record an entry when the path exists; otherwise we silently skip.
  for (const extra of extraDirs) {
    if (!fs.existsSync(extra)) continue;
    const st = safeStat(extra);
    if (!st) continue;
    sessions.push({
      platform:    'custom',
      session_id:  path.basename(extra) || 'extra',
      project:     extra,
      path:        extra,
      size_bytes:  st.isFile() ? st.size : 0,
      modified:    st.mtime.toISOString(),
    });
  }

  sessions.sort((a, b) => b.modified.localeCompare(a.modified));
  return sessions.slice(0, Math.max(1, Math.min(100, limit)));
}

// Cheap mtime aggregator used by the SSE file-watcher tick.
// Returns the largest mtimeMs across IDE session files. 0 if nothing found.
function getMaxIdeMtime({
  claudeProjectsDir = defaultClaudeProjectsDir(),
  windsurfDir       = defaultWindsurfStateDir(),
  windsurfNextDir   = defaultWindsurfNextStateDir(),
  cursorDir         = defaultCursorWorkspaceDir(),
  antigravityDir    = defaultAntigravityStateDir(),
  extraDirs         = extraIdeWatchDirs(),
  cwd               = process.cwd(),
} = {}) {
  let maxMs = 0;
  let scanned = 0;

  // Claude Code
  if (fs.existsSync(claudeProjectsDir)) {
    for (const proj of safeReadDir(claudeProjectsDir)) {
      if (!proj.isDirectory()) continue;
      const projDir = path.join(claudeProjectsDir, proj.name);
      for (const f of safeReadDir(projDir)) {
        if (scanned++ > IDE_WALK_FILE_CAP) break;
        if (!f.isFile() || !f.name.endsWith('.jsonl')) continue;
        const st = safeStat(path.join(projDir, f.name));
        if (st && st.mtimeMs > maxMs) maxMs = st.mtimeMs;
      }
      if (scanned > IDE_WALK_FILE_CAP) break;
    }
  }

  // Windsurf (legacy + next) — dir mtime + one level of files.
  for (const dir of [windsurfDir, windsurfNextDir]) {
    if (!fs.existsSync(dir)) continue;
    const st = safeStat(dir);
    if (st && st.mtimeMs > maxMs) maxMs = st.mtimeMs;
    for (const entry of safeReadDir(dir)) {
      if (scanned++ > IDE_WALK_FILE_CAP) break;
      if (!entry.isFile()) continue;
      const fst = safeStat(path.join(dir, entry.name));
      if (fst && fst.mtimeMs > maxMs) maxMs = fst.mtimeMs;
    }
  }

  // Cursor workspace dirs
  if (fs.existsSync(cursorDir)) {
    for (const ws of safeReadDir(cursorDir)) {
      if (scanned++ > IDE_WALK_FILE_CAP) break;
      if (!ws.isDirectory()) continue;
      const st = safeStat(path.join(cursorDir, ws.name));
      if (st && st.mtimeMs > maxMs) maxMs = st.mtimeMs;
    }
  }

  // Antigravity
  if (fs.existsSync(antigravityDir)) {
    const st = safeStat(antigravityDir);
    if (st && st.mtimeMs > maxMs) maxMs = st.mtimeMs;
  }
  const agentDir = path.join(cwd, '.agent');
  if (fs.existsSync(agentDir)) {
    const st = safeStat(agentDir);
    if (st && st.mtimeMs > maxMs) maxMs = st.mtimeMs;
  }

  // Extra user-supplied watch paths (KODELYTH_EXTRA_IDE_WATCH).
  for (const extra of extraDirs) {
    if (scanned++ > IDE_WALK_FILE_CAP) break;
    if (!fs.existsSync(extra)) continue;
    const st = safeStat(extra);
    if (st && st.mtimeMs > maxMs) maxMs = st.mtimeMs;
  }

  return maxMs;
}

// ── token budget snapshot ────────────────────────────────────────────────────

function tokenBudgetSnapshot({ budgetDir = defaultBudgetDir() } = {}) {
  if (!fs.existsSync(budgetDir)) return { sessions: [], total_tokens: 0 };
  const files = safeReadDir(budgetDir).filter(e => e.isFile() && e.name.startsWith('budget-') && e.name.endsWith('.json'));
  const sessions = [];
  let total = 0;
  for (const f of files) {
    const data = safeReadJson(path.join(budgetDir, f.name), null);
    if (!data) continue;
    sessions.push({
      session_id:  data.session_id || f.name.replace(/^budget-|\.json$/g, ''),
      tokens:      Number(data.tokens) || 0,
      budget:      data.budget || null,
      mode:        data.mode || null,
      last_event:  data.last_event || data.updated_at || null,
    });
    total += Number(data.tokens) || 0;
  }
  sessions.sort((a, b) => (b.last_event || '').localeCompare(a.last_event || ''));
  return { sessions: sessions.slice(0, 50), total_tokens: total };
}

module.exports = {
  // overview
  overview,
  // memory
  memoryStats,
  recentMemories,
  memorySearch,
  // evolve
  evolveSnapshot,
  // catalog
  catalogList,
  catalogCounts,
  // sessions (orchestration)
  sessionsList,
  sessionDetail,
  // ide sessions (claude code / windsurf / antigravity)
  ideSessionsList,
  // token budget
  tokenBudgetSnapshot,
  // exposed for tests + the file-watcher tick
  _internals: {
    defaultMemoryDir, defaultEvolveDir, defaultBudgetDir, defaultCoordRoot,
    defaultClaudeProjectsDir, defaultWindsurfStateDir, defaultWindsurfNextStateDir,
    defaultCursorWorkspaceDir, defaultAntigravityStateDir, extraIdeWatchDirs,
    safeReadDir, safeReadJson, safeReadExcerpt,
    getMaxIdeMtime,
  },
};
