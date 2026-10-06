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
    const cfg = readJson(p);
    const present = !!(cfg && cfg.mcpServers && cfg.mcpServers[SERVER_NAME]);
    rows.push({ file: p, present, exists: !!cfg });
  }
  return rows;
}

module.exports = {
  SERVER_NAME,
  serverEntry,
  claudeCodeConfigPath,
  claudeDesktopConfigPath,
  registerAll,
  unregisterAll,
  statusAll,
  // Exported for tests: these must be exercisable without writing to a real
  // ~/.claude.json, and the whole point of the fix is what they refuse to do.
  _internals: { readConfig, registerInFile, unregisterInFile },
};
