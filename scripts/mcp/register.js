// =============================================================================
// Kodelyth ECC — MCP Client Registration
//
// Auto-wire ECC into every MCP-capable client we can detect. Non-destructive:
//   - Reads existing config
//   - Adds/updates the "kodelyth-ecc" server entry
//   - Preserves every other server the user has
//   - Writes atomically (temp file → rename)
//
// Supported clients:
//   claude-desktop  ~/Library/Application Support/Claude/claude_desktop_config.json (mac)
//                   %APPDATA%\Claude\claude_desktop_config.json (windows)
//   claude-code     ~/.claude/mcp.json
//   cursor          ~/.cursor/mcp.json
//   windsurf        ~/.codeium/windsurf/mcp_config.json
// =============================================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

// Locations we write to per client.
function clientTargets() {
  const home = os.homedir();
  const isWin = process.platform === 'win32';
  const appData = process.env.APPDATA;
  return [
    {
      id: 'claude-desktop',
      config: isWin
        ? (appData ? path.join(appData, 'Claude', 'claude_desktop_config.json') : null)
        : (process.platform === 'darwin'
             ? path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
             : path.join(home, '.config', 'Claude', 'claude_desktop_config.json')),
      key: 'mcpServers',
    },
    { id: 'claude-code', config: path.join(home, '.claude', 'mcp.json'),           key: 'mcpServers' },
    { id: 'cursor',      config: path.join(home, '.cursor', 'mcp.json'),           key: 'mcpServers' },
    { id: 'windsurf',    config: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'), key: 'mcpServers' },
  ].filter(t => t.config);
}

function ecServerEntry() {
  // Assume the package is installed globally via npm; the mcp subcommand
  // starts a stdio JSON-RPC server that any client can consume.
  return {
    command: 'npx',
    args: ['-y', 'kodelyth-ecc', 'mcp'],
    env: {},
  };
}

function readConfig(file) {
  try {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return {}; }
}

function writeConfigAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + `.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

// Register ECC into every detectable client. Non-destructive.
function registerAll({ dryRun = false } = {}) {
  const targets = clientTargets();
  const results = [];
  for (const t of targets) {
    const parentDir = path.dirname(t.config);
    // If parent dir doesn't exist and the client isn't installed, skip silently.
    const clientInstalled = fs.existsSync(parentDir) || fs.existsSync(t.config);
    if (!clientInstalled) {
      results.push({ id: t.id, config: t.config, status: 'skipped', reason: 'client not installed' });
      continue;
    }
    const cfg = readConfig(t.config);
    if (!cfg[t.key] || typeof cfg[t.key] !== 'object') cfg[t.key] = {};
    const before = cfg[t.key]['kodelyth-ecc'] ? 'updated' : 'added';
    cfg[t.key]['kodelyth-ecc'] = ecServerEntry();
    if (dryRun) {
      results.push({ id: t.id, config: t.config, status: 'dry-run', would: before });
    } else {
      try {
        writeConfigAtomic(t.config, cfg);
        results.push({ id: t.id, config: t.config, status: 'ok', action: before });
      } catch (err) {
        results.push({ id: t.id, config: t.config, status: 'error', reason: err.message });
      }
    }
  }
  return results;
}

// Report current registration state without modifying anything.
function status() {
  const targets = clientTargets();
  return targets.map(t => {
    const cfg = readConfig(t.config);
    const registered = !!(cfg[t.key] && cfg[t.key]['kodelyth-ecc']);
    return {
      id: t.id,
      config: t.config,
      config_present: fs.existsSync(t.config),
      registered,
    };
  });
}

module.exports = { registerAll, status, clientTargets };

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const out = registerAll({ dryRun });
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}
