#!/usr/bin/env node
// =============================================================================
// Kodelyth ECC — MCP Server
// Universal adapter that exposes ECC agents, skills, commands, rules, and
// the local memory store to any MCP-compatible client (Claude Desktop,
// LangGraph, AutoGen, CrewAI, OpenAI Agents SDK, etc.).
//
// Transport: stdio (JSON-RPC over stdin/stdout).
// Run via:
//   npx kodelyth-ecc mcp
//   node scripts/mcp/server.js
// =============================================================================

'use strict';

const path = require('path');

const TOOLS     = require('./tools');
const PROMPTS   = require('./prompts');
const RESOURCES = require('./resources');
const catalog   = require('./catalog');

// ── Lazy SDK load with friendly install hint ─────────────────────────────────
function loadSdk() {
  try {
    return {
      Server: require('@modelcontextprotocol/sdk/server/index.js').Server,
      StdioServerTransport: require('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport,
      schemas: require('@modelcontextprotocol/sdk/types.js'),
    };
  } catch (e) {
    process.stderr.write(
      '\n❌ Kodelyth MCP server requires `@modelcontextprotocol/sdk`.\n' +
      '   Install it once with:\n\n' +
      '       npm install @modelcontextprotocol/sdk\n\n' +
      '   Or, if you ran via npx, the dependency should auto-install on next run.\n' +
      `   Underlying error: ${e.message}\n\n`
    );
    process.exit(1);
  }
}

// ── Read package metadata for server identity ────────────────────────────────
function loadIdentity() {
  try {
    const pkg = require(path.join(catalog.ROOT, 'package.json'));
    return { name: 'kodelyth-ecc', version: pkg.version || '0.0.0' };
  } catch {
    return { name: 'kodelyth-ecc', version: '0.0.0' };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const sdk = loadSdk();
  const { Server, StdioServerTransport, schemas } = sdk;
  const {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
  } = schemas;

  const identity = loadIdentity();

  const server = new Server(
    { name: identity.name, version: identity.version },
    {
      capabilities: {
        tools:     {},
        resources: {},
        prompts:   {},
      },
    }
  );

  // ── Tools ──────────────────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.TOOL_DEFINITIONS.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params || {};
    const handler = TOOLS.TOOL_HANDLERS[name];
    if (!handler) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    try {
      return handler(args || {});
    } catch (e) {
      return {
        content: [{ type: 'text', text: `Tool ${name} failed: ${e.message}` }],
        isError: true,
      };
    }
  });

  // ── Resources ──────────────────────────────────────────────────────────────
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES.buildList(),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const uri = req.params && req.params.uri;
    return RESOURCES.readResource(uri);
  });

  // ── Prompts ────────────────────────────────────────────────────────────────
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS.PROMPT_DEFINITIONS.map(p => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments || [],
    })),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const name = req.params && req.params.name;
    const handler = PROMPTS.PROMPT_HANDLERS[name];
    if (!handler) throw new Error(`Unknown prompt: ${name}`);
    return handler(req.params.arguments || {});
  });

  // ── Boot ───────────────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Stay alive until stdio closes.
  process.stderr.write(
    `[kodelyth-mcp] ready · ${identity.version} · ` +
    `${TOOLS.TOOL_DEFINITIONS.length} tools · ` +
    `${PROMPTS.PROMPT_DEFINITIONS.length} prompts · ` +
    `${RESOURCES.buildList().length} resources\n`
  );
}

if (require.main === module) {
  main().catch(e => {
    process.stderr.write(`[kodelyth-mcp] fatal: ${e.stack || e.message}\n`);
    process.exit(1);
  });
}

module.exports = { main };
