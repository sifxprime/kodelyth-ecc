// scripts/mcp/register-self.js
// Auto-register ECC's own MCP server in Claude Code (~/.claude.json) and
// Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json).
//
// Idempotent — updates in place, never duplicates. Handles missing files.

'use strict';

const fs   = require('fs');
const safeFs = require('../lib/safe-fs');
const os   = require('os');
const path = require('path');

const SERVER_NAME = 'kodelyth-ecc';

function claudeCodeConfigPath() {
  // Claude Code reads user-level MCP from ~/.claude.json
  return path.join(os.homedir(), '.claude.json');
}

function claudeDesktopConfigPath() {
  const home = os.homedir();
  if (os.platform() === 'darwin') return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  if (os.platform() === 'win32')  return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
  return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
}

// MCP config paths for the non-Claude IDEs ECC can auto-wire via JSON. Every
// target below uses the SAME `{ mcpServers: { <name>: {...} } }` shape as Claude
// Code (Kiro included — it is MCP-native), so the hardened readConfig +
// registerInFile merge works unchanged; only the file location differs. Codex is
// TOML and handled separately (registerCodexToml).
//
// Still manual (fragile, editor-version-specific path): Cline / Roo Code store
// MCP settings in VS Code globalStorage, so ECC does not guess that path.
function mcpPathsForTarget(target, cwd = process.cwd()) {
  const home = os.homedir();
  switch (target) {
    case 'claude-code':
    case 'claude-home':
      return [claudeCodeConfigPath()];
    case 'cursor':
    case 'cursor-project':
      return [path.join(cwd, '.cursor', 'mcp.json')];
    case 'windsurf':
    case 'windsurf-home':
    case 'windsurf-project':
      return [path.join(home, '.codeium', 'windsurf', 'mcp_config.json')];
    case 'gemini-cli':
    case 'gemini-home':
    case 'gemini-project':
      return [path.join(home, '.gemini', 'settings.json')];
    case 'kiro':
    case 'kiro-project':
      return [path.join(cwd, '.kiro', 'settings', 'mcp.json')];
    case 'kiro-home':
      return [path.join(home, '.kiro', 'settings', 'mcp.json')];
    default:
      return [];
  }
}

function codexConfigPath() {
  return path.join(os.homedir(), '.codex', 'config.toml');
}

// Codex CLI stores MCP servers in TOML as [mcp_servers.<name>] tables. Without
// pulling in a TOML parser, add our table only when it is absent (idempotent),
// and otherwise leave the file exactly as it is. Appending a table is
// order-independent in TOML, so this never clobbers existing servers or settings.
function registerCodexToml(file, { dryRun = false } = {}) {
  let raw = '';
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      return { file, action: 'error', error: `cannot read ${file}: ${err.message}` };
    }
  }
  if (/\[mcp_servers\.(?:"?kodelyth-ecc"?)\]/.test(raw)) {
    return { file, action: 'unchanged' };
  }
  const table = `\n[mcp_servers."${SERVER_NAME}"]\ncommand = "kodelythecc"\nargs = ["mcp"]\n`;
  const next = raw.length && !raw.endsWith('\n') ? `${raw}\n${table}` : `${raw}${table}`;
  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    safeFs.replaceFilePreservingMode(file, next);
  }
  return { file, action: 'added' };
}

// Returns the list of targets this module can auto-wire (for help text / docs).
function supportedMcpTargets() {
  return ['claude-code', 'cursor', 'windsurf', 'gemini-cli', 'kiro', 'codex'];
}

// Register ECC's MCP server for one install target. JSON targets reuse the same
// merge that protects ~/.claude.json (absent → created, present → merged without
// clobbering, unparseable → refused); Codex uses the TOML writer above. Never
// throws — a bad config for one IDE must not fail an install.
function registerForTarget(target, { cwd = process.cwd(), log = () => {}, dryRun = false } = {}) {
  if (target === 'codex' || target === 'codex-home') {
    try {
      const r = registerCodexToml(codexConfigPath(), { dryRun });
      log(`  ${r.action}: ${r.file}`);
      return [{ target, ...r }];
    } catch (e) {
      log(`  skipped codex: ${e.message}`);
      return [{ target, file: codexConfigPath(), action: 'error', error: e.message }];
    }
  }
  const paths = mcpPathsForTarget(target, cwd);
  if (paths.length === 0) {
    return [{ target, action: 'unsupported', reason: `no known MCP config path for "${target}"` }];
  }
  const results = [];
  for (const p of paths) {
    try {
      const r = registerInFile(p, { dryRun });
      log(`  ${r.action}: ${r.file}`);
      results.push({ target, ...r });
    } catch (e) {
      log(`  skipped ${p}: ${e.message}`);
      results.push({ target, file: p, action: 'error', error: e.message });
    }
  }
  return results;
}

