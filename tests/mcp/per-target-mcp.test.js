// Tests for the per-target MCP writer — scripts/mcp/register-self.js.
//
// ECC auto-registered its MCP server (and therefore memory + the whole tool
// surface) for Claude Code only. This writer extends the SAME hardened merge to
// the JSON-config IDEs (Cursor, Windsurf, Gemini CLI). The tests below prove the
// extension unlocks those IDEs without the two ways config-writing goes wrong:
// clobbering a user's other MCP servers, or overwriting a file it cannot parse.
// They also pin the statusAll() regression (it threw "readJson is not defined").
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const reg = require('../../scripts/mcp/register-self');

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-mcp-'));
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ── statusAll regression ─────────────────────────────────────────────────────

test('regression: statusAll() does not throw (was "readJson is not defined")', () => {
  const rows = reg.statusAll();
  assert.ok(Array.isArray(rows) && rows.length === 2);
  for (const r of rows) {
    assert.equal(typeof r.present, 'boolean');
    assert.equal(typeof r.readable, 'boolean');
  }
});

// ── path resolution ──────────────────────────────────────────────────────────

test('mcpPathsForTarget resolves the known JSON IDEs and rejects unknown ones', () => {
  assert.equal(reg.mcpPathsForTarget('cursor', '/proj')[0], path.join('/proj', '.cursor', 'mcp.json'));
  assert.match(reg.mcpPathsForTarget('windsurf')[0], /\.codeium[\/\\]windsurf[\/\\]mcp_config\.json$/);
  assert.match(reg.mcpPathsForTarget('gemini-cli')[0], /\.gemini[\/\\]settings\.json$/);
  assert.deepEqual(reg.mcpPathsForTarget('codex-home'), []); // TOML — intentionally not auto-written
  assert.deepEqual(reg.mcpPathsForTarget('nonsense'), []);
});

// ── the merge: create, preserve, idempotent, refuse ──────────────────────────

test('registerForTarget creates a Cursor mcp.json with ECC wired', () => {
  const cwd = tmpProject();
  const res = reg.registerForTarget('cursor', { cwd });
  assert.equal(res[0].action, 'added');

  const cfg = readJson(path.join(cwd, '.cursor', 'mcp.json'));
  assert.deepEqual(cfg.mcpServers['kodelyth-ecc'], { command: 'kodelythecc', args: ['mcp'], env: {} });
});

test('registerForTarget preserves a user\'s existing MCP servers (no clobber)', () => {
  const cwd = tmpProject();
  const file = path.join(cwd, '.cursor', 'mcp.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    mcpServers: { 'their-server': { command: 'foo', args: ['bar'] } },
    otherTopLevelKey: 'keep me',
  }, null, 2));

  reg.registerForTarget('cursor', { cwd });

  const cfg = readJson(file);
  assert.deepEqual(cfg.mcpServers['their-server'], { command: 'foo', args: ['bar'] }, 'their server survives');
  assert.ok(cfg.mcpServers['kodelyth-ecc'], 'ECC was added alongside');
  assert.equal(cfg.otherTopLevelKey, 'keep me', 'unrelated top-level keys survive');
});

test('registerForTarget is idempotent', () => {
  const cwd = tmpProject();
  assert.equal(reg.registerForTarget('cursor', { cwd })[0].action, 'added');
  assert.equal(reg.registerForTarget('cursor', { cwd })[0].action, 'unchanged');
});

test('registerForTarget refuses an unparseable config instead of overwriting it', () => {
  const cwd = tmpProject();
  const file = path.join(cwd, '.cursor', 'mcp.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const garbage = '{ this is : not json, ';
  fs.writeFileSync(file, garbage);

  const res = reg.registerForTarget('cursor', { cwd });
  assert.equal(res[0].action, 'error');
  assert.equal(fs.readFileSync(file, 'utf8'), garbage, 'the unparseable file was left exactly as it was');
});

test('registerForTarget reports unsupported targets without writing anything', () => {
  const res = reg.registerForTarget('codex-home', { cwd: tmpProject() });
  assert.equal(res[0].action, 'unsupported');
});

test('dryRun resolves the action but writes no file', () => {
  const cwd = tmpProject();
  const res = reg.registerForTarget('cursor', { cwd, dryRun: true });
  assert.equal(res[0].action, 'added');
  assert.equal(fs.existsSync(path.join(cwd, '.cursor', 'mcp.json')), false);
});
