// Tests for scripts/mcp/catalog.js — read-only loader for ECC catalog files.
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');

const catalog = require('../../scripts/mcp/catalog');

test('parseFrontmatter parses simple key/value', () => {
  const { meta, body } = catalog.parseFrontmatter('---\nname: foo\ndescription: bar\n---\nhello');
  assert.equal(meta.name, 'foo');
  assert.equal(meta.description, 'bar');
  assert.equal(body, 'hello');
});

test('parseFrontmatter handles folded scalar (>)', () => {
  const raw = '---\nname: x\ndescription: >\n  line one\n  line two\n---\n# body';
  const { meta, body } = catalog.parseFrontmatter(raw);
  assert.equal(meta.name, 'x');
  assert.match(meta.description, /line one/);
  assert.match(meta.description, /line two/);
  assert.equal(body, '# body');
});

test('parseFrontmatter handles missing frontmatter', () => {
  const { meta, body } = catalog.parseFrontmatter('# just markdown');
  assert.deepEqual(meta, {});
  assert.equal(body, '# just markdown');
});

test('loadAgents finds at least one known agent', () => {
  const agents = catalog.loadAgents();
  assert.ok(Array.isArray(agents));
  assert.ok(agents.length >= 60, `expected >=60 agents, got ${agents.length}`);
  const dd = agents.find(a => a.name === 'debug-detective');
  assert.ok(dd, 'debug-detective agent must be present');
  assert.ok(dd.description.length > 0);
  assert.ok(dd.body.length > 100);
});

test('loadAgents includes the new devil-mode crew', () => {
  const agents = catalog.loadAgents();
  const names = new Set(agents.map(a => a.name));
  for (const expected of [
    'prompt-injection-hunter',
    'supply-chain-auditor',
    'jailbreak-tester',
    'backdoor-hunter',
    'chaos-engineer',
  ]) {
    assert.ok(names.has(expected), `missing devil-mode agent: ${expected}`);
  }
});

test('loadSkills returns a populated list with descriptions', () => {
  const skills = catalog.loadSkills();
  assert.ok(skills.length >= 100, `expected >=100 skills, got ${skills.length}`);
  const ae = skills.find(s => s.name === 'agentic-engineering');
  assert.ok(ae, 'agentic-engineering skill must be present');
  assert.ok(ae.description.length > 0);
});

test('loadCommands returns commands and supports findCommand with leading slash', () => {
  const cmds = catalog.loadCommands();
  assert.ok(cmds.length >= 50);
  const found1 = catalog.findCommand('code-review');
  const found2 = catalog.findCommand('/code-review');
  assert.ok(found1 && found2 && found1.name === found2.name);
});

test('loadAllRules returns the intent routing rule', () => {
  const rules = catalog.loadAllRules();
  const r = rules.find(x => x.name === 'agent-intent-routing');
  assert.ok(r, 'agent-intent-routing rule must be present');
  assert.ok(r.body.length > 500);
});

test('loadBundles returns the three power bundles', () => {
  const bundles = catalog.loadBundles();
  const names = new Set(bundles.map(b => b.name));
  assert.ok(names.has('indie-hacker'));
  assert.ok(names.has('red-team'));
  assert.ok(names.has('enterprise'));
});

test('stats returns expected fields', () => {
  const s = catalog.stats();
  assert.ok(typeof s.agents === 'number' && s.agents > 0);
  assert.ok(typeof s.skills === 'number' && s.skills > 0);
  assert.ok(typeof s.commands === 'number' && s.commands > 0);
  assert.ok(typeof s.rules === 'number' && s.rules > 0);
  assert.ok(typeof s.bundles === 'number');
  assert.ok(typeof s.root === 'string');
});

test('findAgent returns null for unknown name', () => {
  assert.equal(catalog.findAgent('this-agent-does-not-exist'), null);
});
