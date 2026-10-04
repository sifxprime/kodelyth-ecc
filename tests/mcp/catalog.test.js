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

// ── loadRule containment ─────────────────────────────────────────────────────
// loadRule was the only catalog loader that built a path out of its argument
// instead of matching against a directory listing, so `../../README` returned
// ROOT/README.md — 51KB of the wrong file from a tool whose contract is "return
// a rule". It had no test at all, which is why it survived. These are the exact
// payloads that leaked.

test('loadRule refuses path traversal', () => {
  const payloads = [
    '../../README',                 // leaked 51,297 B
    '../../CHANGELOG',              // leaked 188,170 B
    'testing/../../../README',      // nested traversal, also leaked
    '../../../../etc/passwd',
    '../../CLAUDE',
    '../../SECURITY',
    'rules/common/testing',         // a real rule, but reached as a path
    './testing',                    // non-canonical form of a real rule
    '..',
    '.',
    '/etc/hosts',
    '',
  ];
  for (const name of payloads) {
    assert.equal(catalog.loadRule(name), null, `loadRule(${JSON.stringify(name)}) must not resolve`);
  }
});

test('loadRule rejects non-string input without throwing', () => {
  // A JSON-RPC client can send any type for `name`; a crash here would take the
  // whole stdio server down rather than returning one tool error.
  for (const name of [null, undefined, 42, {}, ['testing'], true]) {
    assert.equal(catalog.loadRule(name), null, `loadRule(${JSON.stringify(name) ?? 'undefined'})`);
  }
});

test('loadRule still loads every real rule by name', () => {
  const all = catalog.loadAllRules();
  assert.ok(all.length > 0, 'fixture check: rules/common should not be empty');
  for (const rule of all) {
    const got = catalog.loadRule(rule.name);
    assert.ok(got, `${rule.name} must still load`);
    assert.equal(got.body.length, rule.body.length, `${rule.name} body must match`);
  }
});

test('loadRule rejects a symlink inside rules/common that points outside it', () => {
  // The name pattern cannot catch this: `escape-probe` is a perfectly valid rule
  // name. Only resolving the target proves where it actually lands. This is the
  // layer that makes the fix defence-in-depth rather than a regex.
  const fs   = require('node:fs');
  const path = require('node:path');
  const link = path.join(catalog.PATHS.rules, 'escape-probe.md');
  const target = path.join(catalog.ROOT, 'README.md');

  if (fs.existsSync(link)) return;              // never clobber a real file
  if (!fs.existsSync(target)) return;           // nothing to point at
  try {
    fs.symlinkSync(target, link);
  } catch {
    return;                                     // no symlink permission (CI on Windows)
  }
  try {
    assert.equal(catalog.loadRule('escape-probe'), null, 'symlink out of rules/common must not resolve');
  } finally {
    fs.unlinkSync(link);
  }
});
