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
  // opencode has no known MCP config path (Cline/Roo/opencode are still manual).
  const res = reg.registerForTarget('opencode', { cwd: tmpProject() });
  assert.equal(res[0].action, 'unsupported');
});

test('dryRun resolves the action but writes no file', () => {
  const cwd = tmpProject();
  const res = reg.registerForTarget('cursor', { cwd, dryRun: true });
  assert.equal(res[0].action, 'added');
  assert.equal(fs.existsSync(path.join(cwd, '.cursor', 'mcp.json')), false);
});

// ── Kiro (JSON, MCP-native) ──────────────────────────────────────────────────

test('Kiro resolves to .kiro/settings/mcp.json and merges like the other JSON IDEs', () => {
  assert.equal(reg.mcpPathsForTarget('kiro', '/proj')[0], path.join('/proj', '.kiro', 'settings', 'mcp.json'));
  assert.match(reg.mcpPathsForTarget('kiro-home')[0], /\.kiro[\/\\]settings[\/\\]mcp\.json$/);

  const cwd = tmpProject();
  const res = reg.registerForTarget('kiro', { cwd });
  assert.equal(res[0].action, 'added');
  const cfg = readJson(path.join(cwd, '.kiro', 'settings', 'mcp.json'));
  assert.deepEqual(cfg.mcpServers['kodelyth-ecc'], { command: 'kodelythecc', args: ['mcp'], env: {} });
});

test('supportedMcpTargets now includes kiro and codex', () => {
  const t = reg.supportedMcpTargets();
  assert.ok(t.includes('kiro'));
  assert.ok(t.includes('codex'));
});

// ── Codex (TOML, minimal non-clobbering append) ──────────────────────────────

test('registerCodexToml creates config.toml with the ECC server table', () => {
  const file = path.join(tmpProject(), 'config.toml');
  const r = reg.registerCodexToml(file);
  assert.equal(r.action, 'added');
  const toml = fs.readFileSync(file, 'utf8');
  assert.match(toml, /\[mcp_servers\."kodelyth-ecc"\]/);
  assert.match(toml, /command = "kodelythecc"/);
  assert.match(toml, /args = \["mcp"\]/);
});

test('registerCodexToml preserves an existing Codex config and other MCP servers', () => {
  const file = path.join(tmpProject(), 'config.toml');
  const existing = 'model = "o3"\n\n[mcp_servers.other]\ncommand = "foo"\nargs = ["bar"]\n';
  fs.writeFileSync(file, existing);
  reg.registerCodexToml(file);
  const toml = fs.readFileSync(file, 'utf8');
  assert.match(toml, /model = "o3"/, 'top-level settings survive');
  assert.match(toml, /\[mcp_servers\.other\]/, 'the other server survives');
  assert.match(toml, /\[mcp_servers\."kodelyth-ecc"\]/, 'ECC was appended');
});

test('registerCodexToml is idempotent', () => {
  const file = path.join(tmpProject(), 'config.toml');
  assert.equal(reg.registerCodexToml(file).action, 'added');
  assert.equal(reg.registerCodexToml(file).action, 'unchanged');
  // Only one ECC table, not two.
  const count = (fs.readFileSync(file, 'utf8').match(/\[mcp_servers\."kodelyth-ecc"\]/g) || []).length;
  assert.equal(count, 1);
});

test('registerForTarget routes codex to the TOML writer', () => {
  // codexConfigPath is ~/.codex/config.toml; use dryRun so the test never writes
  // to a real home file, and just assert it routed + resolved an action.
  const res = reg.registerForTarget('codex-home', { dryRun: true });
  assert.ok(['added', 'unchanged'].includes(res[0].action));
  assert.match(res[0].file, /\.codex[\/\\]config\.toml$/);
});
