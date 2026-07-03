// =============================================================================
// Kodelyth ECC — MCP Client (registry + connect helpers)
//
// Lets ECC consume external MCP servers (Stripe, GitHub, Postgres, Brave,
// Redis, Filesystem, etc.). Pairs with scripts/mcp/server.js — together they
// make ECC the MCP HUB: serve to any framework, consume from any provider.
//
// Storage:
//   ~/.kodelythecc/mcp-clients.json     registry of named external servers
//
// Public API (all functions pure or local file-only):
//   loadRegistry(), saveRegistry(reg)
//   addServer({ name, command, args, env })
//   removeServer(name)
//   listServers()
//   getServer(name)
//
// Connection helpers (require @modelcontextprotocol/sdk):
//   connect(name)               -> { client, transport, close }
//   listTools(name)
//   callTool(name, tool, args)
//   listResources(name)
//   readResource(name, uri)
//   listPrompts(name)
//   getPrompt(name, prompt, args)
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const REGISTRY_DIR = process.env.KODELYTH_MCP_CLIENT_DIR
  || path.join(os.homedir(), '.kodelythecc');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'mcp-clients.json');

// ── Registry I/O ─────────────────────────────────────────────────────────────
function ensureDir(d) {
  try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); } catch {}
}

function loadRegistry() {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return { servers: {} };
    const raw = fs.readFileSync(REGISTRY_FILE, 'utf8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || !obj.servers) return { servers: {} };
    return obj;
  } catch {
    return { servers: {} };
  }
}

function saveRegistry(reg) {
  ensureDir(REGISTRY_DIR);
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2) + '\n');
}

// ── Registry mutations ───────────────────────────────────────────────────────
function addServer({ name, command, args = [], env = {}, description = '' }) {
  if (!name || typeof name !== 'string') throw new Error('addServer: `name` is required');
  if (!/^[a-z0-9][a-z0-9_\-]*$/i.test(name)) {
    throw new Error('addServer: name must be alphanumeric / dash / underscore (e.g. "redis", "github-mcp")');
  }
  if (!command || typeof command !== 'string') throw new Error('addServer: `command` is required');
  const reg = loadRegistry();
  reg.servers[name] = {
    name,
    command,
    args:        Array.isArray(args) ? args.map(String) : [],
    env:         (env && typeof env === 'object') ? env : {},
    description: String(description || ''),
    added_at:    new Date().toISOString(),
  };
  saveRegistry(reg);
  return reg.servers[name];
}

function removeServer(name) {
  const reg = loadRegistry();
  if (!reg.servers[name]) return false;
  delete reg.servers[name];
  saveRegistry(reg);
  return true;
}

function listServers() {
  const reg = loadRegistry();
  return Object.values(reg.servers).sort((a, b) => a.name.localeCompare(b.name));
}

function getServer(name) {
  const reg = loadRegistry();
  return reg.servers[name] || null;
}

// ── SDK lazy load ────────────────────────────────────────────────────────────
function loadSdk() {
  try {
    return {
      Client: require('@modelcontextprotocol/sdk/client/index.js').Client,
      StdioClientTransport: require('@modelcontextprotocol/sdk/client/stdio.js').StdioClientTransport,
    };
  } catch (e) {
    const err = new Error(
      'Kodelyth MCP client requires `@modelcontextprotocol/sdk`. ' +
      'Install with `npm install @modelcontextprotocol/sdk` or run via `npx -y kodelyth-ecc ...`. ' +
      `Underlying error: ${e.message}`
    );
    err.code = 'MCP_SDK_MISSING';
    throw err;
  }
}

// ── Connection helper ────────────────────────────────────────────────────────
async function connect(name) {
  const spec = getServer(name);
  if (!spec) {
    const err = new Error(`MCP server "${name}" is not registered. Use \`kodelyth-ecc mcp-add\` first.`);
    err.code = 'MCP_SERVER_NOT_REGISTERED';
    throw err;
  }
  const { Client, StdioClientTransport } = loadSdk();

  const transport = new StdioClientTransport({
    command: spec.command,
    args:    spec.args,
    env:     { ...process.env, ...spec.env },
  });
  const client = new Client(
    { name: 'kodelyth-ecc-client', version: '1.7.0' },
    { capabilities: {} }
  );
  await client.connect(transport);
  const close = async () => {
    try { await client.close(); } catch {}
  };
  return { client, transport, close, spec };
}

// ── Convenience wrappers ─────────────────────────────────────────────────────
async function withClient(name, fn) {
  const session = await connect(name);
  try {
    return await fn(session.client);
  } finally {
    await session.close();
  }
}

async function listTools(name)  { return withClient(name, c => c.listTools()); }
async function callTool(name, tool, args = {}) {
  return withClient(name, c => c.callTool({ name: tool, arguments: args }));
}
async function listResources(name) { return withClient(name, c => c.listResources()); }
async function readResource(name, uri) {
  return withClient(name, c => c.readResource({ uri }));
}
async function listPrompts(name) { return withClient(name, c => c.listPrompts()); }
async function getPrompt(name, promptName, args = {}) {
  return withClient(name, c => c.getPrompt({ name: promptName, arguments: args }));
}

module.exports = {
  REGISTRY_FILE,
  loadRegistry,
  saveRegistry,
  addServer,
  removeServer,
  listServers,
  getServer,
  connect,
  withClient,
  listTools,
  callTool,
  listResources,
  readResource,
  listPrompts,
  getPrompt,
};
