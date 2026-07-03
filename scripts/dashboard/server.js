// scripts/dashboard/server.js
//
// Local observability dashboard server (v1.8.0).
//
// HTTP server using ONLY Node.js built-ins. Serves:
//   GET  /                        → static index.html
//   GET  /api/overview            → counts + storage paths
//   GET  /api/memory              → stats + recent captures
//   GET  /api/memory/search?q=…   → BM25 search
//   GET  /api/evolve              → reuse + miss + proposals
//   GET  /api/catalog?kind=…&q=…  → agents | skills | commands | rules | bundles
//   GET  /api/sessions            → orchestration session list
//   GET  /api/sessions/:name      → single session detail
//   GET  /api/ide-sessions        → live Claude Code / Windsurf / Antigravity activity
//   GET  /api/token-budget        → per-session token usage
//   GET  /api/events              → SSE stream of data-changed events
//   GET  /api/health              → tiny liveness probe
//
// Default bind: 127.0.0.1 (localhost ONLY). Refuses to bind 0.0.0.0 unless
// the caller explicitly opts in. Zero telemetry. No external deps.
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execFileSync } = require('child_process');

const data = require('./data.js');

// ── SSE (Server-Sent Events) — real-time push to connected browsers ───────────

const sseClients = new Set();
const MAX_SSE_CLIENTS = 10;

// Key files that signal data changes when their mtime moves.
// IMPORTANT: include both `routing-misses.jsonl` (always present once evolve sees
// any miss) AND `proposals.jsonl` (created later, after `evolve analyze` runs).
const WATCH_PATHS = [
  path.join(os.homedir(), '.kodelythecc', 'memory',  'memories.jsonl'),
  path.join(os.homedir(), '.kodelythecc', 'evolve',  'reuse.json'),
  path.join(os.homedir(), '.kodelythecc', 'evolve',  'routing-misses.jsonl'),
  path.join(os.homedir(), '.kodelythecc', 'evolve',  'proposals.jsonl'),
  path.join(os.homedir(), '.kodelythecc', 'token-budget'), // dir mtime — changes when budget files appear
];
const lastMtimes    = new Map();
let   lastIdeMtime  = 0; // max mtime across Claude Code / Windsurf / Antigravity sessions
const FILE_CHECK_MS = 3000; // poll every 3 s — "feels live" without burning CPU

