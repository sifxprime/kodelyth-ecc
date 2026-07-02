// =============================================================================
// Kodelyth ECC — Dashboard v2 Server
//
// Minimal HTTP server that exposes the real-data panels from data-v2.
// Localhost-bound by default. Zero external deps.
//
// Routes:
//   GET  /                       → static v2 index.html
//   GET  /api/overview           → real fabric + counts
//   GET  /api/savings            → real token savings ledger
//   GET  /api/memory             → real memory store
//   GET  /api/routing            → real routing decisions
//   GET  /api/learning           → real instincts
//   GET  /api/graph?project=...  → per-project graph stats
//   GET  /api/sessions           → real session events
//   GET  /api/health             → tiny liveness probe
// =============================================================================

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const data = require('./data-v2');

const HOST = process.env.KODELYTH_DASH_HOST || '127.0.0.1';
const PORT = Number(process.env.KODELYTH_DASH_PORT) || 7443;

function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj, null, 2));
}

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
}

function serveFile(res, filePath, contentType) {
  try {
    const body = fs.readFileSync(filePath);
    res.writeHead(200, { 'content-type': contentType });
    res.end(body);
  } catch {
    notFound(res);
  }
}

function handle(req, res) {
  const parsed = new URL(req.url, 'http://localhost');
  const pathname = parsed.pathname;
  const q = Object.fromEntries(parsed.searchParams);

  try {
    if (pathname === '/api/health')   return json(res, 200, { ok: true, ts: new Date().toISOString() });
    if (pathname === '/api/overview') return json(res, 200, data.overview());
    if (pathname === '/api/savings')  return json(res, 200, data.savings({ project: q.project, since: q.since }));
    if (pathname === '/api/memory')   return json(res, 200, data.memoryPanel({ limit: Number(q.limit) || 10 }));
    if (pathname === '/api/routing')  return json(res, 200, data.routingPanel({ limit: Number(q.limit) || 20 }));
    if (pathname === '/api/learning') return json(res, 200, data.learningPanel());
    if (pathname === '/api/graph')    return json(res, 200, data.graphPanel(q.project || process.cwd()));
    if (pathname === '/api/sessions') return json(res, 200, data.sessionsPanel({ limit: Number(q.limit) || 25 }));

    if (pathname === '/' || pathname === '/index.html') {
      return serveFile(res, path.join(__dirname, 'static', 'v2.html'), 'text/html; charset=utf-8');
    }

    notFound(res);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
}

function start({ host = HOST, port = PORT } = {}) {
  const server = http.createServer(handle);
  server.listen(port, host, () => {
    process.stdout.write(`Kodelyth ECC dashboard v2 → http://${host}:${port}\n`);
  });
  return server;
}

if (require.main === module) start();

module.exports = { start, handle };
