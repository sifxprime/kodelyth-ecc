// scripts/codebase/index.js
// Integration with DeusData/codebase-memory-mcp — AST-based code graph for
// 158 languages. Their binary. Their install script. Our thin wrapper.
//
// Fallback plan: MIT-licensed. If upstream disappears, fork + vendor.
'use strict';

const { execFileSync, spawnSync } = require('child_process');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

const BIN = 'codebase-memory-mcp';

function isInstalled() {
  try { execFileSync(BIN, ['--version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function getVersion() {
  try { return execFileSync(BIN, ['--version'], { encoding: 'utf8' }).trim(); }
  catch { return null; }
}

function install({ log = () => {} } = {}) {
  if (isInstalled()) return { installed: false, skipped: true, reason: 'already installed', version: getVersion() };
  if (os.platform() === 'win32') {
    return { installed: false, skipped: true, reason: 'windows requires manual install: https://github.com/DeusData/codebase-memory-mcp/releases' };
  }
  log('[codebase] installing codebase-memory-mcp via official curl script…');
  const script = 'curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash';
  const r = spawnSync('sh', ['-c', script], { stdio: 'inherit' });
  if (r.status !== 0) {
    return { installed: false, skipped: true, reason: 'install script failed — install manually: https://github.com/DeusData/codebase-memory-mcp' };
  }
  // Refresh PATH so isInstalled() sees the freshly-installed binary in ~/.local/bin.
  const localBin = path.join(os.homedir(), '.local', 'bin');
  if (fs.existsSync(path.join(localBin, BIN)) && !process.env.PATH.split(':').includes(localBin)) {
    process.env.PATH = `${localBin}:${process.env.PATH}`;
  }
  if (!isInstalled()) {
    return { installed: false, skipped: true, reason: `installed to ~/.local/bin but not on PATH — add "export PATH=$HOME/.local/bin:$PATH" to your shell rc` };
  }
  return { installed: true, method: 'curl', version: getVersion() };
}

// Their `install` command auto-configures Claude Code / Codex / Gemini MCP entries.
// We just re-run it after our own install so the user's ECC install triggers
// the codebase-memory MCP registration too.
function autoConfigureAgents({ log = () => {} } = {}) {
  if (!isInstalled()) return { configured: false, reason: 'binary not installed' };
  log('[codebase] auto-configuring MCP server entries in installed agents…');
  const r = spawnSync(BIN, ['install'], { stdio: 'inherit' });
  return { configured: r.status === 0 };
}

// ── Status / stats (reads their CLI, no hardcoded fallback) ─────────────────
function status() {
  if (!isInstalled()) return { installed: false, version: null };
  const version = getVersion();
  let indexed_projects = null;
  let cacheDir = null;
  try {
    const r = execFileSync(BIN, ['cli', 'list_projects'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    try {
      const parsed = JSON.parse(r);
      indexed_projects = Array.isArray(parsed) ? parsed.length : (parsed?.projects?.length ?? null);
    } catch { /* not JSON — leave null */ }
  } catch { /* no projects yet */ }
  const home = os.homedir();
  const c = path.join(home, '.cache', 'codebase-memory-mcp');
  if (fs.existsSync(c)) cacheDir = c;
  return { installed: true, version, indexed_projects, cache_dir: cacheDir };
}

// ── Structural query proxy (thin wrapper over `codebase-memory-mcp cli`) ────
function query(subcmd, argsJson = '{}') {
  if (!isInstalled()) throw new Error('codebase-memory-mcp not installed');
  const r = spawnSync(BIN, ['cli', subcmd, argsJson], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error((r.stderr || '').trim() || `query failed: ${subcmd}`);
  try { return JSON.parse(r.stdout); } catch { return { raw: r.stdout }; }
}

// ── Dashboard-facing summary (reads real data only) ─────────────────────────
function dashboardSnapshot() {
  const st = status();
  if (!st.installed) return { ok: false, installed: false, install_hint: 'Run: kodelyth-ecc codebase install' };
  const out = { ok: true, installed: true, version: st.version, indexed_projects: st.indexed_projects, cache_dir: st.cache_dir };
  try {
    const arch = query('get_architecture', '{}');
    if (arch && typeof arch === 'object') {
      out.architecture_snapshot = {
        languages: arch.languages || arch.language_counts || null,
        nodes:     arch.node_count ?? arch.nodes ?? null,
        edges:     arch.edge_count ?? arch.edges ?? null,
        entry_points: (arch.entry_points || []).slice(0, 5),
      };
    }
  } catch { /* no active project yet */ }
  return out;
}

module.exports = { isInstalled, getVersion, install, autoConfigureAgents, status, query, dashboardSnapshot };