// Reading this file has THREE outcomes, and collapsing them is destructive.
//
// readJson used to return null for every failure, and the caller did
// `readJson(file) || {}`. So a config that merely failed to parse — one trailing
// comma from a hand-edit, a half-written file, a bad mount — was treated as an
// empty config, and the merge wrote it back containing only ECC's own entry.
// Measured on a realistic config: 366 bytes in, 140 bytes out, with every other
// MCP server, every project entry and every setting gone. Silently, during an
// install the user did not think was risky.
//
// Absent is safe to treat as empty. Unreadable is not.
function readConfig(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { state: 'absent', data: {} };
    return { state: 'unreadable', reason: err.message };
  }
  // An empty or whitespace-only file is effectively absent; JSON.parse would
  // throw on it and we would otherwise refuse to ever register.
  if (raw.trim() === '') return { state: 'absent', data: {} };
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { state: 'unreadable', reason: 'top-level value is not an object' };
    }
    return { state: 'present', data };
  } catch (err) {
    return { state: 'unreadable', reason: err.message };
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Atomic: write a temp file and rename. A crash or a full disk partway through
  // a plain writeFileSync leaves the user with a truncated config, which is the
  // same data loss by a different route.
  // PreservingMode rather than Atomic: this is the user's own config file and it
  // may carry permissions they chose. It keeps the existing mode when the file is
  // already there and falls back to 0644 when creating it.
  safeFs.replaceFilePreservingMode(file, JSON.stringify(obj, null, 2) + '\n');
}

function serverEntry() {
  return {
    command: 'kodelythecc',
    args: ['mcp'],
    env: {},
  };
}

function registerInFile(file, opts = {}) {
  const cfg = readConfig(file);
  if (cfg.state === 'unreadable') {
    // Refusing is the whole point. Overwriting would destroy whatever is in there.
    throw new Error(
      `refusing to modify ${file}: it exists but could not be parsed (${cfg.reason}). ` +
      `Fix or move the file, then re-run. Nothing was written.`
    );
  }
  const existing = cfg.data;
  const servers = existing.mcpServers || {};
  const already = servers[SERVER_NAME];
  const desired = serverEntry();
  if (already && JSON.stringify(already) === JSON.stringify(desired)) {
    return { file, action: 'unchanged' };
  }
  servers[SERVER_NAME] = desired;
  const next = { ...existing, mcpServers: servers };
  if (!opts.dryRun) writeJson(file, next);
  return { file, action: already ? 'updated' : 'added' };
}

function unregisterInFile(file) {
  const cfg = readConfig(file);
  // Same rule on the way out: an unparseable config is left exactly as it is.
  if (cfg.state === 'unreadable') return { file, action: 'skipped-unreadable', reason: cfg.reason };
  const existing = cfg.data;
  if (!existing || !existing.mcpServers || !existing.mcpServers[SERVER_NAME]) {
    return { file, action: 'not-present' };
  }
  delete existing.mcpServers[SERVER_NAME];
  writeJson(file, existing);
  return { file, action: 'removed' };
}

function registerAll({ log = () => {} } = {}) {
  const results = [];
  for (const p of [claudeCodeConfigPath(), claudeDesktopConfigPath()]) {
    try {
      const r = registerInFile(p);
      log(`  ${r.action}: ${r.file}`);
      results.push(r);
    } catch (e) {
      log(`  skipped ${p}: ${e.message}`);
      results.push({ file: p, action: 'error', error: e.message });
    }
  }
  return results;
}

function unregisterAll({ log = () => {} } = {}) {
  const results = [];
  for (const p of [claudeCodeConfigPath(), claudeDesktopConfigPath()]) {
    try {
      const r = unregisterInFile(p);
      log(`  ${r.action}: ${r.file}`);
      results.push(r);
    } catch (e) {
      log(`  skipped ${p}: ${e.message}`);
      results.push({ file: p, action: 'error', error: e.message });
    }
  }
  return results;
}

function statusAll() {
  const rows = [];
  for (const p of [claudeCodeConfigPath(), claudeDesktopConfigPath()]) {
    // Was `readJson(p)` — a function that no longer exists after the
    // absent/present/unreadable refactor, so statusAll() threw
    // "readJson is not defined" and took `kodelythecc doctor` and the `mcp`
    // status command down with it. Use the real reader and its tri-state result.
    const cfg = readConfig(p);
    const data = (cfg && cfg.data) || {};
    const present = !!(data.mcpServers && data.mcpServers[SERVER_NAME]);
    rows.push({
      file: p,
      present,
      exists: cfg.state !== 'absent',
      readable: cfg.state !== 'unreadable',
    });
  }
  return rows;
}

module.exports = {
  SERVER_NAME,
  serverEntry,
  claudeCodeConfigPath,
  claudeDesktopConfigPath,
  mcpPathsForTarget,
  supportedMcpTargets,
  registerForTarget,
  registerCodexToml,
  codexConfigPath,
  registerAll,
  unregisterAll,
  statusAll,
  // Exported for tests: these must be exercisable without writing to a real
  // ~/.claude.json, and the whole point of the fix is what they refuse to do.
  _internals: { readConfig, registerInFile, unregisterInFile },
};
