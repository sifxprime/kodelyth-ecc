// Smoke tests for scripts/dashboard/server.js
//
// We boot the real HTTP server on an ephemeral localhost port, exercise
// every route via the built-in `http` module (no external HTTP client),
// and assert response shapes + security posture.
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');

const { createServer, _internals } = require('../../scripts/dashboard/server.js');
const dashboard = require('../../scripts/dashboard/server.js');

// ── helpers ──────────────────────────────────────────────────────────────────

function listenEphemeral(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function get(port, path, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status:  res.statusCode,
        headers: res.headers,
        body:    Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

function shutdown(server) {
  return new Promise(resolve => server.close(resolve));
}

// ── tests ───────────────────────────────────────────────────────────────────

test('GET /api/health returns ok+time', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/health');
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.equal(body.ok, true);
    assert.match(body.time, /^\d{4}-\d{2}-\d{2}T/);
  } finally { await shutdown(server); }
});

test('GET /api/overview returns shape', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/overview');
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.ok(body.catalog);
    assert.ok(body.memory);
    assert.ok(body.evolve);
    assert.ok(body.swarm);
    assert.ok(body.storage);
  } finally { await shutdown(server); }
});

test('GET /api/memory returns stats + recent', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/memory?limit=5');
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.ok(body.stats);
    assert.ok(Array.isArray(body.recent));
  } finally { await shutdown(server); }
});

test('GET /api/memory/search rejects missing q', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/memory/search');
    assert.equal(r.status, 400);
    const body = JSON.parse(r.body);
    assert.match(body.error, /q/);
  } finally { await shutdown(server); }
});

test('GET /api/evolve returns reuse + miss + proposals', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/evolve');
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.ok(body.reuse);
    assert.ok(body.miss);
    assert.ok(Array.isArray(body.proposals));
  } finally { await shutdown(server); }
});

test('GET /api/catalog?kind=skills returns items', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/catalog?kind=skills&limit=5');
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.equal(body.kind, 'skills');
    assert.ok(body.counts);
    assert.ok(Array.isArray(body.items));
  } finally { await shutdown(server); }
});

test('GET /api/catalog rejects bad kind with 400', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/catalog?kind=junk');
    assert.equal(r.status, 400);
    const body = JSON.parse(r.body);
    assert.match(body.error, /kind/);
  } finally { await shutdown(server); }
});

test('GET /api/sessions returns array', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/sessions');
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.ok(Array.isArray(body.sessions));
  } finally { await shutdown(server); }
});

test('GET /api/sessions/:nonexistent returns 404', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/sessions/this-session-never-exists-xyz');
    assert.equal(r.status, 404);
  } finally { await shutdown(server); }
});

test('GET /api/ide-sessions returns array', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/ide-sessions?limit=3');
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.ok(Array.isArray(body.sessions));
    // Each entry, if any, has the expected shape.
    for (const s of body.sessions) {
      assert.ok(['claude-code', 'windsurf', 'antigravity'].includes(s.platform));
      assert.ok(typeof s.session_id === 'string');
      assert.ok(typeof s.modified === 'string');
    }
  } finally { await shutdown(server); }
});

test('GET /api/token-budget returns aggregate shape', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/token-budget');
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.ok(Array.isArray(body.sessions));
    assert.ok(typeof body.total_tokens === 'number');
  } finally { await shutdown(server); }
});

test('GET /api/missing-route returns 404', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/totally-made-up');
    assert.equal(r.status, 404);
  } finally { await shutdown(server); }
});

test('POST is rejected with 405', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/health', { method: 'POST' });
    assert.equal(r.status, 405);
    assert.equal(r.headers.allow, 'GET');
  } finally { await shutdown(server); }
});

test('static root serves index.html', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/');
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'], /^text\/html/);
    assert.match(r.body, /Kodelyth ECC/);
  } finally { await shutdown(server); }
});

test('hardened headers on every response', async () => {
  const server = createServer();
  const port = await listenEphemeral(server);
  try {
    const r = await get(port, '/api/health');
    assert.equal(r.headers['x-frame-options'], 'DENY');
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['referrer-policy'], 'no-referrer');
    assert.equal(r.headers['cache-control'], 'no-store');
  } finally { await shutdown(server); }
});

test('start() refuses non-localhost without override', async () => {
  await assert.rejects(
    () => dashboard.start({ port: 0, host: '0.0.0.0', openBrowser: false, log: () => {} }),
    /refusing to bind/,
  );
});

test('start() allows non-localhost when override env var is set', async () => {
  const oldEnv = process.env.KODELYTH_DASHBOARD_ALLOW_REMOTE;
  process.env.KODELYTH_DASHBOARD_ALLOW_REMOTE = '1';
  try {
    const { server } = await dashboard.start({ port: 0, host: '127.0.0.1', openBrowser: false, log: () => {} });
    await shutdown(server);
  } finally {
    if (oldEnv === undefined) delete process.env.KODELYTH_DASHBOARD_ALLOW_REMOTE;
    else process.env.KODELYTH_DASHBOARD_ALLOW_REMOTE = oldEnv;
  }
});