function broadcastSSE(obj) {
  const msg = `data: ${JSON.stringify(obj)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch { sseClients.delete(client); }
  }
}

let _fileWatchTimer = null;

function startFileWatcher() {
  if (_fileWatchTimer) return; // already running
  // Prime mtimes so the first tick doesn't fire 'data-changed' spuriously.
  for (const p of WATCH_PATHS) {
    try { lastMtimes.set(p, fs.statSync(p).mtimeMs); } catch { /* file not yet present */ }
  }
  try { lastIdeMtime = data._internals.getMaxIdeMtime(); } catch { lastIdeMtime = 0; }

  _fileWatchTimer = setInterval(() => {
    if (sseClients.size === 0) return; // no connected browsers — skip stat I/O
    let changed = false;

    // Static watched files (memory, evolve, token-budget).
    for (const p of WATCH_PATHS) {
      try {
        const m = fs.statSync(p).mtimeMs;
        if (lastMtimes.get(p) !== m) { changed = true; lastMtimes.set(p, m); }
      } catch { /* file doesn't exist yet — that's fine */ }
    }

    // Live IDE activity — Claude Code / Windsurf / Antigravity.
    // Cheap: only stats jsonl files in known dirs, capped at 500 files per tick.
    try {
      const m = data._internals.getMaxIdeMtime();
      if (m > lastIdeMtime) { changed = true; lastIdeMtime = m; }
    } catch { /* swallow — IDE watch must never break the heartbeat */ }

    broadcastSSE({ type: changed ? 'data-changed' : 'heartbeat', time: new Date().toISOString() });
  }, FILE_CHECK_MS);
}

function stopFileWatcher() {
  if (_fileWatchTimer) { clearInterval(_fileWatchTimer); _fileWatchTimer = null; }
}
process.on('exit', stopFileWatcher);

// ─────────────────────────────────────────────────────────────────────────────

const STATIC_DIR = path.join(__dirname, 'static');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
};

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type':  'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    // Reinforce localhost-only posture: refuse to be embedded in foreign frames.
    'Content-Security-Policy':  "default-src 'none'",
    'X-Frame-Options':          'DENY',
    'X-Content-Type-Options':   'nosniff',
    'Referrer-Policy':          'no-referrer',
    // Dashboard is read-only; no CORS allowed.
    'Cache-Control':            'no-store',
  });
  res.end(body);
}

function notFound(res) {
  jsonResponse(res, 404, { ok: false, error: 'not found' });
}

function badRequest(res, msg) {
  jsonResponse(res, 400, { ok: false, error: msg });
}

function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (err, body) => {
    if (err) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type':            MIME[ext] || 'application/octet-stream',
      'Content-Length':          body.length,
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self';",
      'X-Frame-Options':         'DENY',
      'X-Content-Type-Options':  'nosniff',
      'Referrer-Policy':         'no-referrer',
      'Cache-Control':           'no-store',
    });
    res.end(body);
  });
}

// Defensive — block path traversal, only allow files under STATIC_DIR.
function resolveStatic(reqPath) {
  const decoded = decodeURIComponent(reqPath.replace(/^\/+/, ''));
  if (decoded.includes('..')) return null;
  if (decoded === '' || decoded === '/') return path.join(STATIC_DIR, 'index.html');
  const abs = path.resolve(STATIC_DIR, decoded);
  if (!abs.startsWith(STATIC_DIR + path.sep) && abs !== path.join(STATIC_DIR, 'index.html')) return null;
  return abs;
}

// ── route handlers ───────────────────────────────────────────────────────────

function handleRequest(req, res) {
  // DNS-rebinding defence: only respond to requests targeting localhost.
  const reqHost = (req.headers.host || '').split(':')[0];
  if (reqHost !== '' && reqHost !== '127.0.0.1' && reqHost !== 'localhost') {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: false, error: 'bad request' }));
  }

  // Only GET is supported. The dashboard is purely read-only.
  if (req.method !== 'GET') {
    const body = JSON.stringify({ ok: false, error: 'method not allowed' });
    res.writeHead(405, {
      'Content-Type':           'application/json; charset=utf-8',
      'Content-Length':         Buffer.byteLength(body),
      'Allow':                  'GET',
      'Content-Security-Policy':"default-src 'none'",
      'X-Frame-Options':        'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control':          'no-store',
    });
    return res.end(body);
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const q = url.searchParams;

  try {
    // ── API routes ────────────────────────────────────────────────────────

    // SSE keep-alive: must be handled before the standard json routes because
    // we never call res.end() here — the connection stays open until the client
    // disconnects or the process exits.
    if (p === '/api/events') {
      if (sseClients.size >= MAX_SSE_CLIENTS) {
        return jsonResponse(res, 503, { ok: false, error: 'too many SSE connections' });
      }
      res.writeHead(200, {
        'Content-Type':          'text/event-stream',
        'Cache-Control':         'no-cache',
        'Connection':            'keep-alive',
        'X-Accel-Buffering':     'no',          // prevent nginx from buffering SSE
        'X-Content-Type-Options':'nosniff',
        'X-Frame-Options':       'DENY',
        'Referrer-Policy':       'no-referrer',
      });
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return; // intentionally no res.end() — keep connection alive
    }

    if (p === '/api/health') {
      return jsonResponse(res, 200, { ok: true, time: new Date().toISOString() });
    }

    if (p === '/api/overview') {
      return jsonResponse(res, 200, data.overview());
    }

    if (p === '/api/memory') {
      return jsonResponse(res, 200, {
        stats:  data.memoryStats(),
        recent: data.recentMemories({ limit: Number(q.get('limit')) || 20 }),
      });
    }

    if (p === '/api/memory/search') {
      const query = q.get('q') || '';
      if (!query) return badRequest(res, 'query parameter `q` is required');
      return jsonResponse(res, 200, {
        query,
        results: data.memorySearch({ query, limit: Number(q.get('limit')) || 10 }),
      });
    }

    if (p === '/api/evolve') {
      return jsonResponse(res, 200, data.evolveSnapshot({
        proposalLimit: Math.max(1, Math.min(200, Number(q.get('limit')) || 50)),
      }));
    }

    if (p === '/api/catalog') {
      const kind = q.get('kind');
      if (!kind) return badRequest(res, '`kind` parameter is required: agents | skills | commands | rules | bundles');
      if (!['agents', 'skills', 'commands', 'rules', 'bundles'].includes(kind)) {
        return badRequest(res, `kind must be one of agents | skills | commands | rules | bundles`);
      }
      return jsonResponse(res, 200, {
        kind,
        counts:  data.catalogCounts(),
        items:   data.catalogList({ kind, query: q.get('q') || '', limit: Number(q.get('limit')) || 50 }),
      });
    }

    if (p === '/api/sessions') {
      return jsonResponse(res, 200, {
        sessions: data.sessionsList({ limit: Number(q.get('limit')) || 30 }),
      });
    }

    if (p === '/api/ide-sessions') {
      return jsonResponse(res, 200, {
        sessions: data.ideSessionsList({ limit: Number(q.get('limit')) || 15 }),
      });
    }

    const sessMatch = p.match(/^\/api\/sessions\/([A-Za-z0-9._-]+)$/);
    if (sessMatch) {
      const sessionName = sessMatch[1];
      if (sessionName === '..' || sessionName === '.') return notFound(res);
      const detail = data.sessionDetail({ session: sessionName });
      if (!detail) return notFound(res);
      return jsonResponse(res, 200, detail);
    }

    if (p === '/api/token-budget') {
      return jsonResponse(res, 200, data.tokenBudgetSnapshot());
    }

    if (p === '/api/rtk/status') {
      const rtk = require('../rtk/index.js');
      return jsonResponse(res, 200, rtk.status());
    }

    if (p === '/api/rtk') {
      const rtk = require('../rtk/index.js');
      const st  = rtk.status();
      if (!st.installed) {
        return jsonResponse(res, 200, {
          ok: false,
          installed: false,
          install_hint: 'Run: kodelyth-ecc rtk install',
        });
      }
      const s = rtk.savings({ days: Number(q.get('days')) || 30 });
      return jsonResponse(res, 200, { ok: true, installed: true, version: st.version, active: st.active, ...s });
    }

    if (p === '/api/terse') {
      const ledger = require('../terse/ledger.js');
      const s = ledger.summary({ days: Number(q.get('days')) || 30 });
      return jsonResponse(res, 200, { ok: true, ...s });
    }

    if (p.startsWith('/api/')) return notFound(res);

    // ── static fallback ───────────────────────────────────────────────────
    const filePath = resolveStatic(p);
    if (!filePath) return notFound(res);
    return serveStaticFile(res, filePath);
  } catch (err) {
    process.stderr.write(`[dashboard] route ${p}: ${err.message}\n`);
    return jsonResponse(res, 500, { ok: false, error: 'internal server error' });
  }
}

// ── public entry: createServer / start ───────────────────────────────────────

function createServer() {
  return http.createServer(handleRequest);
}

function chooseOpenCommand() {
  switch (process.platform) {
    case 'darwin': return 'open';
    case 'win32':  return 'start ""';
    default:       return 'xdg-open';
  }
}

function tryOpenBrowser(url) {
  try {
    // Use execFileSync (no shell) to prevent shell injection via crafted --host values.
    if (process.platform === 'win32') {
      execFileSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' });
    } else {
      execFileSync(chooseOpenCommand(), [url], { stdio: 'ignore' });
    }
    return true;
  } catch { return false; }
}

function start({ port = 5747, host = '127.0.0.1', openBrowser = true, log = console.log } = {}) {
  return new Promise((resolve, reject) => {
    if (host !== '127.0.0.1' && host !== 'localhost' && !process.env.KODELYTH_DASHBOARD_ALLOW_REMOTE) {
      return reject(new Error(
        `[dashboard] refusing to bind host=${host}. Dashboard is localhost-only by default.\n` +
        `To override (UNSAFE — exposes your memory + evolve data), set KODELYTH_DASHBOARD_ALLOW_REMOTE=1.`
      ));
    }
    const server = createServer();
    startFileWatcher();
    server.once('close', stopFileWatcher);
    server.once('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const url = `http://${host}:${addr.port}/`;
      log(`✓ Kodelyth ECC dashboard\n  ${url}`);
      log(`  Press Ctrl+C to stop. Localhost only — zero telemetry.`);
      if (openBrowser) tryOpenBrowser(url);
      resolve({ server, url, port: addr.port });
    });
  });
}

module.exports = {
  start,
  createServer,
  handleRequest,
  // exposed for tests
  _internals: { resolveStatic, chooseOpenCommand, startFileWatcher, stopFileWatcher },
};
