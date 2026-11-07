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

// The binary's `--version` string has proven unreliable: builds have reported an
// old number (e.g. 0.8.1) while exposing much newer tools and the `--ui` (CBM
// Lens) flag. So detect what the binary can actually DO from its own help text
// rather than trusting the version. Pure parser (unit-tested) + a thin probe.
const KNOWN_CAPABILITIES = {
  lens:       /--ui\b/,                  // CBM Lens UI (v0.12+)
  traces:     /\bingest_traces\b/,       // runtime-trace ingestion
  cypher:     /\bquery_graph\b/,         // Cypher + complexity/hot-path metrics
  smart_ci:   /\bdetect_changes\b/,      // Smart CI test selection
  adr:        /\bmanage_adr\b/,          // ADR nodes
  cross_repo: /cross[-_]repo/,           // cross-repo intelligence
};

function parseCapabilities(helpText) {
  const h = String(helpText || '');
  const caps = {};
  for (const [name, re] of Object.entries(KNOWN_CAPABILITIES)) caps[name] = re.test(h);
  return caps;
}

// When the binary exposes clearly-newer capabilities but reports an old version,
// the version string is not trustworthy — say so rather than displaying a number
// ECC would otherwise treat as fact. Returns a note string, or null.
function versionNote(reportedVersion, caps) {
  const hasNew   = !!(caps && (caps.lens || caps.traces || caps.cross_repo));
  const looksOld = !!(reportedVersion && /\b0\.[0-8]\./.test(reportedVersion));
  if (hasNew && looksOld) {
    return `binary reports "${reportedVersion}" but exposes newer capabilities — the version string is unreliable; capability detection is authoritative. Run \`kodelythecc codebase install\` to refresh.`;
  }
  return null;
}

// Probe the binary's help (different builds print tools under `--help` or
// `cli --help`) and parse once. Returns the detected capability map, or all-false
// if the binary is absent.
function capabilities() {
  if (!isInstalled()) return parseCapabilities('');
  let help = '';
  for (const argv of [['--help'], ['cli', '--help']]) {
    try {
      help += '\n' + execFileSync(BIN, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch { /* try the next help surface */ }
  }
  return parseCapabilities(help);
}

function install({ log = () => {} } = {}) {
  if (isInstalled()) return { installed: false, skipped: true, reason: 'already installed', version: getVersion() };
  if (os.platform() === 'win32') {
    // This project publishes Windows builds for both architectures; ECC just
    // never downloaded them. Pick by process.arch so an arm64 machine gets the
    // native build rather than running x64 under emulation.
    const win = require('../lib/win-install.js');
    const asset = process.arch === 'arm64'
      ? 'codebase-memory-mcp-windows-arm64.zip'
      : 'codebase-memory-mcp-windows-amd64.zip';
    const r = win.installFromRelease({
      repo: 'DeusData/codebase-memory-mcp',
      asset,
      binName: `${BIN}.exe`,
      log,
    });
    if (!r.installed) {
      return { installed: false, skipped: true, reason: `${r.reason} — or install by hand: https://github.com/DeusData/codebase-memory-mcp/releases` };
    }
    if (!isInstalled()) {
      return { installed: false, skipped: true, reason: `installed to ${r.dir} but not runnable from PATH` };
    }
    return {
      installed: true,
      method: 'github-release',
      version: getVersion(),
      dir: r.dir,
      pathHint: r.onPath ? null : win.setxHint(r.dir),
    };
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
  const caps = capabilities();
  return {
    installed: true,
    version,
    version_note: versionNote(version, caps),
    capabilities: caps,
    indexed_projects,
    cache_dir: cacheDir,
  };
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
  // Try to list projects with names — richer than just a count.
  try {
    const list = query('list_projects', '{}');
    if (Array.isArray(list)) {
      out.projects = list.slice(0, 20).map(p => ({
        name: p.name || p.path || p.project || 'unnamed',
        path: p.path || null,
        nodes: p.node_count ?? p.nodes ?? null,
        edges: p.edge_count ?? p.edges ?? null,
      }));
    } else if (list && Array.isArray(list.projects)) {
      out.projects = list.projects.slice(0, 20);
    }
  } catch { /* older binaries may not support list_projects */ }
  // Try architecture snapshot for whichever project is 'active'.
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
  } catch { /* no active project yet — dashboard shows CTA */ }
  return out;
}

module.exports = {
  isInstalled, getVersion, install, autoConfigureAgents, status, query, dashboardSnapshot,
  capabilities, parseCapabilities, versionNote,
};
