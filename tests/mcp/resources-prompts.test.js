// Tests for scripts/mcp/resources.js and scripts/mcp/prompts.js
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');

const RES     = require('../../scripts/mcp/resources');
const PROMPTS = require('../../scripts/mcp/prompts');

test('resources.buildList returns agents/skills/commands/rules/bundles', () => {
  const list = RES.buildList();
  assert.ok(list.length > 200, `expected >200 resources, got ${list.length}`);
  const schemes = new Set(list.map(r => r.uri.split('://')[1].split('/')[0]));
  for (const expected of ['agents', 'skills', 'commands', 'rules', 'bundles']) {
    assert.ok(schemes.has(expected), `missing resource bucket: ${expected}`);
  }
  for (const r of list.slice(0, 5)) {
    assert.match(r.uri, /^kodelyth:\/\//);
    assert.equal(r.mimeType, 'text/markdown');
  }
});

test('resources.readResource returns body for a known agent', () => {
  const out = RES.readResource('kodelyth://agents/debug-detective');
  assert.ok(out.contents.length === 1);
  assert.equal(out.contents[0].mimeType, 'text/markdown');
  assert.match(out.contents[0].text, /debug-detective/);
});

test('resources.readResource rejects unknown URI scheme', () => {
  assert.throws(() => RES.readResource('weird://foo/bar'));
});

test('resources.readResource rejects unknown name', () => {
  assert.throws(() => RES.readResource('kodelyth://agents/no-such-agent'));
});

test('PROMPT_DEFINITIONS exposes routing-rule and overviews', () => {
  const names = PROMPTS.PROMPT_DEFINITIONS.map(p => p.name);
  for (const expected of [
    'routing-rule',
    'agents-overview',
    'skills-overview',
    'commands-overview',
    'handoff-chains',
    'devil-mode',
  ]) {
    assert.ok(names.includes(expected), `missing prompt: ${expected}`);
  }
});

test('routing-rule prompt returns the full intent routing rule body', () => {
  const out = PROMPTS.PROMPT_HANDLERS['routing-rule']();
  assert.ok(out.messages.length === 1);
  assert.equal(out.messages[0].role, 'user');
  assert.match(out.messages[0].content.text, /Agent Intent Routing/);
});

test('agents-overview returns a summary of all agents', () => {
  const out = PROMPTS.PROMPT_HANDLERS['agents-overview']();
  const text = out.messages[0].content.text;
  assert.match(text, /Kodelyth ECC — Agents/);
  assert.match(text, /debug-detective/);
});

test('devil-mode prompt returns the parallel command body', () => {
  const out = PROMPTS.PROMPT_HANDLERS['devil-mode']();
  const text = out.messages[0].content.text;
  assert.match(text, /devil-mode/i);
});