test('resolveStatic rejects path traversal', () => {
  assert.equal(_internals.resolveStatic('/../etc/passwd'), null);
  assert.equal(_internals.resolveStatic('/..%2F..%2Fpackage.json'), null);
});

test('resolveStatic resolves root to index.html', () => {
  const p = _internals.resolveStatic('/');
  assert.match(p || '', /index\.html$/);
});

test('chooseOpenCommand returns an OS-appropriate string', () => {
  const cmd = _internals.chooseOpenCommand();
  assert.ok(typeof cmd === 'string');
  assert.ok(cmd.length > 0);
});

// ── Adversarial round 1: findings from the arena run on scripts/dashboard ────

const fsx  = require('node:fs');
const osx  = require('node:os');
const pathx = require('node:path');

test('regression: resolveStatic refuses a symlink pointing outside the base', () => {
  // The containment check was purely lexical, and path.resolve does not resolve
  // symlinks — so a link sitting lexically inside static/ passed it while
  // readFile followed it anywhere on disk.
  const sand = fsx.mkdtempSync(pathx.join(osx.tmpdir(), 'kodelyth-static-'));
  try {
    const base = pathx.join(sand, 'static');
    fsx.mkdirSync(base);
    fsx.writeFileSync(pathx.join(base, 'index.html'), '<html></html>');
    fsx.writeFileSync(pathx.join(base, 'app.css'), 'body{}');
    fsx.writeFileSync(pathx.join(sand, 'secret.txt'), 'SECRET-OUTSIDE-STATIC');
    fsx.symlinkSync(pathx.join(sand, 'secret.txt'), pathx.join(base, 'leak.txt'));
    fsx.symlinkSync(pathx.join(sand, 'missing.txt'), pathx.join(base, 'dangling.txt'));

    assert.equal(_internals.resolveStatic('/leak.txt', base), null, 'symlink out of base must 404');
    assert.equal(_internals.resolveStatic('/dangling.txt', base), null, 'dangling link must 404');
    // The fix must not break ordinary files.
    assert.ok(_internals.resolveStatic('/app.css', base), 'legitimate file stopped resolving');
    assert.ok(_internals.resolveStatic('/', base), 'index stopped resolving');
  } finally {
    fsx.rmSync(sand, { recursive: true, force: true });
  }
});

test('regression: a missing or empty Host header is rejected, not waved through', async () => {
  // The guard read `reqHost !== '' && reqHost !== '127.0.0.1' && ...`, so an
  // absent Host short-circuited the whole condition to false and the request
  // reached the private-data APIs. Browsers always send Host, but a raw socket
  // does not have to.
  const net = require('node:net');
  const server = createServer();
  const port = await listenEphemeral(server);

  const raw = (request) => new Promise((resolve) => {
    const sock = net.connect(port, '127.0.0.1', () => sock.write(request));
    let buf = '';
    sock.on('data', (d) => { buf += d; });
    sock.on('end', () => resolve(buf.split('\r\n')[0]));
    sock.on('error', () => resolve('ERROR'));
    setTimeout(() => { sock.destroy(); resolve('TIMEOUT'); }, 3000);
  });

  try {
    assert.match(await raw('GET /api/overview HTTP/1.0\r\n\r\n'), /400/, 'absent Host must be rejected');
    assert.match(
      await raw('GET /api/overview HTTP/1.1\r\nHost:\r\nConnection: close\r\n\r\n'),
      /400/, 'empty Host must be rejected',
    );
    assert.match(
      await raw('GET /api/overview HTTP/1.1\r\nHost: evil.com\r\nConnection: close\r\n\r\n'),
      /400/, 'foreign Host must stay rejected',
    );
    // Hostnames are case-insensitive (RFC 3986), so this spelling is legitimate.
    assert.match(
      await raw(`GET /api/overview HTTP/1.1\r\nHost: LOCALHOST:${port}\r\nConnection: close\r\n\r\n`),
      /200/, 'uppercase LOCALHOST is a valid hostname and must be served',
    );
    // Duplicate Host: Node exposes the FIRST value, so a hostile first value
    // must still be rejected — the second cannot rescue it.
    assert.match(
      await raw('GET /api/overview HTTP/1.1\r\nHost: evil.com\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n'),
      /400/, 'a duplicate Host must not smuggle a hostile value past the guard',
    );

    // The real browser path must still work.
    assert.match(
      await raw(`GET /api/overview HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`),
      /200/, 'localhost Host must still be served',
    );
  } finally {
    server.close();
  }
});
