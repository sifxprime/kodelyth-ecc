'use strict';

/**
 * Install a released binary on Windows.
 *
 * Both RTK and codebase-memory-mcp publish Windows builds, but ECC never
 * implemented the download path and reported "windows requires manual install"
 * instead. That was a gap here, not a limitation upstream:
 *
 *   rtk-x86_64-pc-windows-msvc.zip
 *   codebase-memory-mcp-windows-amd64.zip  /  -arm64.zip
 *
 * Uses GitHub's `releases/latest/download/<asset>` URL, which always redirects
 * to the newest release's asset — no API call, so no token and no rate limit.
 *
 * curl.exe and tar.exe both ship with Windows 10 1803 and later, and tar there
 * is bsdtar, which extracts zip. That avoids PowerShell quoting entirely. Both
 * are probed before use so an older machine gets a clear message rather than a
 * spawn error.
 *
 * PATH is deliberately NOT modified. The POSIX path installs to ~/.local/bin and
 * tells the user to add it; this mirrors that, reporting the exact setx command
 * rather than silently editing a user's environment.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

/** Where ECC puts binaries it installs on Windows. User-writable, no admin. */
function installDir() {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(base, 'Kodelyth', 'bin');
}

function have(bin) {
  try {
    execFileSync(bin, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {object}   opts
 * @param {string}   opts.repo     "owner/name"
 * @param {string}   opts.asset    asset filename in the latest release
 * @param {string}   opts.binName  executable to find after extraction (with .exe)
 * @param {function} [opts.log]
 * @returns {{installed:boolean, reason?:string, dir?:string, binPath?:string, onPath?:boolean}}
 */
function installFromRelease({ repo, asset, binName, log = () => {} }) {
  if (process.platform !== 'win32') {
    return { installed: false, reason: 'installFromRelease is Windows-only' };
  }
  if (!have('curl')) {
    return { installed: false, reason: 'curl.exe not found (needs Windows 10 1803 or later)' };
  }
  if (!have('tar')) {
    return { installed: false, reason: 'tar.exe not found (needs Windows 10 1803 or later)' };
  }

  const dir = installDir();
  const url = `https://github.com/${repo}/releases/latest/download/${asset}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-win-'));
  const zip = path.join(tmp, asset);

  try {
    fs.mkdirSync(dir, { recursive: true });

    log(`[win] downloading ${asset}…`);
    // -L to follow the release redirect, -f so a 404 is an error rather than
    // an HTML error page written to disk and then "extracted".
    const dl = spawnSync('curl', ['-fsSL', '-o', zip, url], { stdio: 'inherit' });
    if (dl.status !== 0) {
      return { installed: false, reason: `download failed (curl exit ${dl.status}) — ${url}` };
    }
    if (!fs.existsSync(zip) || fs.statSync(zip).size === 0) {
      return { installed: false, reason: `downloaded file is empty — ${url}` };
    }

    log('[win] extracting…');
    const ex = spawnSync('tar', ['-xf', zip, '-C', dir], { stdio: 'inherit' });
    if (ex.status !== 0) {
      return { installed: false, reason: `extract failed (tar exit ${ex.status})` };
    }

    // Archives vary: some put the binary at the root, some inside a folder.
    const binPath = findBinary(dir, binName);
    if (!binPath) {
      return { installed: false, reason: `${binName} not found in ${asset} after extraction` };
    }
    // Flatten so the binary sits directly in dir and one PATH entry covers it.
    const finalPath = path.join(dir, binName);
    if (binPath !== finalPath) fs.copyFileSync(binPath, finalPath);

    // Make it usable in THIS process so a follow-up isInstalled() check passes
    // without the user restarting their shell.
    const sep = path.delimiter;
    if (!(process.env.PATH || '').split(sep).includes(dir)) {
      process.env.PATH = `${dir}${sep}${process.env.PATH || ''}`;
    }

    return { installed: true, dir, binPath: finalPath, onPath: isOnUserPath(dir) };
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp dir */ }
  }
}

/** Depth-limited search — these archives are shallow; this avoids walking a tree. */
function findBinary(root, binName, depth = 0) {
  if (depth > 3) return null;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    const p = path.join(root, e.name);
    if (e.isFile() && e.name.toLowerCase() === binName.toLowerCase()) return p;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      const found = findBinary(path.join(root, e.name), binName, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Whether the directory is on the user's PERSISTENT PATH, not just this
 * process's. Checking process.env would always say yes right after we prepend
 * it, which would wrongly tell the user there is nothing left to do.
 */
function isOnUserPath(dir) {
  try {
    const out = execFileSync(
      'reg',
      ['query', 'HKCU\\Environment', '/v', 'Path'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return out.toLowerCase().includes(dir.toLowerCase());
  } catch {
    return false;
  }
}

/** The exact command to persist the directory on PATH, for the user to run. */
function setxHint(dir) {
  return `setx PATH "%PATH%;${dir}"`;
}

module.exports = { installFromRelease, installDir, isOnUserPath, setxHint, findBinary };
