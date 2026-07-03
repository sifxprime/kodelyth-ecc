// scripts/rtk/index.js
// RTK (Rust Token Killer) integration — auto-installs and wires RTK into the IDE
// that ECC was installed for, so shell commands run through RTK's filter for
// 60-90% token savings.
//
// Public API:
//   isInstalled()          → boolean
//   install({ log })       → { installed, method, version } | { skipped, reason }
//   enableFor(target,{log})→ { enabled, target, agent, output } | { skipped, reason }
//   status()               → { installed, version, agents: [...] }
//   savings({ days })      → parsed `rtk gain --format json` snapshot or null
'use strict';

const { execFileSync, spawnSync } = require('child_process');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// ── ECC install target → RTK agent flag ──────────────────────────────────────
// Reference: `rtk init --help` and RTK README "Supported AI Tools" table.
const TARGET_MAP = {
  'claude-code':      ['init', '-g'],
  'cursor':           ['init', '-g', '--agent', 'cursor'],
  'cursor-project':   ['init',       '--agent', 'cursor'],
  'windsurf-home':    ['init', '-g', '--agent', 'windsurf'],
  'windsurf-project': ['init',       '--agent', 'windsurf'],
  'antigravity':      ['init',       '--agent', 'antigravity'],
  'codex-home':       ['init', '-g', '--codex'],
  'opencode':         ['init', '-g', '--opencode'],
  'cline':            ['init',       '--agent', 'cline'],
  'gemini-cli':       ['init', '-g', '--gemini'],
};

function isInstalled() {
  try {
    execFileSync('rtk', ['--version'], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function getVersion() {
  try {
    return execFileSync('rtk', ['--version'], { encoding: 'utf8' }).trim();
  } catch { return null; }
}

// ── Install RTK binary ───────────────────────────────────────────────────────
// Mac: prefer `brew install rtk` if brew is on PATH (fastest, cached).
// Otherwise: pipe the official install script through sh (installs to ~/.local/bin).
// Windows: skipped (needs manual .zip download from releases).
function install({ log = () => {} } = {}) {
  if (isInstalled()) {
    return { installed: false, skipped: true, reason: 'already installed', version: getVersion() };
  }
  if (os.platform() === 'win32') {
    return { installed: false, skipped: true, reason: 'windows requires manual install: https://github.com/rtk-ai/rtk/releases' };
  }

  // Try Homebrew first on macOS.
  if (os.platform() === 'darwin') {
    try {
      execFileSync('brew', ['--version'], { stdio: 'ignore' });
      log('[rtk] installing via Homebrew…');
      const r = spawnSync('brew', ['install', 'rtk'], { stdio: 'inherit' });
      if (r.status === 0 && isInstalled()) {
        return { installed: true, method: 'brew', version: getVersion() };
      }
      log('[rtk] brew install did not complete; falling back to curl script');
    } catch { /* brew not present */ }
  }

  // Fall back to the official install script.
  log('[rtk] installing via curl script (installs to ~/.local/bin)…');
  const script = 'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh';
  const r = spawnSync('sh', ['-c', script], { stdio: 'inherit' });
  if (r.status !== 0) {
    return { installed: false, skipped: true, reason: 'install script failed — install rtk manually: https://github.com/rtk-ai/rtk#installation' };
  }

  // Make sure ~/.local/bin is on PATH for this process so isInstalled() succeeds.
  const localBin = path.join(os.homedir(), '.local', 'bin');
  if (fs.existsSync(path.join(localBin, 'rtk')) && !process.env.PATH.split(':').includes(localBin)) {
    process.env.PATH = `${localBin}:${process.env.PATH}`;
  }

  if (!isInstalled()) {
    return { installed: false, skipped: true, reason: 'installed to ~/.local/bin but not on PATH — add "export PATH=$HOME/.local/bin:$PATH" to your shell rc' };
  }
  return { installed: true, method: 'curl', version: getVersion() };
}

// ── Enable RTK for a specific IDE ────────────────────────────────────────────
function enableFor(target, { log = () => {} } = {}) {
  if (!isInstalled()) {
    return { enabled: false, skipped: true, reason: 'rtk binary not on PATH' };
  }
  const rtkArgs = TARGET_MAP[target];
  if (!rtkArgs) {
    return { enabled: false, skipped: true, reason: `no RTK mapping for target "${target}"` };
  }

  log(`[rtk] wiring RTK into ${target} …`);
  const r = spawnSync('rtk', [...rtkArgs, '--auto-patch'], { encoding: 'utf8' });
  const output = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0) {
    return { enabled: false, skipped: true, reason: 'rtk init failed', output };
  }
  return { enabled: true, target, agent: rtkArgs.join(' '), output: output.trim() };
}

// ── Disable RTK for a specific IDE (removes hook + RTK.md) ───────────────────
function disableFor(target, { log = () => {} } = {}) {
  if (!isInstalled()) return { disabled: false, skipped: true, reason: 'rtk not installed' };
  const rtkArgs = TARGET_MAP[target];
  if (!rtkArgs) return { disabled: false, skipped: true, reason: `no RTK mapping for target "${target}"` };
  log(`[rtk] removing RTK from ${target} …`);
  const r = spawnSync('rtk', [...rtkArgs, '--uninstall'], { encoding: 'utf8' });
  return { disabled: r.status === 0, output: ((r.stdout || '') + (r.stderr || '')).trim() };
}

// ── Status: what's installed, what's active ──────────────────────────────────
function status() {
  const installed = isInstalled();
  if (!installed) return { installed: false, version: null, active: [] };
  const version = getVersion();
  const active  = [];
  try {
    const r = execFileSync('rtk', ['init', '--show'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    // Only surface the '[ok]' status rows — skip the usage help RTK prints below.
    for (const line of r.split('\n')) {
      const t = line.trim();
      if (t.startsWith('[ok]') || t.startsWith('[--]')) active.push(t);
    }
  } catch { /* older rtk versions may not have --show */ }
  return { installed: true, version, active };
}

// ── Savings: read `rtk gain --format json` for dashboard ─────────────────────
function savings({ days = 30 } = {}) {
  if (!isInstalled()) return null;
  try {
    const r = execFileSync('rtk', ['gain', '--all', '--format', 'json'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024,
    });
    return { ok: true, days, gain: JSON.parse(r) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  TARGET_MAP,
  isInstalled,
  getVersion,
  install,
  enableFor,
  disableFor,
  status,
  savings,
};
