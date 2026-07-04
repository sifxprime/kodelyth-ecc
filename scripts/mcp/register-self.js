// scripts/mcp/register-self.js
// Auto-register ECC's own MCP server in Claude Code (~/.claude.json) and
// Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json).
//
// Idempotent — updates in place, never duplicates. Handles missing files.

'use strict';

const fs   = require('fs');
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

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

function serverEntry() {
  return {
    command: 'kodelythecc',
    args: ['mcp'],
    env: {},
  };
}

function registerInFile(file, opts = {}) {
  const existing = readJson(file) || {};
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
  const existing = readJson(file);
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
};
