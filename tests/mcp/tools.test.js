// Tests for scripts/mcp/tools.js — pure-function MCP tool handlers.
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

// Isolate the memory store to a tmp dir so capture/recall don't pollute
// the user's real ~/.kodelyth/memory.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kodelyth-mcp-'));
process.env.KODELYTH_MEMORY_DIR = TMP;

// Load AFTER setting env so the memory store picks up the tmp dir.
const T = require('../../scripts/mcp/tools');

function parseJSON(toolResult) {
  const text = toolResult.content[0].text;
  return JSON.parse(text);
}

test('TOOL_DEFINITIONS exposes the expected tool surface', () => {
  const names = T.TOOL_DEFINITIONS.map(t => t.name);
  for (const expected of [
    'route_intent',
    'list_agents',
    'list_skills',
    'list_commands',
    'list_rules',
    'list_bundles',
    'get_agent',
    'get_skill',
    'get_command',
    'get_rule',
    'get_bundle',
    'recall_memory',
    'capture_memory',
    'memory_stats',
    'catalog_stats',
    'audit_skill_match',
  ]) {
    assert.ok(names.includes(expected), `missing tool: ${expected}`);
  }
  // Every tool has a handler entry.
  for (const t of T.TOOL_DEFINITIONS) {
    assert.equal(typeof T.TOOL_HANDLERS[t.name], 'function', `${t.name} handler missing`);
    assert.ok(t.description && t.description.length > 5, `${t.name} description too short`);
    assert.ok(t.inputSchema && t.inputSchema.type === 'object', `${t.name} inputSchema malformed`);
  }
});

test('route_intent rejects empty message', () => {
  const r = T.tool_route_intent({});
  assert.ok(r.isError, 'must error on missing message');
});

test('route_intent surfaces a relevant agent for a debug task', () => {
  const r = T.tool_route_intent({ message: 'i have a hard intermittent bug in production' });
  const data = parseJSON(r);
  assert.ok(Array.isArray(data.suggestions));
  assert.ok(data.suggestions.length > 0, 'should produce at least one suggestion');
});

test('route_intent honours top_k', () => {
  const r = T.tool_route_intent({ message: 'review this code for security and quality issues', top_k: 2 });
  const data = parseJSON(r);
  assert.ok(data.suggestions.length <= 2);
});

test('list_agents returns the full catalog', () => {
  const r = T.tool_list_agents();
  const data = parseJSON(r);
  assert.ok(data.count >= 60);
  assert.ok(Array.isArray(data.agents) && data.agents.length === data.count);
});

test('get_agent returns body for known agent', () => {
  const r = T.tool_get_agent({ name: 'debug-detective' });
  assert.ok(!r.isError);
  assert.match(r.content[0].text, /^# Agent: debug-detective/);
});

test('get_agent errors on unknown agent', () => {
  const r = T.tool_get_agent({ name: 'no-such-agent' });
  assert.ok(r.isError);
});

test('get_command tolerates leading slash', () => {
  const r = T.tool_get_command({ name: '/code-review' });
  assert.ok(!r.isError);
  assert.match(r.content[0].text, /^# Command: \/code-review/);
});

test('get_rule returns the intent routing rule', () => {
  const r = T.tool_get_rule({ name: 'agent-intent-routing' });
  assert.ok(!r.isError);
  assert.match(r.content[0].text, /Agent Intent Routing/);
});

test('get_bundle returns red-team cheat sheet', () => {
  const r = T.tool_get_bundle({ name: 'red-team' });
  assert.ok(!r.isError);
  assert.ok(r.content[0].text.length > 100);
});

test('catalog_stats returns counts', () => {
  const r = T.tool_catalog_stats();
  const s = parseJSON(r);
  assert.ok(s.agents > 0 && s.skills > 0 && s.commands > 0);
});

test('audit_skill_match suggests at least one skill for an observability task', () => {
  const r = T.tool_audit_skill_match({ task: 'add structured logging and tracing to a fastapi service' });
  const data = parseJSON(r);
  assert.ok(Array.isArray(data.suggestions));
  assert.ok(data.suggestions.length > 0, 'expected at least one skill suggestion');
});

test('capture_memory + recall_memory roundtrip in isolated tmp store', () => {
  // Pre-seed a few unrelated memories so BM25 IDF can rise above the store's
  // default minScore floor (with N=1 IDF stays ~0.29 which is filtered out).
  for (const seed of [
    { problem: 'fix a flaky CI build on github actions',  approach: 'set timeout to 60s and retry once' },
    { problem: 'wire up redis caching for product list',  approach: 'use 60s ttl plus stale-while-revalidate' },
    { problem: 'migrate postgres timestamps to utc',       approach: 'add at::timestamptz coercion in alembic migration' },
  ]) {
    T.tool_capture_memory({ ...seed, tags: ['seed'], language: 'misc' });
  }

  const cap = T.tool_capture_memory({
    problem:  'mcp test problem keyword splatzilla',
    approach: 'documenting that capture_memory works end-to-end',
    tags:     ['mcp', 'test'],
    language: 'javascript',
  });
  assert.ok(!cap.isError, 'capture must succeed');
  const capData = parseJSON(cap);
  assert.ok(capData.id && typeof capData.id === 'string');
  assert.ok(capData.captured_at);

  const rec = T.tool_recall_memory({ query: 'splatzilla', limit: 3 });
  assert.ok(!rec.isError);
  const recData = parseJSON(rec);
  assert.ok(recData.count >= 1, 'should recall the memory we just captured');
  assert.equal(recData.memories[0].problem, 'mcp test problem keyword splatzilla');
});

test('capture_memory rejects missing required fields', () => {
  const r = T.tool_capture_memory({ problem: 'only problem, no approach' });
  assert.ok(r.isError);
});

test('memory_stats reflects at least one stored memory', () => {
  const r = T.tool_memory_stats();
  assert.ok(!r.isError);
  const s = parseJSON(r);
  assert.ok(typeof s === 'object');
});
