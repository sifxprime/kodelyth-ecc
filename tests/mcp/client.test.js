// Tests for scripts/mcp/client.js — registry + connect helpers.
// Uses the LOCAL Kodelyth MCP server itself as a real test target so we
// exercise the full stdio handshake without needing external dependencies.
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

// Isolate the registry to a tmp dir so we don't pollute ~/.kodelyth.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-mcp-client-'));
process.env.KODELYTH_MCP_CLIENT_DIR = TMP;

const C = require('../../scripts/mcp/client.js');

const ROOT = path.join(__dirname, '..', '..');
const LOCAL_SERVER = path.join(ROOT, 'scripts', 'mcp', 'server.js');

// ── Registry tests (no SDK required) ─────────────────────────────────────────

test('registry: starts empty', () => {
  const reg = C.loadRegistry();
  assert.deepEqual(reg.servers, {});
  assert.deepEqual(C.listServers(), []);
});

test('registry: addServer persists with sane defaults', () => {
  const spec = C.addServer({
    name: 'self',
    command: process.execPath,
    args: [LOCAL_SERVER],
    env: { TEST_VAR: '1' },
    description: 'local self-test target',
  });
  assert.equal(spec.name, 'self');
  assert.equal(spec.command, process.execPath);
  assert.deepEqual(spec.args, [LOCAL_SERVER]);
  assert.equal(spec.env.TEST_VAR, '1');
  assert.ok(spec.added_at);

  // Persisted to disk:
  assert.ok(fs.existsSync(C.REGISTRY_FILE));
  const onDisk = JSON.parse(fs.readFileSync(C.REGISTRY_FILE, 'utf8'));
  assert.equal(onDisk.servers.self.name, 'self');
});

test('registry: rejects bad names', () => {
  assert.throws(() => C.addServer({ name: '',         command: 'x' }));
  assert.throws(() => C.addServer({ name: 'has space',command: 'x' }));
  assert.throws(() => C.addServer({ name: 'self',     command: ''  }));
});

test('registry: getServer / listServers reflect adds + removes', () => {
  C.addServer({ name: 'second', command: '/usr/bin/true', args: [] });
  const list = C.listServers();
  assert.equal(list.length, 2, `expected 2, got ${list.length}`);
  const names = list.map(s => s.name).sort();
  assert.deepEqual(names, ['second', 'self']);

  assert.ok(C.getServer('self'));
  assert.equal(C.getServer('not-real'), null);

  assert.equal(C.removeServer('second'), true);
  assert.equal(C.removeServer('second'), false); // already gone
  assert.equal(C.listServers().length, 1);
});

// ── End-to-end: connect to local kodelyth MCP server and call tools ──────────
// These tests require @modelcontextprotocol/sdk (optionalDependency).
// Skip gracefully when it isn't installed (e.g. CI without optional deps).
let hasSdk = false;
try { require('@modelcontextprotocol/sdk/client/index.js'); hasSdk = true; } catch (_) {}

test('client: connects to local kodelyth MCP server and lists tools', { skip: !hasSdk }, async () => {
  // self is already registered from the earlier test (running in same file).
  const out = await C.listTools('self');
  assert.ok(out.tools.length > 0, 'expected at least one tool from local kodelyth server');
  const names = new Set(out.tools.map(t => t.name));
  assert.ok(names.has('catalog_stats'), 'catalog_stats tool must be exposed');
  assert.ok(names.has('list_agents'),   'list_agents tool must be exposed');
});

test('client: callTool on local server returns a real result', { skip: !hasSdk }, async () => {
  const out = await C.callTool('self', 'catalog_stats', {});
  assert.ok(Array.isArray(out.content));
  assert.equal(out.content[0].type, 'text');
  const data = JSON.parse(out.content[0].text);
  assert.ok(data.agents > 0);
  assert.ok(data.skills > 0);
  assert.ok(data.commands > 0);
});

test('client: listResources surfaces kodelyth:// URIs', { skip: !hasSdk }, async () => {
  const out = await C.listResources('self');
  assert.ok(out.resources.length > 0);
  assert.ok(out.resources.every(r => r.uri.startsWith('kodelyth://')),
    'every resource uri should start with kodelyth://');
});

test('client: listPrompts surfaces routing-rule', { skip: !hasSdk }, async () => {
  const out = await C.listPrompts('self');
  const names = new Set(out.prompts.map(p => p.name));
  assert.ok(names.has('routing-rule'));
});

test('client: connect fails clearly for unregistered server', async () => {
  await assert.rejects(
    () => C.connect('this-was-never-registered'),
    err => err.code === 'MCP_SERVER_NOT_REGISTERED'
  );
});
